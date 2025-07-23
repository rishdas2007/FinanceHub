import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import requests
import os

# --- Configuration ---
FRED_API_KEY = '47754b00af9343542dd99533202f983a' # <<< IMPORTANT: Replace with your FRED API Key
BASE_FRED_URL = "https://api.stlouisfed.org/fred/series/observations"
OUTPUT_CSV_FILE = 'macroeconomic_indicators_dataset.csv'

# Define the current date for data processing
current_date = datetime.now()

# --- FRED Series Mapping ---
# Map your indicator names to FRED series IDs and their properties
# You might need to adjust these FRED series IDs based on your exact requirements
# and what's available on FRED.
fred_series_map = {
    'GDP Growth Rate': {'id': 'A191RL1Q225SBEA', 'type': 'coincident', 'category': 'growth', 'frequency': 'quarterly', 'unit': 'percent', 'lookback_months': 48, 'forecast': 1.0, 'prior_offset': 1}, # Real GDP, Percent Change from Preceding Period, Annualized
    'CPI Year-over-Year': {'id': 'CPIAUCSL', 'type': 'lagging', 'category': 'inflation', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 2.7, 'prior_offset': 1}, # CPI for All Urban Consumers: All Items
    'Core CPI Year-over-Year': {'id': 'CPILFESL', 'type': 'lagging', 'category': 'inflation', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 3.0, 'prior_offset': 1}, # CPI for All Urban Consumers: All Items Less Food and Energy
    'PCE Price Index YoY': {'id': 'PCEPI', 'type': 'lagging', 'category': 'inflation', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 2.2, 'prior_offset': 1}, # Personal Consumption Expenditures Price Index
    'Manufacturing PMI': {'id': 'NAPMIMFG', 'type': 'leading', 'category': 'growth', 'frequency': 'monthly', 'unit': 'index', 'lookback_months': 24, 'forecast': 49.5, 'prior_offset': 1}, # ISM Manufacturing PMI
    'S&P Global Manufacturing PMI': {'id': 'PMICM', 'type': 'leading', 'category': 'growth', 'frequency': 'monthly', 'unit': 'index', 'lookback_months': 24, 'forecast': 51.5, 'prior_offset': 1}, # S&P Global US Manufacturing PMI
    'Unemployment Rate': {'id': 'UNRATE', 'type': 'lagging', 'category': 'labor', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 4.3, 'prior_offset': 1}, # Unemployment Rate
    'Nonfarm Payrolls': {'id': 'PAYEMS', 'type': 'coincident', 'category': 'labor', 'frequency': 'monthly', 'unit': 'thousands', 'lookback_months': 24, 'forecast': 180, 'prior_offset': 1}, # All Employees, Nonfarm Payrolls
    'Federal Funds Rate': {'id': 'FEDFUNDS', 'type': 'coincident', 'category': 'monetary_policy', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 4.25, 'prior_offset': 1}, # Federal Funds Effective Rate
    '10-Year Treasury Yield': {'id': 'DGS10', 'type': 'leading', 'category': 'monetary_policy', 'frequency': 'daily', 'unit': 'percent', 'lookback_months': 24, 'forecast': 4.25, 'prior_offset': 1}, # 10-Year Treasury Constant Maturity Rate
    'Yield Curve (10yr-2yr)': {'id': 'T10Y2Y', 'type': 'leading', 'category': 'monetary_policy', 'frequency': 'daily', 'unit': 'basis_points', 'lookback_months': 24, 'forecast': 50, 'prior_offset': 1}, # 10-Year Treasury Constant Maturity Minus 2-Year Treasury Constant Maturity
    'Consumer Confidence Index': {'id': 'CSCICP03USM665S', 'type': 'leading', 'category': 'sentiment', 'frequency': 'monthly', 'unit': 'index', 'lookback_months': 24, 'forecast': 93.5, 'prior_offset': 1}, # Consumer Confidence Index (OECD)
    'Michigan Consumer Sentiment': {'id': 'UMCSENT', 'type': 'leading', 'category': 'sentiment', 'frequency': 'monthly', 'unit': 'index', 'lookback_months': 24, 'forecast': 61.5, 'prior_offset': 1}, # University of Michigan: Consumer Sentiment
    'Retail Sales MoM': {'id': 'RSXFS', 'type': 'coincident', 'category': 'growth', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 0.1, 'prior_offset': 1}, # Retail Sales: Total
    'Industrial Production YoY': {'id': 'INDPRO', 'type': 'coincident', 'category': 'growth', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 1.0, 'prior_offset': 1}, # Industrial Production Index
    'Housing Starts': {'id': 'HOUST', 'type': 'leading', 'category': 'growth', 'frequency': 'monthly', 'unit': 'thousands', 'lookback_months': 24, 'forecast': 1350, 'prior_offset': 1}, # Housing Starts: Total
    'Building Permits': {'id': 'PERMIT', 'type': 'leading', 'category': 'growth', 'frequency': 'monthly', 'unit': 'thousands', 'lookback_months': 24, 'forecast': 1390, 'prior_offset': 1}, # New Private Housing Units Authorized by Building Permits
    'Durable Goods Orders MoM': {'id': 'DGORDER', 'type': 'leading', 'category': 'growth', 'frequency': 'monthly', 'unit': 'percent', 'lookback_months': 24, 'forecast': 8.6, 'prior_offset': 1}, # Manufacturers' New Orders: Durable Goods
    'Leading Economic Index': {'id': 'USSLIND', 'type': 'leading', 'category': 'growth', 'frequency': 'monthly', 'unit': 'index', 'lookback_months': 24, 'forecast': 99.0, 'prior_offset': 1} # US Leading Index (OECD)
}

# --- Helper Function to Fetch Data from FRED ---
def fetch_fred_series(series_id, api_key, observation_start=None, frequency=None):
    """Fetches observations for a given FRED series ID."""
    params = {
        'series_id': series_id,
        'api_key': api_key,
        'file_type': 'json',
        'sort_order': 'desc', # Get most recent observations first
        'limit': 1000 # Fetch enough historical data for calculations
    }
    if observation_start:
        params['observation_start'] = observation_start.strftime('%Y-%m-%d')
    if frequency:
        params['frequency'] = frequency # e.g., 'm' for monthly, 'q' for quarterly, 'd' for daily

    try:
        response = requests.get(BASE_FRED_URL, params=params)
        response.raise_for_status() # Raise an HTTPError for bad responses (4xx or 5xx)
        data = response.json()
        
        observations = []
        for obs in data.get('observations', []):
            try:
                value = float(obs['value'])
                if obs['value'] != '.': # FRED uses '.' for missing values
                    observations.append(value)
            except ValueError:
                continue # Skip non-numeric values

        # FRED returns data in descending order by default, so we reverse to get chronological
        return observations[::-1]
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data for {series_id}: {e}")
        return []

# --- Data Processing Functions ---
def calculate_z_score(values):
    """Calculates the Z-score for the most recent value based on the given historical values."""
    if len(values) < 2: # Need at least 2 values to calculate std dev
        return 0.0
    
    recent_values = np.array(values)
    mean = np.mean(recent_values)
    std = np.std(recent_values)
    
    if std == 0:
        return 0.0
    
    return (recent_values[-1] - mean) / std

def calculate_annualized_rate(values, frequency_type, unit):
    """Calculates the 3-month annualized rate."""
    if len(values) < 3:
        return 0.0
    
    recent_3_months = values[-3:] # Last 3 months
    
    if unit == 'percent':
        # For percentage data, calculate average and annualize
        avg_3m = np.mean(recent_3_months)
        if frequency_type == 'monthly':
            return (avg_3m / 3) * 12
        elif frequency_type == 'quarterly':
            return avg_3m * 4 # Already a quarterly rate, annualize it
        else: # Daily, etc. - just return average for now
            return avg_3m
    else:
        # For other data, calculate growth rate if applicable
        if recent_3_months[0] != 0: # Avoid division by zero
            growth_rate = ((recent_3_months[-1] / recent_3_months[0])**(1/2) - 1) * 100 # Approx. compound growth over 3 months
            if frequency_type == 'monthly':
                return growth_rate * 4 # Annualize monthly growth
            elif frequency_type == 'quarterly':
                return growth_rate * 4 # Annualize quarterly growth
            else:
                return growth_rate
        else:
            return 0.0

def calculate_yoy_change(values):
    """Calculates the 12-month Year-over-Year change."""
    if len(values) < 12:
        return 0.0
    
    current_value = values[-1]
    prior_year_value = values[-13] # 12 months ago
    
    if prior_year_value == 0:
        return 0.0
    
    return ((current_value / prior_year_value) - 1) * 100

# --- Main Data Generation Logic ---
data_records = []

for indicator_name, info in fred_series_map.items():
    print(f"Fetching data for: {indicator_name} ({info['id']})...")
    
    # Calculate observation_start to fetch enough historical data for calculations
    # Ensure we get at least 12 months + prior year for YoY, plus some buffer
    start_date = current_date - timedelta(days=info['lookback_months'] * 30) # Approx. months
    
    # Fetch raw historical data
    # FRED's frequency parameter can help, but sometimes it's better to fetch daily/monthly
    # and then resample if needed, depending on the series.
    # For simplicity, we'll rely on FRED's default frequency for the series ID.
    
    # For GDP, which is quarterly, we need to ensure we fetch enough quarters
    if info['frequency'] == 'quarterly':
        raw_values = fetch_fred_series(info['id'], FRED_API_KEY, observation_start=start_date, frequency='q')
    elif info['frequency'] == 'monthly':
        raw_values = fetch_fred_series(info['id'], FRED_API_KEY, observation_start=start_date, frequency='m')
    elif info['frequency'] == 'daily':
        raw_values = fetch_fred_series(info['id'], FRED_API_KEY, observation_start=start_date, frequency='d')
    else:
        raw_values = fetch_fred_series(info['id'], FRED_API_KEY, observation_start=start_date)

    if not raw_values:
        print(f"No data fetched for {indicator_name}. Skipping.")
        continue

    # Get current and prior readings
    current_reading = raw_values[-1] if raw_values else None
    prior_reading = raw_values[-1 - info['prior_offset']] if len(raw_values) > info['prior_offset'] else None

    # Calculate metrics
    z_score = round(calculate_z_score(raw_values), 2)
    three_month_annualized = round(calculate_annualized_rate(raw_values, info['frequency'], info['unit']), 2)
    yoy_change = round(calculate_yoy_change(raw_values), 2)

    # Determine next release date (simplified for demonstration)
    # In a real application, you'd parse FRED's release dates or use a more sophisticated calendar.
    if info['frequency'] == 'monthly':
        next_release = current_date + timedelta(days=30)
    elif info['frequency'] == 'quarterly':
        next_release = current_date + timedelta(days=90)
    elif info['frequency'] == 'daily': # For daily series, assume next day for simplicity
        next_release = current_date + timedelta(days=1)
    else: # Default for 'meeting' or other specific frequencies
        next_release = current_date + timedelta(days=7) # Assume weekly for others

    record = {
        'Metric': indicator_name,
        'Type': info['type'].title(),
        'Category': info['category'].replace('_', ' ').title(),
        'Frequency': info['frequency'].title(),
        'Date of Release': next_release.strftime('%Y-%m-%d'),
        'Current Reading': current_reading,
        'Forecast': info.get('forecast', None),
        'Variance vs Forecast': round(current_reading - info['forecast'], 2) if info.get('forecast') is not None else None,
        'Prior Reading': prior_reading,
        'Variance vs Prior': round(current_reading - prior_reading, 2) if current_reading is not None and prior_reading is not None else None,
        'Z-Score (12M)': z_score,
        '3-Month Annualized Rate': three_month_annualized,
        '12-Month YoY Change': yoy_change,
        'Unit': info['unit']
    }
    
    data_records.append(record)

# Create DataFrame
df = pd.DataFrame(data_records)

# Display the first few rows to verify
print("\nMacroeconomic Indicators Dataset - First 10 rows:")
print(df.head(10).to_string(index=False))
print(f"\nTotal indicators: {len(df)}")
print(f"\nDataset columns: {list(df.columns)}")

# Save to CSV
df.to_csv(OUTPUT_CSV_FILE, index=False)
print(f"\nDataset saved as '{OUTPUT_CSV_FILE}'")

# Create summary statistics
print("\n=== SUMMARY STATISTICS ===")
print(f"Leading Indicators: {len(df[df['Type'] == 'Leading'])}")
print(f"Coincident Indicators: {len(df[df['Type'] == 'Coincident'])}")  
print(f"Lagging Indicators: {len(df[df['Type'] == 'Lagging'])}")

print("\nBy Category:")
print(df['Category'].value_counts())

print("\nBy Frequency:")
print(df['Frequency'].value_counts())
