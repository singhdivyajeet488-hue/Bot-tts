const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mcStatus = require('mc-server-status');
const axios = require('axios');
const config = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Fetches real-time details for a Minecraft Java Server with a live 30s loop.')
        .addStringOption(o => o.setName('ip').setDescription('The Java server IP address').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const rawIp = interaction.options.getString('ip');

        const ipParts = rawIp.split(':');
        const host = ipParts[0];
        const port = ipParts[1] ? parseInt(ipParts[1], 10) : 25565;

        let countdown = 30;
        let serverData = null;
        let useFallback = false;

        // Helper function to fetch data via Direct Ping or Fallback API
        async function fetchLiveStatus() {
            try {
                if (!useFallback) {
                    // Method A: Direct real-time socket connection
                    const data = await mcStatus.getStatus(host, port);
                    if (data) {
                        serverData = {
                            online: true,
                            version: data.version?.name || 'Unknown',
                            players: { online: data.players.online, max: data.players.max },
                            motd: data.description?.text || (data.description?.extra ? data.description.extra.map(e => e.text).join('') : 'Online')
                        };
                        return;
                    }
                }
            } catch (error) {
                console.log('Direct ping failed, engaging live fallback pipeline...');
                useFallback = true;
            }

            // Method B: Fallback pipeline appending a cache-busting timestamp to bypass API caching
            try {
                const cacheBuster = Date.now();
                const res = await axios.get(`https://api.mcsrvstat.us/3/${encodeURIComponent(rawIp)}?cb=${cacheBuster}`);
                const data = res.data;

                if (data && data.online) {
                    serverData = {
                        online: true,
                        version: data.version || 'Unknown',
                        players: { online: data.players.online, max: data.players.max },
                        motd: data.motd?.clean ? data.motd.clean.join('\n') : 'Online'
                    };
                } else {
                    serverData = null;
                }
            } catch (fallbackError) {
                console.error('All Minecraft monitoring layers exhausted:', fallbackError.message);
                serverData = null;
            }
        }

        // Helper function to build the update embed structure
        function buildEmbed() {
            if (!serverData || !serverData.online) {
                return new EmbedBuilder()
                    .setTitle('🌐 Server Lookup Status')
                    .setColor('#FF5555')
                    .setDescription(
                        `🌐 **Server IP:**\n\`${rawIp}\`\n\n` +
                        `🟢 **Status:**\nOffline or Unreachable\n\n` +
                        `🔄 **Refreshing in:** \`${countdown}s\``
                    )
                    .setTimestamp();
            }

            const motdClean = serverData.motd.replace(/§[0-9a-fk-or]/g, '').trim();

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${rawIp}\`\n\n` +
                    `🛠 **Version:**\n${serverData.version}\n\n` +
                    `👥 **Online Players:**\n${serverData.players.online} / ${serverData.players.max}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${motdClean || 'Minecraft Server'}\`\`\`\n` +
                    `🔄 **Next refresh in:** \`${countdown}s\``
                )
                .setTimestamp();

            embed.setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(rawIp)}`);
            return embed;
        }

        // Run initial execution
        await fetchLiveStatus();
        let currentEmbed = buildEmbed();
        await interaction.editReply({ embeds: [currentEmbed] });

        // Run the 5-second ticking interval display loop
        const refreshInterval = setInterval(async () => {
            countdown -= 5;

            if (countdown <= 0) {
                countdown = 30;
                await fetchLiveStatus();
            }

            try {
                const updatedEmbed = buildEmbed();
                await interaction.editReply({ embeds: [updatedEmbed] });
            } catch (err) {
                if (err.code === 10008 || err.status === 404) {
                    clearInterval(refreshInterval);
                }
            }
        }, 5000);

        // Terminate monitoring thread after 1 hour to safeguard system runtime memory
        setTimeout(() => {
            clearInterval(refreshInterval);
        }, 3600000);
    }
};
