#!/usr/bin/env python3
"""
Import harmonized economic indicators dataset into PostgreSQL
"""

import pandas as pd
import psycopg2
from datetime import datetime
import os

# Database connection
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not found")
    exit(1)

def import_harmonized_data():
    """Import the harmonized economic indicators CSV into the database"""
    try:
        # Read the harmonized CSV
        df = pd.read_csv('attached_assets/economic_indicators_merged_1754720808060.csv')
        print(f"✅ Loaded {len(df)} records from harmonized dataset")
        
        # Connect to database
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        print("🔄 Inserting harmonized data into historical_economic_data table...")
        
        # Prepare batch insert
        records_inserted = 0
        batch_size = 100
        
        for i in range(0, len(df), batch_size):
            batch = df.iloc[i:i+batch_size]
            
            # Prepare values for batch insert
            values = []
            for _, row in batch.iterrows():
                # Map CSV columns to database columns
                values.append((
                    row['series_id'],           # series_id
                    row['metric_name'],         # indicator  
                    float(row['value']),        # value
                    row['category'],            # category
                    row['frequency'],           # frequency
                    None,                       # release_date (not in CSV)
                    row['period_date'],         # period_date
                    row['unit'],                # unit
                    row['type']                 # type
                ))
            
            # Execute batch insert
            cursor.executemany("""
                INSERT INTO historical_economic_data 
                (series_id, indicator, value, category, frequency, release_date, period_date, unit, type)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, values)
            
            records_inserted += len(batch)
            if records_inserted % 200 == 0:
                print(f"📊 Inserted {records_inserted}/{len(df)} records...")
        
        conn.commit()
        print(f"✅ Successfully imported {records_inserted} harmonized economic indicators")
        
        # Verify the import
        cursor.execute("SELECT COUNT(*), COUNT(DISTINCT series_id) FROM historical_economic_data")
        total_records, unique_series = cursor.fetchone()
        
        cursor.execute("SELECT series_id, COUNT(*) FROM historical_economic_data GROUP BY series_id ORDER BY COUNT(*) DESC LIMIT 5")
        top_series = cursor.fetchall()
        
        print(f"📈 Import verification:")
        print(f"   • Total records: {total_records}")
        print(f"   • Unique series: {unique_series}")
        print(f"   • Top series by record count:")
        for series_id, count in top_series:
            print(f"     - {series_id}: {count} records")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error importing harmonized data: {e}")
        raise

if __name__ == "__main__":
    import_harmonized_data()