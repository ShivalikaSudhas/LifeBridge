# LifeBridge Emergency Dispatch System — System Design Document

## 1. Executive Summary

LifeBridge is a backend-only emergency request and dispatch management system engineered using Node.js, Express, PostgreSQL, Redis, and AI priority classification. It models an emergency control center that ingests distress reports, automatically evaluates urgency levels, queues emergencies using Redis Sorted Sets, dispatches qualified responders, manages life-cycle status transitions, and broadcasts Pub/Sub event notifications.

---

## 2. High-Level System Architecture(vidya)

```
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                              CLIENT LAYER                                      │
 │                    Postman  ·  Web Client  ·  Mobile App                        │
 └───────────────────────────────────┬─────────────────────────────────────────────┘
                                     │ HTTP / REST (JSON)
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                              MIDDLEWARE LAYER                                   │
 │  ┌─────────────┐   ┌─────────────────┐   ┌──────────────┐   ┌──────────────┐  │
 │  │ express.json │   │ morgan (logger) │   │ Joi validate │   │ errorHandler │  │
 │  └─────────────┘   └─────────────────┘   └──────────────┘   └──────────────┘  │
 └───────────────────────────────────┬─────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                               ROUTE LAYER (src/routes/)                         │
 │  ┌───────────────┐  ┌──────────────┐  ┌───────────┐  ┌────────────────_─────┐  │
 │  │ emergency.js  │  │ dispatch.js  │  │  ai.js    │  │  aiV2.js (new)      │  │
 │  │ POST /        │  │ POST /assign │  │ POST /    │  │ POST /v2/triage     │  │
 │  │ GET  /pending │  │ POST /notify │  │  classify │  │ POST /v2/recommend  │  │
 │  │ GET  /active  │  │   /:id       │  └───────────┘  └─────────────────────┘  │
 │  │ PUT  /status  │  └──────────────┘                                           │
 │  └───────────────┘                          index.js  (mounts all routers)     │
 └───────────────────────────────────┬─────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                            CONTROLLER LAYER (src/controllers/)                  │
 │   ┌──────────────────────┐  ┌───────────────────┐  ┌────────────────────────┐  │
 │   │ emergencyController  │  │ dispatchController │  │ aiController           │  │
 │   │  .createEmergency    │  │  .assignResponder  │  │  .classifyPriority     │  │
 │   │  .getPendingRequests │  │  .sendNotification │  ├────────────────────────┤  │
 │   │  .getActiveRequests  │  └───────────────────┘  │ aiV2Controller         │  │
 │   │  .updateStatus       │                          │  .triageIncident       │  │
 │   └──────────────────────┘                          │  .recommendResponder   │  │
 │                                                     └────────────────────────┘  │
 └───────────────────────────────────┬─────────────────────────────────────────────┘
                                     │
                                     ▼
 ┌─────────────────────────────────────────────────────────────────────────────────┐
 │                             SERVICE LAYER (src/services/)                       │
 │   ┌───────────────────┐ ┌────────────────┐ ┌─────────────────────────────────┐ │
 │   │ emergencyService  │ │ dispatchService│ │ geminiService / keywordClassify │ │
 │   │  .createEmergency │ │ .assignRespond │ │ (AI priority classification)    │ │
 │   │  .classifyPriority│ │               er│ ├─────────────────────────────────┤ │
 │   ├───────────────────┤ ├────────────────┤ │ aiV2Service (V2 triage + rank)  │ │
 │   │ statusService     │ │ notifService   │ └─────────────────────────────────┘ │
 │   │  .updateStatus    │ │ .sendNotify    │                                     │
 │   └───────────────────┘ └────────────────┘                                     │
 └─────────┬──────────────────────────┬──────────────────────────────┬─────────────┘
           │                          │                              │
           ▼                          ▼                              ▼
 ┌───────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐
 │   REPOSITORY      │   │   REDIS LAYER         │   │   EVENT BUS              │
 │   LAYER           │   │   (src/redis/ +        │   │   (src/events/)          │
 │   (src/repos/)    │   │    src/config/redis)   │   │                          │
 │                   │   │                        │   │  ┌────────────────────┐  │
 │ userRepository    │   │  ┌──────────────────┐  │   │  │ publisher.js       │  │
 │ emergencyRepo     │   │  │ queueService.js  │  │   │  │  .publish(channel, │  │
 │ responderRepo     │   │  │  .addToQueue     │  │   │  │    payload)        │  │
 │ dispatchRepo      │   │  │  .removeFromQueue│  │   │  └────────┬───────────┘  │
 │ notificationRepo  │   │  │  .getPendingQueue│  │   │           │ PUBLISH      │
 │                   │   │  │  .getHighestPri  │  │   │           ▼              │
 │                   │   │  │  .getQueueLength │  │   │  ┌────────────────────┐  │
 │                   │   │  └──────────────────┘  │   │  │ subscriber.js      │  │
 │                   │   │                        │   │  │  .handleEvent      │  │
 │                   │   │                        │   │  │  .startSubscriber  │  │
 └────────┬──────────┘   └───────────────────────┘   │  └────────────────────┘  │
          │                                           └──────────────────────────┘
          ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │                         MODEL LAYER (src/models/)                             │
 │  ┌────────┐  ┌──────────────────┐  ┌───────────┐  ┌────────────┐  ┌───────┐ │
 │  │ User   │  │ EmergencyRequest │  │ Responder │  │ Dispatch   │  │Notif  │ │
 │  │        │  │                  │  │           │  │ Record     │  │ication│ │
 │  └────┬───┘  └────────┬─────────┘  └─────┬─────┘  └──────┬─────┘  └───┬───┘ │
 │       │               │                  │               │            │     │
 └───────┼───────────────┼──────────────────┼───────────────┼────────────┼─────┘
         │               │                  │               │            │
         ▼               ▼                  ▼               ▼            ▼
 ┌───────────────────────────────────────────────────────────────────────────────┐
 │                    DATABASE / DATA STORES                                     │
 │  ┌──────────────────────────────┐    ┌────────────────────────────────────┐   │
 │  │ PostgreSQL 16 (Docker)       │    │ Redis 7 (Docker)                   │   │
 │  │ Port: 5432                   │    │ Port: 6379                         │   │
 │  │ DB:   emergency_db           │    │                                    │   │
 │  │                              │    │ • Sorted Set (Priority Queue)      │   │
 │  │ Tables:                      │    │ • Pub/Sub Channels (4 channels)    │   │
 │  │  · users                     │    │                                    │   │
 │  │  · emergency_requests        │    └────────────────────────────────────┘   │
 │  │  · responders                │                                             │
 │  │  · dispatch_records          │                                             │
 │  │  · notifications             │                                             │
 │  └──────────────────────────────┘                                             │
 └───────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. MVC + Repository Layer Mapping

```
┌───────────────────────────────────────────────────────────────────────┐
│                        LAYER MAP                                      │
├───────────────┬──────────────────────┬────────────────────────────────┤
│ Layer         │ Directory            │ Files                          │
├───────────────┼──────────────────────┼────────────────────────────────┤
│ Config        │ src/config/          │ env.js, db.js, redis.js        │
│ Models        │ src/models/          │ User, EmergencyRequest,        │
│               │                      │ Responder, DispatchRecord,     │
│               │                      │ Notification, index.js         │
│ Repositories  │ src/repositories/    │ userRepo, emergencyRepo,       │
│               │                      │ responderRepo, dispatchRepo,   │
│               │                      │ notificationRepo               │
│ Services      │ src/services/        │ emergencyService, dispatch     │
│               │                      │ Service, statusService,        │
│               │                      │ notificationService,           │
│               │                      │ geminiService, keywordClass,   │
│               │                      │ aiV2Service                    │
│ Controllers   │ src/controllers/     │ emergencyController,           │
│               │                      │ dispatchController,            │
│               │                      │ aiController, aiV2Controller   │
│ Routes        │ src/routes/          │ emergency.js, dispatch.js,     │
│               │                      │ ai.js, aiV2.js, index.js       │
│ Middleware    │ src/middleware/       │ validate.js, errorHandler.js   │
│ Events        │ src/events/          │ publisher.js, subscriber.js    │
│ Redis Queue   │ src/redis/           │ queueService.js                │
│ Prompts       │ src/prompts/         │ priorityPrompt.js              │
│ Utils         │ src/utils/           │ logger.js, response.js,        │
│               │                      │ paginate.js                    │
│ Entry Point   │ (root)               │ server.js, src/app.js          │
└───────────────┴──────────────────────┴────────────────────────────────┘
```

**Request Flow:**
```
Client Request
      │
      ▼
  server.js  →  app.js  →  Middleware (JSON parse, Morgan log, Joi validate)
      │
      ▼
  routes/index.js  →  routes/{emergency|dispatch|ai|aiV2}.js
      │
      ▼
  controllers/{emergency|dispatch|ai|aiV2}Controller.js
      │
      ▼
  services/{emergency|dispatch|status|notification|gemini|keyword|aiV2}Service.js
      │
      ├──▶  repositories/{user|emergency|responder|dispatch|notification}Repository.js
      │          │
      │          ▼
      │      models/{User|EmergencyRequest|Responder|DispatchRecord|Notification}.js
      │          │
      │          ▼
      │      PostgreSQL (Sequelize ORM)
      │
      ├──▶  redis/queueService.js  →  Redis Sorted Set
      │
      └──▶  events/publisher.js  →  Redis Pub/Sub  →  events/subscriber.js
```

---

## 4. Entity-Relationship (ER) Diagram

```
 ┌──────────────────┐                                    ┌──────────────────┐
 │      users       │                                    │    responders    │
 ├──────────────────┤                                    ├──────────────────┤
 │ id (PK) INTEGER  │                                    │ id (PK) INTEGER  │
 │ name    VARCHAR   │──┐                          ┌─────│ name    VARCHAR   │
 │ phone   VARCHAR   │  │ 1:N                  1:N │     │ responder_type   │
 │ created_at DATE   │  │                          │     │ availability     │
 └──────────────────┘  │                          │     │  (ENUM)          │
                        │                          │     │ current_location │
                        ▼                          │     │ created_at DATE  │
 ┌──────────────────────────────────┐              │     └──────────────────┘
 │      emergency_requests          │              │              │
 ├──────────────────────────────────┤              │              │
 │ id (PK)       INTEGER            │              │              │
 │ user_id (FK → users.id)          │              │              │
 │ location      VARCHAR(300)       │              │              │
 │ description   TEXT               │     ┌────────┘              │
 │ priority      ENUM               │     │                       │
 │   (CRITICAL|HIGH|MEDIUM|LOW)     │     │                       │
 │ status        ENUM               │     │                       │
 │   (PENDING|ASSIGNED|DISPATCHED|  │     │                       │
 │    IN_PROGRESS|RESOLVED|         │     │                       │
 │    CANCELLED)                    │     │                       │
 │ created_at    DATE               │     │                       │
 │ updated_at    DATE               │     │                       │
 └────────┬─────────────┬───────────┘     │                       │
          │             │                 │                       │
          │ 1:1         │ 1:N             │                       │
          ▼             ▼                 │                       │
 ┌──────────────────┐  ┌──────────────────────────┐               │
 │ dispatch_records │  │     notifications         │               │
 ├──────────────────┤  ├──────────────────────────┤               │
 │ id (PK) INTEGER  │  │ id (PK) INTEGER           │               │
 │ request_id (FK)──┼──│ request_id (FK)            │               │
 │ responder_id(FK)─┼──│ responder_id (FK, nullable)│───────────────┘
 │ assigned_at DATE │  │ message     TEXT            │
 └──────────────────┘  │ created_at  DATE            │
          │            └──────────────────────────┘
          │
    FK → responders.id
```

### Relationship Summary

| Relationship | Type | FK Column | Description |
|---|---|---|---|
| `User` → `EmergencyRequest` | One-to-Many | `emergency_requests.user_id` | One user can file many emergencies |
| `EmergencyRequest` → `DispatchRecord` | One-to-One | `dispatch_records.request_id` | One request gets one dispatch assignment |
| `Responder` → `DispatchRecord` | One-to-Many | `dispatch_records.responder_id` | One responder handles many dispatches over time |
| `EmergencyRequest` → `Notification` | One-to-Many | `notifications.request_id` | One request generates many notification events |
| `Responder` → `Notification` | One-to-Many | `notifications.responder_id` | One responder receives many notifications (nullable) |

---

## 5. PostgreSQL — Tables, Columns & Sample Data

### Table: `users`
| Column | Type | Constraints | Example Value |
|---|---|---|---|
| `id` | INTEGER | PK, Auto-increment | `1` |
| `name` | VARCHAR(100) | NOT NULL | `"Ravi Kumar"` |
| `phone` | VARCHAR(20) | NOT NULL | `"+91-9876543210"` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | `2026-08-01 10:30:00` |

### Table: `emergency_requests`
| Column | Type | Constraints | Example Value |
|---|---|---|---|
| `id` | INTEGER | PK, Auto-increment | `1` |
| `user_id` | INTEGER | FK → `users.id`, NOT NULL | `1` |
| `location` | VARCHAR(300) | NOT NULL | `"MG Road, Bengaluru, Karnataka"` |
| `description` | TEXT | NOT NULL | `"Patient experiencing severe chest pain"` |
| `priority` | ENUM | NOT NULL (`CRITICAL\|HIGH\|MEDIUM\|LOW`) | `"CRITICAL"` |
| `status` | ENUM | NOT NULL, DEFAULT `'PENDING'` | `"PENDING"` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | `2026-08-01 10:31:00` |
| `updated_at` | TIMESTAMP | DEFAULT NOW() | `2026-08-01 10:31:00` |

### Table: `responders`
| Column | Type | Constraints | Example Value |
|---|---|---|---|
| `id` | INTEGER | PK, Auto-increment | `1` |
| `name` | VARCHAR(100) | NOT NULL | `"Ambulance Unit 7"` |
| `responder_type` | VARCHAR(50) | NOT NULL | `"AMBULANCE"` |
| `availability` | ENUM | NOT NULL, DEFAULT `'AVAILABLE'` | `"AVAILABLE"` |
| `current_location` | VARCHAR(200) | NULLABLE | `"Jayanagar, Bengaluru"` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | `2026-08-01 08:00:00` |

### Table: `dispatch_records`
| Column | Type | Constraints | Example Value |
|---|---|---|---|
| `id` | INTEGER | PK, Auto-increment | `1` |
| `request_id` | INTEGER | FK → `emergency_requests.id`, NOT NULL | `1` |
| `responder_id` | INTEGER | FK → `responders.id`, NOT NULL | `1` |
| `assigned_at` | TIMESTAMP | DEFAULT NOW() | `2026-08-01 10:33:00` |

### Table: `notifications`
| Column | Type | Constraints | Example Value |
|---|---|---|---|
| `id` | INTEGER | PK, Auto-increment | `1` |
| `request_id` | INTEGER | FK → `emergency_requests.id`, NOT NULL | `1` |
| `responder_id` | INTEGER | FK → `responders.id`, NULLABLE | `1` |
| `message` | TEXT | NOT NULL | `"Dispatch alert: Ambulance Unit 7 assigned..."` |
| `created_at` | TIMESTAMP | DEFAULT NOW() | `2026-08-01 10:33:05` |

---

## 6. Redis — Data Structures, Keys & Values

### 6.1 Priority Queue — Sorted Set

**Key:** `emergency_priority_queue`
**Type:** ZSET (Sorted Set)
**Purpose:** Orders pending emergencies by urgency score so CRITICAL incidents are dispatched first.

#### Score Mapping

| Priority Class | Numeric Score | Redis Command |
|---|---|---|
| `CRITICAL` | `100` | `ZADD emergency_priority_queue 100 "<request_id>"` |
| `HIGH` | `75` | `ZADD emergency_priority_queue 75 "<request_id>"` |
| `MEDIUM` | `50` | `ZADD emergency_priority_queue 50 "<request_id>"` |
| `LOW` | `25` | `ZADD emergency_priority_queue 25 "<request_id>"` |

#### Example Queue State (after 4 emergencies created)

```
Redis Key: emergency_priority_queue
Type:      ZSET

┌──────────────────────────────────────────────────────────────────────┐
│  Member (request_id)  │  Score  │  Meaning                          │
├───────────────────────┼─────────┼───────────────────────────────────┤
│  "3"                  │  100    │  Request #3 — CRITICAL priority   │
│  "1"                  │  75     │  Request #1 — HIGH priority       │
│  "4"                  │  50     │  Request #4 — MEDIUM priority     │
│  "2"                  │  25     │  Request #2 — LOW priority        │
└───────────────────────┴─────────┴───────────────────────────────────┘

Retrieval Order (ZREVRANGE → highest score first):
  #3 (CRITICAL=100)  →  #1 (HIGH=75)  →  #4 (MEDIUM=50)  →  #2 (LOW=25)
```

#### Redis Operations Used in Code

| Operation | Redis Command | When Used | Code Location |
|---|---|---|---|
| **Enqueue** | `ZADD emergency_priority_queue <score> <request_id>` | Emergency created | `queueService.addToQueue()` |
| **Dequeue** | `ZREM emergency_priority_queue <request_id>` | Responder assigned | `queueService.removeFromQueue()` |
| **Read All (sorted)** | `ZRANGE emergency_priority_queue 0 -1 REV WITHSCORES` | Get pending queue | `queueService.getPendingQueue()` |
| **Peek Top** | `ZRANGE emergency_priority_queue 0 0 REV` | Get highest priority | `queueService.getHighestPriority()` |
| **Count** | `ZCARD emergency_priority_queue` | Get queue length | `queueService.getQueueLength()` |

---

### 6.2 Pub/Sub — Event Channels

**Type:** Redis Pub/Sub (fire-and-forget messaging)
**Publisher:** `src/events/publisher.js` — publishes JSON payloads to channels
**Subscriber:** `src/events/subscriber.js` — listens on all 4 channels, logs events, persists Notification records

#### Channels & Event Payloads

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHANNEL: emergency_created                                                 │
│  Trigger: emergencyService.createEmergency()                                │
│  Payload:                                                                   │
│    {                                                                        │
│      "request_id": 1,                                                       │
│      "priority": "CRITICAL",                                                │
│      "timestamp": "2026-08-01T10:31:00.000Z"                                │
│    }                                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  CHANNEL: responder_assigned                                                │
│  Trigger: dispatchService.assignResponder()                                 │
│  Payload:                                                                   │
│    {                                                                        │
│      "request_id": 1,                                                       │
│      "responder_id": 2,                                                     │
│      "timestamp": "2026-08-01T10:33:00.000Z"                                │
│    }                                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  CHANNEL: status_updated                                                    │
│  Trigger: statusService.updateStatus()                                      │
│  Payload:                                                                   │
│    {                                                                        │
│      "request_id": 1,                                                       │
│      "old_status": "ASSIGNED",                                              │
│      "new_status": "DISPATCHED",                                            │
│      "timestamp": "2026-08-01T10:35:00.000Z"                                │
│    }                                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  CHANNEL: notification_sent                                                 │
│  Trigger: notificationService.sendNotification()                            │
│  Payload:                                                                   │
│    {                                                                        │
│      "request_id": 1,                                                       │
│      "responder_id": 2,                                                     │
│      "notification_id": 5,                                                  │
│      "timestamp": "2026-08-01T10:34:00.000Z"                                │
│    }                                                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Pub/Sub Architecture Flow

```
  Service Layer (Publisher)                    Subscriber (Background)
  ─────────────────────────                    ────────────────────────

  emergencyService ──┐
                     │    ┌──────────────┐      ┌───────────────────┐
  dispatchService  ──┼───▶│  publisher   │─────▶│   subscriber.js   │
                     │    │  .publish()  │      │   .handleEvent()  │
  statusService   ───┤    │              │      │                   │
                     │    │  Redis       │      │ • Logs event      │
  notifService    ───┘    │  PUBLISH cmd │      │ • Persists to     │
                          └──────────────┘      │   notifications   │
                                                │   table in PG     │
                                                └───────────────────┘

  Note: Subscriber uses a SEPARATE Redis client connection
        (Redis requires dedicated connections for SUBSCRIBE mode)
```

---

## 7. Emergency Lifecycle — State Machine Diagram(shiva)

```
                           ┌─────────────────────────────────────────┐
                           │          CANCELLATION RULE              │
                           │  Any active state → CANCELLED           │
                           │  (PENDING, ASSIGNED, DISPATCHED,        │
                           │   IN_PROGRESS)                          │
                           └─────────────────────────────────────────┘

 ╔══════════════════════════════════════════════════════════════════════════════╗
 ║                     EMERGENCY LIFECYCLE STATE MACHINE                       ║
 ╚══════════════════════════════════════════════════════════════════════════════╝

  ┌──────────────────┐    POST /emergency
  │                  │    (emergencyService.createEmergency)
  │     PENDING      │    • AI classifies priority
  │                  │    • Saved to PostgreSQL
  │  Initial State   │    • Enqueued in Redis ZSET
  │                  │    • Publishes "emergency_created"
  └────────┬─────────┘
           │
           │  POST /dispatch/assign
           │  (dispatchService.assignResponder)
           │    • Creates DispatchRecord
           │    • Responder → BUSY
           │    • ZREM from Redis queue
           │    • Publishes "responder_assigned"
           ▼
  ┌──────────────────┐
  │                  │
  │    ASSIGNED      │
  │                  │
  │  Responder       │
  │  Linked          │
  └────────┬─────────┘
           │
           │  PUT /emergency/status
           │  { status: "DISPATCHED" }
           │    • Publishes "status_updated"
           ▼
  ┌──────────────────┐
  │                  │
  │   DISPATCHED     │
  │                  │
  │  Unit En Route   │
  └────────┬─────────┘
           │
           │  PUT /emergency/status
           │  { status: "IN_PROGRESS" }
           │    • Publishes "status_updated"
           ▼
  ┌──────────────────┐
  │                  │
  │  IN_PROGRESS     │
  │                  │
  │  Unit On Scene   │
  └────────┬─────────┘
           │
           │  PUT /emergency/status
           │  { status: "RESOLVED" }
           │    • Responder → AVAILABLE (released)
           │    • Publishes "status_updated"
           ▼
  ┌──────────────────┐
  │                  │
  │    RESOLVED      │    ← Terminal State
  │                  │
  │  Case Closed     │
  └──────────────────┘


  ┌──────────────────┐
  │                  │
  │   CANCELLED      │    ← Terminal State (from any active state)
  │                  │
  └──────────────────┘
```

### Allowed Transitions Table

| Current Status | Allowed Next Status(es) | Triggered By |
|---|---|---|
| `PENDING` | `ASSIGNED`, `CANCELLED` | `/dispatch/assign` or `/emergency/status` |
| `ASSIGNED` | `DISPATCHED`, `CANCELLED` | `/emergency/status` |
| `DISPATCHED` | `IN_PROGRESS`, `CANCELLED` | `/emergency/status` |
| `IN_PROGRESS` | `RESOLVED`, `CANCELLED` | `/emergency/status` |
| `RESOLVED` | *(none — terminal)* | — |
| `CANCELLED` | *(none — terminal)* | — |

### Side Effects on Transition

| Transition | Side Effect |
|---|---|
| `PENDING → ASSIGNED` | `DispatchRecord` created, Responder → `BUSY`, request removed from Redis queue |
| `* → RESOLVED` | Assigned Responder released back to `AVAILABLE` |
| `* → CANCELLED` | No responder release (manual cleanup) |

---

## 8. Complete End-to-End Data Flow(shiva)

```
 ┌─────────────┐
 │ 1. Citizen   │──── POST /api/v1/emergency ────────────────────────┐
 │    calls 911 │     Body: { user_id, location, description }       │
 └─────────────┘                                                     │
                                                                      ▼
                                                     ┌────────────────────────────────┐
                                                     │  emergencyController           │
                                                     │    .createEmergency(req, res)  │
                                                     └──────────────┬─────────────────┘
                                                                    │
                              ┌──────────────────────────────────────┤
                              ▼                                     │
                   ┌─────────────────────┐                          │
                   │ AI Classification   │                          │
                   │ Gemini → Fallback   │                          │
                   │ → Rule Engine       │                          │
                   │                     │                          │
                   │ Returns: priority   │                          │
                   │ (CRITICAL/HIGH/     │                          │
                   │  MEDIUM/LOW)        │                          │
                   └──────────┬──────────┘                          │
                              │                                     │
                              ▼                                     ▼
              ┌───────────────────────────────────────────────────────────┐
              │  emergencyService.createEmergency()                       │
              │                                                           │
              │  Step 1: Validate user exists (userRepository.findById)   │
              │  Step 2: Classify priority (AI / rules)                   │
              │  Step 3: Save to PostgreSQL (emergencyRepository.create)  │
              │  Step 4: ZADD to Redis queue (queueService.addToQueue)    │
              │  Step 5: PUBLISH "emergency_created" event                │
              └───────────────────────────────────────────────────────────┘
                              │
                              ▼
         ┌──────────────────────────────────────────────────────┐
         │  PostgreSQL                   Redis                  │
         │  ┌───────────────────┐  ┌──────────────────────────┐│
         │  │ emergency_requests│  │ emergency_priority_queue  ││
         │  │ id=1, PENDING,    │  │ Member: "1", Score: 100   ││
         │  │ priority=CRITICAL │  │ (CRITICAL = 100)          ││
         │  └───────────────────┘  └──────────────────────────┘│
         └──────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌──────────────────────────────────────┐
              │ 2. Dispatcher views pending queue     │
              │    GET /api/v1/emergency/pending      │
              │    (Reads Redis ZREVRANGE)             │
              │    Returns sorted by score DESC        │
              └──────────────┬───────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────────────┐
              │ 3. Dispatcher assigns responder       │
              │    POST /api/v1/dispatch/assign        │
              │    { request_id: 1, responder_id: 1 } │
              │                                        │
              │    → Creates dispatch_records row      │
              │    → Responder.availability = "BUSY"   │
              │    → ZREM from Redis queue              │
              │    → Request.status = "ASSIGNED"        │
              │    → PUBLISH "responder_assigned"        │
              └──────────────┬───────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────────────┐
              │ 4. Notify responder                   │
              │    POST /api/v1/dispatch/notify/1      │
              │                                        │
              │    → Creates notifications row         │
              │    → PUBLISH "notification_sent"        │
              └──────────────┬───────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────────────┐
              │ 5-7. Lifecycle status updates          │
              │    PUT /api/v1/emergency/status         │
              │                                        │
              │  ASSIGNED → DISPATCHED                 │
              │  DISPATCHED → IN_PROGRESS              │
              │  IN_PROGRESS → RESOLVED                │
              │    (Releases responder → AVAILABLE)    │
              │                                        │
              │  Each publishes "status_updated"       │
              └────────────────────────────────────────┘
```

---

## 9. Docker Infrastructure

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: lifebridge_postgres
    ports: "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: emergency_db
    volumes: postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    container_name: lifebridge_redis
    ports: "6379:6379"
    volumes: redis_data:/data
```

### Environment Variables (`.env`)

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — |
| `REDIS_URL` | Redis connection URL | — |
| `AI_SERVICE_URL` | External AI classification endpoint | `http://localhost:8000` |
| `NODE_ENV` | Runtime environment | `development` |
| `LOG_LEVEL` | Winston log verbosity | `info` |

---

## 10. Startup Sequence

```
server.js
  │
  ├── 1. require('dotenv').config()          ← Load .env variables
  ├── 2. require('./src/app')               ← Build Express app
  │        ├── express.json()               ← Parse JSON bodies
  │        ├── morgan('dev')                ← HTTP request logging
  │        ├── routes (mount all routers)   ← Register API endpoints
  │        └── errorHandler middleware      ← Catch-all error handler
  │
  ├── 3. sequelize.sync({ alter: true })    ← Auto-migrate PostgreSQL tables
  ├── 4. startSubscriber()                  ← Start Redis Pub/Sub listener
  └── 5. app.listen(PORT)                   ← Begin accepting HTTP requests
```
