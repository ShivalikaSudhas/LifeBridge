# LifeBridge Emergency Dispatch System — Implementation Deep Dive Sheet

This document provides a comprehensive technical breakdown of **WHAT** is implemented, **HOW** it functions, **WHY** specific design patterns/technologies were selected over alternatives, and an exhaustive list of **all files, functions, and modules**.

---

## SECTION 1: ARCHITECTURAL DECISIONS & TECHNOLOGY CHOICES (WHY & WHAT)

### 1. Architectural Pattern: Model-View-Controller (MVC) + Repository Layer
- **What:** Separation of concerns into Config ➔ Models ➔ Repositories ➔ Services ➔ Controllers ➔ Routes ➔ Middleware.
- **Why MVC + Repository Layer instead of monolithic single-file script or direct database calls in controllers?**
  - **Single Responsibility Principle (SRP):** Controllers only handle HTTP requests/responses. Services handle business logic. Repositories handle database SQL queries.
  - **Maintainability & Testability:** Enables mocking repositories in unit tests without touching a real database.
  - **No Duplicate Logic:** Service methods can be reused across HTTP endpoints, background event subscribers, and CLI seed scripts.

---

### 2. Backend Runtime & Framework: Node.js + Express.js
- **What:** Event-driven asynchronous I/O runtime (`Node.js` v18+) with `Express.js` web framework.
- **Why Node.js + Express over Python FastAPI or Java Spring Boot?**
  - **Asynchronous Non-Blocking I/O:** Ideal for high-concurrency emergency dispatch systems receiving multiple simultaneous requests.
  - **Single Programming Language (JavaScript):** Allows full-stack JavaScript integration across backend, database ORM, and frontend components.
  - **Lightweight & Fast Startup:** Express has minimal overhead and instant restart times with `nodemon`.

---

### 3. Primary Relational Database: PostgreSQL + Sequelize ORM
- **What:** PostgreSQL relational database managed via Sequelize Object-Relational Mapping (ORM).
- **Why PostgreSQL over MongoDB / MySQL / NoSQL?**
  - **ACID Compliance & Financial/Safety Integrity:** Emergency records, dispatch assignments, and user profiles require strict ACID transaction guarantees.
  - **Foreign Key Constraints:** Prevents orphan records (e.g. cannot assign a responder to a non-existent emergency request).
  - **Enum Types:** Native PostgreSQL ENUM types enforce strict database-level constraints on status (`PENDING`, `ASSIGNED`, `DISPATCHED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`) and priority (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- **Why Sequelize ORM over raw SQL queries?**
  - **Auto Schema Sync (`sequelize.sync({ alter: true })`):** Automatically creates/alters tables on server startup.
  - **SQL Injection Defense:** Sequelize automatically parametrizes all SQL queries.
  - **Association Loading:** Built-in `.findAll({ include: [...] })` makes fetching nested relationships effortless.

---

### 4. Queue Management: Redis Sorted Set (ZSET)
- **What:** Redis in-memory data store using Sorted Sets (`ZSET`) named `emergency_priority_queue`.
- **Why Redis Sorted Sets over Redis List (`LPUSH`/`RPOP`), RabbitMQ, or SQS?**
  - **Priority-Based Score Ordering:** Standard queues (FIFO) process items in order of arrival. In an emergency control room, a `CRITICAL` cardiac arrest submitted 5 minutes later MUST be dispatched before a `LOW` priority cut submitted earlier.
  - **Numerical Scoring System:**
    - `CRITICAL` = Score 100
    - `HIGH` = Score 75
    - `MEDIUM` = Score 50
    - `LOW` = Score 25
  - **Instant O(log N) Priority Sorting:** `ZREVRANGE emergency_priority_queue 0 -1 WITHSCORES` instantly retrieves the highest urgency request regardless of insertion order.
  - **Instant O(1) Dequeuing:** `ZREM emergency_priority_queue <request_id>` removes dispatched incidents immediately.

---

### 5. Event-Driven System: Redis Pub/Sub
- **What:** Real-time publish/subscribe message bus listening on `emergency_created`, `responder_assigned`, `status_updated`, and `notification_sent`.
- **Why Redis Pub/Sub over Apache Kafka or WebSockets?**
  - **Zero Storage Overhead:** Pub/Sub messages are delivered instantly in-memory without persistent disk queue bloat.
  - **Decoupled Architecture:** When an emergency status changes, `statusService.js` simply emits `publish('status_updated', payload)`. The background subscriber (`subscriber.js`) handles notification creation and logging asynchronously without blocking the API response time.

---

### 6. Input Validation: Joi Middleware
- **What:** Schema validation middleware (`validate.js`) attached to API routes.
- **Why Joi over Zod or manual `if (!req.body.name)` statements?**
  - **Centralized Validation Rules:** Keeps controllers clean of repetitive `if/else` checks.
  - **Automatic Field Stripping (`stripUnknown: true`):** Sanitizes incoming requests against malicious parameter injection.
  - **Standardized Error Formatting:** Transforms validation failures into clean `400 Bad Request` JSON responses before hitting controllers.

---

## SECTION 2: FILE-BY-FILE & FUNCTION-BY-FUNCTION BREAKDOWN

```
emergency-dispatch-backend/
├── server.js                          ← Application Entry Point
├── package.json                       ← NPM dependencies & scripts
├── docker-compose.yml                 ← Container orchestration
├── .env / .env.example                ← Environment variables
├── postman_api_guidance.txt           ← Plaintext API testing guide
├── src/
│   ├── app.js                         ← Express application setup
│   ├── config/
│   │   ├── env.js                     ← Dotenv loader
│   │   ├── db.js                      ← Sequelize connection
│   │   └── redis.js                   ← Redis client connection
│   ├── models/
│   │   ├── User.js                    ← User ORM model
│   │   ├── Responder.js               ← Responder ORM model
│   │   ├── EmergencyRequest.js        ← Emergency Request ORM model
│   │   ├── DispatchRecord.js          ← Dispatch Record ORM model
│   │   ├── Notification.js            ← Notification ORM model
│   │   └── index.js                   ← Associations & relationships
│   ├── middleware/
│   │   ├── validate.js                ← Joi request validator
│   │   └── errorHandler.js            ← Global error handler
│   ├── utils/
│   │   ├── logger.js                  ← Winston logging utility
│   │   ├── response.js                ← Standardized JSON response helper
│   │   └── paginate.js                ← Offset pagination helper
│   ├── redis/
│   │   └── queueService.js            ← Redis ZSET operations
│   ├── events/
│   │   ├── publisher.js               ← Redis Pub/Sub publisher
│   │   └── subscriber.js              ← Background event subscriber thread
│   ├── repositories/
│   │   ├── userRepository.js          ← User DB queries
│   │   ├── responderRepository.js     ← Responder DB queries
│   │   ├── emergencyRepository.js     ← Emergency Request DB queries
│   │   ├── dispatchRepository.js      ← Dispatch Record DB queries
│   │   └── notificationRepository.js  ← Notification DB queries
│   ├── services/
│   │   ├── emergencyService.js        ← Emergency creation & priority logic
│   │   ├── statusService.js           ← State machine transition logic
│   │   ├── dispatchService.js         ← Responder assignment logic
│   │   ├── notificationService.js     ← Notification generation logic
│   │   ├── geminiService.js           ← Google Gemini AI integration
│   │   └── keywordClassifier.js       ← Rule-based fallback classifier
│   ├── controllers/
│   │   ├── emergencyController.js     ← Emergency request HTTP handlers
│   │   ├── dispatchController.js      ← Dispatch HTTP handlers
│   │   └── aiController.js            ← AI priority HTTP handler
│   ├── routes/
│   │   ├── emergency.js               ← Emergency API route definitions
│   │   ├── dispatch.js                ← Dispatch API route definitions
│   │   ├── ai.js                      ← AI API route definitions
│   │   └── index.js                   ← Router index mount
│   └── db/
│       └── seed.js                    ← Seed script for sample DB data
└── tests/
    ├── emergency.test.js              ← Emergency API unit tests
    ├── dispatch.test.js               ← Dispatch API unit tests
    └── queue.test.js                  ← Priority Queue unit tests
```

---

### 🟢 1. Server Entry & Express App

#### File: `server.js`
- **What:** Root entry point of the server application.
- **Function `startServer()`:**
  - Calls `sequelize.sync({ alter: true })` to sync ORM models with PostgreSQL tables.
  - Calls `startSubscriber()` to initialize the background Redis Pub/Sub thread.
  - Starts Express HTTP server listening on `PORT` (3000).

#### File: `src/app.js`
- **What:** Express application setup module.
- **Middlewares loaded:** `express.json()`, `morgan('dev')`.
- **Routes mounted:** `/api/v1` ➔ `routes/index.js`, `/health` ➔ Health check route.
- **Global Error Handler:** `app.use(errorHandler)`.

---

### 🔵 2. Configuration & Utilities

#### File: `src/config/env.js`
- **What:** Centralized environment variable accessor loading `.env` via `dotenv`.

#### File: `src/config/db.js`
- **What:** Instantiates Sequelize connection with PostgreSQL database pool (max 10 connections).

#### File: `src/config/redis.js`
- **What:** Connects to Redis server at `REDIS_URL` with event listeners for `connect` and `error`.

#### File: `src/utils/logger.js`
- **What:** Winston logger configuration formatting logs with timestamps: `[YYYY-MM-DD HH:mm:ss] LEVEL: message`.

#### File: `src/utils/response.js`
- **Function `success(res, data, message, statusCode)`:** Standardizes JSON response: `{ success: true, message, data }`.
- **Function `error(res, message, statusCode, data)`:** Standardizes JSON error: `{ success: false, message, data }`.

#### File: `src/utils/paginate.js`
- **Function `paginate(query)`:** Parses `page` and `limit` from request query parameters, returning `{ page, limit, offset }`.
- **Function `paginatedResponse(items, total, page, limit)`:** Wraps items with pagination metadata `{ items, pagination: { total, total_pages, current_page, per_page } }`.

---

### 🟡 3. Database ORM Models & Relationships

#### Files: `src/models/*.js`
- **`User.js`:** Represents citizens filing emergency requests (`id`, `name`, `phone`, `created_at`).
- **`Responder.js`:** Represents emergency response units (`id`, `name`, `responder_type`, `availability` ENUM: `AVAILABLE`, `BUSY`, `OFFLINE`, `current_location`).
- **`EmergencyRequest.js`:** Represents incidents (`id`, `user_id`, `location`, `description`, `priority` ENUM: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `status` ENUM: `PENDING`, `ASSIGNED`, `DISPATCHED`, `IN_PROGRESS`, `RESOLVED`, `CANCELLED`).
- **`DispatchRecord.js`:** Maps requests to assigned responders (`id`, `request_id`, `responder_id`, `assigned_at`).
- **`Notification.js`:** Event notification log (`id`, `request_id`, `responder_id`, `message`, `created_at`).
- **`src/models/index.js`:** Defines ORM relationships:
  - `User 1:N EmergencyRequest`
  - `EmergencyRequest 1:1 DispatchRecord`
  - `Responder 1:N DispatchRecord`
  - `EmergencyRequest 1:N Notification`

---

### 🔴 4. Redis Queue & Event System

#### File: `src/redis/queueService.js`
- **Function `addToQueue(requestId, priority)`:** Maps priority to score (`CRITICAL`=100, `HIGH`=75, `MEDIUM`=50, `LOW`=25) and executes `zAdd('emergency_priority_queue', [{ score, value }])`.
- **Function `removeFromQueue(requestId)`:** Executes `zRem('emergency_priority_queue', requestId)`.
- **Function `getPendingQueue()`:** Executes `zRangeWithScores('emergency_priority_queue', 0, -1, { REV: true })` to return highest priority items first.

#### File: `src/events/publisher.js`
- **Function `publish(channel, payload)`:** Serializes payload to JSON and publishes to named Redis channel.

#### File: `src/events/subscriber.js`
- **Function `startSubscriber()`:** Opens dedicated Redis subscriber connection, subscribes to `emergency_created`, `responder_assigned`, `status_updated`, and `notification_sent` channels, and automatically creates a `Notification` record in PostgreSQL.

---

### 🟣 5. Repositories (Data Access Layer)

- **`userRepository.js`:** `findById(id)`
- **`responderRepository.js`:** `findById(id)`, `updateAvailability(id, availability)`, `findAllAvailable()`
- **`emergencyRepository.js`:** `create(data)`, `findById(id)`, `findByIds(ids)`, `findActive(limit, offset)`, `countActive()`, `updateStatus(id, status)`
- **`dispatchRepository.js`:** `create(requestId, responderId)`, `findByRequestId(requestId)`
- **`notificationRepository.js`:** `create(data)`, `findByRequestId(requestId, limit, offset)`, `countByRequestId(requestId)`

---

### 🟧 6. Services (Business Logic Layer)

#### File: `src/services/emergencyService.js`
- **Function `createEmergency({ user_id, location, description })`:**
  1. Validates user existence.
  2. Classifies priority via Gemini AI / Keyword classifier.
  3. Creates record in PostgreSQL with status `PENDING`.
  4. Enqueues request ID into Redis Sorted Set.
  5. Publishes `emergency_created` event.

#### File: `src/services/statusService.js`
- **Function `updateStatus(requestId, newStatus)`:**
  1. Validates state transitions using `ALLOWED_TRANSITIONS` map:
     - `PENDING ➔ ASSIGNED, CANCELLED`
     - `ASSIGNED ➔ DISPATCHED, CANCELLED`
     - `DISPATCHED ➔ IN_PROGRESS, CANCELLED`
     - `IN_PROGRESS ➔ RESOLVED, CANCELLED`
  2. If `newStatus === 'RESOLVED'`, releases the assigned responder back to `AVAILABLE`.
  3. Updates status in DB and publishes `status_updated` event.

#### File: `src/services/dispatchService.js`
- **Function `assignResponder(requestId, responderId)`:**
  1. Validates request exists and is `PENDING`.
  2. Validates responder exists and is `AVAILABLE`.
  3. Creates `DispatchRecord`.
  4. Updates request status to `ASSIGNED`.
  5. Updates responder availability to `BUSY`.
  6. Removes request from Redis Priority Queue.
  7. Publishes `responder_assigned` event.

#### File: `src/services/notificationService.js`
- **Function `sendNotification(requestId)`:** Creates notification record for assigned dispatch and publishes `notification_sent` event.

#### File: `src/services/geminiService.js` & `keywordClassifier.js`
- Integrates Google Gemini API (`@google/genai`) for smart NLP priority classification with keyword rule-engine fallback (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).

---

### 🟫 7. Controllers & Routes (API Layer)

- **`emergencyController.js` & `routes/emergency.js`:**
  - `POST /api/v1/emergency` ➔ `createEmergency`
  - `GET /api/v1/emergency/pending` ➔ `getPendingRequests`
  - `GET /api/v1/emergency/active` ➔ `getActiveRequests`
  - `PUT /api/v1/emergency/status` ➔ `updateStatus`
- **`dispatchController.js` & `routes/dispatch.js`:**
  - `POST /api/v1/dispatch/assign` ➔ `assignResponder`
  - `POST /api/v1/dispatch/notify/:request_id` ➔ `sendNotification`
- **`aiController.js` & `routes/ai.js`:**
  - `POST /api/v1/ai/classify` ➔ `classifyPriority`

---

## SECTION 3: END-TO-END DATA FLOW SUMMARY

```
1. Citizen Submits Request (POST /api/v1/emergency)
   │
   ├── Joi Validation (middleware/validate.js)
   ├── User Check (userRepository.js)
   ├── Priority Classification (geminiService.js / keywordClassifier.js)
   ├── DB Save (emergencyRepository.js -> status: PENDING)
   ├── Priority Queue Enqueue (queueService.js -> Redis ZSET Score)
   └── Publish Event (publisher.js -> channel: emergency_created)
   
2. Dispatcher Views Queue (GET /api/v1/emergency/pending)
   │
   └── Reads Redis ZSET (queueService.js -> Sorted by Score DESC)
   
3. Dispatcher Assigns Unit (POST /api/v1/dispatch/assign)
   │
   ├── Check Responder Availability (responderRepository.js -> must be AVAILABLE)
   ├── Create Dispatch Record (dispatchRepository.js)
   ├── Update Status -> ASSIGNED (emergencyRepository.js)
   ├── Update Responder -> BUSY (responderRepository.js)
   ├── Dequeue from Redis (queueService.js -> zRem)
   └── Publish Event (publisher.js -> channel: responder_assigned)

4. Progress Tracking (PUT /api/v1/emergency/status)
   │
   ├── Validate State Transition (statusService.js)
   ├── Update Status -> DISPATCHED / IN_PROGRESS / RESOLVED
   ├── If RESOLVED -> Release Responder (responderRepository.js -> AVAILABLE)
   └── Publish Event (publisher.js -> channel: status_updated)
```
