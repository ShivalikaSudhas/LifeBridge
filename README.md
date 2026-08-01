# LifeBridge — Emergency Request & Dispatch Management Backend

LifeBridge is a robust backend-only emergency response and dispatch management service built with **Node.js**, **Express**, **PostgreSQL**, **Redis**, and **AI Priority Classification (Gemini API / Rule-Engine)** following MVC architecture and event-driven design.

---

## 🚀 Features

- **Priority Classification:** AI-assisted (Gemini API) and keyword rule-based classification into `CRITICAL`, `HIGH`, `MEDIUM`, or `LOW`.
- **Redis Priority Queue:** Redis Sorted Set (`ZSET`) prioritizing critical emergencies first (`CRITICAL`=100, `HIGH`=75, `MEDIUM`=50, `LOW`=25).
- **Responder Dispatch:** Availability state checking (`AVAILABLE`, `BUSY`, `OFFLINE`) for responders (Ambulance, Fire, Police).
- **State Machine Workflow:** Lifecycle tracking (`PENDING` → `ASSIGNED` → `DISPATCHED` → `IN_PROGRESS` → `RESOLVED`). Automatic responder release on resolution.
- **Event-Driven Notifications:** Redis Pub/Sub channels broadcasting events in real time.
- **Pagination Support:** Built-in pagination on queue and active emergency lists.

---

## 🛠️ Prerequisites

- **Node.js** (v18+)
- **Docker & Docker Desktop** (or local PostgreSQL 16 + Redis 7 instances)

---

## 🐳 Setting up PostgreSQL and Redis with Docker

The easiest way to run PostgreSQL and Redis is using Docker Desktop:

### 1. Start Containers
Run the following command in the root directory:
```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** on port `5432` (`postgres:password@localhost:5432/emergency_db`)
- **Redis** on port `6379` (`redis://localhost:6379`)

### 2. Verify Containers
```bash
docker ps
```

### 3. Stop Containers
```bash
docker-compose down
```

---

## ⚙️ Installation & Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/ShivalikaSudhas/LifeBridge.git
   cd LifeBridge
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Ensure `.env` matches your database & Redis parameters:
   ```env
   PORT=3000
   DATABASE_URL=postgresql://postgres:password@localhost:5432/emergency_db
   REDIS_URL=redis://localhost:6379
   AI_SERVICE_URL=http://localhost:8000
   GEMINI_API_KEY=your_gemini_api_key_here
   NODE_ENV=development
   LOG_LEVEL=info
   ```

4. **Seed Sample Data (Optional for Testing):**
   Execute SQL seed queries or insert sample Users and Responders:
   ```sql
   INSERT INTO users (name, phone, created_at) VALUES 
   ('shivalika', '+919876543210', NOW()),
   ('vidyashree', '+919812345678', NOW());

   INSERT INTO responders (name, responder_type, availability, current_location, created_at) VALUES 
   ('Ambulance Unit 101', 'AMBULANCE', 'AVAILABLE', 'Central Station', NOW()),
   ('Fire Engine 5', 'FIRE', 'AVAILABLE', 'North Fire Station', NOW()),
   ('Patrol Car 12', 'POLICE', 'AVAILABLE', 'Downtown Precinct', NOW());
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```

   The server will sync Sequelize ORM models with PostgreSQL, connect to Redis, start the event subscriber thread, and listen on `http://localhost:3000`.

---

## 🧪 Running Unit Tests

Execute Jest API test suite:
```bash
npm test
```

---

## 📖 API Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/emergency` | Create emergency request & enqueue in Redis |
| `GET` | `/api/v1/emergency/pending` | Get pending emergency requests (sorted by Redis score, paginated) |
| `GET` | `/api/v1/emergency/active` | Get active emergency requests with responder info (paginated) |
| `PUT` | `/api/v1/emergency/status` | Update emergency status lifecycle |
| `POST` | `/api/v1/dispatch/assign` | Assign responder to request & update queue |
| `POST` | `/api/v1/dispatch/notify/:request_id` | Send dispatch notification & publish event |
| `POST` | `/api/v1/ai/classify` | AI urgency classification endpoint |
| `GET` | `/health` | Server health check endpoint |

---

## 📚 Documentation Links

- [API Documentation](docs/api_documentation.md)
- [System Design Document](docs/system_design.md)
