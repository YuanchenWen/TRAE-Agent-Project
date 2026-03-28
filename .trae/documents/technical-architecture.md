# Gmail 邮件代理技术架构文档

## 1. 项目概述与目标

### 1.1 项目简介

Gmail 邮件代理是一个智能邮件处理系统，通过 AI 技术自动帮助用户处理 Gmail 邮件，实现邮件内容总结、AI 生成回复草稿以及自动发送回复功能。该项目采用 React + Express 全栈架构设计，强调模块化、可扩展性和清晰的代码组织结构。

### 1.2 核心目标

本项目的核心目标是构建一个生产级别的邮件处理系统，具备以下关键能力：

**智能化邮件处理**：系统能够自动读取用户 Gmail 收件箱中的邮件，利用 AI 技术对邮件内容进行智能分析，提取关键信息并生成简洁准确的摘要。同时，系统能够根据邮件内容和上下文语境生成符合用户风格的回复建议，帮助用户快速响应重要邮件。

**模块化集成架构**：设计通用的集成框架，使得 Gmail 只是第一个邮件服务集成。通过抽象化的接口定义，未来可以轻松扩展支持其他邮件服务提供商（如 Outlook、Yahoo Mail、企业邮箱等），每个新集成只需实现统一的接口规范，无需修改核心业务逻辑。

**安全可靠的认证体系**：采用行业标准的 OAuth 2.0 认证流程，确保用户 Gmail 数据的访问安全。所有敏感信息，包括 API 密钥、OAuth 凭证等，均通过环境变量管理，不硬编码在任何源代码文件中，保障用户数据安全。

**可维护的前后端分离**：前端采用 React 构建现代化的用户界面，后端使用 Express.js 提供稳定的 API 服务。清晰的职责分离使得团队可以并行开发，同时便于后续的功能迭代和技术升级。

### 1.3 目标用户

本系统主要面向需要高效处理大量邮件的个人用户和小型企业团队。对于经常处理商务邮件、客户服务邮件或需要快速响应大量邮件的用户，该系统能够显著提升邮件处理效率，减少手动回复的时间成本。

## 2. 架构设计原则

### 2.1 核心设计原则

**关注点分离原则（Separation of Concerns）**：系统严格遵循分层架构，将表示层（前端）、业务逻辑层（Services）、数据访问层（Integrations）以及基础设施层（Middleware、Utils）清晰分离。每一层只负责其专属的职责，通过定义良好的接口进行通信，降低模块间的耦合度，提高系统的可维护性和可测试性。

**依赖倒置原则（Dependency Inversion）**：高层的业务逻辑不直接依赖低层的具体实现，而是依赖于抽象接口。例如，邮件服务不直接依赖 Gmail API，而是依赖一个抽象的邮件服务接口。这种设计使得替换底层实现（如更换邮件服务提供商）变得简单，无需修改业务逻辑代码。

**开放封闭原则（Open/Closed Principle）**：系统对扩展开放，对修改封闭。当需要添加新的邮件服务集成时，只需实现已有的接口规范，无需修改现有代码。AI 服务层同样采用插件化设计，未来可以接入其他 AI 提供商，只需实现统一的服务接口。

**单一职责原则（Single Responsibility Principle）**：每个模块、每个函数都只负责一件事。在目录结构设计中，每个文件夹对应一个明确的职责领域，每个文件专注于实现一个具体的功能点。这种设计使得代码更易于理解、测试和复用。

### 2.2 架构风格选择

本项目采用**分层架构（Layered Architecture）**结合**微服务化的模块设计**。整体架构分为前端层、后端接入层、业务逻辑层、数据集成层和外部服务层。分层架构提供了清晰的职责边界，而模块化的设计使得各功能模块可以独立开发、测试和部署。

对于 v1 版本，系统保持相对简单的单体结构，所有功能模块在同一代码库中，通过清晰的目录结构进行组织。当系统规模扩大或需要更强的隔离性时，可以将特定模块拆分为独立的微服务，无需大幅重构。

## 3. 后端架构（Express.js）

### 3.1 目录结构设计

后端采用清晰的模块化目录结构，所有代码组织在 `server` 目录下：

```
server/
├── src/
│   ├── config/                 # 配置文件目录
│   │   ├── index.ts           # 主配置文件，加载环境变量
│   │   ├── database.ts        # 数据库配置（当前使用内存存储，保留扩展性）
│   │   └── integrations.ts    # 集成服务配置
│   │
│   ├── routes/                # 路由层，处理 HTTP 请求路由
│   │   ├── index.ts           # 路由聚合导出
│   │   ├── auth.routes.ts     # 认证相关路由
│   │   ├── email.routes.ts    # 邮件操作路由
│   │   └── ai.routes.ts       # AI 服务路由
│   │
│   ├── services/             # 业务逻辑层
│   │   ├── index.ts          # 服务导出
│   │   ├── email.service.ts   # 邮件业务逻辑
│   │   ├── auth.service.ts    # 认证业务逻辑
│   │   └── ai.service.ts      # AI 服务调用逻辑
│   │
│   ├── integrations/         # 集成层，第三方服务适配器
│   │   ├── index.ts          # 集成基类定义
│   │   ├── base.integration.ts  # 基础集成抽象类
│   │   ├── gmail.integration.ts # Gmail 服务实现
│   │   └── registry.ts        # 集成注册表，管理所有可用集成
│   │
│   ├── ai/                   # AI 服务层
│   │   ├── index.ts          # AI 服务导出
│   │   ├── base.ai.ts        # AI 服务基类
│   │   └── minimax.service.ts # MiniMax AI 服务实现
│   │
│   ├── middleware/          # 中间件层
│   │   ├── index.ts          # 中间件导出
│   │   ├── auth.middleware.ts    # 认证中间件
│   │   ├── error.middleware.ts    # 错误处理中间件
│   │   ├── logger.middleware.ts   # 日志中间件
│   │   └── validation.middleware.ts # 请求验证中间件
│   │
│   ├── utils/                # 工具函数
│   │   ├── index.ts          # 工具导出
│   │   ├── response.ts       # 统一响应格式
│   │   ├── logger.ts         # 日志工具
│   │   └── validators.ts     # 数据验证工具
│   │
│   ├── types/                # 类型定义
│   │   ├── index.ts          # 类型导出
│   │   ├── email.ts          # 邮件相关类型
│   │   ├── user.ts           # 用户相关类型
│   │   └── integration.ts     # 集成相关类型
│   │
│   ├── app.ts               # Express 应用实例
│   └── server.ts            # 服务器入口文件
│
├── package.json
└── tsconfig.json
```

这种目录结构的优势在于：当团队成员需要定位特定功能时，可以根据文件路径快速找到相关代码。例如，添加新的邮件服务商，只需在 `integrations` 目录下创建新的实现文件；修改邮件相关业务逻辑，集中在 `services/email.service.ts` 中处理。

### 3.2 路由层设计

路由层是后端架构的接入点，负责接收 HTTP 请求并分发到相应的服务处理。

**认证路由（auth.routes.ts）**：处理用户认证相关的请求，包括 OAuth 认证流程的发起、回调处理、令牌刷新以及用户登录状态查询等端点。所有认证相关的路由前缀统一为 `/api/auth`。

```typescript
// 路由前缀：/api/auth
POST   /oauth/init        # 初始化 OAuth 流程
GET    /oauth/callback    # OAuth 回调处理
POST   /oauth/refresh     # 刷新访问令牌
GET    /me               # 获取当前用户信息
DELETE /logout           # 用户登出
```

**邮件路由（email.routes.ts）**：处理所有邮件相关的操作请求，包括获取邮件列表、读取邮件详情、获取邮件摘要、生成回复草稿、发送回复等核心功能。路由前缀为 `/api/emails`。

```typescript
// 路由前缀：/api/emails
GET    /                 # 获取邮件列表（支持分页、过滤）
GET    /:id              # 获取指定邮件详情
POST   /:id/summarize    # 获取邮件摘要
POST   /:id/reply        # 生成回复草稿
POST   /:id/send         # 发送回复邮件
POST   /:id/auto-reply   # 自动回复配置
```

**AI 服务路由（ai.routes.ts）**：提供直接调用 AI 服务的端点，用于测试和调试 AI 服务配置，也可以支持前端直接调用 AI 能力。路由前缀为 `/api/ai`。

```typescript
// 路由前缀：/api/ai
POST   /summarize        # 文本摘要
POST   /generate-reply   # 生成回复内容
POST   /analyze          # 内容分析
GET    /models          # 获取可用模型列表
```

### 3.3 服务层设计

服务层是后端的核心，承载所有业务逻辑的实现。每个服务类都专注于特定的业务领域，通过依赖注入与下层模块交互。

**邮件服务（email.service.ts）**：邮件业务逻辑的核心处理类，提供邮件列表获取、邮件详情读取、邮件摘要生成、回复草稿生成等方法。邮件服务不直接调用 Gmail API，而是通过集成层获取邮件数据，实现与具体邮件服务的解耦。

邮件服务的核心方法包括：`getMailList()` 方法负责获取邮件列表，支持分页、过滤和排序；`getMailDetail()` 方法获取单封邮件的完整内容；`summarizeMail()` 方法调用 AI 服务生成邮件摘要；`generateReply()` 方法根据邮件内容生成回复建议；`sendReply()` 方法将用户确认的回复发送出去。

**认证服务（auth.service.ts）**：处理用户认证相关的业务逻辑，包括令牌管理、会话处理、用户信息维护等。认证服务维护用户的访问令牌和刷新令牌，在令牌过期前自动触发刷新流程，确保用户操作的连续性。

**AI 服务（ai.service.ts）**：封装 AI 服务调用的业务逻辑，提供统一的 AI 服务接口。AI 服务支持多种 AI 模型，可以根据配置选择使用哪个 AI 提供商。当前主要集成了 MiniMax API，未来可以扩展支持其他 AI 服务商。

### 3.4 集成层设计

集成层是本架构的关键设计之一，通过抽象化的接口定义，实现邮件服务的可替换性。

**基础集成接口（base.integration.ts）**：定义所有邮件服务集成必须实现的接口规范。这个接口定义了邮件服务集成的标准契约，确保任何邮件服务实现都能无缝接入系统。

```typescript
interface BaseIntegration {
  // 获取集成标识
  getId(): string;
  getName(): string;
  
  // 认证相关
  initializeAuth(): Promise<AuthUrl>;
  handleCallback(code: string): Promise<AuthTokens>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  
  // 邮件操作
  listEmails(query: EmailQuery): Promise<EmailListResponse>;
  getEmail(id: string): Promise<EmailDetail>;
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  
  // 健康检查
  testConnection(): Promise<boolean>;
}
```

**Gmail 集成实现（gmail.integration.ts）**：Gmail 服务集成的具体实现，封装了 Gmail API 的调用逻辑。实现类负责处理 Gmail 特有的认证流程、API 调用格式转换、错误处理等。

Gmail 集成的主要功能包括：OAuth 认证流程管理，包括授权码获取、令牌交换、令牌刷新；邮件列表获取，通过 Gmail API 的 messages.list 端点获取邮件元数据；邮件详情获取，通过 messages.get 端点获取邮件完整内容，包括正文、附件信息等；邮件发送，通过 messages.send 端点发送邮件。

**集成注册表（registry.ts）**：管理所有可用的邮件服务集成，提供根据标识获取集成实例的方法。注册表采用单例模式，确保每种集成只创建一个实例。

```typescript
class IntegrationRegistry {
  private static instance: IntegrationRegistry;
  private integrations: Map<string, BaseIntegration>;
  
  static getInstance(): IntegrationRegistry;
  register(integration: BaseIntegration): void;
  get(id: string): BaseIntegration | undefined;
  getAll(): BaseIntegration[];
}
```

### 3.5 AI 服务层设计

AI 服务层封装了 AI 能力调用逻辑，提供标准化的 AI 服务接口。

**AI 服务基类（base.ai.ts）**：定义 AI 服务的抽象接口，包括摘要生成、回复生成、内容分析等核心能力。

```typescript
interface AIProvider {
  // 服务配置
  getProviderName(): string;
  
  // 核心能力
  summarize(text: string, options?: SummarizeOptions): Promise<string>;
  generateReply(context: ReplyContext): Promise<ReplySuggestion>;
  analyzeSentiment(text: string): Promise<SentimentResult>;
  
  // 模型管理
  listModels(): Model[];
  setModel(modelId: string): void;
}
```

**MiniMax 服务实现（minimax.service.ts）**：MiniMax AI 服务的具体实现，封装了 MiniMax API 的调用逻辑。实现类处理 API 认证、请求构建、响应解析以及错误处理。

### 3.6 中间件设计

中间件层提供横切关注点的处理，包括认证、错误处理、日志记录和请求验证。

**认证中间件（auth.middleware.ts）**：验证请求中的认证令牌，确保用户身份的有效性。中间件从请求头中提取 Bearer Token，验证令牌有效性，并将用户信息附加到请求对象上。

**错误处理中间件（error.middleware.ts）**：统一处理所有未捕获的异常，将错误信息格式化为统一的 JSON 响应格式。中间件根据错误类型生成适当的 HTTP 状态码和错误消息。

**日志中间件（logger.middleware.ts）**：记录所有 HTTP 请求的详细信息，包括请求方法、路径、响应状态码、处理时间等。日志格式遵循结构化日志标准，便于后续的日志分析和监控。

**验证中间件（validation.middleware.ts）**：验证请求数据的有效性，使用 JSON Schema 或 Zod 等验证库进行数据校验。对于不符合规范的请求，返回 400 错误并指出具体的验证失败原因。

## 4. 前端架构（React）

### 4.1 目录结构设计

前端采用功能模块化的目录结构，所有代码组织在 `client` 目录下：

```
client/
├── src/
│   ├── components/           # 可复用 UI 组件
│   │   ├── common/          # 通用组件
│   │   │   ├── Button/
│   │   │   ├── Input/
│   │   │   ├── Modal/
│   │   │   └── Loading/
│   │   │
│   │   ├── email/           # 邮件相关组件
│   │   │   ├── EmailList/
│   │   │   ├── EmailItem/
│   │   │   ├── EmailDetail/
│   │   │   └── ReplyComposer/
│   │   │
│   │   └── layout/          # 布局组件
│   │       ├── Header/
│   │       ├── Sidebar/
│   │       └── Layout/
│   │
│   ├── pages/               # 页面组件
│   │   ├── Home/
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── EmailList/
│   │   └── Settings/
│   │
│   ├── services/            # API 服务层
│   │   ├── api.ts          # API 基础配置
│   │   ├── auth.service.ts # 认证服务
│   │   └── email.service.ts # 邮件服务
│   │
│   ├── hooks/               # 自定义 Hooks
│   │   ├── useAuth.ts
│   │   ├── useEmails.ts
│   │   └── useAI.ts
│   │
│   ├── store/               # 状态管理
│   │   ├── index.ts
│   │   ├── auth.store.ts
│   │   └── email.store.ts
│   │
│   ├── types/               # TypeScript 类型
│   │   ├── index.ts
│   │   ├── email.ts
│   │   └── api.ts
│   │
│   ├── utils/               # 工具函数
│   │   ├── format.ts
│   │   └── storage.ts
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 4.2 组件架构

前端采用原子设计（Atomic Design）结合功能模块的组织方式。组件分为三个层次：

**通用组件层（common）**：最底层的可复用 UI 组件，包括按钮、输入框、模态框、加载动画等基础元素。这些组件不包含任何业务逻辑，仅负责 UI 展示和用户交互。

**功能组件层（email、layout）**：针对特定功能领域的组件，如邮件列表组件、邮件详情组件、回复编辑组件等。这些组件组合通用组件实现完整的业务功能，但仍然保持相对独立，可以在不同页面中复用。

**页面组件层（pages）**：对应具体路由页面的顶级组件，协调各功能组件完成页面级别的功能展示。每个页面组件管理其子组件的数据流和状态。

### 4.3 状态管理

前端状态管理采用 Zustand 库，这是一个轻量级但功能强大的状态管理方案。相比 Redux，Zustand 提供了更简洁的 API，减少了样板代码，同时支持中间件扩展。

**认证状态（auth.store.ts）**：管理用户认证相关状态，包括用户登录状态、访问令牌、用户信息等。认证状态在应用启动时从存储中恢复，在用户登出时清除。

**邮件状态（email.store.ts）**：管理邮件相关状态，包括当前选中的邮件、邮件列表、摘要内容、回复草稿等。邮件状态根据用户操作实时更新，并同步与服务端数据。

### 4.4 API 集成

前端通过封装好的服务层与后端 API 交互。服务层统一处理 HTTP 请求、错误处理和数据转换。

**基础 API 配置（api.ts）**：配置 axios 实例，设置基础 URL、超时时间、请求拦截器和响应拦截器。请求拦截器自动在请求头中添加认证令牌，响应拦截器统一处理错误和响应格式。

**认证服务（auth.service.ts）**：封装认证相关的 API 调用，包括登录、登出、OAuth 认证初始化和回调处理。服务方法返回标准化的数据结构，便于调用方处理。

**邮件服务（email.service.ts）**：封装邮件相关的 API 调用，包括获取邮件列表、获取邮件详情、生成摘要、生成回复、发送邮件等。服务方法接收必要的参数，发送请求并返回处理结果。

## 5. API 设计

### 5.1 认证接口

**初始化 OAuth 流程**

```
POST /api/auth/oauth/init
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| provider | string | 是 | 邮件服务提供商标识（当前支持 "gmail"）|

响应：

```json
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
    "state": "random_state_string"
  }
}
```

**处理 OAuth 回调**

```
GET /api/auth/oauth/callback
```

查询参数：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| code | string | 是 | OAuth 授权码 |
| state | string | 是 | 状态参数，用于 CSRF 防护 |
| provider | string | 是 | 邮件服务提供商标识 |

响应：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "user@example.com",
      "name": "用户名",
      "avatar": "https://..."
    },
    "token": "access_token_string"
  }
}
```

### 5.2 邮件操作接口

**获取邮件列表**

```
GET /api/emails
```

查询参数：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认 1 |
| limit | number | 否 | 每页数量，默认 20 |
| unread | boolean | 否 | 仅显示未读邮件 |
| starred | boolean | 否 | 仅显示星标邮件 |

响应：

```json
{
  "success": true,
  "data": {
    "emails": [
      {
        "id": "msg_123",
        "threadId": "thread_456",
        "from": {
          "name": "发件人姓名",
          "email": "sender@example.com"
        },
        "subject": "邮件主题",
        "snippet": "邮件内容摘要...",
        "date": "2024-01-15T10:30:00Z",
        "isRead": true,
        "isStarred": false,
        "labels": ["INBOX", "IMPORTANT"]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "hasMore": true
    }
  }
}
```

**获取邮件详情**

```
GET /api/emails/:id
```

响应：

```json
{
  "success": true,
  "data": {
    "id": "msg_123",
    "threadId": "thread_456",
    "from": {
      "name": "发件人姓名",
      "email": "sender@example.com"
    },
    "to": [
      {
        "name": "收件人姓名",
        "email": "recipient@example.com"
      }
    ],
    "subject": "邮件主题",
    "date": "2024-01-15T10:30:00Z",
    "body": {
      "plain": "邮件纯文本内容...",
      "html": "<html>...</html>"
    },
    "attachments": [
      {
        "id": "att_1",
        "filename": "document.pdf",
        "mimeType": "application/pdf",
        "size": 102400
      }
    ],
    "labels": ["INBOX", "IMPORTANT"]
  }
}
```

**生成邮件摘要**

```
POST /api/emails/:id/summarize
```

响应：

```json
{
  "success": true,
  "data": {
    "originalLength": 1500,
    "summaryLength": 150,
    "summary": "该邮件主要询问关于产品报价的问题。客户希望了解贵公司产品的价格区间，并希望在下周前得到回复以便做采购决策。邮件中提到了具体的采购数量和期望的交货时间。",
    "keyPoints": [
      "客户需要产品报价信息",
      "采购数量较大（1000件以上）",
      "期望在下周得到回复"
    ],
    "generatedAt": "2024-01-15T10:35:00Z"
  }
}
```

**生成回复草稿**

```
POST /api/emails/:id/reply
```

请求体：

```json
{
  "tone": "professional",
  "length": "medium",
  "includeContext": true
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| tone | string | 否 | 回复语气，可选 "professional"、"friendly"、"formal"、"casual"，默认 "professional" |
| length | string | 否 | 回复长度，可选 "short"、"medium"、"long"，默认 "medium" |
| includeContext | boolean | 否 | 是否包含对原邮件内容的引用，默认 true |

响应：

```json
{
  "success": true,
  "data": {
    "originalEmail": {
      "id": "msg_123",
      "subject": "关于产品报价的咨询"
    },
    "replyDraft": {
      "to": "sender@example.com",
      "subject": "Re: 关于产品报价的咨询",
      "body": "您好，\n\n感谢您的来信。已收到您关于产品报价的咨询。根据您提到的采购数量（1000件以上），我们的销售团队会为您提供专属报价。\n\n我们会在本周内回复您的具体报价方案。如有紧急需求，请直接联系我们的客服热线。\n\n祝好",
      "suggestedTone": "professional"
    },
    "alternatives": [
      {
        "tone": "friendly",
        "body": "嗨，感谢您的邮件！我..."
      }
    ],
    "generatedAt": "2024-01-15T10:36:00Z"
  }
}
```

**发送回复邮件**

```
POST /api/emails/:id/send
```

请求体：

```json
{
  "to": "sender@example.com",
  "subject": "Re: 关于产品报价的咨询",
  "body": "邮件正文内容...",
  "cc": ["cc1@example.com"],
  "bcc": []
}
```

响应：

```json
{
  "success": true,
  "data": {
    "sentMessageId": "sent_msg_789",
    "sentAt": "2024-01-15T10:38:00Z"
  }
}
```

### 5.3 AI 服务接口

**文本摘要**

```
POST /api/ai/summarize
```

请求体：

```json
{
  "text": "需要摘要的文本内容...",
  "maxLength": 150,
  "format": "paragraph"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| text | string | 是 | 要摘要的文本内容 |
| maxLength | number | 否 | 摘要最大长度，默认 150 |
| format | string | 否 | 输出格式，可选 "paragraph"、"bullet"，默认 "paragraph" |

响应：

```json
{
  "success": true,
  "data": {
    "summary": "摘要内容...",
    "originalLength": 1000,
    "summaryLength": 145,
    "model": "abab6.5s-chat"
  }
}
```

## 6. 集成模式

### 6.1 添加新集成的流程

本架构设计了标准化的集成开发流程，使得添加新的邮件服务提供商变得简单直接。假设需要添加 Outlook 集成，只需按照以下步骤操作：

**第一步：创建集成实现文件**

在 `server/src/integrations` 目录下创建 `outlook.integration.ts` 文件，实现 `BaseIntegration` 接口中定义的所有方法。每个方法都需要根据 Outlook API 的具体规范进行实现，包括认证流程、API 调用格式、错误处理等。

**第二步：实现必需的方法**

每个集成必须实现以下核心方法：`getId()` 返回集成的唯一标识符，如 "outlook"；`getName()` 返回集成的显示名称，如 "Microsoft Outlook"；`initializeAuth()` 生成 OAuth 授权 URL 并返回；`handleCallback()` 处理 OAuth 回调，交换授权码获取令牌；`listEmails()` 获取邮件列表；`getEmail()` 获取邮件详情；`sendEmail()` 发送邮件；`testConnection()` 测试连接是否正常。

**第三步：注册集成**

在 `registry.ts` 文件中导入新创建的集成类，并在注册表中注册。注册过程只需要一行代码：`registry.register(new OutlookIntegration())`。注册后，系统即可识别和使用该集成。

**第四步：更新配置**

在环境变量中配置新集成的相关参数，包括客户端 ID、客户端密钥等。在前端界面中添加新集成的选择选项。

### 6.2 基础集成接口定义

```typescript
// server/src/integrations/base.integration.ts

import { Email, EmailListResponse, EmailQuery, AuthUrl, AuthTokens } from '../types';

export interface EmailQuery {
  page?: number;
  limit?: number;
  unread?: boolean;
  starred?: boolean;
  after?: Date;
  before?: Date;
  search?: string;
}

export interface AuthUrl {
  url: string;
  state: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export abstract class BaseIntegration {
  abstract getId(): string;
  abstract getName(): string;
  
  abstract initializeAuth(): Promise<AuthUrl>;
  abstract handleCallback(code: string): Promise<AuthTokens>;
  abstract refreshToken(refreshToken: string): Promise<AuthTokens>;
  
  abstract listEmails(tokens: AuthTokens, query: EmailQuery): Promise<EmailListResponse>;
  abstract getEmail(tokens: AuthTokens, id: string): Promise<Email>;
  abstract sendEmail(tokens: AuthTokens, to: string, subject: string, body: string): Promise<void>;
  
  abstract testConnection(): Promise<boolean>;
}
```

这个接口定义确保了所有邮件服务集成都遵循统一的契约，使得业务逻辑层可以透明地使用任何已注册的集成，无需关心具体的邮件服务实现细节。

### 6.3 未来扩展方向

基于当前的集成架构，可以轻松扩展支持以下类型的集成：

**邮件服务扩展**：除了 Gmail 和 Outlook，还可以添加对 Yahoo Mail、企业邮箱（如阿里云邮箱、腾讯企业邮）、IMAP/SMTP 通用协议等的支持。每个新增服务只需实现统一的接口规范。

**AI 服务扩展**：当前集成了 MiniMax，未来可以扩展支持 OpenAI、Google AI、Anthropic Claude 等 AI 服务商。通过抽象的 AI 服务基类，可以实现 AI 服务商的无缝切换。

**通知服务扩展**：可以添加对通知服务的集成，如钉钉、企业微信、Slack 等，在特定邮件到达时发送通知提醒。

## 7. 安全考虑

### 7.1 OAuth 认证处理

Gmail API 使用 OAuth 2.0 进行用户授权，本系统严格遵循 OAuth 最佳实践确保认证安全。所有 OAuth 流程都使用 HTTPS 加密传输，授权码只能使用一次，且设置了较短的有效期（通常为几分钟）。

状态参数（state）用于防止 CSRF 攻击，在发起授权请求时生成随机字符串并存储在会话中，收到回调时验证状态参数的一致性。访问令牌和刷新令牌安全存储在后端，不在日志中记录敏感信息。

令牌刷新采用后台自动刷新机制，在访问令牌即将过期前自动使用刷新令牌获取新令牌，确保用户操作的连续性。刷新令牌本身也设置了有效期，过期后需要用户重新授权。

### 7.2 API 密钥管理

所有第三方服务的 API 密钥和客户端密钥统一通过环境变量管理，不硬编码在任何源代码中。环境变量在应用启动时加载到内存，使用专门的配置模块提供访问接口。

对于 MiniMax API 密钥，系统使用服务端代理模式，前端不直接持有 API 密钥，所有 AI 请求都通过后端转发。这种设计防止 API 密钥泄露，同时便于后续的密钥轮换和管理。

敏感配置采用分层管理：开发环境、测试环境和生产环境使用不同的配置集合，通过 NODE_ENV 环境变量自动切换。

### 7.3 环境变量配置

项目使用 `.env` 文件管理所有环境变量，示例配置如下：

```env
# 服务器配置
NODE_ENV=development
PORT=3000

# 前端配置
VITE_API_BASE_URL=http://localhost:3000

# Gmail OAuth 配置
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/oauth/callback

# MiniMax AI 配置
MINIMAX_API_KEY=your_minimax_api_key
MINIMAX_API_BASE_URL=https://api.minimax.chat

# 安全配置
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
```

`.env` 文件本身不提交到版本控制系统，而是提供 `.env.example` 文件作为模板，包含所有必需的配置项说明但不包含实际值。团队成员复制 `.env.example` 为 `.env` 并填充实际值。

### 7.4 请求安全

所有 API 请求都实现了以下安全措施：

**输入验证**：所有请求参数都经过严格验证，使用 Zod 或 Joi 等验证库确保数据类型和格式正确。验证失败的请求直接返回 400 错误，不会执行后续逻辑。

**速率限制**：关键接口实现速率限制，防止滥用和暴力攻击。限制策略包括按用户限制和按 IP 限制两个维度。

**CORS 配置**：正确配置跨域资源共享策略，只允许受信任的前端域名访问 API。

**Helmet 中间件**：使用 Helmet 中间件设置安全的 HTTP 头，包括 XSS 防护、内容安全策略、帧选项等。

### 7.5 数据安全

**传输加密**：生产环境中所有通信强制使用 HTTPS，HTTP 请求自动重定向到 HTTPS。

**敏感数据保护**：用户令牌、API 密钥等敏感信息在日志中自动脱敏处理，只显示部分字符。

**会话管理**：用户会话设置合理的过期时间，长时间不活跃的会话自动失效。用户登出时彻底清除会话数据。

## 8. 技术选型说明

### 8.1 后端技术栈

**Express.js**：选择 Express 作为后端框架，主要考虑其简洁的 API 设计、丰富的中间件生态和成熟的社区支持。对于 v1 版本的功能需求，Express 提供了足够的能力且学习曲线平缓。

**TypeScript**：全栈使用 TypeScript 进行开发，利用其强大的类型系统提高代码质量和开发效率。类型定义贯穿前后端，确保 API 契约的一致性。

**Zod**：用于运行时数据验证，提供编译时和运行时双重安全保障。

### 8.2 前端技术栈

**React 18**：选择 React 作为前端框架，其组件化开发模式和丰富的生态系统非常适合本项目的需求。

**Vite**：作为构建工具，提供极快的开发服务器启动和热更新体验。

**Zustand**：状态管理选择 Zustand，相比 Redux 更加轻量简洁，API 设计直观，适合中小型应用。

**TailwindCSS**：使用 TailwindCSS 进行样式开发，提高开发效率并保证设计一致性。

### 8.3 AI 服务

**MiniMax**：作为首个集成的 AI 服务提供商，MiniMax 提供了高质量的文本生成能力，其 API 定价相对合理，适合创业项目和小团队使用。

## 9. 部署架构

### 9.1 整体架构

```
                    ┌─────────────────┐
                    │   User Browser  │
                    └────────┬────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                     Load Balancer                            │
└─────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                              ▼
    ┌─────────────────┐            ┌─────────────────┐
    │   React App     │            │   Express API   │
    │   (Static)      │            │   (Node.js)     │
    └─────────────────┘            └────────┬────────┘
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                 ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
                 │  Gmail API   │   │  MiniMax AI  │   │    Redis     │
                 └──────────────┘   └──────────────┘   └──────────────┘
```

### 9.2 环境配置建议

**开发环境**：前后端分别启动，前端 Vite 开发服务器运行在 5173 端口，后端 Express 服务器运行在 3000 端口。前端通过代理配置将 API 请求转发到后端。

**生产环境**：前端构建为静态文件，由 Nginx 或 CDN 提供服务。后端 Express 应用部署在 Node.js 运行时环境中。建议使用 PM2 或 Docker 进行进程管理和容器化部署。

## 10. 总结

本技术架构文档详细阐述了 Gmail 邮件代理项目的整体设计方案，涵盖了后端架构、前端架构、API 设计、集成模式和安全保障等关键方面。架构设计遵循模块化、可扩展的原则，通过清晰的层次划分和标准化的接口定义，确保系统具备良好的可维护性和可扩展性。

Gmail 集成作为本架构的第一个具体实现，展示了如何通过统一的集成接口接入不同的外部服务。AI 服务层的设计使得可以灵活切换和扩展 AI 能力，满足未来业务发展的需求。

本架构为项目开发提供了清晰的指导，开发团队可以基于此架构快速启动开发工作，同时为未来的功能扩展和技术升级预留了充分的空间。
