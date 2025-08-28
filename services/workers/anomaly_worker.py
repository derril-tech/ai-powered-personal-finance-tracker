# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json
import os
from dataclasses import dataclass
from enum import Enum

# ML imports
try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    from sklearn.decomposition import PCA
    from sklearn.cluster import DBSCAN
    from scipy import stats
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logging.warning("ML libraries not available. Install scikit-learn, scipy for full functionality.")

logger = logging.getLogger(__name__)

class AnomalyType(Enum):
    AMOUNT = "amount"
    FREQUENCY = "frequency"
    TIMING = "timing"
    MERCHANT = "merchant"
    CATEGORY = "category"
    PATTERN = "pattern"

class AnomalySeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

@dataclass
class AnomalyResult:
    id: str
    household_id: str
    transaction_id: Optional[str]
    anomaly_type: AnomalyType
    severity: AnomalySeverity
    score: float
    threshold: float
    reason: str
    merchant_name: Optional[str] = None
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[datetime] = None
    features: Optional[Dict[str, float]] = None
    confidence: float = 0.0
    is_false_positive: bool = False
    user_verdict: Optional[str] = None
    created_at: Optional[datetime] = None

@dataclass
class AnomalyConfig:
    household_id: str
    entity_type: str  # 'merchant', 'category', 'household'
    entity_id: Optional[str] = None
    amount_threshold: float = 2.0  # z-score threshold for amount anomalies
    frequency_threshold: float = 2.0  # z-score threshold for frequency anomalies
    isolation_forest_contamination: float = 0.1  # expected fraction of anomalies
    min_samples: int = 10  # minimum samples for training
    lookback_days: int = 90  # days of historical data to analyze
    confidence_threshold: float = 0.7  # minimum confidence for anomaly detection

class AnomalyWorker:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # Model cache
        self.models: Dict[str, Any] = {}
        self.scalers: Dict[str, StandardScaler] = {}
        
    async def get_historical_data(self, config: AnomalyConfig) -> pd.DataFrame:
        """Fetch historical transaction data for anomaly detection"""
        query = """
        SELECT 
            t.id,
            t.amount,
            t.date,
            t.merchant_name,
            t.category_id,
            c.name as category_name,
            t.description,
            t.is_transfer,
            EXTRACT(EPOCH FROM t.date) as timestamp,
            EXTRACT(DOW FROM t.date) as day_of_week,
            EXTRACT(DAY FROM t.date) as day_of_month,
            EXTRACT(MONTH FROM t.date) as month,
            EXTRACT(YEAR FROM t.date) as year
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE a.household_id = :household_id
        AND t.date >= CURRENT_DATE - INTERVAL ':lookback_days days'
        AND t.amount < 0  -- Only expenses
        AND t.is_transfer = false
        """
        
        if config.entity_type == 'merchant' and config.entity_id:
            query += " AND t.merchant_name = :entity_id"
        elif config.entity_type == 'category' and config.entity_id:
            query += " AND t.category_id = :entity_id"
        
        query += " ORDER BY t.date"
        
        params = {
            'household_id': config.household_id,
            'lookback_days': config.lookback_days
        }
        
        if config.entity_id:
            params['entity_id'] = config.entity_id
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            data = pd.DataFrame(result.fetchall(), columns=[
                'id', 'amount', 'date', 'merchant_name', 'category_id', 'category_name',
                'description', 'is_transfer', 'timestamp', 'day_of_week', 'day_of_month',
                'month', 'year'
            ])
        
        if data.empty:
            raise ValueError(f"No historical data found for {config.entity_type} {config.entity_id}")
        
        data['date'] = pd.to_datetime(data['date'])
        data['amount'] = abs(data['amount'])  # Convert to positive for analysis
        
        return data
    
    async def detect_anomalies(self, config: AnomalyConfig) -> List[AnomalyResult]:
        """Detect anomalies using multiple methods"""
        try:
            data = await self.get_historical_data(config)
            
            if len(data) < config.min_samples:
                logger.warning(f"Insufficient data for anomaly detection: {len(data)} samples")
                return []
            
            anomalies = []
            
            # 1. Amount-based anomalies (z-score)
            amount_anomalies = await self._detect_amount_anomalies(data, config)
            anomalies.extend(amount_anomalies)
            
            # 2. Frequency-based anomalies
            frequency_anomalies = await self._detect_frequency_anomalies(data, config)
            anomalies.extend(frequency_anomalies)
            
            # 3. Pattern-based anomalies (Isolation Forest)
            pattern_anomalies = await self._detect_pattern_anomalies(data, config)
            anomalies.extend(pattern_anomalies)
            
            # 4. Timing anomalies
            timing_anomalies = await self._detect_timing_anomalies(data, config)
            anomalies.extend(timing_anomalies)
            
            # Store anomalies
            await self._store_anomalies(anomalies)
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error detecting anomalies for {config.entity_type} {config.entity_id}: {str(e)}")
            raise
    
    async def _detect_amount_anomalies(self, data: pd.DataFrame, config: AnomalyConfig) -> List[AnomalyResult]:
        """Detect amount-based anomalies using z-scores"""
        anomalies = []
        
        # Calculate z-scores for amounts
        amounts = data['amount'].values
        mean_amount = np.mean(amounts)
        std_amount = np.std(amounts)
        
        if std_amount == 0:
            return anomalies
        
        z_scores = np.abs((amounts - mean_amount) / std_amount)
        
        # Find anomalies above threshold
        anomaly_indices = np.where(z_scores > config.amount_threshold)[0]
        
        for idx in anomaly_indices:
            row = data.iloc[idx]
            score = z_scores[idx]
            severity = self._calculate_severity(score, config.amount_threshold)
            
            reason = f"Amount ({row['amount']:.2f}) is {score:.1f} standard deviations from mean ({mean_amount:.2f})"
            
            anomaly = AnomalyResult(
                id=f"amount_{row['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                household_id=config.household_id,
                transaction_id=row['id'],
                anomaly_type=AnomalyType.AMOUNT,
                severity=severity,
                score=score,
                threshold=config.amount_threshold,
                reason=reason,
                merchant_name=row['merchant_name'],
                category_id=row['category_id'],
                category_name=row['category_name'],
                amount=row['amount'],
                date=row['date'],
                features={'z_score': score, 'mean_amount': mean_amount, 'std_amount': std_amount},
                confidence=min(1.0, score / (config.amount_threshold * 2))
            )
            
            anomalies.append(anomaly)
        
        return anomalies
    
    async def _detect_frequency_anomalies(self, data: pd.DataFrame, config: AnomalyConfig) -> List[AnomalyResult]:
        """Detect frequency-based anomalies"""
        anomalies = []
        
        # Group by day and count transactions
        daily_counts = data.groupby(data['date'].dt.date).size()
        
        if len(daily_counts) < 7:  # Need at least a week of data
            return anomalies
        
        # Calculate z-scores for daily transaction counts
        counts = daily_counts.values
        mean_count = np.mean(counts)
        std_count = np.std(counts)
        
        if std_count == 0:
            return anomalies
        
        z_scores = np.abs((counts - mean_count) / std_count)
        
        # Find days with unusual transaction frequency
        anomaly_indices = np.where(z_scores > config.frequency_threshold)[0]
        
        for idx in anomaly_indices:
            date = daily_counts.index[idx]
            count = counts[idx]
            score = z_scores[idx]
            severity = self._calculate_severity(score, config.frequency_threshold)
            
            reason = f"Unusual transaction frequency: {count} transactions on {date} (avg: {mean_count:.1f})"
            
            anomaly = AnomalyResult(
                id=f"freq_{date}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                household_id=config.household_id,
                transaction_id=None,
                anomaly_type=AnomalyType.FREQUENCY,
                severity=severity,
                score=score,
                threshold=config.frequency_threshold,
                reason=reason,
                date=pd.to_datetime(date),
                features={'transaction_count': count, 'mean_count': mean_count, 'std_count': std_count},
                confidence=min(1.0, score / (config.frequency_threshold * 2))
            )
            
            anomalies.append(anomaly)
        
        return anomalies
    
    async def _detect_pattern_anomalies(self, data: pd.DataFrame, config: AnomalyConfig) -> List[AnomalyResult]:
        """Detect pattern-based anomalies using Isolation Forest"""
        if not ML_AVAILABLE:
            return []
        
        try:
            # Prepare features
            features = self._extract_features(data)
            
            if len(features) < config.min_samples:
                return []
            
            # Scale features
            scaler = StandardScaler()
            features_scaled = scaler.fit_transform(features)
            
            # Train Isolation Forest
            model = IsolationForest(
                contamination=config.isolation_forest_contamination,
                random_state=42,
                n_estimators=100
            )
            
            # Fit and predict
            predictions = model.fit_predict(features_scaled)
            scores = model.score_samples(features_scaled)
            
            # Find anomalies (predictions == -1)
            anomaly_indices = np.where(predictions == -1)[0]
            
            anomalies = []
            for idx in anomaly_indices:
                row = data.iloc[idx]
                score = -scores[idx]  # Convert to positive (higher = more anomalous)
                severity = self._calculate_severity(score, 0.5)  # Threshold for isolation forest
                
                reason = f"Unusual transaction pattern detected by machine learning model"
                
                anomaly = AnomalyResult(
                    id=f"pattern_{row['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    household_id=config.household_id,
                    transaction_id=row['id'],
                    anomaly_type=AnomalyType.PATTERN,
                    severity=severity,
                    score=score,
                    threshold=0.5,
                    reason=reason,
                    merchant_name=row['merchant_name'],
                    category_id=row['category_id'],
                    category_name=row['category_name'],
                    amount=row['amount'],
                    date=row['date'],
                    features={'isolation_score': score},
                    confidence=min(1.0, score)
                )
                
                anomalies.append(anomaly)
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error in pattern anomaly detection: {str(e)}")
            return []
    
    async def _detect_timing_anomalies(self, data: pd.DataFrame, config: AnomalyConfig) -> List[AnomalyResult]:
        """Detect timing-based anomalies"""
        anomalies = []
        
        # Analyze transaction timing patterns
        data_sorted = data.sort_values('date')
        
        # Calculate time differences between consecutive transactions
        time_diffs = data_sorted['date'].diff().dt.total_seconds() / 3600  # hours
        
        if len(time_diffs) < 5:  # Need at least 5 transactions
            return anomalies
        
        # Remove first row (NaN) and filter reasonable time differences
        time_diffs = time_diffs.dropna()
        time_diffs = time_diffs[time_diffs > 0]  # Remove negative or zero differences
        
        if len(time_diffs) < 3:
            return anomalies
        
        # Calculate z-scores for time differences
        mean_diff = np.mean(time_diffs)
        std_diff = np.std(time_diffs)
        
        if std_diff == 0:
            return anomalies
        
        z_scores = np.abs((time_diffs - mean_diff) / std_diff)
        
        # Find unusual timing patterns
        anomaly_indices = np.where(z_scores > 2.0)[0]  # 2 standard deviations
        
        for idx in anomaly_indices:
            original_idx = time_diffs.index[idx]
            row = data_sorted.iloc[original_idx]
            score = z_scores.iloc[idx]
            time_diff = time_diffs.iloc[idx]
            
            severity = self._calculate_severity(score, 2.0)
            
            reason = f"Unusual timing: {time_diff:.1f} hours between transactions (avg: {mean_diff:.1f} hours)"
            
            anomaly = AnomalyResult(
                id=f"timing_{row['id']}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                household_id=config.household_id,
                transaction_id=row['id'],
                anomaly_type=AnomalyType.TIMING,
                severity=severity,
                score=score,
                threshold=2.0,
                reason=reason,
                merchant_name=row['merchant_name'],
                category_id=row['category_id'],
                category_name=row['category_name'],
                amount=row['amount'],
                date=row['date'],
                features={'time_diff_hours': time_diff, 'mean_diff': mean_diff, 'std_diff': std_diff},
                confidence=min(1.0, score / 4.0)
            )
            
            anomalies.append(anomaly)
        
        return anomalies
    
    def _extract_features(self, data: pd.DataFrame) -> np.ndarray:
        """Extract features for machine learning models"""
        features = []
        
        for _, row in data.iterrows():
            feature_vector = [
                row['amount'],
                row['day_of_week'],
                row['day_of_month'],
                row['month'],
                row['year'],
                row['timestamp'] % (24 * 3600),  # Time of day in seconds
                len(str(row['description'])),  # Description length
                1 if row['merchant_name'] else 0,  # Has merchant
                1 if row['category_id'] else 0,  # Has category
            ]
            features.append(feature_vector)
        
        return np.array(features)
    
    def _calculate_severity(self, score: float, threshold: float) -> AnomalySeverity:
        """Calculate anomaly severity based on score and threshold"""
        ratio = score / threshold
        
        if ratio >= 3.0:
            return AnomalySeverity.CRITICAL
        elif ratio >= 2.0:
            return AnomalySeverity.HIGH
        elif ratio >= 1.5:
            return AnomalySeverity.MEDIUM
        else:
            return AnomalySeverity.LOW
    
    async def _store_anomalies(self, anomalies: List[AnomalyResult]):
        """Store anomalies in database"""
        if not anomalies:
            return
        
        # Create anomalies table if it doesn't exist
        create_table_query = """
        CREATE TABLE IF NOT EXISTS anomalies (
            id VARCHAR(255) PRIMARY KEY,
            household_id VARCHAR(255) NOT NULL,
            transaction_id VARCHAR(255),
            anomaly_type VARCHAR(50) NOT NULL,
            severity VARCHAR(50) NOT NULL,
            score DECIMAL(10,4) NOT NULL,
            threshold DECIMAL(10,4) NOT NULL,
            reason TEXT NOT NULL,
            merchant_name VARCHAR(255),
            category_id VARCHAR(255),
            category_name VARCHAR(255),
            amount DECIMAL(15,2),
            date TIMESTAMP,
            features JSONB,
            confidence DECIMAL(5,2) DEFAULT 0.0,
            is_false_positive BOOLEAN DEFAULT false,
            user_verdict VARCHAR(50),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            for anomaly in anomalies:
                insert_query = """
                INSERT INTO anomalies (
                    id, household_id, transaction_id, anomaly_type, severity,
                    score, threshold, reason, merchant_name, category_id,
                    category_name, amount, date, features, confidence
                ) VALUES (
                    :id, :household_id, :transaction_id, :anomaly_type, :severity,
                    :score, :threshold, :reason, :merchant_name, :category_id,
                    :category_name, :amount, :date, :features, :confidence
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    score = EXCLUDED.score,
                    severity = EXCLUDED.severity,
                    reason = EXCLUDED.reason,
                    confidence = EXCLUDED.confidence,
                    created_at = CURRENT_TIMESTAMP
                """
                
                session.execute(text(insert_query), {
                    'id': anomaly.id,
                    'household_id': anomaly.household_id,
                    'transaction_id': anomaly.transaction_id,
                    'anomaly_type': anomaly.anomaly_type.value,
                    'severity': anomaly.severity.value,
                    'score': anomaly.score,
                    'threshold': anomaly.threshold,
                    'reason': anomaly.reason,
                    'merchant_name': anomaly.merchant_name,
                    'category_id': anomaly.category_id,
                    'category_name': anomaly.category_name,
                    'amount': anomaly.amount,
                    'date': anomaly.date,
                    'features': json.dumps(anomaly.features) if anomaly.features else None,
                    'confidence': anomaly.confidence
                })
            
            session.commit()
    
    async def get_anomalies(self, household_id: str, days_back: int = 30, 
                           severity_filter: Optional[AnomalySeverity] = None,
                           type_filter: Optional[AnomalyType] = None) -> List[AnomalyResult]:
        """Retrieve stored anomalies"""
        query = """
        SELECT 
            id, household_id, transaction_id, anomaly_type, severity,
            score, threshold, reason, merchant_name, category_id,
            category_name, amount, date, features, confidence,
            is_false_positive, user_verdict, created_at
        FROM anomalies
        WHERE household_id = :household_id
        AND created_at >= CURRENT_DATE - INTERVAL ':days_back days'
        """
        
        if severity_filter:
            query += " AND severity = :severity"
        
        if type_filter:
            query += " AND anomaly_type = :anomaly_type"
        
        query += " ORDER BY created_at DESC"
        
        params = {
            'household_id': household_id,
            'days_back': days_back
        }
        
        if severity_filter:
            params['severity'] = severity_filter.value
        
        if type_filter:
            params['anomaly_type'] = type_filter.value
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            
            anomalies = []
            for row in result.fetchall():
                anomalies.append(AnomalyResult(
                    id=row.id,
                    household_id=row.household_id,
                    transaction_id=row.transaction_id,
                    anomaly_type=AnomalyType(row.anomaly_type),
                    severity=AnomalySeverity(row.severity),
                    score=row.score,
                    threshold=row.threshold,
                    reason=row.reason,
                    merchant_name=row.merchant_name,
                    category_id=row.category_id,
                    category_name=row.category_name,
                    amount=row.amount,
                    date=row.date,
                    features=json.loads(row.features) if row.features else None,
                    confidence=row.confidence,
                    is_false_positive=row.is_false_positive,
                    user_verdict=row.user_verdict,
                    created_at=row.created_at
                ))
            
            return anomalies
    
    async def update_anomaly_verdict(self, anomaly_id: str, verdict: str, is_false_positive: bool = False):
        """Update anomaly verdict (legit/fraud)"""
        query = """
        UPDATE anomalies
        SET user_verdict = :verdict, is_false_positive = :is_false_positive
        WHERE id = :anomaly_id
        """
        
        with self.Session() as session:
            session.execute(text(query), {
                'anomaly_id': anomaly_id,
                'verdict': verdict,
                'is_false_positive': is_false_positive
            })
            session.commit()

async def main():
    """Main function for testing"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/finance')
    worker = AnomalyWorker(db_url)
    
    # Example usage
    config = AnomalyConfig(
        household_id='test-household',
        entity_type='category',
        entity_id='test-category',
        amount_threshold=2.0,
        frequency_threshold=2.0,
        isolation_forest_contamination=0.1
    )
    
    try:
        # Detect anomalies
        anomalies = await worker.detect_anomalies(config)
        print(f"Detected {len(anomalies)} anomalies")
        
        # Get recent anomalies
        recent_anomalies = await worker.get_anomalies(
            household_id='test-household',
            days_back=30,
            severity_filter=AnomalySeverity.HIGH
        )
        print(f"Found {len(recent_anomalies)} high-severity anomalies")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
