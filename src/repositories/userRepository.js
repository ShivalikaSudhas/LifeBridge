const { User } = require('../models');

const findById = async (id) => {
  return User.findByPk(id);
};

module.exports = { findById };
