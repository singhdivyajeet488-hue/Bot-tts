// Locate and bind static FFmpeg binary paths for cloud containers
const ffmpeg = require('ffmpeg-static');
process.env.FFMPEG_PATH = ffmpeg;

const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./utils/config');
const connectDB = require('./database/mongoose');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
client.ttsManagers = new Map();

// Run System Handlers
connectDB();
['commands', 'events'].forEach(handler => {
    require(`./handlers/${handler}`)(client);
});

client.login(config.token);
