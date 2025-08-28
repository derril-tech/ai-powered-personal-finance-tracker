# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
from typing import Dict, List, Optional, Tuple, Set
import asyncpg
import redis.asyncio as redis
import numpy as np
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import hashlib

logger = logging.getLogger(__name__)

@dataclass
class TransferPair:
    """Transfer pair data structure"""
    from_transaction_id: int
    to_transaction_id: int
    amount: float
    confidence: float
    transfer_type: str  # 'intra_household', 'duplicate', 'external'
    created_at: datetime

@dataclass
class TransferDetection:
    """Transfer detection result"""
    transaction_id: int
    is_transfer: bool
    transfer_type: Optional[str]
    paired_transaction_id: Optional[int]
    confidence: float
    explanation: str

class TransferWorker:
    """Transfer detection worker for identifying intra-household transfers and duplicates"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        
        # Configuration
        self.amount_tolerance = 0.01  # 1 cent tolerance for amount matching
        self.time_window_hours = 24  # Time window for transfer detection
        self.confidence_threshold = 0.8
        self.cache_ttl = 3600  # 1 hour
        self.transfer_cache_prefix = "transfer:"
        
        # Transfer detection settings
        self.duplicate_threshold = 0.95  # Similarity threshold for duplicates
        self.intra_household_threshold = 0.9  # Confidence threshold for intra-household transfers
    
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
        
        logger.info("Transfer Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Transfer Worker disconnected")
    
    def calculate_amount_similarity(self, amount1: float, amount2: float) -> float:
        """Calculate similarity between two amounts"""
        if amount1 == 0 and amount2 == 0:
            return 1.0
        
        if amount1 == 0 or amount2 == 0:
            return 0.0
        
        # Check if amounts are opposite (transfer pair)
        if abs(amount1 + amount2) <= self.amount_tolerance:
            return 1.0
        
        # Check if amounts are similar (duplicate)
        if abs(amount1 - amount2) <= self.amount_tolerance:
            return 1.0
        
        # Calculate similarity based on difference
        max_amount = max(abs(amount1), abs(amount2))
        difference = abs(abs(amount1) - abs(amount2))
        
        if max_amount == 0:
            return 0.0
        
        similarity = 1.0 - (difference / max_amount)
        return max(0.0, similarity)
    
    def calculate_text_similarity(self, text1: str, text2: str) -> float:
        """Calculate similarity between two text strings"""
        if not text1 or not text2:
            return 0.0
        
        # Simple Jaccard similarity
        words1 = set(text1.lower().split())
        words2 = set(text2.lower().split())
        
        if not words1 and not words2:
            return 1.0
        
        intersection = len(words1.intersection(words2))
        union = len(words1.union(words2))
        
        if union == 0:
            return 0.0
        
        return intersection / union
    
    def calculate_time_similarity(self, time1: datetime, time2: datetime) -> float:
        """Calculate similarity between two timestamps"""
        time_diff = abs((time1 - time2).total_seconds())
        
        # Perfect match within 1 minute
        if time_diff <= 60:
            return 1.0
        
        # Good match within 1 hour
        if time_diff <= 3600:
            return 0.9
        
        # Acceptable match within 24 hours
        if time_diff <= 86400:
            return 0.7
        
        # Poor match within 7 days
        if time_diff <= 604800:
            return 0.3
        
        return 0.0
    
    async def get_household_accounts(self, household_id: int) -> List[int]:
        """Get all account IDs for a household"""
        if not self.db_pool:
            return []
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT id FROM accounts WHERE household_id = $1
            """, household_id)
            
            return [row["id"] for row in rows]
        except Exception as e:
            logger.error(f"Error getting household accounts: {e}")
            return []
    
    async def find_intra_household_transfers(self, transaction: Dict, household_id: int) -> Optional[TransferDetection]:
        """Find intra-household transfers"""
        if not self.db_pool:
            return None
        
        try:
            transaction_id = transaction["id"]
            amount = float(transaction["amount"])
            date = transaction["date"]
            
            # Get all accounts in the household
            household_accounts = await self.get_household_accounts(household_id)
            if len(household_accounts) < 2:
                return None
            
            # Look for opposite transaction in other accounts
            opposite_amount = -amount
            
            # Search for matching transactions within time window
            time_start = date - timedelta(hours=self.time_window_hours)
            time_end = date + timedelta(hours=self.time_window_hours)
            
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id
                FROM transactions
                WHERE household_id = $1 
                AND account_id = ANY($2)
                AND account_id != $3
                AND amount BETWEEN $4 AND $5
                AND date BETWEEN $6 AND $7
                AND is_transfer = false
                ORDER BY ABS(date - $8) ASC
                LIMIT 10
            """, household_id, household_accounts, transaction.get("account_id"), 
                 opposite_amount - self.amount_tolerance, opposite_amount + self.amount_tolerance,
                 time_start, time_end, date)
            
            best_match = None
            best_score = 0
            
            for row in rows:
                # Calculate similarity scores
                amount_similarity = self.calculate_amount_similarity(amount, row["amount"])
                time_similarity = self.calculate_time_similarity(date, row["date"])
                
                # Combined score (weighted average)
                score = (amount_similarity * 0.6) + (time_similarity * 0.4)
                
                if score > best_score and score >= self.intra_household_threshold:
                    best_score = score
                    best_match = row
            
            if best_match:
                return TransferDetection(
                    transaction_id=transaction_id,
                    is_transfer=True,
                    transfer_type="intra_household",
                    paired_transaction_id=best_match["id"],
                    confidence=best_score,
                    explanation=f"Intra-household transfer to account {best_match['account_id']} (confidence: {best_score:.2f})"
                )
        
        except Exception as e:
            logger.error(f"Error finding intra-household transfers: {e}")
        
        return None
    
    async def find_duplicates(self, transaction: Dict, household_id: int) -> Optional[TransferDetection]:
        """Find duplicate transactions"""
        if not self.db_pool:
            return None
        
        try:
            transaction_id = transaction["id"]
            amount = float(transaction["amount"])
            date = transaction["date"]
            merchant_name = transaction.get("merchant_name", "")
            description = transaction.get("description", "")
            
            # Search for similar transactions within time window
            time_start = date - timedelta(hours=self.time_window_hours)
            time_end = date + timedelta(hours=self.time_window_hours)
            
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id
                FROM transactions
                WHERE household_id = $1 
                AND id != $2
                AND date BETWEEN $3 AND $4
                AND is_transfer = false
                ORDER BY ABS(date - $5) ASC
                LIMIT 20
            """, household_id, transaction_id, time_start, time_end, date)
            
            best_match = None
            best_score = 0
            
            for row in rows:
                # Calculate similarity scores
                amount_similarity = self.calculate_amount_similarity(amount, row["amount"])
                time_similarity = self.calculate_time_similarity(date, row["date"])
                merchant_similarity = self.calculate_text_similarity(merchant_name, row["merchant_name"] or "")
                description_similarity = self.calculate_text_similarity(description, row["description"] or "")
                
                # Combined score (weighted average)
                score = (
                    amount_similarity * 0.4 +
                    time_similarity * 0.3 +
                    merchant_similarity * 0.2 +
                    description_similarity * 0.1
                )
                
                if score > best_score and score >= self.duplicate_threshold:
                    best_score = score
                    best_match = row
            
            if best_match:
                return TransferDetection(
                    transaction_id=transaction_id,
                    is_transfer=True,
                    transfer_type="duplicate",
                    paired_transaction_id=best_match["id"],
                    confidence=best_score,
                    explanation=f"Duplicate transaction (confidence: {best_score:.2f})"
                )
        
        except Exception as e:
            logger.error(f"Error finding duplicates: {e}")
        
        return None
    
    async def detect_transfers(self, transaction: Dict, household_id: int) -> TransferDetection:
        """Detect transfers for a single transaction"""
        # Check cache first
        cache_key = f"{self.transfer_cache_prefix}{transaction['id']}"
        if self.redis_client:
            cached = await self.redis_client.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return TransferDetection(**cached_data)
        
        # Try intra-household transfer detection first
        intra_transfer = await self.find_intra_household_transfers(transaction, household_id)
        if intra_transfer:
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "transaction_id": intra_transfer.transaction_id,
                        "is_transfer": intra_transfer.is_transfer,
                        "transfer_type": intra_transfer.transfer_type,
                        "paired_transaction_id": intra_transfer.paired_transaction_id,
                        "confidence": intra_transfer.confidence,
                        "explanation": intra_transfer.explanation
                    })
                )
            return intra_transfer
        
        # Try duplicate detection
        duplicate = await self.find_duplicates(transaction, household_id)
        if duplicate:
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "transaction_id": duplicate.transaction_id,
                        "is_transfer": duplicate.is_transfer,
                        "transfer_type": duplicate.transfer_type,
                        "paired_transaction_id": duplicate.paired_transaction_id,
                        "confidence": duplicate.confidence,
                        "explanation": duplicate.explanation
                    })
                )
            return duplicate
        
        # No transfer detected
        no_transfer = TransferDetection(
            transaction_id=transaction["id"],
            is_transfer=False,
            transfer_type=None,
            paired_transaction_id=None,
            confidence=1.0,
            explanation="No transfer detected"
        )
        
        # Cache the result
        if self.redis_client:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps({
                    "transaction_id": no_transfer.transaction_id,
                    "is_transfer": no_transfer.is_transfer,
                    "transfer_type": no_transfer.transfer_type,
                    "paired_transaction_id": no_transfer.paired_transaction_id,
                    "confidence": no_transfer.confidence,
                    "explanation": no_transfer.explanation
                })
            )
        
        return no_transfer
    
    async def process_transaction_transfers(self, transactions: List[Dict], household_id: int) -> List[Dict]:
        """Process transfers for a batch of transactions"""
        if not transactions:
            return transactions
        
        processed_transactions = []
        
        for transaction in transactions:
            try:
                # Detect transfers
                transfer_detection = await self.detect_transfers(transaction, household_id)
                
                # Update transaction with transfer information
                transaction["is_transfer"] = transfer_detection.is_transfer
                transaction["transfer_type"] = transfer_detection.transfer_type
                transaction["paired_transaction_id"] = transfer_detection.paired_transaction_id
                transaction["transfer_confidence"] = transfer_detection.confidence
                transaction["transfer_explanation"] = transfer_detection.explanation
                
            except Exception as e:
                logger.error(f"Error detecting transfers for transaction {transaction.get('id')}: {e}")
                # Keep original transfer status if detection fails
                transaction["is_transfer"] = False
                transaction["transfer_type"] = None
                transaction["paired_transaction_id"] = None
                transaction["transfer_confidence"] = 0.0
                transaction["transfer_explanation"] = f"Transfer detection error: {str(e)}"
            
            processed_transactions.append(transaction)
        
        return processed_transactions
    
    async def mark_transfers_in_database(self, transfers: List[TransferDetection]) -> bool:
        """Mark transactions as transfers in the database"""
        if not self.db_pool or not transfers:
            return True
        
        try:
            # Update transactions with transfer information
            for transfer in transfers:
                if transfer.is_transfer:
                    await self.db_pool.execute("""
                        UPDATE transactions 
                        SET is_transfer = true, 
                            transfer_type = $1,
                            paired_transaction_id = $2,
                            updated_at = NOW()
                        WHERE id = $3
                    """, transfer.transfer_type, transfer.paired_transaction_id, transfer.transaction_id)
            
            logger.info(f"Marked {len(transfers)} transactions as transfers")
            return True
        
        except Exception as e:
            logger.error(f"Error marking transfers in database: {e}")
            return False
    
    async def collapse_duplicates(self, household_id: int) -> int:
        """Collapse duplicate transactions by marking them as transfers"""
        if not self.db_pool:
            return 0
        
        try:
            # Find duplicate pairs
            rows = await self.db_pool.fetch("""
                WITH duplicates AS (
                    SELECT 
                        t1.id as t1_id,
                        t2.id as t2_id,
                        t1.amount,
                        t1.date,
                        t1.merchant_name,
                        t1.description,
                        ROW_NUMBER() OVER (
                            PARTITION BY t1.id 
                            ORDER BY ABS(t1.date - t2.date) ASC
                        ) as rn
                    FROM transactions t1
                    JOIN transactions t2 ON 
                        t1.household_id = t2.household_id
                        AND t1.id != t2.id
                        AND t1.is_transfer = false
                        AND t2.is_transfer = false
                        AND ABS(t1.amount - t2.amount) <= $1
                        AND ABS(t1.date - t2.date) <= INTERVAL '24 hours'
                        AND (
                            (t1.merchant_name = t2.merchant_name AND t1.merchant_name IS NOT NULL)
                            OR (t1.description = t2.description AND t1.description IS NOT NULL)
                        )
                )
                SELECT t1_id, t2_id, amount, date, merchant_name, description
                FROM duplicates
                WHERE rn = 1
                LIMIT 100
            """, self.amount_tolerance)
            
            collapsed_count = 0
            
            for row in rows:
                # Mark the newer transaction as a duplicate transfer
                await self.db_pool.execute("""
                    UPDATE transactions 
                    SET is_transfer = true,
                        transfer_type = 'duplicate',
                        paired_transaction_id = $1,
                        updated_at = NOW()
                    WHERE id = $2
                """, row["t1_id"], row["t2_id"])
                
                collapsed_count += 1
            
            logger.info(f"Collapsed {collapsed_count} duplicate transactions")
            return collapsed_count
        
        except Exception as e:
            logger.error(f"Error collapsing duplicates: {e}")
            return 0
    
    async def get_transfer_statistics(self, household_id: int, days: int = 30) -> Dict:
        """Get transfer statistics for a household"""
        if not self.db_pool:
            return {}
        
        try:
            # Get transfer statistics
            stats = await self.db_pool.fetchrow("""
                SELECT 
                    COUNT(*) as total_transfers,
                    COUNT(CASE WHEN transfer_type = 'intra_household' THEN 1 END) as intra_household_transfers,
                    COUNT(CASE WHEN transfer_type = 'duplicate' THEN 1 END) as duplicate_transfers,
                    COUNT(CASE WHEN transfer_type = 'external' THEN 1 END) as external_transfers,
                    AVG(transfer_confidence) as avg_confidence
                FROM transactions
                WHERE household_id = $1 
                AND is_transfer = true
                AND date >= NOW() - INTERVAL '$2 days'
            """, household_id, days)
            
            return {
                "total_transfers": stats["total_transfers"] or 0,
                "intra_household_transfers": stats["intra_household_transfers"] or 0,
                "duplicate_transfers": stats["duplicate_transfers"] or 0,
                "external_transfers": stats["external_transfers"] or 0,
                "avg_confidence": float(stats["avg_confidence"] or 0)
            }
        
        except Exception as e:
            logger.error(f"Error getting transfer statistics: {e}")
            return {}
    
    async def run_batch_processing(self, household_id: int):
        """Run batch processing for transfer detection"""
        if not self.db_pool:
            return
        
        try:
            # Get unprocessed transactions
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id, household_id
                FROM transactions
                WHERE household_id = $1 
                AND is_transfer IS NULL
                ORDER BY date DESC
                LIMIT 1000
            """, household_id)
            
            if not rows:
                return
            
            # Process transfers
            transactions = [dict(row) for row in rows]
            processed_transactions = await self.process_transaction_transfers(transactions, household_id)
            
            # Update database
            for transaction in processed_transactions:
                await self.db_pool.execute("""
                    UPDATE transactions 
                    SET is_transfer = $1,
                        transfer_type = $2,
                        paired_transaction_id = $3,
                        transfer_confidence = $4,
                        updated_at = NOW()
                    WHERE id = $5
                """, transaction["is_transfer"], transaction["transfer_type"], 
                     transaction["paired_transaction_id"], transaction["transfer_confidence"], 
                     transaction["id"])
            
            logger.info(f"Processed {len(processed_transactions)} transactions for transfer detection")
        
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            logger.info("Transfer Worker started")
            
            # Keep the worker running
            while True:
                # Get all households
                if self.db_pool:
                    households = await self.db_pool.fetch("SELECT id FROM households")
                    
                    for household in households:
                        await self.run_batch_processing(household["id"])
                        await self.collapse_duplicates(household["id"])
                
                await asyncio.sleep(300)  # Run every 5 minutes
                
        except KeyboardInterrupt:
            logger.info("Transfer Worker stopped by user")
        except Exception as e:
            logger.error(f"Transfer Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = TransferWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
