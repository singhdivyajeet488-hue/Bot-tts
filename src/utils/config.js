require('dotenv').config();

module.exports = {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.CLIENT_ID,
    mongoUri: process.env.MONGODB_URI,
    embedColor: '#5865F2'
};
