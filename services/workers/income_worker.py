# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
from typing import Dict, List, Optional, Tuple, Set
import asyncpg
import redis.asyncio as redis
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dataclasses import dataclass
import json
import hashlib
import re
from collections import defaultdict

logger = logging.getLogger(__name__)

@dataclass
class IncomeSource:
    """Income source data structure"""
    id: Optional[int]
    household_id: int
    name: str
    employer_name: str
    amount: float
    frequency: str  # 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
    payday_pattern: str  # 'fixed_date', 'fixed_day', 'last_day', 'variable'
    confidence: float
    is_active: bool
    created_at: Optional[str] = None

@dataclass
class IncomeDetection:
    """Income detection result"""
    transaction_id: int
    is_income: bool
    income_type: Optional[str]  # 'salary', 'freelance', 'investment', 'refund', 'other'
    source_id: Optional[int]
    confidence: float
    explanation: str

class IncomeWorker:
    """Income detection worker for identifying income sources and paydays"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        
        # Configuration
        self.income_threshold = 0.0  # Positive amounts are income
        self.confidence_threshold = 0.7
        self.cache_ttl = 3600  # 1 hour
        self.income_cache_prefix = "income:"
        
        # Income detection patterns
        self.income_keywords = {
            "salary": [
                "salary", "payroll", "wages", "paycheck", "direct deposit",
                "employment", "employer", "company", "corp", "inc", "llc"
            ],
            "freelance": [
                "freelance", "contract", "consulting", "gig", "upwork", "fiverr",
                "client", "project", "invoice", "payment received"
            ],
            "investment": [
                "dividend", "interest", "capital gains", "investment", "stock",
                "bond", "mutual fund", "etf", "roi", "return"
            ],
            "refund": [
                "refund", "return", "credit", "reimbursement", "rebate",
                "cashback", "adjustment", "correction"
            ],
            "other": [
                "gift", "bonus", "commission", "tip", "rental", "royalty",
                "settlement", "inheritance", "lottery", "prize"
            ]
        }
        
        # Employer patterns
        self.employer_patterns = [
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Corp|Inc|LLC|Ltd|Company|Co)$",
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Technologies|Systems|Solutions|Services)$",
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Bank|Credit|Union|Financial)$",
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:University|College|School)$",
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Hospital|Medical|Clinic)$",
            r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Government|State|City|County)$"
        ]
    
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
        
        logger.info("Income Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Income Worker disconnected")
    
    def detect_income_type(self, transaction: Dict) -> Tuple[str, float]:
        """Detect income type from transaction data"""
        merchant_name = transaction.get("merchant_name", "").lower()
        description = transaction.get("description", "").lower()
        amount = float(transaction.get("amount", 0))
        
        # Check if it's income (positive amount)
        if amount <= self.income_threshold:
            return "not_income", 0.0
        
        # Combine text for analysis
        combined_text = f"{merchant_name} {description}".lower()
        
        best_type = "other"
        best_score = 0.0
        
        # Check each income type
        for income_type, keywords in self.income_keywords.items():
            score = 0.0
            matches = 0
            
            for keyword in keywords:
                if keyword in combined_text:
                    matches += 1
                    # Weight by keyword position and frequency
                    if keyword in merchant_name:
                        score += 2.0  # Higher weight for merchant name matches
                    else:
                        score += 1.0
            
            # Normalize score
            if matches > 0:
                score = min(1.0, score / len(keywords))
                if score > best_score:
                    best_score = score
                    best_type = income_type
        
        # Additional heuristics
        if best_score == 0.0:
            # Check for common income patterns
            if any(pattern in combined_text for pattern in ["direct deposit", "dd", "ach credit"]):
                best_type = "salary"
                best_score = 0.8
            elif any(pattern in combined_text for pattern in ["payroll", "pay check"]):
                best_type = "salary"
                best_score = 0.9
            elif any(pattern in combined_text for pattern in ["dividend", "interest"]):
                best_type = "investment"
                best_score = 0.8
            elif any(pattern in combined_text for pattern in ["refund", "return"]):
                best_type = "refund"
                best_score = 0.7
        
        return best_type, best_score
    
    def extract_employer_name(self, merchant_name: str) -> Optional[str]:
        """Extract employer name from merchant name"""
        if not merchant_name:
            return None
        
        # Try pattern matching
        for pattern in self.employer_patterns:
            match = re.match(pattern, merchant_name)
            if match:
                return match.group(1)
        
        # Simple heuristics
        words = merchant_name.split()
        if len(words) >= 2:
            # Remove common suffixes
            suffixes = ["corp", "inc", "llc", "ltd", "company", "co", "technologies", 
                       "systems", "solutions", "services", "bank", "credit", "union"]
            
            filtered_words = [word for word in words if word.lower() not in suffixes]
            
            if filtered_words:
                return " ".join(filtered_words)
        
        return merchant_name
    
    def detect_payday_pattern(self, dates: List[datetime]) -> Tuple[str, float]:
        """Detect payday pattern from a list of dates"""
        if len(dates) < 2:
            return "variable", 0.0
        
        # Sort dates
        sorted_dates = sorted(dates)
        
        # Check for fixed day of month (e.g., always 15th and 30th)
        day_counts = defaultdict(int)
        for date in sorted_dates:
            day_counts[date.day] += 1
        
        # Find most common days
        common_days = sorted(day_counts.items(), key=lambda x: x[1], reverse=True)
        
        if len(common_days) <= 2 and common_days[0][1] >= len(dates) * 0.8:
            if len(common_days) == 1:
                return "fixed_date", 0.9
            else:
                return "fixed_day", 0.8
        
        # Check for last day of month
        last_day_count = sum(1 for date in sorted_dates if date.day >= 28)
        if last_day_count >= len(dates) * 0.7:
            return "last_day", 0.7
        
        # Check for bi-weekly pattern (every 14 days)
        intervals = []
        for i in range(1, len(sorted_dates)):
            interval = (sorted_dates[i] - sorted_dates[i-1]).days
            intervals.append(interval)
        
        if intervals:
            mean_interval = np.mean(intervals)
            if 13 <= mean_interval <= 15:  # Bi-weekly
                return "biweekly", 0.8
            elif 6 <= mean_interval <= 8:  # Weekly
                return "weekly", 0.8
            elif 28 <= mean_interval <= 32:  # Monthly
                return "monthly", 0.7
        
        return "variable", 0.3
    
    async def find_similar_income_transactions(self, transaction: Dict, household_id: int) -> List[Dict]:
        """Find similar income transactions for pattern detection"""
        if not self.db_pool:
            return []
        
        try:
            merchant_name = transaction.get("merchant_name", "")
            amount = float(transaction.get("amount", 0))
            
            # Search for similar income transactions
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id
                FROM transactions
                WHERE household_id = $1 
                AND merchant_name = $2
                AND amount > 0
                AND amount BETWEEN $3 AND $4
                ORDER BY date DESC
                LIMIT 50
            """, household_id, merchant_name,
                 amount * 0.8, amount * 1.2)  # 20% tolerance
            
            return [dict(row) for row in rows]
        
        except Exception as e:
            logger.error(f"Error finding similar income transactions: {e}")
            return []
    
    async def detect_income_source(self, transaction: Dict, household_id: int) -> Optional[IncomeSource]:
        """Detect income source from transaction"""
        if not self.db_pool:
            return None
        
        try:
            merchant_name = transaction.get("merchant_name", "")
            amount = float(transaction.get("amount", 0))
            
            # Find similar transactions
            similar_transactions = await self.find_similar_income_transactions(transaction, household_id)
            
            if len(similar_transactions) < 2:
                return None
            
            # Extract dates and amounts
            dates = [t["date"] for t in similar_transactions]
            amounts = [float(t["amount"]) for t in similar_transactions]
            
            # Detect payday pattern
            payday_pattern, pattern_confidence = self.detect_payday_pattern(dates)
            
            # Calculate amount consistency
            amount_consistency = 1.0 - np.std(amounts) / np.mean(amounts) if np.mean(amounts) > 0 else 0.0
            amount_consistency = max(0.0, min(1.0, amount_consistency))
            
            # Determine frequency
            if payday_pattern == "biweekly":
                frequency = "biweekly"
            elif payday_pattern == "weekly":
                frequency = "weekly"
            elif payday_pattern in ["fixed_date", "fixed_day", "last_day"]:
                frequency = "monthly"
            else:
                frequency = "variable"
            
            # Overall confidence
            confidence = (pattern_confidence * 0.6) + (amount_consistency * 0.4)
            
            if confidence < self.confidence_threshold:
                return None
            
            # Extract employer name
            employer_name = self.extract_employer_name(merchant_name) or merchant_name
            
            return IncomeSource(
                id=None,
                household_id=household_id,
                name=f"{employer_name} Income",
                employer_name=employer_name,
                amount=np.mean(amounts),
                frequency=frequency,
                payday_pattern=payday_pattern,
                confidence=confidence,
                is_active=True
            )
        
        except Exception as e:
            logger.error(f"Error detecting income source: {e}")
            return None
    
    async def find_existing_income_source(self, transaction: Dict, household_id: int) -> Optional[IncomeSource]:
        """Find existing income source for a transaction"""
        if not self.db_pool:
            return None
        
        try:
            merchant_name = transaction.get("merchant_name", "")
            amount = float(transaction.get("amount", 0))
            
            # Look for existing income sources
            row = await self.db_pool.fetchrow("""
                SELECT id, household_id, name, employer_name, amount, frequency, 
                       payday_pattern, confidence, is_active, created_at
                FROM income_sources
                WHERE household_id = $1 
                AND employer_name = $2
                AND amount BETWEEN $3 AND $4
                AND is_active = true
                ORDER BY confidence DESC, created_at DESC
                LIMIT 1
            """, household_id, merchant_name,
                 amount * 0.8, amount * 1.2)
            
            if row:
                return IncomeSource(
                    id=row["id"],
                    household_id=row["household_id"],
                    name=row["name"],
                    employer_name=row["employer_name"],
                    amount=row["amount"],
                    frequency=row["frequency"],
                    payday_pattern=row["payday_pattern"],
                    confidence=row["confidence"],
                    is_active=row["is_active"],
                    created_at=row["created_at"].isoformat() if row["created_at"] else None
                )
        
        except Exception as e:
            logger.error(f"Error finding existing income source: {e}")
        
        return None
    
    async def create_or_update_income_source(self, income_source: IncomeSource) -> int:
        """Create or update an income source"""
        if not self.db_pool:
            return 0
        
        try:
            if income_source.id:
                # Update existing income source
                await self.db_pool.execute("""
                    UPDATE income_sources
                    SET amount = $1, confidence = $2, updated_at = NOW()
                    WHERE id = $3
                """, income_source.amount, income_source.confidence, income_source.id)
                
                return income_source.id
            else:
                # Create new income source
                row = await self.db_pool.fetchrow("""
                    INSERT INTO income_sources 
                    (household_id, name, employer_name, amount, frequency, payday_pattern, confidence, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                    RETURNING id
                """, income_source.household_id, income_source.name, income_source.employer_name,
                     income_source.amount, income_source.frequency, income_source.payday_pattern,
                     income_source.confidence)
                
                logger.info(f"Created income source: {income_source.employer_name}")
                return row["id"]
        
        except Exception as e:
            logger.error(f"Error creating/updating income source: {e}")
            return 0
    
    async def detect_income_transaction(self, transaction: Dict, household_id: int) -> IncomeDetection:
        """Detect if a transaction is income"""
        # Check cache first
        cache_key = f"{self.income_cache_prefix}{transaction['id']}"
        if self.redis_client:
            cached = await self.redis_client.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return IncomeDetection(**cached_data)
        
        # Detect income type
        income_type, type_confidence = self.detect_income_type(transaction)
        
        if income_type == "not_income":
            result = IncomeDetection(
                transaction_id=transaction["id"],
                is_income=False,
                income_type=None,
                source_id=None,
                confidence=0.0,
                explanation="Not an income transaction"
            )
            
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "transaction_id": result.transaction_id,
                        "is_income": result.is_income,
                        "income_type": result.income_type,
                        "source_id": result.source_id,
                        "confidence": result.confidence,
                        "explanation": result.explanation
                    })
                )
            
            return result
        
        # Try to find existing income source
        existing_source = await self.find_existing_income_source(transaction, household_id)
        
        if existing_source:
            source_id = existing_source.id
            confidence = max(type_confidence, existing_source.confidence)
            explanation = f"Matches existing income source: {existing_source.employer_name}"
        else:
            # Try to detect new income source
            new_source = await self.detect_income_source(transaction, household_id)
            
            if new_source:
                source_id = await self.create_or_update_income_source(new_source)
                confidence = max(type_confidence, new_source.confidence)
                explanation = f"New income source detected: {new_source.employer_name}"
            else:
                source_id = None
                confidence = type_confidence
                explanation = f"Income detected but no pattern found"
        
        result = IncomeDetection(
            transaction_id=transaction["id"],
            is_income=True,
            income_type=income_type,
            source_id=source_id,
            confidence=confidence,
            explanation=explanation
        )
        
        # Cache the result
        if self.redis_client:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps({
                    "transaction_id": result.transaction_id,
                    "is_income": result.is_income,
                    "income_type": result.income_type,
                    "source_id": result.source_id,
                    "confidence": result.confidence,
                    "explanation": result.explanation
                })
            )
        
        return result
    
    async def process_transaction_income(self, transactions: List[Dict], household_id: int) -> List[Dict]:
        """Process income detection for a batch of transactions"""
        if not transactions:
            return transactions
        
        processed_transactions = []
        
        for transaction in transactions:
            try:
                # Detect income
                income_detection = await self.detect_income_transaction(transaction, household_id)
                
                # Update transaction with income information
                transaction["is_income"] = income_detection.is_income
                transaction["income_type"] = income_detection.income_type
                transaction["income_source_id"] = income_detection.source_id
                transaction["income_confidence"] = income_detection.confidence
                transaction["income_explanation"] = income_detection.explanation
                
            except Exception as e:
                logger.error(f"Error detecting income for transaction {transaction.get('id')}: {e}")
                # Keep original income status if detection fails
                transaction["is_income"] = False
                transaction["income_type"] = None
                transaction["income_source_id"] = None
                transaction["income_confidence"] = 0.0
                transaction["income_explanation"] = f"Income detection error: {str(e)}"
            
            processed_transactions.append(transaction)
        
        return processed_transactions
    
    async def get_income_statistics(self, household_id: int, days: int = 30) -> Dict:
        """Get income statistics for a household"""
        if not self.db_pool:
            return {}
        
        try:
            # Get income statistics
            stats = await self.db_pool.fetchrow("""
                SELECT 
                    COUNT(*) as total_income_transactions,
                    SUM(amount) as total_income,
                    AVG(amount) as avg_income,
                    COUNT(DISTINCT merchant_name) as unique_sources
                FROM transactions
                WHERE household_id = $1 
                AND is_income = true
                AND date >= NOW() - INTERVAL '$2 days'
            """, household_id, days)
            
            return {
                "total_income_transactions": stats["total_income_transactions"] or 0,
                "total_income": float(stats["total_income"] or 0),
                "avg_income": float(stats["avg_income"] or 0),
                "unique_sources": stats["unique_sources"] or 0
            }
        
        except Exception as e:
            logger.error(f"Error getting income statistics: {e}")
            return {}
    
    async def get_income_sources(self, household_id: int) -> List[Dict]:
        """Get all income sources for a household"""
        if not self.db_pool:
            return []
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT id, name, employer_name, amount, frequency, payday_pattern, confidence, is_active
                FROM income_sources
                WHERE household_id = $1 AND is_active = true
                ORDER BY confidence DESC, created_at DESC
            """, household_id)
            
            return [
                {
                    "id": row["id"],
                    "name": row["name"],
                    "employer_name": row["employer_name"],
                    "amount": row["amount"],
                    "frequency": row["frequency"],
                    "payday_pattern": row["payday_pattern"],
                    "confidence": row["confidence"],
                    "is_active": row["is_active"]
                }
                for row in rows
            ]
        
        except Exception as e:
            logger.error(f"Error getting income sources: {e}")
            return []
    
    async def predict_next_payday(self, income_source_id: int) -> Optional[datetime]:
        """Predict next payday for an income source"""
        if not self.db_pool:
            return None
        
        try:
            # Get income source details
            row = await self.db_pool.fetchrow("""
                SELECT frequency, payday_pattern, amount
                FROM income_sources
                WHERE id = $1 AND is_active = true
            """, income_source_id)
            
            if not row:
                return None
            
            # Get recent transactions for this source
            transactions = await self.db_pool.fetch("""
                SELECT date
                FROM transactions
                WHERE income_source_id = $1
                ORDER BY date DESC
                LIMIT 10
            """, income_source_id)
            
            if not transactions:
                return None
            
            last_payday = max(t["date"] for t in transactions)
            frequency = row["frequency"]
            payday_pattern = row["payday_pattern"]
            
            # Calculate next payday based on pattern
            if frequency == "weekly":
                next_payday = last_payday + timedelta(days=7)
            elif frequency == "biweekly":
                next_payday = last_payday + timedelta(days=14)
            elif frequency == "monthly":
                if payday_pattern == "fixed_date":
                    # Same day next month
                    next_payday = last_payday.replace(month=last_payday.month + 1)
                elif payday_pattern == "last_day":
                    # Last day of next month
                    next_month = last_payday.replace(month=last_payday.month + 1)
                    next_payday = next_month.replace(day=28)  # Start with 28th
                    while next_payday.month == next_month.month:
                        next_payday += timedelta(days=1)
                    next_payday -= timedelta(days=1)
                else:
                    # Approximate monthly
                    next_payday = last_payday + timedelta(days=30)
            else:
                # Variable frequency, use average interval
                dates = [t["date"] for t in transactions]
                if len(dates) >= 2:
                    intervals = [(dates[i] - dates[i+1]).days for i in range(len(dates)-1)]
                    avg_interval = np.mean(intervals)
                    next_payday = last_payday + timedelta(days=avg_interval)
                else:
                    return None
            
            return next_payday
        
        except Exception as e:
            logger.error(f"Error predicting next payday: {e}")
            return None
    
    async def run_batch_processing(self, household_id: int):
        """Run batch processing for income detection"""
        if not self.db_pool:
            return
        
        try:
            # Get unprocessed transactions
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, account_id, household_id
                FROM transactions
                WHERE household_id = $1 
                AND is_income IS NULL
                ORDER BY date DESC
                LIMIT 1000
            """, household_id)
            
            if not rows:
                return
            
            # Process income detection
            transactions = [dict(row) for row in rows]
            processed_transactions = await self.process_transaction_income(transactions, household_id)
            
            # Update database
            for transaction in processed_transactions:
                await self.db_pool.execute("""
                    UPDATE transactions 
                    SET is_income = $1,
                        income_type = $2,
                        income_source_id = $3,
                        income_confidence = $4,
                        updated_at = NOW()
                    WHERE id = $5
                """, transaction["is_income"], transaction["income_type"], 
                     transaction["income_source_id"], transaction["income_confidence"], 
                     transaction["id"])
            
            logger.info(f"Processed {len(processed_transactions)} transactions for income detection")
        
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            logger.info("Income Worker started")
            
            # Keep the worker running
            while True:
                # Get all households
                if self.db_pool:
                    households = await self.db_pool.fetch("SELECT id FROM households")
                    
                    for household in households:
                        await self.run_batch_processing(household["id"])
                
                await asyncio.sleep(600)  # Run every 10 minutes
                
        except KeyboardInterrupt:
            logger.info("Income Worker stopped by user")
        except Exception as e:
            logger.error(f"Income Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = IncomeWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
