/**
 * Parses page and limit from query params.
 * Returns { page, limit, offset }
 */
const paginate = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

/**
 * Wraps data with pagination metadata.
 */
const paginatedResponse = (items, total, page, limit) => ({
  items,
  pagination: {
    total,
    total_pages: Math.ceil(total / limit),
    current_page: page,
    per_page: limit,
  },
});

module.exports = { paginate, paginatedResponse };
