# ArrivalOS

> A modular decision-support platform for migrants in Germany

ArrivalOS transforms complex administrative, financial, and healthcare structures into **actionable decisions** and **scenario-based guidance**.

---

## What is ArrivalOS?

Moving to Germany means navigating a dense web of institutions — Jobcenter, Krankenkasse, Finanzamt — each with its own rules, deadlines, and terminology. ArrivalOS doesn't just deliver information; it helps you **decide what to do next**.

| Principle | Meaning |
|-----------|---------|
| **Clarity over complexity** | Plain language, not bureaucratic jargon |
| **Explainability over automation** | You understand *why* a recommendation is made |
| **Decision support over information delivery** | Actionable next steps, not Wikipedia articles |
| **Modularity over monolith** | Each feature is an independent, replaceable module |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend (Next.js)             │
└──────────────────────┬──────────────────────────┘
                       │ REST API
┌──────────────────────▼──────────────────────────┐
│                API Layer (Fastify)               │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│              Core Platform Layer                 │
│  Session · i18n · Events · Module Registry       │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   ┌─────────┐  ┌────────────┐  ┌──────────┐
   │ Module  │  │  Module    │  │  Module  │  ...
   │ Layer   │  │  Layer     │  │  Layer   │
   └────┬────┘  └─────┬──────┘  └────┬─────┘
        │              │              │
        └──────────────┼──────────────┘
                       ▼
              ┌─────────────────┐
              │ Shared Services  │
              │ Calc · Rules ·   │
              │ Translation ·    │
              │ Normalization    │
              └─────────────────┘
```

### Three Layers

#### 1. Core Platform (`packages/core`)

Minimal and stable. Handles:

- **Session management** — lightweight user context
- **Localization** — RU / UA / DE / EN
- **Event tracking** — module execution audit trail
- **Module registry** — dynamic registration, versioning, feature flags

#### 2. Module Layer (`packages/modules`)

Each feature is a fully independent plugin:

| Module | Priority | Description |
|--------|----------|-------------|
| **Financial Reality** | MVP | Brutto/Netto, tax classes, Bürgergeld eligibility |
| **System Translation** | MVP | German admin terms → plain language (RU/DE/EN/UA) |
| **Healthcare Navigation** | Standard | Krankenkasse, doctors, emergencies |
| **Grocery Optimization** | Standard | Budget intelligence, store strategies |
| **Life Event** | Standard | Scenario-based action plans for major life changes |

Modules never depend on each other. Each implements a strict contract:

```typescript
interface Module {
  id: string
  name: string
  version: string
  description: string
  inputSchema: object
  outputSchema: object
  execute(input: any, context: AppContext): Promise<any>
}
```

#### 3. Shared Services (`packages/shared-services`)

Reusable system services:

- **Calculation engine** — tax, net income, benefit estimates
- **Rules engine** — German administrative logic (Anmeldung, Krankenversicherung, etc.)
- **Translation service** — RU ↔ DE glossary
- **Data normalization** — input sanitization

---

## Project Structure

```
ArrivalOS/
├── apps/
│   ├── api/          # Fastify REST API
│   └── web/          # Next.js frontend
├── packages/
│   ├── core/         # Platform layer
│   ├── modules/      # Feature modules
│   └── shared-services/
├── package.json      # npm workspaces root
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20
- **npm** ≥ 10

### Install & Run

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Start API + Web (concurrently)
npm run dev
```

| Service | URL |
|---------|-----|
| Web UI | http://localhost:3000 |
| API | http://localhost:3001 |
| Health check | http://localhost:3001/health |

### Environment

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

---

## API Reference

### Modules

```bash
# List all registered modules
GET /api/modules

# Get module details
GET /api/modules/:id

# Execute a module
POST /api/modules/:id/execute
Content-Type: application/json

{
  "input": { ... },
  "context": {
    "userProfile": { "language": "ru" }
  }
}
```

### Sessions

```bash
# Create session
POST /api/sessions

# Get session
GET /api/sessions/:id

# Update context
PATCH /api/sessions/:id
```

### Localization

```bash
# Supported languages
GET /api/i18n/languages

# Translations for a language
GET /api/i18n/:lang
```

---

## Adding a New Module

1. Create a new file in `packages/modules/src/your-module/index.ts`
2. Implement the `Module` interface with Zod schemas
3. Export a `ModuleRegistration` object
4. Add it to `allModuleRegistrations` in `packages/modules/src/index.ts`

No core changes required. The registry picks it up automatically.

```typescript
export const myModule: Module<MyInput, MyOutput> = {
  id: 'my-module',
  name: 'My Module',
  version: '1.0.0',
  description: 'Does something useful',
  inputSchema: MyInputSchema,
  outputSchema: MyOutputSchema,
  async execute(input, context) {
    // Your logic here — use shared services, never other modules
    return { ... };
  },
};
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript, Fastify |
| Frontend | Next.js 15 + React 19 |
| Validation | Zod |
| Database | PostgreSQL (planned) |
| Caching | Redis (planned) |
| Rules engine | Python service (future) |

---

## Design Principles

- **Extensible** — hot-add modules without core changes
- **Modular** — strict input/output contracts per module
- **Testable** — each module independently testable
- **Simple MVP** — ship decision support, not feature completeness

---

## Long-Term Vision

ArrivalOS evolves into a **life operating system** for migrants in Europe:

- Financial decision intelligence
- Healthcare navigation
- Administrative guidance
- Daily life optimization

---

## License

Private — all rights reserved.
