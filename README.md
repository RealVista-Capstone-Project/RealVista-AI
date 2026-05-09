# RealVista AI Microservice

## 💖 Heartfelt Gratitude

We want to express our deepest appreciation to the incredible developers who have poured their passion and dedication into **RealVista**. This project wouldn't be where it is today without your hard work and commitment.

<div align="center">
  <table style="border: none; border-collapse: collapse;">
    <tr>
      <td align="center" valign="bottom">
        <a href="https://github.com/ThanhTriIsCoding">
          <img src="https://github.com/ThanhTriIsCoding.png" width="100px;" alt="ThanhTriIsCoding" style="border-radius: 50%; border: 2px solid #ffcc00;"/><br />
          <sub><b>ThanhTriIsCoding</b></sub>
        </a>
      </td>
      <td align="center" valign="bottom">
        <a href="https://github.com/Hoang-Nguyen-Huy">
          <img src="https://github.com/Hoang-Nguyen-Huy.png" width="130px;" alt="Hoang-Nguyen-Huy" style="border-radius: 50%; border: 2px solid #ffcc00;"/><br />
          <sub><b>Hoang-Nguyen-Huy</b></sub>
        </a>
      </td>
      <td align="center" valign="bottom">
        <a href="https://github.com/HuyDiCode">
          <img src="https://github.com/HuyDiCode.png" width="160px;" alt="HuyDiCode" style="border-radius: 50%; border: 4px solid #ffd700; box-shadow: 0 0 15px rgba(255, 215, 0, 0.5);"/><br />
          <sub style="font-size: 1.2em;"><b>👑 HuyDiCode</b></sub>
        </a>
      </td>
      <td align="center" valign="bottom">
        <a href="https://github.com/nguyenhcp2004">
          <img src="https://github.com/nguyenhcp2004.png" width="130px;" alt="Damien Huynh" style="border-radius: 50%; border: 2px solid #ffcc00;"/><br />
          <sub><b>Damien Huynh</b></sub>
        </a>
      </td>
      <td align="center" valign="bottom">
        <a href="https://github.com/toki-ai">
          <img src="https://github.com/toki-ai.png" width="100px;" alt="toki-ai" style="border-radius: 50%; border: 2px solid #ffcc00;"/><br />
          <sub><b>toki-ai</b></sub>
        </a>
      </td>
    </tr>
  </table>

  <p align="center">
    <i>"Alone we can do so little; together we can do so much."</i>
  </p>
  
  **Marked on: 08.05.2026**
</div>

---

[![NestJS](https://img.shields.io/badge/framework-NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![LangChain](https://img.shields.io/badge/AI-LangChain-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

The **RealVista AI Microservice** is a core component of the RealVista ecosystem, providing intelligent real estate consultation and advanced search capabilities powered by a **LangGraph agentic workflow**.

> For a deep dive into the system design, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 🚀 Tech Stack

| Layer             | Technology                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Backend Framework | [NestJS](https://nestjs.com/)                                                                     |
| AI Orchestration  | [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/) |
| LLM               | Google Gemini (gemini-3.1-flash-lite-preview)                                                     |
| Embeddings        | Google Generative AI (gemini-embedding-001)                                                       |
| Vector Database   | [Qdrant](https://qdrant.tech/) (for RAG)                                                          |
| Monitoring        | [LangSmith](https://smith.langchain.com/)                                                         |
| Authentication    | API Key & Shared User Context                                                                     |
| API Documentation | Swagger UI                                                                                        |

## 🏗️ Architecture Overview

```
Frontend ──Headers/Key──▶ AI Microservice ──REST──▶ Backend API (Spring Boot)
                       │
                       ├──REST────▶ Qdrant (Vector DB / RAG)
                       └──API─────▶ Google AI (gemini-3.1-flash-lite-preview)
```

The service implements an **Agentic Workflow** using LangGraph:

1.  **RAG Node** — Retrieves relevant market knowledge from Qdrant.
2.  **Reasoner Node** — LLM reasons with user context and conversation history.
3.  **Tool Node** — Executes tool calls (property search, price prediction, comps, recommendations).
4.  **Loop** — Reasoner ↔ Tools repeat until the LLM is satisfied with the answer.

## 🛠️ Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Docker** & **Docker Compose** (for Qdrant vector DB)

### Quick Start with Docker

```bash
# 1. Clone and install
git clone <repo-url>
cd RealVista-AI
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env with your actual API keys

# 3. Start Qdrant (vector database)
docker compose up -d qdrant

# 4. Run the service
npm run start:dev
```

### Full Docker Setup

Run everything in containers:

```bash
docker compose up -d
```

This starts:

- **ai-service** on `http://localhost:3001`
- **Qdrant** on `http://localhost:6333` (REST) / `localhost:6334` (gRPC)

### Manual Setup (without Docker)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env

# 3. Development mode
npm run start:dev

# 4. Production build
npm run build
npm run start:prod
```

## 🔐 Environment Variables

| Variable                 | Required | Description                                        |
| ------------------------ | -------- | -------------------------------------------------- |
| `PORT`                   | No       | Service port (default: `3001`)                     |
| `BACKEND_API_URL`        | Yes      | Main backend API URL                               |
| `SERVICE_API_KEY`        | Yes      | API Key for internal microservice communication    |
| `GOOGLE_API_KEY`         | Yes      | Google AI API key                                  |
| `LANGCHAIN_TRACING_V2`   | No       | Enable LangSmith tracing (`true`/`false`)          |
| `LANGCHAIN_ENDPOINT`     | No       | LangSmith API endpoint                             |
| `LANGCHAIN_API_KEY`      | No       | LangSmith API key                                  |
| `LANGCHAIN_PROJECT`      | No       | LangSmith project name                             |
| `QDRANT_URL`             | No       | Qdrant REST URL (default: `http://localhost:6333`) |
| `QDRANT_API_KEY`         | No       | Qdrant API Key (optional)                          |
| `QDRANT_COLLECTION_NAME` | No       | Collection name (default: `realestate_knowledge`)  |

## 📂 Project Structure

```
src/
├── ai/                    # AI module (controller, services, DTOs, interfaces)
│   ├── services/          # AiService, LangGraphService, ToolsService
│   ├── interfaces/        # UserContext, JwtPayload, LangGraphStreamEvent
│   ├── state/             # AgentState interface
│   └── dto/               # ChatQueryDto
├── auth/                  # JWT authentication (Passport strategy, guards)
├── decorators/            # Custom decorators (@User)
├── main.ts                # App bootstrap + Swagger
└── app.module.ts          # Root module
```

## 📚 API Documentation

Once running, access Swagger UI at: `http://localhost:3001/api/docs`

### Endpoints

| Method | Path         | Description                      |
| ------ | ------------ | -------------------------------- |
| `POST` | `/ai/chat`   | Synchronous AI chat response     |
| `POST` | `/ai/stream` | SSE streaming (real-time tokens) |

Both endpoints require a valid `x-api-key` in the header.

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Lint
npm run lint
```

## 📄 License

This project is UNLICENSED.

---

_Developed by the RealVista Capstone Project team._
