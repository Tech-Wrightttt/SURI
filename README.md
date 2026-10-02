# SURI — Adaptive Mathematics Learning Platform

[![Next.js 16](https://img.shields.io/badge/Frontend-Next.js%2016%20App%20Router-black?logo=next.js)](https://nextjs.org/)
[![React 19](https://img.shields.io/badge/UI-React%2019-blue?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI%200.110+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-Supabase%20%2F%20PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?logo=google)](https://aistudio.google.com/)
[![Three.js](https://img.shields.io/badge/3D-Three.js%20%26%20R3F-black?logo=three.js)](https://threejs.org/)

**SURI** is an adaptive, gamified mathematics learning platform designed specifically for Philippine Junior High School students (Grades 6–10). Aligned with Department of Education (DepEd) Self-Learning Modules (SLM), SURI dynamically diagnoses prerequisite competency gaps, delivers targeted instructional content grounded by Retrieval-Augmented Generation (RAG), and guides students toward mastery through a structured 16-node prerequisite graph in an immersive 3D voxel learning kingdom.

---

## Table of Contents

- [Key Features](#key-features)
- [Project Architecture & Directory Structure](#project-architecture--directory-structure)
- [Tech Stack & Dependencies](#tech-stack--dependencies)
  - [Backend Dependencies](#backend-dependencies)
  - [Frontend Dependencies](#frontend-dependencies)
  - [Mathsteps Subprocess Dependencies](#mathsteps-subprocess-dependencies)
- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Installation & Setup](#installation--setup)
  - [1. Set Up Python Virtual Environment (`venv`)](#1-set-up-python-virtual-environment-venv)
  - [2. Install Backend Dependencies](#2-install-backend-dependencies)
  - [3. Set Up Mathsteps Runner](#3-set-up-mathsteps-runner)
  - [4. Install Frontend Dependencies](#4-install-frontend-dependencies)
  - [5. Set Up the Database (Supabase / PostgreSQL)](#5-set-up-the-database-supabase--postgresql)
  - [6. Set Up the Knowledge Base Index (Optional / Rebuilding)](#6-set-up-the-knowledge-base-index-optional--rebuilding)
- [Running the Application](#running-the-application)
  - [Option A: One-Click Full Stack Launch (`run.bat`)](#option-a-one-click-full-stack-launch-runbat)
  - [Option B: Manual Terminal Execution (Step-by-Step)](#option-b-manual-terminal-execution-step-by-step)
  - [Option C: Cursor / VS Code Tasks](#option-c-cursor--vs-code-tasks)
- [Developer & Utility Scripts](#developer--utility-scripts)
- [Prerequisite Learning Graph](#prerequisite-learning-graph)
- [Complete API Reference](#complete-api-reference)
- [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Key Features

### 🏰 3D Gamified Voxel World Map
- **Interactive Voxel Islands**: Built with Three.js and React Three Fiber (`KingdomWorld`, `FocusedIslandWorld`), featuring animated landmarks such as the **Topics Library**, **Calculator Tower**, and **Progress Trail**.
- **Dynamic 3D Environment**: Immersive voxel landscape with custom skies, ocean shaders, dynamic day/night styling, camera panning, and island zooming.
- **SURI Keep & Student Overview**: Profile modal showcasing learning streaks, total mastery percentages, active sessions, and unlocked competencies.

### 🧠 Adaptive Diagnostics & Prerequisite Gap Analysis
- **Targeted Probes**: Dynamically sequences multiple-choice probes along the prerequisite graph chain to pinpoint exact foundational weaknesses.
- **Fast-Track Skip Option**: Allows students to skip diagnostic probes (`POST /api/diagnostic/skip`) and immediately access customized lesson material.
- **Gap Detection & Remediation**: Automatically maps failed probe items to specific prerequisite nodes (spanning Grades 6 through 10).

### 📖 AI-Grounded Lessons & Dynamic Simplification
- **DepEd SLM Grounding**: RAG pipeline powered by ChromaDB, LlamaIndex, and Google Gemini ingests official DepEd Self-Learning Module PDFs to ensure localized curriculum compliance.
- **Multi-Modal Content**: Generates comprehensive lesson explanations, worked step-by-step examples, and conceptual summaries.
- **"Simplify Lesson" Mode**: Instant one-click AI adaptation (`POST /api/content/{node_id}/simplify`) that rewrites complex algebraic principles into simpler, student-friendly explanations with intuitive analogies.

### ✍️ Step-by-Step Practice & Quiz Engine
- **Mathsteps Step Simplifier**: Integrates a Node.js `mathsteps` subprocess to calculate algebraic transformations and scaffold step-by-step math problems.
- **Virtual Math Keyboard & Formula Input**: Integrated `mathlive` and `react-math-keyboard` with a virtual keypad for fractions, exponents, radicals, and algebraic symbols.
- **Real-Time Step Evaluation & Hints**: Instant feedback per step (`POST /api/quiz/submit-step`), contextual hint system (`POST /api/quiz/use-hint`), and step skipping (`POST /api/quiz/skip-step`).
- **Misconception Detection**: Automatic categorization of algebraic errors (e.g., negative sign slip, incorrect distribution, denominator addition) mapped directly to prerequisite nodes for targeted remediation.

### 📊 Progress Trail & Error History
- **Competency Progression**: Visual tracking across all 16 graph nodes categorized into *Mastered*, *In Progress*, and *Needs Remediation*.
- **Detailed Error History**: Dedicated log of past algebraic mistakes, timestamps, problem expressions, and mapped prerequisite concepts.
- **Celebration Effects**: Interactive confetti animations powered by `canvas-confetti` upon topic mastery.

### 🧮 Interactive Calculator Tower
- Dedicated mathematical sandbox page with MathLive integration, equation evaluation, and live formula manipulation.

### ❓ Contextual Help System
- Global `HelpModal` integrated across all pages (Dashboard, Topics, Progress, Calculator, Quiz, and Error History) offering instant page guides and usage instructions.

### ⚡ Performance & Low-Latency Architecture
- **Supabase / PostgreSQL Pool**: Fast connection pooling with `asyncpg` configured for PgBouncer transaction pooling.
- **Server Request Timing Middleware**: Built-in `X-Process-Time-Ms` response header and server console logging to isolate server processing from network round-trips.

---

## Project Architecture & Directory Structure

```
SURI/
├── backend/                        # FastAPI Python API Server
│   ├── data/                       # Pre-generated diagnostic probes JSON
│   ├── models/                     # Pydantic validation schemas (schemas.py)
│   ├── routes/                     # Modular API endpoints
│   │   ├── auth_routes.py          # Registration, login, logout, me
│   │   ├── content_routes.py       # Lesson content and simplify endpoint
│   │   ├── diagnostic_routes.py    # Diagnostic probes, answers, skip
│   │   ├── graph_routes.py         # In-memory fast chain lookup
│   │   ├── practice_routes.py      # Practice problem generation & step evaluation
│   │   ├── progression_routes.py   # Advancement / remediation decisions
│   │   ├── quiz_routes.py          # Quiz steps, hints, skipping, scoring
│   │   ├── session_routes.py       # Learning session management
│   │   └── student_routes.py       # Topic catalog and student progress
│   ├── auth.py                     # JWT token handling & password hashing (bcrypt)
│   ├── competency_utils.py         # Prerequisite graph evaluation algorithms
│   ├── database.py                 # asyncpg PostgreSQL connection pool
│   ├── graph.py                    # 16-node prerequisite graph single source of truth
│   ├── main.py                     # Application entry point, CORS, and timing middleware
│   ├── progress_utils.py           # Session progress calculation helpers
│   ├── requirements.txt            # Backend Python dependencies
│   └── reset_db.py                 # Database table reset script
├── frontend/                       # Next.js 16 App Router (React 19 + Tailwind CSS v4)
│   ├── app/                        # App Router pages and session subroutes
│   │   ├── calculator/             # Dedicated MathLive calculator page
│   │   ├── dashboard/              # 3D gamified dashboard world
│   │   ├── error-history/          # Student misconception log page
│   │   ├── login/ & register/      # Authentication pages
│   │   ├── progress/               # Competency trail and mastery page
│   │   ├── session/[session_id]/   # Dynamic session workflow:
│   │   │   ├── diagnostic/         # Diagnostic assessment page
│   │   │   ├── gap-result/         # Prerequisite gap summary page
│   │   │   ├── lesson/             # Lesson content and AI simplification
│   │   │   ├── practice/           # Scaffolded practice problems
│   │   │   ├── quiz/               # Step-by-step quiz with math keyboard & hints
│   │   │   └── results/            # Performance and mastery results
│   │   └── topics/                 # Topic selection carousel & library
│   ├── components/                 # Reusable UI & 3D components
│   │   ├── navigation/             # LearningShell, HelpModal, BackToTopButton
│   │   ├── ReferenceVoxel/         # Three.js Sky, Ocean, Ground, Environment
│   │   ├── WorldMap/               # 3D islands (KingdomWorld, FocusedIslandWorld, etc.)
│   │   └── TopicBookCarousel.tsx   # Interactive 3D topic book carousel
│   ├── lib/                        # Client API client (api.ts), types, and utilities
│   ├── patches/                    # @react-three+fiber React 19 compatibility patch
│   └── package.json                # Frontend dependencies and scripts
├── knowledge_base/                 # DepEd SLM indexing and RAG pipeline
│   ├── slm_pdfs/                   # DepEd Self-Learning Module PDF storage
│   ├── build_index.py              # ChromaDB vector index builder via LlamaIndex
│   ├── content_seed.json           # Cached lesson content seed
│   ├── generate_content.py         # Offline Gemini lesson content generator
│   ├── generate_distractors.py     # Distractor generator for multiple-choice items
│   ├── generate_practice.py        # Practice problem generator with mathsteps
│   ├── load_content_seed.py        # Database seeder for content records
│   └── migrate_quiz_tables.py      # Quiz database migration script
├── mathsteps_runner/               # Node.js mathsteps execution subprocess
│   ├── package.json                # mathsteps runner dependencies
│   └── runner.js                   # CLI wrapper returning JSON step transformations
├── scripts/                        # Database schemas and maintenance scripts
│   ├── export_sqlite_data.py       # Migration helper to export legacy SQLite data
│   ├── generate_diagnostic_probes.py # Diagnostic probe generator
│   ├── schema_supabase.sql         # Supabase PostgreSQL schema definition
│   └── seed_supabase.sql           # Initial database seed (topics, content, problems)
├── db_latency_test.py              # Standalone Supabase connection latency profiler
├── run.bat                         # One-click Windows concurrent launcher
├── system_workflow.md              # System workflow and architecture documentation
└── README.md                       # Project documentation
```

---

## Tech Stack & Dependencies

### Backend Dependencies (`backend/requirements.txt`)

| Package | Minimum Version | Purpose / Role |
| :--- | :--- | :--- |
| `fastapi` | `>=0.110.0` | Asynchronous REST API framework |
| `uvicorn[standard]` | `>=0.27.0` | Production-grade ASGI web server with auto-reload |
| `asyncpg` | `>=0.29.0` | High-performance async PostgreSQL driver for Supabase connection pooling |
| `python-jose[cryptography]` | `>=3.3.0` | JWT generation, signing, and verification |
| `bcrypt` | `>=4.0.0` | Secure password hashing |
| `python-multipart` | `>=0.0.9` | Request payload and multipart form parsing |
| `chromadb` | `>=0.4.0` | Vector database for storing and querying DepEd SLM embeddings |
| `llama-index` | `>=0.10.0` | Data orchestration framework for indexing SLM documents |
| `llama-index-readers-file` | `>=0.1.0` | File loaders for PDF curriculum documents |
| `sentence-transformers` | `>=2.2.0` | Local embedding model support for semantic search |
| `pypdf` | `>=3.0.0` | Text extraction from DepEd Self-Learning Module PDFs |
| `google-generativeai` | Latest | Google Gemini API SDK for lesson generation, step checks, and hints |
| `python-dotenv` | Latest | Loads `.env` environment variables into `os.environ` |

### Frontend Dependencies (`frontend/package.json`)

| Package | Version | Purpose / Role |
| :--- | :--- | :--- |
| `next` | `16.2.6` | Next.js App Router framework |
| `react` & `react-dom` | `19.2.4` | React 19 UI component library |
| `@react-three/fiber` | `^9.8.1` | Declarative Three.js renderer for React (patched for React 19) |
| `@react-three/drei` | `^10.7.8` | Useful 3D helpers, camera controls, and abstractions for R3F |
| `three` | `^0.186.0` | 3D graphics library powering the voxel kingdom and islands |
| `tailwindcss` | `^4.0.0` | Modern utility-first CSS styling engine |
| `@tailwindcss/postcss` | `^4.0.0` | Tailwind v4 PostCSS build integration |
| `katex` & `rehype-katex` | `^0.17.0` / `^7.0.1` | LaTeX math formula rendering |
| `remark-math` & `react-markdown` | `^6.0.0` / `^10.1.0` | Markdown parser with math block support |
| `mathlive` | `^0.109.2` | Interactive math formula editor and virtual keyboard |
| `react-math-keyboard` | `^2.0.17` | Virtual on-screen keypad for math inputs |
| `mathjs` | `^3.11.2` | Mathematical expression parsing and evaluation |
| `canvas-confetti` | `^1.9.4` | Celebration confetti effects on topic completion |
| `lucide-react` | `^1.16.0` | Icon library for navigation, status badges, and controls |
| `react-hot-toast` | `^2.6.0` | Responsive toast notifications |
| `patch-package` | `^8.0.1` | Automatically applies React 19 compatibility patches on `postinstall` |

### Mathsteps Subprocess Dependencies (`mathsteps_runner/package.json`)

| Package | Version | Purpose / Role |
| :--- | :--- | :--- |
| `mathsteps` | `^0.1.0` | Step-by-step equation and expression simplifier executed by Node.js |

---

## Prerequisites

Before starting, ensure the following are installed on your machine:

1. **Python 3.10+** (64-bit recommended) — Verify with `python --version`
2. **Node.js 18+ or 20+** — Verify with `node --version`
3. **npm** (comes with Node.js) — Verify with `npm --version`
4. **Git** — Verify with `git --version`
5. **Supabase / PostgreSQL database instance** — Free tier at [supabase.com](https://supabase.com)
6. **Google Gemini API Key** — Free key at [Google AI Studio](https://aistudio.google.com/)

---

## Environment Configuration

Create a `.env` file in the **project root directory** (copy from `.env.example`):

```bash
# In project root:
cp .env.example .env
```

Configure the following variables in `.env`:

```ini
# ==============================================================================
# SURI Environment Configuration
# ==============================================================================

# 1. Google Gemini API Key (Required for AI lessons, practice, and hints)
# Get yours free from: https://aistudio.google.com/
GEMINI_API_KEY=your_google_gemini_api_key_here

# 2. Database Connection String (PostgreSQL / Supabase)
# For Supabase, use your project's Transaction Pooler URI (port 6543) or Direct URI (port 5432):
# postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?sslmode=require
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres?sslmode=require

# 3. JWT Secret (Required for signing auth cookies — change in production!)
JWT_SECRET=super-secret-dev-key-change-this-in-production
```

> [!NOTE]
> When using Supabase with `asyncpg`, the backend sets `statement_cache_size=0` in `backend/database.py`, ensuring 100% compatibility with Supabase's PgBouncer transaction pooler.

---

## Installation & Setup

### 1. Set Up Python Virtual Environment (`venv`)

From the **project root directory** (`SURI/`), create and activate a Python virtual environment:

#### A. Create the virtual environment:
```bash
python -m venv venv
```

#### B. Activate the virtual environment:

- **Windows — Command Prompt (CMD):**
  ```cmd
  venv\Scripts\activate.bat
  ```

- **Windows — PowerShell:**
  ```powershell
  # If script execution is disabled on your system, run this once:
  Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned

  # Activate the virtual environment:
  .\venv\Scripts\Activate.ps1
  ```

- **macOS / Linux — Bash / Zsh:**
  ```bash
  source venv/bin/activate
  ```

> [!TIP]
> When activated, your terminal prompt will be prefixed with `(venv)`. Always make sure `(venv)` is active before installing Python dependencies or running backend commands.

---

### 2. Install Backend Dependencies

With the virtual environment activated, install all required Python packages:

```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

---

### 3. Set Up Mathsteps Runner

The backend invokes `mathsteps_runner/runner.js` as a subprocess to compute step-by-step math simplifications:

```bash
cd mathsteps_runner
npm install
cd ..
```

---

### 4. Install Frontend Dependencies

Navigate to the `frontend/` directory and install dependencies. This will automatically execute `patch-package` to apply necessary React 19 compatibility patches:

```bash
cd frontend
npm install
cd ..
```

---

### 5. Set Up the Database (Supabase / PostgreSQL)

1. Open your Supabase project dashboard and go to the **SQL Editor**.
2. Open [`scripts/schema_supabase.sql`](file:///scripts/schema_supabase.sql), copy its contents, and run it in the SQL Editor. This creates all necessary tables:
   - `students`, `sessions`, `diagnostic_logs`, `competency_status`
   - `content_records`, `practice_problems`, `practice_attempts`
   - `misconception_logs`, `progression_logs`
3. Open [`scripts/seed_supabase.sql`](file:///scripts/seed_supabase.sql), copy its contents, and run it in the SQL Editor to seed the database with initial topics, pre-generated content records, and practice problems.
4. *(Optional)* Verify database connection and measure latency:
   ```bash
   python db_latency_test.py
   ```

---

### 6. Set Up the Knowledge Base Index (Optional / Rebuilding)

If you wish to rebuild the vector index from raw DepEd Self-Learning Module PDFs:

1. Place your module PDF files in `knowledge_base/slm_pdfs/`.
2. Build the ChromaDB vector index:
   ```bash
   python knowledge_base/build_index.py
   ```
3. Load the pre-generated content seed into the database:
   ```bash
   python knowledge_base/load_content_seed.py
   ```

---

## Running the Application

### Option A: One-Click Full Stack Launch (`run.bat`)

For Windows users, SURI includes a convenient `run.bat` script in the project root. It automatically detects your virtual environment (`venv\` or `backend\venv\`), launches the FastAPI backend in one Command Prompt window, and launches the Next.js frontend in another Command Prompt window.

```cmd
run.bat
```

Both services will start up simultaneously:
- **FastAPI Backend**: `http://localhost:8000`
- **Next.js Frontend**: `http://localhost:3000`

---

### Option B: Manual Terminal Execution (Step-by-Step)

If you prefer launching each service manually in separate terminals:

#### Terminal 1 — Backend (FastAPI)

From the **project root directory**:

1. Activate your virtual environment:

   - **Windows Command Prompt:**
     ```cmd
     venv\Scripts\activate.bat
     ```

   - **Windows PowerShell:**
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```

   - **macOS / Linux:**
     ```bash
     source venv/bin/activate
     ```

2. Run the FastAPI development server:
   ```bash
   uvicorn backend.main:app --reload
   ```
   *(Or alternatively: `python -m uvicorn backend.main:app --reload`)*

The backend server will be live at:
- **API Base**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **Alternative ReDoc**: `http://localhost:8000/redoc`

#### Terminal 2 — Frontend (Next.js)

From a second terminal in the **project root directory**:

```bash
cd frontend
npm run dev
```

Open your browser and navigate to:
- **Web App**: `http://localhost:3000`

---

### Option C: Cursor / VS Code Tasks

If you are using Cursor or Visual Studio Code:
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS).
2. Select **Tasks: Run Task**.
3. Choose **SURI: Start Full Stack**.

This launches both backend and frontend inside your editor's integrated terminal panel.

---

## Developer & Utility Scripts

SURI includes several standalone developer utilities in `scripts/`, `knowledge_base/`, and the root directory:

| Script / Command | Purpose |
| :--- | :--- |
| `python db_latency_test.py` | Tests Supabase raw connection latency, connection reuse, and pooling speed. |
| `python knowledge_base/build_index.py` | Ingests PDF modules from `knowledge_base/slm_pdfs/` into ChromaDB using LlamaIndex. |
| `python knowledge_base/load_content_seed.py` | Populates `content_records` table with pre-generated lessons from `content_seed.json`. |
| `python knowledge_base/generate_content.py` | Uses Gemini RAG to generate fresh lessons, worked examples, and guided explanations. |
| `python knowledge_base/generate_practice.py` | Generates practice problems using Gemini and computes steps via `mathsteps`. |
| `python knowledge_base/generate_distractors.py` | Synthesizes realistic multiple-choice distractors for practice items. |
| `python scripts/generate_diagnostic_probes.py` | Generates diagnostic probe questions for each node in the prerequisite graph. |
| `python scripts/export_sqlite_data.py` | Exports data from legacy `suri.db` SQLite database if migrating to Supabase. |
| `node mathsteps_runner/runner.js "2x + 5 = 15"` | Directly tests mathsteps expression parsing and step extraction. |
| `python scratch/verify_suri.py` | Runs end-to-end integration and smoke tests against all API endpoints. |

---

## Prerequisite Learning Graph

SURI organizes mathematics curriculum competencies from **Grade 6 through Grade 10** into an interconnected directed acyclic graph (defined in [`backend/graph.py`](file:///backend/graph.py)). There are **4 primary learning chains** anchored by 4 Grade 8–10 entry nodes:

```mermaid
graph TD
    subgraph "Chain 1: Quadratic Equations"
        FD1["FD: Fractions & Decimals (Gr 6)"] --> OI1["OI: Operations on Integers (Gr 7)"]
        OI1 --> LE1["LE: Laws of Exponents (Gr 7)"]
        LE1 --> SP1["SP: Special Products (Gr 7)"]
        SP1 --> FP1["FP: Factoring Polynomials (Gr 8)"]
        FP1 --> QE["QE: Quadratic Equations (Gr 9) [Entry]"]
    end

    subgraph "Chain 2: Systems of Linear Equations"
        FD2["FD: Fractions & Decimals (Gr 6)"] --> RPP["RPP: Ratio, Proportion, Percent (Gr 6)"]
        RPP --> AE["AE: Algebraic Expressions (Gr 7)"]
        AE --> L1V["L1V: Linear Eq. in 1 Variable (Gr 7)"]
        L1V --> L2V["L2V: Linear Eq. in 2 Variables (Gr 8)"]
        L2V --> SLE["SLE: Systems of Linear Eq. (Gr 8) [Entry]"]
    end

    subgraph "Chain 3: Rational Exponents & Radicals"
        LE2["LE: Laws of Exponents (Gr 7)"] --> RER["RER: Rational Exponents & Radicals (Gr 9) [Entry]"]
    end

    subgraph "Chain 4: Polynomial Equations"
        PO["PO: Polynomial Operations (Gr 8)"] --> FP2["FP: Factoring Polynomials (Gr 8)"]
        PO --> PD["PD: Polynomial Division (Gr 10)"]
        FP2 --> PE["PE: Polynomial Equations (Gr 10) [Entry]"]
        PD --> PE
    end
```

### Competency Nodes Summary

| Node ID | Node Title | Grade Level | Primary Chain |
| :--- | :--- | :---: | :--- |
| **FD** | Fractions & Decimals | 6 | Foundation for Chains 1 & 2 |
| **RPP** | Ratio, Proportion, Percent | 6 | Chain 2 |
| **OI** | Operations on Integers | 7 | Chains 1 & 3 |
| **LE** | Laws of Exponents | 7 | Chains 1 & 3 |
| **SP** | Special Products / Polynomial Multiplication | 7 | Chain 1 |
| **AE** | Algebraic Expressions & Evaluation | 7 | Chain 2 |
| **L1V** | Linear Equations in 1 Variable | 7 | Chain 2 |
| **FP** | Factoring Polynomials | 8 | Chains 1 & 4 |
| **L2V** | Linear Equations in 2 Variables | 8 | Chain 2 |
| **PO** | Polynomial Operations | 8 | Chain 4 |
| **SLE** | Systems of Linear Equations *(Entry Topic)* | 8 | Chain 2 Entry |
| **QE** | Quadratic Equations *(Entry Topic)* | 9 | Chain 1 Entry |
| **RER** | Rational Exponents & Radicals *(Entry Topic)* | 9 | Chain 3 Entry |
| **PD** | Polynomial Division | 10 | Chain 4 |
| **PE** | Polynomial Equations *(Entry Topic)* | 10 | Chain 4 Entry |

---

## Complete API Reference

All API routes are served under the `/api` prefix on `http://localhost:8000`.

### 1. Authentication (`/api/auth`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Registers a new student (`name`, `email`, `grade_level`, `password`) and sets HTTP-only auth cookie. |
| `POST` | `/api/auth/login` | Authenticates student with `email` and `password`, sets HTTP-only session cookie. |
| `POST` | `/api/auth/logout` | Clears student authentication cookie. |
| `GET` | `/api/auth/me` | Returns current authenticated student details (`student_id`, `name`). |

### 2. Topics & Catalog (`/api`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/topics` | Lists all entry-level topics (QE, SLE, RER, PE). |
| `GET` | `/api/topics/catalog` | Returns topic catalog and full prerequisite chains in a single payload. |
| `GET` | `/api/topics/{node_id}/chain` | Returns prerequisite chain from the specified node down to foundational floor. |
| `GET` | `/api/topics/{node_id}/intro` | Returns introductory metadata and overview description for a topic node. |

### 3. Student Progress & Dashboard (`/api`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/students/{student_id}/progress` | Returns student active sessions, completed sessions, and misconception error history. |

### 4. Learning Sessions (`/api/sessions`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/sessions` | Creates or resumes a learning session for an entry topic node. |
| `GET` | `/api/sessions/{session_id}` | Retrieves session details and current active node. |
| `PATCH` | `/api/sessions/{session_id}` | Updates session state (current node or completion status). |
| `PATCH` | `/api/sessions/{session_id}/progress` | Updates completion percentage for the current session. |

### 5. Diagnostic Assessments (`/api/diagnostic`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/diagnostic/{session_id}/probe` | Retrieves the next diagnostic question for the session. |
| `POST` | `/api/diagnostic/{session_id}/answer` | Submits an answer to a diagnostic probe and assesses competency gaps. |
| `POST` | `/api/diagnostic/{session_id}/submit` | Submits complete batch diagnostic assessment. |
| `POST` | `/api/diagnostic/skip` | Skips diagnostic assessment and immediately routes student to targeted learning. |

### 6. Lesson Content & Simplification (`/api/content`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/content/{node_id}` | Fetches lesson text, worked example, and guided explanation for a node. |
| `POST` | `/api/content/{node_id}/simplify` | Generates a simplified, student-friendly lesson explanation via Gemini. |

### 7. Practice Problems (`/api/practice`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/practice/start` | Retrieves or generates a scaffolded practice problem set for a node. |
| `POST` | `/api/practice/submit-step` | Evaluates a single mathematical step submitted by the student, detecting misconceptions. |

### 8. Interactive Quiz Engine (`/api/quiz`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/quiz/start` | Initializes a quiz session for a competency node. |
| `POST` | `/api/quiz/submit-step` | Validates a step in a multi-step quiz problem with real-time feedback. |
| `POST` | `/api/quiz/skip-step` | Skips the current step with appropriate score adjustment and explanation. |
| `POST` | `/api/quiz/use-hint` | Requests a contextual hint for the current problem step. |
| `POST` | `/api/quiz/finish` | Concludes the quiz, computes total score, and updates competency status. |

### 9. Learning Progression (`/api/progression`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/progression/decide` | Evaluates mastery score and determines whether to **advance** or **remediate**. |

### 10. Graph Traversal (`/api/graph`)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/graph/{topic_entry_node}/chain` | High-speed in-memory lookup of prerequisite chain (zero database overhead). |

---

## Troubleshooting & FAQ

### 1. PowerShell Script Execution Policy Error
**Error:** `.\venv\Scripts\Activate.ps1 : File cannot be loaded because running scripts is disabled on this system.`  
**Solution:** Run this command in your PowerShell window to permit local scripts for your current session:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy RemoteSigned
.\venv\Scripts\Activate.ps1
```

### 2. Module Not Found: `No module named 'backend'`
**Error:** `ModuleNotFoundError: No module named 'backend'` when starting `uvicorn`.  
**Solution:** Ensure you execute `uvicorn backend.main:app --reload` from the **project root folder** (`SURI/`), NOT from inside the `backend/` folder.

### 3. Database Connection Failure / Timeout
**Error:** `asyncpg.exceptions.CannotConnectNowError` or connection timeout during startup.  
**Solutions:**
- Check your `.env` file and make sure `DATABASE_URL` is configured correctly.
- Verify your Supabase project is active (not paused).
- Run the latency test to check connectivity:
  ```bash
  python db_latency_test.py
  ```
- If using Supabase connection pooling, ensure port `6543` (transaction pooler) or port `5432` (direct) is specified with `?sslmode=require`.

### 4. Mathsteps Subprocess Errors
**Error:** `mathsteps runner failed or timed out: [WinError 2] The system cannot find the file specified`.  
**Solution:** Ensure Node.js is installed and run `npm install` inside `mathsteps_runner/`:
```bash
cd mathsteps_runner
npm install
cd ..
```

### 5. Frontend Build / Dependency Conflicts with React 19
**Error:** Dependency resolution errors during `npm install` in `frontend/`.  
**Solution:** Use the included `patch-package` setup:
```bash
cd frontend
npm install --legacy-peer-deps
npm run postinstall
cd ..
```

---

## License

This project is developed for educational research and mathematics instruction for Philippine Junior High School students under the DepEd curriculum framework.
