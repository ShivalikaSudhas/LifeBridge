const { Notification } = require('../models');

const create = async (data) => {
  return Notification.create({
    request_id:   data.request_id,
    responder_id: data.responder_id || null,
    message:      data.message,
    created_at:   new Date(),
  });
};

const findByRequestId = async (requestId, limit, offset) => {
  return Notification.findAll({
    where: { request_id: requestId },
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });
};

const countByRequestId = async (requestId) => {
  return Notification.count({ where: { request_id: requestId } });
};

module.exports = { create, findByRequestId, countByRequestId };
