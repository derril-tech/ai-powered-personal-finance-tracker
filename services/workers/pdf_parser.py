# Created automatically by Cursor AI (2024-08-27)

import logging
import re
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import pytesseract
from PIL import Image
import pdfplumber
import pandas as pd
from pydantic import BaseModel

logger = logging.getLogger(__name__)

class ExtractedTransaction(BaseModel):
    date: Optional[datetime] = None
    description: str
    amount: Optional[float] = None
    balance: Optional[float] = None
    reference: Optional[str] = None
    metadata: Dict[str, Any] = {}

class StatementInfo(BaseModel):
    account_number: Optional[str] = None
    statement_date: Optional[datetime] = None
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    institution_name: Optional[str] = None

class ParseResult(BaseModel):
    transactions: List[ExtractedTransaction]
    statement_info: StatementInfo
    errors: List[str]
    confidence: float

class PDFParser:
    def __init__(self):
        self.date_patterns = [
            r'\d{1,2}/\d{1,2}/\d{2,4}',
            r'\d{4}-\d{2}-\d{2}',
            r'\d{1,2}-\d{1,2}-\d{2,4}',
            r'\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{2,4}',
        ]
        
        self.amount_patterns = [
            r'[\$£€]?\s*[\d,]+\.?\d*',
            r'[\d,]+\.?\d*\s*[\$£€]?',
        ]
        
        self.account_patterns = [
            r'Account[:\s]*(\d{4}[\s*-]*\d{4}[\s*-]*\d{4}[\s*-]*\d{4})',
            r'Account[:\s]*(\d{10,16})',
            r'(\d{4}[\s*-]*\d{4}[\s*-]*\d{4}[\s*-]*\d{4})',
        ]

    def parse_pdf(self, file_path: Path) -> ParseResult:
        """Parse PDF statement and extract transactions"""
        transactions = []
        errors = []
        statement_info = StatementInfo()
        confidence = 0.0
        
        try:
            # Try to extract text from PDF
            text_content = self._extract_text_from_pdf(file_path)
            
            if text_content:
                # Parse statement information
                statement_info = self._extract_statement_info(text_content)
                
                # Try to extract transactions from tables
                table_transactions = self._extract_from_tables(file_path)
                if table_transactions:
                    transactions.extend(table_transactions)
                    confidence = 0.9
                
                # If no table data, try text parsing
                if not transactions:
                    text_transactions = self._extract_from_text(text_content)
                    transactions.extend(text_transactions)
                    confidence = 0.7
                
                # If still no transactions, try OCR
                if not transactions:
                    ocr_transactions = self._extract_with_ocr(file_path)
                    transactions.extend(ocr_transactions)
                    confidence = 0.5
                    
            else:
                # Fallback to OCR
                ocr_transactions = self._extract_with_ocr(file_path)
                transactions.extend(ocr_transactions)
                confidence = 0.3
                
        except Exception as e:
            errors.append(f"PDF parsing error: {str(e)}")
            logger.error(f"Error parsing PDF {file_path}: {e}")
        
        return ParseResult(
            transactions=transactions,
            statement_info=statement_info,
            errors=errors,
            confidence=confidence
        )

    def _extract_text_from_pdf(self, file_path: Path) -> str:
        """Extract text content from PDF"""
        text_content = ""
        
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_content += text + "\n"
                        
        except Exception as e:
            logger.warning(f"Could not extract text from PDF: {e}")
            
        return text_content

    def _extract_from_tables(self, file_path: Path) -> List[ExtractedTransaction]:
        """Extract transactions from PDF tables"""
        transactions = []
        
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    tables = page.extract_tables()
                    
                    for table in tables:
                        if table and len(table) > 1:  # At least header + one row
                            table_transactions = self._parse_table(table)
                            transactions.extend(table_transactions)
                            
        except Exception as e:
            logger.warning(f"Could not extract tables from PDF: {e}")
            
        return transactions

    def _parse_table(self, table: List[List[str]]) -> List[ExtractedTransaction]:
        """Parse a table and extract transactions"""
        transactions = []
        
        if not table or len(table) < 2:
            return transactions
        
        # Try to identify column headers
        headers = table[0]
        date_col = None
        desc_col = None
        amount_col = None
        balance_col = None
        
        for i, header in enumerate(headers):
            header_lower = header.lower() if header else ""
            if any(word in header_lower for word in ['date', 'posted']):
                date_col = i
            elif any(word in header_lower for word in ['description', 'memo', 'payee', 'details']):
                desc_col = i
            elif any(word in header_lower for word in ['amount', 'debit', 'credit', 'withdrawal', 'deposit']):
                amount_col = i
            elif any(word in header_lower for word in ['balance', 'running']):
                balance_col = i
        
        # Process data rows
        for row in table[1:]:
            if len(row) < max(filter(None, [date_col, desc_col, amount_col])):
                continue
                
            try:
                transaction = self._parse_table_row(row, date_col, desc_col, amount_col, balance_col)
                if transaction:
                    transactions.append(transaction)
            except Exception as e:
                logger.debug(f"Error parsing table row: {e}")
                continue
                
        return transactions

    def _parse_table_row(self, row: List[str], date_col: Optional[int], 
                        desc_col: Optional[int], amount_col: Optional[int], 
                        balance_col: Optional[int]) -> Optional[ExtractedTransaction]:
        """Parse a single table row"""
        try:
            # Extract date
            date = None
            if date_col is not None and date_col < len(row):
                date_str = row[date_col]
                if date_str:
                    date = self._parse_date(date_str)
            
            # Extract description
            description = ""
            if desc_col is not None and desc_col < len(row):
                description = row[desc_col] or ""
            
            # Extract amount
            amount = None
            if amount_col is not None and amount_col < len(row):
                amount_str = row[amount_col]
                if amount_str:
                    amount = self._parse_amount(amount_str)
            
            # Extract balance
            balance = None
            if balance_col is not None and balance_col < len(row):
                balance_str = row[balance_col]
                if balance_str:
                    balance = self._parse_amount(balance_str)
            
            # Only create transaction if we have essential data
            if description and (date or amount):
                return ExtractedTransaction(
                    date=date,
                    description=description.strip(),
                    amount=amount,
                    balance=balance,
                    metadata={'source': 'table'}
                )
                
        except Exception as e:
            logger.debug(f"Error parsing table row: {e}")
            
        return None

    def _extract_from_text(self, text_content: str) -> List[ExtractedTransaction]:
        """Extract transactions from text content"""
        transactions = []
        
        # Split text into lines
        lines = text_content.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            try:
                transaction = self._parse_text_line(line)
                if transaction:
                    transactions.append(transaction)
            except Exception as e:
                logger.debug(f"Error parsing text line: {e}")
                continue
                
        return transactions

    def _parse_text_line(self, line: str) -> Optional[ExtractedTransaction]:
        """Parse a single text line for transaction data"""
        try:
            # Look for date patterns
            date = None
            for pattern in self.date_patterns:
                match = re.search(pattern, line)
                if match:
                    date = self._parse_date(match.group())
                    break
            
            # Look for amount patterns
            amount = None
            for pattern in self.amount_patterns:
                match = re.search(pattern, line)
                if match:
                    amount = self._parse_amount(match.group())
                    break
            
            # Extract description (everything except date and amount)
            description = line
            if date:
                description = re.sub(self.date_patterns[0], '', description)
            if amount:
                description = re.sub(self.amount_patterns[0], '', description)
            
            description = re.sub(r'\s+', ' ', description).strip()
            
            # Only create transaction if we have essential data
            if description and (date or amount):
                return ExtractedTransaction(
                    date=date,
                    description=description,
                    amount=amount,
                    metadata={'source': 'text'}
                )
                
        except Exception as e:
            logger.debug(f"Error parsing text line: {e}")
            
        return None

    def _extract_with_ocr(self, file_path: Path) -> List[ExtractedTransaction]:
        """Extract transactions using OCR"""
        transactions = []
        
        try:
            # Convert PDF pages to images
            with pdfplumber.open(file_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    # Convert page to image
                    img = page.to_image()
                    
                    # Extract text using OCR
                    ocr_text = pytesseract.image_to_string(img.original)
                    
                    # Parse OCR text
                    ocr_transactions = self._extract_from_text(ocr_text)
                    transactions.extend(ocr_transactions)
                    
        except Exception as e:
            logger.warning(f"OCR extraction failed: {e}")
            
        return transactions

    def _extract_statement_info(self, text_content: str) -> StatementInfo:
        """Extract statement information from text"""
        info = StatementInfo()
        
        try:
            # Extract account number
            for pattern in self.account_patterns:
                match = re.search(pattern, text_content, re.IGNORECASE)
                if match:
                    info.account_number = match.group(1)
                    break
            
            # Extract statement date
            date_match = re.search(r'Statement Date[:\s]*(\d{1,2}/\d{1,2}/\d{2,4})', text_content, re.IGNORECASE)
            if date_match:
                info.statement_date = self._parse_date(date_match.group(1))
            
            # Extract balance information
            balance_match = re.search(r'Balance[:\s]*([\$£€]?\s*[\d,]+\.?\d*)', text_content, re.IGNORECASE)
            if balance_match:
                info.closing_balance = self._parse_amount(balance_match.group(1))
            
            # Extract institution name
            institution_match = re.search(r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+Bank', text_content)
            if institution_match:
                info.institution_name = institution_match.group(1)
                
        except Exception as e:
            logger.debug(f"Error extracting statement info: {e}")
            
        return info

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string to datetime object"""
        if not date_str:
            return None
            
        date_str = date_str.strip()
        
        # Try different date formats
        date_formats = [
            '%m/%d/%Y',
            '%m/%d/%y',
            '%Y-%m-%d',
            '%m-%d-%Y',
            '%d/%m/%Y',
            '%d/%m/%y',
            '%d %b %Y',
            '%d %B %Y',
        ]
        
        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
                
        return None

    def _parse_amount(self, amount_str: str) -> Optional[float]:
        """Parse amount string to float"""
        if not amount_str:
            return None
            
        # Remove currency symbols and commas
        cleaned = re.sub(r'[\$£€,\s]', '', amount_str)
        
        try:
            return float(cleaned)
        except ValueError:
            return None

    def get_statement_preview(self, file_path: Path) -> Dict[str, Any]:
        """Get preview of statement content"""
        try:
            # Extract first page text
            with pdfplumber.open(file_path) as pdf:
                if pdf.pages:
                    first_page = pdf.pages[0]
                    text = first_page.extract_text()
                    
                    # Get basic info
                    info = {
                        'page_count': len(pdf.pages),
                        'first_page_text': text[:1000] if text else "",  # First 1000 chars
                        'has_tables': len(first_page.extract_tables()) > 0,
                    }
                    
                    return info
                    
        except Exception as e:
            logger.error(f"Error getting statement preview: {e}")
            return {'error': str(e)}
        
        return {}
