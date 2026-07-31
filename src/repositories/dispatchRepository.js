const { DispatchRecord, Responder } = require('../models');

const create = async (requestId, responderId) => {
  return DispatchRecord.create({
    request_id:   requestId,
    responder_id: responderId,
    assigned_at:  new Date(),
  });
};

const findByRequestId = async (requestId) => {
  return DispatchRecord.findOne({
    where: { request_id: requestId },
    include: [
      {
        model: Responder,
        as: 'responder',
        attributes: ['id', 'name', 'responder_type', 'current_location'],
      },
    ],
  });
};

module.exports = { create, findByRequestId };
