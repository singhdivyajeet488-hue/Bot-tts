const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const mcStatus = require('mc-server-status');
const config = require('../../utils/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcstatus')
        .setDescription('Fetches true real-time details for a Minecraft Java Server with a live 30s loop.')
        .addStringOption(o => o.setName('ip').setDescription('The Java server IP address (e.g., play.hypixel.net or localhost)').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const rawIp = interaction.options.getString('ip');

        // Split ports if a user appends one (e.g. server.com:25565), default to standard 25565
        const ipParts = rawIp.split(':');
        const host = ipParts[0];
        const port = ipParts[1] ? parseInt(ipParts[1], 10) : 25565;

        let countdown = 30;
        let serverData = null;

        // Helper function to connect directly to the Minecraft server port via Ping protocol
        async function fetchLiveStatus() {
            try {
                // Directly queries the server instance in real-time with zero middleman API caching
                serverData = await mcStatus.getStatus(host, port);
            } catch (error) {
                console.error(`Direct Minecraft ping failed for ${host}:${port} ->`, error.message);
                serverData = null; // Server is offline or unreachable
            }
        }

        // Helper function to compile the Embed layout
        function buildEmbed() {
            if (!serverData) {
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

            // Parse clean text out of the dynamic components returned by the server ping
            const version = serverData.version && serverData.version.name ? serverData.version.name : 'Unknown';
            const onlinePlayers = `${serverData.players.online} / ${serverData.players.max}`;
            
            // Clean up description/MOTD structures safely
            let motdClean = 'No description visible';
            if (serverData.description) {
                if (typeof serverData.description === 'string') {
                    motdClean = serverData.description;
                } else if (serverData.description.text) {
                    motdClean = serverData.description.text;
                } else if (serverData.description.extra) {
                    motdClean = serverData.description.extra.map(e => e.text).join('');
                }
            }
            // Strip out classic old color codes like §c, §l, etc.
            motdClean = motdClean.replace(/§[0-9a-fk-or]/g, '').trim();

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${rawIp}\`\n\n` +
                    `🛠 **Version:**\n${version}\n\n` +
                    `👥 **Online Players:**\n${onlinePlayers}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${motdClean || 'Minecraft Server'}\`\`\`\n` +
                    `🔄 **Next refresh in:** \`${countdown}s\``
                )
                .setTimestamp();

            // Use the public favicon asset pipeline so your specific server icon thumbnail still loads
            embed.setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(rawIp)}`);

            return embed;
        }

        // Run the first direct connection fetch and output the embed frame
        await fetchLiveStatus();
        let currentEmbed = buildEmbed();
        await interaction.editReply({ embeds: [currentEmbed] });

        // Run the 5-second ticking refresh display interval loop
        const refreshInterval = setInterval(async () => {
            countdown -= 5;

            if (countdown <= 0) {
                countdown = 30;
                // Hit the server's port directly on every 30th second boundary
                await fetchLiveStatus();
            }

            try {
                const updatedEmbed = buildEmbed();
                // Edit the original message directly without sending a new one
                await interaction.editReply({ embeds: [updatedEmbed] });
            } catch (err) {
                // Automatically shut down loop execution tracking if the channel or message is gone
                if (err.code === 10008 || err.status === 404) {
                    clearInterval(refreshInterval);
                } else {
                    console.error('Failed to update live direct mcstatus loop:', err.message);
                }
            }
        }, 5000);

        // Protect your application memory container from holding the network hook open indefinitely (1 hour ceiling)
        setTimeout(() => {
            clearInterval(refreshInterval);
        }, 3600000);
    }
};
