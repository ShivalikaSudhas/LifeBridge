const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Responder = sequelize.define('Responder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  responder_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'e.g. AMBULANCE, FIRE, POLICE',
  },
  availability: {
    type: DataTypes.ENUM('AVAILABLE', 'BUSY', 'OFFLINE'),
    defaultValue: 'AVAILABLE',
    allowNull: false,
  },
  current_location: {
    type: DataTypes.STRING(200),
    allowNull: true,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'responders',
  timestamps: false,
});

module.exports = Responder;
