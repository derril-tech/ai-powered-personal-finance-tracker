# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
from typing import Dict, List, Optional, Tuple, Set
import asyncpg
import redis.asyncio as redis
import numpy as np
import pandas as pd
from scipy import signal
from scipy.stats import variation
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import hashlib
from collections import defaultdict

logger = logging.getLogger(__name__)

@dataclass
class RecurringPattern:
    """Recurring pattern data structure"""
    id: Optional[int]
    household_id: int
    merchant_name: str
    amount: float
    cadence_days: float
    confidence: float
    next_due_date: datetime
    last_seen: datetime
    pattern_type: str  # 'monthly', 'weekly', 'biweekly', 'quarterly', 'yearly'
    is_active: bool
    created_at: Optional[str] = None

@dataclass
class RecurringDetection:
    """Recurring detection result"""
    transaction_id: int
    is_recurring: bool
    pattern_id: Optional[int]
    pattern_type: Optional[str]
    next_due_date: Optional[datetime]
    confidence: float
    explanation: str

class RecurringWorker:
    """Recurring transaction detector worker"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        
        # Configuration
        self.min_occurrences = 3  # Minimum occurrences to consider recurring
        self.amount_tolerance = 0.05  # 5% tolerance for amount matching
        self.time_window_days = 365  # Time window for pattern detection
        self.confidence_threshold = 0.7
        self.cache_ttl = 3600  # 1 hour
        self.recurring_cache_prefix = "recurring:"
        
        # Pattern detection settings
        self.cadence_patterns = {
            "weekly": (7, 2),  # (days, tolerance)
            "biweekly": (14, 3),
            "monthly": (30, 5),
            "quarterly": (90, 10),
            "yearly": (365, 30)
        }
    
    async def connect(self):
        """Connect to database and Redis"""
        # Database connection
        self.db_pool = await asyncpg.create_pool(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            user=os.getenv("DB_USER", "finance_tracker_app"),
            password=os.getenv("DB_PASSWORD", "password"),
            database=os.getenv("DB_NAME", "finance_tracker"),
            min_size=5,
            max_size=20
        )
        
        # Redis connection
        self.redis_client = redis.Redis(
            host=os.getenv("REDIS_HOST", "localhost"),
            port=int(os.getenv("REDIS_PORT", "6379")),
            password=os.getenv("REDIS_PASSWORD"),
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5
        )
        
        logger.info("Recurring Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Recurring Worker disconnected")
    
    def calculate_amount_similarity(self, amount1: float, amount2: float) -> float:
        """Calculate similarity between two amounts"""
        if amount1 == 0 and amount2 == 0:
            return 1.0
        
        if amount1 == 0 or amount2 == 0:
            return 0.0
        
        # Calculate percentage difference
        max_amount = max(abs(amount1), abs(amount2))
        difference = abs(abs(amount1) - abs(amount2))
        
        if max_amount == 0:
            return 0.0
        
        percentage_diff = difference / max_amount
        similarity = 1.0 - percentage_diff
        
        return max(0.0, similarity)
    
    def detect_cadence(self, dates: List[datetime]) -> Tuple[float, str, float]:
        """Detect cadence pattern from a list of dates"""
        if len(dates) < 2:
            return 0.0, "unknown", 0.0
        
        # Sort dates
        sorted_dates = sorted(dates)
        
        # Calculate intervals between consecutive dates
        intervals = []
        for i in range(1, len(sorted_dates)):
            interval = (sorted_dates[i] - sorted_dates[i-1]).days
            intervals.append(interval)
        
        if not intervals:
            return 0.0, "unknown", 0.0
        
        # Calculate mean interval
        mean_interval = np.mean(intervals)
        
        # Calculate coefficient of variation (lower = more regular)
        cv = variation(intervals) if len(intervals) > 1 else 0
        
        # Determine pattern type
        pattern_type = "unknown"
        for pattern, (expected_days, tolerance) in self.cadence_patterns.items():
            if abs(mean_interval - expected_days) <= tolerance:
                pattern_type = pattern
                break
        
        # Calculate confidence based on regularity
        confidence = max(0.0, 1.0 - cv)
        
        return mean_interval, pattern_type, confidence
    
    def calculate_next_due_date(self, last_date: datetime, cadence_days: float, pattern_type: str) -> datetime:
        """Calculate next due date based on pattern"""
        if pattern_type == "monthly":
            # Add months, handling month boundaries
            year = last_date.year
            month = last_date.month + 1
            if month > 12:
                year += 1
                month = 1
            
            # Try to keep same day of month, adjust if invalid
            try:
                next_date = last_date.replace(year=year, month=month)
            except ValueError:
                # Handle cases like Jan 31 -> Feb 28/29
                next_date = last_date.replace(year=year, month=month, day=28)
        
        elif pattern_type == "yearly":
            next_date = last_date.replace(year=last_date.year + 1)
        
        else:
            # For weekly, biweekly, quarterly
            next_date = last_date + timedelta(days=cadence_days)
        
        return next_date
    
    async def find_similar_transactions(self, transaction: Dict, household_id: int) -> List[Dict]:
        """Find similar transactions for pattern detection"""
        if not self.db_pool:
            return []
        
        try:
            merchant_name = transaction.get("merchant_name", "")
            amount = float(transaction.get("amount", 0))
            
            # Search for similar transactions
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id
                FROM transactions
                WHERE household_id = $1 
                AND merchant_name = $2
                AND amount BETWEEN $3 AND $4
                AND is_transfer = false
                ORDER BY date DESC
                LIMIT 100
            """, household_id, merchant_name, 
                 amount * (1 - self.amount_tolerance), 
                 amount * (1 + self.amount_tolerance))
            
            return [dict(row) for row in rows]
        
        except Exception as e:
            logger.error(f"Error finding similar transactions: {e}")
            return []
    
    async def detect_recurring_pattern(self, transaction: Dict, household_id: int) -> Optional[RecurringPattern]:
        """Detect recurring pattern for a transaction"""
        if not self.db_pool:
            return None
        
        try:
            merchant_name = transaction.get("merchant_name", "")
            amount = float(transaction.get("amount", 0))
            date = transaction["date"]
            
            # Find similar transactions
            similar_transactions = await self.find_similar_transactions(transaction, household_id)
            
            if len(similar_transactions) < self.min_occurrences:
                return None
            
            # Extract dates and amounts
            dates = [t["date"] for t in similar_transactions]
            amounts = [float(t["amount"]) for t in similar_transactions]
            
            # Detect cadence
            cadence_days, pattern_type, cadence_confidence = self.detect_cadence(dates)
            
            if cadence_confidence < self.confidence_threshold:
                return None
            
            # Calculate amount consistency
            amount_consistency = 1.0 - variation(amounts) if len(amounts) > 1 else 1.0
            
            # Overall confidence
            confidence = (cadence_confidence * 0.7) + (amount_consistency * 0.3)
            
            if confidence < self.confidence_threshold:
                return None
            
            # Calculate next due date
            last_date = max(dates)
            next_due_date = self.calculate_next_due_date(last_date, cadence_days, pattern_type)
            
            return RecurringPattern(
                id=None,
                household_id=household_id,
                merchant_name=merchant_name,
                amount=amount,
                cadence_days=cadence_days,
                confidence=confidence,
                next_due_date=next_due_date,
                last_seen=last_date,
                pattern_type=pattern_type,
                is_active=True
            )
        
        except Exception as e:
            logger.error(f"Error detecting recurring pattern: {e}")
            return None
    
    async def find_existing_pattern(self, transaction: Dict, household_id: int) -> Optional[RecurringPattern]:
        """Find existing recurring pattern for a transaction"""
        if not self.db_pool:
            return None
        
        try:
            merchant_name = transaction.get("merchant_name", "")
            amount = float(transaction.get("amount", 0))
            
            # Look for existing patterns
            row = await self.db_pool.fetchrow("""
                SELECT id, household_id, merchant_name, amount, cadence_days, confidence,
                       next_due_date, last_seen, pattern_type, is_active, created_at
                FROM recurring_patterns
                WHERE household_id = $1 
                AND merchant_name = $2
                AND amount BETWEEN $3 AND $4
                AND is_active = true
                ORDER BY confidence DESC, last_seen DESC
                LIMIT 1
            """, household_id, merchant_name,
                 amount * (1 - self.amount_tolerance),
                 amount * (1 + self.amount_tolerance))
            
            if row:
                return RecurringPattern(
                    id=row["id"],
                    household_id=row["household_id"],
                    merchant_name=row["merchant_name"],
                    amount=row["amount"],
                    cadence_days=row["cadence_days"],
                    confidence=row["confidence"],
                    next_due_date=row["next_due_date"],
                    last_seen=row["last_seen"],
                    pattern_type=row["pattern_type"],
                    is_active=row["is_active"],
                    created_at=row["created_at"].isoformat() if row["created_at"] else None
                )
        
        except Exception as e:
            logger.error(f"Error finding existing pattern: {e}")
        
        return None
    
    async def create_or_update_pattern(self, pattern: RecurringPattern) -> int:
        """Create or update a recurring pattern"""
        if not self.db_pool:
            return 0
        
        try:
            if pattern.id:
                # Update existing pattern
                await self.db_pool.execute("""
                    UPDATE recurring_patterns
                    SET last_seen = $1, next_due_date = $2, confidence = $3, updated_at = NOW()
                    WHERE id = $4
                """, pattern.last_seen, pattern.next_due_date, pattern.confidence, pattern.id)
                
                return pattern.id
            else:
                # Create new pattern
                row = await self.db_pool.fetchrow("""
                    INSERT INTO recurring_patterns 
                    (household_id, merchant_name, amount, cadence_days, confidence, 
                     next_due_date, last_seen, pattern_type, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
                    RETURNING id
                """, pattern.household_id, pattern.merchant_name, pattern.amount,
                     pattern.cadence_days, pattern.confidence, pattern.next_due_date,
                     pattern.last_seen, pattern.pattern_type)
                
                logger.info(f"Created recurring pattern: {pattern.merchant_name} ({pattern.pattern_type})")
                return row["id"]
        
        except Exception as e:
            logger.error(f"Error creating/updating pattern: {e}")
            return 0
    
    async def detect_recurring_transaction(self, transaction: Dict, household_id: int) -> RecurringDetection:
        """Detect if a transaction is recurring"""
        # Check cache first
        cache_key = f"{self.recurring_cache_prefix}{transaction['id']}"
        if self.redis_client:
            cached = await self.redis_client.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return RecurringDetection(**cached_data)
        
        # Try to find existing pattern first
        existing_pattern = await self.find_existing_pattern(transaction, household_id)
        
        if existing_pattern:
            # Check if this transaction matches the expected pattern
            amount = float(transaction.get("amount", 0))
            date = transaction["date"]
            
            amount_similarity = self.calculate_amount_similarity(amount, existing_pattern.amount)
            time_diff = abs((date - existing_pattern.next_due_date).days)
            
            # Consider it recurring if amount is similar and date is close to expected
            if amount_similarity >= 0.9 and time_diff <= 7:
                # Update pattern with new transaction
                existing_pattern.last_seen = date
                existing_pattern.next_due_date = self.calculate_next_due_date(
                    date, existing_pattern.cadence_days, existing_pattern.pattern_type
                )
                
                pattern_id = await self.create_or_update_pattern(existing_pattern)
                
                result = RecurringDetection(
                    transaction_id=transaction["id"],
                    is_recurring=True,
                    pattern_id=pattern_id,
                    pattern_type=existing_pattern.pattern_type,
                    next_due_date=existing_pattern.next_due_date,
                    confidence=existing_pattern.confidence,
                    explanation=f"Matches existing {existing_pattern.pattern_type} pattern"
                )
                
                # Cache the result
                if self.redis_client:
                    await self.redis_client.setex(
                        cache_key,
                        self.cache_ttl,
                        json.dumps({
                            "transaction_id": result.transaction_id,
                            "is_recurring": result.is_recurring,
                            "pattern_id": result.pattern_id,
                            "pattern_type": result.pattern_type,
                            "next_due_date": result.next_due_date.isoformat() if result.next_due_date else None,
                            "confidence": result.confidence,
                            "explanation": result.explanation
                        })
                    )
                
                return result
        
        # Try to detect new pattern
        new_pattern = await self.detect_recurring_pattern(transaction, household_id)
        
        if new_pattern:
            pattern_id = await self.create_or_update_pattern(new_pattern)
            
            result = RecurringDetection(
                transaction_id=transaction["id"],
                is_recurring=True,
                pattern_id=pattern_id,
                pattern_type=new_pattern.pattern_type,
                next_due_date=new_pattern.next_due_date,
                confidence=new_pattern.confidence,
                explanation=f"New {new_pattern.pattern_type} pattern detected"
            )
            
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "transaction_id": result.transaction_id,
                        "is_recurring": result.is_recurring,
                        "pattern_id": result.pattern_id,
                        "pattern_type": result.pattern_type,
                        "next_due_date": result.next_due_date.isoformat() if result.next_due_date else None,
                        "confidence": result.confidence,
                        "explanation": result.explanation
                    })
                )
            
            return result
        
        # Not recurring
        result = RecurringDetection(
            transaction_id=transaction["id"],
            is_recurring=False,
            pattern_id=None,
            pattern_type=None,
            next_due_date=None,
            confidence=0.0,
            explanation="No recurring pattern detected"
        )
        
        # Cache the result
        if self.redis_client:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps({
                    "transaction_id": result.transaction_id,
                    "is_recurring": result.is_recurring,
                    "pattern_id": result.pattern_id,
                    "pattern_type": result.pattern_type,
                    "next_due_date": result.next_due_date.isoformat() if result.next_due_date else None,
                    "confidence": result.confidence,
                    "explanation": result.explanation
                })
            )
        
        return result
    
    async def process_transaction_recurring(self, transactions: List[Dict], household_id: int) -> List[Dict]:
        """Process recurring detection for a batch of transactions"""
        if not transactions:
            return transactions
        
        processed_transactions = []
        
        for transaction in transactions:
            try:
                # Detect recurring patterns
                recurring_detection = await self.detect_recurring_transaction(transaction, household_id)
                
                # Update transaction with recurring information
                transaction["is_recurring"] = recurring_detection.is_recurring
                transaction["pattern_id"] = recurring_detection.pattern_id
                transaction["pattern_type"] = recurring_detection.pattern_type
                transaction["next_due_date"] = recurring_detection.next_due_date
                transaction["recurring_confidence"] = recurring_detection.confidence
                transaction["recurring_explanation"] = recurring_detection.explanation
                
            except Exception as e:
                logger.error(f"Error detecting recurring for transaction {transaction.get('id')}: {e}")
                # Keep original recurring status if detection fails
                transaction["is_recurring"] = False
                transaction["pattern_id"] = None
                transaction["pattern_type"] = None
                transaction["next_due_date"] = None
                transaction["recurring_confidence"] = 0.0
                transaction["recurring_explanation"] = f"Recurring detection error: {str(e)}"
            
            processed_transactions.append(transaction)
        
        return processed_transactions
    
    async def get_upcoming_recurring(self, household_id: int, days: int = 30) -> List[Dict]:
        """Get upcoming recurring transactions"""
        if not self.db_pool:
            return []
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT id, merchant_name, amount, pattern_type, next_due_date, confidence
                FROM recurring_patterns
                WHERE household_id = $1 
                AND is_active = true
                AND next_due_date BETWEEN NOW() AND NOW() + INTERVAL '$2 days'
                ORDER BY next_due_date ASC
            """, household_id, days)
            
            return [
                {
                    "pattern_id": row["id"],
                    "merchant_name": row["merchant_name"],
                    "amount": row["amount"],
                    "pattern_type": row["pattern_type"],
                    "next_due_date": row["next_due_date"],
                    "confidence": row["confidence"]
                }
                for row in rows
            ]
        
        except Exception as e:
            logger.error(f"Error getting upcoming recurring: {e}")
            return []
    
    async def detect_price_changes(self, household_id: int) -> List[Dict]:
        """Detect price changes in recurring transactions"""
        if not self.db_pool:
            return []
        
        try:
            # Find patterns with recent transactions that differ significantly in amount
            rows = await self.db_pool.fetch("""
                WITH recent_transactions AS (
                    SELECT 
                        rp.id as pattern_id,
                        rp.merchant_name,
                        rp.amount as expected_amount,
                        t.amount as actual_amount,
                        t.date,
                        ABS(t.amount - rp.amount) / rp.amount as price_change_ratio
                    FROM recurring_patterns rp
                    JOIN transactions t ON 
                        t.household_id = rp.household_id
                        AND t.merchant_name = rp.merchant_name
                        AND t.date >= rp.last_seen - INTERVAL '30 days'
                    WHERE rp.household_id = $1 
                    AND rp.is_active = true
                    AND ABS(t.amount - rp.amount) / rp.amount > 0.1  -- 10% change threshold
                )
                SELECT 
                    pattern_id,
                    merchant_name,
                    expected_amount,
                    actual_amount,
                    date,
                    price_change_ratio,
                    CASE 
                        WHEN actual_amount > expected_amount THEN 'increase'
                        ELSE 'decrease'
                    END as change_type
                FROM recent_transactions
                ORDER BY date DESC
            """, household_id)
            
            return [
                {
                    "pattern_id": row["pattern_id"],
                    "merchant_name": row["merchant_name"],
                    "expected_amount": row["expected_amount"],
                    "actual_amount": row["actual_amount"],
                    "date": row["date"],
                    "price_change_ratio": row["price_change_ratio"],
                    "change_type": row["change_type"]
                }
                for row in rows
            ]
        
        except Exception as e:
            logger.error(f"Error detecting price changes: {e}")
            return []
    
    async def detect_missed_payments(self, household_id: int) -> List[Dict]:
        """Detect missed recurring payments"""
        if not self.db_pool:
            return []
        
        try:
            # Find patterns where next due date has passed
            rows = await self.db_pool.fetch("""
                SELECT 
                    id as pattern_id,
                    merchant_name,
                    amount,
                    pattern_type,
                    next_due_date,
                    last_seen,
                    EXTRACT(DAYS FROM NOW() - next_due_date) as days_overdue
                FROM recurring_patterns
                WHERE household_id = $1 
                AND is_active = true
                AND next_due_date < NOW()
                AND next_due_date > last_seen
                ORDER BY next_due_date ASC
            """, household_id)
            
            return [
                {
                    "pattern_id": row["pattern_id"],
                    "merchant_name": row["merchant_name"],
                    "amount": row["amount"],
                    "pattern_type": row["pattern_type"],
                    "next_due_date": row["next_due_date"],
                    "last_seen": row["last_seen"],
                    "days_overdue": int(row["days_overdue"])
                }
                for row in rows
            ]
        
        except Exception as e:
            logger.error(f"Error detecting missed payments: {e}")
            return []
    
    async def run_batch_processing(self, household_id: int):
        """Run batch processing for recurring detection"""
        if not self.db_pool:
            return
        
        try:
            # Get unprocessed transactions
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id, household_id
                FROM transactions
                WHERE household_id = $1 
                AND is_recurring IS NULL
                ORDER BY date DESC
                LIMIT 1000
            """, household_id)
            
            if not rows:
                return
            
            # Process recurring detection
            transactions = [dict(row) for row in rows]
            processed_transactions = await self.process_transaction_recurring(transactions, household_id)
            
            # Update database
            for transaction in processed_transactions:
                await self.db_pool.execute("""
                    UPDATE transactions 
                    SET is_recurring = $1,
                        pattern_id = $2,
                        recurring_confidence = $3,
                        updated_at = NOW()
                    WHERE id = $4
                """, transaction["is_recurring"], transaction["pattern_id"], 
                     transaction["recurring_confidence"], transaction["id"])
            
            logger.info(f"Processed {len(processed_transactions)} transactions for recurring detection")
        
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            logger.info("Recurring Worker started")
            
            # Keep the worker running
            while True:
                # Get all households
                if self.db_pool:
                    households = await self.db_pool.fetch("SELECT id FROM households")
                    
                    for household in households:
                        await self.run_batch_processing(household["id"])
                
                await asyncio.sleep(600)  # Run every 10 minutes
                
        except KeyboardInterrupt:
            logger.info("Recurring Worker stopped by user")
        except Exception as e:
            logger.error(f"Recurring Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = RecurringWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
