# RealVista AI Microservice

[![NestJS](https://img.shields.io/badge/framework-NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![LangChain](https://img.shields.io/badge/AI-LangChain-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

The **RealVista AI Microservice** is a core component of the RealVista ecosystem, designed to provide intelligent real estate consultation and advanced search capabilities powered by AI.

## 🚀 Tech Stack

- **Backend Framework**: [NestJS](https://nestjs.com/)
- **AI Orchestration**: [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/)
- **AI Models**: OpenAI (GPT-4o)
- **Monitoring**: [LangSmith](https://smith.langchain.com/)
- **Authentication**: JWT & Passport (Integrated with the main system for seamless user verification)
- **API Documentation**: Swagger UI

## 🏗️ Architecture

The service implements an **Agentic Workflow** using LangGraph to handle complex user requests:

1.  **State Management**: Manages conversation context via `LangGraphState`.
2.  **Tool Calling**: Integrates tools for property data retrieval, financial calculations, and tour booking.
3.  **Context Injection**: Automatically extracts user information from JWT to provide personalized AI recommendations.

## 🛠️ Installation & Getting Started

### Prerequisites

- Node.js (>= 18.x)
- npm or yarn

### Installation Steps

1.  Install dependencies:

    ```bash
    npm install
    ```

2.  Environment Configuration:
    Create a `.env` file in the root directory and configure the following keys:

    ```env
    OPENAI_API_KEY=your_openai_api_key
    LANGCHAIN_API_KEY=your_langchain_api_key
    LANGCHAIN_TRACING_V2=true
    LANGCHAIN_PROJECT=RealVista-AI
    JWT_SECRET=your_jwt_secret
    ```

3.  Run in Development Mode:

    ```bash
    npm run start:dev
    ```

4.  Build for Production:
    ```bash
    npm run build
    npm run start:prod
    ```

## 📚 API Documentation

Once the application is running, you can access the API documentation (Swagger) at:
`http://localhost:3000/api` (or your configured port).

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## 📄 License

This project is UNLICENSED.

---

_Developed by the RealVista Capstone Project team._
