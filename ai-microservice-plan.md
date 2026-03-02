# AI Microservice Boilerplate Plan

## Goal

Create a dedicated AI microservice using NestJS, TypeScript, LangChain, LangGraph, and LangSmith. This service will function as an intelligent real estate agent supporting RAG, tool-calling, and structured multi-step reasoning. It will expose REST and SSE streaming endpoints, with authentication centralized in the core backend.

**MVP Focus:** RAG + Tool-calling + Structured Reasoning for Real Estate Intelligence.
The architecture must be extensible for future workflow automation.

### Supported Features:

**1. RAG-based AI Assistant:**

- Answer property-related questions.
- Explain AI valuation results.
- Provide market insights.
- Support natural language property search.

**2. Tool-calling Agent:**

- Query the internal property database (via backend APIs).
- Trigger the price prediction model.
- Retrieve comparable properties.
- Call the recommendation engine.

**Example Multi-step Workflow:**
_“Find properties under 3B VND in Da Nang, compare them, estimate ROI, and explain risk.”_

## Tasks

- [ ] **Task 1: Project Setup** - Initialize a new NestJS application named `ai-service` using `npm` → Verify: `npm run start` correctly launches the API.
- [ ] **Task 2: AI Dependencies** - Install required packages (`@langchain/core`, `@langchain/openai`, `@langchain/langgraph`, LangSmith, etc.) → Verify: Dependencies are saved in `package.json`.
- [ ] **Task 3: Configuration** - Configure Environment Variables (OpenAI API Key, LangSmith tracing, JWT Secret, Backend API URLs).
- [ ] **Task 4: Security** - Implement modular JWT Authentication Guard to verify tokens and extract user context/roles for the LangGraph state.
- [ ] **Task 5: Tool Implementation** - Define LangChain tools for internal DB queries, price predictions, comp retrieval, and recommendations based on backend APIs.
- [ ] **Task 6: RAG Setup** - Setup the retrieval chain for market insights and property explanations.
- [ ] **Task 7: Workflow Design** - Design the LangGraph state and workflow (Nodes, Edges, Memory) to handle the multi-step real estate intelligence reasoning.
- [ ] **Task 8: REST API** - Develop a POST endpoint for synchronous, structured AI query responses.
- [ ] **Task 9: SSE Streaming** - Develop a GET/POST endpoint for Server-Sent Events to stream token-by-token generation.

## Done When

- [ ] The `ai-service` codebase is scaffolded and runs locally.
- [ ] The JWT authentication correctly injects user context.
- [ ] The LangGraph workflow successfully orchestrates RAG and diverse Tool calls based on complex prompts.
- [ ] Streaming (SSE) and synchronous responses are both functioning.
