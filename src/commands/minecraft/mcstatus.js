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

        // Force an completely un-cached, isolated API lookup
        async function fetchLiveStatus() {
            try {
                const response = await axios({
                    method: 'get',
                    url: `https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`,
                    params: { cb: Date.now() }, // Cache-busting parameter
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    },
                    timeout: 8000
                });
                serverData = response.data;
            } catch (error) {
                console.error('Error fetching Minecraft server status:', error.message);
                serverData = null;
            }
        }

        function buildEmbed() {
            if (!serverData || !serverData.online) {
                return new EmbedBuilder()
                    .setTitle('🌐 Server Lookup Status')
                    .setColor('#FF5555')
                    .setDescription(`🌐 **Server IP:**\n\`${ip}\`\n\n🟢 **Status:**\nOffline or Unreachable\n\n🔄 **Refreshing in:** \`${countdown}s\``)
                    .setTimestamp();
            }

            const motdClean = serverData.motd && serverData.motd.clean ? serverData.motd.clean.join('\n') : 'No description visible';
            const version = serverData.version ? serverData.version : 'Unknown';
            const onlinePlayers = serverData.players ? `${serverData.players.online} / ${serverData.players.max}` : '0 / 0';

            return new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${ip}\`\n\n` +
                    `🛠 **Version:**\n${version}\n\n` +
                    `👥 **Online Players:**\n${onlinePlayers}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${motdClean.replace(/§[0-9a-fk-or]/g, '').trim()}\`\`\`\n` +
                    `🔄 **Next refresh in:** \`${countdown}s\``
                )
                .setTimestamp()
                .setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`);
        }

        await fetchLiveStatus();
        await interaction.editReply({ embeds: [buildEmbed()] });

        const refreshInterval = setInterval(async () => {
            countdown -= 5;

            if (countdown <= 0) {
                countdown = 30;
                await fetchLiveStatus(); // Pulls live fresh API data
            }

            try {
                await interaction.editReply({ embeds: [buildEmbed()] });
            } catch (err) {
                if (err.code === 10008 || err.status === 404) {
                    clearInterval(refreshInterval);
                }
            }
        }, 5000);

        setTimeout(() => clearInterval(refreshInterval), 3600000);
    }
};
