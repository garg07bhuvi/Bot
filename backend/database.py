import os
import json
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

logger = logging.getLogger(__name__)

# Ensure data directory exists for JSON fallback
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DATA_DIR, exist_ok=True)
JSON_FILE_PATH = os.path.join(DATA_DIR, "businesses.json")

class DatabaseManager:
    def __init__(self):
        self.mongodb_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        self.client = None
        self.db = None
        self.collection = None
        self.is_mongodb_connected = False
        
        self.connect_mongodb()
        
    def connect_mongodb(self):
        try:
            logger.info(f"Attempting to connect to MongoDB at: {self.mongodb_uri}")
            # Set a 3-second server selection timeout so it fails quickly if offline
            self.client = MongoClient(self.mongodb_uri, serverSelectionTimeoutMS=3000)
            # Trigger a ping command to verify connection
            self.client.admin.command('ping')
            self.db = self.client["business_search_db"]
            self.collection = self.db["businesses"]
            # Create a unique index on place_id to enforce uniqueness in MongoDB
            self.collection.create_index("place_id", unique=True)
            self.is_mongodb_connected = True
            logger.info("Successfully connected to MongoDB.")
        except (ConnectionFailure, Exception) as e:
            self.is_mongodb_connected = False
            self.client = None
            self.db = None
            self.collection = None
            logger.warning(f"Could not connect to MongoDB, falling back to JSON storage. Error: {e}")

    def get_status(self):
        # Re-check status if it was false
        if not self.is_mongodb_connected:
            self.connect_mongodb()
            
        return {
            "connected_to_mongodb": self.is_mongodb_connected,
            "storage_type": "MongoDB (business_search_db)" if self.is_mongodb_connected else "JSON Fallback (local file)",
            "file_path": JSON_FILE_PATH if not self.is_mongodb_connected else None
        }

    def _read_json_fallback(self):
        if not os.path.exists(JSON_FILE_PATH):
            return []
        try:
            with open(JSON_FILE_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Error reading JSON fallback: {e}")
            return []

    def _write_json_fallback(self, data):
        try:
            with open(JSON_FILE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=4, default=str)
        except Exception as e:
            logger.error(f"Error writing to JSON fallback: {e}")

    def check_duplicate(self, place_id: str) -> bool:
        if not place_id:
            return False
            
        # Re-try MongoDB connection if not active
        if not self.is_mongodb_connected:
            self.connect_mongodb()
            
        if self.is_mongodb_connected:
            try:
                record = self.collection.find_one({"place_id": place_id})
                return record is not None
            except Exception as e:
                logger.error(f"Error checking duplicate in MongoDB: {e}")
                # Fall back to JSON check
                pass
                
        # JSON fallback check
        businesses = self._read_json_fallback()
        return any(b.get("place_id") == place_id for b in businesses)

    def save_business(self, data: dict) -> dict:
        place_id = data.get("place_id")
        if not place_id:
            raise ValueError("business_data must contain a place_id")

        # Double check duplicate
        if self.check_duplicate(place_id):
            logger.info(f"Business with place_id {place_id} already exists. Skipping.")
            return {"status": "duplicate", "place_id": place_id}

        # Save to database
        if self.is_mongodb_connected:
            try:
                self.collection.insert_one(data.copy())
                logger.info(f"Saved '{data.get('name')}' to MongoDB database.")
                return {"status": "saved", "place_id": place_id, "source": "mongodb"}
            except Exception as e:
                logger.error(f"Failed to save to MongoDB: {e}. Attempting JSON fallback.")
                # Fall through to JSON storage
                
        # Save to JSON File
        businesses = self._read_json_fallback()
        businesses.append(data)
        self._write_json_fallback(businesses)
        logger.info(f"Saved '{data.get('name')}' to JSON file fallback.")
        return {"status": "saved", "place_id": place_id, "source": "json"}

    def get_all_businesses(self):
        # Refresh connection status
        if not self.is_mongodb_connected:
            self.connect_mongodb()
            
        if self.is_mongodb_connected:
            try:
                # Return newest records first
                cursor = self.collection.find({}, {"_id": 0}).sort("queried_at", -1)
                return list(cursor)
            except Exception as e:
                logger.error(f"Failed to fetch from MongoDB: {e}")
                # Fall through to JSON
                
        # JSON Fallback
        businesses = self._read_json_fallback()
        # Sort by queried_at descending if available
        try:
            businesses.sort(key=lambda x: x.get("queried_at", ""), reverse=True)
        except Exception:
            pass
        return businesses

db_manager = DatabaseManager()
