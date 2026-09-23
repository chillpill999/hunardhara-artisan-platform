# 🪷 HUNARDHARA (हुनरधारा)
### AI-Driven Market Linkage & Smart Cataloging Platform for Marginalized Artisans
**Smart India Hackathon 2026 (SIH 2026)** • **Problem Statement SIH26090**  
*Ministry of Social Justice and Empowerment (MoSJE), Government of India*  
**Team: Madhavas**

---

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Cloudflare%20Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://hunardhara.technogamerzthenextlevel.workers.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js 15](https://img.shields.io/badge/Next.js%2015-React%2019-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Flutter](https://img.shields.io/badge/Flutter-Mobile%20App-02569B?style=for-the-badge&logo=flutter&logoColor=white)](https://flutter.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL%2016-pgvector%20%2B%20PostGIS-336791?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Tests](https://img.shields.io/badge/Automated%20Tests-369%20PASSED-brightgreen?style=for-the-badge&logo=pytest&logoColor=white)](#-testing--quality-assurance)
[![Compliance](https://img.shields.io/badge/DPDP%20Act%202023-Compliant-blue?style=for-the-badge&logo=shield&logoColor=white)](#-security-privacy--sovereign-compliance)

---

## 📌 Table of Contents
1. [Vision & Problem Statement](#-vision--problem-statement)
2. [The "Speak. Snap. Sell." Paradigm](#-the-speak-snap-sell-paradigm)
3. [Live Deployments & Interactive Links](#-live-deployments--interactive-links)
4. [Key Architectural Pillars](#-key-architectural-pillars)
   - [1. AI Studio Photo Pipeline (Adaptive GrabCut + Shadows)](#1-ai-studio-photo-pipeline)
   - [2. Indic Voice-to-Catalog Engine (Sarvam + Bhashini)](#2-indic-voice-to-catalog-engine)
   - [3. Gemma 4 31B IT Catalog Generation](#3-gemma-4-31b-it-catalog-generation)
   - [4. Dynamic Fair Pricing & Floor Wage Protection](#4-dynamic-fair-pricing--floor-wage-protection)
   - [5. Artisan Customer Query Box (पूछताछ बॉक्स)](#5-artisan-customer-query-box)
   - [6. Multi-Factor B2B Matching Engine](#6-multi-factor-b2b-matching-engine)
   - [7. Continuous AI Learning Loop & QLoRA Fine-Tuning](#7-continuous-ai-learning-loop--qlora-fine-tuning)
   - [8. UIDAI Sovereign Masked Aadhaar Vault](#8-uidai-sovereign-masked-aadhaar-vault)
   - [9. Digital Personal Data Protection (DPDP Act 2023)](#9-digital-personal-data-protection-dpdp-act-2023)
5. [Enterprise Architecture & System Design](#-enterprise-architecture--system-design)
6. [Repository Structure](#-repository-structure)
7. [Getting Started (Docker & Bare Metal)](#-getting-started-docker--bare-metal)
8. [REST API Documentation & Endpoint Map](#-rest-api-documentation--endpoint-map)
9. [Mobile Application (Flutter Low-Literacy Interface)](#-mobile-application-flutter-low-literacy-interface)
10. [AI Model Benchmarks & Validation Metrics](#-ai-model-benchmarks--validation-metrics)
11. [License & Acknowledgments](#-license--acknowledgments)

---

## 🌟 Vision & Problem Statement

Rural and tribal Indian artisans possess extraordinary ancestral craft heritage, yet they remain systematically disenfranchised in modern digital commerce:
* **The Literacy Barrier**: Complex e-commerce seller onboarding flows require literate typing, technical attribute specification, and English/Hindi fluency.
* **The Visual Quality Gap**: Raw handicraft photos taken under poor lighting with cluttered backgrounds fail e-commerce standards, reducing sales conversion by up to 70%.
* **Unfair Middlemen & Price Exploitation**: Artisans frequently receive below-subsistence wages from exploitative intermediaries who capture over 80% of consumer retail value.
* **Lack of Direct B2B Access**: Marginalized craft clusters lack sovereign market linkage to institutional buyers, corporate procurement desks, and government emporiums.

**HunarDhara (हुनरधारा)** addresses these statutory and market challenges through an offline-first, sovereign AI platform built specifically for the **Smart India Hackathon 2026 (SIH 2026)** under Problem Statement **SIH26090** for the **Ministry of Social Justice and Empowerment (MoSJE)**.

---

## ⚡ The "Speak. Snap. Sell." Paradigm

```text
               ┌─────────────────────────────────────────────────┐
               │    Rural Artisan (Zero Typing / Low Literacy)   │
               └────────────────────┬────────────────────────────┘
                                    │
                   ┌────────────────┴────────────────┐
                   ▼                                 ▼
           📸 SNAP (Photo)                   🎙️ SPEAK (Voice)
       Raw, dim, cluttered picture       Local vernacular audio
                   │                                 │
                   ├────────────────┬────────────────┤
                   ▼                ▼                ▼
              STUDIO VISION    INDIC ASR/NMT   STRUCTURED LLM
              • GrabCut/Rembg  • Sarvam Saaras • Gemma 4 31B IT
              • Drop Shadows   • Dialect NMT   • Pydantic Schema
              • CLAHE Light    • Code-Mixed    • Cultural RAG
                       │                │                │
                       └────────────────┼────────────────┘
                                        │
                                        ▼
                          ⚖️ 4-SIGNAL DYNAMIC FAIR PRICING
                          • Signal 1: Raw Materials + Statutory Wage Floor
                          • Signal 2: Visual Craftsmanship Inspection & Embeddings
                          • Signal 3: GI Heritage Technique & Narrative NLP
                          • Signal 4: Live Market Trends & Festive Demand Indices
                                        │
                                        ▼
                          🛒 E-COMMERCE READY CATALOG
                          • Bilingual Storytelling (HI/EN)
                          • Verified QR Craft Passport
                          • Direct B2B & Retail Query Box
```

---

## 🌐 Live Deployments & Interactive Links

| Component | URL / Location | Description |
|---|---|---|
| **Live Web Portal** | [hunardhara.technogamerzthenextlevel.workers.dev](https://hunardhara.technogamerzthenextlevel.workers.dev/) | Production marketplace running on Cloudflare Workers edge network |
| **Sovereign Supabase Backend** | `https://gqtcpbllllaewzwqcyun.supabase.co` | Single-Source-of-Truth Postgres 16, pgvector, Auth, Storage, and Realtime (ap-south-1) |
| **Supabase Edge Functions** | `/functions/v1/voice-catalog`, `/functions/v1/ai-catalog` | Serverless Sarvam ASR/TTS and Gemma AI extraction engines |
| **Artisan Atelier & Studio** | `/artisan` | Artisan dashboard: Overview, Speak Snap Sell, My Products, Orders, Query Box, Earnings |
| **B2B Matchmaker** | `/b2b` | Bulk buyer RFQ procurement & multi-factor AI scoring portal |
| **Connectivity Diagnostic** | `npm run test:connectivity` (web-portal) | 24-point authoritative automated diagnostic suite (100% pass) |
| **Interactive API Docs (Swagger)** | `http://localhost:8000/docs` | Live interactive FastAPI OpenAPI documentation (legacy dual-path) |
| **Alternative API Docs (ReDoc)** | `http://localhost:8000/redoc` | Complete ReDoc specification |

### Pre-Configured Test Accounts

| Role | Email | Password | Access Capabilities |
|---|---|---|---|
| **Artisan (शिल्पकार)** | `artisan@hunardhara.gov.in` | `Artisan@2026` | Full "Speak. Snap. Sell." Studio, Product Catalog, Query Box, Earnings |
| **Retail Buyer (खरीदार)** | `buyer@hunardhara.gov.in` | `Buyer@2026` | Marketplace browsing, checkout, Craft Passport QR verification, direct craft inquiries |
| **B2B Enterprise (थोक खरीदार)**| `b2b@hunardhara.gov.in` | `B2b@2026` | Bulk requirement posting, AI artisan capacity matching, commercial inquiries |
| **MoSJE Admin (प्रशासक)** | `admin@hunardhara.gov.in` | `Admin@2026` | Artisan verification, craft cluster management, compliance & wage floor monitoring |

> **Google OAuth Note**: First-time sign-ins via Google automatically trigger a mandatory, unclosable **Onboarding Modal (`OnboardingModal.tsx`)** that collects role (Artisan vs. Buyer), WhatsApp number, state, craft specialization, and preferred language, preventing role skipping.

---

## 🏛️ Key Architectural Pillars

### 1. AI Studio Photo Pipeline
* **Segmentation Engine**: High-speed, multi-tier background removal featuring fully offline-capable adaptive OpenCV GrabCut with corner-variance shortcut detection and morphological smoothing, plus optional neural `rembg` (RMBG-1.4 / BiRefNet ONNX) session integration.
* **Procedural Shadow Engine (`shadow_engine.py`)**: Synthesizes realistic contact drop-shadows (Gaussian-blurred elliptical base) and ambient room shadows so the craft appears naturally grounded on a pristine white e-commerce surface.
* **Adaptive Lighting (CLAHE & Gray-World)**: Contrast Limited Adaptive Histogram Equalization and Gray-World color constancy correct under-exposed, color-cast photos taken in rural workshops.
* **Canvas Normalization**: Automatically centers the isolated craft on a standardized 1:1 square canvas (1080x1080px) adhering to national e-commerce guidelines.
* **Before / After Comparison**: Generates side-by-side verification previews for instant artisan review.

### 2. Indic Voice-to-Catalog Engine
* **Speech-to-Text**: Integrates **Sarvam AI Saaras** and **Bhashini ASR** for high-accuracy Indic speech recognition supporting Hindi, Bhojpuri, Maithili, Awadhi, Bengali, Kannada, Tamil, Telugu, and code-mixed vernacular dialects.
* **Neural Machine Translation**: Converts colloquial spoken craft descriptions into standardized English and literary Hindi.
* **Zero-Typing UI**: Mobile and web interfaces feature single-tap audio recording with real-time waveform visualization, eliminating all typing requirements.

### 3. Gemma 4 31B IT Catalog Generation
* **Inference Engine**: Powered by **Gemma 4 31B IT** (`google/gemma-4-31b-it:free`) via OpenRouter with strict Pydantic JSON schema output enforcement.
* **Attribute Extraction**: Automatically detects and extracts:
  * Product Title (Bilingual: Hindi & English)
  * Craft Category & GI Cluster (e.g., *Varanasi Silk Brocade*, *Bastar Dhokra Brass*, *Khurja Pottery*, *Madhubani Folk Art*, *Channapatna Toys*)
  * Raw Materials & Technique (e.g., *Pure Mulberry Silk, Zari, Pit Loom Hand-weaving*)
  * Physical Dimensions & Weight
  * Production Duration & Artisan Hours
* **Culturally Truthful Marketing Copy**: Generates authentic, emotionally resonant storytelling narratives highlighting the cultural lineage and GI heritage of the handicraft.
* **SEO Metadata**: Generates search engine tags, buyer target keywords, and category classification tags.

### 4. Dynamic Fair Pricing & Floor Wage Protection
Rural artisans are frequently underpaid. Hunardhara implements a comprehensive **4-Signal Multimodal Valuation Architecture** satisfying SIH Problem Statement SIH26090:
* **Signal 1: Statutory Cost-Plus Floor**:
  $$\text{Floor Price} = \text{Material Cost} + (\text{Reported Artisan Hours} \times \text{Skilled Hourly Wage Rate}) + \text{Overhead Consumables (10\%)}$$
  *(Enforces statutory skilled wage protection of ₹650/day benchmarked under MoSJE / PM-Vishwakarma scheme as an unbreakable lower bound)*.
* **Signal 2: Visual Craftsmanship Inspection (Multimodal Vision Engine)**:
  Extracts 768-dimensional visual feature embeddings combining multi-scale spatial pooling, RGB/HSV color distribution analysis, and Sobel gradient edge energy. Quantifies fine finishing detail into a craftsmanship quality score ($0.65 - 0.98$) and craftsmanship premium.
* **Signal 3: GI Heritage Technique & Narrative NLP**:
  Tokenizes craft descriptions and spoken audio transcripts to detect statutory Geographical Indication keywords (*kadwa booti*, *cire perdue*, *bell metal*, *kaolin high-fire vitrification*, *kachni-bharni*, *vegetable lac*), computing a heritage technique score ($0.0 - 1.0$) and narrative premium.
* **Signal 4: Live Market Trend Intelligence & Vector Matching**:
  Queries a production dataset of 50 verified Indian craft cluster benchmarks (`market_benchmarks.json`) tracking real-time demand indices ($1.0 - 1.45\times$), seasonal festive surges (Diwali, Navratri, autumn wedding calendars), and annualized raw material inflation rates cross-referenced with ONDC, TRIFED, and EPCH.
* **3-Tier Sovereign Pricing Inequality**:
  Strictly guarantees: $\text{Floor Price} < \text{Wholesale (B2B) Price} < \text{Recommended Retail (D2C) Price}$.
* **Explainable Bilingual Rationale**: Provides clear Hindi and English explainability citing all four valuation pillars, protecting artisans from predatory middlemen.

### 5. Artisan Customer Query Box (पूछताछ बॉक्स)
Artisans can directly communicate with retail and B2B buyers who submit inquiries on their crafts:
* **Supabase Cloud Sync**: Inquiries are stored in `public.artisan_inquiries` with Row Level Security (RLS) and real-time syncing across mobile and web.
* **Terracotta Badge Notifications**: Real-time counter badge on the atelier navigation tab alerts artisans to pending buyer queries.
* **1-Tap WhatsApp Reply (`wa.me`)**: Generates an immediate WhatsApp link pre-filled with a respectful bilingual greeting:
  > *"नमस्ते [Customer Name], मैं [Artisan Name] (हुनरधारा शिल्पकार) बोल रहा हूँ। आपके शिल्प '[Craft Title]' संबंधी प्रश्न के संदर्भ में..."*
* **Direct Call & Email**: 1-tap `tel:` and `mailto:` links for phone communication.
* **Simulate Query (+ परीक्षण पूछताछ)**: Allows new artisans to generate realistic test inquiries to practice replying before their first real customer contacts them.

### 6. Multi-Factor B2B Matching Engine
Government procurement and corporate gifting require bulk matching against thousands of artisans:
$$\text{Match Score} = (0.35 \times \text{Craft Fit}) + (0.30 \times \text{Budget Feasibility}) + (0.25 \times \text{Capacity Delivery}) + (0.10 \times \text{Cluster Proximity})$$
* **Capacity Safeguards**: Prevents over-committing rural artisans by checking active orders against monthly production capacity.
* **Cooperative Cluster Aggregation**: Automatically bundles multiple micro-artisans in the same GI cluster to fulfill massive bulk RFQs (e.g., 500 handloom shawls).

### 7. Continuous AI Learning Loop & QLoRA Fine-Tuning
Hunardhara incorporates a continuous human-in-the-loop self-improving AI cycle:
* **Artisan Review Interface**: Artisans review generated listings and mark attributes as `CORRECT` or `WRONG`.
* **Automated Dataset Curation**: Feedback is recorded into versioned `.jsonl` datasets (`verified_correct_samples.jsonl`, `pending_corrections.jsonl`, `hunardhara_finetuning_dataset.jsonl`).
* **Free Colab QLoRA Pipeline**: Includes `training/train_colab.py` and `training/train_artisan_lora.py` using Unsloth 4-bit quantization to fine-tune open weights (Llama-3.1-8B, Qwen-2.5-7B) on a free T4 GPU in ~15 minutes with zero cloud spend.

---

## 🏗️ End-to-End System Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                            CLIENT LAYER                                                │
│   ┌────────────────────────────────────────────────────────┐  ┌────────────────────────────────────┐   │
│   │               Next.js 15 Web Portal                    │  │        Flutter Mobile App          │   │
│   │   • SSR Buyer Storefront      • Dynamic QR Passport    │  │   • Visual-First Reticle Camera    │   │
│   │   • Artisan Atelier & Studio  • B2B RFQ Matchmaker     │  │   • One-Tap Audio Waveform Mic     │   │
│   │   • Customer Query Box        • Google OAuth Modal     │  │   • Offline-First SQLite Cache     │   │
│   └───────────────────────────┬────────────────────────────┘  └─────────────────┬──────────────────┘   │
└───────────────────────────────┼─────────────────────────────────────────────────┼──────────────────────┘
                                │                                                 │
                                ▼                                                 ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY & SOVEREIGN COMPLIANCE LAYER                                  │
│   FastAPI ASGI (Python 3.11+) • CORS • EXIF GPS Scrubber • DPDP Vault • Masked Aadhaar (UIDAI HMAC)    │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       CORE SERVICE LAYER                                               │
│   ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│   │    Studio Service     │  │     Voice Engine      │  │     Pricing Engine    │  │  B2B Matching  │  │
│   │  • GrabCut / Rembg    │  │  • Sarvam Saaras ASR  │  │  • Wage Floor Guard   │  │  • Multi-Factor│  │
│   │  • Procedural Shadows │  │  • Bhashini NMT       │  │  • Material + Labor   │  │  • Cluster Pool│  │
│   │  • CLAHE Equalization │  │  • Gemma 4 31B Parser │  │  • SigLIP Similarity  │  │  • Capacity Chk│  │
│   └───────────────────────┘  └───────────────────────┘  └───────────────────────┘  └────────────────┘  │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                     DATA & PERSISTENCE LAYER                                           │
│   ┌───────────────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│   │     PostgreSQL 16 + PostGIS       │  │          pgvector         │  │     Supabase Cloud DB     │  │
│   │  • Craft Clusters & GI Registry   │  │  • Handicraft Benchmarks  │  │  • Profiles & Roles       │  │
│   │  • Artisan Profiles & Orders      │  │  • Visual Embeddings      │  │  • artisan_inquiries      │  │
│   └───────────────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘  │
│   ┌───────────────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐  │
│   │          Redis 7 Cache            │  │       Celery Workers      │  │     Local SQLite Cache    │  │
│   │  • Session Tokens & Rate Limits   │  │  • Async Image & Voice    │  │  • Offline Mobile Sync    │  │
│   └───────────────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 Repository Structure

```
sih-artisan-platform/
├── backend/                             # FastAPI Backend Service (Python 3.11+)
│   ├── app/
│   │   ├── api/v1/                      # Version 1 REST API Controllers
│   │   │   ├── ai_assistant.py          # Gemma 4 31B OpenRouter & Learning Feedback Endpoints
│   │   │   ├── applications.py          # Artisan Onboarding Applications
│   │   │   ├── b2b.py                   # B2B Matchmaking & RFQ Endpoints
│   │   │   ├── clusters.py              # Craft Cluster & GI Registry Discovery
│   │   │   ├── compliance.py            # DPDP Act 2023 & Aadhaar Vault Endpoints
│   │   │   ├── earnings.py              # Artisan Wage & Payout Statistics
│   │   │   ├── health.py                # Service & System Health Probes
│   │   │   ├── orders.py                # Order Lifecycle Management
│   │   │   ├── pricing.py               # Dynamic Fair Pricing Calculator
│   │   │   ├── products.py              # Studio Photo Upload & Voice-to-Catalog
│   │   │   ├── router.py                # Centralized v1 API Router Registry
│   │   │   └── voice.py                 # Sarvam / Bhashini Audio Transcription
│   │   ├── core/                        # Application Core (Config, DB, Security)
│   │   ├── models/                      # SQLAlchemy Database Entities
│   │   ├── schemas/                     # Pydantic v2 Request/Response Validation Schemas
│   │   └── services/                    # Business Logic & AI Services
│   │       ├── aadhaar_vault.py         # UIDAI Sovereign Masked Aadhaar Vault
│   │       ├── ai_orchestrator.py       # Multi-Modal Pipeline Coordinator
│   │       ├── b2b_matching_service.py  # Multi-Factor RFQ Matchmaker
│   │       ├── correction_feedback_service.py # Artisan Review Feedback & Dataset Logger
│   │       ├── embedding_service.py     # SigLIP Visual & Semantic Embeddings
│   │       ├── exif_scrubber.py         # GPS Metadata Privacy Stripper
│   │       ├── openrouter_service.py    # Gemma 4 31B IT OpenRouter Client
│   │       ├── pricing_service.py       # Fair Pricing & Statutory Wage Floor Guard
│   │       ├── rag_craft_knowledge.py   # Indian Handicraft Cultural Knowledge Base
│   │       ├── sarvam_service.py        # Sarvam Indic Speech Recognition
│   │       ├── shadow_engine.py         # Procedural Contact & Ambient Shadow Generator
│   │       └── studio_service.py        # Adaptive GrabCut / Rembg Background Removal & CLAHE Equalizer
│   ├── db/                              # Database Seeds & Extensions
│   │   ├── init_extensions.sql          # PostGIS & pgvector Extension Initializer
│   │   └── seeds/                       # Seed Scripts for 5 Major Indian Craft Clusters
│   ├── tests/                           # Automated Pytest Suite (224 Tests)
│   │   ├── fixtures/                    # Test Handicraft Images & Indic Audio Clips
│   │   └── test_*.py                    # Unit, Integration, Adversarial & Privacy Tests
│   ├── Dockerfile                       # Container Definition for Backend
│   └── requirements.txt                 # Python Dependencies
│
├── web-portal/                          # Next.js 15 Web Marketplace (React 19 + TypeScript)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx                 # Public Marketplace & Cultural Showcase
│   │   │   ├── artisan/page.tsx         # Artisan Atelier (Studio, Products, Orders, Query Box, Earnings)
│   │   │   ├── artisan/apply/page.tsx   # Artisan Registration Application
│   │   │   ├── b2b/page.tsx             # B2B Bulk RFQ Sourcing & Matchmaker
│   │   │   ├── craft/[id]/page.tsx      # Craft Storytelling, QR Passport & Inquiry Modal
│   │   │   ├── cart/page.tsx            # Buyer Shopping Cart & Checkout
│   │   │   ├── orders/page.tsx          # Order Tracking & History
│   │   │   ├── login/page.tsx           # Authentication & Google OAuth Sign-In
│   │   │   └── admin/page.tsx           # MoSJE Administrative Governance Portal
│   │   ├── components/                  # Reusable UI Widgets
│   │   │   ├── InquiryModal.tsx         # Direct Buyer-to-Artisan Inquiry Modal
│   │   │   ├── OnboardingModal.tsx      # Mandatory Google OAuth Role & Profile Modal
│   │   │   ├── Navbar.tsx               # Navigation with Role Switching & Cart Count
│   │   │   └── ...                      # Modals, Badges, and Sliders
│   │   └── lib/                         # Client Utilities
│   │       ├── api.ts                   # Backend API Integration Client
│   │       ├── inquiries.ts             # Supabase Cloud Sync & Local Storage Query Manager
│   │       ├── supabase.ts              # Supabase Client Configuration
│   │       └── types.ts                 # TypeScript Domain Interfaces
│   ├── wrangler.json                    # Cloudflare Workers Deployment Configuration
│   └── package.json                     # Node Dependencies & Build Scripts
│
├── mobile-app/                          # Flutter Mobile Application ("Speak. Snap. Sell.")
│   ├── lib/
│   │   ├── features/
│   │   │   ├── camera/                  # Reticle Camera with Blur & Low-Light Sensors
│   │   │   ├── voice/                   # One-Tap Waveform Audio Recorder
│   │   │   ├── review/                  # Before/After Preview & Catalog Editor
│   │   │   └── dashboard/               # Visual-First Low-Literacy Home Dashboard
│   │   └── main.dart                    # Application Entry Point
│   └── pubspec.yaml                     # Flutter Dependencies & Assets
│
├── training/                            # Free AI Model Training & Fine-Tuning
│   ├── feedback/                        # Versioned JSONL Datasets from Artisan Feedback
│   ├── train_colab.py                   # 1-Click Google Colab QLoRA Training Script
│   ├── train_artisan_lora.py            # Local Unsloth / Hugging Face LoRA Fine-Tuner
│   └── README.md                        # Step-by-Step Training Guide
│
├── docker-compose.yml                   # Multi-Container Orchestration (DB, Redis, Backend, Celery)
├── render.yaml                          # Render.com Cloud Deployment Spec
└── .env.example                         # Environment Variables Template
```

---

## 🚀 Quick Start & Installation Guide

### Prerequisites
* **Git** installed
* **Docker & Docker Compose** (for Containerized Setup), OR
* **Python 3.11+**, **Node.js 20+**, and **Flutter SDK** (for Native Local Setup)

---

### Option A: Docker Compose (Full Stack)
The fastest way to launch the entire production backend, databases, and background workers:

```bash
# 1. Clone the repository
git clone https://github.com/chillpill999/hunardhara-artisan-platform.git
cd hunardhara-artisan-platform

# 2. Copy environment template
cp .env.example .env

# 3. Launch container stack
docker compose up --build
```

**Services Launched**:
* **FastAPI Backend**: `http://localhost:8000` (Swagger docs at `/docs`)
* **PostgreSQL 16 + pgvector**: `localhost:5432` (Auto-initializes PostGIS, pgvector, and craft seeds)
* **Redis 7**: `localhost:6379`
* **Celery Worker**: Background image studio & audio processing pipeline

---

### Option B: Native Local Setup

#### 1. Backend Service (FastAPI)
```bash
cd backend

# Create and activate Python virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Seed the database (uses SQLite fallback if PostgreSQL is not running)
python -m db.seeds.seed_craft_clusters

# Start the FastAPI ASGI server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Open `http://localhost:8000/docs` in your browser to inspect the interactive Swagger API.

#### 2. Web Portal (Next.js 15)
```bash
cd ../web-portal

# Install dependencies
npm install

# Start development server
npm run dev
```
Open `http://localhost:3000` to interact with the web marketplace.

#### 3. Mobile Application (Flutter)
```bash
cd ../mobile-app

# Fetch Flutter dependencies
flutter pub get

# Run on connected device or emulator
flutter run
```

---

### Option C: Air-Gapped / Offline Mock Mode
If external AI services (OpenRouter, Sarvam, Hugging Face) are unavailable or you are testing in an air-gapped hackathon environment:

1. In `.env`, set:
   ```ini
   OFFLINE_MODE=true
   MOCK_AI_SERVICES=true
   ```
2. The platform automatically switches to the **Deterministic Mock Engine (`offline_mock_engine.py`)**:
   * Image processing falls back to high-performance local OpenCV segmentation.
   * Spoken Indic voice falls back to pre-compiled linguistic phoneme dictionaries.
   * Pricing formulas use statutory benchmark tables.
   * **100% of platform features remain fully functional without internet access or paid API keys.**

---

## ⚙️ Configuration & Environment Variables

Create a `.env` file in the project root based on `.env.example`:

```ini
# Application Environment
ENVIRONMENT=development
DEBUG=true
PROJECT_NAME="MoSJE AI Artisan Market Linkage Platform"
API_V1_STR=/api/v1

# Authentication and sensitive values
# Set each real value only through your local secret store, Render, or Cloudflare.
SUPABASE_JWT_SECRET=
SUPABASE_JWT_ISSUER=
SUPABASE_JWT_AUDIENCE=
ADMIN_USER_IDS=
AADHAAR_PEPPER_KEY=

# Database
# PostgreSQL with pgvector (obtain credentials from the deployment secret manager):
DATABASE_URL=
SYNC_DATABASE_URL=
# For Zero-Docker local development (SQLite):
# DATABASE_URL=sqlite+aiosqlite:///./artisan_platform.db

# Redis & Celery
REDIS_URL=redis://localhost:6379/0
CELERY_BROKER_URL=redis://localhost:6379/1
CELERY_RESULT_BACKEND=redis://localhost:6379/2

# AI Services Configuration
OFFLINE_MODE=false
MOCK_AI_SERVICES=false

# OpenRouter (Gemma 4 31B IT Free Tier)
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemma-4-31b-it:free

# Studio Vision (Multi-tier: local offline GrabCut default; optional rembg session)
REMBG_MODEL=birefnet-general

# Sarvam AI (Indic Speech Recognition)
SARVAM_API_KEY=

# Storage & Uploads
STATIC_DIR=./static
UPLOAD_MAX_SIZE_MB=15
```

---

## 📡 REST API Documentation & Endpoint Map

The backend exposes a modular, versioned REST API (`/api/v1`):

### 1. Root & System Health
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Platform discovery metadata and navigation directory |
| `GET` | `/health` | Container liveness and readiness probe |
| `GET` | `/api/v1/health` | Deep component diagnostic (DB, Redis, AI Models, Storage) |

### 2. Craft Clusters & Cultural Registry
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/clusters` | List all 5 verified GI craft clusters with artisan counts |
| `GET` | `/api/v1/clusters/{cluster_id}` | Detailed cluster dossier, materials, and geo-coordinates |
| `GET` | `/api/v1/clusters/{cluster_id}/products` | Products registered within a specific craft cluster |

### 3. AI Studio & Catalog Generation
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/products/studio` | Upload raw image $\rightarrow$ returns 1:1 studio photo with contact drop shadows |
| `POST` | `/api/v1/products/voice-catalog` | Upload Indic voice audio $\rightarrow$ transcribes, extracts attributes, and generates bilingual catalog |
| `POST` | `/api/v1/ai-assistant/generate-catalog` | Direct text/voice transcript to Gemma 4 31B structured listing |
| `POST` | `/api/v1/ai-assistant/review-feedback` | Record artisan feedback (`CORRECT` / `WRONG`) into fine-tuning datasets |
| `GET` | `/api/v1/ai-assistant/feedback-stats` | Observability metrics for the continuous AI learning loop |

### 4. Fair Pricing & Statutory Guardrails
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/pricing/estimate` | Calculate 3-tier price (Floor, Retail, Wholesale) + rationale |
| `GET` | `/api/v1/pricing/benchmarks/{craft_type}` | Query pgvector price benchmarks for a craft category |

### 5. B2B Enterprise Matchmaking
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/b2b/rfq` | Submit new bulk procurement requirement |
| `POST` | `/api/v1/b2b/match` | Score and rank artisans against an RFQ using multi-factor AI |
| `GET` | `/api/v1/b2b/rfq/{rfq_id}/matches` | Retrieve top matched artisan clusters for an existing RFQ |

### 6. Privacy & Sovereign Compliance
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/compliance/scrub-exif` | Strip GPS, camera serial, and timestamp metadata from photo |
| `POST` | `/api/v1/compliance/aadhaar/vault` | Hash Aadhaar using HMAC SHA-256 + pepper, return masked `XXXX-XXXX-1234` |
| `POST` | `/api/v1/compliance/dpdp/consent` | Log DPDP Act 2023 visual/voice consent token |

---

## 🔒 Security, Privacy & Sovereign Compliance

Hunardhara is built according to Indian sovereign cybersecurity and data protection standards:

1. **Digital Personal Data Protection (DPDP) Act 2023**:
   * Explicit audio and visual consent prompts prior to recording voice or capturing workshop photos.
   * Right to erasure (`DELETE /api/v1/artisan/data`) permanently purges biometric, voice, and personal data.
2. **Masked Aadhaar Vault (UIDAI Compliance)**:
   * **Zero plaintext storage**: Full 12-digit Aadhaar numbers never touch databases or logs.
   * Cryptographically hashed using **HMAC SHA-256** combined with a high-entropy server-side pepper key (`AADHAAR_PEPPER_KEY`).
   * Only the last 4 digits (`XXXX-XXXX-5821`) are retained for artisan identity verification.
3. **EXIF GPS Sanitization (`exif_scrubber.py`)**:
   * Rural artisans frequently work in home workshops. Hunardhara automatically strips all GPS coordinates, altitude, device IMEI, and timestamps from uploaded craft photos prior to cloud storage, preventing location harvesting.
4. **SSL / TLS & Content Security**:
   * Strict CSP headers, CORS isolation, and parameter validation across all endpoints.

---

## 🧪 Testing & Quality Assurance

Hunardhara maintains a rigorous automated testing discipline. The test suite includes unit tests, integration pipelines, adversarial attack simulations, seed idempotency tests, and DPDP privacy audits.

```bash
# Run the complete test suite
cd backend
python -m pytest tests/ -v
```

### Test Coverage Breakdown (224 / 224 Tests Passed)
* **Image Studio Pipeline (`test_studio.py`)**: Validates 1:1 canvas isolation, luminosity drop of procedural drop shadows, CLAHE low-light boost, and Before/After preview dimensions.
* **Indic Voice & Extraction (`test_voice_catalog.py`, `test_ai_assistant.py`)**: Validates ASR transcriptions, dialect translations, Pydantic schema validation, and fallback mocks.
* **Fair Pricing Guardrails (`test_pricing.py`)**: Tests floor price statutory wage enforcement, negative input handling, and 3-tier price tiering.
* **B2B Matchmaker (`test_b2b_matching.py`)**: Tests multi-factor ranking weights, capacity overload handling, and cooperative cluster bundling.
* **Sovereign Privacy Audit (`test_privacy_audit.py`)**: Verifies 0 plaintext Aadhaar numbers in databases and 0 GPS coordinates in uploaded images.
* **Adversarial Resilience (`test_seed_idempotency_adversarial.py`)**: Verifies database seed idempotency across repeated consecutive executions.

---

## 🇮🇳 Alignment with MoSJE Statutory Schemes

Hunardhara directly operationalizes the mandate of the **Ministry of Social Justice and Empowerment (MoSJE)**:

| MoSJE Initiative | Platform Capability |
|---|---|
| **PM-Vishwakarma Scheme** | Enforces statutory ₹650/day wage floors in the pricing algorithm, providing digital toolkit support and market linkage for 18 traditional family trades. |
| **PM-DAKSH Yojana** | Direct skills-to-market linkage for SC, ST, and OBC youth transitioning from craft training to independent digital enterprise. |
| **National SC/ST Hub (NSSH)** | Facilitates B2B matchmaking for public procurement compliance (4% mandatory procurement from SC/ST enterprises). |
| **GI Tag Protection & Heritage Registry** | Built-in Geographical Indication (GI) verification for authentic Varanasi Silk, Bastar Dhokra, Khurja Pottery, Madhubani Art, and Channapatna Toys. |

---

## 📜 License & Acknowledgments

This project is developed for the **Smart India Hackathon 2026 (SIH 2026)** under the auspices of the **Ministry of Social Justice and Empowerment (MoSJE)**.

* **Team**: Madhavas
* **Open Source Frameworks**: FastAPI, Next.js, Flutter, PyTorch, OpenCV, Unsloth, PostgreSQL, pgvector.
* **AI Providers & Vision Engines**: OpenRouter (`google/gemma-4-31b-it:free`), Sarvam AI, Bhashini (Digital India Bhashini Division), OpenCV (Adaptive GrabCut), rembg (RMBG-1.4 / BiRefNet ONNX).

---
<p align="center">
  <b>हुनरधारा — शिल्पकार का स्वाभिमान, तकनीक का वरदान।</b><br>
  <i>Empowering India's Heritage Artisans through Sovereign Artificial Intelligence.</i>
</p>
