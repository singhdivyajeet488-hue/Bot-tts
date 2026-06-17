const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Fetches online details for a Minecraft Java Server with a live 30s auto-refresh loop.')
        .addStringOption(o => o.setName('ip').setDescription('The Java server IP address').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const ip = interaction.options.getString('ip');

        let countdown = 30;
        let serverData = null;

        // Helper function to fetch data through HTTP API with cache busting
        async function fetchLiveStatus() {
            try {
                // The dynamic timestamp variable (?cb=...) tells the server to bypass old saved caches
                const cacheBuster = Date.now();
                const res = await axios.get(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}?cb=${cacheBuster}`);
                serverData = res.data;
            } catch (error) {
                console.error('Error fetching Minecraft server status:', error.message);
                serverData = null;
            }
        }

        // Helper function to render the update Embed layout
        function buildEmbed() {
            if (!serverData || !serverData.online) {
                return new EmbedBuilder()
                    .setTitle('🌐 Server Lookup Status')
                    .setColor('#FF5555')
                    .setDescription(
                        `🌐 **Server IP:**\n\`${ip}\`\n\n` +
                        `🟢 **Status:**\nOffline or Unreachable\n\n` +
                        `🔄 **Refreshing in:** \`${countdown}s\``
                    )
                    .setTimestamp();
            }

            const motdClean = serverData.motd && serverData.motd.clean ? serverData.motd.clean.join('\n') : 'No description visible';
            const version = serverData.version ? serverData.version : 'Unknown';
            const onlinePlayers = serverData.players ? `${serverData.players.online} / ${serverData.players.max}` : '0 / 0';

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${ip}\`\n\n` +
                    `🛠 **Version:**\n${version}\n\n` +
                    `👥 **Online Players:**\n${onlinePlayers}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${motdClean.replace(/§[0-9a-fk-or]/g, '').trim()}\`\`\`\n` +
                    `🔄 **Next refresh in:** \`${countdown}s\``
                )
                .setTimestamp();

            if (serverData.icon) {
                embed.setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`);
            }

            return embed;
        }

        // Run initial pull
        await fetchLiveStatus();
        let currentEmbed = buildEmbed();
        await interaction.editReply({ embeds: [currentEmbed] });

        // Set up the internal 5-second ticking interval display loop
        const refreshInterval = setInterval(async () => {
            countdown -= 5;

            // When countdown reaches zero, fire a fresh request to the API web proxy
            if (countdown <= 0) {
                countdown = 30;
                await fetchLiveStatus();
            }

            try {
                const updatedEmbed = buildEmbed();
                // Edit the original message directly without sending a new one
                await interaction.editReply({ embeds: [updatedEmbed] });
            } catch (err) {
                if (err.code === 10008 || err.status === 404) {
                    clearInterval(refreshInterval);
                }
            }
        }, 5000); // Ticks visually every 5 seconds

        // Automatically kill the loop after 1 hour to prevent infinite resource leaks
        setTimeout(() => {
            clearInterval(refreshInterval);
        }, 3600000);
    }
};
