# Created automatically by Cursor AI (2024-08-27)

import asyncio
import logging
from fastapi import FastAPI
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting Finance Tracker Workers...")
    yield
    # Shutdown
    logger.info("Shutting down Finance Tracker Workers...")

app = FastAPI(
    title="Finance Tracker Workers",
    description="AI-Powered Personal Finance Tracker Worker Services",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/")
async def root():
    return {"message": "Finance Tracker Workers API"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
