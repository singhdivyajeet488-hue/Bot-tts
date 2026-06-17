const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Terminates ongoing channel synthesis playback tracking sessions.'),
        
    async execute(interaction, client) {
        const manager = client.ttsManagers.get(interaction.guildId);
        if (!manager) {
            return interaction.reply({ content: '❌ Active voice state routing context processing maps targets do not show valid initialization vectors running here.', ephemeral: true });
        }

        manager.destroy();
        await interaction.reply({ content: '⏹️ Stopped active streaming tracks and disconnected successfully.' });
    }
};
