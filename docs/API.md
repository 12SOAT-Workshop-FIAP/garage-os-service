# API Reference

All services require JWT Bearer authentication unless marked as **public**.

```
Authorization: Bearer <jwt_token>
```

## Base URLs

| Service | URL | Swagger |
|---------|-----|---------|
| OS Service | `http://localhost:3001` | `http://localhost:3001/api` |
| Billing Service | `http://localhost:3002` | `http://localhost:3002/api` |
| Execution Service | `http://localhost:3003` | `http://localhost:3003/api` |

---

## OS Service (Port 3001)

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | Public | Service health check |

**Response `200`:**
```json
{
  "status": "ok",
  "service": "os-service",
  "timestamp": "2026-02-06T10:00:00.000Z"
}
```

### Customers

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/customers` | Create customer |
| `GET` | `/customers` | List all customers |
| `GET` | `/customers/:id` | Get customer by ID |
| `GET` | `/customers/document/:document` | Find customer by CPF/CNPJ |
| `PATCH` | `/customers/:id` | Update customer |
| `DELETE` | `/customers/:id` | Delete customer |

**`POST /customers` — Request:**
```json
{
  "name": "John Doe",
  "personType": "INDIVIDUAL",
  "document": "12345678901",
  "email": "john@email.com",
  "phone": "11999999999"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | |
| `personType` | enum | yes | `INDIVIDUAL`, `COMPANY` |
| `document` | string | yes | CPF or CNPJ, unique |
| `email` | string | no | Valid email |
| `phone` | string | yes | |

**`PATCH /customers/:id` — Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@email.com",
  "phone": "11888888888",
  "status": true
}
```

All fields optional.

### Vehicles

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/vehicles` | Create vehicle |
| `GET` | `/vehicles` | List all vehicles |
| `GET` | `/vehicles/:id` | Get vehicle by ID |
| `GET` | `/vehicles/customer/:customerId` | List vehicles by customer |
| `PUT` | `/vehicles/:id` | Update vehicle |
| `DELETE` | `/vehicles/:id` | Delete vehicle |

**`POST /vehicles` — Request:**
```json
{
  "plate": "ABC1D23",
  "brand": "Toyota",
  "model": "Corolla",
  "year": 2024,
  "customerId": 1
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `plate` | string | yes | Unique license plate |
| `brand` | string | yes | |
| `model` | string | yes | |
| `year` | number | yes | |
| `customerId` | number | yes | FK to customer |

### Work Orders

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/work-orders` | Create work order |
| `GET` | `/work-orders` | List work orders (filterable) |
| `GET` | `/work-orders/:id` | Get work order by ID |
| `PATCH` | `/work-orders/:id` | Update work order |
| `POST` | `/work-orders/:id/approve` | Approve work order |
| `DELETE` | `/work-orders/:id` | Cancel work order |
| `GET` | `/work-orders/:id/history` | Get status change history |

**Query filters for `GET /work-orders`:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | enum | Filter by status |
| `customerId` | string | Filter by customer |
| `vehicleId` | string | Filter by vehicle |

**`POST /work-orders` — Request:**
```json
{
  "customerId": 1,
  "vehicleId": 1,
  "description": "Oil change and filter replacement",
  "estimatedCost": 150.00,
  "assignedTechnicianId": "tech-uuid",
  "estimatedCompletionDate": "2026-02-10",
  "metadata": { "urgency": "normal" }
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `customerId` | number | yes | FK to customer |
| `vehicleId` | number | yes | FK to vehicle |
| `description` | string | yes | |
| `estimatedCost` | number | no | |
| `assignedTechnicianId` | string | no | |
| `estimatedCompletionDate` | string | no | ISO 8601 date |
| `metadata` | object | no | Arbitrary key-value |

**`PATCH /work-orders/:id` — Request (all fields optional):**
```json
{
  "status": "IN_PROGRESS",
  "description": "Updated description",
  "estimatedCost": 200.00,
  "actualCost": 180.00,
  "laborCost": 80.00,
  "partsCost": 100.00,
  "diagnosis": "Engine oil leak detected",
  "technicianNotes": "Replaced gasket",
  "customerApproval": true,
  "assignedTechnicianId": "tech-uuid",
  "estimatedCompletionDate": "2026-02-12",
  "services": [],
  "parts": [],
  "metadata": {}
}
```

**Work order statuses:**

```
RECEIVED → PENDING → DIAGNOSIS → AWAITING_QUOTE → QUOTE_SENT →
APPROVED → IN_PROGRESS → WAITING_PARTS → COMPLETED → DELIVERED
                                                    → CANCELLED (from any state)
```

### Public Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/public/work-orders/:id/status` | Public | Check work order status |

**Query parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `document` | string | yes | Customer CPF/CNPJ |

---

## Billing Service (Port 3002)

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | Public | Service health check |

### Quotes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/quotes` | Create quote |
| `GET` | `/quotes` | List all quotes |
| `GET` | `/quotes/:id` | Get quote by ID |
| `GET` | `/quotes/work-order/:workOrderId` | Get quotes by work order |
| `PATCH` | `/quotes/:id/approve` | Approve quote |
| `PATCH` | `/quotes/:id/reject` | Reject quote |
| `PATCH` | `/quotes/:id/send` | Send quote to customer |

**`POST /quotes` — Request:**
```json
{
  "workOrderId": "wo-uuid",
  "customerId": "customer-uuid",
  "items": [
    {
      "name": "Synthetic Oil 5W30",
      "description": "4 liters premium synthetic oil",
      "quantity": 4,
      "unitPrice": 45.99
    },
    {
      "name": "Oil Filter",
      "description": "Original manufacturer filter",
      "quantity": 1,
      "unitPrice": 35.00
    }
  ],
  "validUntil": "2026-02-20"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `workOrderId` | string | yes | |
| `customerId` | string | yes | |
| `items` | array | yes | Min 1 item |
| `items[].name` | string | yes | |
| `items[].description` | string | yes | |
| `items[].quantity` | number | yes | |
| `items[].unitPrice` | number | yes | |
| `validUntil` | string | no | ISO 8601 date |

**Quote statuses:** `PENDING` → `SENT` → `APPROVED` / `REJECTED` / `EXPIRED`

### Payments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/payments` | Create payment |
| `POST` | `/payments/:id/process` | Process via Mercado Pago |
| `GET` | `/payments` | List all payments |
| `GET` | `/payments/:id` | Get payment by ID |
| `GET` | `/payments/work-order/:workOrderId` | Get payments by work order |
| `PATCH` | `/payments/:id/verify` | Verify status with Mercado Pago |

**`POST /payments` — Request:**
```json
{
  "quoteId": "quote-id",
  "workOrderId": "wo-id",
  "customerId": "customer-id",
  "amount": 218.96,
  "paymentMethod": "PIX",
  "metadata": {}
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `quoteId` | string | yes | |
| `workOrderId` | string | yes | |
| `customerId` | string | yes | |
| `amount` | number | yes | |
| `paymentMethod` | enum | yes | `PIX`, `CREDIT_CARD`, `DEBIT_CARD`, `BOLETO` |
| `metadata` | object | no | |

**Payment statuses:** `PENDING` → `PROCESSING` → `APPROVED` / `REJECTED` / `REFUNDED`

**`POST /payments/:id/process` — Response `200`:**
```json
{
  "_id": "payment-mongo-id",
  "status": "APPROVED",
  "mercadoPagoId": "mp-123456",
  "mercadoPagoStatus": "approved"
}
```

### Parts (Inventory)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/parts` | Create part |
| `GET` | `/parts` | List all parts |
| `GET` | `/parts/low-stock` | List parts below minimum stock |
| `GET` | `/parts/:id` | Get part by ID |
| `PUT` | `/parts/:id` | Update part |
| `PUT` | `/parts/:id/stock` | Update stock quantity |
| `DELETE` | `/parts/:id` | Delete part |

**`POST /parts` — Request:**
```json
{
  "name": "Oil Filter",
  "description": "Premium oil filter",
  "partNumber": "FLT-001",
  "category": "Filters",
  "price": 35.00,
  "costPrice": 20.00,
  "stockQuantity": 100,
  "minStockLevel": 5,
  "unit": "unit",
  "supplier": "AutoParts Inc."
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | |
| `partNumber` | string | yes | Unique |
| `price` | number | yes | Sale price |
| `costPrice` | number | yes | |
| `stockQuantity` | number | yes | |
| `description` | string | no | |
| `category` | string | no | |
| `minStockLevel` | number | no | Default: 5 |
| `unit` | string | no | Default: "unit" |
| `supplier` | string | no | |

**`PUT /parts/:id/stock` — Request:**
```json
{
  "quantity": 50
}
```

### Service Catalog

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/services` | Create service |
| `GET` | `/services` | List all services |
| `GET` | `/services/:id` | Get service by ID |
| `PUT` | `/services/:id` | Update service |
| `DELETE` | `/services/:id` | Delete service |

**`POST /services` — Request:**
```json
{
  "name": "Oil Change",
  "description": "Complete synthetic oil change",
  "price": 80.00,
  "active": true,
  "duration": 60
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | string | yes | |
| `price` | number | yes | |
| `duration` | number | yes | Minutes |
| `description` | string | no | |
| `active` | boolean | no | Default: true |

---

## Execution Service (Port 3003)

### Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | Public | Service health check |

### Executions

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/executions` | Create execution |
| `GET` | `/executions` | List all executions |
| `GET` | `/executions/queue` | Get execution queue (priority order) |
| `GET` | `/executions/:id` | Get execution by ID |
| `GET` | `/executions/work-order/:workOrderId` | Get execution by work order |
| `PATCH` | `/executions/:id` | Update execution |
| `POST` | `/executions/:id/start-diagnosis` | Start diagnosis phase |
| `POST` | `/executions/:id/complete-diagnosis` | Complete diagnosis |
| `POST` | `/executions/:id/start-repair` | Start repair phase |
| `POST` | `/executions/:id/complete-repair` | Complete repair |
| `POST` | `/executions/:id/complete` | Finalize execution |

**`POST /executions` — Request:**
```json
{
  "workOrderId": "wo-uuid",
  "quoteId": "quote-uuid",
  "technicianId": "tech-uuid",
  "priority": 5
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `workOrderId` | string | yes | |
| `technicianId` | string | yes | |
| `quoteId` | string | no | |
| `priority` | number | no | Higher = more urgent |

**`POST /executions/:id/complete-diagnosis` — Request:**
```json
{
  "notes": "Engine oil leak found at gasket. Replacement required."
}
```

**`POST /executions/:id/complete-repair` — Request:**
```json
{
  "notes": "Gasket replaced, oil refilled, system tested."
}
```

**`PATCH /executions/:id` — Request (all fields optional):**
```json
{
  "status": "REPAIRING",
  "diagnosisNotes": "Updated diagnosis",
  "repairNotes": "Updated repair notes",
  "partsUsed": [
    { "partId": "part-1", "name": "Gasket", "quantity": 1 }
  ],
  "servicesPerformed": [
    { "serviceId": "svc-1", "name": "Oil Change", "duration": 60 }
  ]
}
```

**Execution statuses:**

```
QUEUED → DIAGNOSING → DIAGNOSIS_COMPLETE → REPAIRING → REPAIR_COMPLETE → TESTING → COMPLETED
                                                                                  → FAILED (from any active state)
```

### Queue

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/queue` | View execution queue |
| `GET` | `/queue/statistics` | Queue statistics |

**`GET /queue/statistics` — Response `200`:**
```json
{
  "total": 10,
  "byStatus": {
    "queued": 5,
    "diagnosing": 3,
    "repairing": 2
  },
  "averageWaitTime": 45
}
```

---

## Error Responses

All services return errors in a consistent format:

**`400` Bad Request:**
```json
{
  "statusCode": 400,
  "message": ["customerId must be a number"],
  "error": "Bad Request"
}
```

**`401` Unauthorized:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**`404` Not Found:**
```json
{
  "statusCode": 404,
  "message": "Work order abc-123 not found"
}
```

**`409` Conflict:**
```json
{
  "statusCode": 409,
  "message": "Quote is already approved"
}
```

**`500` Internal Server Error:**
```json
{
  "statusCode": 500,
  "message": "Internal server error"
}
```

---

## Postman Collections

Each service includes a Postman collection with pre-configured requests and variables:

- `garage-os-service/postman_collection.json`
- `garage-billing-service/postman_collection.json`
- `garage-execution-service/postman_collection.json`

Import into Postman and set the `jwt_token` collection variable for authenticated requests.
