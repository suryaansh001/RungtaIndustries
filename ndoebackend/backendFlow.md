# Backend Development Prompt
## Factory Workflow & Billing Management System
### Stack: Node.js + Express.js + MongoDB + Mongoose

---

## 🧠 What You're Building

A REST API backend for a **factory product tracking and billing system**. Products come in, get categorized, tracked through stages or passed directly, and then billed. The backend must be modular, secure, and production-ready from day one.

---

## ⚙️ Tech Stack

| Layer | Choice |
|---|---|
| Runtime | Node.js (v18+) |
| Framework | Express.js |
| Database | MongoDB via Mongoose |
| Auth | JWT (jsonwebtoken) |
| Validation | express-validator |
| ID Generation | Custom logic (year-based sequential) |
| Excel Export | exceljs |
| PDF Generation | puppeteer or pdfkit |
| Rate Limiting | express-rate-limit |
| Logging | morgan + winston |
| Config | dotenv |
| Containerization | Docker + docker-compose |

---

## 🗃️ Database Schema (Mongoose Models)

### 1. User
```
id            ObjectId
name          String
email         String (unique, indexed)
password_hash String
role          Enum: ['admin', 'manager', 'operator', 'viewer']
is_active     Boolean (default: true)
created_at    Date
updated_at    Date
```
> **Note:** Add `is_active` flag — never hard delete users, just deactivate. This is missing from the original doc but critical for audit integrity.

---

### 2. Client (Party Master)
```
id              ObjectId
name            String (required)
gst_number      String (unique, sparse index)
address         String
mobile          String
contact_person  String
is_active       Boolean (default: true)
created_at      Date
updated_at      Date
```
> **Note:** `sparse` index on `gst_number` allows it to be optional while still enforcing uniqueness when provided.

---

### 3. Product
```
id              ObjectId
product_code    String (unique, indexed) — auto-generated: PROD-YYYY-XXXX
name            String (required)
description     String
client_id       ObjectId → ref: Client (required)
category        Enum: ['STAGE_BASED', 'DIRECT'] (required)
quantity        Number (min: 1)
price_per_unit  Number (min: 0)
current_stage   Number (1–4) or null — null for DIRECT
status          Enum: ['IN_PROGRESS', 'COMPLETED']
billing_status  Enum: ['NOT_GENERATED', 'PENDING', 'PAID', 'OVERDUE']
created_by      ObjectId → ref: User
created_at      Date
updated_at      Date
```
> **Note added:** `created_by` field is essential for audit trail. Missing from original doc.

**Product Code Generation Logic (critical — must be atomic):**
- Use a separate `Counters` collection: `{ _id: "PROD-2026", seq: 42 }`
- Use `findOneAndUpdate` with `$inc` and `upsert: true` — this is atomic in MongoDB and prevents duplicate codes even under concurrent requests.
- Format: pad sequence to 4 digits → `PROD-2026-0043`

---

### 4. Production Stage Log
```
id            ObjectId
product_id    ObjectId → ref: Product (required, indexed)
stage_number  Number (1–4)
notes         String (optional — operator can add remarks per stage)
updated_by    ObjectId → ref: User
timestamp     Date (default: now)
```
> **Note added:** `notes` field per stage is highly recommended for factory use — operators can log what happened at each stage. Missing from original doc.

---

### 5. Invoice
```
id              ObjectId
invoice_number  String (unique, indexed) — auto-generated: INV-YYYY-XXXX
product_id      ObjectId → ref: Product (required)
client_id       ObjectId → ref: Client (denormalized for fast billing queries)
subtotal        Number
gst_percentage  Number
gst_amount      Number
total_amount    Number
status          Enum: ['PENDING', 'PAID', 'OVERDUE']
issued_date     Date
due_date        Date  ← MISSING IN ORIGINAL — add this
paid_date       Date (nullable)
pdf_path        String (nullable — path to stored PDF)
created_by      ObjectId → ref: User
created_at      Date
```
> **Note added:** `due_date` is missing from the original doc — it is required to compute `OVERDUE` status. Without it, you cannot programmatically determine when an invoice becomes overdue. Also added `client_id` denormalized for faster invoice listing without joins.

---

### 6. Activity Log
```
id           ObjectId
user_id      ObjectId → ref: User
action_type  String (e.g. PRODUCT_CREATED, STAGE_UPDATED, INVOICE_GENERATED)
entity_type  Enum: ['product', 'invoice', 'client', 'user']
entity_id    ObjectId
description  String
ip_address   String  ← MISSING IN ORIGINAL — add this for security audit
created_at   Date
```
> **Note added:** `ip_address` of the request origin should be logged. This is standard in any security-conscious system and was missing from the original doc.

---

### 7. Settings (singleton)
```
id               ObjectId
gst_percentage   Number (default: 18)
company_name     String
company_address  String
company_mobile   String   ← add
company_email    String   ← add
invoice_prefix   String (default: 'INV')
product_prefix   String (default: 'PROD')  ← add (for flexibility)
updated_by       ObjectId → ref: User
created_at       Date
updated_at       Date
```
> **Note:** Only one document should exist. Enforce this in the service layer by always using `findOneAndUpdate` with upsert.

---

## 🔐 Security Requirements

### Authentication
- JWT access tokens with short expiry (15 min recommended)
- Refresh token pattern — store refresh tokens in DB with expiry, revoke on logout
- Hash passwords with `bcrypt` (min 10 rounds)
- Never return `password_hash` in any API response (use `.select('-password_hash')`)

### Authorization (Role-Based Access Control)
| Action | Admin | Manager | Operator | Viewer |
|---|---|---|---|---|
| Manage users | ✅ | ❌ | ❌ | ❌ |
| Manage clients | ✅ | ✅ | ❌ | ❌ |
| Create/edit products | ✅ | ✅ | ❌ | ❌ |
| Update stage | ✅ | ✅ | ✅ | ❌ |
| Generate invoice | ✅ | ✅ | ❌ | ❌ |
| Mark paid | ✅ | ✅ | ❌ | ❌ |
| View/export reports | ✅ | ✅ | ✅ | ✅ |
| Change settings | ✅ | ❌ | ❌ | ❌ |

> **Note:** The original doc had only 3 roles (admin/manager/viewer) — `operator` is added because in a factory, the floor worker who updates stages should not have manager-level access.

### Additional Security
- `helmet` middleware on all routes (sets secure HTTP headers)
- `express-rate-limit`: 100 req/15min globally, stricter on `/auth/login` (10 req/15min)
- Input sanitization via `express-validator` on every POST/PUT/PATCH body
- MongoDB injection protection — never pass raw user input into queries
- CORS — whitelist only known frontend origins, not `*` in production
- All file download endpoints must verify the requesting user owns or has access to the resource

---

## 📡 API Endpoints

### Auth
```
POST   /api/auth/register        Admin only — create new users
POST   /api/auth/login           Returns access + refresh token
POST   /api/auth/refresh         Exchange refresh token for new access token
POST   /api/auth/logout          Revoke refresh token
GET    /api/auth/me              Get current user profile
```

### Users
```
GET    /api/users                Admin only
PATCH  /api/users/:id/role       Admin only — change role
PATCH  /api/users/:id/deactivate Admin only — soft delete
```

### Clients
```
GET    /api/clients              Paginated, searchable by name/GST
POST   /api/clients
PUT    /api/clients/:id
DELETE /api/clients/:id          Soft delete (set is_active: false)
```

### Products
```
GET    /api/products             Paginated — filter by category, status, billing_status, client
GET    /api/products/:id         Full detail with stage history
POST   /api/products             Create + auto-generate product_code
PUT    /api/products/:id
DELETE /api/products/:id         Soft delete only if not billed
PATCH  /api/products/:id/stage   Update stage — validates sequential progression
```

### Invoices
```
POST   /api/invoices/generate/:product_id    Validate eligibility, auto-calculate, generate PDF
GET    /api/invoices                          Paginated — filter by status, client, date range
GET    /api/invoices/:id
PATCH  /api/invoices/:id/mark-paid
GET    /api/invoices/:id/download            Secure PDF download
```

### Reports
```
GET    /api/reports/stage-distribution       Products per stage
GET    /api/reports/revenue-summary          Monthly/yearly revenue totals
GET    /api/reports/category-breakdown       STAGE_BASED vs DIRECT counts and revenue
GET    /api/reports/overdue-invoices         Invoices past due_date and unpaid
```

### Export
```
GET    /api/export/products     .xlsx — all or filtered
GET    /api/export/clients      .xlsx
GET    /api/export/invoices     .xlsx
```
> Use `exceljs` with streaming (`xlsx.stream.write`) for large datasets — do not buffer entire dataset in memory.

### Settings
```
GET    /api/settings
PUT    /api/settings            Admin only
```

---

## 🧠 Business Logic — Critical Rules

### Stage Progression
- `DIRECT` products: `current_stage = null`, `status = COMPLETED` immediately on creation
- `STAGE_BASED` products start at `stage = 1`
- Stage can only move forward by exactly 1 (no skipping, no going back)
- When stage reaches 4 → automatically set `status = COMPLETED`
- Stage update must write a new record to `production_stage_logs`
- Stage update must write to `activity_logs`

### Invoice Generation
- `DIRECT` → can invoice immediately after product creation
- `STAGE_BASED` → can only invoice when `status = COMPLETED` (i.e., stage 4)
- Block duplicate invoice generation — check `billing_status !== 'NOT_GENERATED'`
- Auto-calculate on the server, never trust client-sent totals:
  ```
  subtotal   = quantity × price_per_unit
  gst_amount = subtotal × (gst_percentage / 100)
  total      = subtotal + gst_amount
  ```
- Pull `gst_percentage` from Settings at time of generation — store it on the invoice record so future settings changes don't alter historical invoices
- Set `due_date` = `issued_date + 30 days` (make this configurable in Settings)
- Update product's `billing_status` to `PENDING` after invoice generation

### Overdue Detection
- Run a scheduled job (cron, every 24h) that queries invoices where `status = PENDING` AND `due_date < today` → update to `OVERDUE`
- Also update corresponding product `billing_status` to `OVERDUE`

---

## 📁 Folder Structure

```
/src
  /config          db.js, env.js
  /models          User.js, Client.js, Product.js, Invoice.js,
                   StageLog.js, ActivityLog.js, Settings.js, Counter.js
  /controllers     auth.js, users.js, clients.js, products.js,
                   invoices.js, reports.js, export.js, settings.js
  /routes          (mirrors controllers)
  /middleware      auth.js, rbac.js, validate.js, errorHandler.js, logger.js
  /services        productCode.js, invoiceCalc.js, pdfGen.js, excelExport.js
  /jobs            overdueChecker.js
  /utils           response.js, paginate.js
  app.js
  server.js
.env
docker-compose.yml
Dockerfile
```

---

## 📦 Standard API Response Format

All responses must follow this shape:

```json
// Success
{
  "success": true,
  "message": "Product created successfully",
  "data": { ... }
}

// Paginated list
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 143,
    "pages": 8
  }
}

// Error
{
  "success": false,
  "message": "Stage cannot be updated beyond 4",
  "error_code": "INVALID_STAGE"
}
```

---

## 🚀 Deployment

- `Dockerfile` for the Node app
- `docker-compose.yml` with services: `api`, `mongo`, optional `mongo-express` for dev
- Environment variables via `.env` — never commit to git
- Separate `.env.development` and `.env.production`
- Use MongoDB Atlas for production or a self-hosted replica set (not standalone) for durability
- Enable MongoDB journaling
- Daily automated backup recommended (mongodump to S3 or similar)

---

## 🔮 Future-Proofing Rules

- Never hardcode `factory_id` — leave a `factory_id` field stub in Product and Client models even if unused now, so multi-factory expansion doesn't require schema migration
- Keep stage names (Stage 1–4) configurable — store them in Settings, don't hardcode labels
- Price fields should store currency code (`INR` by default) for future multi-currency support
- Barcode field stub in Product model (`barcode: String, default: null`) — costs nothing now, saves migration later