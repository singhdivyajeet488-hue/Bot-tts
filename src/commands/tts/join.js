const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const TTSManager = require('../../services/TTSManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Connects bot voice infrastructure to your channel monitoring localized context messages.'),
        
    async execute(interaction, client) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must sit inside a proper Voice Channel to invoke this routing command configuration.', ephemeral: true });
        }

        const botMember = interaction.guild.members.me;
        if (!voiceChannel.permissionsFor(botMember).has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
            return interaction.reply({ content: '❌ System lacks matching execution validation rights permissions `CONNECT`/`SPEAK` inside target connection segment.', ephemeral: true });
        }

        const manager = new TTSManager(interaction.guildId, interaction.channelId, voiceChannel.id, client);
        client.ttsManagers.set(interaction.guildId, manager);

        await interaction.reply({ content: `🎙️ Joined and bound interface system pipeline safely to tracking voice target: **${voiceChannel.name}** reading live channel context updates.` });
    }
};
