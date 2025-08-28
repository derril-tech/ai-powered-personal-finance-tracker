# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
import re
from typing import Dict, List, Optional, Tuple, Any
import asyncpg
import redis.asyncio as redis
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from dataclasses import dataclass
import json
import aiohttp
from fuzzywuzzy import fuzz
import hashlib

logger = logging.getLogger(__name__)

@dataclass
class Merchant:
    """Merchant data structure"""
    id: Optional[int]
    name: str
    website: Optional[str]
    country: Optional[str]
    mcc: Optional[str]
    embedding: Optional[List[float]]
    canonical_id: Optional[int]
    confidence: float
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

@dataclass
class MerchantMatch:
    """Merchant matching result"""
    merchant: Merchant
    similarity_score: float
    match_type: str  # 'exact', 'fuzzy', 'embedding', 'new'

class MerchantWorker:
    """Merchant resolver worker for normalization and enrichment"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        self.session: Optional[aiohttp.ClientSession] = None
        self.embedding_model: Optional[SentenceTransformer] = None
        
        # Configuration
        self.embedding_model_name = "all-MiniLM-L6-v2"
        self.similarity_threshold = 0.85
        self.fuzzy_threshold = 80
        self.cache_ttl = 3600  # 1 hour
        self.merchant_cache_prefix = "merchant:"
        self.embedding_cache_prefix = "embedding:"
        
        # MCC (Merchant Category Code) mapping
        self.mcc_categories = {
            "5411": "Grocery Stores",
            "5812": "Eating Places and Restaurants",
            "5541": "Service Stations",
            "5912": "Drug Stores and Pharmacies",
            "5311": "Department Stores",
            "5999": "Miscellaneous and Specialty Retail Stores",
            "5411": "Grocery Stores, Supermarkets",
            "5542": "Automated Fuel Dispensers",
            "5813": "Drinking Places",
            "5995": "Pet Shops, Pet Food, and Supplies",
            "4121": "Taxicabs and Limousines",
            "4511": "Airlines, Air Carriers",
            "4722": "Travel Agencies, Tour Operators",
            "7011": "Hotels, Motels, Resorts",
            "7991": "Tourist Attractions and Exhibits",
            "8099": "Health Practitioners",
            "8011": "Doctors and Physicians",
            "8021": "Dentists and Orthodontists",
            "8041": "Chiropodists, Podiatrists",
            "8042": "Dentists",
            "8043": "Osteopathic Physicians",
            "8044": "Optometrists and Ophthalmologists",
            "8049": "Health Practitioners",
            "8071": "Medical and Dental Laboratories",
            "8099": "Health Practitioners",
            "8211": "Elementary and Secondary Schools",
            "8220": "Colleges, Universities, Professional Schools",
            "8241": "Correspondence Schools",
            "8244": "Business and Secretarial Schools",
            "8249": "Trade and Vocational Schools",
            "8299": "Schools and Educational Services",
            "8351": "Child Care Services",
            "8398": "Charitable and Social Service Organizations",
            "8641": "Civic, Social, and Fraternal Associations",
            "8651": "Political Organizations",
            "8661": "Religious Organizations",
            "8675": "Automobile Associations",
            "8699": "Membership Organizations",
            "8734": "Testing Laboratories",
            "8911": "Architectural, Engineering, and Surveying Services",
            "8931": "Accounting, Auditing, and Bookkeeping Services",
            "8999": "Professional Services",
            "9211": "Court Costs, Including Alimony and Child Support",
            "9222": "Fines",
            "9223": "Bail and Bond Payments",
            "9311": "Tax Payments",
            "9399": "Government Services",
            "9402": "Postal Services",
            "9405": "Government Services",
            "9700": "Automated Cash Disbursements",
            "9701": "Automated Cash Disbursements",
            "9702": "Automated Cash Disbursements",
            "9751": "Automated Cash Disbursements",
            "9752": "Automated Cash Disbursements",
            "9754": "Automated Cash Disbursements",
            "9755": "Automated Cash Disbursements",
            "9756": "Automated Cash Disbursements",
            "9757": "Automated Cash Disbursements",
            "9758": "Automated Cash Disbursements",
            "9759": "Automated Cash Disbursements",
            "9760": "Automated Cash Disbursements",
            "9761": "Automated Cash Disbursements",
            "9762": "Automated Cash Disbursements",
            "9763": "Automated Cash Disbursements",
            "9764": "Automated Cash Disbursements",
            "9765": "Automated Cash Disbursements",
            "9766": "Automated Cash Disbursements",
            "9767": "Automated Cash Disbursements",
            "9768": "Automated Cash Disbursements",
            "9769": "Automated Cash Disbursements",
            "9770": "Automated Cash Disbursements",
            "9771": "Automated Cash Disbursements",
            "9772": "Automated Cash Disbursements",
            "9773": "Automated Cash Disbursements",
            "9774": "Automated Cash Disbursements",
            "9775": "Automated Cash Disbursements",
            "9776": "Automated Cash Disbursements",
            "9777": "Automated Cash Disbursements",
            "9778": "Automated Cash Disbursements",
            "9779": "Automated Cash Disbursements",
            "9780": "Automated Cash Disbursements",
            "9781": "Automated Cash Disbursements",
            "9782": "Automated Cash Disbursements",
            "9783": "Automated Cash Disbursements",
            "9784": "Automated Cash Disbursements",
            "9785": "Automated Cash Disbursements",
            "9786": "Automated Cash Disbursements",
            "9787": "Automated Cash Disbursements",
            "9788": "Automated Cash Disbursements",
            "9789": "Automated Cash Disbursements",
            "9790": "Automated Cash Disbursements",
            "9791": "Automated Cash Disbursements",
            "9792": "Automated Cash Disbursements",
            "9793": "Automated Cash Disbursements",
            "9794": "Automated Cash Disbursements",
            "9795": "Automated Cash Disbursements",
            "9796": "Automated Cash Disbursements",
            "9797": "Automated Cash Disbursements",
            "9798": "Automated Cash Disbursements",
            "9799": "Automated Cash Disbursements"
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
        
        # HTTP session
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={"User-Agent": "FinanceTracker-MerchantWorker/1.0"}
        )
        
        # Load embedding model
        try:
            self.embedding_model = SentenceTransformer(self.embedding_model_name)
            logger.info(f"Loaded embedding model: {self.embedding_model_name}")
        except Exception as e:
            logger.error(f"Error loading embedding model: {e}")
            self.embedding_model = None
        
        logger.info("Merchant Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        if self.session:
            await self.session.close()
        logger.info("Merchant Worker disconnected")
    
    def normalize_merchant_name(self, name: str) -> str:
        """Normalize merchant name for comparison"""
        if not name:
            return ""
        
        # Convert to lowercase
        normalized = name.lower()
        
        # Remove common prefixes/suffixes
        prefixes = ["the ", "a ", "an "]
        suffixes = [" inc", " llc", " ltd", " corp", " corporation", " company", " co"]
        
        for prefix in prefixes:
            if normalized.startswith(prefix):
                normalized = normalized[len(prefix):]
        
        for suffix in suffixes:
            if normalized.endswith(suffix):
                normalized = normalized[:-len(suffix)]
        
        # Remove special characters and extra spaces
        normalized = re.sub(r'[^\w\s]', ' ', normalized)
        normalized = re.sub(r'\s+', ' ', normalized).strip()
        
        return normalized
    
    def generate_merchant_descriptor(self, name: str, website: Optional[str] = None, 
                                   country: Optional[str] = None, mcc: Optional[str] = None) -> str:
        """Generate a descriptive text for merchant embedding"""
        descriptor_parts = [name]
        
        if website:
            # Extract domain from website
            domain = website.replace("https://", "").replace("http://", "").split("/")[0]
            descriptor_parts.append(f"website: {domain}")
        
        if country:
            descriptor_parts.append(f"country: {country}")
        
        if mcc and mcc in self.mcc_categories:
            descriptor_parts.append(f"category: {self.mcc_categories[mcc]}")
        
        return " | ".join(descriptor_parts)
    
    async def generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for text"""
        if not self.embedding_model or not text:
            return None
        
        try:
            # Check cache first
            cache_key = f"{self.embedding_cache_prefix}{hashlib.md5(text.encode()).hexdigest()}"
            if self.redis_client:
                cached = await self.redis_client.get(cache_key)
                if cached:
                    return json.loads(cached)
            
            # Generate embedding
            embedding = self.embedding_model.encode(text).tolist()
            
            # Cache the embedding
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps(embedding)
                )
            
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    async def find_exact_match(self, normalized_name: str) -> Optional[Merchant]:
        """Find exact match by normalized name"""
        if not self.db_pool:
            return None
        
        try:
            row = await self.db_pool.fetchrow("""
                SELECT id, name, website, country, mcc, embedding, canonical_id, created_at, updated_at
                FROM merchants
                WHERE normalized_name = $1 AND canonical_id IS NULL
                ORDER BY created_at DESC
                LIMIT 1
            """, normalized_name)
            
            if row:
                return Merchant(
                    id=row["id"],
                    name=row["name"],
                    website=row["website"],
                    country=row["country"],
                    mcc=row["mcc"],
                    embedding=row["embedding"],
                    canonical_id=row["canonical_id"],
                    confidence=1.0,
                    created_at=row["created_at"].isoformat() if row["created_at"] else None,
                    updated_at=row["updated_at"].isoformat() if row["updated_at"] else None
                )
        except Exception as e:
            logger.error(f"Error finding exact match: {e}")
        
        return None
    
    async def find_fuzzy_match(self, normalized_name: str) -> Optional[Tuple[Merchant, float]]:
        """Find fuzzy match by name similarity"""
        if not self.db_pool:
            return None
        
        try:
            # Get all merchants for fuzzy matching
            rows = await self.db_pool.fetch("""
                SELECT id, name, website, country, mcc, embedding, canonical_id, created_at, updated_at
                FROM merchants
                WHERE canonical_id IS NULL
                ORDER BY created_at DESC
                LIMIT 1000
            """)
            
            best_match = None
            best_score = 0
            
            for row in rows:
                merchant_name = row["name"]
                normalized_merchant_name = self.normalize_merchant_name(merchant_name)
                
                # Calculate fuzzy match score
                score = fuzz.ratio(normalized_name, normalized_merchant_name)
                
                if score > best_score and score >= self.fuzzy_threshold:
                    best_score = score
                    best_match = Merchant(
                        id=row["id"],
                        name=row["name"],
                        website=row["website"],
                        country=row["country"],
                        mcc=row["mcc"],
                        embedding=row["embedding"],
                        canonical_id=row["canonical_id"],
                        confidence=score / 100.0,
                        created_at=row["created_at"].isoformat() if row["created_at"] else None,
                        updated_at=row["updated_at"].isoformat() if row["updated_at"] else None
                    )
            
            if best_match:
                return best_match, best_score / 100.0
        
        except Exception as e:
            logger.error(f"Error finding fuzzy match: {e}")
        
        return None
    
    async def find_embedding_match(self, embedding: List[float]) -> Optional[Tuple[Merchant, float]]:
        """Find match by embedding similarity"""
        if not self.db_pool or not embedding:
            return None
        
        try:
            # Get merchants with embeddings
            rows = await self.db_pool.fetch("""
                SELECT id, name, website, country, mcc, embedding, canonical_id, created_at, updated_at
                FROM merchants
                WHERE embedding IS NOT NULL AND canonical_id IS NULL
                ORDER BY created_at DESC
                LIMIT 1000
            """)
            
            best_match = None
            best_score = 0
            
            for row in rows:
                if row["embedding"]:
                    # Calculate cosine similarity
                    similarity = cosine_similarity(
                        [embedding], 
                        [row["embedding"]]
                    )[0][0]
                    
                    if similarity > best_score and similarity >= self.similarity_threshold:
                        best_score = similarity
                        best_match = Merchant(
                            id=row["id"],
                            name=row["name"],
                            website=row["website"],
                            country=row["country"],
                            mcc=row["mcc"],
                            embedding=row["embedding"],
                            canonical_id=row["canonical_id"],
                            confidence=similarity,
                            created_at=row["created_at"].isoformat() if row["created_at"] else None,
                            updated_at=row["updated_at"].isoformat() if row["updated_at"] else None
                        )
            
            if best_match:
                return best_match, best_score
        
        except Exception as e:
            logger.error(f"Error finding embedding match: {e}")
        
        return None
    
    async def enrich_merchant(self, merchant: Merchant) -> Merchant:
        """Enrich merchant with additional data"""
        if not merchant.name:
            return merchant
        
        # Try to extract website from name if not provided
        if not merchant.website:
            # Simple heuristic: check if name contains common domain patterns
            domain_patterns = [".com", ".org", ".net", ".co", ".io"]
            for pattern in domain_patterns:
                if pattern in merchant.name.lower():
                    # Extract potential domain
                    parts = merchant.name.lower().split(pattern)
                    if len(parts) > 1:
                        potential_domain = parts[0] + pattern
                        if len(potential_domain) > 3:  # Minimum domain length
                            merchant.website = f"https://{potential_domain}"
                            break
        
        # Try to infer country from name patterns
        if not merchant.country:
            country_patterns = {
                "uk": "GB", "britain": "GB", "england": "GB",
                "usa": "US", "america": "US", "united states": "US",
                "canada": "CA", "australia": "AU", "germany": "DE",
                "france": "FR", "spain": "ES", "italy": "IT"
            }
            
            name_lower = merchant.name.lower()
            for pattern, country_code in country_patterns.items():
                if pattern in name_lower:
                    merchant.country = country_code
                    break
        
        return merchant
    
    async def create_merchant(self, name: str, website: Optional[str] = None,
                            country: Optional[str] = None, mcc: Optional[str] = None) -> Merchant:
        """Create a new merchant"""
        if not self.db_pool:
            raise Exception("Database not connected")
        
        try:
            # Normalize name
            normalized_name = self.normalize_merchant_name(name)
            
            # Generate descriptor and embedding
            descriptor = self.generate_merchant_descriptor(name, website, country, mcc)
            embedding = await self.generate_embedding(descriptor)
            
            # Enrich merchant data
            merchant = Merchant(
                id=None,
                name=name,
                website=website,
                country=country,
                mcc=mcc,
                embedding=embedding,
                canonical_id=None,
                confidence=1.0
            )
            merchant = await self.enrich_merchant(merchant)
            
            # Insert into database
            row = await self.db_pool.fetchrow("""
                INSERT INTO merchants (name, normalized_name, website, country, mcc, embedding)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING id, created_at, updated_at
            """, merchant.name, normalized_name, merchant.website, merchant.country, 
                 merchant.mcc, merchant.embedding)
            
            merchant.id = row["id"]
            merchant.created_at = row["created_at"].isoformat() if row["created_at"] else None
            merchant.updated_at = row["updated_at"].isoformat() if row["updated_at"] else None
            
            logger.info(f"Created new merchant: {name} (ID: {merchant.id})")
            return merchant
            
        except Exception as e:
            logger.error(f"Error creating merchant: {e}")
            raise
    
    async def resolve_merchant(self, name: str, website: Optional[str] = None,
                             country: Optional[str] = None, mcc: Optional[str] = None) -> MerchantMatch:
        """Resolve merchant to canonical form"""
        if not name:
            raise ValueError("Merchant name is required")
        
        # Normalize name
        normalized_name = self.normalize_merchant_name(name)
        
        # Check cache first
        cache_key = f"{self.merchant_cache_prefix}{hashlib.md5(normalized_name.encode()).hexdigest()}"
        if self.redis_client:
            cached = await self.redis_client.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return MerchantMatch(
                    merchant=Merchant(**cached_data["merchant"]),
                    similarity_score=cached_data["similarity_score"],
                    match_type=cached_data["match_type"]
                )
        
        # Try exact match first
        exact_match = await self.find_exact_match(normalized_name)
        if exact_match:
            result = MerchantMatch(exact_match, 1.0, "exact")
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "merchant": {
                            "id": result.merchant.id,
                            "name": result.merchant.name,
                            "website": result.merchant.website,
                            "country": result.merchant.country,
                            "mcc": result.merchant.mcc,
                            "embedding": result.merchant.embedding,
                            "canonical_id": result.merchant.canonical_id,
                            "confidence": result.merchant.confidence,
                            "created_at": result.merchant.created_at,
                            "updated_at": result.merchant.updated_at
                        },
                        "similarity_score": result.similarity_score,
                        "match_type": result.match_type
                    })
                )
            return result
        
        # Try fuzzy match
        fuzzy_result = await self.find_fuzzy_match(normalized_name)
        if fuzzy_result:
            merchant, score = fuzzy_result
            result = MerchantMatch(merchant, score, "fuzzy")
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "merchant": {
                            "id": result.merchant.id,
                            "name": result.merchant.name,
                            "website": result.merchant.website,
                            "country": result.merchant.country,
                            "mcc": result.merchant.mcc,
                            "embedding": result.merchant.embedding,
                            "canonical_id": result.merchant.canonical_id,
                            "confidence": result.merchant.confidence,
                            "created_at": result.merchant.created_at,
                            "updated_at": result.merchant.updated_at
                        },
                        "similarity_score": result.similarity_score,
                        "match_type": result.match_type
                    })
                )
            return result
        
        # Try embedding match if we have embedding model
        if self.embedding_model:
            descriptor = self.generate_merchant_descriptor(name, website, country, mcc)
            embedding = await self.generate_embedding(descriptor)
            
            if embedding:
                embedding_result = await self.find_embedding_match(embedding)
                if embedding_result:
                    merchant, score = embedding_result
                    result = MerchantMatch(merchant, score, "embedding")
                    # Cache the result
                    if self.redis_client:
                        await self.redis_client.setex(
                            cache_key,
                            self.cache_ttl,
                            json.dumps({
                                "merchant": {
                                    "id": result.merchant.id,
                                    "name": result.merchant.name,
                                    "website": result.merchant.website,
                                    "country": result.merchant.country,
                                    "mcc": result.merchant.mcc,
                                    "embedding": result.merchant.embedding,
                                    "canonical_id": result.merchant.canonical_id,
                                    "confidence": result.merchant.confidence,
                                    "created_at": result.merchant.created_at,
                                    "updated_at": result.merchant.updated_at
                                },
                                "similarity_score": result.similarity_score,
                                "match_type": result.match_type
                            })
                        )
                    return result
        
        # Create new merchant if no match found
        new_merchant = await self.create_merchant(name, website, country, mcc)
        result = MerchantMatch(new_merchant, 1.0, "new")
        
        # Cache the result
        if self.redis_client:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps({
                    "merchant": {
                        "id": result.merchant.id,
                        "name": result.merchant.name,
                        "website": result.merchant.website,
                        "country": result.merchant.country,
                        "mcc": result.merchant.mcc,
                        "embedding": result.merchant.embedding,
                        "canonical_id": result.merchant.canonical_id,
                        "confidence": result.merchant.confidence,
                        "created_at": result.merchant.created_at,
                        "updated_at": result.merchant.updated_at
                    },
                    "similarity_score": result.similarity_score,
                    "match_type": result.match_type
                })
            )
        
        return result
    
    async def process_transaction_merchants(self, transactions: List[Dict]) -> List[Dict]:
        """Process merchants for a batch of transactions"""
        if not transactions:
            return transactions
        
        processed_transactions = []
        
        for transaction in transactions:
            merchant_name = transaction.get("merchant_name")
            if merchant_name:
                try:
                    # Resolve merchant
                    match = await self.resolve_merchant(
                        name=merchant_name,
                        website=transaction.get("merchant_website"),
                        country=transaction.get("merchant_country"),
                        mcc=transaction.get("merchant_mcc")
                    )
                    
                    # Update transaction with resolved merchant
                    transaction["merchant_id"] = match.merchant.id
                    transaction["merchant_name"] = match.merchant.name
                    transaction["merchant_website"] = match.merchant.website
                    transaction["merchant_country"] = match.merchant.country
                    transaction["merchant_mcc"] = match.merchant.mcc
                    transaction["merchant_confidence"] = match.similarity_score
                    transaction["merchant_match_type"] = match.match_type
                    
                except Exception as e:
                    logger.error(f"Error resolving merchant '{merchant_name}': {e}")
                    # Keep original merchant name if resolution fails
                    transaction["merchant_confidence"] = 0.0
                    transaction["merchant_match_type"] = "error"
            
            processed_transactions.append(transaction)
        
        return processed_transactions
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            logger.info("Merchant Worker started")
            
            # Keep the worker running
            while True:
                await asyncio.sleep(60)  # Check for work every minute
                
        except KeyboardInterrupt:
            logger.info("Merchant Worker stopped by user")
        except Exception as e:
            logger.error(f"Merchant Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = MerchantWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
