module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot || !message.guild) return;

        const manager = client.ttsManagers.get(message.guild.id);
        if (manager && manager.textChannelId === message.channel.id) {
            manager.enqueue(message);
        }
    },
};
