"""
Configuration constants for the Tender Evaluation Platform.
"""
import os

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
SAMPLE_DATA_DIR = os.path.join(BASE_DIR, "sample_data")

# Storage subdirectories
TENDERS_DIR = os.path.join(DATA_DIR, "tenders")
BIDDERS_DIR = os.path.join(DATA_DIR, "bidders")
EXTRACTIONS_DIR = os.path.join(DATA_DIR, "extractions")
EVALUATIONS_DIR = os.path.join(DATA_DIR, "evaluations")
REPORTS_DIR = os.path.join(DATA_DIR, "reports")

# All data directories to ensure exist
DATA_SUBDIRS = [TENDERS_DIR, BIDDERS_DIR, EXTRACTIONS_DIR, EVALUATIONS_DIR, REPORTS_DIR]

# OCR Configuration
OCR_CONFIDENCE_THRESHOLD = 0.75  # Below this → flag for manual review
TESSERACT_CONFIG = "--oem 3 --psm 6"  # LSTM engine, uniform block
PDF_DPI = 300  # Resolution for PDF-to-image conversion

# LLM extraction configuration
USE_LLM_EXTRACTOR = os.getenv("USE_LLM_EXTRACTOR", "1").strip() != "0"
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("GROQ_API_KEY", "")
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")
LLM_MODEL = os.getenv("LLM_MODEL") or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
LLM_TIMEOUT = float(os.getenv("LLM_TIMEOUT", "30"))

# Backward-compatible Groq names used by older code and .env files.
GROQ_API_KEY = LLM_API_KEY
GROQ_MODEL = LLM_MODEL

# Semantic matching configuration
USE_SEMANTIC_MATCHER = os.getenv("USE_SEMANTIC_MATCHER", "1").strip() != "0"
SEMANTIC_MODEL = os.getenv("SEMANTIC_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
SEMANTIC_THRESHOLD = float(os.getenv("SEMANTIC_THRESHOLD", "0.45"))

# Supported file types
SUPPORTED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".bmp", ".docx"}

# CORS
CORS_ORIGINS = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
    "https://tender-ai.vercel.app",
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    CORS_ORIGINS.append(frontend_url)

# Indian number system conversion
CRORE = 10_000_000
LAKH = 100_000
