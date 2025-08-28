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
import hashlib
from dataclasses import dataclass
from enum import Enum
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

logger = logging.getLogger(__name__)

class AlertType(Enum):
    BUDGET_BREACH = "budget_breach"
    LOW_BALANCE = "low_balance"
    UPCOMING_BILL = "upcoming_bill"
    ANOMALY = "anomaly"
    FORECAST_WARNING = "forecast_warning"
    GOAL_MILESTONE = "goal_milestone"

class AlertSeverity(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class AlertStatus(Enum):
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"
    SNOOZED = "snoozed"

class DeliveryMethod(Enum):
    EMAIL = "email"
    PUSH = "push"
    WEBHOOK = "webhook"
    IN_APP = "in_app"

@dataclass
class Alert:
    id: str
    household_id: str
    alert_type: AlertType
    severity: AlertSeverity
    status: AlertStatus
    title: str
    message: str
    entity_id: Optional[str] = None
    entity_type: Optional[str] = None
    amount: Optional[float] = None
    threshold: Optional[float] = None
    due_date: Optional[datetime] = None
    metadata: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    snoozed_until: Optional[datetime] = None

@dataclass
class AlertConfig:
    household_id: str
    alert_type: AlertType
    enabled: bool = True
    delivery_methods: List[DeliveryMethod] = None
    thresholds: Dict[str, float] = None
    snooze_duration_hours: int = 24
    deduplication_window_hours: int = 6

class AlertsWorker:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # Default configuration
        self.default_thresholds = {
            'budget_breach_percentage': 90.0,  # Alert when 90% of budget is used
            'low_balance_amount': 100.0,  # Alert when balance drops below $100
            'upcoming_bill_days': 3,  # Alert 3 days before bill is due
            'anomaly_confidence': 0.7,  # Alert for anomalies with confidence > 70%
        }
        
        # Email configuration (would be loaded from environment)
        self.email_config = {
            'smtp_server': os.getenv('SMTP_SERVER', 'smtp.gmail.com'),
            'smtp_port': int(os.getenv('SMTP_PORT', '587')),
            'username': os.getenv('EMAIL_USERNAME', ''),
            'password': os.getenv('EMAIL_PASSWORD', ''),
            'from_email': os.getenv('FROM_EMAIL', 'alerts@financeapp.com')
        }
        
    async def check_budget_alerts(self, household_id: str) -> List[Alert]:
        """Check for budget breach alerts"""
        alerts = []
        
        query = """
        SELECT 
            b.id, b.name, b.period, b.buffer,
            bl.category_id, bl.amount as budget_amount,
            c.name as category_name,
            COALESCE(SUM(ABS(t.amount)), 0) as spent_amount
        FROM budgets b
        JOIN budget_lines bl ON b.id = bl.budget_id
        LEFT JOIN categories c ON bl.category_id = c.id
        LEFT JOIN transactions t ON t.category_id = bl.category_id 
            AND t.date >= DATE_TRUNC('month', CURRENT_DATE)
            AND t.amount < 0 AND t.is_transfer = false
        WHERE b.household_id = :household_id
        AND b.is_active = true
        GROUP BY b.id, b.name, b.period, b.buffer, bl.category_id, bl.amount, c.name
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            for row in result.fetchall():
                budget_amount = row.budget_amount
                spent_amount = row.spent_amount
                
                if budget_amount > 0:
                    percentage_used = (spent_amount / budget_amount) * 100
                    
                    # Check for budget breach
                    if percentage_used >= self.default_thresholds['budget_breach_percentage']:
                        severity = self._calculate_budget_severity(percentage_used)
                        
                        alert = Alert(
                            id=f"budget_{row.id}_{row.category_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                            household_id=household_id,
                            alert_type=AlertType.BUDGET_BREACH,
                            severity=severity,
                            status=AlertStatus.ACTIVE,
                            title=f"Budget Alert: {row.category_name}",
                            message=f"Budget for {row.category_name} is {percentage_used:.1f}% used (${spent_amount:.2f} of ${budget_amount:.2f})",
                            entity_id=row.category_id,
                            entity_type='category',
                            amount=spent_amount,
                            threshold=budget_amount,
                            metadata={
                                'percentage_used': percentage_used,
                                'budget_name': row.name,
                                'period': row.period
                            },
                            created_at=datetime.now()
                        )
                        
                        alerts.append(alert)
        
        return alerts
    
    async def check_balance_alerts(self, household_id: str) -> List[Alert]:
        """Check for low balance alerts"""
        alerts = []
        
        query = """
        SELECT 
            a.id, a.name, a.balance, a.currency, a.type
        FROM accounts a
        WHERE a.household_id = :household_id
        AND a.is_active = true
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            for row in result.fetchall():
                balance = row.balance
                threshold = self.default_thresholds['low_balance_amount']
                
                if balance < threshold:
                    severity = self._calculate_balance_severity(balance, threshold)
                    
                    alert = Alert(
                        id=f"balance_{row.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                        household_id=household_id,
                        alert_type=AlertType.LOW_BALANCE,
                        severity=severity,
                        status=AlertStatus.ACTIVE,
                        title=f"Low Balance Alert: {row.name}",
                        message=f"Account {row.name} has low balance: ${balance:.2f} (below ${threshold:.2f})",
                        entity_id=row.id,
                        entity_type='account',
                        amount=balance,
                        threshold=threshold,
                        metadata={
                            'account_type': row.type,
                            'currency': row.currency
                        },
                        created_at=datetime.now()
                    )
                    
                    alerts.append(alert)
        
        return alerts
    
    async def check_bill_alerts(self, household_id: str) -> List[Alert]:
        """Check for upcoming bill alerts"""
        alerts = []
        
        query = """
        SELECT 
            bp.id, bp.merchant_name, bp.expected_amount, bp.expected_date,
            bp.days_until_due, bp.risk_score, bp.category_name
        FROM bill_predictions bp
        WHERE bp.household_id = :household_id
        AND bp.status = 'due_soon'
        AND bp.expected_date <= CURRENT_DATE + INTERVAL ':days days'
        ORDER BY bp.expected_date
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'days': self.default_thresholds['upcoming_bill_days']
            })
            
            for row in result.fetchall():
                severity = self._calculate_bill_severity(row.days_until_due, row.risk_score)
                
                alert = Alert(
                    id=f"bill_{row.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    household_id=household_id,
                    alert_type=AlertType.UPCOMING_BILL,
                    severity=severity,
                    status=AlertStatus.ACTIVE,
                    title=f"Upcoming Bill: {row.merchant_name}",
                    message=f"Bill due in {row.days_until_due} days: {row.merchant_name} - ${row.expected_amount:.2f}",
                    entity_id=row.id,
                    entity_type='bill',
                    amount=row.expected_amount,
                    due_date=row.expected_date,
                    metadata={
                        'days_until_due': row.days_until_due,
                        'risk_score': row.risk_score,
                        'category': row.category_name
                    },
                    created_at=datetime.now()
                )
                
                alerts.append(alert)
        
        return alerts
    
    async def check_anomaly_alerts(self, household_id: str) -> List[Alert]:
        """Check for anomaly alerts"""
        alerts = []
        
        query = """
        SELECT 
            a.id, a.anomaly_type, a.severity, a.score, a.reason,
            a.merchant_name, a.category_name, a.amount, a.date
        FROM anomalies a
        WHERE a.household_id = :household_id
        AND a.confidence >= :confidence_threshold
        AND a.created_at >= CURRENT_DATE - INTERVAL '24 hours'
        AND a.user_verdict IS NULL
        ORDER BY a.created_at DESC
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'confidence_threshold': self.default_thresholds['anomaly_confidence']
            })
            
            for row in result.fetchall():
                severity = AlertSeverity(row.severity)
                
                alert = Alert(
                    id=f"anomaly_{row.id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    household_id=household_id,
                    alert_type=AlertType.ANOMALY,
                    severity=severity,
                    status=AlertStatus.ACTIVE,
                    title=f"Anomaly Detected: {row.anomaly_type}",
                    message=f"Unusual activity detected: {row.reason}",
                    entity_id=row.id,
                    entity_type='anomaly',
                    amount=row.amount,
                    metadata={
                        'anomaly_type': row.anomaly_type,
                        'score': row.score,
                        'merchant': row.merchant_name,
                        'category': row.category_name,
                        'date': row.date.isoformat() if row.date else None
                    },
                    created_at=datetime.now()
                )
                
                alerts.append(alert)
        
        return alerts
    
    async def generate_alerts(self, household_id: str) -> List[Alert]:
        """Generate all alerts for a household"""
        try:
            all_alerts = []
            
            # Check different alert types
            budget_alerts = await self.check_budget_alerts(household_id)
            all_alerts.extend(budget_alerts)
            
            balance_alerts = await self.check_balance_alerts(household_id)
            all_alerts.extend(balance_alerts)
            
            bill_alerts = await self.check_bill_alerts(household_id)
            all_alerts.extend(bill_alerts)
            
            anomaly_alerts = await self.check_anomaly_alerts(household_id)
            all_alerts.extend(anomaly_alerts)
            
            # Deduplicate alerts
            unique_alerts = await self._deduplicate_alerts(all_alerts)
            
            # Store alerts
            await self._store_alerts(unique_alerts)
            
            # Send alerts
            await self._send_alerts(unique_alerts)
            
            return unique_alerts
            
        except Exception as e:
            logger.error(f"Error generating alerts for household {household_id}: {str(e)}")
            raise
    
    async def _deduplicate_alerts(self, alerts: List[Alert]) -> List[Alert]:
        """Deduplicate alerts based on content and time window"""
        unique_alerts = []
        seen_hashes = set()
        
        for alert in alerts:
            # Create hash for deduplication
            content_hash = self._create_alert_hash(alert)
            
            # Check if similar alert exists in recent window
            if await self._is_duplicate_alert(alert.household_id, content_hash):
                continue
            
            seen_hashes.add(content_hash)
            unique_alerts.append(alert)
        
        return unique_alerts
    
    def _create_alert_hash(self, alert: Alert) -> str:
        """Create hash for alert deduplication"""
        content = f"{alert.alert_type.value}_{alert.entity_id}_{alert.entity_type}_{alert.amount}"
        return hashlib.md5(content.encode()).hexdigest()
    
    async def _is_duplicate_alert(self, household_id: str, content_hash: str) -> bool:
        """Check if similar alert exists in recent window"""
        query = """
        SELECT COUNT(*) as count
        FROM alerts
        WHERE household_id = :household_id
        AND content_hash = :content_hash
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL ':hours hours'
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'content_hash': content_hash,
                'hours': 6  # 6-hour deduplication window
            })
            
            count = result.fetchone().count
            return count > 0
    
    async def _store_alerts(self, alerts: List[Alert]):
        """Store alerts in database"""
        if not alerts:
            return
        
        create_table_query = """
        CREATE TABLE IF NOT EXISTS alerts (
            id VARCHAR(255) PRIMARY KEY,
            household_id VARCHAR(255) NOT NULL,
            alert_type VARCHAR(50) NOT NULL,
            severity VARCHAR(50) NOT NULL,
            status VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            entity_id VARCHAR(255),
            entity_type VARCHAR(50),
            amount DECIMAL(15,2),
            threshold DECIMAL(15,2),
            due_date TIMESTAMP,
            metadata JSONB,
            content_hash VARCHAR(32),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            acknowledged_at TIMESTAMP,
            resolved_at TIMESTAMP,
            snoozed_until TIMESTAMP
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            for alert in alerts:
                content_hash = self._create_alert_hash(alert)
                
                insert_query = """
                INSERT INTO alerts (
                    id, household_id, alert_type, severity, status, title, message,
                    entity_id, entity_type, amount, threshold, due_date, metadata,
                    content_hash, created_at
                ) VALUES (
                    :id, :household_id, :alert_type, :severity, :status, :title, :message,
                    :entity_id, :entity_type, :amount, :threshold, :due_date, :metadata,
                    :content_hash, :created_at
                )
                """
                
                session.execute(text(insert_query), {
                    'id': alert.id,
                    'household_id': alert.household_id,
                    'alert_type': alert.alert_type.value,
                    'severity': alert.severity.value,
                    'status': alert.status.value,
                    'title': alert.title,
                    'message': alert.message,
                    'entity_id': alert.entity_id,
                    'entity_type': alert.entity_type,
                    'amount': alert.amount,
                    'threshold': alert.threshold,
                    'due_date': alert.due_date,
                    'metadata': json.dumps(alert.metadata) if alert.metadata else None,
                    'content_hash': content_hash,
                    'created_at': alert.created_at
                })
            
            session.commit()
    
    async def _send_alerts(self, alerts: List[Alert]):
        """Send alerts via configured delivery methods"""
        for alert in alerts:
            try:
                # Get delivery configuration for household
                config = await self._get_alert_config(alert.household_id, alert.alert_type)
                
                if not config or not config.enabled:
                    continue
                
                # Send via each configured method
                for method in config.delivery_methods or [DeliveryMethod.IN_APP]:
                    if method == DeliveryMethod.EMAIL:
                        await self._send_email_alert(alert, config)
                    elif method == DeliveryMethod.PUSH:
                        await self._send_push_alert(alert, config)
                    elif method == DeliveryMethod.WEBHOOK:
                        await self._send_webhook_alert(alert, config)
                    elif method == DeliveryMethod.IN_APP:
                        # In-app alerts are handled by the frontend
                        logger.info(f"In-app alert: {alert.title}")
                
            except Exception as e:
                logger.error(f"Error sending alert {alert.id}: {str(e)}")
    
    async def _send_email_alert(self, alert: Alert, config: AlertConfig):
        """Send alert via email"""
        try:
            # Get user email (would typically come from user profile)
            user_email = await self._get_user_email(alert.household_id)
            
            if not user_email:
                return
            
            # Create email message
            msg = MIMEMultipart()
            msg['From'] = self.email_config['from_email']
            msg['To'] = user_email
            msg['Subject'] = f"[{alert.severity.value.upper()}] {alert.title}"
            
            body = f"""
            {alert.message}
            
            Alert Details:
            - Type: {alert.alert_type.value}
            - Severity: {alert.severity.value}
            - Created: {alert.created_at}
            
            View in app: https://app.finance.com/alerts/{alert.id}
            """
            
            msg.attach(MIMEText(body, 'plain'))
            
            # Send email
            with smtplib.SMTP(self.email_config['smtp_server'], self.email_config['smtp_port']) as server:
                server.starttls()
                server.login(self.email_config['username'], self.email_config['password'])
                server.send_message(msg)
            
            logger.info(f"Email alert sent to {user_email}: {alert.title}")
            
        except Exception as e:
            logger.error(f"Error sending email alert: {str(e)}")
    
    async def _send_push_alert(self, alert: Alert, config: AlertConfig):
        """Send alert via push notification"""
        try:
            # Get push tokens for household members
            push_tokens = await self._get_push_tokens(alert.household_id)
            
            for token in push_tokens:
                # This would integrate with FCM, APNS, or similar
                # For now, just log the push notification
                logger.info(f"Push alert to {token}: {alert.title}")
            
        except Exception as e:
            logger.error(f"Error sending push alert: {str(e)}")
    
    async def _send_webhook_alert(self, alert: Alert, config: AlertConfig):
        """Send alert via webhook"""
        try:
            # Get webhook URLs for household
            webhook_urls = await self._get_webhook_urls(alert.household_id)
            
            payload = {
                'alert_id': alert.id,
                'household_id': alert.household_id,
                'type': alert.alert_type.value,
                'severity': alert.severity.value,
                'title': alert.title,
                'message': alert.message,
                'created_at': alert.created_at.isoformat() if alert.created_at else None,
                'metadata': alert.metadata
            }
            
            for url in webhook_urls:
                response = requests.post(url, json=payload, timeout=10)
                if response.status_code == 200:
                    logger.info(f"Webhook alert sent to {url}: {alert.title}")
                else:
                    logger.warning(f"Webhook alert failed for {url}: {response.status_code}")
            
        except Exception as e:
            logger.error(f"Error sending webhook alert: {str(e)}")
    
    async def acknowledge_alert(self, alert_id: str, user_id: str):
        """Acknowledge an alert"""
        query = """
        UPDATE alerts
        SET status = 'acknowledged', acknowledged_at = CURRENT_TIMESTAMP
        WHERE id = :alert_id
        """
        
        with self.Session() as session:
            session.execute(text(query), {'alert_id': alert_id})
            session.commit()
    
    async def snooze_alert(self, alert_id: str, hours: int = 24):
        """Snooze an alert"""
        snooze_until = datetime.now() + timedelta(hours=hours)
        
        query = """
        UPDATE alerts
        SET status = 'snoozed', snoozed_until = :snooze_until
        WHERE id = :alert_id
        """
        
        with self.Session() as session:
            session.execute(text(query), {
                'alert_id': alert_id,
                'snooze_until': snooze_until
            })
            session.commit()
    
    async def resolve_alert(self, alert_id: str):
        """Resolve an alert"""
        query = """
        UPDATE alerts
        SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
        WHERE id = :alert_id
        """
        
        with self.Session() as session:
            session.execute(text(query), {'alert_id': alert_id})
            session.commit()
    
    def _calculate_budget_severity(self, percentage_used: float) -> AlertSeverity:
        """Calculate severity based on budget usage percentage"""
        if percentage_used >= 100:
            return AlertSeverity.CRITICAL
        elif percentage_used >= 95:
            return AlertSeverity.HIGH
        elif percentage_used >= 90:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    def _calculate_balance_severity(self, balance: float, threshold: float) -> AlertSeverity:
        """Calculate severity based on balance vs threshold"""
        ratio = balance / threshold
        if ratio <= 0.5:
            return AlertSeverity.CRITICAL
        elif ratio <= 0.7:
            return AlertSeverity.HIGH
        elif ratio <= 0.9:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    def _calculate_bill_severity(self, days_until_due: int, risk_score: float) -> AlertSeverity:
        """Calculate severity based on days until due and risk score"""
        if days_until_due <= 0:
            return AlertSeverity.CRITICAL
        elif days_until_due <= 1 or risk_score > 0.8:
            return AlertSeverity.HIGH
        elif days_until_due <= 2 or risk_score > 0.6:
            return AlertSeverity.MEDIUM
        else:
            return AlertSeverity.LOW
    
    async def _get_alert_config(self, household_id: str, alert_type: AlertType) -> Optional[AlertConfig]:
        """Get alert configuration for household"""
        # This would typically query a configuration table
        # For now, return default configuration
        return AlertConfig(
            household_id=household_id,
            alert_type=alert_type,
            enabled=True,
            delivery_methods=[DeliveryMethod.EMAIL, DeliveryMethod.IN_APP],
            thresholds=self.default_thresholds
        )
    
    async def _get_user_email(self, household_id: str) -> Optional[str]:
        """Get user email for household"""
        # This would typically query user profile
        # For now, return a placeholder
        return "user@example.com"
    
    async def _get_push_tokens(self, household_id: str) -> List[str]:
        """Get push notification tokens for household members"""
        # This would typically query user devices
        # For now, return empty list
        return []
    
    async def _get_webhook_urls(self, household_id: str) -> List[str]:
        """Get webhook URLs for household"""
        # This would typically query webhook configuration
        # For now, return empty list
        return []

async def main():
    """Main function for testing"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/finance')
    worker = AlertsWorker(db_url)
    
    # Example usage
    household_id = 'test-household'
    
    try:
        # Generate alerts
        alerts = await worker.generate_alerts(household_id)
        print(f"Generated {len(alerts)} alerts")
        
        # Acknowledge an alert
        if alerts:
            await worker.acknowledge_alert(alerts[0].id, 'test-user')
            print(f"Acknowledged alert: {alerts[0].title}")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
