const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Fetches online specifications details for a specified Minecraft Java Server.')
        .addStringOption(o => o.setName('ip').setDescription('The Java target IP address string network location').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const ip = interaction.options.getString('ip');

        try {
            // Fetch raw server data from the open status API
            const res = await axios.get(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`);
            const data = res.data;

            if (!data.online) {
                const offlineEmbed = new EmbedBuilder()
                    .setTitle('🌐 Server Lookup Status')
                    .setColor('#FF5555')
                    .setDescription(`🌐 **Server IP:**\n\`${ip}\` *(Click to copy)*\n\n🟢 **Status:**\nOffline or Unreachable`)
                    .setTimestamp();
                return interaction.editReply({ embeds: [offlineEmbed] });
            }

            const motdClean = data.motd && data.motd.clean ? data.motd.clean.join('\n') : 'No description visible';
            const version = data.version ? data.version : 'Unknown';
            const onlinePlayers = data.players ? `${data.players.online} / ${data.players.max}` : '0 / 0';

            // Build embed output with copyable IP formatting and no TPS field
            const statusEmbed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${ip}\`\n\n` +
                    `🛠 **Version:**\n${version}\n\n` +
                    `👥 **Online Players:**\n${onlinePlayers}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${motdClean}\`\`\``
                )
                .setTimestamp();

            // Set the server favicon as the thumbnail if it exists
            if (data.icon) {
                statusEmbed.setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`);
            }

            await interaction.editReply({ embeds: [statusEmbed] });
        } catch (error) {
            console.error('Minecraft fetching layer exception context:', error);
            await interaction.editReply({ content: '❌ Could not pull statistics data tracking for this provided addressing context.' });
        }
    }
};
