# LifeBridge Emergency Dispatch System — API Documentation

## Base URL
`http://localhost:3000/api/v1`

## 📋 API Overview Summary

| # | Endpoint | Method | Purpose | Redis Interaction | DB Models |
|---|---|---|---|---|---|
| **1** | `/api/v1/emergency` | `POST` | Create emergency & auto-assign priority | Enqueues into Sorted Set | `User`, `EmergencyRequest` |
| **2** | `/api/v1/emergency/pending` | `GET` | Retrieve pending queue sorted by priority | Reads Sorted Set (`ZREVRANGE`) | `EmergencyRequest`, `User` |
| **3** | `/api/v1/dispatch/assign` | `POST` | Assign responder to pending request | Removes from Sorted Set (`ZREM`) | `DispatchRecord`, `Responder` |
| **4** | `/api/v1/emergency/status` | `PUT` | Update state lifecycle status | Publishes `status_updated` event | `EmergencyRequest`, `Responder` |
| **5** | `/api/v1/emergency/active` | `GET` | Get ongoing emergencies & responders | — | `EmergencyRequest`, `DispatchRecord` |
| **6** | `/api/v1/dispatch/notify/:request_id` | `POST` | Trigger dispatch notification event | Publishes `notification_sent` event | `Notification`, `DispatchRecord` |
| **7** | `/api/v1/ai/classify` | `POST` | Classify incident urgency priority | — | — |
| **8** | `/health` | `GET` | Check server and runtime health | — | — |

---


## 1. Create Emergency Request

Creates a new emergency request, auto-classifies urgency priority (via Gemini AI / keyword rule-engine), persists to PostgreSQL, enqueues in Redis Priority Queue, and publishes an `emergency_created` event.

- **URL:** `/emergency`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`

### Request Body
```json 
{
  "user_id": 1,
  "location": "MG Road, Bengaluru, Karnataka",
  "description": "Patient experiencing severe chest pain and difficulty breathing"
}
```

| Field | Type | Validation | Description |
|---|---|---|---|
| `user_id` | Integer | Required, Positive | ID of citizen filing emergency |
| `location` | String | Required, Min 3, Max 300 | Detailed physical location |
| `description` | String | Required, Min 10, Max 1000 | Incident narrative for classification |

### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Emergency request created successfully",
  "data": {
    "request_id": 1,
    "priority": "CRITICAL",
    "status": "PENDING",
    "created_at": "2026-07-31T12:00:00.000Z"
  }
}
```

### Error Responses
- `400 Bad Request`: Missing fields or description under 10 characters
- `404 Not Found`: `user_id` does not exist in database

---

## 2. Get Pending Requests (Priority Queue)

Fetches pending emergency requests sorted by priority (highest score first) from Redis Sorted Set (`CRITICAL`=100, `HIGH`=75, `MEDIUM`=50, `LOW`=25) with pagination support.

- **URL:** `/emergency/pending?page=1&limit=10`
- **Method:** `GET`
- **Query Parameters:**
  - `page` (optional, default: `1`)
  - `limit` (optional, default: `10`, max: `100`)

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Pending requests retrieved",
  "data": {
    "items": [
      {
        "request_id": 1,
        "priority": "CRITICAL",
        "score": 100,
        "location": "MG Road, Bengaluru",
        "description": "Patient experiencing severe chest pain...",
        "user": {
          "id": 1,
          "name": "John Doe",
          "phone": "+919876543210"
        },
        "created_at": "2026-07-31T12:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "total_pages": 1,
      "current_page": 1,
      "per_page": 10
    }
  }
}
```

---

## 3. Assign Responder

Assigns an available emergency responder (Ambulance, Fire, Police) to a pending request, updates responder status to `BUSY`, updates request status to `ASSIGNED`, removes request from Redis queue, and publishes `responder_assigned` event.

- **URL:** `/dispatch/assign`
- **Method:** `POST`

### Request Body
```json
{
  "request_id": 1,
  "responder_id": 3
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Responder assigned successfully",
  "data": {
    "request_id": 1,
    "responder_id": 3,
    "status": "ASSIGNED",
    "assigned_at": "2026-07-31T12:05:00.000Z"
  }
}
```

### Error Responses
- `400 Bad Request`: Request is not in `PENDING` state
- `404 Not Found`: Request or Responder ID not found
- `409 Conflict`: Responder availability is `BUSY` or `OFFLINE`

---

## 4. Update Request Status

Updates request lifecycle state enforcing strict state machine transitions.

Allowed Transitions:
- `PENDING` → `ASSIGNED`, `CANCELLED`
- `ASSIGNED` → `DISPATCHED`, `CANCELLED`
- `DISPATCHED` → `IN_PROGRESS`, `CANCELLED`
- `IN_PROGRESS` → `RESOLVED`, `CANCELLED`

*Note: Transitioning to `RESOLVED` automatically releases the assigned responder back to `AVAILABLE`.*

- **URL:** `/emergency/status`
- **Method:** `PUT`

### Request Body
```json
{
  "request_id": 1,
  "status": "DISPATCHED"
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Status updated successfully",
  "data": {
    "request_id": 1,
    "status": "DISPATCHED",
    "updated_at": "2026-07-31T12:10:00.000Z"
  }
}
```

---

## 5. Get Active Requests

Retrieves all active emergency requests (`ASSIGNED`, `DISPATCHED`, `IN_PROGRESS`) with assigned responder details and pagination.

- **URL:** `/emergency/active?page=1&limit=10`
- **Method:** `GET`

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Active requests retrieved",
  "data": {
    "items": [
      {
        "request_id": 1,
        "priority": "CRITICAL",
        "status": "DISPATCHED",
        "location": "MG Road, Bengaluru",
        "description": "Patient experiencing severe chest pain...",
        "assigned_responder": {
          "id": 3,
          "name": "Unit 102 Ambulance",
          "responder_type": "AMBULANCE",
          "current_location": "Central Hub"
        }
      }
    ],
    "pagination": {
      "total": 1,
      "total_pages": 1,
      "current_page": 1,
      "per_page": 10
    }
  }
}
```

---

## 6. Dispatch Notification

Triggers real-time dispatch notification for assigned emergency requests. Creates a notification record and publishes `notification_sent` event.

- **URL:** `/dispatch/notify/:request_id`
- **Method:** `POST`

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Dispatch notification sent successfully",
  "data": {
    "notification_id": 1,
    "request_id": 1,
    "responder_id": 3,
    "message": "Dispatch alert: Responder Unit 102 Ambulance assigned to request #1 — CRITICAL priority at MG Road, Bengaluru",
    "created_at": "2026-07-31T12:06:00.000Z"
  }
}
```

---

## 7. AI Priority Classification

Classifies emergency urgency using Gemini AI microservice / keyword rule-engine fallback.

- **URL:** `/ai/classify`
- **Method:** `POST`

### Request Body
```json
{
  "description": "Building fire reported on second floor with trapped occupants"
}
```

### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Priority classified successfully",
  "data": {
    "priority": "CRITICAL",
    "confidence": 0.98,
    "method": "ai_model"
  }
}
```
