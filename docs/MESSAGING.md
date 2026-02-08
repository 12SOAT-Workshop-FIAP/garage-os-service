# Messaging Architecture - RabbitMQ

## Overview

The garage management system uses **RabbitMQ** for asynchronous inter-service communication. All three microservices connect to a **single shared RabbitMQ instance** to publish and consume events following a choreographed saga pattern.

## Architecture Decision: Single Shared RabbitMQ

The RabbitMQ instance is defined and owned by the **OS Service** (`garage-os-service`), which is the system entrypoint. The other services (`garage-billing-service` and `garage-execution-service`) connect to this same instance via a shared Docker network (`garage-network`).

### Why a Single Instance?

| Factor | Single RabbitMQ | Multiple RabbitMQ |
|--------|----------------|-------------------|
| **Event Distribution** | All services see all events | Events isolated per instance |
| **Infrastructure Complexity** | Simple - one broker to manage | Complex - multiple brokers to sync |
| **Resource Usage** | Efficient - shared resources | Wasteful - duplicate infrastructure |
| **Cost** | Lower | Higher (3x instances) |
| **Operational Overhead** | One monitoring point | Three monitoring points |
| **Message Routing** | Native topic exchange | Requires federation/shovel |

## System Architecture

```mermaid
graph TB
    Client([Client / Frontend])

    subgraph garage-network ["Docker Network: garage-network"]
        subgraph os ["garage-os-service (entrypoint)"]
            OS[OS Service :3001]
            PG_OS[(PostgreSQL\nos_service :5432)]
        end

        RMQ>RabbitMQ :5672\nExchange: garage-events\nManagement UI :15672]

        subgraph billing ["garage-billing-service"]
            BILLING[Billing Service :3002]
            MONGO[(MongoDB\nbilling_service :27017)]
        end

        subgraph execution ["garage-execution-service"]
            EXEC[Execution Service :3003]
            PG_EXEC[(PostgreSQL\nexecution_service :5433)]
        end
    end

    Client -->|HTTP REST| OS
    Client -->|HTTP REST| BILLING
    Client -->|HTTP REST| EXEC

    OS <-->|AMQP| RMQ
    BILLING <-->|AMQP| RMQ
    EXEC <-->|AMQP| RMQ

    OS --- PG_OS
    BILLING --- MONGO
    EXEC --- PG_EXEC
```

## Docker Network & Startup

```mermaid
flowchart LR
    subgraph step1 ["1 - Start OS Service"]
        direction TB
        A1[docker compose up -d] --> A2[Creates garage-network]
        A2 --> A3[Starts PostgreSQL]
        A2 --> A4[Starts RabbitMQ]
        A3 --> A5[Starts OS Service]
        A4 --> A5
    end

    subgraph step2 ["2 - Start Billing Service"]
        direction TB
        B1[docker compose up -d] --> B2[Joins garage-network\nexternal: true]
        B2 --> B3[Starts MongoDB]
        B3 --> B4[Starts Billing Service]
    end

    subgraph step3 ["3 - Start Execution Service"]
        direction TB
        C1[docker compose up -d] --> C2[Joins garage-network\nexternal: true]
        C2 --> C3[Starts PostgreSQL :5433]
        C3 --> C4[Starts Execution Service]
    end

    step1 --> step2 --> step3
```

> **OS Service must be started first** -- it creates the `garage-network` and the shared RabbitMQ. The other services declare the network as `external: true`.

## RabbitMQ Exchange & Queues

```mermaid
graph LR
    subgraph Exchange ["Exchange: garage-events (topic)"]
        direction TB
        EX((garage-events))
    end

    subgraph OS Queues
        Q1[os-payment-approved]
        Q2[os-payment-failed]
        Q3[os-quote-rejected]
        Q4[os-execution-completed]
    end

    subgraph Billing Queues
        Q5[billing-work-order-created]
        Q6[billing-work-order-cancelled]
        Q7[billing-execution-failed]
    end

    subgraph Execution Queues
        Q8[execution-payment-approved]
        Q9[execution-quote-approved]
        Q10[execution-work-order-cancelled]
    end

    EX -->|payment.approved| Q1
    EX -->|payment.failed| Q2
    EX -->|quote.rejected| Q3
    EX -->|execution.completed| Q4

    EX -->|work-order.created| Q5
    EX -->|work-order.cancelled| Q6
    EX -->|execution.failed| Q7

    EX -->|payment.approved| Q8
    EX -->|quote.approved| Q9
    EX -->|work-order.cancelled| Q10
```

### Exchange Details

| Parameter | Value |
|-----------|-------|
| **Name** | `garage-events` |
| **Type** | `topic` |
| **Durable** | `true` |
| **Auto-delete** | `false` |

### Queue Naming Convention

Format: `{service}-{event-subject}` -- clear ownership, no collisions, easy debugging.

## Event Catalog

| Event | Publisher | Consumers | Purpose |
|-------|-----------|-----------|---------|
| `work-order.created` | OS Service | Billing | Trigger quote generation |
| `work-order.status-changed` | OS Service | Billing, Execution | Sync work order state |
| `work-order.cancelled` | OS Service | Billing, Execution | Compensation: refund + cancel |
| `quote.created` | Billing | OS Service | Quote ready notification |
| `quote.approved` | Billing | OS, Execution | Proceed to payment / prepare execution |
| `quote.rejected` | Billing | OS Service | Cancel work order |
| `quote.sent` | Billing | OS Service | Track quote delivery |
| `payment.created` | Billing | -- | Internal audit |
| `payment.approved` | Billing | OS, Execution | Start work + begin execution |
| `payment.rejected` | Billing | OS Service | Revert to approved |
| `payment.failed` | Billing | OS Service | Compensation: revert state |
| `execution.created` | Execution | -- | Internal tracking |
| `execution.status-changed` | Execution | OS Service | Update work order progress |
| `execution.completed` | Execution | OS Service | Mark work order completed |
| `execution.failed` | Execution | Billing | Trigger refund |

## Service Publish / Consume Map

```mermaid
graph LR
    OS((OS Service))
    BILLING((Billing Service))
    EXEC((Execution Service))

    OS -->|work-order.created| BILLING
    OS -->|work-order.cancelled| BILLING
    OS -->|work-order.cancelled| EXEC

    BILLING -->|quote.created| OS
    BILLING -->|quote.approved| OS
    BILLING -->|quote.approved| EXEC
    BILLING -->|quote.rejected| OS
    BILLING -->|payment.approved| OS
    BILLING -->|payment.approved| EXEC
    BILLING -->|payment.failed| OS

    EXEC -->|execution.completed| OS
    EXEC -->|execution.failed| BILLING
```

## Happy Path

```mermaid
sequenceDiagram
    participant Client
    participant OS as OS Service
    participant RMQ as RabbitMQ
    participant Billing as Billing Service
    participant Execution as Execution Service

    Client->>OS: POST /work-orders
    OS->>OS: Create WorkOrder (PENDING)
    OS->>RMQ: publish(work-order.created)
    OS-->>Client: 201 Created

    RMQ->>Billing: consume(work-order.created)
    Billing->>Billing: Generate Quote
    Billing->>RMQ: publish(quote.created)

    RMQ->>OS: consume(quote.created)
    OS->>OS: Update WorkOrder status

    Client->>Billing: PUT /quotes/:id/approve
    Billing->>Billing: Update Quote (APPROVED)
    Billing->>RMQ: publish(quote.approved)
    Billing-->>Client: 200 OK

    RMQ->>OS: consume(quote.approved)
    OS->>OS: Update WorkOrder (APPROVED)

    Client->>Billing: POST /payments
    Billing->>Billing: Process via Mercado Pago
    Billing->>RMQ: publish(payment.approved)
    Billing-->>Client: 200 OK

    RMQ->>OS: consume(payment.approved)
    OS->>OS: Update WorkOrder (IN_PROGRESS)

    RMQ->>Execution: consume(payment.approved)
    Execution->>Execution: Create Execution (QUEUED)
    Execution->>Execution: Diagnosis then Repair
    Execution->>RMQ: publish(execution.completed)

    RMQ->>OS: consume(execution.completed)
    OS->>OS: Update WorkOrder (COMPLETED)

    Client->>OS: GET /work-orders/:id
    OS-->>Client: Status: COMPLETED
```

## Compensation Scenarios (Saga)

### Payment Failure

```mermaid
sequenceDiagram
    participant Client
    participant OS as OS Service
    participant RMQ as RabbitMQ
    participant Billing as Billing Service

    Client->>Billing: POST /payments
    Billing->>Billing: Call Mercado Pago API
    Note over Billing: Payment Rejected
    Billing->>RMQ: publish(payment.failed)
    Billing-->>Client: 400 Payment Failed

    RMQ->>OS: consume(payment.failed)
    Note over OS: Compensation
    OS->>OS: Revert WorkOrder to APPROVED
```

### Work Order Cancellation

```mermaid
sequenceDiagram
    participant Client
    participant OS as OS Service
    participant RMQ as RabbitMQ
    participant Billing as Billing Service
    participant Execution as Execution Service

    Client->>OS: DELETE /work-orders/:id
    OS->>OS: Update WorkOrder (CANCELLED)
    OS->>RMQ: publish(work-order.cancelled)
    OS-->>Client: 200 OK

    RMQ->>Billing: consume(work-order.cancelled)
    Note over Billing: Compensation
    Billing->>Billing: Cancel Quote + Refund

    RMQ->>Execution: consume(work-order.cancelled)
    Note over Execution: Compensation
    Execution->>Execution: Cancel Execution (FAILED)
    Execution->>RMQ: publish(execution.failed)
```

### Execution Failure

```mermaid
sequenceDiagram
    participant Execution as Execution Service
    participant RMQ as RabbitMQ
    participant Billing as Billing Service
    participant OS as OS Service

    Note over Execution: Repair Fails
    Execution->>Execution: Update Execution (FAILED)
    Execution->>RMQ: publish(execution.failed)

    RMQ->>Billing: consume(execution.failed)
    Note over Billing: Compensation
    Billing->>Billing: Refund via Mercado Pago

    RMQ->>OS: consume(execution.failed)
    Note over OS: Compensation
    OS->>OS: Update WorkOrder status
```

## Choreographed Saga Pattern

```mermaid
flowchart TD
    E[Event Occurs] --> P[Service publishes event to RabbitMQ]
    P --> C1[Service A consumes]
    P --> C2[Service B consumes]
    P --> C3[Service C consumes]

    C1 --> L1[Execute business logic]
    C2 --> L2[Execute business logic]
    C3 --> L3[Execute business logic]

    L1 --> N1[Publish new event]
    L2 --> N2[Publish new event]
    L3 --> N3[Publish new event]

    N1 --> NEXT[Next saga step]
    N2 --> NEXT
    N3 --> NEXT
```

No central orchestrator. Each service reacts to events autonomously and publishes its own state changes.

## Message Format

All events follow this structure:

```json
{
  "eventId": "uuid-v4",
  "eventType": "work-order.created",
  "timestamp": "2026-02-08T10:00:00.000Z",
  "source": "os-service",
  "data": {
    "workOrderId": "uuid",
    "customerId": "uuid",
    "vehicleId": "uuid",
    "status": "PENDING",
    "description": "Oil change and tire rotation"
  }
}
```

## Service Subscriptions

### OS Service

**Publishes:** `work-order.created`, `work-order.status-changed`, `work-order.cancelled`

**Consumes:**

| Queue | Routing Key |
|-------|-------------|
| `os-payment-approved` | `payment.approved` |
| `os-payment-failed` | `payment.failed` |
| `os-quote-rejected` | `quote.rejected` |
| `os-execution-completed` | `execution.completed` |

### Billing Service

**Publishes:** `quote.created`, `quote.approved`, `quote.rejected`, `quote.sent`, `payment.created`, `payment.approved`, `payment.rejected`, `payment.failed`

**Consumes:**

| Queue | Routing Key |
|-------|-------------|
| `billing-work-order-created` | `work-order.created` |
| `billing-work-order-cancelled` | `work-order.cancelled` |
| `billing-execution-failed` | `execution.failed` |

### Execution Service

**Publishes:** `execution.created`, `execution.status-changed`, `execution.completed`, `execution.failed`

**Consumes:**

| Queue | Routing Key |
|-------|-------------|
| `execution-payment-approved` | `payment.approved` |
| `execution-quote-approved` | `quote.approved` |
| `execution-work-order-cancelled` | `work-order.cancelled` |

## Connection Details

| Parameter | Value |
|-----------|-------|
| **Protocol** | AMQP |
| **Host** | `rabbitmq` (via `garage-network`) |
| **Port** | 5672 (AMQP), 15672 (Management UI) |
| **Virtual Host** | `/` |
| **User / Password** | `guest` / `guest` (dev) |
| **Connection String** | `amqp://rabbitmq:5672` |

## Host Port Mapping

| Container | Internal Port | Host Port | Source Compose |
|-----------|---------------|-----------|----------------|
| postgres (OS) | 5432 | 5432 | garage-os-service |
| rabbitmq | 5672 / 15672 | 5672 / 15672 | garage-os-service |
| mongodb | 27017 | 27017 | garage-billing-service |
| postgres-execution | 5432 | 5433 | garage-execution-service |
| os-service | 3001 | 3001 | garage-os-service |
| billing-service | 3002 | 3002 | garage-billing-service |
| execution-service | 3003 | 3003 | garage-execution-service |

## Development Setup

All three repositories cloned side by side:

```bash
# 1. Start OS Service (creates garage-network + RabbitMQ + PostgreSQL)
cd garage-os-service
docker compose up -d

# 2. Start Billing Service (joins garage-network, starts MongoDB)
cd ../garage-billing-service
docker compose up -d

# 3. Start Execution Service (joins garage-network, starts PostgreSQL on :5433)
cd ../garage-execution-service
docker compose up -d
```

To stop:

```bash
cd garage-execution-service && docker compose down
cd ../garage-billing-service && docker compose down
cd ../garage-os-service && docker compose down   # removes garage-network
```

## Production (Kubernetes)

Deploy a single RabbitMQ StatefulSet in the shared namespace. All services reference it via internal DNS:

```
amqp://rabbitmq.garage-management.svc.cluster.local:5672
```

## Monitoring

- **Management UI:** `http://localhost:15672` -- credentials: `guest`/`guest`
- **Expected connections:** 3 (one per service)
- **Queue depth:** should stay low if services are processing

### Debugging

```bash
# Check all services are on the same network
docker network inspect garage-network

# Check queues and connections
docker exec garage-os-service-rabbitmq-1 rabbitmqctl list_queues
docker exec garage-os-service-rabbitmq-1 rabbitmqctl list_connections
```

## Why Messaging vs HTTP?

| Factor | Messaging (RabbitMQ) | HTTP |
|--------|---------------------|------|
| **Coupling** | Loose | Tight |
| **Resilience** | Messages queued if consumer down | Fails if service down |
| **Scalability** | Easy to add consumers | Requires load balancer |
| **Async Workflows** | Native | Requires polling/webhooks |
| **Saga Pattern** | Natural fit | Complex orchestration |

## Best Practices

1. **Idempotency** -- handlers safe to process the same message multiple times
2. **Message Acknowledgment** -- always ack after successful processing
3. **Error Handling** -- use dead-letter queues for failed messages
4. **Monitoring** -- track message rates and queue depths
5. **Versioning** -- include event version for future schema changes
6. **Logging** -- log all events with correlation IDs
7. **Security** -- use TLS (`amqps://`) in production
8. **Credentials** -- store in secrets manager, never hardcode
