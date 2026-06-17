const mongoose = require('mongoose');
const config = require('../utils/config');

module.exports = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('LOG: Connected to MongoDB safely.');
    } catch (error) {
        console.error('ERROR: Database connection failed:', error);
        process.exit(1);
    }
};
