const PollService = require('../services/PollService');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            try {
                await command.execute(interaction, client);
            } catch (error) {
                console.error(`Command Error details [${interaction.commandName}]:`, error);
                const replyOpts = { content: 'An unexpected internal processing anomaly was caught executing this.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(replyOpts);
                } else {
                    await interaction.reply(replyOpts);
                }
            }
        } else if (interaction.isButton()) {
            if (interaction.customId.startsWith('poll_vote_')) {
                await PollService.handleVote(interaction);
            }
        }
    },
};
