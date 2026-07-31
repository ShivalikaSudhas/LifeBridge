const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const EmergencyRequest = sequelize.define('EmergencyRequest', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  location: {
    type: DataTypes.STRING(300),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  priority: {
    type: DataTypes.ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'ASSIGNED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'),
    defaultValue: 'PENDING',
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'emergency_requests',
  timestamps: false,
});

module.exports = EmergencyRequest;
