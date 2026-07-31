const User = require('./User');
const Responder = require('./Responder');
const EmergencyRequest = require('./EmergencyRequest');
const DispatchRecord = require('./DispatchRecord');
const Notification = require('./Notification');

// User → EmergencyRequest (one-to-many)
User.hasMany(EmergencyRequest, { foreignKey: 'user_id', as: 'emergency_requests' });
EmergencyRequest.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// EmergencyRequest → DispatchRecord (one-to-one)
EmergencyRequest.hasOne(DispatchRecord, { foreignKey: 'request_id', as: 'dispatch_record' });
DispatchRecord.belongsTo(EmergencyRequest, { foreignKey: 'request_id', as: 'emergency_request' });

// Responder → DispatchRecord (one-to-many)
Responder.hasMany(DispatchRecord, { foreignKey: 'responder_id', as: 'dispatch_records' });
DispatchRecord.belongsTo(Responder, { foreignKey: 'responder_id', as: 'responder' });

// EmergencyRequest → Notification (one-to-many)
EmergencyRequest.hasMany(Notification, { foreignKey: 'request_id', as: 'notifications' });
Notification.belongsTo(EmergencyRequest, { foreignKey: 'request_id', as: 'emergency_request' });

// Responder → Notification (one-to-many, nullable)
Responder.hasMany(Notification, { foreignKey: 'responder_id', as: 'notifications' });
Notification.belongsTo(Responder, { foreignKey: 'responder_id', as: 'responder' });

module.exports = { User, Responder, EmergencyRequest, DispatchRecord, Notification };
