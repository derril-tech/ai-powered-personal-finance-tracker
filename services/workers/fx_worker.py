# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import aiohttp
import asyncpg
import redis.asyncio as redis
import pandas as pd
from dataclasses import dataclass
from decimal import Decimal
import json

logger = logging.getLogger(__name__)

@dataclass
class ExchangeRate:
    """Exchange rate data structure"""
    base_currency: str
    target_currency: str
    rate: Decimal
    timestamp: datetime
    source: str
    last_updated: datetime

class FXWorker:
    """Foreign Exchange worker for fetching and caching exchange rates"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        self.session: Optional[aiohttp.ClientSession] = None
        
        # Configuration
        self.ecb_url = "https://api.exchangerate.host/latest"
        self.openexchange_url = "https://open.er-api.com/v6/latest"
        self.openexchange_api_key = os.getenv("OPENEXCHANGE_API_KEY", "")
        
        # Cache settings
        self.cache_ttl = 3600  # 1 hour
        self.rate_cache_prefix = "fx:rate:"
        self.historical_cache_prefix = "fx:historical:"
        
        # Supported currencies (major + common)
        self.supported_currencies = [
            "USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY", 
            "SEK", "NZD", "MXN", "SGD", "HKD", "NOK", "KRW", "TRY",
            "RUB", "INR", "BRL", "ZAR", "PLN", "THB", "IDR", "HUF"
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
        
        # HTTP session
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "FinanceTracker-FXWorker/1.0"}
        )
        
        logger.info("FX Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        if self.session:
            await self.session.close()
        logger.info("FX Worker disconnected")
    
    async def fetch_ecb_rates(self) -> Dict[str, float]:
        """Fetch rates from ECB via exchangerate.host"""
        try:
            async with self.session.get(self.ecb_url) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("success"):
                        rates = data.get("rates", {})
                        # Add EUR as base (1.0)
                        rates["EUR"] = 1.0
                        return rates
                logger.error(f"ECB API error: {response.status}")
                return {}
        except Exception as e:
            logger.error(f"Error fetching ECB rates: {e}")
            return {}
    
    async def fetch_openexchange_rates(self) -> Dict[str, float]:
        """Fetch rates from OpenExchangeRates"""
        if not self.openexchange_api_key:
            logger.warning("OpenExchange API key not configured")
            return {}
        
        try:
            url = f"{self.openexchange_url}/{self.openexchange_api_key}"
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    if data.get("result") == "success":
                        rates = data.get("rates", {})
                        # Add USD as base (1.0)
                        rates["USD"] = 1.0
                        return rates
                logger.error(f"OpenExchange API error: {response.status}")
                return {}
        except Exception as e:
            logger.error(f"Error fetching OpenExchange rates: {e}")
            return {}
    
    async def fetch_rates(self) -> Dict[str, Dict[str, float]]:
        """Fetch rates from multiple sources"""
        tasks = [
            self.fetch_ecb_rates(),
            self.fetch_openexchange_rates()
        ]
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        rates = {}
        if isinstance(results[0], dict):
            rates["ECB"] = results[0]
        if isinstance(results[1], dict):
            rates["OpenExchange"] = results[1]
        
        return rates
    
    async def cache_rate(self, base: str, target: str, rate: float, source: str):
        """Cache exchange rate in Redis"""
        if not self.redis_client:
            return
        
        cache_key = f"{self.rate_cache_prefix}{base}:{target}"
        rate_data = {
            "rate": rate,
            "source": source,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await self.redis_client.setex(
            cache_key,
            self.cache_ttl,
            json.dumps(rate_data)
        )
    
    async def get_cached_rate(self, base: str, target: str) -> Optional[ExchangeRate]:
        """Get cached exchange rate"""
        if not self.redis_client:
            return None
        
        cache_key = f"{self.rate_cache_prefix}{base}:{target}"
        cached = await self.redis_client.get(cache_key)
        
        if cached:
            data = json.loads(cached)
            return ExchangeRate(
                base_currency=base,
                target_currency=target,
                rate=Decimal(str(data["rate"])),
                timestamp=datetime.fromisoformat(data["timestamp"]),
                source=data["source"],
                last_updated=datetime.fromisoformat(data["timestamp"])
            )
        return None
    
    async def store_rates_in_db(self, rates: Dict[str, Dict[str, float]], source: str):
        """Store exchange rates in database"""
        if not self.db_pool:
            return
        
        # Create exchange_rates table if it doesn't exist
        await self.db_pool.execute("""
            CREATE TABLE IF NOT EXISTS exchange_rates (
                id SERIAL PRIMARY KEY,
                base_currency VARCHAR(3) NOT NULL,
                target_currency VARCHAR(3) NOT NULL,
                rate DECIMAL(20, 10) NOT NULL,
                source VARCHAR(50) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                UNIQUE(base_currency, target_currency, source, DATE(created_at))
            )
        """)
        
        # Insert rates
        timestamp = datetime.utcnow()
        for base, target_rates in rates.items():
            for target, rate in target_rates.items():
                if base != target and target in self.supported_currencies:
                    try:
                        await self.db_pool.execute("""
                            INSERT INTO exchange_rates (base_currency, target_currency, rate, source, created_at)
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (base_currency, target_currency, source, DATE(created_at))
                            DO UPDATE SET rate = EXCLUDED.rate, created_at = EXCLUDED.created_at
                        """, base, target, rate, source, timestamp)
                    except Exception as e:
                        logger.error(f"Error storing rate {base}/{target}: {e}")
    
    async def convert_amount(self, amount: Decimal, from_currency: str, to_currency: str, 
                           date: Optional[datetime] = None) -> Optional[Decimal]:
        """Convert amount between currencies"""
        if from_currency == to_currency:
            return amount
        
        # Try to get cached rate first
        rate = await self.get_cached_rate(from_currency, to_currency)
        
        if not rate:
            # Try to get from database
            rate = await self.get_historical_rate(from_currency, to_currency, date)
        
        if rate:
            return amount * rate.rate
        
        logger.warning(f"No exchange rate found for {from_currency} to {to_currency}")
        return None
    
    async def get_historical_rate(self, base: str, target: str, 
                                date: Optional[datetime] = None) -> Optional[ExchangeRate]:
        """Get historical exchange rate from database"""
        if not self.db_pool:
            return None
        
        try:
            if date:
                # Get rate for specific date
                row = await self.db_pool.fetchrow("""
                    SELECT base_currency, target_currency, rate, source, created_at
                    FROM exchange_rates
                    WHERE base_currency = $1 AND target_currency = $2
                    AND DATE(created_at) = DATE($3)
                    ORDER BY created_at DESC
                    LIMIT 1
                """, base, target, date)
            else:
                # Get latest rate
                row = await self.db_pool.fetchrow("""
                    SELECT base_currency, target_currency, rate, source, created_at
                    FROM exchange_rates
                    WHERE base_currency = $1 AND target_currency = $2
                    ORDER BY created_at DESC
                    LIMIT 1
                """, base, target)
            
            if row:
                return ExchangeRate(
                    base_currency=row["base_currency"],
                    target_currency=row["target_currency"],
                    rate=row["rate"],
                    timestamp=row["created_at"],
                    source=row["source"],
                    last_updated=row["created_at"]
                )
        except Exception as e:
            logger.error(f"Error getting historical rate: {e}")
        
        return None
    
    async def get_rate_history(self, base: str, target: str, 
                             days: int = 30) -> List[ExchangeRate]:
        """Get exchange rate history for analysis"""
        if not self.db_pool:
            return []
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT base_currency, target_currency, rate, source, created_at
                FROM exchange_rates
                WHERE base_currency = $1 AND target_currency = $2
                AND created_at >= NOW() - INTERVAL '$3 days'
                ORDER BY created_at ASC
            """, base, target, days)
            
            return [
                ExchangeRate(
                    base_currency=row["base_currency"],
                    target_currency=row["target_currency"],
                    rate=row["rate"],
                    timestamp=row["created_at"],
                    source=row["source"],
                    last_updated=row["created_at"]
                )
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error getting rate history: {e}")
            return []
    
    async def normalize_transaction_amounts(self, transactions: List[Dict]) -> List[Dict]:
        """Normalize transaction amounts to a base currency (USD)"""
        if not transactions:
            return transactions
        
        normalized_transactions = []
        
        for transaction in transactions:
            amount = Decimal(str(transaction.get("amount", 0)))
            currency = transaction.get("currency", "USD")
            
            if currency != "USD":
                converted_amount = await self.convert_amount(amount, currency, "USD")
                if converted_amount:
                    transaction["amount_usd"] = float(converted_amount)
                    transaction["original_currency"] = currency
                    transaction["original_amount"] = float(amount)
                else:
                    # Keep original if conversion fails
                    transaction["amount_usd"] = float(amount)
                    transaction["original_currency"] = currency
            else:
                transaction["amount_usd"] = float(amount)
            
            normalized_transactions.append(transaction)
        
        return normalized_transactions
    
    async def run_daily_update(self):
        """Run daily exchange rate update"""
        logger.info("Starting daily FX rate update")
        
        try:
            # Fetch rates from sources
            rates = await self.fetch_rates()
            
            if not rates:
                logger.error("No rates fetched from any source")
                return
            
            # Store in database and cache
            for source, source_rates in rates.items():
                await self.store_rates_in_db({source: source_rates}, source)
                
                # Cache individual rates
                for base, target_rates in source_rates.items():
                    for target, rate in target_rates.items():
                        if base != target:
                            await self.cache_rate(base, target, rate, source)
            
            logger.info(f"Updated {sum(len(rates) for rates in rates.values())} exchange rates")
            
        except Exception as e:
            logger.error(f"Error in daily FX update: {e}")
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            while True:
                await self.run_daily_update()
                
                # Wait 24 hours before next update
                await asyncio.sleep(24 * 60 * 60)
                
        except KeyboardInterrupt:
            logger.info("FX Worker stopped by user")
        except Exception as e:
            logger.error(f"FX Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = FXWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
