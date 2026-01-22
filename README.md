# Online Judge (OJ)

A production-ready online judge backend built with **NestJS**, **TypeScript**, and **Prisma**. Securely executes user-submitted code in isolated sandboxes, validates against test cases, and persists results—designed for competitive programming platforms and coding assessment systems.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture & Components](#architecture--components)
- [Submission & Execution Flow](#submission--execution-flow)
- [Getting Started](#getting-started)
- [API Usage](#api-usage)
- [Configuration](#configuration)
- [Development & Testing](#development--testing)
- [Roadmap & Future Work](#roadmap--future-work)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## Overview

**OJ** is an end-to-end online judge system that:

- **Authenticates users** via JWT (local + Google OAuth)
- **Ingests code submissions** through REST APIs
- **Queues submissions** asynchronously using Kafka
- **Executes in sandboxes** using the `isolate` tool, with resource limits (CPU, memory, disk, timeout)
- **Manages execution pools** via Redis for efficient resource reuse
- **Validates results** against problem test cases stored in S3
- **Persists data** to PostgreSQL with comprehensive result tracking
---

## Key Features

### Authentication & Authorization
- **JWT-based authentication** with access/refresh token rotation
- **Google OAuth 2.0 integration** for seamless sign-up/sign-in
- **Role-based access control** for endpoints (admin, user, etc.)
- **Password reset flow** via email with secure tokens

### Code Execution & Sandboxing
- **Multi-language support** (C++, Python) via pluggable language configs
- **Isolated execution** using `isolate` with per-test resource limits:
  - CPU time, memory, disk space, process count
  - Real-time sandboxing prevents filesystem/network escapes
- **Compilation & runtime separation** for compiled languages

### Asynchronous Job Processing
- **Kafka-based submission queueing** for reliable, distributed processing
- **Dedicated judge workers** consume submissions and perform execution

### Resource Management
- **Redis-backed sandbox pool** — acquire/release/reset sandboxes efficiently
- **Distributed locking** to prevent race conditions in box allocation

### Data Persistence
- **PostgreSQL with Prisma ORM** for relational data (users, problems, submissions, results)
- **S3 integration** for storing and retrieving test cases

### Testing & Observability
- **Jest unit** for core services (under develope)
- **Winston logging** for debugging and monitoring
- **Structured execution logs** capturing compile/run diagnostics
- **CI/CD workflows** (GitHub Actions) for automated testing and deployment (CI for now and CD under developement)


### Technology Stack
- **NestJS**: Framework for building the server-side application.
- **TypeScript**: Language for writing type-safe JavaScript code.
- **Prisma**: ORM for database access and migrations.
- **PostgreSQL**: Relational database for storing structured data.
- **Redis**: In-memory data store for caching and sandbox management.
- **Kafka**: Distributed event streaming platform for handling submission queues.
- **Docker**: Containerization platform for consistent development and deployment environments.

---

## Submission & Execution Flow

1. **Client submits code**: Source code and metadata are sent to the API Gateway.
2. **API Gateway**: Forwards the request to the Submission Service after authentication.
3. **Submission Service**:
   - Validates and stores the submission.
   - Publishes a message to the Kafka submission queue.
4. **Judge Worker** (consuming from Kafka):
   - Retrieves the submission message.
   - Fetches associated problem data and test cases.
   - Calls the Execution Service to run the code.
5. **Execution Service**:
   - Allocates a sandbox using the Redis-backed pool.
   - Executes the code with resource limits using `isolate`.
   - Collects and returns the execution results.
6. **Judge Worker**:
   - Validates the results against the expected output.
   - Persists the results and updates the submission status.
   - Sends a notification (optional) about the verdict.

---

## Getting Started

### Prerequisites
- Node.js (>=14.x)
- PostgreSQL (running instance)
- Redis (running instance)
- Kafka & Zookeeper (running instance)
- Docker (for optional containerized setup)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/oj.git
   cd oj
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure environment variables:
   - Copy `.env.example` to `.env` and update values (DB connection, JWT secret, etc.).
4. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
5. Start the application:
   ```bash
   npm run start:dev
   ```

### Docker Setup (Optional)
- To run the entire stack using Docker Compose (PostgreSQL, Kafka, Zookeeper, Redis):
  ```bash
  docker-compose up -d
  ```

---

## API Usage

### Authentication
- **Login**: `POST /auth/login` - Authenticate user and return tokens.
- **Google OAuth**: `GET /auth/google` - Redirect to Google for authentication.

### User Management
- **Get Profile**: `GET /users/me` - Retrieve the authenticated user's profile.
- **Update Profile**: `PATCH /users/me` - Update the authenticated user's profile.

### Submission Management
- **Submit Code**: `POST /submissions` - Submit source code for judging.
- **Get Submission**: `GET /submissions/{id}` - Retrieve submission details and results.

### Execution & Judging
- **Execute Code**: `POST /execute` - (Internal) Directly execute code without submission.
- **Judge Submission**: `POST /judge` - (Internal) Manually trigger judging for a submission.

---

## Configuration

- Environment variables are used for configuration (see `.env.example`).
- Key settings include:
  - `DATABASE_URL`: Connection string for PostgreSQL.
  - `REDIS_URL`: Connection string for Redis.
  - `KAFKA_BROKER`: Kafka broker address.
  - `JWT_SECRET`: Secret key for signing JWTs.
  - `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`: Credentials for Google OAuth.

---

## Development & Testing

### Development Tools
- **NestJS CLI**: For generating modules, controllers, and services.
- **Prisma Studio**: GUI for interacting with the database.
- **Docker**: For containerized development (optional).

### Testing
- Unit and integration tests are written using Jest.
- To run tests:
  ```bash
  npm run test
  ```

---

## Roadmap & Future Work

- **Short-term**:
  - Improve documentation and setup guides.
  - Enhance error handling and validation.
  - Optimize performance of the execution sandbox.

- **Long-term**:
  - Support for more programming languages and configurations.
  - Advanced features like plagiarism detection, code linting, and auto-formatting.
  - Integration with front-end applications and third-party services.

---

## Security Considerations

- Sensitive data (passwords, tokens) are hashed or encrypted.
- Environment variables are used to store secrets and configuration.
- Regular security audits and dependency updates are performed.

---

## License

- This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Inspired by various online judge systems and competitive programming platforms.
- Built with passion by the developer community.

---

## Contact

- For questions or support, please open an issue on GitHub or contact the maintainers.

---

**End of Documentation**