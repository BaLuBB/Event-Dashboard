from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import httpx
from contextlib import asynccontextmanager
import asyncio
from zoneinfo import ZoneInfo

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Settings
JWT_SECRET = os.environ.get('JWT_SECRET', 'event-dashboard-secret-key-change-in-production')
JWT_ALGORITHM = "HS256"

# N8N Webhook URL
N8N_WEBHOOK_URL = os.environ.get('N8N_WEBHOOK_URL', '')

# External State API
EXTERNAL_STATE_API = os.environ.get('EXTERNAL_STATE_API', 'http://127.0.0.1:3100/api/state')

# Timezone (default: Europe/Berlin for German events)
EVENT_TIMEZONE = os.environ.get('EVENT_TIMEZONE', 'Europe/Berlin')

security = HTTPBearer(auto_error=False)

# Background task reference
auto_advance_task = None

# =============== BACKGROUND TASKS ===============

async def auto_advance_loop():
    """Background task that checks if current item has ended and advances to next"""
    tz = ZoneInfo(EVENT_TIMEZONE)
    
    while True:
        try:
            settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
            if settings and not settings.get("is_paused", False) and settings.get("auto_advance", True):
                current_item = await db.schedule.find_one({"is_current": True}, {"_id": 0})
                
                if current_item:
                    now = datetime.now(tz)
                    end_time_str = current_item.get("end_time", "")
                    
                    if end_time_str:
                        try:
                            end_hours, end_minutes = map(int, end_time_str.split(":"))
                            end_time = now.replace(hour=end_hours, minute=end_minutes, second=0, microsecond=0)
                            
                            # Debug log
                            logging.debug(f"Auto-advance check: now={now.strftime('%H:%M:%S')}, end_time={end_time.strftime('%H:%M:%S')}, current={current_item['title']}")
                            
                            if now >= end_time:
                                # Time's up - advance to next item
                                items = await db.schedule.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
                                current_idx = next((i for i, item in enumerate(items) if item["id"] == current_item["id"]), -1)
                                
                                logging.info(f"Time expired for '{current_item['title']}' (ended {end_time_str}), advancing...")
                                
                                if current_idx >= 0 and current_idx < len(items) - 1:
                                    next_item = items[current_idx + 1]
                                    await db.schedule.update_many({}, {"$set": {"is_current": False}})
                                    await db.schedule.update_one({"id": next_item["id"]}, {"$set": {"is_current": True}})
                                    await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": next_item["id"]}})
                                    logging.info(f"Auto-advanced to: {next_item['title']}")
                                    
                                    # Sync to external API (don't wait/block on failure)
                                    try:
                                        await sync_state_to_external()
                                    except Exception as sync_err:
                                        logging.warning(f"Sync failed (non-blocking): {sync_err}")
                                elif current_idx == len(items) - 1:
                                    # Last item finished - clear current
                                    await db.schedule.update_many({}, {"$set": {"is_current": False}})
                                    await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": None}})
                                    logging.info("Event ended - last item completed")
                        except ValueError as ve:
                            logging.error(f"Invalid time format: {end_time_str}, error: {ve}")
        except Exception as e:
            logging.error(f"Auto-advance error: {e}")
        
        await asyncio.sleep(5)  # Check every 5 seconds

async def sync_state_to_external():
    """Send current state to external API"""
    if not EXTERNAL_STATE_API:
        return
    
    try:
        state = await get_full_state()
        async with httpx.AsyncClient() as http_client:
            response = await http_client.post(EXTERNAL_STATE_API, json=state, timeout=10)
            logging.info(f"Synced state to external API: {response.status_code}")
    except Exception as e:
        logging.error(f"Failed to sync to external API: {e}")

async def get_full_state() -> Dict[str, Any]:
    """Get complete state for sync"""
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    phases = await db.phases.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    schedule = await db.schedule.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    
    return {
        "settings": settings or {},
        "phases": phases,
        "schedule": schedule,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

# =============== STARTUP ===============

async def notify_n8n_startup():
    if N8N_WEBHOOK_URL:
        try:
            import socket
            hostname = socket.gethostname()
            local_ip = socket.gethostbyname(hostname)
            
            async with httpx.AsyncClient() as client_http:
                await client_http.post(N8N_WEBHOOK_URL, json={
                    "event": "startup",
                    "hostname": hostname,
                    "ip": local_ip,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "message": f"Event Dashboard gestartet auf {local_ip}"
                }, timeout=10)
            logging.info(f"N8N notified: IP={local_ip}")
        except Exception as e:
            logging.error(f"Failed to notify N8N: {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    global auto_advance_task
    await notify_n8n_startup()
    await init_default_data()
    
    # Start auto-advance background task
    auto_advance_task = asyncio.create_task(auto_advance_loop())
    logging.info("Auto-advance task started")
    
    yield
    
    # Cancel background task
    if auto_advance_task:
        auto_advance_task.cancel()
        try:
            await auto_advance_task
        except asyncio.CancelledError:
            pass
    
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# =============== MODELS ===============

class AdminUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    username: str
    password_hash: str
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class AdminUserCreate(BaseModel):
    username: str
    password: str

class AdminLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    token: str
    username: str

class Phase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    color: str = "#3b82f6"
    order: int = 0

class PhaseCreate(BaseModel):
    name: str
    color: str = "#3b82f6"
    order: int = 0

class ScheduleItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    start_time: str
    end_time: str
    phase_id: Optional[str] = None
    notes: str = ""
    order: int = 0
    is_current: bool = False

class ScheduleItemCreate(BaseModel):
    title: str
    description: str = ""
    start_time: str
    end_time: str
    phase_id: Optional[str] = None
    notes: str = ""
    order: int = 0

class ScheduleItemUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    phase_id: Optional[str] = None
    notes: Optional[str] = None
    order: Optional[int] = None
    is_current: Optional[bool] = None

class EventSettings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "main"
    event_name: str = "Event Dashboard"
    event_date: str = ""
    primary_color: str = "#3b82f6"
    accent_color: str = "#ef4444"
    background_color: str = "#09090b"
    surface_color: str = "#18181b"
    text_color: str = "#fafafa"
    is_paused: bool = False
    current_item_id: Optional[str] = None
    show_countdown: bool = True
    auto_scroll: bool = True
    auto_advance: bool = True  # New: Auto advance to next item

class EventSettingsUpdate(BaseModel):
    event_name: Optional[str] = None
    event_date: Optional[str] = None
    primary_color: Optional[str] = None
    accent_color: Optional[str] = None
    background_color: Optional[str] = None
    surface_color: Optional[str] = None
    text_color: Optional[str] = None
    is_paused: Optional[bool] = None
    current_item_id: Optional[str] = None
    show_countdown: Optional[bool] = None
    auto_scroll: Optional[bool] = None
    auto_advance: Optional[bool] = None

class ReorderRequest(BaseModel):
    item_ids: List[str]

class FullState(BaseModel):
    settings: Dict[str, Any]
    phases: List[Dict[str, Any]]
    schedule: List[Dict[str, Any]]
    timestamp: Optional[str] = None

# =============== AUTH HELPERS ===============

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())

def create_token(username: str) -> str:
    payload = {
        "username": username,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Nicht autorisiert")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload["username"]
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token abgelaufen")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Ungültiger Token")

# =============== INIT DEFAULT DATA ===============

async def init_default_data():
    # Create default admin if not exists
    admin = await db.admins.find_one({"username": "admin"})
    if not admin:
        admin_user = AdminUser(
            username="admin",
            password_hash=hash_password("admin123")
        )
        await db.admins.insert_one(admin_user.model_dump())
        logging.info("Default admin created: admin/admin123")
    
    # Create default settings if not exists
    settings = await db.settings.find_one({"id": "main"})
    if not settings:
        default_settings = EventSettings()
        await db.settings.insert_one(default_settings.model_dump())
        logging.info("Default settings created")
    else:
        # Add auto_advance if missing
        if "auto_advance" not in settings:
            await db.settings.update_one({"id": "main"}, {"$set": {"auto_advance": True}})
    
    # Create default phases if not exists
    phases_count = await db.phases.count_documents({})
    if phases_count == 0:
        default_phases = [
            Phase(name="Vorbereitung", color="#3b82f6", order=0),
            Phase(name="Live", color="#ef4444", order=1),
            Phase(name="Pause", color="#f59e0b", order=2),
            Phase(name="Ende", color="#71717a", order=3)
        ]
        for phase in default_phases:
            await db.phases.insert_one(phase.model_dump())
        logging.info("Default phases created")

# =============== AUTH ROUTES ===============

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(data: AdminLogin):
    admin = await db.admins.find_one({"username": data.username}, {"_id": 0})
    if not admin or not verify_password(data.password, admin["password_hash"]):
        raise HTTPException(status_code=401, detail="Ungültige Anmeldedaten")
    
    token = create_token(data.username)
    return TokenResponse(token=token, username=data.username)

@api_router.get("/auth/verify")
async def verify_token(admin: str = Depends(get_current_admin)):
    return {"valid": True, "username": admin}

@api_router.post("/auth/change-password")
async def change_password(data: AdminUserCreate, admin: str = Depends(get_current_admin)):
    new_hash = hash_password(data.password)
    await db.admins.update_one(
        {"username": admin},
        {"$set": {"password_hash": new_hash}}
    )
    return {"message": "Passwort geändert"}

# =============== SETTINGS ROUTES ===============

@api_router.get("/settings", response_model=EventSettings)
async def get_settings():
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    if not settings:
        return EventSettings()
    return EventSettings(**settings)

@api_router.put("/settings", response_model=EventSettings)
async def update_settings(data: EventSettingsUpdate, admin: str = Depends(get_current_admin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.settings.update_one(
            {"id": "main"},
            {"$set": update_data},
            upsert=True
        )
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    
    # Sync to external API
    await sync_state_to_external()
    
    return EventSettings(**settings)

# =============== PHASES ROUTES ===============

@api_router.get("/phases", response_model=List[Phase])
async def get_phases():
    phases = await db.phases.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    return [Phase(**p) for p in phases]

@api_router.post("/phases", response_model=Phase)
async def create_phase(data: PhaseCreate, admin: str = Depends(get_current_admin)):
    phase = Phase(**data.model_dump())
    await db.phases.insert_one(phase.model_dump())
    await sync_state_to_external()
    return phase

@api_router.put("/phases/{phase_id}", response_model=Phase)
async def update_phase(phase_id: str, data: PhaseCreate, admin: str = Depends(get_current_admin)):
    update_data = data.model_dump()
    await db.phases.update_one({"id": phase_id}, {"$set": update_data})
    phase = await db.phases.find_one({"id": phase_id}, {"_id": 0})
    if not phase:
        raise HTTPException(status_code=404, detail="Phase nicht gefunden")
    await sync_state_to_external()
    return Phase(**phase)

@api_router.delete("/phases/{phase_id}")
async def delete_phase(phase_id: str, admin: str = Depends(get_current_admin)):
    result = await db.phases.delete_one({"id": phase_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Phase nicht gefunden")
    await sync_state_to_external()
    return {"message": "Phase gelöscht"}

# =============== SCHEDULE ROUTES ===============

@api_router.get("/schedule", response_model=List[ScheduleItem])
async def get_schedule():
    items = await db.schedule.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return [ScheduleItem(**item) for item in items]

@api_router.post("/schedule", response_model=ScheduleItem)
async def create_schedule_item(data: ScheduleItemCreate, admin: str = Depends(get_current_admin)):
    # Get max order
    max_item = await db.schedule.find_one({}, {"_id": 0, "order": 1}, sort=[("order", -1)])
    new_order = (max_item["order"] + 1) if max_item else 0
    
    item_data = data.model_dump()
    item_data["order"] = new_order
    item = ScheduleItem(**item_data)
    await db.schedule.insert_one(item.model_dump())
    await sync_state_to_external()
    return item

@api_router.put("/schedule/{item_id}", response_model=ScheduleItem)
async def update_schedule_item(item_id: str, data: ScheduleItemUpdate, admin: str = Depends(get_current_admin)):
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if update_data:
        await db.schedule.update_one({"id": item_id}, {"$set": update_data})
    item = await db.schedule.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Zeitplan-Eintrag nicht gefunden")
    await sync_state_to_external()
    return ScheduleItem(**item)

@api_router.delete("/schedule/{item_id}")
async def delete_schedule_item(item_id: str, admin: str = Depends(get_current_admin)):
    result = await db.schedule.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Zeitplan-Eintrag nicht gefunden")
    await sync_state_to_external()
    return {"message": "Eintrag gelöscht"}

@api_router.post("/schedule/reorder")
async def reorder_schedule(data: ReorderRequest, admin: str = Depends(get_current_admin)):
    for idx, item_id in enumerate(data.item_ids):
        await db.schedule.update_one({"id": item_id}, {"$set": {"order": idx}})
    await sync_state_to_external()
    return {"message": "Reihenfolge aktualisiert"}

# =============== CONTROL ROUTES ===============

@api_router.post("/control/set-current/{item_id}")
async def set_current_item(item_id: str, admin: str = Depends(get_current_admin)):
    # Reset all items
    await db.schedule.update_many({}, {"$set": {"is_current": False}})
    # Set new current
    await db.schedule.update_one({"id": item_id}, {"$set": {"is_current": True}})
    await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": item_id}})
    await sync_state_to_external()
    return {"message": "Aktueller Eintrag gesetzt"}

@api_router.post("/control/clear-current")
async def clear_current_item(admin: str = Depends(get_current_admin)):
    await db.schedule.update_many({}, {"$set": {"is_current": False}})
    await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": None}})
    await sync_state_to_external()
    return {"message": "Aktueller Eintrag zurückgesetzt"}

@api_router.post("/control/pause")
async def toggle_pause(admin: str = Depends(get_current_admin)):
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    new_pause_state = not settings.get("is_paused", False)
    await db.settings.update_one({"id": "main"}, {"$set": {"is_paused": new_pause_state}})
    await sync_state_to_external()
    return {"is_paused": new_pause_state}

@api_router.post("/control/next")
async def next_item(admin: str = Depends(get_current_admin)):
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    current_id = settings.get("current_item_id")
    
    items = await db.schedule.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    if not items:
        return {"message": "Keine Einträge vorhanden"}
    
    if not current_id:
        # Start with first item
        first_item = items[0]
        await db.schedule.update_many({}, {"$set": {"is_current": False}})
        await db.schedule.update_one({"id": first_item["id"]}, {"$set": {"is_current": True}})
        await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": first_item["id"]}})
        await sync_state_to_external()
        return {"current_item_id": first_item["id"]}
    
    # Find next item
    current_idx = next((i for i, item in enumerate(items) if item["id"] == current_id), -1)
    if current_idx < len(items) - 1:
        next_item = items[current_idx + 1]
        await db.schedule.update_many({}, {"$set": {"is_current": False}})
        await db.schedule.update_one({"id": next_item["id"]}, {"$set": {"is_current": True}})
        await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": next_item["id"]}})
        await sync_state_to_external()
        return {"current_item_id": next_item["id"]}
    
    return {"message": "Bereits beim letzten Eintrag"}

@api_router.post("/control/previous")
async def previous_item(admin: str = Depends(get_current_admin)):
    settings = await db.settings.find_one({"id": "main"}, {"_id": 0})
    current_id = settings.get("current_item_id")
    
    if not current_id:
        return {"message": "Kein aktueller Eintrag"}
    
    items = await db.schedule.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    current_idx = next((i for i, item in enumerate(items) if item["id"] == current_id), -1)
    
    if current_idx > 0:
        prev_item = items[current_idx - 1]
        await db.schedule.update_many({}, {"$set": {"is_current": False}})
        await db.schedule.update_one({"id": prev_item["id"]}, {"$set": {"is_current": True}})
        await db.settings.update_one({"id": "main"}, {"$set": {"current_item_id": prev_item["id"]}})
        await sync_state_to_external()
        return {"current_item_id": prev_item["id"]}
    
    return {"message": "Bereits beim ersten Eintrag"}

# =============== STATE SYNC ROUTES ===============

@api_router.get("/state")
async def get_state():
    """Get full state (for dashboard/viewer)"""
    return await get_full_state()

@api_router.post("/state")
async def set_state(state: FullState, admin: str = Depends(get_current_admin)):
    """Set full state from external source (admin only)"""
    try:
        # Update settings
        if state.settings:
            settings_data = {k: v for k, v in state.settings.items() if k != "_id"}
            settings_data["id"] = "main"
            await db.settings.replace_one({"id": "main"}, settings_data, upsert=True)
        
        # Update phases
        if state.phases:
            await db.phases.delete_many({})
            for phase in state.phases:
                phase_data = {k: v for k, v in phase.items() if k != "_id"}
                await db.phases.insert_one(phase_data)
        
        # Update schedule
        if state.schedule:
            await db.schedule.delete_many({})
            for item in state.schedule:
                item_data = {k: v for k, v in item.items() if k != "_id"}
                await db.schedule.insert_one(item_data)
        
        return {"message": "State aktualisiert", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@api_router.post("/state/sync-from-external")
async def sync_from_external(admin: str = Depends(get_current_admin)):
    """Pull state from external API and update local database"""
    if not EXTERNAL_STATE_API:
        raise HTTPException(status_code=400, detail="Keine externe API konfiguriert")
    
    try:
        async with httpx.AsyncClient() as http_client:
            response = await http_client.get(EXTERNAL_STATE_API, timeout=10)
            if response.status_code == 200:
                state = response.json()
                
                # Update local database with external state
                if "settings" in state and state["settings"]:
                    settings_data = {k: v for k, v in state["settings"].items() if k != "_id"}
                    settings_data["id"] = "main"
                    await db.settings.replace_one({"id": "main"}, settings_data, upsert=True)
                
                if "phases" in state and state["phases"]:
                    await db.phases.delete_many({})
                    for phase in state["phases"]:
                        phase_data = {k: v for k, v in phase.items() if k != "_id"}
                        await db.phases.insert_one(phase_data)
                
                if "schedule" in state and state["schedule"]:
                    await db.schedule.delete_many({})
                    for item in state["schedule"]:
                        item_data = {k: v for k, v in item.items() if k != "_id"}
                        await db.schedule.insert_one(item_data)
                
                return {"message": "State von externer API synchronisiert", "timestamp": datetime.now(timezone.utc).isoformat()}
            else:
                raise HTTPException(status_code=response.status_code, detail="Externe API Fehler")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Externe API nicht erreichbar: {str(e)}")

@api_router.post("/state/sync-to-external")
async def sync_to_external(admin: str = Depends(get_current_admin)):
    """Push current state to external API"""
    if not EXTERNAL_STATE_API:
        raise HTTPException(status_code=400, detail="Keine externe API konfiguriert")
    
    try:
        await sync_state_to_external()
        return {"message": "State an externe API gesendet", "timestamp": datetime.now(timezone.utc).isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Sync fehlgeschlagen: {str(e)}")

# =============== STATUS ROUTE ===============

@api_router.get("/")
async def root():
    return {"message": "Event Dashboard API", "status": "running", "external_api": EXTERNAL_STATE_API}

# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)
