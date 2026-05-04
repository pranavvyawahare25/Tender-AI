# TenderAI — Automated Tender Evaluation & Bidder Eligibility Analysis

AI-powered platform for automating government tender evaluation and bidder eligibility analysis. Built for CRPF-style procurement use cases.

## Features

- **Document Processing**: Upload tender documents (PDF/Image/DOCX) and extract text via OCR
- **AI Criteria Extraction**: Automatically identify eligibility criteria from tender documents
- **Bidder Data Extraction**: Extract relevant data from bidder submissions
- **Rule-Based Matching**: Compare bidder data against criteria with PASS/FAIL/REVIEW decisions
- **Explainable Decisions**: Every decision includes source document, page number, reason, and confidence
- **Manual Override**: Review and override AI decisions with audit trail
- **Report Generation**: Download PDF and JSON evaluation reports
- **Audit Log**: Complete audit trail of all actions

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────────┐
│   React Frontend    │────▶│      FastAPI Backend         │
│   (Vite + React)    │     │                              │
│                     │     │  ┌─────────┐ ┌────────────┐  │
│  - Upload UI        │     │  │   OCR   │ │  Extractors│  │
│  - Criteria View    │     │  │ Service │ │  (Tender/  │  │
│  - Eval Results     │     │  │         │ │   Bidder)  │  │
│  - Reports          │     │  └────┬────┘ └─────┬──────┘  │
│  - Audit Log        │     │       │             │         │
│                     │     │  ┌────▼─────────────▼──────┐  │
└─────────────────────┘     │  │   Matching Engine       │  │
                            │  │   + Confidence Scorer   │  │
                            │  └────────────┬────────────┘  │
                            │               │               │
                            │  ┌────────────▼────────────┐  │
                            │  │   Local JSON Storage    │  │
                            │  │   + Audit Log           │  │
                            │  └─────────────────────────┘  │
                            └──────────────────────────────┘
```

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** (for frontend)
- **Tesseract OCR** (optional, for scanned document support)

### Install Tesseract (macOS)
```bash
brew install tesseract
```

## Quick Start

### 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Generate Sample Data

```bash
cd backend
python -m sample_data.generate_samples
```

### 3. Start Backend Server

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: http://localhost:8000/docs

### 4. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: http://localhost:5173

## Demo Workflow

1. **Upload Tender**: Use the sample tender from `backend/sample_data/generated/sample_tender_crpf.pdf`
2. **Extract Criteria**: Click "Extract Criteria with AI" to analyze the tender
3. **Upload Bidders**: Upload bidder documents one by one:
   - `bidder_techvision_solutions.pdf` — Expected: **ELIGIBLE** (passes all)
   - `bidder_bharat_infra.pdf` — Expected: **NOT ELIGIBLE** (fails turnover, projects, ISO)
   - `bidder_securenet_systems.pdf` — Expected: **NEEDS REVIEW** (PAN unclear)
4. **Evaluate**: Click "Evaluate All Bidders"
5. **Review**: Inspect results, override decisions, download reports

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload_tender` | Upload tender document |
| POST | `/api/extract_criteria/{id}` | Extract criteria from tender |
| GET | `/api/tender/{id}` | Get tender info |
| POST | `/api/upload_bidder_docs/{id}` | Upload bidder documents |
| POST | `/api/extract_bidder_data/{id}/{bid}` | Extract bidder data |
| GET | `/api/bidders/{id}` | List bidders |
| POST | `/api/evaluate_bidders/{id}` | Run evaluation |
| GET | `/api/evaluation/{id}` | Get evaluation results |
| POST | `/api/override/{id}/{bid}` | Override a decision |
| GET | `/api/report/{id}/json` | Download JSON report |
| GET | `/api/report/{id}/pdf` | Download PDF report |
| GET | `/api/audit_log/{id}` | Get audit log |

## Tech Stack

- **Frontend**: React 18 + Vite 5
- **Backend**: FastAPI + Uvicorn
- **OCR**: PyMuPDF (native PDF) + Tesseract (scanned)
- **Reports**: ReportLab (PDF generation)
- **Storage**: Local filesystem + JSON

## License

MIT
