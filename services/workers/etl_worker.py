# Created automatically by Cursor AI (2024-08-27)

import asyncio
import logging
import hashlib
import json
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import asyncpg
import redis.asyncio as redis
import nats
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TransactionData(BaseModel):
    id: str
    account_id: str
    external_id: str
    amount: float
    currency: str
    description: str
    date: datetime
    merchant_name: Optional[str] = None
    metadata: Dict[str, Any] = {}

class ETLWorker:
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        self.nats_client: Optional[nats.NatsClient] = None

    async def connect(self):
        """Initialize database, Redis, and NATS connections"""
        # Database connection
        self.db_pool = await asyncpg.create_pool(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', 5432)),
            user=os.getenv('DB_USERNAME', 'postgres'),
            password=os.getenv('DB_PASSWORD', 'password'),
            database=os.getenv('DB_NAME', 'finance_tracker'),
        )

        # Redis connection
        self.redis_client = redis.Redis(
            host=os.getenv('REDIS_HOST', 'localhost'),
            port=int(os.getenv('REDIS_PORT', 6379)),
            password=os.getenv('REDIS_PASSWORD'),
            decode_responses=True,
        )

        # NATS connection
        self.nats_client = await nats.connect(
            os.getenv('NATS_URL', 'nats://localhost:4222')
        )

    async def disconnect(self):
        """Close all connections"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        if self.nats_client:
            await self.nats_client.close()

    def generate_transaction_hash(self, transaction: TransactionData) -> str:
        """Generate a unique hash for transaction deduplication"""
        hash_data = f"{transaction.account_id}:{transaction.external_id}:{transaction.amount}:{transaction.date.isoformat()}"
        return hashlib.sha256(hash_data.encode()).hexdigest()

    async def is_duplicate_transaction(self, transaction_hash: str) -> bool:
        """Check if transaction already exists"""
        return await self.redis_client.exists(f"tx_hash:{transaction_hash}")

    async def mark_transaction_processed(self, transaction_hash: str):
        """Mark transaction as processed"""
        await self.redis_client.setex(f"tx_hash:{transaction_hash}", 86400 * 30, "1")  # 30 days TTL

    async def detect_transfers(self, transactions: List[TransactionData]) -> List[TransactionData]:
        """Detect and mark internal transfers"""
        # TODO: Implement transfer detection logic
        # This would typically:
        # 1. Look for matching amounts with opposite signs
        # 2. Check for similar timing
        # 3. Look for transfer keywords in descriptions
        # 4. Mark transactions as transfers

        for transaction in transactions:
            # Simple keyword-based transfer detection
            transfer_keywords = ['transfer', 'move', 'send', 'receive', 'ach', 'wire']
            if any(keyword in transaction.description.lower() for keyword in transfer_keywords):
                transaction.metadata['is_transfer'] = True

        return transactions

    async def normalize_currency(self, amount: float, from_currency: str, to_currency: str = 'USD') -> float:
        """Normalize currency amounts to base currency"""
        if from_currency == to_currency:
            return amount

        # Get exchange rate from Redis cache
        rate_key = f"fx_rate:{from_currency}:{to_currency}"
        cached_rate = await self.redis_client.get(rate_key)
        
        if cached_rate:
            return amount * float(cached_rate)
        
        # TODO: Implement FX rate fetching from external API
        # For now, return original amount
        logger.warning(f"No FX rate found for {from_currency} to {to_currency}")
        return amount

    async def process_transactions(self, transactions: List[TransactionData]):
        """Process a batch of transactions"""
        processed_count = 0
        skipped_count = 0

        for transaction in transactions:
            try:
                # Generate hash for deduplication
                transaction_hash = self.generate_transaction_hash(transaction)
                
                # Check for duplicates
                if await self.is_duplicate_transaction(transaction_hash):
                    logger.info(f"Skipping duplicate transaction: {transaction.external_id}")
                    skipped_count += 1
                    continue

                # Normalize currency
                normalized_amount = await self.normalize_currency(
                    transaction.amount, 
                    transaction.currency
                )

                # Store transaction in database
                async with self.db_pool.acquire() as conn:
                    await conn.execute("""
                        INSERT INTO transactions (
                            id, account_id, external_id, amount, currency, 
                            description, merchant_name, date, metadata, created_at, updated_at
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
                    """, 
                    transaction.id, transaction.account_id, transaction.external_id,
                    normalized_amount, transaction.currency, transaction.description,
                    transaction.merchant_name, transaction.date, json.dumps(transaction.metadata)
                    )

                # Mark as processed
                await self.mark_transaction_processed(transaction_hash)
                processed_count += 1

                # Publish event for downstream processing
                await self.nats_client.publish(
                    "tx.upsert",
                    json.dumps({
                        "transaction_id": transaction.id,
                        "account_id": transaction.account_id,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }).encode()
                )

            except Exception as e:
                logger.error(f"Error processing transaction {transaction.external_id}: {e}")
                continue

        logger.info(f"Processed {processed_count} transactions, skipped {skipped_count} duplicates")

    async def sync_connection(self, connection_id: str):
        """Sync all accounts for a connection"""
        try:
            # TODO: Implement connection-specific sync logic
            # This would typically:
            # 1. Get connection details from database
            # 2. Call provider API to get latest data
            # 3. Process accounts and transactions
            # 4. Update last sync timestamp

            logger.info(f"Syncing connection: {connection_id}")
            
            # Mock transaction data for demonstration
            mock_transactions = [
                TransactionData(
                    id="mock-tx-1",
                    account_id="mock-account-1",
                    external_id="ext-123",
                    amount=100.50,
                    currency="USD",
                    description="Coffee at Starbucks",
                    date=datetime.now(timezone.utc),
                    merchant_name="Starbucks",
                )
            ]

            # Detect transfers
            transactions = await self.detect_transfers(mock_transactions)
            
            # Process transactions
            await self.process_transactions(transactions)

            # Update connection last sync
            async with self.db_pool.acquire() as conn:
                await conn.execute(
                    "UPDATE connections SET last_sync_at = NOW() WHERE id = $1",
                    connection_id
                )

        except Exception as e:
            logger.error(f"Error syncing connection {connection_id}: {e}")

    async def handle_sync_message(self, msg):
        """Handle sync messages from NATS"""
        try:
            data = json.loads(msg.data.decode())
            connection_id = data.get('connection_id')
            
            if connection_id:
                await self.sync_connection(connection_id)
            
            await msg.ack()
        except Exception as e:
            logger.error(f"Error handling sync message: {e}")
            await msg.nak()

    async def start(self):
        """Start the ETL worker"""
        await self.connect()
        
        # Subscribe to sync messages
        await self.nats_client.subscribe(
            "conn.sync",
            cb=self.handle_sync_message
        )
        
        logger.info("ETL worker started and listening for sync messages")
        
        # Keep the worker running
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Shutting down ETL worker")
        finally:
            await self.disconnect()

if __name__ == "__main__":
    import os
    
    worker = ETLWorker()
    asyncio.run(worker.start())
