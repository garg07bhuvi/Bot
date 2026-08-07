import os
import sys

# Dynamically add the backend directory to python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import db_manager
from search_providers import BingProvider

def test_system():
    print("--- Checking Database Status ---")
    status = db_manager.get_status()
    print(f"DB Connected: {status.get('connected_to_mongodb')}")
    print(f"Storage Type: {status.get('storage_type')}")
    
    print("\n--- Testing Bing Search Provider ---")
    provider = BingProvider()
    results = provider.search("cafes in Delhi", limit=2)
    print(f"Retrieved {len(results)} businesses.")
    
    if results:
        for idx, biz in enumerate(results):
            print(f"\nBusiness {idx + 1}:")
            print(f"  Name: {biz.get('name')}")
            print(f"  Category: {biz.get('category')}")
            print(f"  Maps URL: {biz.get('google_maps_url')[:60]}...")
            print(f"  Snippet: {biz.get('short_description')[:100]}...")
        
        # Test Duplicate Checking and Saving
        first_biz = results[0]
        pid = first_biz["place_id"]
        
        print("\n--- Testing Database Actions ---")
        is_dup_before = db_manager.check_duplicate(pid)
        print(f"Is duplicate before save? {is_dup_before}")
        
        save_res = db_manager.save_business(first_biz)
        print(f"Save result: {save_res}")
        
        is_dup_after = db_manager.check_duplicate(pid)
        print(f"Is duplicate after save? {is_dup_after}")
        
        # Clean up JSON test file record if saved in JSON
        if save_res.get("source") == "json":
            print("\nCleaning up JSON test record...")
            businesses = db_manager._read_json_fallback()
            cleaned = [b for b in businesses if b.get("place_id") != pid]
            db_manager._write_json_fallback(cleaned)
            print("Cleaned up.")
            
    print("\nTest completed successfully!")

if __name__ == "__main__":
    test_system()
