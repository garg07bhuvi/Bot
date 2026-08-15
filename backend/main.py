import os
import sys
import json
import logging
import asyncio
import requests
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

# --- WhatsApp / LeapCrew Integration Helpers ---

def send_whatsapp_reply(to_phone: str, reply_text: str):
    """
    Sends a WhatsApp message payload using LeapCrew's API endpoints and API Key.
    """
    leapcrew_url = os.environ.get("LEAPCREW_API_URL", "http://localhost:3000")
    api_key = os.environ.get("LEAPCREW_API_KEY")
    
    url = f"{leapcrew_url.rstrip('/')}/api/v1/messages"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "to": to_phone,
        "text": reply_text
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code >= 400:
            logger.error(f"Error sending WhatsApp: {response.status_code} - {response.text}")
        else:
            logger.info(f"Message sent successfully to WhatsApp via LeapCrew ({to_phone})")
    except Exception as e:
        logger.error(f"Failed to connect to LeapCrew API: {e}")

async def run_agent_and_reply_whatsapp(to_phone: str, query: str):
    """
    Consumes the generator of the BusinessAgent to run the search agent loop,
    saving qualifying businesses and replying with a summary over WhatsApp.
    """
    logger.info(f"Triggering background search for WhatsApp query '{query}' from {to_phone}")
    
    # 1. Send status update to WhatsApp
    send_whatsapp_reply(
        to_phone, 
        f"🔍 Launching AI Business Scout for: '{query}'\nProcessing search... This will take a moment."
    )
    
    agent = BusinessAgent(query)
    
    try:
        # Run search loop generator completely
        for step in agent.run():
            await asyncio.sleep(0.01) # Yield execution to FastAPI event loop
            
        saved = agent.saved_businesses
        
        # 2. Format search results summary
        if not saved:
            send_whatsapp_reply(
                to_phone, 
                f"🏁 Scouting Complete for: '{query}'\nNo new unique businesses matching the criteria were found."
            )
            return
            
        lines = [
            f"🎉 *Scout Complete for: '{query}'*",
            f"Discovered and saved {len(saved)} businesses:",
            ""
        ]
        
        for idx, biz in enumerate(saved):
            name = biz.get("name", "Unknown")
            cat = biz.get("category", "Business")
            rating = f"⭐ {biz.get('rating')}" if biz.get("rating") else "Unrated"
            phone = biz.get("phone_number", "No Phone")
            website = biz.get("website")
            
            item_desc = f"{idx + 1}. *{name}* ({cat})\n   ↳ {rating} | {phone}"
            if website:
                item_desc += f"\n   ↳ Website: {website}"
            lines.append(item_desc)
            
        reply_message = "\n".join(lines)
        
        # 3. Send final summary to user
        send_whatsapp_reply(to_phone, reply_message)
        
    except Exception as e:
        logger.error(f"Exception during WhatsApp scout run: {e}")
        send_whatsapp_reply(to_phone, f"❌ Failed to complete scout search for: '{query}'\nError: {str(e)}")

# --- End API Webhook Integrations ---

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

# --- Webhook Endpoint for LeapCrew ---
@app.post("/api/webhook/whatsapp")
async def whatsapp_webhook(payload: dict):
    """
    Receives incoming POST webhooks from LeapCrew containing WhatsApp queries.
    Triggers the background search and automatic WhatsApp text response.
    """
    logger.info(f"Received LeapCrew webhook event: {json.dumps(payload)}")
    
    # Try to extract the user's phone number from varying fields (sender, from, from_phone)
    sender = (
        payload.get("sender") or 
        payload.get("from") or 
        payload.get("from_phone") or 
        payload.get("phone") or
        payload.get("to")
    )
    
    # Try to extract message text (supporting nested message bodies or direct fields)
    text = ""
    if "message" in payload and isinstance(payload["message"], dict):
        text = payload["message"].get("text", "")
    else:
        text = payload.get("text") or payload.get("message") or payload.get("body", "")
        
    if not sender or not text.strip():
        logger.warning("Rejected LeapCrew payload: Missing sender phone or query text.")
        return {"status": "ignored", "reason": "empty body or missing sender phone"}
        
    # Trigger background search and text reply
    asyncio.create_task(run_agent_and_reply_whatsapp(str(sender), text.strip()))
    return {"status": "processing", "message": "Search job scheduled in background."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)