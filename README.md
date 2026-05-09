# 🚀 ScribeNova — Advanced Local AI Assistant

[![Next.js](https://img.shields.io/badge/Next.js-16.1-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Ollama](https://img.shields.io/badge/Ollama-Local%20LLM-orange)](https://ollama.com/)
[![Qdrant](https://img.shields.io/badge/Qdrant-Vector%20DB-red)](https://qdrant.tech/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)

ScribeNova is a sophisticated, **fully local** AI companion built with the latest web technologies. It combines high-performance inference via **Ollama**, semantic long-term memory using **Qdrant**, and a beautiful, interactive UI to provide a private and powerful assistant experience directly on your machine.

---

## ✨ Key Features

### 🧠 Intelligent Memory System
- **Conversation Memory**: Remembers past interactions using semantic search, allowing for deep contextual continuity.
- **Custom Fact Store**: Proactively learn and recall specific user-provided facts (preferences, names, projects) to personalize every response.

### 🌐 Real-time Website Intelligence
- **Deep Crawling**: Built-in Playwright crawler that navigates websites, extracts meaningful content, and indexes it into your local vector database.
- **Instant Q&A**: Ask complex questions about any website and get structured, cited answers based on the crawled data.

### 🖼️ Advanced Vision & Image Tools
- **On-device Processing**: Apply filters, edge detection, and enhancements using OpenCV.js directly in the browser.
- **Vision Helpers**: Use AI to analyze and describe uploaded images (requires vision-capable local models).

### 🎨 Interactive Kiro Mascot
- **Canvas-Rendered Avatar**: Meet Kiro, your animated assistant rendered with high-performance canvas physics.
- **Emotional Intelligence**: Kiro reacts to chat states—thinking, sleeping, being happy, or surprised—making the interaction feel alive.

---

## 📸 Demo

| Chat UI | Customization | Output |
| :---: | :---: | :---: |
| <img src="public/demo/preview0.png" width="300" alt="Chat UI"> | <img src="public/demo/preview1.png" width="300" alt="Customization"> | <img src="public/demo/preview2.png" width="300" alt="Output"> |

---

## 🏗️ System Architecture

ScribeNova utilizes a multi-layered agentic architecture designed for privacy and speed.

```mermaid
graph TD
    User((User)) <--> UI[Next.js Frontend / React 19]
    UI <--> API[Next.js API Routes]
    
    subgraph Agent_Orchestrator [Agentic Core]
        API <--> LG[LangGraph ReAct Agent]
        LG <--> LLM[Ollama LLM - Qwen 2.5]
    end
    
    subgraph Knowledge_Base [Vector Storage]
        LG <--> Qdrant[(Qdrant Vector DB)]
        Qdrant --- CM[Conversation Memory]
        Qdrant --- UM[User Facts]
        Qdrant --- WC[Website Chunks]
    end
    
    subgraph Tools [External Tools]
        LG --- WQA[Website Q&A Tool]
        LG --- Search[DuckDuckGo Search]
        LG --- Calc[Calculator]
        WQA --- Crawler[Playwright Crawler]
    end
    
    subgraph Client_Side [Local Browser Tools]
        UI --- CV[OpenCV.js Processing]
        UI --- Mascot[Canvas Kiro Mascot]
    end
```

### Data Flow Execution:
1.  **Input**: User sends a message via the **React 19** interface.
2.  **Context Retrieval**: The **LangGraph** agent queries **Qdrant** for relevant past conversations and user facts.
3.  **Reasoning**: **Ollama** processes the combined context and decides whether to use a tool (e.g., search or crawl).
4.  **Action**: If a tool is called, the system executes it (e.g., **Playwright** crawls a site) and feeds the results back.
5.  **Generation**: The final response is generated, sanitized, and streamed back to the UI.

---

## 📁 Project Structure

```text
llm-next-app/
├── app/                    # Next.js App Router
│   ├── api/                # Backend API Endpoints (Agent, Memory, Website)
│   ├── components/         # React Components (Chat, KiroMascot, Settings)
│   ├── globals.css         # Tailwind & Global Styles
│   └── layout.tsx          # Root Layout
├── lib/                    # Core Logic & Utilities
│   ├── agent.ts            # LangChain/LangGraph Agent Definition
│   ├── crawler.ts          # Playwright Web Crawler
│   ├── imageProcessing.ts  # OpenCV.js Vision Tools
│   ├── vectorMemory.ts     # Conversation Persistence
│   ├── customMemory.ts     # User Fact Management
│   └── tools.ts            # Tool Definitions (Search, Calculator, etc.)
├── public/                 # Static Assets & Demo Images
├── .env.example            # Environment Variable Template
├── SYSTEM.md               # Deep Technical Reference
└── package.json            # Dependencies & Scripts
```

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16, TypeScript, Tailwind CSS 4, Framer Motion
- **AI Core**: LangChain, LangGraph, Ollama
- **Database**: Qdrant (Vector Search)
- **Scraping**: Playwright, Cheerio
- **Vision**: OpenCV.js

---

## 🏁 Getting Started

### 1. Prerequisites
- **Node.js** (v20.x+)
- **Ollama**: [Download](https://ollama.com/download)
- **Docker**: (Recommended for Qdrant)

### 2. Setup Ollama
```bash
ollama pull qwen2.5:1.5b
ollama pull nomic-embed-text
```

### 3. Run Qdrant
```bash
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

### 4. Installation
```bash
npm install
npx playwright install chromium
cp .env.example .env.local
npm run dev
```

---

Built with ❤️ by the AI Community.
