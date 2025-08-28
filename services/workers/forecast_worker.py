# Created automatically by Cursor AI (2024-12-19)

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
import json
import os
from dataclasses import dataclass
from enum import Enum

# ML imports
try:
    from prophet import Prophet
    from statsmodels.tsa.statespace.sarimax import SARIMAX
    from sklearn.preprocessing import StandardScaler
    from sklearn.ensemble import RandomForestRegressor
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logging.warning("ML libraries not available. Install prophet, statsmodels, scikit-learn for full functionality.")

logger = logging.getLogger(__name__)

class ForecastModel(Enum):
    SARIMAX = "sarimax"
    PROPHET = "prophet"
    RANDOM_FOREST = "random_forest"

@dataclass
class ForecastResult:
    date: datetime
    forecast_amount: float
    p50_lower: float
    p50_upper: float
    p90_lower: float
    p90_upper: float
    confidence: float
    model_used: str
    holiday_effect: Optional[float] = None

@dataclass
class ForecastConfig:
    household_id: str
    entity_type: str  # 'household', 'category', 'account'
    entity_id: str
    forecast_horizon_days: int = 90
    model_type: ForecastModel = ForecastModel.PROPHET
    include_holidays: bool = True
    seasonality_periods: int = 12  # monthly seasonality
    confidence_level: float = 0.9

class ForecastWorker:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)
        self.Session = sessionmaker(bind=self.engine)
        
        # Holiday calendar (US holidays for now, can be extended)
        self.holidays = self._get_holiday_calendar()
        
        # Model cache
        self.model_cache: Dict[str, any] = {}
        
    def _get_holiday_calendar(self) -> pd.DataFrame:
        """Get holiday calendar for forecasting"""
        holidays = []
        current_year = datetime.now().year
        
        for year in range(current_year - 2, current_year + 2):
            # New Year's Day
            holidays.append({'ds': f'{year}-01-01', 'holiday': 'new_year'})
            # Memorial Day (last Monday in May)
            holidays.append({'ds': f'{year}-05-{25 + (5 - datetime(year, 5, 25).weekday()) % 7:02d}', 'holiday': 'memorial_day'})
            # Independence Day
            holidays.append({'ds': f'{year}-07-04', 'holiday': 'independence_day'})
            # Labor Day (first Monday in September)
            holidays.append({'ds': f'{year}-09-{1 + (7 - datetime(year, 9, 1).weekday()) % 7:02d}', 'holiday': 'labor_day'})
            # Thanksgiving (fourth Thursday in November)
            thanksgiving = datetime(year, 11, 1) + timedelta(days=(3 - datetime(year, 11, 1).weekday()) % 7 + 21)
            holidays.append({'ds': thanksgiving.strftime('%Y-%m-%d'), 'holiday': 'thanksgiving'})
            # Christmas
            holidays.append({'ds': f'{year}-12-25', 'holiday': 'christmas'})
        
        return pd.DataFrame(holidays)
    
    async def get_historical_data(self, config: ForecastConfig) -> pd.DataFrame:
        """Fetch historical transaction data for forecasting"""
        query = """
        SELECT 
            DATE(date) as ds,
            SUM(ABS(amount)) as y,
            COUNT(*) as transaction_count
        FROM transactions t
        JOIN accounts a ON t.account_id = a.id
        WHERE a.household_id = :household_id
        AND t.amount < 0  -- Only expenses
        AND t.is_transfer = false
        """
        
        if config.entity_type == 'category':
            query += " AND t.category_id = :entity_id"
        elif config.entity_type == 'account':
            query += " AND t.account_id = :entity_id"
        
        query += """
        GROUP BY DATE(date)
        ORDER BY ds
        """
        
        params = {
            'household_id': config.household_id,
            'entity_id': config.entity_id
        }
        
        with self.Session() as session:
            result = session.execute(text(query), params)
            data = pd.DataFrame(result.fetchall(), columns=['ds', 'y', 'transaction_count'])
        
        if data.empty:
            raise ValueError(f"No historical data found for {config.entity_type} {config.entity_id}")
        
        data['ds'] = pd.to_datetime(data['ds'])
        return data
    
    def prepare_prophet_model(self, data: pd.DataFrame, config: ForecastConfig) -> Prophet:
        """Prepare Prophet model with holiday effects"""
        if not ML_AVAILABLE:
            raise ImportError("Prophet not available. Install prophet library.")
        
        model = Prophet(
            yearly_seasonality=True,
            weekly_seasonality=True,
            daily_seasonality=False,
            seasonality_mode='multiplicative',
            interval_width=config.confidence_level
        )
        
        if config.include_holidays:
            model.add_country_holidays(country_name='US')
        
        # Add custom seasonality
        model.add_seasonality(
            name='monthly',
            period=30.5,
            fourier_order=5
        )
        
        return model
    
    def prepare_sarimax_model(self, data: pd.DataFrame, config: ForecastConfig) -> SARIMAX:
        """Prepare SARIMAX model"""
        if not ML_AVAILABLE:
            raise ImportError("SARIMAX not available. Install statsmodels library.")
        
        # Resample to daily frequency and fill missing values
        data_daily = data.set_index('ds').resample('D').sum().fillna(0)
        
        # SARIMAX model with seasonal components
        model = SARIMAX(
            data_daily['y'],
            order=(1, 1, 1),  # (p, d, q)
            seasonal_order=(1, 1, 1, 7),  # (P, D, Q, s) - weekly seasonality
            enforce_stationarity=False,
            enforce_invertibility=False
        )
        
        return model
    
    def prepare_random_forest_model(self, data: pd.DataFrame, config: ForecastConfig) -> RandomForestRegressor:
        """Prepare Random Forest model with feature engineering"""
        if not ML_AVAILABLE:
            raise ImportError("RandomForest not available. Install scikit-learn library.")
        
        # Feature engineering
        df = data.copy()
        df['ds'] = pd.to_datetime(df['ds'])
        df['day_of_week'] = df['ds'].dt.dayofweek
        df['day_of_month'] = df['ds'].dt.day
        df['month'] = df['ds'].dt.month
        df['quarter'] = df['ds'].dt.quarter
        df['year'] = df['ds'].dt.year
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        
        # Add holiday features
        if config.include_holidays:
            df = df.merge(self.holidays, on='ds', how='left')
            df['is_holiday'] = df['holiday'].notna().astype(int)
        else:
            df['is_holiday'] = 0
        
        # Lag features
        for lag in [1, 7, 30]:
            df[f'lag_{lag}'] = df['y'].shift(lag)
        
        # Rolling features
        for window in [7, 30]:
            df[f'rolling_mean_{window}'] = df['y'].rolling(window=window).mean()
            df[f'rolling_std_{window}'] = df['y'].rolling(window=window).std()
        
        # Remove NaN values
        df = df.dropna()
        
        # Prepare features and target
        feature_columns = [col for col in df.columns if col not in ['ds', 'y', 'holiday']]
        X = df[feature_columns]
        y = df['y']
        
        # Scale features
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
        
        # Train model
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_scaled, y)
        
        return model, scaler, feature_columns
    
    async def generate_forecast(self, config: ForecastConfig) -> List[ForecastResult]:
        """Generate forecast using specified model"""
        try:
            # Get historical data
            data = await self.get_historical_data(config)
            
            if data.empty or len(data) < 30:  # Need at least 30 days of data
                logger.warning(f"Insufficient data for forecasting {config.entity_type} {config.entity_id}")
                return []
            
            forecast_results = []
            
            if config.model_type == ForecastModel.PROPHET:
                forecast_results = await self._forecast_prophet(data, config)
            elif config.model_type == ForecastModel.SARIMAX:
                forecast_results = await self._forecast_sarimax(data, config)
            elif config.model_type == ForecastModel.RANDOM_FOREST:
                forecast_results = await self._forecast_random_forest(data, config)
            else:
                raise ValueError(f"Unsupported model type: {config.model_type}")
            
            # Store forecast results
            await self._store_forecast_results(config, forecast_results)
            
            return forecast_results
            
        except Exception as e:
            logger.error(f"Error generating forecast for {config.entity_type} {config.entity_id}: {str(e)}")
            raise
    
    async def _forecast_prophet(self, data: pd.DataFrame, config: ForecastConfig) -> List[ForecastResult]:
        """Generate forecast using Prophet"""
        model = self.prepare_prophet_model(data, config)
        model.fit(data)
        
        # Create future dataframe
        future = model.make_future_dataframe(periods=config.forecast_horizon_days)
        forecast = model.predict(future)
        
        results = []
        for i in range(len(data), len(forecast)):
            row = forecast.iloc[i]
            results.append(ForecastResult(
                date=row['ds'],
                forecast_amount=row['yhat'],
                p50_lower=row['yhat_lower'],
                p50_upper=row['yhat_upper'],
                p90_lower=row['yhat_lower'],
                p90_upper=row['yhat_upper'],
                confidence=config.confidence_level,
                model_used='prophet',
                holiday_effect=row.get('holidays', 0) if config.include_holidays else None
            ))
        
        return results
    
    async def _forecast_sarimax(self, data: pd.DataFrame, config: ForecastConfig) -> List[ForecastResult]:
        """Generate forecast using SARIMAX"""
        model = self.prepare_sarimax_model(data, config)
        fitted_model = model.fit(disp=False)
        
        # Generate forecast
        forecast = fitted_model.forecast(steps=config.forecast_horizon_days)
        conf_int = fitted_model.get_forecast(steps=config.forecast_horizon_days).conf_int()
        
        results = []
        for i in range(len(forecast)):
            results.append(ForecastResult(
                date=datetime.now() + timedelta(days=i+1),
                forecast_amount=forecast[i],
                p50_lower=conf_int.iloc[i, 0],
                p50_upper=conf_int.iloc[i, 1],
                p90_lower=conf_int.iloc[i, 0] * 0.8,  # Approximate p90
                p90_upper=conf_int.iloc[i, 1] * 1.2,
                confidence=config.confidence_level,
                model_used='sarimax'
            ))
        
        return results
    
    async def _forecast_random_forest(self, data: pd.DataFrame, config: ForecastConfig) -> List[ForecastResult]:
        """Generate forecast using Random Forest"""
        model, scaler, feature_columns = self.prepare_random_forest_model(data, config)
        
        results = []
        last_date = data['ds'].max()
        
        for i in range(config.forecast_horizon_days):
            forecast_date = last_date + timedelta(days=i+1)
            
            # Create features for forecast date
            features = {
                'day_of_week': forecast_date.weekday(),
                'day_of_month': forecast_date.day,
                'month': forecast_date.month,
                'quarter': (forecast_date.month - 1) // 3 + 1,
                'year': forecast_date.year,
                'is_weekend': 1 if forecast_date.weekday() in [5, 6] else 0,
                'is_holiday': 0  # Simplified for now
            }
            
            # Add lag features (use last known values)
            for lag in [1, 7, 30]:
                features[f'lag_{lag}'] = data['y'].iloc[-lag] if len(data) >= lag else 0
            
            # Add rolling features
            for window in [7, 30]:
                if len(data) >= window:
                    features[f'rolling_mean_{window}'] = data['y'].tail(window).mean()
                    features[f'rolling_std_{window}'] = data['y'].tail(window).std()
                else:
                    features[f'rolling_mean_{window}'] = data['y'].mean()
                    features[f'rolling_std_{window}'] = data['y'].std()
            
            # Prepare feature vector
            feature_vector = [features[col] for col in feature_columns]
            feature_vector_scaled = scaler.transform([feature_vector])
            
            # Predict
            prediction = model.predict(feature_vector_scaled)[0]
            
            # Simple confidence intervals (could be improved with quantile regression)
            std_dev = data['y'].std()
            results.append(ForecastResult(
                date=forecast_date,
                forecast_amount=prediction,
                p50_lower=max(0, prediction - std_dev),
                p50_upper=prediction + std_dev,
                p90_lower=max(0, prediction - 1.645 * std_dev),
                p90_upper=prediction + 1.645 * std_dev,
                confidence=config.confidence_level,
                model_used='random_forest'
            ))
        
        return results
    
    async def _store_forecast_results(self, config: ForecastConfig, results: List[ForecastResult]):
        """Store forecast results in database"""
        if not results:
            return
        
        # Create forecasts table if it doesn't exist
        create_table_query = """
        CREATE TABLE IF NOT EXISTS forecasts (
            id SERIAL PRIMARY KEY,
            household_id VARCHAR(255) NOT NULL,
            entity_type VARCHAR(50) NOT NULL,
            entity_id VARCHAR(255) NOT NULL,
            forecast_date DATE NOT NULL,
            forecast_amount DECIMAL(15,2) NOT NULL,
            p50_lower DECIMAL(15,2) NOT NULL,
            p50_upper DECIMAL(15,2) NOT NULL,
            p90_lower DECIMAL(15,2) NOT NULL,
            p90_upper DECIMAL(15,2) NOT NULL,
            confidence DECIMAL(5,2) NOT NULL,
            model_used VARCHAR(50) NOT NULL,
            holiday_effect DECIMAL(15,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(household_id, entity_type, entity_id, forecast_date)
        )
        """
        
        with self.Session() as session:
            session.execute(text(create_table_query))
            
            for result in results:
                insert_query = """
                INSERT INTO forecasts (
                    household_id, entity_type, entity_id, forecast_date,
                    forecast_amount, p50_lower, p50_upper, p90_lower, p90_upper,
                    confidence, model_used, holiday_effect
                ) VALUES (
                    :household_id, :entity_type, :entity_id, :forecast_date,
                    :forecast_amount, :p50_lower, :p50_upper, :p90_lower, :p90_upper,
                    :confidence, :model_used, :holiday_effect
                )
                ON CONFLICT (household_id, entity_type, entity_id, forecast_date)
                DO UPDATE SET
                    forecast_amount = EXCLUDED.forecast_amount,
                    p50_lower = EXCLUDED.p50_lower,
                    p50_upper = EXCLUDED.p50_upper,
                    p90_lower = EXCLUDED.p90_lower,
                    p90_upper = EXCLUDED.p90_upper,
                    confidence = EXCLUDED.confidence,
                    model_used = EXCLUDED.model_used,
                    holiday_effect = EXCLUDED.holiday_effect,
                    created_at = CURRENT_TIMESTAMP
                """
                
                session.execute(text(insert_query), {
                    'household_id': config.household_id,
                    'entity_type': config.entity_type,
                    'entity_id': config.entity_id,
                    'forecast_date': result.date.date(),
                    'forecast_amount': result.forecast_amount,
                    'p50_lower': result.p50_lower,
                    'p50_upper': result.p50_upper,
                    'p90_lower': result.p90_lower,
                    'p90_upper': result.p90_upper,
                    'confidence': result.confidence,
                    'model_used': result.model_used,
                    'holiday_effect': result.holiday_effect
                })
            
            session.commit()
    
    async def get_forecast(self, household_id: str, entity_type: str, entity_id: str, 
                          days_ahead: int = 30) -> List[ForecastResult]:
        """Retrieve stored forecast results"""
        query = """
        SELECT 
            forecast_date, forecast_amount, p50_lower, p50_upper,
            p90_lower, p90_upper, confidence, model_used, holiday_effect
        FROM forecasts
        WHERE household_id = :household_id
        AND entity_type = :entity_type
        AND entity_id = :entity_id
        AND forecast_date >= CURRENT_DATE
        AND forecast_date <= CURRENT_DATE + INTERVAL ':days_ahead days'
        ORDER BY forecast_date
        """
        
        with self.Session() as session:
            result = session.execute(text(query), {
                'household_id': household_id,
                'entity_type': entity_type,
                'entity_id': entity_id,
                'days_ahead': days_ahead
            })
            
            results = []
            for row in result.fetchall():
                results.append(ForecastResult(
                    date=row.forecast_date,
                    forecast_amount=row.forecast_amount,
                    p50_lower=row.p50_lower,
                    p50_upper=row.p50_upper,
                    p90_lower=row.p90_lower,
                    p90_upper=row.p90_upper,
                    confidence=row.confidence,
                    model_used=row.model_used,
                    holiday_effect=row.holiday_effect
                ))
            
            return results

async def main():
    """Main function for testing"""
    db_url = os.getenv('DATABASE_URL', 'postgresql://user:pass@localhost/finance')
    worker = ForecastWorker(db_url)
    
    # Example usage
    config = ForecastConfig(
        household_id='test-household',
        entity_type='category',
        entity_id='test-category',
        forecast_horizon_days=90,
        model_type=ForecastModel.PROPHET,
        include_holidays=True
    )
    
    try:
        results = await worker.generate_forecast(config)
        print(f"Generated {len(results)} forecast points")
        
        # Retrieve forecasts
        stored_results = await worker.get_forecast(
            household_id='test-household',
            entity_type='category',
            entity_id='test-category',
            days_ahead=30
        )
        print(f"Retrieved {len(stored_results)} stored forecasts")
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    asyncio.run(main())
