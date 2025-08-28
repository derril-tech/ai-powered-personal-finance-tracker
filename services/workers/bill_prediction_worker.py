# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json
import os
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)

class BillStatus(Enum):
    UPCOMING = "upcoming"
    DUE_SOON = "due_soon"
    OVERDUE = "overdue"
    PAID = "paid"

@dataclass
class BillPrediction:
    id: str
    household_id: str
    recurring_pattern_id: str
    merchant_name: str
    expected_amount: float
    expected_date: datetime
    confidence: float
    status: BillStatus
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    last_paid_amount: Optional[float] = None
    last_paid_date: Optional[datetime] = None
    price_change_detected: bool = False
    price_change_amount: Optional[float] = None
    missed_payment: bool = False
    days_until_due: Optional[int] = None
    risk_score: float = 0.0

class BillPredictionWorker:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # Configuration
        self.due_soon_threshold_days = 7
        self.overdue_threshold_days = 3
        self.confidence_threshold = 0.7
        self.price_change_threshold = 0.1  # 10% change
        
    async def get_recurring_patterns(self, household_id: str) -> List[Dict]:
        """Get recurring patterns for bill prediction"""
        query = """
        SELECT 
            rp.id,
            rp.merchant_name,
            rp.expected_amount,
            rp.cadence_days,
            rp.last_transaction_date,
            rp.next_due_date,
            rp.confidence_score,
            rp.category_id,
            c.name as category_name,
            rp.account_id,
            a.name as account_name,
            rp.price_change_detected,
            rp.price_change_amount,
            rp.missed_payment,
            rp.transaction_count,
            rp.avg_amount,
            rp.std_amount
        FROM recurring_patterns rp
        LEFT JOIN categories c ON rp.category_id = c.id
        LEFT JOIN accounts a ON rp.account_id = a.id
        WHERE rp.household_id = :household_id
        AND rp.is_active = true
        AND rp.confidence_score >= :confidence_threshold
        ORDER BY rp.next_due_date
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'confidence_threshold': self.confidence_threshold
            })
            
            patterns = []
            for row in result.fetchall():
                patterns.append({
                    'id': row.id,
                    'merchant_name': row.merchant_name,
                    'expected_amount': row.expected_amount,
                    'cadence_days': row.cadence_days,
                    'last_transaction_date': row.last_transaction_date,
                    'next_due_date': row.next_due_date,
                    'confidence_score': row.confidence_score,
                    'category_id': row.category_id,
                    'category_name': row.category_name,
                    'account_id': row.account_id,
                    'account_name': row.account_name,
                    'price_change_detected': row.price_change_detected,
                    'price_change_amount': row.price_change_amount,
                    'missed_payment': row.missed_payment,
                    'transaction_count': row.transaction_count,
                    'avg_amount': row.avg_amount,
                    'std_amount': row.std_amount
                })
            
            return patterns
    
    async def predict_upcoming_bills(self, household_id: str, days_ahead: int = 90) -> List[BillPrediction]:
        """Predict upcoming bills based on recurring patterns"""
        try:
            patterns = await self.get_recurring_patterns(household_id)
            predictions = []
            
            for pattern in patterns:
                # Generate predictions for the next N days
                current_date = datetime.now()
                end_date = current_date + timedelta(days=days_ahead)
                
                # Start from the next due date or current date
                start_date = pattern['next_due_date'] or current_date
                if start_date < current_date:
                    start_date = current_date
                
                # Generate bill predictions
                bill_dates = self._generate_bill_dates(
                    start_date, end_date, pattern['cadence_days']
                )
                
                for bill_date in bill_dates:
                    prediction = await self._create_bill_prediction(
                        pattern, bill_date, household_id
                    )
                    if prediction:
                        predictions.append(prediction)
            
            # Sort by expected date
            predictions.sort(key=lambda x: x.expected_date)
            
            # Store predictions
            await self._store_bill_predictions(predictions)
            
            return predictions
            
        except Exception as e:
            logger.error(f"Error predicting bills for household {household_id}: {str(e)}")
            raise
    
    def _generate_bill_dates(self, start_date: datetime, end_date: datetime, cadence_days: int) -> List[datetime]:
        """Generate bill dates based on cadence"""
        dates = []
        current_date = start_date
        
        while current_date <= end_date:
            dates.append(current_date)
            current_date += timedelta(days=cadence_days)
        
        return dates
    
    async def _create_bill_prediction(self, pattern: Dict, bill_date: datetime, household_id: str) -> Optional[BillPrediction]:
        """Create a bill prediction from a pattern"""
        try:
            # Calculate confidence based on pattern strength
            confidence = min(1.0, pattern['confidence_score'] * (pattern['transaction_count'] / 10))
            
            # Calculate expected amount with some variation
            expected_amount = pattern['expected_amount']
            if pattern['std_amount'] and pattern['std_amount'] > 0:
                # Add some realistic variation (±1 standard deviation)
                variation = np.random.normal(0, pattern['std_amount'] * 0.5)
                expected_amount = max(0, expected_amount + variation)
            
            # Determine status
            days_until_due = (bill_date - datetime.now()).days
            status = self._determine_bill_status(days_until_due)
            
            # Calculate risk score
            risk_score = self._calculate_risk_score(pattern, days_until_due, confidence)
            
            # Check if this bill has already been paid
            if await self._is_bill_paid(pattern['merchant_name'], bill_date, household_id):
                status = BillStatus.PAID
            
            return BillPrediction(
                id=f"{pattern['id']}_{bill_date.strftime('%Y%m%d')}",
                household_id=household_id,
                recurring_pattern_id=pattern['id'],
                merchant_name=pattern['merchant_name'],
                expected_amount=expected_amount,
                expected_date=bill_date,
                confidence=confidence,
                status=status,
                category_id=pattern['category_id'],
                category_name=pattern['category_name'],
                account_id=pattern['account_id'],
                account_name=pattern['account_name'],
                last_paid_amount=pattern['avg_amount'],
                last_paid_date=pattern['last_transaction_date'],
                price_change_detected=pattern['price_change_detected'],
                price_change_amount=pattern['price_change_amount'],
                missed_payment=pattern['missed_payment'],
                days_until_due=days_until_due,
                risk_score=risk_score
            )
            
        except Exception as e:
            logger.error(f"Error creating bill prediction: {str(e)}")
            return None
    
    def _determine_bill_status(self, days_until_due: int) -> BillStatus:
        """Determine bill status based on days until due"""
        if days_until_due < -self.overdue_threshold_days:
            return BillStatus.OVERDUE
        elif days_until_due <= self.due_soon_threshold_days:
            return BillStatus.DUE_SOON
        else:
            return BillStatus.UPCOMING
    
    def _calculate_risk_score(self, pattern: Dict, days_until_due: int, confidence: float) -> float:
        """Calculate risk score for bill prediction"""
        risk_score = 0.0
        
        # Base risk on confidence (lower confidence = higher risk)
        risk_score += (1.0 - confidence) * 0.3
        
        # Risk based on price changes
        if pattern['price_change_detected']:
            risk_score += 0.2
        
        # Risk based on missed payments
        if pattern['missed_payment']:
            risk_score += 0.3
        
        # Risk based on due date proximity
        if days_until_due <= 0:
            risk_score += 0.4
        elif days_until_due <= 7:
            risk_score += 0.2
        elif days_until_due <= 30:
            risk_score += 0.1
        
        # Risk based on amount variability
        if pattern['std_amount'] and pattern['avg_amount']:
            coefficient_of_variation = pattern['std_amount'] / pattern['avg_amount']
            risk_score += min(0.2, coefficient_of_variation * 0.1)
        
        return min(1.0, risk_score)
    
    async def _is_bill_paid(self, merchant_name: str, bill_date: datetime, household_id: str) -> bool:
        """Check if a bill has already been paid"""
        query = """
        SELECT COUNT(*) as count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE a.household_id = :household_id
        AND t.merchant_name ILIKE :merchant_name
        AND DATE(t.date) = DATE(:bill_date)
        AND t.amount < 0
        AND t.is_transfer = false
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'merchant_name': f"%{merchant_name}%",
                'bill_date': bill_date
            })
            
            count = result.fetchone().count
            return count > 0
    
    async def _store_bill_predictions(self, predictions: List[BillPrediction]):
        """Store bill predictions in database"""
        if not predictions:
            return
        
        # Create bill_predictions table if it doesn't exist
        create_table_query = """
        CREATE TABLE IF NOT EXISTS bill_predictions (
            id VARCHAR(255) PRIMARY KEY,
            household_id VARCHAR(255) NOT NULL,
            recurring_pattern_id VARCHAR(255) NOT NULL,
            merchant_name VARCHAR(255) NOT NULL,
            expected_amount DECIMAL(15,2) NOT NULL,
            expected_date DATE NOT NULL,
            confidence DECIMAL(5,2) NOT NULL,
            status VARCHAR(50) NOT NULL,
            category_id VARCHAR(255),
            category_name VARCHAR(255),
            account_id VARCHAR(255),
            account_name VARCHAR(255),
            last_paid_amount DECIMAL(15,2),
            last_paid_date TIMESTAMP,
            price_change_detected BOOLEAN DEFAULT false,
            price_change_amount DECIMAL(15,2),
            missed_payment BOOLEAN DEFAULT false,
            days_until_due INTEGER,
            risk_score DECIMAL(5,2) DEFAULT 0.0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            for prediction in predictions:
                insert_query = """
                INSERT INTO bill_predictions (
                    id, household_id, recurring_pattern_id, merchant_name,
                    expected_amount, expected_date, confidence, status,
                    category_id, category_name, account_id, account_name,
                    last_paid_amount, last_paid_date, price_change_detected,
                    price_change_amount, missed_payment, days_until_due, risk_score
                ) VALUES (
                    :id, :household_id, :recurring_pattern_id, :merchant_name,
                    :expected_amount, :expected_date, :confidence, :status,
                    :category_id, :category_name, :account_id, :account_name,
                    :last_paid_amount, :last_paid_date, :price_change_detected,
                    :price_change_amount, :missed_payment, :days_until_due, :risk_score
                )
                ON CONFLICT (id)
                DO UPDATE SET
                    expected_amount = EXCLUDED.expected_amount,
                    confidence = EXCLUDED.confidence,
                    status = EXCLUDED.status,
                    days_until_due = EXCLUDED.days_until_due,
                    risk_score = EXCLUDED.risk_score,
                    updated_at = CURRENT_TIMESTAMP
                """
                
                session.execute(text(insert_query), {
                    'id': prediction.id,
                    'household_id': prediction.household_id,
                    'recurring_pattern_id': prediction.recurring_pattern_id,
                    'merchant_name': prediction.merchant_name,
                    'expected_amount': prediction.expected_amount,
                    'expected_date': prediction.expected_date.date(),
                    'confidence': prediction.confidence,
                    'status': prediction.status.value,
                    'category_id': prediction.category_id,
                    'category_name': prediction.category_name,
                    'account_id': prediction.account_id,
                    'account_name': prediction.account_name,
                    'last_paid_amount': prediction.last_paid_amount,
                    'last_paid_date': prediction.last_paid_date,
                    'price_change_detected': prediction.price_change_detected,
                    'price_change_amount': prediction.price_change_amount,
                    'missed_payment': prediction.missed_payment,
                    'days_until_due': prediction.days_until_due,
                    'risk_score': prediction.risk_score
                })
            
            session.commit()
    
    async def get_bill_predictions(self, household_id: str, days_ahead: int = 30, 
                                 status_filter: Optional[BillStatus] = None) -> List[BillPrediction]:
        """Retrieve stored bill predictions"""
        query = """
        SELECT 
            id, household_id, recurring_pattern_id, merchant_name,
            expected_amount, expected_date, confidence, status,
            category_id, category_name, account_id, account_name,
            last_paid_amount, last_paid_date, price_change_detected,
            price_change_amount, missed_payment, days_until_due, risk_score
        FROM bill_predictions
        WHERE household_id = :household_id
        AND expected_date >= CURRENT_DATE
        AND expected_date <= CURRENT_DATE + INTERVAL ':days_ahead days'
        """
        
        if status_filter:
            query += " AND status = :status"
        
        query += " ORDER BY expected_date"
        
        params = {
            'household_id': household_id,
            'days_ahead': days_ahead
        }
        
        if status_filter:
            params['status'] = status_filter.value
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            
            predictions = []
            for row in result.fetchall():
                predictions.append(BillPrediction(
                    id=row.id,
                    household_id=row.household_id,
                    recurring_pattern_id=row.recurring_pattern_id,
                    merchant_name=row.merchant_name,
                    expected_amount=row.expected_amount,
                    expected_date=row.expected_date,
                    confidence=row.confidence,
                    status=BillStatus(row.status),
                    category_id=row.category_id,
                    category_name=row.category_name,
                    account_id=row.account_id,
                    account_name=row.account_name,
                    last_paid_amount=row.last_paid_amount,
                    last_paid_date=row.last_paid_date,
                    price_change_detected=row.price_change_detected,
                    price_change_amount=row.price_change_amount,
                    missed_payment=row.missed_payment,
                    days_until_due=row.days_until_due,
                    risk_score=row.risk_score
                ))
            
            return predictions
    
    async def get_high_risk_bills(self, household_id: str, risk_threshold: float = 0.7) -> List[BillPrediction]:
        """Get high-risk bills for alerts"""
        query = """
        SELECT 
            id, household_id, recurring_pattern_id, merchant_name,
            expected_amount, expected_date, confidence, status,
            category_id, category_name, account_id, account_name,
            last_paid_amount, last_paid_date, price_change_detected,
            price_change_amount, missed_payment, days_until_due, risk_score
        FROM bill_predictions
        WHERE household_id = :household_id
        AND risk_score >= :risk_threshold
        AND expected_date >= CURRENT_DATE
        ORDER BY risk_score DESC, expected_date
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'risk_threshold': risk_threshold
            })
            
            predictions = []
            for row in result.fetchall():
                predictions.append(BillPrediction(
                    id=row.id,
                    household_id=row.household_id,
                    recurring_pattern_id=row.recurring_pattern_id,
                    merchant_name=row.merchant_name,
                    expected_amount=row.expected_amount,
                    expected_date=row.expected_date,
                    confidence=row.confidence,
                    status=BillStatus(row.status),
                    category_id=row.category_id,
                    category_name=row.category_name,
                    account_id=row.account_id,
                    account_name=row.account_name,
                    last_paid_amount=row.last_paid_amount,
                    last_paid_date=row.last_paid_date,
                    price_change_detected=row.price_change_detected,
                    price_change_amount=row.price_change_amount,
                    missed_payment=row.missed_payment,
                    days_until_due=row.days_until_due,
                    risk_score=row.risk_score
                ))
            
            return predictions
    
    async def update_bill_status(self, bill_id: str, new_status: BillStatus):
        """Update bill status (e.g., when marked as paid)"""
        query = """
        UPDATE bill_predictions
        SET status = :status, updated_at = CURRENT_TIMESTAMP
        WHERE id = :bill_id
        """
        
        with self.Session() as session:
            session.execute(text(query), {
                'bill_id': bill_id,
                'status': new_status.value
            })
            session.commit()

async def main():
    """Main function for testing"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/finance')
    worker = BillPredictionWorker(db_url)
    
    # Example usage
    household_id = 'test-household'
    
    try:
        # Generate bill predictions
        predictions = await worker.predict_upcoming_bills(household_id, days_ahead=90)
        print(f"Generated {len(predictions)} bill predictions")
        
        # Get upcoming bills
        upcoming_bills = await worker.get_bill_predictions(
            household_id=household_id,
            days_ahead=30,
            status_filter=BillStatus.DUE_SOON
        )
        print(f"Found {len(upcoming_bills)} bills due soon")
        
        # Get high-risk bills
        high_risk_bills = await worker.get_high_risk_bills(household_id, risk_threshold=0.7)
        print(f"Found {len(high_risk_bills)} high-risk bills")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
