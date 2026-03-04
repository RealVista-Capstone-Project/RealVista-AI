# ⚡ Quickstart Guide: RealVista AI

Follow this guide to get the RealVista AI microservice up and running in less than 5 minutes.

## 1. Prerequisites

- **Node.js** (v18+) & **npm**
- **Docker Desktop** (running)
- **API Keys**:
  - `GOOGLE_API_KEY` (from Google AI Studio)
  - `SERVICE_API_KEY` (any secure string for internal auth)

## 2. Setup Environment

Copy the example environment file and fill in your keys:

```bash
cp .env.example .env
```

**Required Variables in `.env`:**

- `GOOGLE_API_KEY`: Your Gemini API key.
- `SERVICE_API_KEY`: Must match the key used by your frontend/backend.
- `QDRANT_URL`: `http://localhost:6333` (Docker default).

## 3. Launch Infrastructure (Qdrant)

The AI agent depends on **Qdrant** for long-term memory (RAG). Start it via Docker:

```bash
docker compose up -d qdrant
```

Verify it's running: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

## 4. Install & Run

```bash
# Install dependencies
npm install

# Start in development mode
npm run start:dev
```

The app will start on [http://localhost:3001](http://localhost:3001).

---

## 5. Testing the API

### A. Simple Chat (Sync)

**Endpoint:** `POST /ai/chat`

**Headers:**

- `x-api-key`: `your-service-api-key`
- `Content-Type`: `application/json`

**Body:**

```json
{
  "prompt": "What are the current property trends in Da Nang?"
}
```

### B. Streaming Response (SSE)

**Endpoint:** `POST /ai/stream`

This endpoint returns data in real-time as the AI generates it. Use **Postman** (POST method) or a simple `curl` command:

```bash
curl -X POST http://localhost:3001/ai/stream \
     -H "x-api-key: your-service-api-key" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Tell me a long story about real estate."}'
```

## 6. Common Issues

| Issue                | Solution                                                           |
| :------------------- | :----------------------------------------------------------------- |
| **404 Not Found**    | Ensure you are using **POST**, not GET, for `/ai/stream`.          |
| **401 Unauthorized** | Check your `x-api-key` header matches `SERVICE_API_KEY` in `.env`. |
| **Fetch Failed**     | Ensure Qdrant is running (`docker ps`).                            |
| **Gemini Error**     | Verify your `GOOGLE_API_KEY` is valid and has quota.               |

---

> [!TIP]
> Use the **Swagger UI** for an interactive playground: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
