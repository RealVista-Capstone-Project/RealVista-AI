# RealVista AI Microservice

[![NestJS](https://img.shields.io/badge/framework-NestJS-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![LangChain](https://img.shields.io/badge/AI-LangChain-1C3C3C?logo=langchain&logoColor=white)](https://js.langchain.com/)
[![TypeScript](https://img.shields.io/badge/language-TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Dịch vụ AI Microservice thuộc hệ sinh thái **RealVista**, được xây dựng để cung cấp khả năng tư vấn và hỗ trợ tìm kiếm bất động sản thông qua trí tuệ nhân tạo.

## 🚀 Công nghệ sử dụng

- **Backend Framework**: [NestJS](https://nestjs.com/)
- **AI Orchestration**: [LangChain](https://js.langchain.com/) & [LangGraph](https://langchain-ai.github.io/langgraphjs/)
- **AI Models**: OpenAI (GPT-4o)
- **Monitoring**: [LangSmith](https://smith.langchain.com/)
- **Authentication**: JWT & Passport (Hỗ trợ xác thực người dùng từ hệ thống chính)
- **API Documentation**: Swagger UI

## 🏗️ Kiến trúc hệ thống

Dịch vụ sử dụng mô hình **Agentic Workflow** với LangGraph để xử lý các yêu cầu phức tạp của người dùng:

1.  **State Management**: Quản lý ngữ cảnh hội thoại thông qua `LangGraphState`.
2.  **Tool Calling**: Tích hợp các công cụ tìm kiếm dữ liệu bất động sản, tính toán tài chính và đặt lịch xem nhà.
3.  **Context Injection**: Tự động trích xuất thông tin người dùng từ JWT để cá nhân hóa kết quả tư vấn.

## 🛠️ Cài đặt & Chạy ứng dụng

### Tiền đề

- Node.js (>= 18.x)
- npm hoặc yarn

### Các bước cài đặt

1.  Cài đặt dependencies:

    ```bash
    npm install
    ```

2.  Cấu hình biến môi trường:
    Tạo file `.env` tại thư mục gốc và cấu hình các keys sau:

    ```env
    OPENAI_API_KEY=your_openai_api_key
    LANGCHAIN_API_KEY=your_langchain_api_key
    LANGCHAIN_TRACING_V2=true
    LANGCHAIN_PROJECT=RealVista-AI
    JWT_SECRET=your_jwt_secret
    ```

3.  Chạy ứng dụng ở chế độ phát triển:

    ```bash
    npm run start:dev
    ```

4.  Build cho Production:
    ```bash
    npm run build
    npm run start:prod
    ```

## 📚 API Documentation

Sau khi chạy ứng dụng, bạn có thể truy cập tài liệu API (Swagger) tại:
`http://localhost:3000/api` (hoặc cổng cấu hình của bạn).

## 🧪 Kiểm thử

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

## 📄 License

Dự án này được cấp phép theo giấy phép UNLICENSED.

---

_Phát triển bởi đội ngũ RealVista Capstone Project._
