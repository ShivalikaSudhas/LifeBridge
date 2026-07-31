const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DispatchRecord = sequelize.define('DispatchRecord', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  request_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'emergency_requests', key: 'id' },
  },
  responder_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'responders', key: 'id' },
  },
  assigned_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'dispatch_records',
  timestamps: false,
});

module.exports = DispatchRecord;
