#!/usr/bin/env python3
"""
FRED Data Integration Script
Fetches macroeconomic data from FRED API and generates CSV for dashboard consumption
"""

import os
import json
import requests
import pandas as pd
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import numpy as np
from pathlib import Path

# FRED API Configuration
FRED_API_KEY = os.getenv('FRED_API_KEY', '47754b00af9343542dd99533202f983a')
FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations'

# FRED Series Mapping - matches the TypeScript service configuration
fred_series_map = {
    'GDP Growth Rate': {
        'id': 'A191RL1Q225SBEA',
        'type': 'Coincident',
        'category': 'Growth',
        'frequency': 'quarterly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 1.0,
        'prior_offset': 1
    },
    'CPI Year-over-Year': {
        'id': 'CPIAUCSL',
        'type': 'Lagging',
        'category': 'Inflation',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 2.7,
        'prior_offset': 1
    },
    'Core CPI Year-over-Year': {
        'id': 'CPILFESL',
        'type': 'Lagging',
        'category': 'Inflation',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 3.0,
        'prior_offset': 1
    },
    'PCE Price Index YoY': {
        'id': 'PCEPI',
        'type': 'Lagging',
        'category': 'Inflation',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 2.2,
        'prior_offset': 1
    },
    'Manufacturing PMI': {
        'id': 'MANEMP',
        'type': 'Leading',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'index',
        'lookback_months': 24,
        'forecast': 49.5,
        'prior_offset': 1
    },
    'Unemployment Rate': {
        'id': 'UNRATE',
        'type': 'Lagging',
        'category': 'Labor',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 4.3,
        'prior_offset': 1
    },
    'Nonfarm Payrolls': {
        'id': 'PAYEMS',
        'type': 'Coincident',
        'category': 'Labor',
        'frequency': 'monthly',
        'unit': 'thousands',
        'lookback_months': 24,
        'forecast': 180.0,
        'prior_offset': 1
    },
    'Federal Funds Rate': {
        'id': 'FEDFUNDS',
        'type': 'Coincident',
        'category': 'Monetary Policy',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 4.25,
        'prior_offset': 1
    },
    '10-Year Treasury Yield': {
        'id': 'GS10',
        'type': 'Leading',
        'category': 'Monetary Policy',
        'frequency': 'daily',
        'unit': 'percent',
        'lookback_months': 12,
        'forecast': 4.25,
        'prior_offset': 1
    },
    'Consumer Confidence Index': {
        'id': 'CSCICP03USM665S',
        'type': 'Leading',
        'category': 'Sentiment',
        'frequency': 'monthly',
        'unit': 'index',
        'lookback_months': 24,
        'forecast': 93.5,
        'prior_offset': 1
    },
    'Michigan Consumer Sentiment': {
        'id': 'UMCSENT',
        'type': 'Leading',
        'category': 'Sentiment',
        'frequency': 'monthly',
        'unit': 'index',
        'lookback_months': 24,
        'forecast': 61.5,
        'prior_offset': 1
    },
    'Retail Sales MoM': {
        'id': 'RSAFS',
        'type': 'Coincident',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 0.1,
        'prior_offset': 1
    },
    'Industrial Production YoY': {
        'id': 'INDPRO',
        'type': 'Coincident',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 1.0,
        'prior_offset': 1
    },
    'Housing Starts': {
        'id': 'HOUST',
        'type': 'Leading',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'thousands',
        'lookback_months': 24,
        'forecast': 1350.0,
        'prior_offset': 1
    },
    'Building Permits': {
        'id': 'PERMIT',
        'type': 'Leading',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'thousands',
        'lookback_months': 24,
        'forecast': 1390.0,
        'prior_offset': 1
    },
    'Durable Goods Orders MoM': {
        'id': 'DGORDER',
        'type': 'Leading',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'percent',
        'lookback_months': 24,
        'forecast': 8.6,
        'prior_offset': 1
    },
    'Leading Economic Index': {
        'id': 'USSLIND',
        'type': 'Leading',
        'category': 'Growth',
        'frequency': 'monthly',
        'unit': 'index',
        'lookback_months': 24,
        'forecast': 99.0,
        'prior_offset': 1
    }
}

class FREDDataFetcher:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.session = requests.Session()
        
    def fetch_series_data(self, series_id: str, lookback_months: int = 24) -> Optional[List[Dict]]:
        """Fetch data from FRED API for a given series"""
        observation_start = (datetime.now() - timedelta(days=lookback_months * 30)).strftime('%Y-%m-%d')
        
        params = {
            'series_id': series_id,
            'api_key': self.api_key,
            'file_type': 'json',
            'observation_start': observation_start,
            'sort_order': 'desc'
        }
        
        try:
            response = self.session.get(FRED_BASE_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            observations = data.get('observations', [])
            
            # Filter out invalid observations and convert to float
            valid_observations = []
            for obs in observations:
                if obs['value'] != '.':
                    try:
                        valid_observations.append({
                            'date': obs['date'],
                            'value': float(obs['value'])
                        })
                    except (ValueError, TypeError):
                        continue
                        
            return valid_observations
            
        except requests.RequestException as e:
            print(f"Error fetching data for {series_id}: {e}")
            return None
        except (KeyError, ValueError, TypeError) as e:
            print(f"Error parsing data for {series_id}: {e}")
            return None

    def calculate_metrics(self, observations: List[Dict], config: Dict) -> Dict:
        """Calculate analytical metrics from observations"""
        if not observations or len(observations) < 2:
            return {}
            
        values = [obs['value'] for obs in observations]
        dates = [obs['date'] for obs in observations]
        
        current = values[0]  # Most recent (observations are sorted desc)
        
        # Prior reading based on offset
        prior_offset = config.get('prior_offset', 1)
        prior = values[prior_offset] if len(values) > prior_offset else values[-1]
        
        # Z-Score calculation (12-month window)
        z_score = 0.0
        if len(values) >= 12:
            recent_12m = values[:12]
            mean_12m = np.mean(recent_12m)
            std_12m = np.std(recent_12m)
            if std_12m != 0:
                z_score = (current - mean_12m) / std_12m
        
        # Year-over-Year change
        yoy_change = 0.0
        if len(values) >= 12:
            yoy_value = values[11] if len(values) > 11 else values[-1]
            if yoy_value != 0:
                yoy_change = ((current / yoy_value) - 1) * 100
        
        # 3-Month Annualized Rate
        annualized_rate = 0.0
        if len(values) >= 3:
            three_month_values = values[:3]
            if config['frequency'] == 'monthly':
                # Monthly to annual conversion
                monthly_rate = (three_month_values[0] / three_month_values[2] - 1) if three_month_values[2] != 0 else 0
                annualized_rate = ((1 + monthly_rate) ** 4 - 1) * 100
            elif config['frequency'] == 'quarterly':
                # Quarterly to annual conversion
                quarterly_rate = (three_month_values[0] / three_month_values[2] - 1) if three_month_values[2] != 0 else 0
                annualized_rate = ((1 + quarterly_rate) ** 4 - 1) * 100
        
        # Forecast variances
        forecast = config.get('forecast', 0)
        vs_forecast = current - forecast if forecast else None
        vs_prior = current - prior
        
        # Next release date estimation
        next_release = self._estimate_next_release(dates[0], config['frequency'])
        
        return {
            'current': current,
            'prior': prior,
            'z_score': round(z_score, 2),
            'yoy_change': round(yoy_change, 2),
            'annualized_rate': round(annualized_rate, 2),
            'vs_forecast': round(vs_forecast, 2) if vs_forecast is not None else None,
            'vs_prior': round(vs_prior, 2),
            'forecast': forecast,
            'date_of_release': dates[0],
            'next_release': next_release
        }
    
    def _estimate_next_release(self, last_date: str, frequency: str) -> str:
        """Estimate next release date based on frequency"""
        try:
            last_dt = datetime.strptime(last_date, '%Y-%m-%d')
            
            if frequency == 'monthly':
                # Next month, typically mid-month
                next_dt = (last_dt + timedelta(days=32)).replace(day=15)
            elif frequency == 'quarterly':
                # Next quarter
                next_dt = last_dt + timedelta(days=90)
            elif frequency == 'daily':
                # Next business day
                next_dt = last_dt + timedelta(days=1)
            else:
                # Default to monthly
                next_dt = last_dt + timedelta(days=30)
            
            return next_dt.strftime('%Y-%m-%d')
        except:
            return "TBD"

def main():
    """Main function to fetch data and generate CSV"""
    print(f"🚀 Starting FRED Data Integration at {datetime.now()}")
    
    if not FRED_API_KEY:
        print("❌ FRED_API_KEY not found. Please set the environment variable.")
        return
    
    fetcher = FREDDataFetcher(FRED_API_KEY)
    indicators_data = []
    
    print(f"📊 Processing {len(fred_series_map)} economic indicators...")
    
    for metric_name, config in fred_series_map.items():
        print(f"  📈 Fetching {metric_name}...")
        
        observations = fetcher.fetch_series_data(
            config['id'], 
            config.get('lookback_months', 24)
        )
        
        if observations:
            metrics = fetcher.calculate_metrics(observations, config)
            
            if metrics:
                indicator_data = {
                    'Metric': metric_name,
                    'Type': config['type'],
                    'Category': config['category'],
                    'Frequency': config['frequency'],
                    'Date of Release': metrics['date_of_release'],
                    'Current Reading': metrics['current'],
                    'Forecast': metrics['forecast'],
                    'Variance vs Forecast': metrics['vs_forecast'],
                    'Prior Reading': metrics['prior'],
                    'Variance vs Prior': metrics['vs_prior'],
                    'Z-Score (12M)': metrics['z_score'],
                    '3-Month Annualized Rate': metrics['annualized_rate'],
                    '12-Month YoY Change': metrics['yoy_change'],
                    'Unit': config['unit'],
                    'Next Release': metrics['next_release']
                }
                indicators_data.append(indicator_data)
                print(f"    ✅ {metric_name}: {metrics['current']} {config['unit']}")
            else:
                print(f"    ⚠️ {metric_name}: Failed to calculate metrics")
        else:
            print(f"    ❌ {metric_name}: Failed to fetch data")
    
    if indicators_data:
        # Create DataFrame and save to CSV
        df = pd.DataFrame(indicators_data)
        
        # Save to both server directory and attached_assets for dashboard access
        output_paths = [
            'server/data/macroeconomic_indicators_dataset.csv',
            'attached_assets/macroeconomic_indicators_dataset.csv'
        ]
        
        for output_path in output_paths:
            # Ensure directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            df.to_csv(output_path, index=False)
            print(f"💾 Saved to {output_path}")
        
        # Print summary statistics
        print(f"\n📊 Dataset Summary:")
        print(f"   Total Indicators: {len(df)}")
        print(f"   By Type: {df['Type'].value_counts().to_dict()}")
        print(f"   By Category: {df['Category'].value_counts().to_dict()}")
        print(f"   By Frequency: {df['Frequency'].value_counts().to_dict()}")
        
        print(f"\n📋 First 5 indicators:")
        print(df[['Metric', 'Current Reading', 'Unit', 'Z-Score (12M)', '12-Month YoY Change']].head().to_string())
        
        print(f"\n✅ FRED Data Integration completed at {datetime.now()}")
    else:
        print("❌ No data was successfully processed")

if __name__ == "__main__":
    main()