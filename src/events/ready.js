const { ActivityType } = require('discord.js');
const PollService = require('../services/PollService');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`LOG: Logged in successfully as ${client.user.tag}`);
        client.user.setActivity('/poll & /mcstatus', { type: ActivityType.Listening });
        
        // Start Global background evaluation loops
        PollService.startUpdateLoop(client);
    },
};
