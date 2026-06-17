const { Client, GatewayIntentBits, Collection } = require('discord.js');
const config = require('./utils/config');
const connectDB = require('./database/mongoose');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

client.commands = new Collection();
client.ttsManagers = new Map(); // Dynamic mapping tracking guild voice channels

// Run Handlers
connectDB();
['commands', 'events'].forEach(handler => {
    require(`./handlers/${handler}`)(client);
});

client.login(config.token);
