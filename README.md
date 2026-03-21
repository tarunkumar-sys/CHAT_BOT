<div align="center">

# ScribeNova

### Personalized AI Chat with Vector Memory, Website Q&A & a Living Mascot

![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![LangChain](https://img.shields.io/badge/LangChain-1.x-1C3C3C?style=flat-square)
![Ollama](https://img.shields.io/badge/Ollama-local-FF6B35?style=flat-square)
![Qdrant](https://img.shields.io/badge/Qdrant-vector--db-DC143C?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**ScribeNova** is a fully local, privacy-first AI chat application built on Next.js 16, LangChain, and Ollama. It features persistent vector memory, website crawling & Q&A, a fully customizable chatbot persona, and a canvas-rendered 3D animated mascot — all running on your own machine with zero cloud dependency.

[Features](#-features) · [Architecture](#-architecture) · [Quick Start](#-quick-start) · [Configuration](#-configuration) · [API Reference](#-api-reference) · [Troubleshooting](#-troubleshooting)

</div>

---

## Features

### Intelligent Agent
- Powered by **Ollama** — fully local LLM inference, no API keys needed
- **ReAct agent** via LangGraph — reasons, selects tools, and responds
- **5 built-in tools**: web search, calculator, clock, Pokémon info, website Q&A
- Markdown responses with clickable links, emails, and phone numbers

### Custom Memory
- Add personal facts in plain language: *"My name is Tarun"*, *"I live in Delhi"*
- Facts are embedded and stored in **Qdrant** vector DB
- Semantically retrieved at query time — the bot knows who you are
- Manage facts from the Settings panel (add / delete)

### Persistent Conversation Memory
- Every conversation is embedded and stored in Qdrant
- **Hybrid retrieval**: top-2 semantically similar + top-3 most recent
- 95% similarity deduplication — no redundant storage
- Survives server restarts

### Website Q&A
- Paste any URL → the bot crawls up to 15 pages with Playwright
- Content is chunked, embedded, and indexed in Qdrant
- **Fuzzy URL matching** — ask about "iotsolvez" and it finds `iotsolvez_vercel_app`
- Manage indexed websites from Settings: see chunk counts, delete entries
- Rich structured responses: bold sections, clickable links, contact blocks

### Customizable Bot Persona
- Set a custom **name** and **description** from the Settings panel
- The agent's system prompt updates live — the bot introduces itself by your chosen name
- Persona persists across the session

### KiroMascot — Canvas 3D Animated Avatar
- Pure HTML5 Canvas, zero external dependencies
- 3D white sphere with perspective-projected eyes, specular highlights, ground shadow
- **6 expressions**: `idle`, `happy`, `think`, `surprise`, `loading`, `sleep`
- Auto-blink, auto-glance, squash-and-stretch bounce physics
- Expression driven by chat state:
  - Loading → cycles `loading → think → surprise` over time
  - Response arrives → `happy` for 2s → `idle`
  - Error → `surprise` for 1.5s → `idle`
  - Past messages → `sleep` (closed eyes, floating z's)
  - Latest message → `idle` (alive and breathing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Next.js)                        │
│                                                                 │
│  Chat.tsx ──► KiroMascot.tsx (canvas, RAF loop)                 │
│     │                                                           │
│     ├── POST /api/agent    { message, botName, botDescription } │
│     ├── GET/POST/DELETE /api/memory   (custom facts)            │
│     ├── POST /api/website             (crawl & index)           │
│     └── GET/DELETE /api/websites      (list & remove)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Next.js API Routes                          │
│                                                                 │
│  agent/route.ts                                                 │
│    └── runAgent(message, userId, botName, botDescription)       │
│          ├── VectorMemory.getRelevantHistory()  ─┐              │
│          ├── VectorMemory.getRecentHistory()     ├─ Qdrant      │
│          ├── CustomMemory.getRelevantFacts()   ──┘              │
│          ├── createReactAgent(llm, tools, systemPrompt)         │
│          │     ├── searchTool (DuckDuckGo)                      │
│          │     ├── calculatorTool                               │
│          │     ├── timeTool                                     │
│          │     ├── pokemonTool                                  │
│          │     └── websiteQATool                                │
│          │           ├── resolveWebsiteDomain() ── Qdrant       │
│          │           ├── crawlWebsite() ─────────── Playwright  │
│          │           ├── chunkText()                            │
│          │           ├── createVectorstore() ────── Qdrant      │
│          │           └── getQaChain() ───────────── Ollama LLM  │
│          └── VectorMemory.saveConversation()  ──── Qdrant       │
└─────────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Local Infrastructure                         │
│                                                                 │
│  Ollama (port 11434)          Qdrant (port 6333)                │
│  ├── qwen2.5:1.5b (LLM)       ├── conversation_memory          │
│  └── nomic-embed-text         ├── user_custom_memory            │
│      (embeddings, 768d)       └── website_chunks                │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
scribe-nova/
├── app/
│   ├── api/
│   │   ├── agent/route.ts        # Main chat endpoint
│   │   ├── memory/route.ts       # Custom facts CRUD
│   │   ├── website/route.ts      # Crawl & index a URL
│   │   └── websites/route.ts     # List & delete indexed sites
│   ├── components/
│   │   ├── Chat.tsx              # Full chat UI + Settings modal
│   │   └── KiroMascot.tsx        # Canvas 3D animated mascot
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── agent.ts                  # ReAct agent orchestration
│   ├── chunker.ts                # RecursiveCharacterTextSplitter
│   ├── crawler.ts                # Playwright website crawler
│   ├── customMemory.ts           # User facts (Qdrant)
│   ├── memory.ts                 # Legacy (unused)
│   ├── qa.ts                     # RAG Q&A chain
│   ├── tools.ts                  # Tool definitions
│   ├── vectorMemory.ts           # Conversation memory (Qdrant)
│   ├── vectorstore.ts            # Website chunks + fuzzy resolver
│   └── websiteTool.ts            # LangChain website_qa tool
├── .env.local                    # Environment variables
├── README.md                     # This file
└── SYSTEM.md                     # Deep-dive technical reference
```

---

## Quick Start

### Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 20+ | |
| Ollama | latest | [ollama.ai](https://ollama.ai) |
| Docker | any | for Qdrant |
| Playwright Chromium | auto-installed | via `npx playwright install` |

### 1 — Clone & install

```bash
git clone https://github.com/your-username/scribe-nova.git
cd scribe-nova
npm install
```

### 2 — Pull Ollama models

```bash
# Install Ollama from https://ollama.ai, then:
ollama pull qwen2.5:1.5b
ollama pull nomic-embed-text

# Verify
ollama list
```

### 3 — Start Qdrant

```bash
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Verify
curl http://localhost:6333
```

### 4 — Install Playwright browser

```bash
npx playwright install chromium
```

### 5 — Configure environment

Create `.env.local` in the project root:

```env
# Ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b

# Qdrant
QDRANT_URL=http://localhost:6333

# Optional: LangSmith tracing
# LANGCHAIN_TRACING_V2=true
# LANGCHAIN_API_KEY=your-key
# LANGCHAIN_PROJECT=scribe-nova
```

### 6 — Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Usage Guide

### Basic Chat

Type any message and press Enter or click Send. The agent automatically selects the right tool.

```
You:  What time is it in Tokyo?
Kiro: It is currently Monday, March 21, 2026, 06:30 PM JST.

You:  Calculate 1234 * 5678
Kiro: 1234 × 5678 = 7,006,652

You:  Search for latest LLM benchmarks
Kiro: [searches DuckDuckGo and summarizes top 3 results]
```

### Custom Memory

Open **Settings → Memory** and add personal facts:

```
My name is Tarun
I am a software engineer
I live in Delhi
I prefer concise answers
My favourite language is Python
```

Now ask:

```
You:  What do you know about me?
Kiro: You're Tarun, a software engineer based in Delhi who prefers
      concise answers and works primarily with Python.
```

Facts are embedded and retrieved semantically — the bot only surfaces facts relevant to the current question.

### Website Q&A

**Option A — From Settings panel:**
1. Open Settings → Website
2. Paste a URL and click "Crawl & Index Website"
3. Wait for indexing (15–60s depending on site size)
4. Ask questions in chat

**Option B — Directly in chat:**
```
You:  Tell me about https://example.com
Kiro: [crawls automatically if not indexed, then answers]

You:  What services does example offer?
Kiro: [uses fuzzy matching to find the indexed site]
```

**Fuzzy URL matching** — once a site is indexed, you can refer to it by partial name:
```
# Site indexed as: iotsolvez_vercel_app
You:  What is iotsolvez about?   ← works without full URL
You:  Tell me about iotsolvez.vercel.app   ← also works
```

### Bot Customization

Open **Settings → General**:
- **Bot Name** — changes the name shown in the header and used in the system prompt
- **Description** — added to the system prompt so the bot adopts a persona

```
Name:        DevBot
Description: A no-nonsense assistant for senior engineers
```

The agent will now introduce itself as DevBot and respond accordingly.

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `qwen2.5:1.5b` | LLM model name |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant server URL |
| `LANGCHAIN_TRACING_V2` | — | Enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | — | LangSmith API key |
| `LANGCHAIN_PROJECT` | — | LangSmith project name |

### Switching LLM Models

Edit `OLLAMA_MODEL` in `.env.local`:

```env
# Fastest (least capable)
OLLAMA_MODEL=tinyllama

# Default — good balance
OLLAMA_MODEL=qwen2.5:1.5b

# Better quality, slower
OLLAMA_MODEL=llama3.2:3b

# Best quality, requires more RAM
OLLAMA_MODEL=mistral:7b
```

### Tuning Memory Retrieval

In `lib/agent.ts`:

```typescript
// How many semantically similar past conversations to load
const relevantHistory = await vectorMemory.getRelevantHistory(userId, input, 2);

// How many most-recent conversations to load
const recentHistory = await vectorMemory.getRecentHistory(userId, 3);

// Max total conversations passed to LLM
.slice(0, 3)
```

### Tuning Website Crawling

In `lib/websiteTool.ts`:

```typescript
const pages = await crawlWebsite(fullUrl, { maxPages: 15 });
// 5  → fast, shallow
// 15 → default
// 30 → thorough, slow
```

In `lib/qa.ts`:

```typescript
numPredict: 600,          // max tokens in Q&A response
k: 8,                     // chunks retrieved per query
// context limit
return context.length > 3500 ? context.substring(0, 3500) + '...' : context;
```

### Deduplication Threshold

In `lib/vectorMemory.ts`:

```typescript
const similarityThreshold = 0.95;
// 0.90 → stricter (saves more unique conversations)
// 0.98 → looser (deduplicates more aggressively)
```

---

## API Reference

### `POST /api/agent`

Run the AI agent.

**Request**
```json
{
  "message": "What is on example.com?",
  "botName": "ScribeNova",
  "botDescription": "Your intelligent AI assistant"
}
```

**Response**
```json
{
  "response": "Example.com is a domain reserved for illustrative examples..."
}
```

---

### `GET /api/memory`

List all custom memory facts for the default user.

**Response**
```json
{
  "facts": [
    { "id": "uuid", "text": "My name is Tarun", "userId": "default-user", "createdAt": "2026-03-21T..." }
  ]
}
```

### `POST /api/memory`

Add a new fact.

**Request**
```json
{ "fact": "I prefer dark mode", "userId": "default-user" }
```

### `DELETE /api/memory`

Delete a fact by ID.

**Request**
```json
{ "factId": "uuid", "userId": "default-user" }
```

---

### `POST /api/website`

Crawl and index a website.

**Request**
```json
{ "url": "https://example.com" }
```

**Response**
```json
{ "success": true, "pages": 12, "chunks": 87, "url": "https://example.com" }
```

---

### `GET /api/websites`

List all indexed websites with chunk counts.

**Response**
```json
{
  "sites": [
    { "domain": "example_com", "url": "https://example.com", "chunks": 87 }
  ]
}
```

### `DELETE /api/websites`

Remove all indexed data for a domain.

**Request**
```json
{ "domain": "example_com" }
```

---

## Troubleshooting

### Qdrant not running

```bash
# Check
curl http://localhost:6333

# Start
docker run -d --name qdrant -p 6333:6333 qdrant/qdrant

# Restart existing container
docker start qdrant
```

### Ollama model not found

```bash
ollama list                    # see what's installed
ollama pull qwen2.5:1.5b       # pull the LLM
ollama pull nomic-embed-text   # pull the embedding model
ollama serve                   # make sure server is running
```

### Playwright / crawler errors

```bash
npx playwright install chromium
# If on Linux, also install system deps:
npx playwright install-deps chromium
```

### Slow first response

The first query to a new website takes 15–60s (crawling + embedding). Subsequent queries use the cached index and respond in 5–15s. This is expected behavior.

### Website only crawls 1 page

Some sites are single-page apps or use JavaScript routing. The crawler only follows `<a href>` links on the same domain. This is a known limitation of static crawling.

### Memory not persisting

Qdrant stores data in-memory by default with the basic Docker command. To persist data across container restarts:

```bash
docker run -d --name qdrant \
  -p 6333:6333 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### Full reset

```bash
# Clear all Qdrant collections
curl -X DELETE http://localhost:6333/collections/conversation_memory
curl -X DELETE http://localhost:6333/collections/user_custom_memory
curl -X DELETE http://localhost:6333/collections/website_chunks

# Clear Next.js build cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules && npm install

# Restart
npm run dev
```

---

## Deployment

### Vercel + External Services

1. Deploy the Next.js app to Vercel
2. Host Ollama on a GPU VM (e.g. RunPod, vast.ai, or a VPS)
3. Host Qdrant on [Qdrant Cloud](https://cloud.qdrant.io) (free tier available)
4. Set environment variables in Vercel dashboard

```env
OLLAMA_BASE_URL=https://your-ollama-server.com
OLLAMA_MODEL=qwen2.5:1.5b
QDRANT_URL=https://your-cluster.qdrant.io:6333
```

### Docker Compose (self-hosted)

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - qdrant

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  qdrant_data:
```

> Note: Ollama with GPU support requires the NVIDIA Container Toolkit and a separate compose profile. See [Ollama Docker docs](https://hub.docker.com/r/ollama/ollama).

---

## Roadmap

- [x] Vector-based persistent conversation memory
- [x] Custom user memory (personal facts)
- [x] Website crawling and Q&A
- [x] Fuzzy URL / domain matching
- [x] Indexed website management (list + delete)
- [x] Customizable bot name and description
- [x] Canvas 3D animated mascot (KiroMascot)
- [x] Expression-driven mascot state machine
- [ ] Streaming responses (SSE)
- [ ] Multi-user / authentication
- [ ] File upload and document Q&A
- [ ] Voice input (Web Speech API)
- [ ] Conversation export (JSON / Markdown)
- [ ] Mobile-responsive layout

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6, React 19 |
| Language | TypeScript 5 |
| Styling | TailwindCSS 4 |
| AI Framework | LangChain 1.x, LangGraph 1.x |
| LLM | Ollama (qwen2.5:1.5b) |
| Embeddings | nomic-embed-text (768d, via Ollama) |
| Vector DB | Qdrant |
| Web Scraping | Playwright (Chromium) |
| Web Search | DuckDuckGo (duck-duck-scrape) |
| Mascot | HTML5 Canvas 2D API (zero deps) |
| Icons | Lucide React |
| Markdown | react-markdown 9 |

---

## License

MIT — see [LICENSE](./LICENSE) for details.

---

<div align="center">

Built with care using Next.js · LangChain · Ollama · Qdrant

</div>
