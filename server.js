require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/db');
const { startSubscriber } = require('./src/events/subscriber');
const logger = require('./src/utils/logger');
const env = require('./src/config/env');

const PORT = env.PORT || 3000;

async function startServer() {
  try {
    // 1. Sync database models with PostgreSQL
    await sequelize.sync({ alter: true });
    logger.info('Database synced successfully');

    // 2. Start Redis Pub/Sub event subscriber background thread
    await startSubscriber();

    // 3. Start Express server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
      logger.info(`Health check available at http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

startServer();
