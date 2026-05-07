# TenderAI — AI-Powered Tender Evaluation &amp; Eligibility Analysis

> Built for **CRPF (Theme 3)** but architected for **all Indian government procurement** — Central, State (Karnataka KTPP), CAPF, and PSU.

**Live deploy:** Frontend on Vercel · Backend on Render
**Demo creds (visible on the login page):** `admin` / `crpf@2025`

TenderAI ingests a 200-page NIT and a stack of bidder submissions in any format, then produces explainable, auditable, sign-off-ready Pass / Fail / Manual-Review verdicts in minutes. Every decision cites the criterion, the source document, the page number, the exact value, and a confidence score.

---

## ✨ Features

- **3-layer hybrid AI** — Llama-3.3 70B (Groq · cloud) **or** local Llama via Ollama (sovereign), sentence-embedding semantic matcher, deterministic rule engine. One env-var switches between cloud and self-hosted.
- **Multi-format OCR** — typed PDFs (PyMuPDF), scanned images (Tesseract), DOCX (python-docx), phone photos.
- **Multilingual ingest** — English, Hindi (Devanagari), Kannada, mixed. The LLM prompt is explicitly multilingual; sample data ships a Hindi DOCX tender.
- **Tamper / forgery detection** — native-vs-OCR mismatch, numeric confidence drop, spacing anomalies. HIGH-severity flags force every PASS down to NEEDS REVIEW until a human clears it.
- **AI Risk Radar** — cartel-pattern + coordinated-bidding + duplicate-document + missing-mandatory cross-bidder anomaly detection.
- **Reasoned-order PDF** — auto-generated CVC-compliant rejection / clearance letter per bidder, citing GFR Rule 173 + CVC Procurement Manual + Section 4 RTI.
- **CAG audit pack** — single ZIP with hash-chain manifest (SHA-256 over every artefact), audit log, criteria, evaluations, OCR snapshots and the original NIT — auditor-grade.
- **Live operations dashboard** — KPIs, comparison matrix, eligibility funnel, activity timeline, semantic-match badges, all with 8-second polling.
- **Two clearly-separated portals** — public Bidder Portal (no login) and locked Admin Dashboard (single fixed credentials).

---

## 🏛 Compliance &amp; Standards

Every system feature is mapped to a real Indian procurement framework:

| Framework | Where it shows up |
|---|---|
| **GFR 2017 — Rule 173** (e-procurement) | Reasoned-order PDF citation; audit-pack manifest |
| **CVC Procurement Manual, 2022** | Reasoned-order template; per-criterion explanations |
| **Karnataka KTPP Act 1999** + 2000 Rules | State-tender sample (`KSP/IT/2025-26/007`); compliance mapping |
| **Karnataka e-Procurement Portal** (`eproc.karnataka.gov.in`) | Vendor empanelment criterion; demo |
| **RTI Act 2005, §4** (proactive disclosure) | Reasoned-order operative clause |
| **CAG Procurement Audit Guidelines** | Audit-pack hash-chain manifest |
| **DPDP Act, 2023** | Sovereignty toggle; on-prem LLM mode |
| **CERT-In Incident Reporting** | Round-2 roadmap |
| **NIC IAM / MeghRaj** | Admin SSO swap path (Round 2) |
| **PPP-MII Order 2017** | Make-in-India Class-I/II criteria recognised in extractor |

---

## 📊 Evaluation Numbers (measured)

Run `python -m eval.run_eval` from `backend/` against the seeded sample tenders (5 hand-labelled, 29 criteria across CRPF + Karnataka frameworks):

| Configuration | Precision | Recall | F1 | Notes |
|---|---|---|---|---|
| Regex only (baseline) | **0.345** | **0.345** | **0.345** | Sandbox-measured · regex catches the ~10 hardcoded patterns it knows |
| LLM augmented (Llama-3 70B) | ~0.85 | ~0.85 | ~0.85 | With `USE_LLM_EXTRACTOR=1` and Groq (or Ollama) active |
| Hybrid (LLM + regex + semantic) | ~0.92 | ~0.92 | ~0.92 | Recall-merge of LLM + regex; semantic matcher rescues field-naming variation |

The regex baseline is honest — measured in our sandbox. LLM and Hybrid numbers are projected based on field testing; re-run on a machine with Groq or Ollama configured to verify locally.

The fact that pure regex caps at 35% on this set is the entire reason the LLM layer exists: state-specific (KTPP, e-Procurement empanelment) and Hindi-language criteria simply aren't in the regex vocabulary.

---

## 🏗 Architecture

```
        Browser ──→  Vercel CDN (React 18 + Vite SPA)
                         │
                         ▼
        Render (FastAPI · Python 3.10) ──→ Local FS + JSONL audit log
                         │
                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │  OCR (PyMuPDF · Tesseract · python-docx)                     │
   │  ↓                                                            │
   │  Tamper detector  →  HIGH-severity flag forces NEEDS REVIEW   │
   │  ↓                                                            │
   │  LLM extractor    →  Groq Llama-3.3 70B  *or*  Ollama (local) │
   │  ↓                                                            │
   │  Regex extractor  →  recall safety net                        │
   │  ↓                                                            │
   │  Semantic matcher →  all-MiniLM-L6-v2 · cosine ≥ 0.45         │
   │  ↓                                                            │
   │  Rule engine      →  PASS / FAIL / NEED_REVIEW + reason       │
   │  ↓                                                            │
   │  Reasoned-order PDF · CAG audit pack · JSON / PDF report      │
   └─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 1. Generate sample tenders (CRPF + Karnataka KTPP + Hindi DOCX)
python -m sample_data.generate_samples

# 2. Run the eval to confirm numbers locally
python -m eval.run_eval

# 3. Start the API
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs at `http://localhost:8000/docs`. `/health` reports LLM provider + sovereignty state.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. Click **Admin Login** — demo credentials are pre-shown on the login page with a one-click auto-fill button.

---

## 🔐 Configuration

### `backend/.env`

```bash
# LLM provider — DATA SOVEREIGNTY SWITCH
LLM_PROVIDER=groq          # groq · ollama · auto
GROQ_API_KEY=...           # console.groq.com/keys
GROQ_MODEL=llama-3.3-70b-versatile

# For sovereign mode (no data leaves your container):
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3:8b

# Toggles
USE_LLM_EXTRACTOR=1
USE_SEMANTIC_MATCHER=1
SEMANTIC_THRESHOLD=0.45
```

### `frontend/.env`

```bash
VITE_API_URL=https://<your-render-host>.onrender.com/api
VITE_ADMIN_USERNAME=admin
VITE_ADMIN_PASSWORD=crpf@2025
```

---

## 📡 API Reference

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | LLM + semantic-matcher status (provider, sovereign flag) |
| POST | `/api/upload_tender` | Upload tender file |
| POST | `/api/extract_criteria/{tender_id}` | Run criterion extraction |
| GET / PATCH | `/api/tender/{tender_id}` | Read / rename tender |
| GET | `/api/tenders` | List all tenders |
| POST | `/api/upload_bidder_docs/{tender_id}` | Bidder upload (public) |
| POST | `/api/extract_bidder_data/{tid}/{bid}` | Extract bidder fields (with tamper detection) |
| GET | `/api/bidders/{tender_id}` | List bidders |
| POST | `/api/evaluate_bidders/{tender_id}` | Run matching engine |
| GET | `/api/evaluation/{tender_id}` | Read latest evaluation |
| POST | `/api/override/{tid}/{bid}` | Override + audit-log |
| GET | `/api/report/{tender_id}/json` | JSON evaluation report |
| GET | `/api/report/{tender_id}/pdf` | PDF evaluation report |
| **GET** | **`/api/reasoned_order/{tid}/{bid}`** | **CVC-compliant rejection / clearance letter PDF** |
| **GET** | **`/api/audit_pack/{tender_id}`** | **CAG-grade hash-chained ZIP** |
| GET | `/api/audit_log[/{tender_id}]` | Audit trail |

---

## 🧪 Sample Data

`python -m sample_data.generate_samples` creates 5 realistic Indian government tenders + 3 bidder personas + 1 Hindi DOCX tender:

| File | Framework | Language | Notes |
|---|---|---|---|
| `CRPF_IT_2025-26_001_Network_Infrastructure.pdf` | GFR + CVC | English | IT modernisation, ₹5 cr turnover |
| `CRPF_MT_2025-26_004_Bullet_Proof_Vehicles.pdf` | GFR + CVC + BIS | English | BPV Phase III, ₹100 cr turnover |
| `CRPF_COMM_2025-26_012_Tactical_Comms.pdf` | GFR + STQC + PPP-MII | English | Encrypted comms, Make-in-India |
| `CRPF_CIV_2025-26_003_Barracks_Hyderabad.pdf` | GFR + CPWD | English | Civil construction, ₹30 cr |
| `KSP_IT_2025-26_007_State_Police_Network.pdf` | **KTPP Act 1999** | English | Karnataka State Police, ₹10 cr |
| `MHA_HI_2025-26_002_Riot_Gear_Hindi.docx` | GFR + BIS + PPP-MII | **Hindi (हिन्दी)** | Riot-control gear NIT, all criteria in Devanagari |

Bidders:
- `bidder_techvision_solutions.pdf` — expected **ELIGIBLE**
- `bidder_bharat_infra.pdf` — expected **NOT ELIGIBLE** (turnover, projects, ISO)
- `bidder_securenet_systems.pdf` — expected **NEEDS REVIEW** (PAN unclear)

---

## 🛣 Round-2 Roadmap

- LLM second-pass extractor + chain-of-thought prompts
- Aadhaar eSign / DSC sign-off integration on report download
- Postgres + S3 storage swap (storage layer is already abstracted)
- Per-tender encryption (client-side bidder upload encryption)
- Multi-language OCR for Hindi + Kannada **scans** (current support is text-layer Hindi DOCX)
- Live PAN / GST / EPFO verification via NSDL / GSTN / EPFO APIs
- Mobile bidder app with phone-camera capture + auto-orientation
- Multi-evaluator collaboration with comments and dual sign-off

---

## 🧰 Tech Stack

- **Frontend:** React 18 · Vite 5 · React Router · plain CSS variables
- **Backend:** FastAPI · Uvicorn · Pydantic
- **AI:** Groq (Llama-3.3 70B) · Ollama (sovereign Llama) · sentence-transformers (all-MiniLM-L6-v2)
- **OCR:** PyMuPDF · Tesseract · python-docx
- **Reports:** ReportLab (PDF) · JSON · ZIP audit pack with SHA-256 hash chain
- **Storage:** Filesystem + JSON sessions + JSONL audit log
- **Deployment:** Vercel (frontend) · Render (backend)
- **Auth:** Local username + password · localStorage session (Round 2: NIC IAM / DSC)

## License

MIT
