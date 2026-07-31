const Joi = require('joi');

const validate = (schema, source = 'body') => (req, res, next) => {
  const data = source === 'body' ? req.body : req.params;
  const { error } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    const messages = error.details.map((d) => d.message).join('; ');
    return res.status(400).json({ success: false, message: messages, data: null });
  }
  next();
};

// ── Emergency Schemas ──────────────────────────────────────────────
const createEmergencySchema = Joi.object({
  user_id:     Joi.number().integer().positive().required().messages({
    'any.required': 'user_id is required',
    'number.base':  'user_id must be a number',
  }),
  location:    Joi.string().min(3).max(300).required().trim().messages({
    'any.required':   'location is required',
    'string.min':     'location must be at least 3 characters',
  }),
  description: Joi.string().min(10).max(1000).required().trim().messages({
    'any.required': 'description is required',
    'string.min':   'description must be at least 10 characters',
  }),
});

// ── Dispatch Schemas ───────────────────────────────────────────────
const assignResponderSchema = Joi.object({
  request_id:   Joi.number().integer().positive().required(),
  responder_id: Joi.number().integer().positive().required(),
});

const updateStatusSchema = Joi.object({
  request_id: Joi.number().integer().positive().required(),
  status:     Joi.string()
    .valid('PENDING', 'ASSIGNED', 'DISPATCHED', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED')
    .required()
    .messages({ 'any.only': 'status must be one of: PENDING, ASSIGNED, DISPATCHED, IN_PROGRESS, RESOLVED, CANCELLED' }),
});

// ── AI Schema ─────────────────────────────────────────────────────
const classifySchema = Joi.object({
  description: Joi.string().min(5).max(1000).required().trim(),
});

module.exports = {
  validate,
  createEmergencySchema,
  assignResponderSchema,
  updateStatusSchema,
  classifySchema,
};
