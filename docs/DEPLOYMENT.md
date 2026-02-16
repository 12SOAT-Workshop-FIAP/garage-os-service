# Deployment Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 20+ | Runtime |
| Docker | 24+ | Containerization |
| Docker Compose | v2+ | Local orchestration |
| kubectl | 1.28+ | Kubernetes CLI |
| AWS CLI | v2 | Cloud access |
| Git | 2.40+ | Version control |

## Repository Structure

Each service is an independent Git repository:

```
garage-os-service/          → Port 3001, PostgreSQL, RabbitMQ (dedicated instance)
garage-billing-service/     → Port 3002, MongoDB
garage-execution-service/   → Port 3003, PostgreSQL (port 5433)
```

> Each service runs a dedicated RabbitMQ instance. See [MESSAGING.md](MESSAGING.md) for details.

---

## Local Development

### Option A: Docker Compose (Recommended)

The OS Service creates a shared Docker network (`garage-network`) and the single RabbitMQ instance. The other services join this network.

```bash
# Start each service and its local infrastructure independently
cd garage-os-service
cp .env.example .env
docker compose up -d

cd ../garage-billing-service
cp .env.example .env
docker compose up -d

cd ../garage-execution-service
cp .env.example .env
docker compose up -d
```

**Port allocation when running all services locally:**

| Service | App | DB | RabbitMQ (host mapping) | Source Compose |
|---------|-----|----|------------------------|----------------|
| OS | 3001 | 5432 (PostgreSQL) | 5672/15672 | garage-os-service |
| Billing | 3002 | 27017 (MongoDB) | 5674/15674 | garage-billing-service |
| Execution | 3003 | 5433 (PostgreSQL) | 5675/15675 | garage-execution-service |

Each repository brings up its own RabbitMQ broker; there is no requirement to start the OS Service first.

### Option B: Native Node.js

Requires external PostgreSQL, MongoDB, and RabbitMQ instances.

```bash
cd garage-os-service
npm install
cp .env.example .env
# Edit .env with your database and RabbitMQ connection details
npm run start:dev
```

Repeat for each service.

### Environment Variables

**OS Service (`.env`):**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_USER` | `postgres` | PostgreSQL user |
| `DATABASE_PASSWORD` | `postgres` | PostgreSQL password |
| `DATABASE_NAME` | `os_service` | PostgreSQL database |
| `RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ connection string |
| `JWT_SECRET` | — | JWT signing secret |
| `NODE_ENV` | `development` | Environment mode |

**Billing Service (`.env`):**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3002` | HTTP server port |
| `MONGODB_URI` | `mongodb://localhost:27017/billing_service` | MongoDB connection string |
| `RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ connection string |
| `MERCADOPAGO_ACCESS_TOKEN` | — | Mercado Pago API token |
| `MERCADOPAGO_PUBLIC_KEY` | — | Mercado Pago public key |
| `JWT_SECRET` | — | JWT signing secret |
| `NODE_ENV` | `development` | Environment mode |

**Execution Service (`.env`):**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3003` | HTTP server port |
| `DATABASE_HOST` | `localhost` | PostgreSQL host |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_USER` | `postgres` | PostgreSQL user |
| `DATABASE_PASSWORD` | `postgres` | PostgreSQL password |
| `DATABASE_NAME` | `execution_service` | PostgreSQL database |
| `RABBITMQ_URL` | `amqp://localhost:5672` | RabbitMQ connection string |
| `JWT_SECRET` | — | JWT signing secret |
| `NODE_ENV` | `development` | Environment mode |

> **Important:** All three services must share the same `JWT_SECRET` value.

---

## Testing

### Run Tests

```bash
# Unit tests
npm run test

# Unit tests with coverage report
npm run test:cov

# BDD tests
npm run test:e2e -- test/bdd/

# Lint check
npm run lint
```

### Coverage Threshold

All services enforce a minimum 80% coverage on statements, branches, functions, and lines. The CI pipeline fails if coverage drops below this threshold.

### Verify Coverage

```bash
npm run test:cov
# HTML report: coverage/lcov-report/index.html
```

---

## Docker Build

Each service uses a multi-stage Dockerfile (Node.js 20 Alpine):

```bash
# Build image
docker build -t garage-os-service:latest .

# Run container
docker run -p 3001:3001 --env-file .env garage-os-service:latest
```

The build stage compiles TypeScript. The runtime stage contains only `dist/` and production `node_modules/`.

---

## CI/CD Pipeline

Each repository contains `.github/workflows/ci-cd.yaml` with 4 stages:

### Stage 1: Test (on push and PR)

1. `npm ci` — install dependencies
2. `npm run lint` — ESLint check
3. `npm run test:cov` — run tests with coverage
4. Verify coverage >= 80%
5. Upload `lcov.info` to Codecov

### Stage 2: Quality (after Test)

1. SonarQube scan using `sonar-project.properties`
2. Quality gate validation (code smells, vulnerabilities, technical debt)

### Stage 3: Build (main branch only)

1. Configure AWS credentials
2. Login to Amazon ECR
3. Build Docker image
4. Tag with commit SHA and `latest`
5. Push to ECR

### Stage 4: Deploy (main branch only)

1. Update kubeconfig for EKS cluster
2. `kubectl apply -f k8s/deployment.yaml`
3. `kubectl rollout status` to verify deployment

### Required GitHub Secrets

| Secret | Services | Description |
|--------|----------|-------------|
| `AWS_ACCESS_KEY_ID` | All | AWS IAM access key |
| `AWS_SECRET_ACCESS_KEY` | All | AWS IAM secret key |
| `SONAR_TOKEN` | All | SonarQube authentication token |
| `SONAR_HOST_URL` | All | SonarQube server URL |
| `MERCADOPAGO_ACCESS_TOKEN` | Billing only | Mercado Pago API token |
| `MERCADOPAGO_PUBLIC_KEY` | Billing only | Mercado Pago public key |

### Branch Protection Rules

Configure on GitHub for each repository:

1. **Settings → Branches → Add rule**
2. Branch pattern: `main`
3. Enable:
   - Require pull request before merging
   - Require status checks to pass (select `test`, `sonarqube`)
   - Require branches to be up to date before merging

---

## Kubernetes Deployment

### Cluster Setup

```bash
# Configure kubectl for EKS
aws eks update-kubeconfig --name garage-cluster --region us-east-1

# Create namespace
kubectl create namespace garage-production
```

### Create Secrets

```bash
# OS Service
kubectl create secret generic os-service-secrets \
  --from-literal=database-user=postgres \
  --from-literal=database-password=<PASSWORD> \
  --from-literal=rabbitmq-url=amqp://rabbitmq-os-service:5672 \
  -n garage-production

# Billing Service
kubectl create secret generic billing-service-secrets \
  --from-literal=mongodb-uri=mongodb://mongodb:27017/billing_service \
  --from-literal=rabbitmq-url=amqp://rabbitmq-billing-service:5672 \
  --from-literal=mercadopago-access-token=<TOKEN> \
  --from-literal=mercadopago-public-key=<KEY> \
  -n garage-production

# Execution Service
kubectl create secret generic execution-service-secrets \
  --from-literal=database-user=postgres \
  --from-literal=database-password=<PASSWORD> \
  --from-literal=rabbitmq-url=amqp://rabbitmq-execution-service:5672 \
  -n garage-production
```

### Deploy Services

```bash
kubectl apply -f garage-os-service/k8s/deployment.yaml -n garage-production
kubectl apply -f garage-billing-service/k8s/deployment.yaml -n garage-production
kubectl apply -f garage-execution-service/k8s/deployment.yaml -n garage-production
```

### Kubernetes Manifest Structure

Each `k8s/deployment.yaml` defines:

| Resource | Configuration |
|----------|--------------|
| **Deployment** | 2 replicas, Node.js 20 Alpine image |
| **Service** | ClusterIP, port 80 → target port (3001/3002/3003) |
| **ConfigMap** | Database host, non-sensitive config |
| **Secret** | Database credentials, RabbitMQ URL |
| **Liveness Probe** | `GET /health`, initial delay 30s, period 10s |
| **Readiness Probe** | `GET /health`, initial delay 10s, period 5s |
| **Resources** | Request: 256Mi/250m CPU, Limit: 512Mi/500m CPU |

### Verify Deployment

```bash
# Check pods
kubectl get pods -n garage-production

# Check services
kubectl get svc -n garage-production

# View logs
kubectl logs -f deployment/os-service -n garage-production

# Rollback if needed
kubectl rollout undo deployment/os-service -n garage-production
```

---

## Git Repository Initialization

```bash
# OS Service
cd garage-os-service
git init && git add . && git commit -m "Initial commit: OS Service"
git branch -M main
git remote add origin https://github.com/<org>/garage-os-service.git
git push -u origin main

# Billing Service
cd ../garage-billing-service
git init && git add . && git commit -m "Initial commit: Billing Service"
git branch -M main
git remote add origin https://github.com/<org>/garage-billing-service.git
git push -u origin main

# Execution Service
cd ../garage-execution-service
git init && git add . && git commit -m "Initial commit: Execution Service"
git branch -M main
git remote add origin https://github.com/<org>/garage-execution-service.git
git push -u origin main
```

---

## Troubleshooting

| Symptom | Diagnostic | Resolution |
|---------|-----------|------------|
| Service won't start | `docker compose logs <service>` | Check environment variables and database connectivity |
| Database connection refused | `docker compose ps` | Verify database container is healthy |
| RabbitMQ connection failed | `curl http://localhost:15672/api/overview` | Check RabbitMQ container status and credentials |
| Tests below 80% coverage | `npm run test:cov`, inspect `coverage/lcov-report/` | Add tests for uncovered branches/statements |
| SonarQube scan fails | Verify `SONAR_TOKEN` and `SONAR_HOST_URL` | Check `sonar-project.properties` configuration |
| K8s pods not ready | `kubectl describe pod <name> -n garage-production` | Check readiness probe, resource limits, secrets |
