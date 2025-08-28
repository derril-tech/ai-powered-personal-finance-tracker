# Created automatically by Cursor AI (2024-08-27)

import csv
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional, Union
from pathlib import Path
import pandas as pd
from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

class ImportedTransaction(BaseModel):
    date: datetime
    amount: float
    description: str
    currency: str = "USD"
    merchant_name: Optional[str] = None
    category: Optional[str] = None
    account_name: Optional[str] = None
    reference: Optional[str] = None
    metadata: Dict[str, Any] = {}

class ImportResult(BaseModel):
    transactions: List[ImportedTransaction]
    errors: List[str]
    total_rows: int
    successful_rows: int

class CSVImporter:
    def __init__(self):
        self.supported_formats = ['.csv', '.txt']
        
    def detect_delimiter(self, file_path: Path) -> str:
        """Detect CSV delimiter"""
        with open(file_path, 'r', encoding='utf-8') as f:
            sample = f.read(1024)
            
        # Try common delimiters
        delimiters = [',', ';', '\t', '|']
        for delimiter in delimiters:
            if delimiter in sample:
                return delimiter
                
        return ','  # Default to comma
    
    def parse_csv(self, file_path: Path, column_mapping: Dict[str, str]) -> ImportResult:
        """Parse CSV file with column mapping"""
        transactions = []
        errors = []
        total_rows = 0
        successful_rows = 0
        
        try:
            delimiter = self.detect_delimiter(file_path)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                total_rows = sum(1 for row in reader)
                
                # Reset file pointer
                f.seek(0)
                reader = csv.DictReader(f, delimiter=delimiter)
                
                for row_num, row in enumerate(reader, start=2):  # Start at 2 to account for header
                    try:
                        # Map columns according to mapping
                        mapped_row = {}
                        for target_field, source_column in column_mapping.items():
                            if source_column in row:
                                mapped_row[target_field] = row[source_column]
                            else:
                                mapped_row[target_field] = None
                        
                        # Parse transaction
                        transaction = self._parse_transaction_row(mapped_row, row_num)
                        if transaction:
                            transactions.append(transaction)
                            successful_rows += 1
                        else:
                            errors.append(f"Row {row_num}: Invalid transaction data")
                            
                    except Exception as e:
                        errors.append(f"Row {row_num}: {str(e)}")
                        
        except Exception as e:
            errors.append(f"File parsing error: {str(e)}")
            
        return ImportResult(
            transactions=transactions,
            errors=errors,
            total_rows=total_rows,
            successful_rows=successful_rows
        )
    
    def _parse_transaction_row(self, row: Dict[str, Any], row_num: int) -> Optional[ImportedTransaction]:
        """Parse a single transaction row"""
        try:
            # Parse date
            date_str = row.get('date')
            if not date_str:
                raise ValueError("Date is required")
                
            # Try different date formats
            date_formats = [
                '%Y-%m-%d',
                '%m/%d/%Y',
                '%d/%m/%Y',
                '%Y/%m/%d',
                '%m-%d-%Y',
                '%d-%m-%Y'
            ]
            
            parsed_date = None
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_str.strip(), fmt)
                    break
                except ValueError:
                    continue
                    
            if not parsed_date:
                raise ValueError(f"Could not parse date: {date_str}")
            
            # Parse amount
            amount_str = row.get('amount', '0')
            try:
                amount = float(amount_str.replace(',', '').replace('$', ''))
            except ValueError:
                raise ValueError(f"Could not parse amount: {amount_str}")
            
            # Get description
            description = row.get('description', '').strip()
            if not description:
                raise ValueError("Description is required")
            
            # Build transaction
            transaction = ImportedTransaction(
                date=parsed_date,
                amount=amount,
                description=description,
                currency=row.get('currency', 'USD'),
                merchant_name=row.get('merchant_name'),
                category=row.get('category'),
                account_name=row.get('account_name'),
                reference=row.get('reference'),
                metadata={
                    'import_row': row_num,
                    'original_data': row
                }
            )
            
            return transaction
            
        except Exception as e:
            logger.error(f"Error parsing row {row_num}: {e}")
            return None
    
    def get_column_preview(self, file_path: Path, num_rows: int = 5) -> Dict[str, Any]:
        """Get preview of CSV columns and sample data"""
        try:
            delimiter = self.detect_delimiter(file_path)
            
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter=delimiter)
                
                # Get column names
                columns = reader.fieldnames or []
                
                # Get sample rows
                sample_rows = []
                for i, row in enumerate(reader):
                    if i >= num_rows:
                        break
                    sample_rows.append(row)
                
                return {
                    'columns': columns,
                    'sample_rows': sample_rows,
                    'delimiter': delimiter
                }
                
        except Exception as e:
            logger.error(f"Error getting column preview: {e}")
            return {
                'columns': [],
                'sample_rows': [],
                'delimiter': ',',
                'error': str(e)
            }

class OFXImporter:
    def __init__(self):
        self.supported_formats = ['.ofx', '.qfx']
    
    def parse_ofx(self, file_path: Path) -> ImportResult:
        """Parse OFX file"""
        # TODO: Implement OFX parsing
        # This would typically:
        # 1. Parse OFX XML structure
        # 2. Extract transaction data
        # 3. Convert to ImportedTransaction format
        
        logger.warning("OFX parsing not yet implemented")
        return ImportResult(
            transactions=[],
            errors=["OFX parsing not yet implemented"],
            total_rows=0,
            successful_rows=0
        )

class QIFImporter:
    def __init__(self):
        self.supported_formats = ['.qif']
    
    def parse_qif(self, file_path: Path) -> ImportResult:
        """Parse QIF file"""
        # TODO: Implement QIF parsing
        # This would typically:
        # 1. Parse QIF format
        # 2. Extract transaction data
        # 3. Convert to ImportedTransaction format
        
        logger.warning("QIF parsing not yet implemented")
        return ImportResult(
            transactions=[],
            errors=["QIF parsing not yet implemented"],
            total_rows=0,
            successful_rows=0
        )

class MT940Importer:
    def __init__(self):
        self.supported_formats = ['.sta', '.mt940']
    
    def parse_mt940(self, file_path: Path) -> ImportResult:
        """Parse MT940 file"""
        # TODO: Implement MT940 parsing
        # This would typically:
        # 1. Parse SWIFT MT940 format
        # 2. Extract transaction data
        # 3. Convert to ImportedTransaction format
        
        logger.warning("MT940 parsing not yet implemented")
        return ImportResult(
            transactions=[],
            errors=["MT940 parsing not yet implemented"],
            total_rows=0,
            successful_rows=0
        )

class ImportManager:
    def __init__(self):
        self.csv_importer = CSVImporter()
        self.ofx_importer = OFXImporter()
        self.qif_importer = QIFImporter()
        self.mt940_importer = MT940Importer()
    
    def get_supported_formats(self) -> List[str]:
        """Get list of supported file formats"""
        formats = []
        formats.extend(self.csv_importer.supported_formats)
        formats.extend(self.ofx_importer.supported_formats)
        formats.extend(self.qif_importer.supported_formats)
        formats.extend(self.mt940_importer.supported_formats)
        return formats
    
    def parse_file(self, file_path: Path, column_mapping: Optional[Dict[str, str]] = None) -> ImportResult:
        """Parse file based on its extension"""
        file_extension = file_path.suffix.lower()
        
        if file_extension in self.csv_importer.supported_formats:
            if not column_mapping:
                raise ValueError("Column mapping is required for CSV files")
            return self.csv_importer.parse_csv(file_path, column_mapping)
        
        elif file_extension in self.ofx_importer.supported_formats:
            return self.ofx_importer.parse_ofx(file_path)
        
        elif file_extension in self.qif_importer.supported_formats:
            return self.qif_importer.parse_qif(file_path)
        
        elif file_extension in self.mt940_importer.supported_formats:
            return self.mt940_importer.parse_mt940(file_path)
        
        else:
            return ImportResult(
                transactions=[],
                errors=[f"Unsupported file format: {file_extension}"],
                total_rows=0,
                successful_rows=0
            )
    
    def get_file_preview(self, file_path: Path) -> Dict[str, Any]:
        """Get preview of file contents"""
        file_extension = file_path.suffix.lower()
        
        if file_extension in self.csv_importer.supported_formats:
            return self.csv_importer.get_column_preview(file_path)
        
        else:
            return {
                'columns': [],
                'sample_rows': [],
                'error': f"Preview not available for format: {file_extension}"
            }
