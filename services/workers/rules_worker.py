# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
import os
import re
import json
from typing import Dict, List, Optional, Tuple, Any, Union
import asyncpg
import redis.asyncio as redis
from datetime import datetime, timedelta
from dataclasses import dataclass
import hashlib
from enum import Enum

logger = logging.getLogger(__name__)

class RuleOperator(Enum):
    """Rule operators"""
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    GREATER_THAN = "greater_than"
    LESS_THAN = "less_than"
    GREATER_EQUAL = "greater_equal"
    LESS_EQUAL = "less_equal"
    BETWEEN = "between"
    NOT_BETWEEN = "not_between"
    REGEX = "regex"
    NOT_REGEX = "not_regex"
    IN = "in"
    NOT_IN = "not_in"

class ActionType(Enum):
    """Rule action types"""
    SET_CATEGORY = "set_category"
    SET_TAG = "set_tag"
    SET_NOTE = "set_note"
    EXCLUDE = "exclude"
    SPLIT = "split"
    ALERT = "alert"

@dataclass
class RuleCondition:
    """Rule condition data structure"""
    field: str
    operator: RuleOperator
    value: Any
    case_sensitive: bool = False

@dataclass
class RuleAction:
    """Rule action data structure"""
    type: ActionType
    value: Any
    parameters: Optional[Dict] = None

@dataclass
class Rule:
    """Rule data structure"""
    id: Optional[int]
    household_id: int
    name: str
    description: Optional[str]
    conditions: List[RuleCondition]
    actions: List[RuleAction]
    priority: int
    is_active: bool
    is_retroactive: bool
    created_at: Optional[str] = None

@dataclass
class RuleMatch:
    """Rule match result"""
    rule_id: int
    rule_name: str
    matched_conditions: List[str]
    actions_applied: List[str]
    confidence: float

class RulesWorker:
    """Rules engine worker for processing transaction rules"""
    
    def __init__(self):
        self.db_pool: Optional[asyncpg.Pool] = None
        self.redis_client: Optional[redis.Redis] = None
        
        # Configuration
        self.cache_ttl = 3600  # 1 hour
        self.rules_cache_prefix = "rules:"
        
        # Supported fields for conditions
        self.supported_fields = {
            "merchant_name": str,
            "description": str,
            "amount": float,
            "currency": str,
            "category_id": int,
            "category_name": str,
            "merchant_mcc": str,
            "merchant_country": str,
            "date": datetime,
            "day_of_week": int,
            "month": int,
            "year": int,
            "is_transfer": bool,
            "is_recurring": bool,
            "is_income": bool,
            "income_type": str
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
        
        logger.info("Rules Worker connected to database and Redis")
    
    async def disconnect(self):
        """Disconnect from services"""
        if self.db_pool:
            await self.db_pool.close()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("Rules Worker disconnected")
    
    def extract_field_value(self, transaction: Dict, field: str) -> Any:
        """Extract field value from transaction"""
        if field not in self.supported_fields:
            return None
        
        # Direct field access
        if field in transaction:
            return transaction[field]
        
        # Computed fields
        if field == "day_of_week" and "date" in transaction:
            date = transaction["date"]
            if isinstance(date, str):
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            return date.weekday()
        
        elif field == "month" and "date" in transaction:
            date = transaction["date"]
            if isinstance(date, str):
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            return date.month
        
        elif field == "year" and "date" in transaction:
            date = transaction["date"]
            if isinstance(date, str):
                date = datetime.fromisoformat(date.replace('Z', '+00:00'))
            return date.year
        
        return None
    
    def evaluate_condition(self, transaction: Dict, condition: RuleCondition) -> bool:
        """Evaluate a single condition against a transaction"""
        field_value = self.extract_field_value(transaction, condition.field)
        
        if field_value is None:
            return False
        
        # Convert values for comparison
        if condition.field in ["amount", "category_id", "day_of_week", "month", "year"]:
            try:
                field_value = float(field_value) if condition.field == "amount" else int(field_value)
                condition_value = float(condition.value) if condition.field == "amount" else int(condition.value)
            except (ValueError, TypeError):
                return False
        elif condition.field in ["is_transfer", "is_recurring", "is_income"]:
            field_value = bool(field_value)
            condition_value = bool(condition.value)
        else:
            # String comparison
            field_value = str(field_value).lower() if not condition.case_sensitive else str(field_value)
            condition_value = str(condition.value).lower() if not condition.case_sensitive else str(condition.value)
        
        # Apply operator
        if condition.operator == RuleOperator.EQUALS:
            return field_value == condition_value
        
        elif condition.operator == RuleOperator.NOT_EQUALS:
            return field_value != condition_value
        
        elif condition.operator == RuleOperator.CONTAINS:
            return condition_value in field_value
        
        elif condition.operator == RuleOperator.NOT_CONTAINS:
            return condition_value not in field_value
        
        elif condition.operator == RuleOperator.GREATER_THAN:
            return field_value > condition_value
        
        elif condition.operator == RuleOperator.LESS_THAN:
            return field_value < condition_value
        
        elif condition.operator == RuleOperator.GREATER_EQUAL:
            return field_value >= condition_value
        
        elif condition.operator == RuleOperator.LESS_EQUAL:
            return field_value <= condition_value
        
        elif condition.operator == RuleOperator.BETWEEN:
            if isinstance(condition.value, (list, tuple)) and len(condition.value) == 2:
                min_val, max_val = condition.value
                return min_val <= field_value <= max_val
            return False
        
        elif condition.operator == RuleOperator.NOT_BETWEEN:
            if isinstance(condition.value, (list, tuple)) and len(condition.value) == 2:
                min_val, max_val = condition.value
                return not (min_val <= field_value <= max_val)
            return False
        
        elif condition.operator == RuleOperator.REGEX:
            try:
                return bool(re.search(condition_value, str(field_value), re.IGNORECASE))
            except re.error:
                return False
        
        elif condition.operator == RuleOperator.NOT_REGEX:
            try:
                return not bool(re.search(condition_value, str(field_value), re.IGNORECASE))
            except re.error:
                return False
        
        elif condition.operator == RuleOperator.IN:
            if isinstance(condition.value, (list, tuple)):
                return field_value in condition.value
            return False
        
        elif condition.operator == RuleOperator.NOT_IN:
            if isinstance(condition.value, (list, tuple)):
                return field_value not in condition.value
            return False
        
        return False
    
    def evaluate_rule(self, transaction: Dict, rule: Rule) -> Tuple[bool, List[str]]:
        """Evaluate a rule against a transaction"""
        matched_conditions = []
        
        # All conditions must match (AND logic)
        for condition in rule.conditions:
            if self.evaluate_condition(transaction, condition):
                matched_conditions.append(f"{condition.field} {condition.operator.value} {condition.value}")
            else:
                return False, []
        
        return True, matched_conditions
    
    async def apply_action(self, transaction: Dict, action: RuleAction) -> str:
        """Apply a rule action to a transaction"""
        try:
            if action.type == ActionType.SET_CATEGORY:
                category_id = action.value
                transaction["category_id"] = category_id
                transaction["category_name"] = await self.get_category_name(category_id)
                return f"Set category to {transaction['category_name']}"
            
            elif action.type == ActionType.SET_TAG:
                tag = action.value
                if "tags" not in transaction:
                    transaction["tags"] = []
                if tag not in transaction["tags"]:
                    transaction["tags"].append(tag)
                return f"Added tag: {tag}"
            
            elif action.type == ActionType.SET_NOTE:
                note = action.value
                transaction["notes"] = note
                return f"Set note: {note}"
            
            elif action.type == ActionType.EXCLUDE:
                transaction["excluded"] = True
                return "Excluded transaction"
            
            elif action.type == ActionType.SPLIT:
                # Split transaction into multiple parts
                if action.parameters and "splits" in action.parameters:
                    splits = action.parameters["splits"]
                    transaction["splits"] = splits
                    return f"Split into {len(splits)} parts"
                return "Split transaction"
            
            elif action.type == ActionType.ALERT:
                # Create alert
                alert_message = action.value
                transaction["alerts"] = transaction.get("alerts", [])
                transaction["alerts"].append(alert_message)
                return f"Created alert: {alert_message}"
            
            return "Unknown action"
        
        except Exception as e:
            logger.error(f"Error applying action {action.type}: {e}")
            return f"Error applying action: {str(e)}"
    
    async def get_category_name(self, category_id: int) -> str:
        """Get category name by ID"""
        if not self.db_pool:
            return "Unknown"
        
        try:
            row = await self.db_pool.fetchrow("""
                SELECT name FROM categories WHERE id = $1
            """, category_id)
            
            return row["name"] if row else "Unknown"
        except Exception as e:
            logger.error(f"Error getting category name: {e}")
            return "Unknown"
    
    async def get_rules(self, household_id: int) -> List[Rule]:
        """Get all active rules for a household"""
        if not self.db_pool:
            return []
        
        try:
            rows = await self.db_pool.fetch("""
                SELECT id, household_id, name, description, conditions, actions, 
                       priority, is_active, is_retroactive, created_at
                FROM rules
                WHERE household_id = $1 AND is_active = true
                ORDER BY priority DESC, created_at DESC
            """, household_id)
            
            rules = []
            for row in rows:
                # Parse conditions and actions from JSON
                conditions_data = json.loads(row["conditions"]) if row["conditions"] else []
                actions_data = json.loads(row["actions"]) if row["actions"] else []
                
                conditions = []
                for cond_data in conditions_data:
                    conditions.append(RuleCondition(
                        field=cond_data["field"],
                        operator=RuleOperator(cond_data["operator"]),
                        value=cond_data["value"],
                        case_sensitive=cond_data.get("case_sensitive", False)
                    ))
                
                actions = []
                for action_data in actions_data:
                    actions.append(RuleAction(
                        type=ActionType(action_data["type"]),
                        value=action_data["value"],
                        parameters=action_data.get("parameters")
                    ))
                
                rules.append(Rule(
                    id=row["id"],
                    household_id=row["household_id"],
                    name=row["name"],
                    description=row["description"],
                    conditions=conditions,
                    actions=actions,
                    priority=row["priority"],
                    is_active=row["is_active"],
                    is_retroactive=row["is_retroactive"],
                    created_at=row["created_at"].isoformat() if row["created_at"] else None
                ))
            
            return rules
        
        except Exception as e:
            logger.error(f"Error getting rules: {e}")
            return []
    
    async def process_transaction_rules(self, transaction: Dict, household_id: int) -> List[RuleMatch]:
        """Process rules for a single transaction"""
        # Check cache first
        cache_key = f"{self.rules_cache_prefix}{transaction['id']}"
        if self.redis_client:
            cached = await self.redis_client.get(cache_key)
            if cached:
                cached_data = json.loads(cached)
                return [RuleMatch(**match_data) for match_data in cached_data]
        
        # Get rules for household
        rules = await self.get_rules(household_id)
        
        matches = []
        
        for rule in rules:
            # Evaluate rule
            is_match, matched_conditions = self.evaluate_rule(transaction, rule)
            
            if is_match:
                # Apply actions
                actions_applied = []
                for action in rule.actions:
                    action_result = await self.apply_action(transaction, action)
                    actions_applied.append(action_result)
                
                # Create match result
                match = RuleMatch(
                    rule_id=rule.id,
                    rule_name=rule.name,
                    matched_conditions=matched_conditions,
                    actions_applied=actions_applied,
                    confidence=1.0  # Rules are deterministic
                )
                
                matches.append(match)
        
        # Cache the results
        if self.redis_client:
            await self.redis_client.setex(
                cache_key,
                self.cache_ttl,
                json.dumps([{
                    "rule_id": match.rule_id,
                    "rule_name": match.rule_name,
                    "matched_conditions": match.matched_conditions,
                    "actions_applied": match.actions_applied,
                    "confidence": match.confidence
                } for match in matches])
            )
        
        return matches
    
    async def process_batch_rules(self, transactions: List[Dict], household_id: int) -> List[Dict]:
        """Process rules for a batch of transactions"""
        if not transactions:
            return transactions
        
        processed_transactions = []
        
        for transaction in transactions:
            try:
                # Process rules
                rule_matches = await self.process_transaction_rules(transaction, household_id)
                
                # Update transaction with rule results
                transaction["rule_matches"] = [
                    {
                        "rule_id": match.rule_id,
                        "rule_name": match.rule_name,
                        "matched_conditions": match.matched_conditions,
                        "actions_applied": match.actions_applied,
                        "confidence": match.confidence
                    }
                    for match in rule_matches
                ]
                
                transaction["rules_applied"] = len(rule_matches)
                
            except Exception as e:
                logger.error(f"Error processing rules for transaction {transaction.get('id')}: {e}")
                transaction["rule_matches"] = []
                transaction["rules_applied"] = 0
            
            processed_transactions.append(transaction)
        
        return processed_transactions
    
    async def create_rule(self, household_id: int, name: str, conditions: List[Dict], 
                         actions: List[Dict], priority: int = 1, description: Optional[str] = None,
                         is_retroactive: bool = False) -> int:
        """Create a new rule"""
        if not self.db_pool:
            return 0
        
        try:
            row = await self.db_pool.fetchrow("""
                INSERT INTO rules (household_id, name, description, conditions, actions, 
                                 priority, is_active, is_retroactive)
                VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                RETURNING id
            """, household_id, name, description, json.dumps(conditions), 
                 json.dumps(actions), priority, is_retroactive)
            
            rule_id = row["id"]
            logger.info(f"Created rule: {name} (ID: {rule_id})")
            
            # Clear cache for this household
            if self.redis_client:
                pattern = f"{self.rules_cache_prefix}*"
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
            
            return rule_id
        
        except Exception as e:
            logger.error(f"Error creating rule: {e}")
            return 0
    
    async def update_rule(self, rule_id: int, name: Optional[str] = None, 
                         conditions: Optional[List[Dict]] = None,
                         actions: Optional[List[Dict]] = None, 
                         priority: Optional[int] = None,
                         description: Optional[str] = None,
                         is_active: Optional[bool] = None,
                         is_retroactive: Optional[bool] = None) -> bool:
        """Update an existing rule"""
        if not self.db_pool:
            return False
        
        try:
            # Build update query dynamically
            updates = []
            params = []
            param_count = 1
            
            if name is not None:
                updates.append(f"name = ${param_count}")
                params.append(name)
                param_count += 1
            
            if description is not None:
                updates.append(f"description = ${param_count}")
                params.append(description)
                param_count += 1
            
            if conditions is not None:
                updates.append(f"conditions = ${param_count}")
                params.append(json.dumps(conditions))
                param_count += 1
            
            if actions is not None:
                updates.append(f"actions = ${param_count}")
                params.append(json.dumps(actions))
                param_count += 1
            
            if priority is not None:
                updates.append(f"priority = ${param_count}")
                params.append(priority)
                param_count += 1
            
            if is_active is not None:
                updates.append(f"is_active = ${param_count}")
                params.append(is_active)
                param_count += 1
            
            if is_retroactive is not None:
                updates.append(f"is_retroactive = ${param_count}")
                params.append(is_retroactive)
                param_count += 1
            
            updates.append(f"updated_at = NOW()")
            
            if not updates:
                return True  # No updates to make
            
            query = f"UPDATE rules SET {', '.join(updates)} WHERE id = ${param_count}"
            params.append(rule_id)
            
            await self.db_pool.execute(query, *params)
            
            # Clear cache
            if self.redis_client:
                pattern = f"{self.rules_cache_prefix}*"
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
            
            logger.info(f"Updated rule ID: {rule_id}")
            return True
        
        except Exception as e:
            logger.error(f"Error updating rule: {e}")
            return False
    
    async def delete_rule(self, rule_id: int) -> bool:
        """Delete a rule"""
        if not self.db_pool:
            return False
        
        try:
            await self.db_pool.execute("DELETE FROM rules WHERE id = $1", rule_id)
            
            # Clear cache
            if self.redis_client:
                pattern = f"{self.rules_cache_prefix}*"
                keys = await self.redis_client.keys(pattern)
                if keys:
                    await self.redis_client.delete(*keys)
            
            logger.info(f"Deleted rule ID: {rule_id}")
            return True
        
        except Exception as e:
            logger.error(f"Error deleting rule: {e}")
            return False
    
    async def apply_rules_retroactively(self, household_id: int, rule_id: Optional[int] = None) -> int:
        """Apply rules retroactively to existing transactions"""
        if not self.db_pool:
            return 0
        
        try:
            # Get retroactive rules
            query = """
                SELECT id FROM rules 
                WHERE household_id = $1 AND is_active = true AND is_retroactive = true
            """
            params = [household_id]
            
            if rule_id:
                query += " AND id = $2"
                params.append(rule_id)
            
            rules = await self.db_pool.fetch(query, *params)
            
            if not rules:
                return 0
            
            # Get transactions to process
            transactions_query = """
                SELECT id, amount, date, merchant_name, description, category_id, 
                       merchant_mcc, merchant_country, is_transfer, is_recurring, is_income
                FROM transactions
                WHERE household_id = $1
                ORDER BY date DESC
                LIMIT 10000
            """
            
            rows = await self.db_pool.fetch(transactions_query, household_id)
            
            processed_count = 0
            
            for row in rows:
                transaction = dict(row)
                
                # Process rules for this transaction
                rule_matches = await self.process_transaction_rules(transaction, household_id)
                
                if rule_matches:
                    # Update transaction with rule results
                    await self.db_pool.execute("""
                        UPDATE transactions 
                        SET rule_matches = $1, rules_applied = $2, updated_at = NOW()
                        WHERE id = $3
                    """, json.dumps([{
                        "rule_id": match.rule_id,
                        "rule_name": match.rule_name,
                        "matched_conditions": match.matched_conditions,
                        "actions_applied": match.actions_applied,
                        "confidence": match.confidence
                    } for match in rule_matches]), len(rule_matches), transaction["id"])
                    
                    processed_count += 1
            
            logger.info(f"Applied rules retroactively to {processed_count} transactions")
            return processed_count
        
        except Exception as e:
            logger.error(f"Error applying rules retroactively: {e}")
            return 0
    
    async def get_rule_statistics(self, household_id: int) -> Dict:
        """Get rule usage statistics"""
        if not self.db_pool:
            return {}
        
        try:
            # Get rule statistics
            stats = await self.db_pool.fetchrow("""
                SELECT 
                    COUNT(*) as total_rules,
                    COUNT(CASE WHEN is_active = true THEN 1 END) as active_rules,
                    COUNT(CASE WHEN is_retroactive = true THEN 1 END) as retroactive_rules,
                    AVG(rules_applied) as avg_rules_per_transaction
                FROM rules r
                LEFT JOIN transactions t ON r.household_id = t.household_id
                WHERE r.household_id = $1
            """, household_id)
            
            return {
                "total_rules": stats["total_rules"] or 0,
                "active_rules": stats["active_rules"] or 0,
                "retroactive_rules": stats["retroactive_rules"] or 0,
                "avg_rules_per_transaction": float(stats["avg_rules_per_transaction"] or 0)
            }
        
        except Exception as e:
            logger.error(f"Error getting rule statistics: {e}")
            return {}
    
    async def run_batch_processing(self, household_id: int):
        """Run batch processing for rules"""
        if not self.db_pool:
            return
        
        try:
            # Get unprocessed transactions
            rows = await self.db_pool.fetch("""
                SELECT id, amount, date, merchant_name, description, category_id, 
                       merchant_mcc, merchant_country, is_transfer, is_recurring, is_income
                FROM transactions
                WHERE household_id = $1 
                AND rule_matches IS NULL
                ORDER BY date DESC
                LIMIT 1000
            """, household_id)
            
            if not rows:
                return
            
            # Process rules
            transactions = [dict(row) for row in rows]
            processed_transactions = await self.process_batch_rules(transactions, household_id)
            
            # Update database
            for transaction in processed_transactions:
                await self.db_pool.execute("""
                    UPDATE transactions 
                    SET rule_matches = $1,
                        rules_applied = $2,
                        updated_at = NOW()
                    WHERE id = $3
                """, json.dumps(transaction["rule_matches"]), 
                     transaction["rules_applied"], transaction["id"])
            
            logger.info(f"Processed {len(processed_transactions)} transactions for rules")
        
        except Exception as e:
            logger.error(f"Error in batch processing: {e}")
    
    async def run(self):
        """Main worker loop"""
        await self.connect()
        
        try:
            logger.info("Rules Worker started")
            
            # Keep the worker running
            while True:
                # Get all households
                if self.db_pool:
                    households = await self.db_pool.fetch("SELECT id FROM households")
                    
                    for household in households:
                        await self.run_batch_processing(household["id"])
                
                await asyncio.sleep(300)  # Run every 5 minutes
                
        except KeyboardInterrupt:
            logger.info("Rules Worker stopped by user")
        except Exception as e:
            logger.error(f"Rules Worker error: {e}")
        finally:
            await self.disconnect()

async def main():
    """Main entry point"""
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    
    worker = RulesWorker()
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())
