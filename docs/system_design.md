# LifeBridge Emergency Dispatch System — System Design Document

## 1. Executive Summary

LifeBridge is a backend-only emergency request and dispatch management system engineered using Node.js, Express, PostgreSQL, Redis, and AI priority classification. It models an emergency control center that ingests distress reports, automatically evaluates urgency levels, queues emergencies using Redis Sorted Sets, dispatches qualified responders, manages life-cycle status transitions, and broadcasts Pub/Sub event notifications.

---

## 2. High-Level System Architecture

```
                                  ┌───────────────────────────┐
                                  │      Client Applications  │
                                  │   (Postman / Web Client)  │
                                  └─────────────┬─────────────┘
                                                │ HTTP / REST
                                                ▼
                                  ┌───────────────────────────┐
                                  │   Express.js API Layer    │
                                  │ (Controllers & Routes)    │
                                  └──────┬─────────────┬──────┘
                                         │             │
                    ┌────────────────────┘             └────────────────────┐
                    ▼                                                       ▼
  ┌───────────────────────────────────┐                   ┌───────────────────────────────────┐
  │         Service Layer             │                   │      AI Integration Service       │
  │ (Emergency, Dispatch, Status)     │                   │  (Gemini API / Rule-Based Engine) │
  └──────┬────────────────────┬───────┘                   └───────────────────────────────────┘
         │                    │
         ▼                    ▼
┌──────────────────┐ ┌─────────────────────────┐
│ PostgreSQL (ORM) │ │ Redis Priority Queue    │
│  (Sequelize)     │ │ (Sorted Set ZSET)       │
└──────────────────┘ └───────────┬─────────────┘
                                 │
                                 ▼
                     ┌─────────────────────────┐
                     │ Redis Pub/Sub Event Bus │
                     └───────────┬─────────────┘
                                 │
                                 ▼
                     ┌─────────────────────────┐
                     │ Notification Subscriber │
                     └─────────────────────────┘
```

---

## 3. Entity-Relationship (ER) Diagram

```
+---------------+        1:N        +-------------------+        1:1        +------------------+
|     users     | ----------------> | emergency_requests| ----------------> | dispatch_records |
+---------------+                   +-------------------+                   +------------------+
| id (PK)       |                   | id (PK)           |                   | id (PK)          |
| name          |                   | user_id (FK)      |                   | request_id (FK)  |
| phone         |                   | location          |                   | responder_id (FK)|
| created_at    |                   | description       |                   | assigned_at      |
+---------------+                   | priority (ENUM)   |                   +------------------+
                                    | status (ENUM)     |                             ^
                                    | created_at        |                             |
                                    | updated_at        |                             | 1:N
                                    +-------------------+                   +------------------+
                                              |                             |    responders    |
                                              | 1:N                         +------------------+
                                              v                             | id (PK)          |
                                    +-------------------+                   | name             |
                                    |   notifications   |                   | responder_type   |
                                    +-------------------+                   | availability     |
                                    | id (PK)           |                   | current_location |
                                    | request_id (FK)   |                   +------------------+
                                    | responder_id (FK) |
                                    | message           |
                                    | created_at        |
                                    +-------------------+
```

---

## 4. Redis Queue & Event Architecture

### Priority Queue (Sorted Set: `emergency_priority_queue`)

Request priorities are mapped to numerical scores in Redis Sorted Set:

| Priority Class | Score | Sorted Set Operation |
|---|---|---|
| `CRITICAL` | 100 | `ZADD emergency_priority_queue 100 <request_id>` |
| `HIGH` | 75 | `ZADD emergency_priority_queue 75 <request_id>` |
| `MEDIUM` | 50 | `ZADD emergency_priority_queue 50 <request_id>` |
| `LOW` | 25 | `ZADD emergency_priority_queue 25 <request_id>` |

- **Retrieval:** Executing `ZREVRANGE emergency_priority_queue 0 -1 WITHSCORES` ensures `CRITICAL` incidents are processed first regardless of submission order.
- **Dequeuing:** When a responder is assigned, `ZREM emergency_priority_queue <request_id>` removes the request.

### Redis Pub/Sub Channels

| Channel Name | Trigger Point | Event Payload |
|---|---|---|
| `emergency_created` | `emergencyService.createEmergency` | `{ request_id, priority, timestamp }` |
| `responder_assigned` | `dispatchService.assignResponder` | `{ request_id, responder_id, timestamp }` |
| `status_updated` | `statusService.updateStatus` | `{ request_id, old_status, new_status, timestamp }` |
| `notification_sent` | `notificationService.sendNotification` | `{ request_id, responder_id, notification_id }` |

---

## 5. Lifecycle State Machine Diagram

```
             ┌──────────┐
             │ PENDING  │
             └────┬─────┘
                  │ Assign Responder
                  ▼
             ┌──────────┐
             │ ASSIGNED │
             └────┬─────┘
                  │ Dispatch Unit
                  ▼
             ┌────────────┐
             │ DISPATCHED │
             └────┬───────┘
                  │ Unit On Scene
                  ▼
             ┌─────────────┐
             │ IN_PROGRESS │
             └────┬────────┘
                  │ Incident Resolved
                  ▼
             ┌──────────┐
             │ RESOLVED │ (Releases Responder → AVAILABLE)
             └──────────┘
```

*Cancellation rule:* Any request in `PENDING`, `ASSIGNED`, `DISPATCHED`, or `IN_PROGRESS` can transition to `CANCELLED`.
