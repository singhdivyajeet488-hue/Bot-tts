const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const config = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Fetches true live details for a Minecraft Server with a 30s auto-refresh loop.')
        .addStringOption(o => o.setName('ip').setDescription('The Java server IP address').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const ip = interaction.options.getString('ip');

        let countdown = 30;
        let serverData = null;

        async function fetchLiveStatus() {
            try {
                // Minetools hits the server directly without aggressive 5-minute cache limits
                const res = await axios.get(`https://api.minetools.eu/ping/${encodeURIComponent(ip)}`, { timeout: 7000 });
                
                if (res.data && !res.data.error) {
                    serverData = {
                        online: true,
                        version: res.data.version.name,
                        players: { online: res.data.players.online, max: res.data.players.max },
                        motd: typeof res.data.description === 'string' ? res.data.description : (res.data.description.text || 'Online')
                    };
                } else {
                    serverData = null;
                }
            } catch (error) {
                console.error('Minetools lookup failed, testing backup route:', error.message);
                serverData = null;
            }
        }

        function buildEmbed() {
            if (!serverData) {
                return new EmbedBuilder()
                    .setTitle('🌐 Server Lookup Status')
                    .setColor('#FF5555')
                    .setDescription(`🌐 **Server IP:**\n\`${ip}\`\n\n🟢 **Status:**\nOffline or Unreachable\n\n🔄 **Refreshing in:** \`${countdown}s\``)
                    .setTimestamp();
            }

            const cleanMotd = serverData.motd.replace(/§[0-9a-fk-or]/g, '').trim();

            return new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${ip}\`\n\n` +
                    `🛠 **Version:**\n${serverData.version}\n\n` +
                    `👥 **Online Players:**\n${serverData.players.online} / ${serverData.players.max}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${cleanMotd || 'Minecraft Server'}\`\`\`\n` +
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
                await fetchLiveStatus(); // Pulls live, un-cached data straight from the network
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
