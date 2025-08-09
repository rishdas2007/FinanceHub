#!/usr/bin/env python3

import pandas as pd
import psycopg2
from datetime import datetime
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def connect_to_db():
    """Connect to PostgreSQL database using DATABASE_URL"""
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL environment variable not found")
    
    return psycopg2.connect(database_url)

def import_economic_data():
    """Import economic data from CSV file"""
    
    # Read CSV file
    csv_file = '/tmp/economic_indicators.csv'
    if not os.path.exists(csv_file):
        csv_file = 'attached_assets/economic_indicators_history_1754716986196.csv'
    
    logger.info(f"Reading CSV file: {csv_file}")
    df = pd.read_csv(csv_file)
    
    logger.info(f"Loaded {len(df)} records from CSV")
    logger.info(f"Columns: {list(df.columns)}")
    
    # Connect to database
    conn = connect_to_db()
    cursor = conn.cursor()
    
    try:
        # Check current data count
        cursor.execute("SELECT COUNT(*) FROM historical_economic_data")
        current_count = cursor.fetchone()[0]
        logger.info(f"Current database records: {current_count}")
        
        # Get unique series in current database
        cursor.execute("SELECT DISTINCT series_id FROM historical_economic_data")
        existing_series = set(row[0] for row in cursor.fetchall())
        logger.info(f"Existing series: {existing_series}")
        
        # Process CSV data
        new_records = 0
        updated_records = 0
        
        for index, row in df.iterrows():
            if pd.isna(row['value']) or pd.isna(row['period_date']):
                continue
                
            # Map CSV columns to database columns
            series_id = row['series_id']
            indicator = row['metric_name']
            value = float(row['value'])
            category = row['category']
            frequency = row['frequency'].lower()
            period_date = pd.to_datetime(row['period_date']).date()
            unit = row['unit']
            created_at = datetime.now()
            
            # Check if this series_id and period_date already exists
            cursor.execute("""
                SELECT COUNT(*) FROM historical_economic_data 
                WHERE series_id = %s AND period_date = %s
            """, (series_id, period_date))
            
            exists = cursor.fetchone()[0] > 0
            
            if not exists:
                # Insert new record
                cursor.execute("""
                    INSERT INTO historical_economic_data 
                    (series_id, indicator, value, category, frequency, period_date, unit, created_at, release_date)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (series_id, indicator, value, category, frequency, period_date, unit, created_at, period_date))
                
                new_records += 1
            else:
                updated_records += 1
            
            if (new_records + updated_records) % 100 == 0:
                logger.info(f"Processed {new_records + updated_records} records...")
        
        # Commit changes
        conn.commit()
        
        logger.info(f"Import complete:")
        logger.info(f"  - New records added: {new_records}")
        logger.info(f"  - Records already existed: {updated_records}")
        
        # Check final count
        cursor.execute("SELECT COUNT(*) FROM historical_economic_data")
        final_count = cursor.fetchone()[0]
        logger.info(f"Final database records: {final_count}")
        
        # Show series counts
        cursor.execute("""
            SELECT series_id, COUNT(*) as record_count
            FROM historical_economic_data 
            GROUP BY series_id 
            ORDER BY record_count DESC
            LIMIT 10
        """)
        
        logger.info("Top series by record count:")
        for series_id, count in cursor.fetchall():
            logger.info(f"  {series_id}: {count} records")
        
    except Exception as e:
        logger.error(f"Error during import: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import_economic_data()