# OS Service - Work Order Management

Microservice responsible for managing work orders, customers, and vehicles. This is the **entrypoint** of the garage management microservices architecture and hosts the centralized architecture documentation in `docs/`.

## Architecture

| Component | Technology |
|-----------|-----------|
| Framework | NestJS (TypeScript) |
| Database | PostgreSQL 15 (Relational) |
| Messaging | RabbitMQ 3.12 |
| Auth | JWT (global guard) |
| Containers | Docker (multi-stage) |
| Orchestration | Kubernetes |
| CI/CD | GitHub Actions |
| Quality | ESLint + SonarQube |

### Saga Pattern - Choreographed

All services implement the **Choreographed Saga Pattern** for distributed transaction management.

**Justification:**
1. **Lower coupling** - No centralized orchestrator as single point of failure.
2. **Independent scalability** - Each service scales without orchestrator bottleneck.
3. **Higher resilience** - Events queued in RabbitMQ survive temporary service downtime.
4. **Simplicity** - Event-driven approach aligns with RabbitMQ infrastructure.

**Flow:**
```
OS Service -> [work-order.created] -> Billing Service (generates quote)
Billing    -> [quote.approved]     -> OS Service (updates status)
Billing    -> [payment.approved]   -> Execution Service (starts execution)
Execution  -> [execution.completed]-> OS Service (marks completed)
```

**Compensation/Rollback:**
```
[payment.failed]       -> OS Service reverts work order status
[work-order.cancelled] -> Billing cancels quote/refund + Execution cancels
[execution.failed]     -> Billing processes refund via Mercado Pago
```

## Related Repositories

| Service | Repository | Database |
|---------|-----------|----------|
| **OS Service** (this) | `garage-os-service` | PostgreSQL |
| Billing Service | `garage-billing-service` | MongoDB |
| Execution Service | `garage-execution-service` | PostgreSQL |

## Features

- Work order CRUD with full status lifecycle
- Customer management (CRUD, document search)
- Vehicle management (CRUD, customer lookup)
- Event publishing via RabbitMQ
- Saga compensation listeners
- JWT authentication (global guard with `@Public()` decorator)
- Public work order status endpoint (no auth)

### Work Order Status Flow

`RECEIVED` -> `PENDING` -> `DIAGNOSIS` -> `AWAITING_QUOTE` -> `QUOTE_SENT` -> `APPROVED` -> `IN_PROGRESS` -> `WAITING_PARTS` -> `COMPLETED` -> `DELIVERED`

At any point: -> `CANCELLED` (triggers saga compensation)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd garage-os-service
npm install

# 2. Start infrastructure
docker compose up -d postgres rabbitmq

# 3. Configure environment
cp .env.example .env

# 4. Run in development
npm run start:dev
```

### Docker Compose (full stack)

```bash
docker compose up -d
```

This starts PostgreSQL, RabbitMQ, and the service.

## API

### Swagger

Interactive documentation: `http://localhost:3001/api`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /work-orders | Create work order |
| GET | /work-orders | List (filter by status/customer/vehicle) |
| GET | /work-orders/:id | Get by ID |
| PATCH | /work-orders/:id | Update |
| POST | /work-orders/:id/approve | Approve |
| DELETE | /work-orders/:id | Cancel (saga compensation) |
| GET | /work-orders/:id/history | History |
| GET | /public/work-orders/:id/status | Public status (no auth) |
| POST | /customers | Create customer |
| GET | /customers | List customers |
| GET | /customers/:id | Get customer |
| GET | /customers/document/:doc | Find by document |
| PATCH | /customers/:id | Update customer |
| DELETE | /customers/:id | Delete customer |
| POST | /vehicles | Create vehicle |
| GET | /vehicles | List vehicles |
| GET | /vehicles/:id | Get vehicle |
| GET | /vehicles/customer/:id | Vehicles by customer |
| PATCH | /vehicles/:id | Update vehicle |
| DELETE | /vehicles/:id | Delete vehicle |
| GET | /health | Health check (no auth) |

### Postman

Collection: `postman_collection.json`

## Testing

```bash
npm run test          # unit tests
npm run test:cov      # coverage report
npm run test:e2e      # BDD/E2E tests
```

### Coverage

Minimum threshold: **80%** (enforced in `jest.config.js` and CI pipeline).

```
All files            |   97.28% Stmts |   83.33% Branch |   94.23% Funcs |   97.57% Lines
Test Suites: 9 passed | Tests: 63 passed
```

### BDD Tests

```bash
npx jest --config test/jest-e2e.json test/bdd/
# 23 passing (complete work order flow + saga compensation)
```

## CI/CD Pipeline

`.github/workflows/ci-cd.yaml` executes:

1. `npm ci` - Install
2. `npm run lint` - ESLint
3. `npm run test:cov` - Tests + coverage
4. Coverage check (>= 80%)
5. SonarQube scan
6. Docker build + push to ECR (main only)
7. Kubernetes deployment (main only)

### Branch Protection

- `main` branch protected
- PR required with CI checks passing

## Deployment

```bash
# Docker
docker build -t garage-os-service .
docker run -p 3001:3001 --env-file .env garage-os-service

# Kubernetes
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/os-service
```

## Architecture Documentation

This repository hosts centralized documentation in `docs/`:

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture and design decisions
- [API.md](docs/API.md) - Complete API reference for all services
- [DEPLOYMENT.md](docs/DEPLOYMENT.md) - Deployment guide
- [DIAGRAMS.md](docs/DIAGRAMS.md) - Mermaid diagrams (17 visual diagrams)

## Environment Variables

See `.env.example` for all required variables.

## License

MIT
