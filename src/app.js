const express = require('express');
const morgan = require('morgan');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(express.json());
app.use(morgan('dev'));

// Mount API routes
app.use('/api/v1', routes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', timestamp: new Date().toISOString() });
});

// Centralized error handling middleware
app.use(errorHandler);

module.exports = app;
