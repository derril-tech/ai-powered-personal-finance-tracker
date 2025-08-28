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

logger = logging.getLogger(__name__)

class VerdictType(Enum):
    LEGIT = "legit"
    FRAUD = "fraud"
    UNSURE = "unsure"

class ThresholdAdjustment(Enum):
    INCREASE = "increase"
    DECREASE = "decrease"
    MAINTAIN = "maintain"

@dataclass
class VerdictFeedback:
    id: str
    anomaly_id: str
    household_id: str
    verdict: VerdictType
    confidence: float
    feedback_notes: Optional[str] = None
    created_at: Optional[datetime] = None

@dataclass
class ModelPerformance:
    household_id: str
    model_type: str
    entity_type: str
    entity_id: Optional[str]
    precision: float
    recall: float
    f1_score: float
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int
    total_predictions: int
    last_updated: Optional[datetime] = None

@dataclass
class ThresholdRecommendation:
    entity_type: str
    entity_id: Optional[str]
    current_threshold: float
    recommended_threshold: float
    adjustment: ThresholdAdjustment
    confidence: float
    reasoning: str

class VerdictFeedbackWorker:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # Configuration
        self.min_feedback_count = 10  # Minimum feedback before adjusting thresholds
        self.performance_window_days = 90  # Days to consider for performance metrics
        self.threshold_adjustment_factor = 0.1  # How much to adjust thresholds
        
    async def record_verdict(self, anomaly_id: str, household_id: str, verdict: VerdictType, 
                           confidence: float, feedback_notes: Optional[str] = None) -> VerdictFeedback:
        """Record user verdict on an anomaly"""
        try:
            # Create verdict feedback
            feedback = VerdictFeedback(
                id=f"verdict_{anomaly_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                anomaly_id=anomaly_id,
                household_id=household_id,
                verdict=verdict,
                confidence=confidence,
                feedback_notes=feedback_notes,
                created_at=datetime.now()
            )
            
            # Store feedback
            await self._store_verdict_feedback(feedback)
            
            # Update anomaly with verdict
            await self._update_anomaly_verdict(anomaly_id, verdict.value, verdict == VerdictType.LEGIT)
            
            # Update performance metrics
            await self._update_performance_metrics(household_id)
            
            # Check if thresholds should be adjusted
            await self._check_threshold_adjustments(household_id)
            
            return feedback
            
        except Exception as e:
            logger.error(f"Error recording verdict for anomaly {anomaly_id}: {str(e)}")
            raise
    
    async def get_performance_metrics(self, household_id: str, model_type: Optional[str] = None,
                                    entity_type: Optional[str] = None) -> List[ModelPerformance]:
        """Get performance metrics for anomaly detection models"""
        query = """
        SELECT 
            household_id, model_type, entity_type, entity_id,
            precision, recall, f1_score, true_positives, false_positives,
            true_negatives, false_negatives, total_predictions, last_updated
        FROM model_performance
        WHERE household_id = :household_id
        """
        
        params = {'household_id': household_id}
        
        if model_type:
            query += " AND model_type = :model_type"
            params['model_type'] = model_type
        
        if entity_type:
            query += " AND entity_type = :entity_type"
            params['entity_type'] = entity_type
        
        query += " ORDER BY last_updated DESC"
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            
            metrics = []
            for row in result.fetchall():
                metrics.append(ModelPerformance(
                    household_id=row.household_id,
                    model_type=row.model_type,
                    entity_type=row.entity_type,
                    entity_id=row.entity_id,
                    precision=row.precision,
                    recall=row.recall,
                    f1_score=row.f1_score,
                    true_positives=row.true_positives,
                    false_positives=row.false_positives,
                    true_negatives=row.true_negatives,
                    false_negatives=row.false_negatives,
                    total_predictions=row.total_predictions,
                    last_updated=row.last_updated
                ))
            
            return metrics
    
    async def get_threshold_recommendations(self, household_id: str) -> List[ThresholdRecommendation]:
        """Get threshold adjustment recommendations based on performance"""
        try:
            # Get recent performance metrics
            metrics = await self.get_performance_metrics(household_id)
            
            recommendations = []
            
            for metric in metrics:
                if metric.total_predictions < self.min_feedback_count:
                    continue
                
                # Analyze performance and recommend threshold adjustments
                recommendation = await self._analyze_performance_for_thresholds(metric)
                if recommendation:
                    recommendations.append(recommendation)
            
            return recommendations
            
        except Exception as e:
            logger.error(f"Error getting threshold recommendations: {str(e)}")
            return []
    
    async def apply_threshold_adjustment(self, household_id: str, entity_type: str, 
                                       entity_id: Optional[str], new_threshold: float):
        """Apply threshold adjustment and retrain models if needed"""
        try:
            # Update threshold in configuration
            await self._update_threshold_config(household_id, entity_type, entity_id, new_threshold)
            
            # Mark for retraining
            await self._schedule_retraining(household_id, entity_type, entity_id)
            
            logger.info(f"Applied threshold adjustment: {entity_type} {entity_id} -> {new_threshold}")
            
        except Exception as e:
            logger.error(f"Error applying threshold adjustment: {str(e)}")
            raise
    
    async def _store_verdict_feedback(self, feedback: VerdictFeedback):
        """Store verdict feedback in database"""
        create_table_query = """
        CREATE TABLE IF NOT EXISTS verdict_feedback (
            id VARCHAR(255) PRIMARY KEY,
            anomaly_id VARCHAR(255) NOT NULL,
            household_id VARCHAR(255) NOT NULL,
            verdict VARCHAR(50) NOT NULL,
            confidence DECIMAL(5,2) NOT NULL,
            feedback_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            insert_query = """
            INSERT INTO verdict_feedback (
                id, anomaly_id, household_id, verdict, confidence, feedback_notes, created_at
            ) VALUES (
                :id, :anomaly_id, :household_id, :verdict, :confidence, :feedback_notes, :created_at
            )
            """
            
            session.execute(text(insert_query), {
                'id': feedback.id,
                'anomaly_id': feedback.anomaly_id,
                'household_id': feedback.household_id,
                'verdict': feedback.verdict.value,
                'confidence': feedback.confidence,
                'feedback_notes': feedback.feedback_notes,
                'created_at': feedback.created_at
            })
            
            session.commit()
    
    async def _update_anomaly_verdict(self, anomaly_id: str, verdict: str, is_false_positive: bool):
        """Update anomaly with user verdict"""
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
    
    async def _update_performance_metrics(self, household_id: str):
        """Update performance metrics based on recent verdicts"""
        try:
            # Get recent verdicts and anomalies
            query = """
            SELECT 
                a.anomaly_type,
                a.severity,
                a.score,
                a.threshold,
                v.verdict,
                a.merchant_name,
                a.category_id,
                a.category_name
            FROM anomalies a
            JOIN verdict_feedback v ON a.id = v.anomaly_id
            WHERE a.household_id = :household_id
            AND v.created_at >= CURRENT_DATE - INTERVAL ':days days'
            """
            
            with self.Session() as session:
                result = session.execute(text(query), {
                    'household_id': household_id,
                    'days': self.performance_window_days
                })
                
                data = pd.DataFrame(result.fetchall(), columns=[
                    'anomaly_type', 'severity', 'score', 'threshold', 'verdict',
                    'merchant_name', 'category_id', 'category_name'
                ])
            
            if data.empty:
                return
            
            # Calculate performance metrics by entity type
            await self._calculate_entity_performance(data, household_id)
            
        except Exception as e:
            logger.error(f"Error updating performance metrics: {str(e)}")
    
    async def _calculate_entity_performance(self, data: pd.DataFrame, household_id: str):
        """Calculate performance metrics for different entity types"""
        # Group by entity type and calculate metrics
        entity_groups = {
            'merchant': data.groupby('merchant_name'),
            'category': data.groupby('category_id'),
            'household': [('household', data)]  # Single group for household-level
        }
        
        for entity_type, groups in entity_groups.items():
            for entity_id, group_data in groups:
                if len(group_data) < 5:  # Need minimum samples
                    continue
                
                # Calculate confusion matrix
                tp = len(group_data[(group_data['verdict'] == 'fraud') & (group_data['severity'].isin(['high', 'critical']))])
                fp = len(group_data[(group_data['verdict'] == 'legit') & (group_data['severity'].isin(['high', 'critical']))])
                tn = len(group_data[(group_data['verdict'] == 'legit') & (group_data['severity'].isin(['low', 'medium']))])
                fn = len(group_data[(group_data['verdict'] == 'fraud') & (group_data['severity'].isin(['low', 'medium']))])
                
                # Calculate metrics
                precision = tp / (tp + fp) if (tp + fp) > 0 else 0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 0
                f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
                
                # Store performance metrics
                await self._store_performance_metrics(
                    household_id=household_id,
                    model_type='anomaly_detection',
                    entity_type=entity_type,
                    entity_id=entity_id if entity_type != 'household' else None,
                    precision=precision,
                    recall=recall,
                    f1_score=f1_score,
                    true_positives=tp,
                    false_positives=fp,
                    true_negatives=tn,
                    false_negatives=fn,
                    total_predictions=len(group_data)
                )
    
    async def _store_performance_metrics(self, household_id: str, model_type: str, entity_type: str,
                                       entity_id: Optional[str], precision: float, recall: float,
                                       f1_score: float, true_positives: int, false_positives: int,
                                       true_negatives: int, false_negatives: int, total_predictions: int):
        """Store performance metrics in database"""
        create_table_query = """
        CREATE TABLE IF NOT EXISTS model_performance (
            id SERIAL PRIMARY KEY,
            household_id VARCHAR(255) NOT NULL,
            model_type VARCHAR(100) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(255),
            precision DECIMAL(5,4) NOT NULL,
            recall DECIMAL(5,4) NOT NULL,
            f1_score DECIMAL(5,4) NOT NULL,
            true_positives INTEGER NOT NULL,
            false_positives INTEGER NOT NULL,
            true_negatives INTEGER NOT NULL,
            false_negatives INTEGER NOT NULL,
            total_predictions INTEGER NOT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(household_id, model_type, entity_type, entity_id)
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            insert_query = """
            INSERT INTO model_performance (
                household_id, model_type, entity_type, entity_id,
                precision, recall, f1_score, true_positives, false_positives,
                true_negatives, false_negatives, total_predictions, last_updated
            ) VALUES (
                :household_id, :model_type, :entity_type, :entity_id,
                :precision, :recall, :f1_score, :true_positives, :false_positives,
                :true_negatives, :false_negatives, :total_predictions, :last_updated
            )
            ON CONFLICT (household_id, model_type, entity_type, entity_id)
            DO UPDATE SET
                precision = EXCLUDED.precision,
                recall = EXCLUDED.recall,
                f1_score = EXCLUDED.f1_score,
                true_positives = EXCLUDED.true_positives,
                false_positives = EXCLUDED.false_positives,
                true_negatives = EXCLUDED.true_negatives,
                false_negatives = EXCLUDED.false_negatives,
                total_predictions = EXCLUDED.total_predictions,
                last_updated = CURRENT_TIMESTAMP
            """
            
            session.execute(text(insert_query), {
                'household_id': household_id,
                'model_type': model_type,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'precision': precision,
                'recall': recall,
                'f1_score': f1_score,
                'true_positives': true_positives,
                'false_positives': false_positives,
                'true_negatives': true_negatives,
                'false_negatives': false_negatives,
                'total_predictions': total_predictions,
                'last_updated': datetime.now()
            })
            
            session.commit()
    
    async def _analyze_performance_for_thresholds(self, metric: ModelPerformance) -> Optional[ThresholdRecommendation]:
        """Analyze performance and recommend threshold adjustments"""
        try:
            # Get current threshold
            current_threshold = await self._get_current_threshold(
                metric.household_id, metric.entity_type, metric.entity_id
            )
            
            if current_threshold is None:
                return None
            
            # Analyze performance patterns
            if metric.precision < 0.7 and metric.recall > 0.8:
                # High recall, low precision -> too many false positives
                # Increase threshold to be more selective
                adjustment = ThresholdAdjustment.INCREASE
                recommended_threshold = current_threshold * (1 + self.threshold_adjustment_factor)
                reasoning = f"High recall ({metric.recall:.2f}) but low precision ({metric.precision:.2f}) - too many false positives"
                
            elif metric.precision > 0.8 and metric.recall < 0.6:
                # High precision, low recall -> too many false negatives
                # Decrease threshold to catch more anomalies
                adjustment = ThresholdAdjustment.DECREASE
                recommended_threshold = current_threshold * (1 - self.threshold_adjustment_factor)
                reasoning = f"High precision ({metric.precision:.2f}) but low recall ({metric.recall:.2f}) - missing too many anomalies"
                
            elif metric.f1_score < 0.6:
                # Poor overall performance
                if metric.precision < metric.recall:
                    adjustment = ThresholdAdjustment.INCREASE
                    recommended_threshold = current_threshold * (1 + self.threshold_adjustment_factor)
                    reasoning = f"Poor F1 score ({metric.f1_score:.2f}) - precision ({metric.precision:.2f}) lower than recall ({metric.recall:.2f})"
                else:
                    adjustment = ThresholdAdjustment.DECREASE
                    recommended_threshold = current_threshold * (1 - self.threshold_adjustment_factor)
                    reasoning = f"Poor F1 score ({metric.f1_score:.2f}) - recall ({metric.recall:.2f}) lower than precision ({metric.precision:.2f})"
                    
            else:
                # Good performance, maintain current threshold
                adjustment = ThresholdAdjustment.MAINTAIN
                recommended_threshold = current_threshold
                reasoning = f"Good performance - F1 score: {metric.f1_score:.2f}, Precision: {metric.precision:.2f}, Recall: {metric.recall:.2f}"
            
            # Calculate confidence in recommendation
            confidence = min(1.0, metric.total_predictions / 50)  # More data = higher confidence
            
            return ThresholdRecommendation(
                entity_type=metric.entity_type,
                entity_id=metric.entity_id,
                current_threshold=current_threshold,
                recommended_threshold=recommended_threshold,
                adjustment=adjustment,
                confidence=confidence,
                reasoning=reasoning
            )
            
        except Exception as e:
            logger.error(f"Error analyzing performance for thresholds: {str(e)}")
            return None
    
    async def _get_current_threshold(self, household_id: str, entity_type: str, entity_id: Optional[str]) -> Optional[float]:
        """Get current threshold for entity"""
        # This would typically query a configuration table
        # For now, return default thresholds
        default_thresholds = {
            'amount': 2.0,
            'frequency': 2.0,
            'pattern': 0.5
        }
        
        return default_thresholds.get(entity_type, 2.0)
    
    async def _check_threshold_adjustments(self, household_id: str):
        """Check if thresholds should be adjusted based on performance"""
        try:
            recommendations = await self.get_threshold_recommendations(household_id)
            
            for recommendation in recommendations:
                if recommendation.confidence > 0.7 and recommendation.adjustment != ThresholdAdjustment.MAINTAIN:
                    # Apply automatic threshold adjustment
                    await self.apply_threshold_adjustment(
                        household_id=household_id,
                        entity_type=recommendation.entity_type,
                        entity_id=recommendation.entity_id,
                        new_threshold=recommendation.recommended_threshold
                    )
                    
        except Exception as e:
            logger.error(f"Error checking threshold adjustments: {str(e)}")
    
    async def _update_threshold_config(self, household_id: str, entity_type: str, 
                                     entity_id: Optional[str], new_threshold: float):
        """Update threshold configuration"""
        # This would typically update a configuration table
        # For now, just log the change
        logger.info(f"Updated threshold for {household_id}/{entity_type}/{entity_id}: {new_threshold}")
    
    async def _schedule_retraining(self, household_id: str, entity_type: str, entity_id: Optional[str]):
        """Schedule model retraining"""
        # This would typically add to a retraining queue
        # For now, just log the retraining request
        logger.info(f"Scheduled retraining for {household_id}/{entity_type}/{entity_id}")

async def main():
    """Main function for testing"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/finance')
    worker = VerdictFeedbackWorker(db_url)
    
    # Example usage
    household_id = 'test-household'
    anomaly_id = 'test-anomaly'
    
    try:
        # Record a verdict
        feedback = await worker.record_verdict(
            anomaly_id=anomaly_id,
            household_id=household_id,
            verdict=VerdictType.LEGIT,
            confidence=0.9,
            feedback_notes="This is a legitimate transaction"
        )
        print(f"Recorded verdict: {feedback.verdict.value}")
        
        # Get performance metrics
        metrics = await worker.get_performance_metrics(household_id)
        print(f"Found {len(metrics)} performance metrics")
        
        # Get threshold recommendations
        recommendations = await worker.get_threshold_recommendations(household_id)
        print(f"Found {len(recommendations)} threshold recommendations")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
