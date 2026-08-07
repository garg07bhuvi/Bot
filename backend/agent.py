import os
import json
import time
import logging
from typing import List, Dict, Any, Generator
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

from search_providers import BingProvider, GooglePlacesProvider, SerperProvider, scrape_url
from database import db_manager

logger = logging.getLogger(__name__)

# Pydantic schemas for structured JSON output from Gemini
class AgentAction(BaseModel):
    name: str = Field(
        description="The tool to call: 'search_businesses', 'get_business_details', 'scrape_website', 'is_duplicate', 'save_business', or 'finish'"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict, 
        description="Arguments/parameters for the tool. E.g., {'query': '...'}, {'place_id': '...'}, {'url': '...'}, {'business_data': {...}}"
    )

class AgentStep(BaseModel):
    thought: str = Field(
        description="Explain what you are doing, what you discovered, and why you are calling this tool."
    )
    action: AgentAction


class BusinessAgent:
    def __init__(self, query: str):
        self.query = query
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.provider_name = os.getenv("SEARCH_PROVIDER", "bing").lower()
        self.provider = self._init_search_provider()
        
        # In-memory store to cache search results details
        self.search_results_cache = {}
        # Count of successfully saved unique businesses in this run
        self.saved_count = 0
        self.saved_businesses = []

    def _init_search_provider(self):
        if self.provider_name == "google":
            api_key = os.getenv("GOOGLE_PLACES_API_KEY")
            if api_key:
                logger.info("Initializing Google Places Provider")
                return GooglePlacesProvider(api_key)
            else:
                logger.warning("Google Places API key missing. Falling back to Bing.")
        elif self.provider_name == "serper":
            api_key = os.getenv("SERPER_API_KEY")
            if api_key:
                logger.info("Initializing Serper Provider")
                return SerperProvider(api_key)
            else:
                logger.warning("Serper API key missing. Falling back to Bing.")
        
        logger.info("Initializing Bing Provider")
        return BingProvider()

    def run(self) -> Generator[Dict[str, Any], None, None]:
        """
        Executes the agentic loop. Yields status updates (thoughts and actions) 
        that can be streamed to the client in real-time.
        """
        if not self.api_key:
            yield {
                "type": "error",
                "message": "GEMINI_API_KEY is not configured in the backend .env file. Please add it to start searching."
            }
            return

        yield {
            "type": "log",
            "message": f"Starting agentic search for: '{self.query}' using provider: {self.provider_name.upper()}..."
        }

        # Initialize Gemini Client
        try:
            client = genai.Client(api_key=self.api_key)
        except Exception as e:
            yield {
                "type": "error",
                "message": f"Failed to initialize Gemini Client: {e}"
            }
            return

        # Setup Agent History / Message thread
        # We prompt the agent with its goals, tools, and constraints.
        system_instruction = (
            "You are a Business Intelligence Agent. Your goal is to gather information on the top 10 unique businesses "
            f"matching the query: '{self.query}' and save them to the database.\n\n"
            "Here is the workflow you MUST follow:\n"
            "1. Search for businesses using 'search_businesses'.\n"
            "   IMPORTANT: Web search results for queries like 'cafes in Delhi' will often return listicle articles (e.g., 'The 15 Best Cafes in New Delhi'). When you see a listicle article, DO NOT save the listicle itself as a business! Instead, call 'scrape_website' on the listicle website URL. Read the text of the webpage to identify the names, websites, and details of the actual cafes listed inside (e.g. 'Blue Tokai', 'Rose Cafe', 'Diggin'). Then, search for those specific cafes or save them directly! This is how you find the actual physical business records.\n"
            "2. For each business found, check if it's already in the database using 'is_duplicate'.\n"
            "3. If it's a duplicate, skip it and continue processing the others.\n"
            "4. If it's new, fetch details using 'get_business_details'.\n"
            "5. If important details (e.g. phone number, opening hours, or description) are missing, you can optionally "
            "use 'scrape_website' on the business's website URL to retrieve them.\n"
            "6. Save the refined business record using 'save_business'. Make sure all required fields are populated.\n"
            "7. Repeat until you have successfully saved exactly 10 unique business records, then call the 'finish' tool.\n\n"
            "You MUST respond in JSON format matching this schema:\n"
            "{\n"
            "  \"thought\": \"string explaining what you are doing, what you discovered, and why you are calling this tool next.\",\n"
            "  \"action\": {\n"
            "    \"name\": \"string (MUST be one of: 'search_businesses', 'get_business_details', 'scrape_website', 'is_duplicate', 'save_business', or 'finish')\",\n"
            "    \"parameters\": {\n"
            "      \"query\": \"string (optional, query for search_businesses)\",\n"
            "      \"place_id\": \"string (optional, place_id for is_duplicate or get_business_details)\",\n"
            "      \"url\": \"string (optional, url for scrape_website)\",\n"
            "      \"business_data\": { ... } (optional, business details mapping to required schema fields for save_business)\n"
            "    }\n"
            "  }\n"
            "}\n\n"
            "Required schema fields for save_business:\n"
            "- place_id (string, unique identifier)\n"
            "- name (string)\n"
            "- category (string)\n"
            "- address (string)\n"
            "- latitude (float or null)\n"
            "- longitude (float or null)\n"
            "- google_maps_url (string)\n"
            "- website (string or null)\n"
            "- phone_number (string or null)\n"
            "- rating (float or null)\n"
            "- review_count (integer or null)\n"
            "- opening_hours (list of strings or null)\n"
            "- primary_image_url (string)\n"
            "- short_description (string)\n\n"
            "Always follow this cycle: Thought -> Tool Call -> Observation -> Thought -> Tool Call -> ...\n"
            "Maintain an active count of successfully saved businesses. Do not stop until you have saved 10."
        )

        # Initialize conversation history
        chat_history = [
            {"role": "user", "content": f"Let's begin. Find the businesses matching the query: '{self.query}'"}
        ]

        max_steps = 35  # Safety boundary to prevent infinite loops
        step = 0

        while step < max_steps:
            step += 1
            logger.info(f"Agent Loop Step {step}")

            try:
                # Call Gemini with Structured JSON Output (using types.Schema directly to avoid additionalProperties)
                agent_schema = types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "thought": types.Schema(
                            type=types.Type.STRING,
                            description="Explain what you are doing, what you discovered, and why you are calling this tool next."
                        ),
                        "action": types.Schema(
                            type=types.Type.OBJECT,
                            properties={
                                "name": types.Schema(
                                    type=types.Type.STRING,
                                    description="The tool to call: 'search_businesses', 'get_business_details', 'scrape_website', 'is_duplicate', 'save_business', or 'finish'"
                                ),
                                "parameters": types.Schema(
                                    type=types.Type.OBJECT,
                                    description="Arguments/parameters for the tool. E.g. {'query': '...'}, {'place_id': '...'}, {'url': '...'}, {'business_data': {...}}"
                                )
                            },
                            required=["name", "parameters"]
                        )
                    },
                    required=["thought", "action"]
                )

                is_openrouter = self.api_key.startswith("sk-")
                response_text = ""

                if is_openrouter:
                    import requests
                    headers = {
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    }
                    payload = {
                        "model": "google/gemini-2.5-flash",
                        "messages": [{"role": "system", "content": system_instruction}] + chat_history,
                        "response_format": {"type": "json_object"},
                        "max_tokens": 1500,
                        "temperature": 0.2
                    }
                    
                    # 3-Attempt retry loop for network truncations/JSON parse issues
                    for attempt in range(3):
                        try:
                            logger.info(f"Calling OpenRouter (Attempt {attempt + 1}/3)...")
                            r = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload, timeout=30)
                            if r.status_code == 200:
                                res_data = r.json()
                                text = res_data["choices"][0]["message"]["content"].strip()
                                # Validate JSON syntax and dict structure before accepting it
                                data = json.loads(text)
                                if not isinstance(data, dict):
                                    raise ValueError(f"Expected a JSON dictionary object, but got a {type(data).__name__}")
                                if "thought" not in data or "action" not in data:
                                    raise ValueError("JSON does not contain required 'thought' or 'action' fields")
                                response_text = text
                                break
                            else:
                                logger.warning(f"OpenRouter attempt {attempt + 1} returned status code: {r.status_code}")
                        except Exception as e:
                            logger.warning(f"OpenRouter attempt {attempt + 1} encountered error: {e}")
                        time.sleep(1) # pause before retry
                    
                    if not response_text:
                        yield {
                            "type": "error",
                            "message": "OpenRouter API failed after 3 attempts or returned incomplete/malformed JSON."
                        }
                        break
                else:
                    # Format chat history for Google SDK Content schema
                    contents = []
                    for msg in chat_history:
                        role = "user" if msg["role"] == "user" else "model"
                        contents.append(
                            types.Content(
                                role=role,
                                parts=[msg["content"]]
                            )
                        )

                    response = client.models.generate_content(
                        model='gemini-2.5-flash',
                        contents=contents,
                        config=types.GenerateContentConfig(
                            system_instruction=system_instruction,
                            response_mime_type="application/json",
                            response_schema=agent_schema,
                            temperature=0.2
                        )
                    )
                    response_text = response.text
            except Exception as e:
                yield {
                    "type": "error",
                    "message": f"Gemini/OpenRouter API Error: {str(e)}"
                }
                break

            # Parse Agent Step
            try:
                step_data = json.loads(response_text)
                if not isinstance(step_data, dict):
                    raise ValueError(f"Expected a JSON dictionary object, but got a {type(step_data).__name__}")
                
                thought = step_data.get("thought", "")
                action = step_data.get("action", {})
                if not isinstance(action, dict):
                    raise ValueError(f"Expected 'action' to be a JSON dictionary object, but got {type(action).__name__}")
                
                action_name = action.get("name")
                action_params = action.get("parameters", {})
                if action_params is None:
                    action_params = {}
                elif not isinstance(action_params, dict):
                    raise ValueError(f"Expected 'parameters' to be a JSON dictionary object, but got {type(action_params).__name__}")
            except Exception as e:
                yield {
                    "type": "error",
                    "message": f"Failed to parse agent step JSON: {str(e)}. Raw: {response_text}"
                }
                break

            # Yield thought to frontend
            yield {
                "type": "thought",
                "step": step,
                "thought": thought,
                "action": action_name,
                "parameters": action_params
            }

            # Execute tool and get observation
            observation = ""
            try:
                if action_name == "search_businesses":
                    search_q = action_params.get("query", self.query)
                    yield {"type": "log", "message": f"🔍 Executing search_businesses for '{search_q}'..."}
                    results = self.provider.search(search_q, limit=12)
                    
                    # Store in search cache so detail fetching can look it up first
                    for r in results:
                        self.search_results_cache[r["place_id"]] = r
                        
                    # Return summary to model
                    summary = [{"place_id": r["place_id"], "name": r["name"], "category": r["category"]} for r in results]
                    observation = json.dumps(summary)
                    yield {"type": "log", "message": f"📋 Search found {len(results)} businesses."}

                elif action_name == "is_duplicate":
                    pid = action_params.get("place_id")
                    yield {"type": "log", "message": f"🔄 Checking duplicate status for place ID: {pid}..."}
                    is_dup = db_manager.check_duplicate(pid)
                    observation = "true" if is_dup else "false"
                    yield {"type": "log", "message": f"  ↳ Duplicate: {observation}"}

                elif action_name == "get_business_details":
                    pid = action_params.get("place_id")
                    yield {"type": "log", "message": f"ℹ️ Fetching details for business: {pid}..."}
                    
                    # Try local cache
                    cached_data = self.search_results_cache.get(pid, {})
                    
                    # Fetch extra details if Google Places provider
                    if isinstance(self.provider, GooglePlacesProvider):
                        api_details = self.provider.fetch_details(pid)
                        cached_data.update(api_details)
                    
                    observation = json.dumps(cached_data)
                    yield {"type": "log", "message": f"  ↳ Details retrieved: Phone: {cached_data.get('phone_number')}, Website: {cached_data.get('website')}"}

                elif action_name == "scrape_website":
                    url = action_params.get("url")
                    yield {"type": "log", "message": f"🌐 Scraping website: {url}..."}
                    page_text = scrape_url(url)
                    # Simple extraction helper to help the model find contact info easily
                    from search_providers import extract_contact_info
                    contacts = extract_contact_info(page_text)
                    observation = f"Scraped Text Summary:\n{page_text[:1000]}\nExtracted Potential Numbers: {contacts.get('phone_numbers')}"
                    yield {"type": "log", "message": f"  ↳ Webpage scraped ({len(page_text)} chars). Found numbers: {contacts.get('phone_numbers')}"}

                elif action_name == "save_business":
                    business_data = action_params.get("business_data", {})
                    yield {"type": "log", "message": f"💾 Saving business record: '{business_data.get('name')}'..."}
                    
                    # Ensure queried_at and query are present
                    business_data["queried_at"] = business_data.get("queried_at", time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()))
                    business_data["query"] = self.query
                    
                    res = db_manager.save_business(business_data)
                    observation = json.dumps(res)
                    
                    if res.get("status") == "saved":
                        self.saved_count += 1
                        self.saved_businesses.append(business_data)
                        yield {
                            "type": "business_saved", 
                            "count": self.saved_count, 
                            "business": business_data,
                            "message": f"🎉 Successfully saved '{business_data.get('name')}'! (Count: {self.saved_count}/10)"
                        }
                    else:
                        yield {"type": "log", "message": f"  ↳ Result: {res.get('status')} - Not added to saved count."}

                elif action_name == "finish":
                    yield {"type": "log", "message": f"🏁 Agent finished search! Total businesses saved: {self.saved_count}"}
                    break

                else:
                    observation = f"Error: Unknown tool '{action_name}'"
                    yield {"type": "log", "message": f"❌ Tool execution failed: {observation}"}

            except Exception as e:
                observation = f"Error executing tool: {str(e)}"
                yield {"type": "log", "message": f"❌ Exception in tool '{action_name}': {str(e)}"}

            # Update conversational history
            chat_history.append({"role": "assistant", "content": response_text})
            
            obs_msg = (
                f"Observation from tool call '{action_name}': {observation}\n\n"
                f"Status: You have successfully saved {self.saved_count} unique businesses. "
                f"Target is 10. Proceed with the next step."
            )
            chat_history.append({"role": "user", "content": obs_msg})

        yield {
            "type": "complete",
            "saved_count": self.saved_count,
            "message": f"Process complete. Retrieved and saved {self.saved_count} businesses."
        }
