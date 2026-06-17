const { REST, Routes } = require('discord.js');
const config = require('../utils/config');
const fs = require('fs');
const path = require('path');

module.exports = (client) => {
    const commands = [];
    const foldersPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        
        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
                commands.push(command.data.toJSON());
            }
        }
    }

    const rest = new REST().setToken(config.token);

    (async () => {
        try {
            console.log(`LOG: Refreshing ${commands.length} slash commands.`);
            await rest.put(
                Routes.applicationCommands(config.clientId),
                { body: commands },
            );
            console.log('LOG: Reloaded slash application (/) commands.');
        } catch (error) {
            console.error(error);
        }
    })();
};
