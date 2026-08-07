import os
import sys
import json
import logging
import asyncio
from dotenv import load_dotenv

# Dynamically add the backend directory to python path for uvicorn
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agent import BusinessAgent
from database import db_manager

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Business Finder Backend API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SettingsUpdate(BaseModel):
    gemini_api_key: str = None
    mongodb_uri: str = None
    search_provider: str = None
    google_places_api_key: str = None
    serper_api_key: str = None

@app.get("/api/status")
def get_status():
    db_status = db_manager.get_status()
    
    # Check if API keys are configured (do not expose keys in raw text, just indicate presence)
    return {
        "database": db_status,
        "config": {
            "gemini_api_key_configured": bool(os.getenv("GEMINI_API_KEY")),
            "search_provider": os.getenv("SEARCH_PROVIDER", "duckduckgo"),
            "google_places_api_key_configured": bool(os.getenv("GOOGLE_PLACES_API_KEY")),
            "serper_api_key_configured": bool(os.getenv("SERPER_API_KEY")),
        }
    }

@app.post("/api/settings")
def update_settings(settings: SettingsUpdate):
    """
    Updates the environment variables in memory and persists them to the .env file.
    """
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    
    # Read existing env lines
    lines = []
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
    env_dict = {}
    for line in lines:
        if "=" in line and not line.startswith("#"):
            k, v = line.strip().split("=", 1)
            env_dict[k.strip()] = v.strip()

    # Update values
    if settings.gemini_api_key is not None:
        os.environ["GEMINI_API_KEY"] = settings.gemini_api_key
        env_dict["GEMINI_API_KEY"] = settings.gemini_api_key
    if settings.mongodb_uri is not None:
        os.environ["MONGODB_URI"] = settings.mongodb_uri
        env_dict["MONGODB_URI"] = settings.mongodb_uri
        # Re-initialize MongoDB client with the new URI
        db_manager.mongodb_uri = settings.mongodb_uri
        db_manager.connect_mongodb()
    if settings.search_provider is not None:
        os.environ["SEARCH_PROVIDER"] = settings.search_provider
        env_dict["SEARCH_PROVIDER"] = settings.search_provider
    if settings.google_places_api_key is not None:
        os.environ["GOOGLE_PLACES_API_KEY"] = settings.google_places_api_key
        env_dict["GOOGLE_PLACES_API_KEY"] = settings.google_places_api_key
    if settings.serper_api_key is not None:
        os.environ["SERPER_API_KEY"] = settings.serper_api_key
        env_dict["SERPER_API_KEY"] = settings.serper_api_key

    # Save back to .env
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            for k, v in env_dict.items():
                f.write(f"{k}={v}\n")
        logger.info("Successfully updated and saved settings to .env file.")
    except Exception as e:
        logger.error(f"Failed to write to .env file: {e}")
        raise HTTPException(status_code=500, detail=f"Could not save settings file: {e}")
        
    return {"status": "success", "message": "Settings updated successfully"}

@app.get("/api/businesses")
def get_businesses():
    """
    Returns all scraped business records stored in the database.
    """
    try:
        businesses = db_manager.get_all_businesses()
        return {"businesses": businesses}
    except Exception as e:
        logger.error(f"Failed to fetch businesses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/search")
async def start_search(query: str = Query(..., description="Business search query")):
    """
    Triggers the AI business search agent and streams reasoning logs and operations back in real-time.
    """
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    agent = BusinessAgent(query)
    
    async def sse_generator():
        # Iterate over agent generator steps
        # Use asyncio.sleep(0) to make sure other async tasks are not blocked
        for step in agent.run():
            yield f"data: {json.dumps(step)}\n\n"
            await asyncio.sleep(0.05)
            
    return StreamingResponse(sse_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
