const { Responder } = require('../models');

const findById = async (id) => {
  return Responder.findByPk(id);
};

const updateAvailability = async (id, availability) => {
  const responder = await Responder.findByPk(id);
  if (!responder) return null;
  responder.availability = availability;
  await responder.save();
  return responder;
};

const findAllAvailable = async () => {
  return Responder.findAll({ where: { availability: 'AVAILABLE' } });
};

module.exports = { findById, updateAvailability, findAllAvailable };
