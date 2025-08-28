# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
import re
from typing import Dict, List, Optional, Tuple, Any
import asyncpg
import redis.asyncio as redis
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import joblib
from dataclasses import dataclass
import json
import hashlib
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

@dataclass
class CategoryPrediction:
    """Category prediction result"""
    category_id: int
    category_name: str
    confidence: float
    method: str  # 'rule', 'ml', 'user_override'
    explanation: str
    features_used: List[str]

@dataclass
class CategoryRule:
    """Category classification rule"""
    id: Optional[int]
    category_id: int
    rule_type: str  # 'merchant_contains', 'amount_range', 'description_regex', 'mcc'
    rule_value: str
    priority: int
    is_active: bool
    created_at: Optional[str] = None

class CategoryWorker:
    """Category classifier worker with ML and rule-based classification"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        
        # ML models
        self.text_vectorizer: Optional[TfidfVectorizer] = None
        self.text_classifier: Optional[RandomForestClassifier] = None
        self.amount_classifier: Optional[RandomForestClassifier] = None
        
        # Configuration
        self.confidence_threshold = 0.7
        self.cache_ttl = 3600  # 1 hour
        self.category_cache_prefix = "category:"
        self.model_cache_prefix = "model:"
        
        # Baseline rules
        self.baseline_rules = [
            # Groceries
            {"category": "Grocery Stores", "merchant_contains": ["walmart", "target", "kroger", "safeway", "whole foods", "trader joe"], "priority": 1},
            {"category": "Grocery Stores", "mcc": "5411", "priority": 1},
            
            # Restaurants
            {"category": "Restaurants", "merchant_contains": ["mcdonalds", "burger king", "subway", "starbucks", "chipotle", "pizza hut"], "priority": 1},
            {"category": "Restaurants", "mcc": "5812", "priority": 1},
            
            # Gas stations
            {"category": "Gas Stations", "merchant_contains": ["shell", "exxon", "bp", "chevron", "mobil"], "priority": 1},
            {"category": "Gas Stations", "mcc": "5541", "priority": 1},
            
            # Transportation
            {"category": "Transportation", "merchant_contains": ["uber", "lyft", "taxi", "metro", "bus"], "priority": 1},
            {"category": "Transportation", "mcc": "4121", "priority": 1},
            
            # Healthcare
            {"category": "Healthcare", "merchant_contains": ["cvs", "walgreens", "pharmacy", "doctor", "hospital"], "priority": 1},
            {"category": "Healthcare", "mcc": "5912", "priority": 1},
            
            # Entertainment
            {"category": "Entertainment", "merchant_contains": ["netflix", "spotify", "amazon prime", "hulu", "movie", "theater"], "priority": 1},
            
            # Shopping
            {"category": "Shopping", "merchant_contains": ["amazon", "ebay", "etsy", "shop", "store"], "priority": 2},
            
            # Utilities
            {"category": "Utilities", "merchant_contains": ["electric", "gas", "water", "internet", "phone", "cable"], "priority": 1},
            
            # Income
            {"category": "Income", "description_regex": r"(salary|payroll|deposit|credit|refund)", "priority": 1},
            {"category": "Income", "amount_range": "positive", "priority": 2},
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
        
        logger.info("Category Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Category Worker disconnected")
    
    async def get_categories(self) -> Dict[str, int]:
        """Get category name to ID mapping"""
        if not self.db_pool:
            return {}
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT id, name FROM categories WHERE parent_id IS NULL
                ORDER BY name
            """)
            
            return {row["name"]: row["id"] for row in rows}
        except Exception as e:
            logger.error(f"Error getting categories: {e}")
            return {}
    
    async def get_user_overrides(self, user_id: int) -> List[CategoryRule]:
        """Get user-specific category rules"""
        if not self.db_pool:
            return []
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT id, category_id, rule_type, rule_value, priority, is_active, created_at
                FROM category_rules
                WHERE user_id = $1 AND is_active = true
                ORDER BY priority DESC, created_at DESC
            """, user_id)
            
            return [
                CategoryRule(
                    id=row["id"],
                    category_id=row["category_id"],
                    rule_type=row["rule_type"],
                    rule_value=row["rule_value"],
                    priority=row["priority"],
                    is_active=row["is_active"],
                    created_at=row["created_at"].isoformat() if row["created_at"] else None
                )
                for row in rows
            ]
        except Exception as e:
            logger.error(f"Error getting user overrides: {e}")
            return []
    
    def extract_features(self, transaction: Dict) -> Dict[str, Any]:
        """Extract features from transaction for ML classification"""
        features = {}
        
        # Text features
        merchant_name = transaction.get("merchant_name", "").lower()
        description = transaction.get("description", "").lower()
        
        features["merchant_name"] = merchant_name
        features["description"] = description
        features["combined_text"] = f"{merchant_name} {description}".strip()
        
        # Amount features
        amount = abs(float(transaction.get("amount", 0)))
        features["amount"] = amount
        features["amount_log"] = np.log(amount + 1) if amount > 0 else 0
        features["is_positive"] = float(transaction.get("amount", 0)) > 0
        
        # MCC features
        mcc = transaction.get("merchant_mcc", "")
        features["mcc"] = mcc
        features["has_mcc"] = bool(mcc)
        
        # Time features
        date = transaction.get("date")
        if date:
            if isinstance(date, str):
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            features["day_of_week"] = date.weekday()
            features["month"] = date.month
            features["is_weekend"] = date.weekday() >= 5
        
        # Country features
        country = transaction.get("merchant_country", "")
        features["country"] = country
        features["is_domestic"] = country in ["US", "USA", ""]
        
        return features
    
    def apply_rule(self, transaction: Dict, rule: Dict) -> bool:
        """Apply a classification rule to a transaction"""
        features = self.extract_features(transaction)
        
        if "merchant_contains" in rule:
            merchant_name = features["merchant_name"]
            keywords = rule["merchant_contains"]
            return any(keyword in merchant_name for keyword in keywords)
        
        elif "description_regex" in rule:
            description = features["description"]
            pattern = rule["description_regex"]
            return bool(re.search(pattern, description, re.IGNORECASE))
        
        elif "mcc" in rule:
            mcc = features["mcc"]
            return mcc == rule["mcc"]
        
        elif "amount_range" in rule:
            amount = float(transaction.get("amount", 0))
            if rule["amount_range"] == "positive":
                return amount > 0
            elif rule["amount_range"] == "negative":
                return amount < 0
        
        return False
    
    async def classify_by_rules(self, transaction: Dict, user_id: Optional[int] = None) -> Optional[CategoryPrediction]:
        """Classify transaction using rule-based approach"""
        categories = await self.get_categories()
        
        # Get user overrides first (highest priority)
        if user_id:
            user_rules = await self.get_user_overrides(user_id)
            for rule in user_rules:
                if self.apply_rule(transaction, {
                    "rule_type": rule.rule_type,
                    rule.rule_type: rule.rule_value
                }):
                    category_name = next((name for name, cid in categories.items() if cid == rule.category_id), "Unknown")
                    return CategoryPrediction(
                        category_id=rule.category_id,
                        category_name=category_name,
                        confidence=0.9,
                        method="user_override",
                        explanation=f"User rule: {rule.rule_type} = {rule.rule_value}",
                        features_used=[rule.rule_type]
                    )
        
        # Apply baseline rules
        for rule in self.baseline_rules:
            if self.apply_rule(transaction, rule):
                category_name = rule["category"]
                category_id = categories.get(category_name)
                if category_id:
                    return CategoryPrediction(
                        category_id=category_id,
                        category_name=category_name,
                        confidence=0.8,
                        method="rule",
                        explanation=f"Baseline rule: {list(rule.keys())[1]} = {list(rule.values())[1]}",
                        features_used=[list(rule.keys())[1]]
                    )
        
        return None
    
    async def train_ml_models(self, household_id: Optional[int] = None):
        """Train ML models for category classification"""
        if not self.db_pool:
            return
        
        try:
            # Get training data
            query = """
                SELECT t.id, t.merchant_name, t.description, t.amount, t.merchant_mcc, 
                       t.merchant_country, t.date, c.id as category_id, c.name as category_name
                FROM transactions t
                JOIN categories c ON t.category_id = c.id
                WHERE t.category_id IS NOT NULL
            """
            params = []
            
            if household_id:
                query += " AND t.household_id = $1"
                params.append(household_id)
            
            rows = await self.db_pool.fetch(query, *params)
            
            if len(rows) < 100:  # Need minimum data for training
                logger.warning(f"Insufficient training data: {len(rows)} samples")
                return
            
            # Prepare data
            transactions = []
            categories = []
            
            for row in rows:
                transaction = {
                    "merchant_name": row["merchant_name"] or "",
                    "description": row["description"] or "",
                    "amount": float(row["amount"]),
                    "merchant_mcc": row["merchant_mcc"] or "",
                    "merchant_country": row["merchant_country"] or "",
                    "date": row["date"]
                }
                
                transactions.append(transaction)
                categories.append(row["category_id"])
            
            # Extract features
            features_list = [self.extract_features(t) for t in transactions]
            
            # Prepare text features
            text_data = [f["combined_text"] for f in features_list]
            
            # Train text classifier
            if len(set(categories)) > 1:  # Need multiple categories
                self.text_vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
                text_features = self.text_vectorizer.fit_transform(text_data)
                
                self.text_classifier = RandomForestClassifier(n_estimators=100, random_state=42)
                self.text_classifier.fit(text_features, categories)
                
                # Cache the models
                if self.redis_client:
                    text_model_data = {
                        "vectorizer": joblib.dumps(self.text_vectorizer),
                        "classifier": joblib.dumps(self.text_classifier)
                    }
                    await self.redis_client.setex(
                        f"{self.model_cache_prefix}text_{household_id or 'global'}",
                        self.cache_ttl * 24,  # 24 hours for models
                        json.dumps(text_model_data)
                    )
                
                logger.info(f"Trained text classifier with {len(transactions)} samples")
            
            # Train amount classifier
            amount_features = np.array([[f["amount"], f["amount_log"], f["is_positive"]] for f in features_list])
            
            if len(set(categories)) > 1:
                self.amount_classifier = RandomForestClassifier(n_estimators=50, random_state=42)
                self.amount_classifier.fit(amount_features, categories)
                
                # Cache the model
                if self.redis_client:
                    amount_model_data = joblib.dumps(self.amount_classifier)
                    await self.redis_client.setex(
                        f"{self.model_cache_prefix}amount_{household_id or 'global'}",
                        self.cache_ttl * 24,
                        amount_model_data
                    )
                
                logger.info(f"Trained amount classifier with {len(transactions)} samples")
        
        except Exception as e:
            logger.error(f"Error training ML models: {e}")
    
    async def load_ml_models(self, household_id: Optional[int] = None):
        """Load ML models from cache"""
        if not self.redis_client:
            return
        
        try:
            # Load text models
            text_model_key = f"{self.model_cache_prefix}text_{household_id or 'global'}"
            text_model_data = await self.redis_client.get(text_model_key)
            
            if text_model_data:
                data = json.loads(text_model_data)
                self.text_vectorizer = joblib.loads(data["vectorizer"])
                self.text_classifier = joblib.loads(data["classifier"])
                logger.info("Loaded text classification models from cache")
            
            # Load amount model
            amount_model_key = f"{self.model_cache_prefix}amount_{household_id or 'global'}"
            amount_model_data = await self.redis_client.get(amount_model_key)
            
            if amount_model_data:
                self.amount_classifier = joblib.loads(amount_model_data)
                logger.info("Loaded amount classification model from cache")
        
        except Exception as e:
            logger.error(f"Error loading ML models: {e}")
    
    async def classify_by_ml(self, transaction: Dict) -> Optional[CategoryPrediction]:
        """Classify transaction using ML models"""
        if not self.text_classifier or not self.amount_classifier:
            return None
        
        try:
            features = self.extract_features(transaction)
            
            # Text classification
            text_features = self.text_vectorizer.transform([features["combined_text"]])
            text_proba = self.text_classifier.predict_proba(text_features)[0]
            text_pred = self.text_classifier.predict(text_features)[0]
            text_confidence = max(text_proba)
            
            # Amount classification
            amount_features = np.array([[features["amount"], features["amount_log"], features["is_positive"]]])
            amount_proba = self.amount_classifier.predict_proba(amount_features)[0]
            amount_pred = self.amount_classifier.predict(amount_features)[0]
            amount_confidence = max(amount_proba)
            
            # Combine predictions (weighted average)
            if text_confidence > amount_confidence:
                category_id = text_pred
                confidence = text_confidence
                method = "ml_text"
                explanation = f"Text-based classification (confidence: {text_confidence:.2f})"
            else:
                category_id = amount_pred
                confidence = amount_confidence
                method = "ml_amount"
                explanation = f"Amount-based classification (confidence: {amount_confidence:.2f})"
            
            # Get category name
            categories = await self.get_categories()
            category_name = next((name for name, cid in categories.items() if cid == category_id), "Unknown")
            
            return CategoryPrediction(
                category_id=category_id,
                category_name=category_name,
                confidence=confidence,
                method=method,
                explanation=explanation,
                features_used=["text", "amount"]
            )
        
        except Exception as e:
            logger.error(f"Error in ML classification: {e}")
            return None
    
    async def classify_transaction(self, transaction: Dict, user_id: Optional[int] = None, 
                                 household_id: Optional[int] = None) -> CategoryPrediction:
        """Classify a transaction using all available methods"""
        # Check cache first
        cache_key = f"{self.category_cache_prefix}{hashlib.md5(str(transaction).encode()).hexdigest()}"
        if self.redis_client:
            cached = await self.redis_client.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return CategoryPrediction(**cached_data)
        
        # Try rule-based classification first
        rule_prediction = await self.classify_by_rules(transaction, user_id)
        if rule_prediction and rule_prediction.confidence >= self.confidence_threshold:
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "category_id": rule_prediction.category_id,
                        "category_name": rule_prediction.category_name,
                        "confidence": rule_prediction.confidence,
                        "method": rule_prediction.method,
                        "explanation": rule_prediction.explanation,
                        "features_used": rule_prediction.features_used
                    })
                )
            return rule_prediction
        
        # Try ML classification
        ml_prediction = await self.classify_by_ml(transaction)
        if ml_prediction and ml_prediction.confidence >= self.confidence_threshold:
            # Cache the result
            if self.redis_client:
                await self.redis_client.setex(
                    cache_key,
                    self.cache_ttl,
                    json.dumps({
                        "category_id": ml_prediction.category_id,
                        "category_name": ml_prediction.category_name,
                        "confidence": ml_prediction.confidence,
                        "method": ml_prediction.method,
                        "explanation": ml_prediction.explanation,
                        "features_used": ml_prediction.features_used
                    })
                )
            return ml_prediction
        
        # Default to "Uncategorized" if no confident prediction
        categories = await self.get_categories()
        uncategorized_id = categories.get("Uncategorized", 1)  # Default to first category if not found
        
        default_prediction = CategoryPrediction(
            category_id=uncategorized_id,
            category_name="Uncategorized",
            confidence=0.0,
            method="default",
            explanation="No confident classification found",
            features_used=[]
        )
        
        # Cache the result
        if self.redis_client:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps({
                    "category_id": default_prediction.category_id,
                    "category_name": default_prediction.category_name,
                    "confidence": default_prediction.confidence,
                    "method": default_prediction.method,
                    "explanation": default_prediction.explanation,
                    "features_used": default_prediction.features_used
                })
            )
        
        return default_prediction
    
    async def process_transaction_categories(self, transactions: List[Dict], 
                                          user_id: Optional[int] = None,
                                          household_id: Optional[int] = None) -> List[Dict]:
        """Process categories for a batch of transactions"""
        if not transactions:
            return transactions
        
        # Load ML models if needed
        await self.load_ml_models(household_id)
        
        processed_transactions = []
        
        for transaction in transactions:
            try:
                # Classify transaction
                prediction = await self.classify_transaction(transaction, user_id, household_id)
                
                # Update transaction with classification
                transaction["category_id"] = prediction.category_id
                transaction["category_name"] = prediction.category_name
                transaction["category_confidence"] = prediction.confidence
                transaction["category_method"] = prediction.method
                transaction["category_explanation"] = prediction.explanation
                
            except Exception as e:
                logger.error(f"Error classifying transaction: {e}")
                # Keep original category if classification fails
                transaction["category_confidence"] = 0.0
                transaction["category_method"] = "error"
                transaction["category_explanation"] = f"Classification error: {str(e)}"
            
            processed_transactions.append(transaction)
        
        return processed_transactions
    
    async def add_user_rule(self, user_id: int, category_id: int, rule_type: str, 
                           rule_value: str, priority: int = 1) -> bool:
        """Add a user-specific classification rule"""
        if not self.db_pool:
            return False
        
        try:
            await self.db_pool.execute("""
                INSERT INTO category_rules (user_id, category_id, rule_type, rule_value, priority, is_active)
                VALUES ($1, $2, $3, $4, $5, true)
            """, user_id, category_id, rule_type, rule_value, priority)
            
            logger.info(f"Added user rule: {rule_type} = {rule_value} for category {category_id}")
            return True
        
        except Exception as e:
            logger.error(f"Error adding user rule: {e}")
            return False
    
    async def retrain_models(self, household_id: Optional[int] = None):
        """Retrain ML models with new data"""
        logger.info(f"Retraining ML models for household {household_id or 'global'}")
        await self.train_ml_models(household_id)
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            logger.info("Category Worker started")
            
            # Initial model training
            await self.retrain_models()
            
            # Keep the worker running
            while True:
                await asyncio.sleep(60)  # Check for work every minute
                
        except KeyboardInterrupt:
            logger.info("Category Worker stopped by user")
        except Exception as e:
            logger.error(f"Category Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = CategoryWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
