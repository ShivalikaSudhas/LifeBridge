require('dotenv').config();
const { User, Responder } = require('../models');
const { sequelize } = require('../config/db');
const logger = require('../utils/logger');

async function seed() {
  try {
    await sequelize.sync();

    // 1. Create sample users
    const [user1] = await User.findOrCreate({
      where: { id: 1 },
      defaults: { name: 'shivalika', phone: '+919876543210' },
    });

    const [user2] = await User.findOrCreate({
      where: { id: 2 },
      defaults: { name: 'vidyashree', phone: '+919812345678' },
    });

    // 2. Create sample responders
    const [resp1] = await Responder.findOrCreate({
      where: { id: 1 },
      defaults: {
        name: 'Ambulance Unit 101',
        responder_type: 'AMBULANCE',
        availability: 'AVAILABLE',
        current_location: 'Central Station',
      },
    });

    const [resp2] = await Responder.findOrCreate({
      where: { id: 2 },
      defaults: {
        name: 'Fire Engine 5',
        responder_type: 'FIRE',
        availability: 'AVAILABLE',
        current_location: 'North Fire Station',
      },
    });

    logger.info(`Database seeded successfully! Created User #${user1.id} & #${user2.id}, Responder #${resp1.id} & #${resp2.id}`);
    process.exit(0);
  } catch (err) {
    logger.error(`Seed error: ${err.message}`);
    process.exit(1);
  }
}

seed();
