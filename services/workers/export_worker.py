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
import boto3
from botocore.exceptions import ClientError
from dataclasses import dataclass
from enum import Enum
import tempfile
import zipfile
import hashlib

logger = logging.getLogger(__name__)

class ExportFormat(Enum):
    JSON = "json"
    CSV = "csv"
    ZIP = "zip"

class ExportType(Enum):
    FULL_HOUSEHOLD = "full_household"
    TRANSACTIONS_ONLY = "transactions_only"
    BUDGETS_ONLY = "budgets_only"
    REPORTS_ONLY = "reports_only"
    CUSTOM = "custom"

@dataclass
class ExportRequest:
    id: str
    household_id: str
    export_type: ExportType
    export_format: ExportFormat
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    include_metadata: bool = True
    include_attachments: bool = False
    password_protected: bool = False
    created_at: Optional[datetime] = None

@dataclass
class ExportResult:
    id: str
    household_id: str
    export_type: ExportType
    export_format: ExportFormat
    file_path: str
    file_size: int
    checksum: str
    s3_url: Optional[str] = None
    signed_url: Optional[str] = None
    expires_at: Optional[datetime] = None
    record_count: Dict[str, int] = None
    created_at: Optional[datetime] = None

class ExportWorker:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # S3 configuration
        self.s3_client = boto3.client(
            's3',
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
            region_name=os.getenv('AWS_REGION', 'us-east-1')
        )
        self.s3_bucket = os.getenv('S3_EXPORTS_BUCKET', 'finance-exports')
        
        # Export configuration
        self.export_templates = {
            ExportType.FULL_HOUSEHOLD: self._export_full_household,
            ExportType.TRANSACTIONS_ONLY: self._export_transactions_only,
            ExportType.BUDGETS_ONLY: self._export_budgets_only,
            ExportType.REPORTS_ONLY: self._export_reports_only,
            ExportType.CUSTOM: self._export_custom
        }
    
    async def export_data(self, request: ExportRequest) -> ExportResult:
        """Export data based on the request"""
        try:
            # Get export data
            data = await self._get_export_data(request)
            
            # Generate export file
            file_path = await self._generate_export_file(request, data)
            
            # Calculate checksum
            checksum = self._calculate_checksum(file_path)
            
            # Get file size
            file_size = os.path.getsize(file_path)
            
            # Upload to S3
            s3_url = await self._upload_to_s3(file_path, request)
            
            # Generate signed URL
            signed_url = await self._generate_signed_url(s3_url, request.export_format)
            
            # Create export result
            result = ExportResult(
                id=request.id,
                household_id=request.household_id,
                export_type=request.export_type,
                export_format=request.export_format,
                file_path=file_path,
                file_size=file_size,
                checksum=checksum,
                s3_url=s3_url,
                signed_url=signed_url,
                expires_at=datetime.now() + timedelta(hours=24),  # 24-hour expiry
                record_count=data.get('record_count', {}),
                created_at=datetime.now()
            )
            
            # Store export metadata
            await self._store_export_metadata(result)
            
            # Clean up local file
            os.remove(file_path)
            
            return result
            
        except Exception as e:
            logger.error(f"Error exporting data {request.id}: {str(e)}")
            raise
    
    async def _get_export_data(self, request: ExportRequest) -> Dict[str, Any]:
        """Get data for export based on export type"""
        data = {}
        record_count = {}
        
        # Get the appropriate export function
        export_func = self.export_templates.get(request.export_type)
        if not export_func:
            raise ValueError(f"Unknown export type: {request.export_type}")
        
        # Execute export function
        export_data = await export_func(request)
        data.update(export_data)
        
        # Add metadata if requested
        if request.include_metadata:
            data['metadata'] = await self._get_export_metadata(request)
        
        # Count records
        for key, value in data.items():
            if isinstance(value, list):
                record_count[key] = len(value)
            elif isinstance(value, dict) and 'data' in value:
                record_count[key] = len(value['data'])
        
        data['record_count'] = record_count
        
        return data
    
    async def _export_full_household(self, request: ExportRequest) -> Dict[str, Any]:
        """Export full household data"""
        data = {}
        
        # Get household info
        data['household'] = await self._get_household_info(request.household_id)
        
        # Get accounts
        data['accounts'] = await self._get_accounts(request.household_id)
        
        # Get categories
        data['categories'] = await self._get_categories(request.household_id)
        
        # Get transactions
        data['transactions'] = await self._get_transactions(
            request.household_id, request.date_from, request.date_to
        )
        
        # Get budgets
        data['budgets'] = await self._get_budgets(request.household_id)
        
        # Get goals
        data['goals'] = await self._get_goals(request.household_id)
        
        # Get forecasts
        data['forecasts'] = await self._get_forecasts(request.household_id)
        
        # Get anomalies
        data['anomalies'] = await self._get_anomalies(
            request.household_id, request.date_from, request.date_to
        )
        
        # Get rules
        data['rules'] = await self._get_rules(request.household_id)
        
        # Get reports
        data['reports'] = await self._get_reports(request.household_id)
        
        # Get alerts
        data['alerts'] = await self._get_alerts(
            request.household_id, request.date_from, request.date_to
        )
        
        return data
    
    async def _export_transactions_only(self, request: ExportRequest) -> Dict[str, Any]:
        """Export transactions only"""
        data = {}
        
        # Get household info
        data['household'] = await self._get_household_info(request.household_id)
        
        # Get transactions
        data['transactions'] = await self._get_transactions(
            request.household_id, request.date_from, request.date_to
        )
        
        # Get categories for reference
        data['categories'] = await self._get_categories(request.household_id)
        
        return data
    
    async def _export_budgets_only(self, request: ExportRequest) -> Dict[str, Any]:
        """Export budgets only"""
        data = {}
        
        # Get household info
        data['household'] = await self._get_household_info(request.household_id)
        
        # Get budgets
        data['budgets'] = await self._get_budgets(request.household_id)
        
        # Get categories for reference
        data['categories'] = await self._get_categories(request.household_id)
        
        return data
    
    async def _export_reports_only(self, request: ExportRequest) -> Dict[str, Any]:
        """Export reports only"""
        data = {}
        
        # Get household info
        data['household'] = await self._get_household_info(request.household_id)
        
        # Get reports
        data['reports'] = await self._get_reports(request.household_id)
        
        return data
    
    async def _export_custom(self, request: ExportRequest) -> Dict[str, Any]:
        """Export custom selection (placeholder for future implementation)"""
        data = {}
        
        # Get household info
        data['household'] = await self._get_household_info(request.household_id)
        
        # This would be customized based on user selection
        # For now, return basic data
        data['accounts'] = await self._get_accounts(request.household_id)
        data['categories'] = await self._get_categories(request.household_id)
        
        return data
    
    async def _get_household_info(self, household_id: str) -> Dict[str, Any]:
        """Get household information"""
        query = """
        SELECT 
            h.id, h.name, h.created_at, h.updated_at,
            COUNT(DISTINCT a.id) as account_count,
            COUNT(DISTINCT m.user_id) as member_count
        FROM households h
        LEFT JOIN accounts a ON h.id = a.household_id AND a.is_active = true
        LEFT JOIN memberships m ON h.id = m.household_id
        WHERE h.id = :household_id
        GROUP BY h.id, h.name, h.created_at, h.updated_at
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            row = result.fetchone()
            
            return {
                'id': row.id,
                'name': row.name,
                'created_at': row.created_at.isoformat() if row.created_at else None,
                'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                'account_count': row.account_count,
                'member_count': row.member_count
            }
    
    async def _get_accounts(self, household_id: str) -> List[Dict[str, Any]]:
        """Get accounts for household"""
        query = """
        SELECT 
            id, name, type, balance, currency, is_active, created_at, updated_at
        FROM accounts
        WHERE household_id = :household_id
        ORDER BY name
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            accounts = []
            for row in result.fetchall():
                accounts.append({
                    'id': row.id,
                    'name': row.name,
                    'type': row.type,
                    'balance': float(row.balance),
                    'currency': row.currency,
                    'is_active': row.is_active,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None
                })
        
        return accounts
    
    async def _get_categories(self, household_id: str) -> List[Dict[str, Any]]:
        """Get categories for household"""
        query = """
        SELECT 
            id, name, parent_id, color, icon, is_active, created_at, updated_at
        FROM categories
        WHERE household_id = :household_id OR household_id IS NULL
        ORDER BY name
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            categories = []
            for row in result.fetchall():
                categories.append({
                    'id': row.id,
                    'name': row.name,
                    'parent_id': row.parent_id,
                    'color': row.color,
                    'icon': row.icon,
                    'is_active': row.is_active,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None
                })
        
        return categories
    
    async def _get_transactions(self, household_id: str, date_from: Optional[datetime], 
                              date_to: Optional[datetime]) -> List[Dict[str, Any]]:
        """Get transactions for household"""
        query = """
        SELECT 
            t.id, t.date, t.amount, t.description, t.merchant_name,
            t.category_id, t.account_id, t.is_transfer, t.created_at, t.updated_at,
            c.name as category_name, a.name as account_name
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE a.household_id = :household_id
        """
        
        params = {'household_id': household_id}
        
        if date_from:
            query += " AND t.date >= :date_from"
            params['date_from'] = date_from
        
        if date_to:
            query += " AND t.date <= :date_to"
            params['date_to'] = date_to
        
        query += " ORDER BY t.date DESC"
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            
            transactions = []
            for row in result.fetchall():
                transactions.append({
                    'id': row.id,
                    'date': row.date.isoformat() if row.date else None,
                    'amount': float(row.amount),
                    'description': row.description,
                    'merchant_name': row.merchant_name,
                    'category_id': row.category_id,
                    'category_name': row.category_name,
                    'account_id': row.account_id,
                    'account_name': row.account_name,
                    'is_transfer': row.is_transfer,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None
                })
        
        return transactions
    
    async def _get_budgets(self, household_id: str) -> List[Dict[str, Any]]:
        """Get budgets for household"""
        query = """
        SELECT 
            b.id, b.name, b.period, b.start_date, b.buffer, b.is_active,
            b.created_at, b.updated_at,
            bl.id as line_id, bl.category_id, bl.amount, bl.rollover,
            c.name as category_name
        FROM budgets b
        LEFT JOIN budget_lines bl ON b.id = bl.budget_id
        LEFT JOIN categories c ON bl.category_id = c.id
        WHERE b.household_id = :household_id
        ORDER BY b.created_at DESC, bl.id
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            budgets = {}
            for row in result.fetchall():
                budget_id = row.id
                
                if budget_id not in budgets:
                    budgets[budget_id] = {
                        'id': budget_id,
                        'name': row.name,
                        'period': row.period,
                        'start_date': row.start_date.isoformat() if row.start_date else None,
                        'buffer': float(row.buffer),
                        'is_active': row.is_active,
                        'created_at': row.created_at.isoformat() if row.created_at else None,
                        'updated_at': row.updated_at.isoformat() if row.updated_at else None,
                        'budget_lines': []
                    }
                
                if row.line_id:
                    budgets[budget_id]['budget_lines'].append({
                        'id': row.line_id,
                        'category_id': row.category_id,
                        'category_name': row.category_name,
                        'amount': float(row.amount),
                        'rollover': row.rollover
                    })
        
        return list(budgets.values())
    
    async def _get_goals(self, household_id: str) -> List[Dict[str, Any]]:
        """Get goals for household"""
        query = """
        SELECT 
            id, name, target_amount, target_date, account_id, current_amount,
            monthly_contribution, description, is_active, tags, created_at, updated_at
        FROM goals
        WHERE household_id = :household_id
        ORDER BY created_at DESC
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            goals = []
            for row in result.fetchall():
                goals.append({
                    'id': row.id,
                    'name': row.name,
                    'target_amount': float(row.target_amount),
                    'target_date': row.target_date.isoformat() if row.target_date else None,
                    'account_id': row.account_id,
                    'current_amount': float(row.current_amount),
                    'monthly_contribution': float(row.monthly_contribution) if row.monthly_contribution else None,
                    'description': row.description,
                    'is_active': row.is_active,
                    'tags': row.tags if row.tags else [],
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None
                })
        
        return goals
    
    async def _get_forecasts(self, household_id: str) -> List[Dict[str, Any]]:
        """Get forecasts for household"""
        query = """
        SELECT 
            entity_type, entity_id, forecast_date, forecast_amount,
            p50_lower, p50_upper, p90_lower, p90_upper, confidence, model_used
        FROM forecasts
        WHERE household_id = :household_id
        ORDER BY forecast_date
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            forecasts = []
            for row in result.fetchall():
                forecasts.append({
                    'entity_type': row.entity_type,
                    'entity_id': row.entity_id,
                    'forecast_date': row.forecast_date.isoformat() if row.forecast_date else None,
                    'forecast_amount': float(row.forecast_amount),
                    'p50_lower': float(row.p50_lower),
                    'p50_upper': float(row.p50_upper),
                    'p90_lower': float(row.p90_lower),
                    'p90_upper': float(row.p90_upper),
                    'confidence': float(row.confidence),
                    'model_used': row.model_used
                })
        
        return forecasts
    
    async def _get_anomalies(self, household_id: str, date_from: Optional[datetime],
                           date_to: Optional[datetime]) -> List[Dict[str, Any]]:
        """Get anomalies for household"""
        query = """
        SELECT 
            id, anomaly_type, severity, score, threshold, reason,
            merchant_name, category_name, amount, date, confidence,
            is_false_positive, user_verdict, created_at
        FROM anomalies
        WHERE household_id = :household_id
        """
        
        params = {'household_id': household_id}
        
        if date_from:
            query += " AND created_at >= :date_from"
            params['date_from'] = date_from
        
        if date_to:
            query += " AND created_at <= :date_to"
            params['date_to'] = date_to
        
        query += " ORDER BY created_at DESC"
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            
            anomalies = []
            for row in result.fetchall():
                anomalies.append({
                    'id': row.id,
                    'anomaly_type': row.anomaly_type,
                    'severity': row.severity,
                    'score': float(row.score),
                    'threshold': float(row.threshold),
                    'reason': row.reason,
                    'merchant_name': row.merchant_name,
                    'category_name': row.category_name,
                    'amount': float(row.amount) if row.amount else None,
                    'date': row.date.isoformat() if row.date else None,
                    'confidence': float(row.confidence),
                    'is_false_positive': row.is_false_positive,
                    'user_verdict': row.user_verdict,
                    'created_at': row.created_at.isoformat() if row.created_at else None
                })
        
        return anomalies
    
    async def _get_rules(self, household_id: str) -> List[Dict[str, Any]]:
        """Get rules for household"""
        query = """
        SELECT 
            id, name, conditions, actions, is_active, priority, created_at, updated_at
        FROM rules
        WHERE household_id = :household_id
        ORDER BY priority DESC, created_at DESC
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            rules = []
            for row in result.fetchall():
                rules.append({
                    'id': row.id,
                    'name': row.name,
                    'conditions': json.loads(row.conditions) if row.conditions else [],
                    'actions': json.loads(row.actions) if row.actions else [],
                    'is_active': row.is_active,
                    'priority': row.priority,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'updated_at': row.updated_at.isoformat() if row.updated_at else None
                })
        
        return rules
    
    async def _get_reports(self, household_id: str) -> List[Dict[str, Any]]:
        """Get reports for household"""
        query = """
        SELECT 
            id, report_type, report_format, file_size, s3_url, created_at
        FROM reports
        WHERE household_id = :household_id
        ORDER BY created_at DESC
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {'household_id': household_id})
            
            reports = []
            for row in result.fetchall():
                reports.append({
                    'id': row.id,
                    'report_type': row.report_type,
                    'report_format': row.report_format,
                    'file_size': row.file_size,
                    's3_url': row.s3_url,
                    'created_at': row.created_at.isoformat() if row.created_at else None
                })
        
        return reports
    
    async def _get_alerts(self, household_id: str, date_from: Optional[datetime],
                         date_to: Optional[datetime]) -> List[Dict[str, Any]]:
        """Get alerts for household"""
        query = """
        SELECT 
            id, alert_type, severity, status, title, message,
            entity_id, entity_type, amount, threshold, due_date,
            created_at, acknowledged_at, resolved_at
        FROM alerts
        WHERE household_id = :household_id
        """
        
        params = {'household_id': household_id}
        
        if date_from:
            query += " AND created_at >= :date_from"
            params['date_from'] = date_from
        
        if date_to:
            query += " AND created_at <= :date_to"
            params['date_to'] = date_to
        
        query += " ORDER BY created_at DESC"
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            
            alerts = []
            for row in result.fetchall():
                alerts.append({
                    'id': row.id,
                    'alert_type': row.alert_type,
                    'severity': row.severity,
                    'status': row.status,
                    'title': row.title,
                    'message': row.message,
                    'entity_id': row.entity_id,
                    'entity_type': row.entity_type,
                    'amount': float(row.amount) if row.amount else None,
                    'threshold': float(row.threshold) if row.threshold else None,
                    'due_date': row.due_date.isoformat() if row.due_date else None,
                    'created_at': row.created_at.isoformat() if row.created_at else None,
                    'acknowledged_at': row.acknowledged_at.isoformat() if row.acknowledged_at else None,
                    'resolved_at': row.resolved_at.isoformat() if row.resolved_at else None
                })
        
        return alerts
    
    async def _get_export_metadata(self, request: ExportRequest) -> Dict[str, Any]:
        """Get export metadata"""
        return {
            'export_id': request.id,
            'export_type': request.export_type.value,
            'export_format': request.export_format.value,
            'date_from': request.date_from.isoformat() if request.date_from else None,
            'date_to': request.date_to.isoformat() if request.date_to else None,
            'include_metadata': request.include_metadata,
            'include_attachments': request.include_attachments,
            'password_protected': request.password_protected,
            'exported_at': datetime.now().isoformat(),
            'version': '1.0'
        }
    
    async def _generate_export_file(self, request: ExportRequest, data: Dict[str, Any]) -> str:
        """Generate the export file"""
        if request.export_format == ExportFormat.JSON:
            return await self._generate_json_export(request, data)
        elif request.export_format == ExportFormat.CSV:
            return await self._generate_csv_export(request, data)
        elif request.export_format == ExportFormat.ZIP:
            return await self._generate_zip_export(request, data)
        else:
            raise ValueError(f"Unsupported export format: {request.export_format}")
    
    async def _generate_json_export(self, request: ExportRequest, data: Dict[str, Any]) -> str:
        """Generate JSON export file"""
        with tempfile.NamedTemporaryFile(suffix='.json', delete=False) as temp_file:
            file_path = temp_file.name
        
        with open(file_path, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        
        return file_path
    
    async def _generate_csv_export(self, request: ExportRequest, data: Dict[str, Any]) -> str:
        """Generate CSV export file"""
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_file:
            file_path = temp_file.name
        
        with zipfile.ZipFile(file_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for key, value in data.items():
                if key == 'metadata':
                    continue
                
                if isinstance(value, list) and value:
                    # Convert list to DataFrame and save as CSV
                    df = pd.DataFrame(value)
                    csv_content = df.to_csv(index=False)
                    zip_file.writestr(f"{key}.csv", csv_content)
                elif isinstance(value, dict) and 'data' in value:
                    # Handle nested data structures
                    df = pd.DataFrame(value['data'])
                    csv_content = df.to_csv(index=False)
                    zip_file.writestr(f"{key}.csv", csv_content)
        
        return file_path
    
    async def _generate_zip_export(self, request: ExportRequest, data: Dict[str, Any]) -> str:
        """Generate ZIP export file with multiple formats"""
        with tempfile.NamedTemporaryFile(suffix='.zip', delete=False) as temp_file:
            file_path = temp_file.name
        
        with zipfile.ZipFile(file_path, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            # Add JSON export
            json_content = json.dumps(data, indent=2, default=str)
            zip_file.writestr('export.json', json_content)
            
            # Add CSV files for each data type
            for key, value in data.items():
                if key in ['metadata', 'record_count']:
                    continue
                
                if isinstance(value, list) and value:
                    df = pd.DataFrame(value)
                    csv_content = df.to_csv(index=False)
                    zip_file.writestr(f"{key}.csv", csv_content)
                elif isinstance(value, dict) and 'data' in value:
                    df = pd.DataFrame(value['data'])
                    csv_content = df.to_csv(index=False)
                    zip_file.writestr(f"{key}.csv", csv_content)
            
            # Add metadata file
            metadata_content = json.dumps(data.get('metadata', {}), indent=2, default=str)
            zip_file.writestr('metadata.json', metadata_content)
        
        return file_path
    
    def _calculate_checksum(self, file_path: str) -> str:
        """Calculate SHA256 checksum of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
    
    async def _upload_to_s3(self, file_path: str, request: ExportRequest) -> str:
        """Upload file to S3"""
        try:
            # Generate S3 key
            now = datetime.now()
            s3_key = f"exports/{request.household_id}/{request.export_type.value}/{now.year}/{now.month:02d}/{request.id}.{request.export_format.value}"
            
            # Upload file
            with open(file_path, 'rb') as file:
                self.s3_client.upload_fileobj(
                    file,
                    self.s3_bucket,
                    s3_key,
                    ExtraArgs={'ContentType': self._get_content_type(request.export_format)}
                )
            
            # Return S3 URL
            return f"s3://{self.s3_bucket}/{s3_key}"
            
        except ClientError as e:
            logger.error(f"Error uploading to S3: {str(e)}")
            raise
    
    async def _generate_signed_url(self, s3_url: str, export_format: ExportFormat) -> str:
        """Generate signed URL for S3 object"""
        try:
            # Extract bucket and key from S3 URL
            s3_parts = s3_url.replace('s3://', '').split('/', 1)
            bucket = s3_parts[0]
            key = s3_parts[1]
            
            # Generate signed URL
            signed_url = self.s3_client.generate_presigned_url(
                'get_object',
                Params={'Bucket': bucket, 'Key': key},
                ExpiresIn=86400  # 24 hours
            )
            
            return signed_url
            
        except ClientError as e:
            logger.error(f"Error generating signed URL: {str(e)}")
            raise
    
    def _get_content_type(self, export_format: ExportFormat) -> str:
        """Get content type for export format"""
        content_types = {
            ExportFormat.JSON: 'application/json',
            ExportFormat.CSV: 'text/csv',
            ExportFormat.ZIP: 'application/zip'
        }
        return content_types.get(export_format, 'application/octet-stream')
    
    async def _store_export_metadata(self, result: ExportResult):
        """Store export metadata in database"""
        create_table_query = """
        CREATE TABLE IF NOT EXISTS exports (
            id VARCHAR(255) PRIMARY KEY,
            household_id VARCHAR(255) NOT NULL,
            export_type VARCHAR(50) NOT NULL,
            export_format VARCHAR(10) NOT NULL,
            file_path VARCHAR(500),
            file_size INTEGER,
            checksum VARCHAR(64),
            s3_url VARCHAR(500),
            signed_url VARCHAR(500),
            expires_at TIMESTAMP,
            record_count JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            insert_query = """
            INSERT INTO exports (
                id, household_id, export_type, export_format, file_path,
                file_size, checksum, s3_url, signed_url, expires_at,
                record_count, created_at
            ) VALUES (
                :id, :household_id, :export_type, :export_format, :file_path,
                :file_size, :checksum, :s3_url, :signed_url, :expires_at,
                :record_count, :created_at
            )
            """
            
            session.execute(text(insert_query), {
                'id': result.id,
                'household_id': result.household_id,
                'export_type': result.export_type.value,
                'export_format': result.export_format.value,
                'file_path': result.file_path,
                'file_size': result.file_size,
                'checksum': result.checksum,
                's3_url': result.s3_url,
                'signed_url': result.signed_url,
                'expires_at': result.expires_at,
                'record_count': json.dumps(result.record_count) if result.record_count else None,
                'created_at': result.created_at
            })
            
            session.commit()

async def main():
    """Main function for testing"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/finance')
    worker = ExportWorker(db_url)
    
    # Example usage
    request = ExportRequest(
        id='test-export-123',
        household_id='test-household',
        export_type=ExportType.FULL_HOUSEHOLD,
        export_format=ExportFormat.JSON,
        date_from=datetime.now() - timedelta(days=30),
        date_to=datetime.now()
    )
    
    try:
        # Export data
        result = await worker.export_data(request)
        print(f"Exported data: {result.signed_url}")
        print(f"Record counts: {result.record_count}")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
