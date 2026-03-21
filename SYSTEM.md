# ScribeNova — Technical Reference

This document is the deep-dive companion to [README.md](./README.md). It covers internal architecture, data flows, component contracts, Qdrant schema, and extension points.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Data Flow — End to End](#2-data-flow--end-to-end)
3. [Qdrant Collections Schema](#3-qdrant-collections-schema)
4. [lib/agent.ts](#4-libagentts)
5. [lib/vectorMemory.ts](#5-libvectormemoryts)
6. [lib/customMemory.ts](#6-libcustommemoryts)
7. [lib/vectorstore.ts](#7-libvectorstorets)
8. [lib/qa.ts](#8-libqats)
9. [lib/websiteTool.ts](#9-libwebsitetoolts)
10. [lib/crawler.ts](#10-libcrawlerts)
11. [lib/chunker.ts](#11-libchunkerts)
12. [lib/tools.ts](#12-libtoolsts)
13. [API Routes](#13-api-routes)
14. [KiroMascot — Canvas Rendering System](#14-kiromascot--canvas-rendering-system)
15. [Chat.tsx — UI State Machine](#15-chattsx--ui-state-machine)
16. [Performance Characteristics](#16-performance-characteristics)
17. [Extension Points](#17-extension-points)
18. [Environment Variables Reference](#18-environment-variables-reference)

---

## 1. System Overview

ScribeNova is a **fully local** AI chat application. No data leaves the machine. All inference runs through Ollama, all vector storage runs through Qdrant, and all web scraping runs through a local Playwright Chromium instance.

### Core Subsystems

| Subsystem | Responsibility |
|---|---|
| Agent | Orchestrates LLM + tool calls via LangGraph ReAct |
| Vector Memory | Persists and retrieves conversation history |
| Custom Memory | Stores user-provided personal facts |
| Website Q&A | Crawls, indexes, and answers questions about websites |
| KiroMascot | Canvas-rendered animated avatar driven by chat state |
| Settings Modal | UI for persona, memory, and website management |

### Runtime Dependencies

```
Ollama  (port 11434)  — LLM inference + embeddings
Qdrant  (port 6333)   — vector storage (3 collections)
Playwright Chromium   — headless browser for crawling
```

---

## 2. Data Flow — End to End

### Chat Message Flow

```
1. User types message → Chat.tsx handleSubmit()
   ├── setIsLoading(true)
   ├── startLoadingCycle()  → KiroMascot expression: loading → think → surprise
   └── POST /api/agent { message, botName, botDescription }

2. /api/agent → runAgent(message, userId, botName, botDescription)
   │
   ├── 2a. Memory retrieval
   │     ├── VectorMemory.getRelevantHistory(userId, query, 2)
   │     │     └── embed query → Qdrant cosine search → top 2 results
   │     ├── VectorMemory.getRecentHistory(userId, 3)
   │     │     └── Qdrant scroll ordered by timestamp → top 3
   │     └── deduplicate + slice(0, 3) → historyContext string
   │
   ├── 2b. Custom memory retrieval
   │     └── CustomMemory.getRelevantFacts(userId, query, 5)
   │           └── embed query → Qdrant cosine search (threshold 0.4) → top 5
   │
   ├── 2c. Build system messages
   │     ├── buildSystemPrompt(botName, botDescription)
   │     ├── system message: factsContext + historyContext
   │     └── user message: input
   │
   ├── 2d. createReactAgent(llm, tools, systemPrompt)
   │     └── stream({ messages })
   │           ├── AIMessage with tool_calls → log tool name
   │           ├── ToolMessage → log completion
   │           └── AIMessage without tool_calls → finalContent
   │
   ├── 2e. Validate + clean response
   │     ├── containsPromptLeakage() check
   │     └── cleanResponse() if needed
   │
   └── 2f. Save to vector memory
         └── VectorMemory.saveConversation(userId, input, finalContent)
               ├── embed combined text
               ├── search for 95% similar existing entry
               └── upsert if unique

3. Response → Chat.tsx
   ├── stopLoadingCycle()
   ├── setKiroExpr('happy') → 2s → 'idle'
   └── append assistant message to messages[]
         └── KiroMascot: previous latest → 'sleep', new latest → 'idle'
```

### Website Indexing Flow

```
POST /api/website { url }
  │
  ├── Validate URL format
  ├── websiteExists(url) → resolveWebsiteDomain(url) → Qdrant scroll
  │     └── if exists: return { cached: true }
  │
  ├── crawlWebsite(url, { maxPages: 15 })
  │     ├── Playwright chromium.launch()
  │     ├── Block: images, scripts, fonts, stylesheets, analytics
  │     ├── BFS queue starting from startUrl
  │     ├── Per page: goto → scroll → extract text + links
  │     ├── MD5 dedup on content hash
  │     └── Return string[] of page text
  │
  ├── chunkText(pages)
  │     └── RecursiveCharacterTextSplitter(400, 50) → string[]
  │
  └── createVectorstore(chunks, url)
        ├── Extract domain: hostname.replace(/\./g, '_')
        ├── Ensure collection exists
        ├── OllamaEmbeddings.embedDocuments(chunks)
        └── QdrantVectorStore.fromTexts(chunks, metadatas)
              metadata per chunk: { source: url, domain: domain }
```

---

## 3. Qdrant Collections Schema

### `conversation_memory`

Stores embedded conversation turns.

```typescript
{
  id: string,           // UUID v4
  vector: number[],     // 768-dim nomic-embed-text embedding
                        // of "User: {msg}\nAssistant: {reply}"
  payload: {
    userId: string,
    userMessage: string,
    assistantMessage: string,
    timestamp: number,  // Unix ms
    sessionId: string,
    date: string,       // ISO 8601
  }
}
```

Filters used: `userId`, `sessionId`
Distance: Cosine

### `user_custom_memory`

Stores user-provided personal facts.

```typescript
{
  id: string,           // UUID v4
  vector: number[],     // 768-dim embedding of fact text
  payload: {
    userId: string,
    text: string,       // the raw fact
    createdAt: string,  // ISO 8601
  }
}
```

Filters used: `userId`
Distance: Cosine
Score threshold for retrieval: 0.4

### `website_chunks`

Stores chunked website content.

```typescript
{
  id: string,           // UUID v4 (auto-generated by QdrantVectorStore)
  vector: number[],     // 768-dim embedding of chunk text
  payload: {
    metadata: {
      source: string,   // full URL e.g. "https://example.com/about"
      domain: string,   // normalized e.g. "example_com"
    },
    content: string,    // chunk text
  }
}
```

Filters used: `metadata.domain`
Distance: Cosine
Chunks per query: k=8

---

## 4. lib/agent.ts

**Exports:** `runAgent(input, userId, botName, botDescription)`, `llm`

### `buildSystemPrompt(botName, botDescription)`

Constructs the agent's system prompt dynamically. The bot name and description come from the user's Settings panel and are passed through the API route on every request.

### `runAgent(input, userId, botName, botDescription)`

Main orchestration function. Steps:

1. Retrieve hybrid memory (semantic + recent, deduplicated, max 3)
2. Retrieve relevant custom facts (semantic, max 5, threshold 0.4)
3. Build context string: facts first, then history
4. Create ReAct agent with `createReactAgent({ llm, tools, messageModifier })`
5. Stream agent execution, capture final `AIMessage` content
6. Run prompt leakage detection + cleaning
7. Save conversation to vector memory (non-blocking, errors swallowed)

### Prompt Leakage Detection

Patterns checked: `You are a`, `CRITICAL RULES`, `Core Principles:`, `Tool Usage Guidelines:`, `Available Tools:`, `[LOG]`

If detected, `cleanResponse()` strips the leaked fragments with regex replacements.

### LLM Settings

```typescript
model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b'
temperature: 0
numPredict: 400
```

---

## 5. lib/vectorMemory.ts

**Class:** `VectorMemory` (singleton via `getVectorMemory()`)

**Collection:** `conversation_memory`
**Embedding model:** `nomic-embed-text` (768d)

### Key Methods

#### `saveConversation(userId, userMessage, assistantMessage, sessionId?)`

1. Calls `initialize()` to ensure collection exists
2. Embeds `"User: {msg}\nAssistant: {reply}"`
3. Searches for existing entry with score ≥ 0.95
4. If duplicate found: skips save, logs
5. If unique: upserts with full metadata payload

#### `getRelevantHistory(userId, currentQuery, limit, sessionId?)`

Embeds `currentQuery`, runs cosine search filtered by `userId` + `sessionId`, returns top `limit` results as `ConversationTurn[]`.

#### `getRecentHistory(userId, limit, sessionId?)`

Scrolls collection filtered by `userId` + `sessionId`, orders by `timestamp` descending, returns top `limit`.

#### `formatHistoryForContext(conversations, currentQuery?)`

Returns a formatted string:
```
Previous conversation context:
User: ...
Assistant: ...

User: ...
Assistant: ...
```

Skips entries where `userMessage === currentQuery` to avoid redundancy.

---

## 6. lib/customMemory.ts

**Class:** `CustomMemory` (singleton via `getCustomMemory()`)

**Collection:** `user_custom_memory`
**Embedding model:** `nomic-embed-text` (768d)

### Key Methods

| Method | Description |
|---|---|
| `addFact(userId, text)` | Embeds text, upserts to Qdrant, returns `MemoryFact` |
| `deleteFact(userId, factId)` | Deletes point by ID |
| `listFacts(userId)` | Scrolls all facts for user, sorted by `createdAt` desc |
| `getRelevantFacts(userId, query, limit)` | Semantic search with score threshold 0.4 |
| `formatFactsForContext(facts)` | Returns `"Known facts about the user:\n- fact1\n- fact2"` |

### MemoryFact Type

```typescript
interface MemoryFact {
  id: string;
  text: string;
  userId: string;
  createdAt: string; // ISO 8601
}
```

---

## 7. lib/vectorstore.ts

**Exports:** `getQdrantClient`, `createVectorstore`, `websiteExists`, `resolveWebsiteDomain`

### `resolveWebsiteDomain(nameOrUrl)`

The fuzzy domain resolver. Enables partial name matching for indexed websites.

**Algorithm:**
1. Scroll all points in `website_chunks` (limit 200), collect unique `metadata.domain` values
2. Normalize input: lowercase, strip protocol/www/path, replace `.` and `-` with `_`
3. Try exact match
4. Try partial/contains match (`d.includes(needle) || needle.includes(d)`)
5. Try token match: split both on `_`, check if any token with length > 2 appears in domain tokens
6. Return matched domain string or `null`

**Example:**
```
Input: "iotsolvez"
Stored domain: "iotsolvez_vercel_app"
Step 3: no exact match
Step 4: "iotsolvez_vercel_app".includes("iotsolvez") → true → return "iotsolvez_vercel_app"
```

### `websiteExists(websiteUrl)`

Delegates to `resolveWebsiteDomain(websiteUrl)`, returns `domain !== null`.

### `createVectorstore(chunks, websiteUrl)`

1. Extracts domain: `new URL(websiteUrl).hostname.replace(/\./g, '_')`
2. Ensures `website_chunks` collection exists (768d, Cosine)
3. Builds metadata array: `{ source: websiteUrl, domain }`
4. Calls `QdrantVectorStore.fromTexts(chunks, metadatas, embeddings, { client, collectionName })`

---

## 8. lib/qa.ts

**Export:** `getQaChain(websiteUrlOrName)`

### Domain Resolution

```typescript
const resolved = await resolveWebsiteDomain(websiteUrlOrName);
if (resolved) {
  domain = resolved;
} else {
  domain = new URL(...).hostname.replace(/\./g, '_');
}
```

This means `getQaChain` accepts full URLs, partial names, or already-normalized domain strings.

### Retriever

```typescript
vectorStore.asRetriever({
  k: 8,
  filter: { must: [{ key: 'metadata.domain', match: { value: domain } }] }
})
```

### LLM Settings

```typescript
model: process.env.OLLAMA_MODEL || 'qwen2.5:1.5b'
temperature: 0
numPredict: 600
```

### Prompt Structure

The prompt enforces strict markdown output:
- 1-sentence plain-text summary (no heading)
- `**Bold**` section headers with blank lines between sections
- All links as `[text](url)`, emails as `[e@d.com](mailto:...)`, phones as `[+91...](tel:...)`
- Bullet lists for services/skills/features
- Max 220 words
- Mandatory `**Contact**` section if contact data exists

### Context Limiting

```typescript
context.length > 3500 ? context.substring(0, 3500) + '...' : context
```

---

## 9. lib/websiteTool.ts

**Export:** `websiteQATool` (LangChain `tool()`)

**Tool name:** `website_qa`

### Handler Logic

```typescript
1. resolveWebsiteDomain(website)  → check if already indexed by partial name
2. if resolvedDomain === null:
     crawlWebsite(fullUrl, { maxPages: 15 })
     chunkText(pages)
     createVectorstore(chunks, fullUrl)
3. getQaChain(resolvedDomain ?? fullUrl)
4. chain.invoke({ input: question })
5. return result.answer
```

The key insight: `resolveWebsiteDomain` is called before `websiteExists` so that partial names (e.g. "iotsolvez") correctly skip re-crawling even when the full URL wasn't provided.

---

## 10. lib/crawler.ts

**Export:** `crawlWebsite(startUrl, options)`

### Algorithm

BFS crawl restricted to the same hostname as `startUrl`.

```
queue = [startUrl]
visited = Set<string>
contentHashes = Set<string>  // MD5 dedup

while queue.length > 0 and pages.length < maxPages:
  url = queue.shift()
  if visited.has(url): continue
  visited.add(url)

  page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
  scroll page (800px steps, 100ms intervals, max 3s)
  wait for DOM stability (3s timeout)

  text = page.evaluate() → extract innerText, filter noise
  hash = MD5(text)
  if contentHashes.has(hash): continue  // duplicate content
  contentHashes.add(hash)
  pages.push(text)

  links = page.$$eval('a[href]') → filter same-domain, normalize
  queue.push(...newLinks)
```

### Resource Blocking

All of the following are aborted before download:
- Resource types: `image`, `media`, `font`, `stylesheet`, `script`, `other`
- URL patterns: `analytics`, `tracking`, `ads`, `facebook`, `twitter`, `google-analytics`, `doubleclick`, `.css`, `.jpg`, `.png`, `.gif`, `.svg`, `.woff`, `.ttf`

Result: ~70% reduction in page load time.

---

## 11. lib/chunker.ts

**Export:** `chunkText(pages)`

Uses `RecursiveCharacterTextSplitter` from `@langchain/textsplitters`:

```typescript
chunkSize: 400
chunkOverlap: 50
```

Input: `string[]` (one string per crawled page)
Output: `string[]` (flat array of chunks)

---

## 12. lib/tools.ts

**Export:** `tools` array

| Tool | Name | Source |
|---|---|---|
| `searchTool` | `duckduckgo_search` | `@langchain/community/tools/duckduckgo_search` |
| `calculatorTool` | `calculator` | `@langchain/community/tools/calculator` |
| `timeTool` | `current_time` | custom `tool()` — IST locale string |
| `pokemonTool` | `pokemon_info` | custom `tool()` — PokeAPI |
| `websiteQATool` | `website_qa` | `lib/websiteTool.ts` |

### pokemonTool Schema

```typescript
z.object({
  name: z.string(),
  field: z.enum(['height', 'weight', 'type', 'ability', 'image']).optional()
})
```

---

## 13. API Routes

### `POST /api/agent`

Accepts `{ message, botName?, botDescription? }`. Calls `runAgent`. Returns `{ response }`.

### `GET /api/memory` · `POST /api/memory` · `DELETE /api/memory`

CRUD for `user_custom_memory` collection via `CustomMemory` class.

- GET: `?userId=default-user` → `{ facts: MemoryFact[] }`
- POST: `{ fact, userId }` → `{ fact: MemoryFact }`
- DELETE: `{ factId, userId }` → `{ success: true }`

### `POST /api/website`

Crawl and index a URL. Checks `websiteExists` first (returns `{ cached: true }` if already indexed). Returns `{ success, pages, chunks, url }`.

### `GET /api/websites` · `DELETE /api/websites`

Manage indexed websites.

- GET: Scrolls `website_chunks`, groups by `metadata.domain`, returns `{ sites: [{ domain, url, chunks }] }`
- DELETE: `{ domain }` → deletes all points matching `metadata.domain` filter

---

## 14. KiroMascot — Canvas Rendering System

**File:** `app/components/KiroMascot.tsx`

**Exports:** `default KiroMascot`, `KiroAvatar` (thin wrapper), `KiroExpression` type

### Expression Type

```typescript
type KiroExpression = 'idle' | 'happy' | 'think' | 'surprise' | 'loading' | 'sleep'
```

### Animation State (`AnimState`)

All animation state lives in a single `useRef` object — no `useState`, no re-renders from the animation loop.

```typescript
{
  t: number,          // frame counter
  y: number,          // vertical float offset (px)
  vy: number,         // vertical velocity (bounce physics)
  sx: number,         // horizontal scale (squash/stretch)
  sy: number,         // vertical scale
  tx: number,         // head turn X (smoothed, -1 to 1)
  ty: number,         // head tilt Y (smoothed)
  txT: number,        // head turn target
  tyT: number,        // head tilt target
  lx: number,         // eye look X (smoothed)
  ly: number,         // eye look Y (smoothed)
  lxT: number,        // eye look X target
  lyT: number,        // eye look Y target
  blink: number,      // 0=open, 1=closed (smoothed)
  blinkT: number,     // blink target
  spinAngle: number,  // for loading orbiting eyes
}
```

### Render Pipeline (per frame)

```
1. clearRect
2. Ground shadow — squashed ellipse, opacity fades with float height
3. Sphere body
   ├── Clip to circle
   ├── Radial gradient (white center → gray edge)
   ├── Ambient occlusion overlay
   ├── Border stroke
   └── Specular highlights (two ellipses, rotated)
4. Eyes (per eye, with 3D perspective projection)
   ├── pX = faceX * cos(tx * 0.42)
   ├── pZ = faceX * sin(tx * 0.42)
   ├── depth = 1 + pZ * 0.52
   ├── skip if pZ < -0.42 (behind head)
   └── draw based on expression:
       idle/default → black circle + dual shine dots
       happy        → arc stroke (upturned) + blush ellipses
       think left   → squinted horizontal ellipse
       surprise     → large circle + iris ring + two shines
       loading      → orbiting dot (opposite phase per eye)
       sleep        → downward arc stroke (closed eye)
5. Sleep Z's — two floating 'z' characters with opacity pulse
```

### Physics

**Bounce:** `vy += R * 0.006` (gravity), `vy *= 0.30` on ground impact. Squash on impact: `sx = 1 + sq * 1.3`, `sy = 1 - sq`. Recovery via lerp toward 1.

**Float patterns:**
- `idle`/`think`: dual-sine `sin(t*0.022)*R*0.14 + sin(t*0.017)*R*0.04`
- `happy`: single-sine `sin(t*0.022)*R*0.08`
- `loading`: `sin(t*0.05)*R*0.09` + head sway
- `sleep`: very slow `sin(t*0.012)*R*0.06`

**Smoothing:** `lerp(a, b, t)` — head turn 0.075, eye look 0.12, blink 0.22

### Auto-Blink & Auto-Glance (idle only)

Both use `setTimeout` chains (not RAF) to avoid coupling to frame rate.

- Blink: fires every 1500–4000ms, sets `blinkT=1` for 115ms then resets
- Glance: fires every 2500–5500ms, sets random `txT/tyT/lxT/lyT`, resets after 500–1100ms

Both are cleaned up in `useEffect` return to prevent setState on unmounted component.

### HiDPI Support

```typescript
const dpr = Math.min(window.devicePixelRatio || 1, 2)
canvas.width  = size * dpr
canvas.height = size * dpr
canvas.style.width  = size + 'px'
canvas.style.height = size + 'px'
ctx.scale(dpr, dpr)
```

---

## 15. Chat.tsx — UI State Machine

### Component Hierarchy

```
Chat()
├── SettingsModal (portal-style fixed overlay)
│   ├── Tab: General  → bot name + description
│   ├── Tab: Memory   → custom facts CRUD
│   └── Tab: Website  → crawl input + indexed sites list
├── Sidebar (collapsible icon rail)
├── Header (bot name + Customize button)
├── Chat area
│   ├── Landing state (no messages)
│   │   └── LandingInput + suggestion chips
│   └── Messages state
│       ├── messages.map() → message bubbles
│       │   ├── User: stone-900 bubble, right-aligned
│       │   └── Assistant: white bubble + KiroAvatar
│       │       ├── latest assistant msg → expression='idle'
│       │       └── past assistant msgs  → expression='sleep'
│       └── isLoading → typing bubble + KiroAvatar(loadingExpr)
└── ChatInput (bottom bar, shown when messages exist)
```

### Key State

| State | Type | Purpose |
|---|---|---|
| `messages` | `Message[]` | Full conversation history |
| `isLoading` | `boolean` | Fetch in progress |
| `kiroExpr` | `KiroExpression` | Post-response expression (happy → idle) |
| `loadingExpr` | `KiroExpression` | Cycles during loading |
| `loadingTimersRef` | `Ref<Timeout[]>` | Timer handles for cycle cleanup |
| `botConfig` | `BotConfig` | Name + description from Settings |
| `sidebarOpen` | `boolean` | Sidebar visibility |
| `settingsOpen` | `boolean` | Settings modal visibility |

### Loading Expression Cycle

```
startLoadingCycle():
  t=0ms  → setLoadingExpr('loading')
  t=4s   → setLoadingExpr('think')
  t=8s   → setLoadingExpr('surprise')
  t=14s  → setLoadingExpr('loading')

stopLoadingCycle():
  clearTimeout all 3 timers
```

Called: `startLoadingCycle()` before fetch, `stopLoadingCycle()` in try and catch blocks.

### Sleep Expression Logic

In `messages.map()`:

```typescript
const isLatestAssistant =
  messages.filter(m => m.sender === 'assistant').at(-1)?.id === message.id

// latest → idle (alive), past → sleep (resting)
expression = isLatestAssistant ? 'idle' : 'sleep'
```

This recalculates on every render, so when a new message arrives the previous "latest" automatically transitions to sleep.

---

## 16. Performance Characteristics

### Response Times (approximate, local hardware)

| Operation | First time | Cached |
|---|---|---|
| Simple chat (no tools) | 3–8s | 3–8s |
| Web search | 5–12s | — |
| Website Q&A (small site, 5 pages) | 20–40s | 5–10s |
| Website Q&A (large site, 15 pages) | 45–90s | 5–10s |
| Custom memory retrieval | +0.5–1s | — |

### Memory Usage

| Component | Approximate |
|---|---|
| Ollama (qwen2.5:1.5b) | ~1.5 GB RAM |
| Qdrant (Docker) | ~200 MB base |
| Playwright Chromium | ~300 MB during crawl |
| Next.js dev server | ~200 MB |

### Qdrant Collection Sizes

| Collection | Typical size |
|---|---|
| `conversation_memory` | ~2 KB per turn |
| `user_custom_memory` | ~1 KB per fact |
| `website_chunks` | ~5–50 KB per site (varies) |

---

## 17. Extension Points

### Adding a New Tool

1. Define in `lib/tools.ts` using `tool()` from `@langchain/core/tools`
2. Add to the `tools` array export
3. Add a description line in `buildSystemPrompt()` in `lib/agent.ts`

```typescript
// lib/tools.ts
export const weatherTool = tool(
  async ({ city }: { city: string }) => {
    // fetch weather data
    return `Weather in ${city}: ...`;
  },
  {
    name: 'weather',
    description: 'Get current weather for a city',
    schema: z.object({ city: z.string() }),
  }
);

export const tools = [...existingTools, weatherTool];
```

### Adding a New KiroMascot Expression

1. Add the string literal to `KiroExpression` type in `KiroMascot.tsx`
2. Add a case in `applyExpression()` to set targets
3. Add a rendering branch in the eye drawing section
4. Optionally add a float pattern in the update loop

### Adding a New Settings Tab

1. Add tab id to the `tabs` array in `SettingsModal`
2. Add corresponding state variables
3. Add JSX block `{tab === 'your-tab' && (...)}`
4. Create API route if backend storage is needed

### Switching to a Different Embedding Model

Change in both `lib/vectorMemory.ts`, `lib/customMemory.ts`, and `lib/vectorstore.ts`:

```typescript
this.embeddings = new OllamaEmbeddings({
  model: 'mxbai-embed-large',  // 1024d — update EMBEDDING_DIM too
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});
```

Also update `EMBEDDING_DIM` constant and **delete existing collections** (dimension mismatch will cause errors):

```bash
curl -X DELETE http://localhost:6333/collections/conversation_memory
curl -X DELETE http://localhost:6333/collections/user_custom_memory
curl -X DELETE http://localhost:6333/collections/website_chunks
```

---

## 18. Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `OLLAMA_BASE_URL` | Yes | `http://localhost:11434` | Ollama server base URL |
| `OLLAMA_MODEL` | Yes | `qwen2.5:1.5b` | Model used for LLM inference and Q&A |
| `QDRANT_URL` | Yes | `http://localhost:6333` | Qdrant REST API URL |
| `LANGCHAIN_TRACING_V2` | No | — | Set to `true` to enable LangSmith tracing |
| `LANGCHAIN_API_KEY` | No | — | LangSmith API key |
| `LANGCHAIN_PROJECT` | No | — | LangSmith project name |

The embedding model (`nomic-embed-text`) is hardcoded in the three memory/vectorstore files and pulled separately via `ollama pull nomic-embed-text`. It is not configurable via environment variable without code changes.

---

*Last updated: March 2026*
