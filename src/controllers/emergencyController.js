const emergencyService    = require('../services/emergencyService');
const emergencyRepository = require('../repositories/emergencyRepository');
const statusService       = require('../services/statusService');
const queueService        = require('../redis/queueService');
const { success }         = require('../utils/response');
const { paginate, paginatedResponse } = require('../utils/paginate');

/**
 * POST /api/v1/emergency
 * Create a new emergency request.
 */
const createEmergency = async (req, res, next) => {
  try {
    const { user_id, location, description } = req.body;
    const data = await emergencyService.createEmergency({ user_id, location, description });
    return success(res, data, 'Emergency request created successfully', 201);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/emergency/pending?page=1&limit=10
 * Get all pending requests from Redis queue, ordered by priority.
 */
const getPendingRequests = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);

    // Fetch all entries from Redis sorted set (highest priority first)
    const queueEntries = await queueService.getPendingQueue();

    // Total from queue
    const total = queueEntries.length;

    // Paginate in-memory
    const pageEntries = queueEntries.slice(offset, offset + limit);

    // Fetch DB records for the paginated IDs
    const ids = pageEntries.map((e) => parseInt(e.value));
    const dbRecords = await emergencyRepository.findByIds(ids);

    // Merge Redis score into DB data and preserve priority order
    const scoreMap = {};
    pageEntries.forEach((e) => { scoreMap[e.value] = e.score; });

    const items = ids.map((id) => {
      const record = dbRecords.find((r) => r.id === id);
      if (!record) return null;
      return {
        request_id:  record.id,
        priority:    record.priority,
        score:       scoreMap[String(id)],
        location:    record.location,
        description: record.description,
        user:        record.user,
        created_at:  record.created_at,
      };
    }).filter(Boolean);

    return success(res, paginatedResponse(items, total, page, limit), 'Pending requests retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/v1/emergency/active?page=1&limit=10
 * Get all active emergency requests (ASSIGNED, DISPATCHED, IN_PROGRESS).
 */
const getActiveRequests = async (req, res, next) => {
  try {
    const { page, limit, offset } = paginate(req.query);
    const [records, total] = await Promise.all([
      emergencyRepository.findActive(limit, offset),
      emergencyRepository.countActive(),
    ]);

    const PRIORITY_ORDER = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
    const sorted = records.sort((a, b) => (PRIORITY_ORDER[a.priority] || 99) - (PRIORITY_ORDER[b.priority] || 99));

    const items = sorted.map((r) => ({
      request_id:         r.id,
      priority:           r.priority,
      status:             r.status,
      location:           r.location,
      description:        r.description,
      created_at:         r.created_at,
      updated_at:         r.updated_at,
      user:               r.user,
      assigned_responder: r.dispatch_record ? r.dispatch_record.responder : null,
    }));

    return success(res, paginatedResponse(items, total, page, limit), 'Active requests retrieved');
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/v1/emergency/status
 * Update emergency request status with transition validation.
 */
const updateStatus = async (req, res, next) => {
  try {
    const { request_id, status } = req.body;
    const data = await statusService.updateStatus(request_id, status);
    return success(res, data, 'Status updated successfully');
  } catch (err) {
    next(err);
  }
};

module.exports = { createEmergency, getPendingRequests, getActiveRequests, updateStatus };
