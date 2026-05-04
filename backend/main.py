"""
Tender Evaluation Platform — FastAPI Backend
Main application entry point.
"""
import os
from dotenv import load_dotenv

# Load .env file FIRST (before any module reads env vars)
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS, DATA_SUBDIRS
from storage.store import ensure_directories
from routers import tender, bidder, evaluation, report

app = FastAPI(
    title="Tender Evaluation Platform",
    description="AI-powered Automated Tender Evaluation & Bidder Eligibility Analysis",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(tender.router)
app.include_router(bidder.router)
app.include_router(evaluation.router)
app.include_router(report.router)


@app.on_event("startup")
async def startup():
    """Initialize data directories on startup."""
    ensure_directories()


@app.get("/")
async def root():
    return {"message": "Tender Evaluation Platform API", "version": "1.0.0", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
