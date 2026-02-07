# Architecture Diagrams

## 1. System Overview

```mermaid
graph TB
    subgraph Client
        CLI[Client / Frontend]
    end

    subgraph Microservices
        OS[OS Service<br/>Port 3001<br/>PostgreSQL]
        BILL[Billing Service<br/>Port 3002<br/>MongoDB]
        EXEC[Execution Service<br/>Port 3003<br/>PostgreSQL]
    end

    subgraph Infrastructure
        RMQ[(RabbitMQ<br/>Message Broker)]
        PG1[(PostgreSQL<br/>OS DB)]
        MDB[(MongoDB<br/>Billing DB)]
        PG2[(PostgreSQL<br/>Execution DB)]
    end

    subgraph External
        MP[Mercado Pago<br/>Payment Gateway]
    end

    CLI -->|REST API| OS
    CLI -->|REST API| BILL
    CLI -->|REST API| EXEC

    OS -->|Publish events| RMQ
    BILL -->|Publish events| RMQ
    EXEC -->|Publish events| RMQ

    RMQ -->|Consume events| OS
    RMQ -->|Consume events| BILL
    RMQ -->|Consume events| EXEC

    OS -->|Read/Write| PG1
    BILL -->|Read/Write| MDB
    EXEC -->|Read/Write| PG2

    BILL -->|Process payment| MP

    style OS fill:#4CAF50
    style BILL fill:#2196F3
    style EXEC fill:#FF9800
    style RMQ fill:#FF6B6B
    style MP fill:#00E676
```

## 2. Saga Pattern — Happy Path

```mermaid
sequenceDiagram
    participant C as Client
    participant OS as OS Service
    participant B as Billing Service
    participant E as Execution Service
    participant RMQ as RabbitMQ
    participant MP as Mercado Pago

    C->>OS: 1. POST /work-orders
    OS->>OS: Save work order (PENDING)
    OS->>RMQ: Publish: work-order.created
    OS-->>C: 201 Created

    RMQ->>B: Consume: work-order.created
    B->>B: Generate quote
    B->>RMQ: Publish: quote.created

    RMQ->>OS: Consume: quote.created
    OS->>OS: Update status (QUOTE_SENT)

    C->>B: 2. PATCH /quotes/:id/approve
    B->>B: Update quote (APPROVED)
    B->>RMQ: Publish: quote.approved

    RMQ->>OS: Consume: quote.approved
    OS->>OS: Update status (APPROVED)

    C->>B: 3. POST /payments
    B->>B: Create payment record
    C->>B: 4. POST /payments/:id/process
    B->>MP: Process via Mercado Pago SDK
    MP-->>B: Status: approved
    B->>B: Update payment (APPROVED)
    B->>RMQ: Publish: payment.approved

    RMQ->>OS: Consume: payment.approved
    OS->>OS: Update status (IN_PROGRESS)

    RMQ->>E: Consume: payment.approved
    E->>E: Create execution (QUEUED)

    Note over E: Technician workflow

    E->>E: Start diagnosis (DIAGNOSING)
    E->>E: Complete diagnosis (DIAGNOSIS_COMPLETE)
    E->>E: Start repair (REPAIRING)
    E->>E: Complete repair (REPAIR_COMPLETE)
    E->>E: Finalize (COMPLETED)
    E->>RMQ: Publish: execution.completed

    RMQ->>OS: Consume: execution.completed
    OS->>OS: Update work order (COMPLETED)
```

## 3. Saga Compensation — Payment Failure

```mermaid
sequenceDiagram
    participant C as Client
    participant OS as OS Service
    participant B as Billing Service
    participant RMQ as RabbitMQ
    participant MP as Mercado Pago

    C->>B: POST /payments/:id/process
    B->>MP: Process payment
    MP-->>B: Status: rejected
    B->>B: Update payment (REJECTED)
    B->>RMQ: Publish: payment.rejected

    RMQ->>OS: Consume: payment.rejected
    OS->>OS: Revert status to APPROVED
    OS-->>C: Payment rejected notification
```

## 4. Saga Compensation — Work Order Cancellation

```mermaid
sequenceDiagram
    participant C as Client
    participant OS as OS Service
    participant B as Billing Service
    participant E as Execution Service
    participant RMQ as RabbitMQ

    C->>OS: DELETE /work-orders/:id
    OS->>OS: Set status (CANCELLED)
    OS->>RMQ: Publish: work-order.cancelled

    RMQ->>B: Consume: work-order.cancelled
    B->>B: Cancel quote
    B->>B: Refund payment (if exists)

    RMQ->>E: Consume: work-order.cancelled
    E->>E: Cancel execution (FAILED)
    E->>RMQ: Publish: execution.failed
```

## 5. Work Order State Machine

```mermaid
stateDiagram-v2
    [*] --> PENDING: Work order created

    PENDING --> AWAITING_QUOTE: Awaiting quote generation
    AWAITING_QUOTE --> QUOTE_SENT: Quote sent to customer

    QUOTE_SENT --> APPROVED: Customer approves
    QUOTE_SENT --> CANCELLED: Customer rejects

    APPROVED --> IN_PROGRESS: Payment confirmed

    IN_PROGRESS --> WAITING_PARTS: Parts on order
    WAITING_PARTS --> IN_PROGRESS: Parts arrived
    IN_PROGRESS --> COMPLETED: Execution finished
    IN_PROGRESS --> CANCELLED: Cancellation

    COMPLETED --> DELIVERED: Vehicle delivered

    PENDING --> CANCELLED: Client cancels
    AWAITING_QUOTE --> CANCELLED: Client cancels

    DELIVERED --> [*]
    CANCELLED --> [*]
```

## 6. Execution State Machine

```mermaid
stateDiagram-v2
    [*] --> QUEUED: Receives payment.approved

    QUEUED --> DIAGNOSING: Technician starts

    DIAGNOSING --> DIAGNOSIS_COMPLETE: Diagnosis finished
    DIAGNOSING --> FAILED: Critical error

    DIAGNOSIS_COMPLETE --> REPAIRING: Start repair

    REPAIRING --> REPAIR_COMPLETE: Repair finished
    REPAIRING --> FAILED: Critical error

    REPAIR_COMPLETE --> TESTING: Final test

    TESTING --> COMPLETED: Test passed
    TESTING --> REPAIRING: Rework needed

    COMPLETED --> [*]: Publishes execution.completed
    FAILED --> [*]: Publishes execution.failed
```

## 7. Billing Flow

```mermaid
graph TD
    A[Receive event:<br/>work-order.created] --> B[Create quote]
    B --> C{Customer<br/>approves?}

    C -->|Yes| D[Approve quote]
    C -->|No| E[Reject quote]

    D --> F[Create payment]
    F --> G[Process via<br/>Mercado Pago]

    G --> H{Payment<br/>approved?}

    H -->|Yes| I[Publish:<br/>payment.approved]
    H -->|No| J[Publish:<br/>payment.rejected]

    I --> K[Execution proceeds]
    J --> L[Compensation:<br/>Revert work order status]

    E --> M[Publish:<br/>quote.rejected]

    style G fill:#00E676
    style I fill:#4CAF50
    style J fill:#f44336
```

## 8. Event Topology

```mermaid
graph TB
    subgraph "OS Service Events"
        WOC[work-order.created]
        WOSC[work-order.status-changed]
        WOCA[work-order.cancelled]
    end

    subgraph "Billing Service Events"
        QC[quote.created]
        QS[quote.sent]
        QA[quote.approved]
        QR[quote.rejected]
        PC[payment.created]
        PA[payment.approved]
        PR[payment.rejected]
        PF[payment.failed]
    end

    subgraph "Execution Service Events"
        EC[execution.created]
        ESC[execution.status-changed]
        ECO[execution.completed]
        EF[execution.failed]
    end

    subgraph "RabbitMQ"
        EX[garage-events<br/>Type: topic]
    end

    WOC --> EX
    WOSC --> EX
    WOCA --> EX
    QC --> EX
    QS --> EX
    QA --> EX
    QR --> EX
    PC --> EX
    PA --> EX
    PR --> EX
    PF --> EX
    EC --> EX
    ESC --> EX
    ECO --> EX
    EF --> EX

    EX -->|work-order.*| OSRECV[OS Service]
    EX -->|quote.*, payment.*| BRECV[Billing Service]
    EX -->|payment.approved| ERECV[Execution Service]
    EX -->|execution.*| OSRECV

    style EX fill:#FF6B6B
```

## 9. Data Models — OS Service (PostgreSQL)

```mermaid
erDiagram
    CUSTOMERS {
        serial id PK
        varchar name
        enum person_type
        varchar document UK
        varchar email
        varchar phone
        boolean status
        timestamp created_at
        timestamp updated_at
    }

    VEHICLES {
        serial id PK
        varchar plate UK
        varchar brand
        varchar model
        int year
        int customer_id FK
        timestamp created_at
        timestamp updated_at
    }

    WORK_ORDERS {
        uuid id PK
        int customer_id FK
        int vehicle_id FK
        text description
        enum status
        decimal estimated_cost
        decimal actual_cost
        decimal labor_cost
        decimal parts_cost
        text diagnosis
        text technician_notes
        boolean customer_approval
        varchar assigned_technician_id
        timestamp estimated_completion_date
        timestamp completed_at
        jsonb services
        jsonb parts
        jsonb metadata
        timestamp created_at
        timestamp updated_at
    }

    CUSTOMERS ||--o{ VEHICLES : owns
    CUSTOMERS ||--o{ WORK_ORDERS : requests
    VEHICLES ||--o{ WORK_ORDERS : subject_of
```

## 10. Data Models — Billing Service (MongoDB)

```mermaid
erDiagram
    QUOTES {
        objectId _id PK
        string workOrderId
        string customerId
        array items
        number totalAmount
        enum status
        date validUntil
        date approvedAt
        object metadata
        timestamp createdAt
        timestamp updatedAt
    }

    PAYMENTS {
        objectId _id PK
        string quoteId FK
        string workOrderId
        string customerId
        number amount
        enum paymentMethod
        enum status
        string mercadoPagoId
        string mercadoPagoStatus
        object mercadoPagoResponse
        date approvedAt
        object metadata
        timestamp createdAt
        timestamp updatedAt
    }

    PARTS {
        objectId _id PK
        string name
        string description
        string partNumber UK
        string category
        number price
        number costPrice
        number stockQuantity
        number minStockLevel
        string unit
        string supplier
        enum status
    }

    SERVICE_CATALOG {
        objectId _id PK
        string name
        string description
        number price
        boolean active
        number duration
        timestamp createdAt
        timestamp updatedAt
    }

    QUOTES ||--o{ PAYMENTS : generates
```

## 11. Data Models — Execution Service (PostgreSQL)

```mermaid
erDiagram
    EXECUTIONS {
        uuid id PK
        varchar work_order_id
        varchar quote_id
        varchar technician_id
        enum status
        int priority
        text diagnosis_notes
        text repair_notes
        jsonb parts_used
        jsonb services_performed
        timestamp started_at
        timestamp diagnosis_completed_at
        timestamp repair_completed_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
        jsonb metadata
    }
```

## 12. CI/CD Pipeline

```mermaid
graph LR
    A[Git Push] --> B[GitHub Actions]

    B --> C[Lint<br/>ESLint + Prettier]
    C --> D[Unit Tests<br/>Jest]
    D --> E[Coverage Check<br/>>= 80%]
    E --> F[SonarQube Scan]

    F --> G{Quality<br/>gates pass?}

    G -->|No| H[Pipeline fails]
    G -->|Yes| I[Build Docker image]

    I --> J[Push to AWS ECR<br/>Tag: commit SHA]
    J --> K[kubectl apply<br/>Kubernetes deploy]
    K --> L[Rollout status<br/>Health check]

    L --> M{Healthy?}
    M -->|Yes| N[Deploy complete]
    M -->|No| O[Rollback]

    style N fill:#4CAF50
    style H fill:#f44336
    style O fill:#f44336
```

## 13. Kubernetes Topology

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        subgraph "OS Service"
            OSP1[Pod: os-1]
            OSP2[Pod: os-2]
            OSVC[Service: os-service<br/>ClusterIP :80 → :3001]

            OSP1 --> OSVC
            OSP2 --> OSVC
        end

        subgraph "Billing Service"
            BP1[Pod: billing-1]
            BP2[Pod: billing-2]
            BSVC[Service: billing-service<br/>ClusterIP :80 → :3002]

            BP1 --> BSVC
            BP2 --> BSVC
        end

        subgraph "Execution Service"
            EP1[Pod: execution-1]
            EP2[Pod: execution-2]
            ESVC[Service: execution-service<br/>ClusterIP :80 → :3003]

            EP1 --> ESVC
            EP2 --> ESVC
        end

        subgraph "Data Layer"
            RMQS[RabbitMQ]
            PGO[PostgreSQL: OS]
            MGDB[MongoDB: Billing]
            PGE[PostgreSQL: Execution]
        end

        OSVC --> PGO
        OSVC --> RMQS
        BSVC --> MGDB
        BSVC --> RMQS
        ESVC --> PGE
        ESVC --> RMQS
    end

    subgraph "External"
        LB[Load Balancer]
        CLT[Client]
    end

    CLT --> LB
    LB --> OSVC
    LB --> BSVC
    LB --> ESVC
```

## 14. Mercado Pago Integration

```mermaid
sequenceDiagram
    participant C as Client
    participant B as Billing Service
    participant SDK as MP SDK
    participant MP as Mercado Pago API

    C->>B: POST /payments
    B->>B: Create local payment record (PENDING)

    C->>B: POST /payments/:id/process
    B->>SDK: createPayment()
    SDK->>MP: POST /v1/payments

    MP-->>SDK: Response (approved/rejected/pending)
    SDK-->>B: Payment response

    B->>B: Save mercadoPagoId, update status

    alt Approved
        B->>RMQ: Publish: payment.approved
        B-->>C: 200 OK (APPROVED)
    else Rejected
        B->>RMQ: Publish: payment.rejected
        B-->>C: 200 OK (REJECTED)
    end

    Note over C,MP: Verification flow
    C->>B: PATCH /payments/:id/verify
    B->>SDK: getPaymentStatus()
    SDK->>MP: GET /v1/payments/:mpId
    MP-->>SDK: Current status
    SDK-->>B: Updated status
    B-->>C: Current payment status
```

## 15. End-to-End Flow (Simplified)

```mermaid
graph LR
    A[1. Client<br/>creates WO] --> B[2. System<br/>generates quote]
    B --> C[3. Client<br/>approves quote]
    C --> D[4. Client<br/>pays]
    D --> E[5. Mercado Pago<br/>processes]
    E --> F[6. Technician<br/>diagnoses]
    F --> G[7. Technician<br/>repairs]
    G --> H[8. System<br/>completes WO]

    style A fill:#4CAF50
    style E fill:#00E676
    style H fill:#4CAF50
```

---

## Color Legend

| Color | Represents |
|-------|-----------|
| Green (#4CAF50) | OS Service |
| Blue (#2196F3) | Billing Service |
| Orange (#FF9800) | Execution Service |
| Red (#FF6B6B) | RabbitMQ / Message Broker |
| Light Green (#00E676) | Mercado Pago / External |
