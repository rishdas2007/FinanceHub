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

def import_comprehensive_data():
    """Import comprehensive economic data from the new CSV file"""
    
    # Read the comprehensive CSV file
    csv_file = 'attached_assets/economic_indicators_history_1754718876841.csv'
    
    logger.info(f"Reading comprehensive CSV file: {csv_file}")
    df = pd.read_csv(csv_file)
    
    logger.info(f"Loaded {len(df)} records from comprehensive CSV")
    logger.info(f"Columns: {list(df.columns)}")
    
    # Show unique series IDs in the CSV
    unique_series = df['series_id'].unique()
    logger.info(f"Found {len(unique_series)} unique series IDs in CSV")
    logger.info(f"Series IDs: {sorted(unique_series)}")
    
    # Connect to database
    conn = connect_to_db()
    cursor = conn.cursor()
    
    try:
        # Get current series in database
        cursor.execute("SELECT DISTINCT series_id FROM historical_economic_data")
        existing_series = set(row[0] for row in cursor.fetchall())
        logger.info(f"Current database has {len(existing_series)} series")
        
        # Find missing series
        missing_series = set(unique_series) - existing_series
        logger.info(f"Missing series to import: {len(missing_series)}")
        if missing_series:
            logger.info(f"Missing: {sorted(missing_series)}")
        
        # Process comprehensive data
        new_records = 0
        updated_records = 0
        
        for index, row in df.iterrows():
            if pd.isna(row['value']) or pd.isna(row['period_date']):
                continue
                
            # Parse the period_date which seems to have quotes and timezone info
            period_date_str = str(row['period_date']).strip('"')
            try:
                period_date = pd.to_datetime(period_date_str).date()
            except:
                logger.warning(f"Could not parse date: {row['period_date']}")
                continue
            
            # Map CSV columns to database columns
            series_id = row['series_id']
            indicator = row['metric_name']
            value = float(row['value'])
            category = row['category']
            frequency = row['frequency'].lower()
            unit = row['unit']
            created_at = datetime.now()
            
            # Parse release_date if available
            release_date = period_date  # fallback
            if not pd.isna(row['release_date']):
                try:
                    release_date_str = str(row['release_date']).strip('"')
                    release_date = pd.to_datetime(release_date_str).date()
                except:
                    pass
            
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
                """, (series_id, indicator, value, category, frequency, period_date, unit, created_at, release_date))
                
                new_records += 1
            else:
                updated_records += 1
            
            if (new_records + updated_records) % 100 == 0:
                logger.info(f"Processed {new_records + updated_records} records...")
        
        # Commit changes
        conn.commit()
        
        logger.info(f"Comprehensive import complete:")
        logger.info(f"  - New records added: {new_records}")
        logger.info(f"  - Records already existed: {updated_records}")
        
        # Check final counts
        cursor.execute("SELECT COUNT(*) FROM historical_economic_data")
        final_count = cursor.fetchone()[0]
        logger.info(f"Final database records: {final_count}")
        
        # Show series counts
        cursor.execute("""
            SELECT series_id, COUNT(*) as record_count
            FROM historical_economic_data 
            GROUP BY series_id 
            ORDER BY record_count DESC
            LIMIT 20
        """)
        
        logger.info("Top series by record count:")
        for series_id, count in cursor.fetchall():
            logger.info(f"  {series_id}: {count} records")
        
        # Show new series added
        cursor.execute("SELECT DISTINCT series_id FROM historical_economic_data")
        final_series = set(row[0] for row in cursor.fetchall())
        newly_added = final_series - existing_series
        if newly_added:
            logger.info(f"Newly added series ({len(newly_added)}): {sorted(newly_added)}")
        
    except Exception as e:
        logger.error(f"Error during comprehensive import: {e}")
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import_comprehensive_data()