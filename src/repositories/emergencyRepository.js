const { Op } = require('sequelize');
const { EmergencyRequest, DispatchRecord, Responder, User } = require('../models');

const ACTIVE_STATUSES = ['ASSIGNED', 'DISPATCHED', 'IN_PROGRESS'];

const create = async (data) => {
  return EmergencyRequest.create(data);
};

const findById = async (id) => {
  return EmergencyRequest.findByPk(id);
};

const findByIds = async (ids) => {
  if (!ids || ids.length === 0) return [];
  return EmergencyRequest.findAll({
    where: { id: { [Op.in]: ids } },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'phone'] }],
  });
};

const findActive = async (limit, offset) => {
  return EmergencyRequest.findAll({
    where: { status: { [Op.in]: ACTIVE_STATUSES } },
    include: [
      {
        model: DispatchRecord,
        as: 'dispatch_record',
        include: [
          {
            model: Responder,
            as: 'responder',
            attributes: ['id', 'name', 'responder_type', 'current_location'],
          },
        ],
      },
      { model: User, as: 'user', attributes: ['id', 'name', 'phone'] },
    ],
    order: [
      ['priority', 'ASC'], // CRITICAL < HIGH alphabetically, so we handle sorting in service
      ['created_at', 'ASC'],
    ],
    limit,
    offset,
  });
};

const countActive = async () => {
  return EmergencyRequest.count({
    where: { status: { [Op.in]: ACTIVE_STATUSES } },
  });
};

const updateStatus = async (id, status) => {
  const request = await EmergencyRequest.findByPk(id);
  if (!request) return null;
  request.status = status;
  request.updated_at = new Date();
  await request.save();
  return request;
};

module.exports = {
  create,
  findById,
  findByIds,
  findActive,
  countActive,
  updateStatus,
};
