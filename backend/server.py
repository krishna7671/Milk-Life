from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import random

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Product type configurations with optimal conditions and base shelf life (in days)
PRODUCT_CONFIGS = {
    "milk": {
        "optimal_temp": 4.0,
        "temp_tolerance": 2.0,
        "optimal_humidity": 50,
        "base_shelf_life": 7,
        "icon": "🥛"
    },
    "cheese": {
        "optimal_temp": 5.0,
        "temp_tolerance": 3.0,
        "optimal_humidity": 60,
        "base_shelf_life": 30,
        "icon": "🧀"
    },
    "yogurt": {
        "optimal_temp": 4.0,
        "temp_tolerance": 2.0,
        "optimal_humidity": 50,
        "base_shelf_life": 14,
        "icon": "🥣"
    },
    "butter": {
        "optimal_temp": 4.0,
        "temp_tolerance": 3.0,
        "optimal_humidity": 40,
        "base_shelf_life": 60,
        "icon": "🧈"
    },
    "cream": {
        "optimal_temp": 3.0,
        "temp_tolerance": 1.5,
        "optimal_humidity": 50,
        "base_shelf_life": 10,
        "icon": "🥛"
    }
}

# Define Models
class Product(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    product_type: str  # milk, cheese, yogurt, butter, cream
    batch_number: str
    quantity: float  # in liters or kg
    unit: str  # L or kg
    added_date: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    current_temperature: Optional[float] = None
    current_humidity: Optional[float] = None
    status: str = "fresh"  # fresh, good, warning, expired
    shelf_life_percentage: float = 100.0
    estimated_expiry: Optional[datetime] = None

class ProductCreate(BaseModel):
    name: str
    product_type: str
    batch_number: str
    quantity: float
    unit: str

class SensorReading(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    product_id: str
    temperature: float
    humidity: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

def calculate_shelf_life(product_type: str, added_date: datetime, current_temp: float, current_humidity: float):
    """Calculate remaining shelf life based on storage conditions"""
    config = PRODUCT_CONFIGS.get(product_type.lower())
    if not config:
        return 100.0, "fresh", None
    
    # Calculate time elapsed
    time_elapsed = (datetime.now(timezone.utc) - added_date).total_seconds() / 86400  # in days
    base_shelf_life = config["base_shelf_life"]
    
    # Calculate temperature deviation factor
    temp_deviation = abs(current_temp - config["optimal_temp"])
    temp_factor = 1.0
    if temp_deviation > config["temp_tolerance"]:
        # Every degree above tolerance reduces shelf life by 15%
        temp_factor = 1.0 + (temp_deviation - config["temp_tolerance"]) * 0.15
    
    # Calculate humidity deviation factor
    humidity_deviation = abs(current_humidity - config["optimal_humidity"])
    humidity_factor = 1.0
    if humidity_deviation > 20:
        # High humidity deviation reduces shelf life by 5% per 10% deviation
        humidity_factor = 1.0 + (humidity_deviation - 20) * 0.005
    
    # Adjusted shelf life
    adjusted_shelf_life = base_shelf_life / (temp_factor * humidity_factor)
    
    # Calculate remaining percentage
    shelf_life_percentage = max(0, ((adjusted_shelf_life - time_elapsed) / adjusted_shelf_life) * 100)
    
    # Determine status
    if shelf_life_percentage > 70:
        status = "fresh"
    elif shelf_life_percentage > 40:
        status = "good"
    elif shelf_life_percentage > 0:
        status = "warning"
    else:
        status = "expired"
    
    # Calculate estimated expiry
    estimated_expiry = added_date + timedelta(days=adjusted_shelf_life)
    
    return shelf_life_percentage, status, estimated_expiry

# Routes
@api_router.get("/")
async def root():
    return {"message": "Milk Shelf Life Predictor API"}

@api_router.post("/products", response_model=Product)
async def create_product(input: ProductCreate):
    """Add a new milk product"""
    if input.product_type.lower() not in PRODUCT_CONFIGS:
        raise HTTPException(status_code=400, detail="Invalid product type")
    
    product_dict = input.model_dump()
    product_obj = Product(**product_dict)
    
    # Initialize with optimal conditions
    config = PRODUCT_CONFIGS[input.product_type.lower()]
    product_obj.current_temperature = config["optimal_temp"]
    product_obj.current_humidity = config["optimal_humidity"]
    product_obj.estimated_expiry = product_obj.added_date + timedelta(days=config["base_shelf_life"])
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = product_obj.model_dump()
    doc['added_date'] = doc['added_date'].isoformat()
    if doc['estimated_expiry']:
        doc['estimated_expiry'] = doc['estimated_expiry'].isoformat()
    
    await db.products.insert_one(doc)
    
    # Create initial sensor reading
    sensor_reading = SensorReading(
        product_id=product_obj.id,
        temperature=product_obj.current_temperature,
        humidity=product_obj.current_humidity
    )
    sensor_doc = sensor_reading.model_dump()
    sensor_doc['timestamp'] = sensor_doc['timestamp'].isoformat()
    await db.sensor_readings.insert_one(sensor_doc)
    
    return product_obj

@api_router.get("/products", response_model=List[Product])
async def get_products():
    """Get all products with updated status"""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO strings back to datetime and update status
    for product in products:
        if isinstance(product['added_date'], str):
            product['added_date'] = datetime.fromisoformat(product['added_date'])
        if product.get('estimated_expiry') and isinstance(product['estimated_expiry'], str):
            product['estimated_expiry'] = datetime.fromisoformat(product['estimated_expiry'])
        
        # Recalculate shelf life with current conditions
        if product.get('current_temperature') is not None and product.get('current_humidity') is not None:
            shelf_life_percentage, status, estimated_expiry = calculate_shelf_life(
                product['product_type'],
                product['added_date'],
                product['current_temperature'],
                product['current_humidity']
            )
            product['shelf_life_percentage'] = shelf_life_percentage
            product['status'] = status
            product['estimated_expiry'] = estimated_expiry
    
    return products

@api_router.get("/products/{product_id}", response_model=Product)
async def get_product(product_id: str):
    """Get a specific product"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Convert ISO strings back to datetime
    if isinstance(product['added_date'], str):
        product['added_date'] = datetime.fromisoformat(product['added_date'])
    if product.get('estimated_expiry') and isinstance(product['estimated_expiry'], str):
        product['estimated_expiry'] = datetime.fromisoformat(product['estimated_expiry'])
    
    # Recalculate shelf life
    if product.get('current_temperature') is not None and product.get('current_humidity') is not None:
        shelf_life_percentage, status, estimated_expiry = calculate_shelf_life(
            product['product_type'],
            product['added_date'],
            product['current_temperature'],
            product['current_humidity']
        )
        product['shelf_life_percentage'] = shelf_life_percentage
        product['status'] = status
        product['estimated_expiry'] = estimated_expiry
    
    return product

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str):
    """Delete a product"""
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Also delete associated sensor readings
    await db.sensor_readings.delete_many({"product_id": product_id})
    
    return {"message": "Product deleted successfully"}

@api_router.get("/sensor-data/{product_id}", response_model=List[SensorReading])
async def get_sensor_data(product_id: str, limit: int = 50):
    """Get sensor readings for a product"""
    readings = await db.sensor_readings.find(
        {"product_id": product_id},
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    # Convert ISO strings back to datetime
    for reading in readings:
        if isinstance(reading['timestamp'], str):
            reading['timestamp'] = datetime.fromisoformat(reading['timestamp'])
    
    return readings[::-1]  # Return in chronological order

@api_router.post("/simulate-sensor/{product_id}")
async def simulate_sensor(product_id: str):
    """Simulate sensor reading for a product"""
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    config = PRODUCT_CONFIGS[product['product_type'].lower()]
    
    # Simulate temperature and humidity with random variations
    temp_variation = random.uniform(-3, 5)  # Can go higher (spoilage scenario)
    humidity_variation = random.uniform(-10, 15)
    
    new_temperature = config["optimal_temp"] + temp_variation
    new_humidity = config["optimal_humidity"] + humidity_variation
    
    # Create sensor reading
    sensor_reading = SensorReading(
        product_id=product_id,
        temperature=round(new_temperature, 1),
        humidity=round(new_humidity, 1)
    )
    sensor_doc = sensor_reading.model_dump()
    sensor_doc['timestamp'] = sensor_doc['timestamp'].isoformat()
    await db.sensor_readings.insert_one(sensor_doc)
    
    # Update product with latest readings
    await db.products.update_one(
        {"id": product_id},
        {"$set": {
            "current_temperature": sensor_reading.temperature,
            "current_humidity": sensor_reading.humidity
        }}
    )
    
    return sensor_reading

@api_router.get("/product-types")
async def get_product_types():
    """Get available product types"""
    return [
        {
            "type": ptype,
            "icon": config["icon"],
            "optimal_temp": config["optimal_temp"],
            "shelf_life_days": config["base_shelf_life"]
        }
        for ptype, config in PRODUCT_CONFIGS.items()
    ]

@api_router.get("/alerts")
async def get_alerts():
    """Get products that need attention (warning or expired)"""
    products = await db.products.find({}, {"_id": 0}).to_list(1000)
    
    alerts = []
    for product in products:
        if isinstance(product['added_date'], str):
            product['added_date'] = datetime.fromisoformat(product['added_date'])
        
        if product.get('current_temperature') is not None and product.get('current_humidity') is not None:
            shelf_life_percentage, status, _ = calculate_shelf_life(
                product['product_type'],
                product['added_date'],
                product['current_temperature'],
                product['current_humidity']
            )
            
            if status in ["warning", "expired"]:
                alerts.append({
                    "product_id": product['id'],
                    "product_name": product['name'],
                    "product_type": product['product_type'],
                    "status": status,
                    "shelf_life_percentage": shelf_life_percentage,
                    "message": f"{product['name']} is {status}!"
                })
    
    return alerts

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()