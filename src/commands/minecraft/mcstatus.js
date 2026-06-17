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

        let cacheData = null;
        let lastFetchTime = 0;
        let countdown = 30;

        // Helper function to fetch data safely with a 30-second API cache shield
        async function getServerData() {
            const now = Date.now();
            if (!cacheData || (now - lastFetchTime) >= 30000) {
                try {
                    const res = await axios.get(`https://api.mcsrvstat.us/3/${encodeURIComponent(ip)}`);
                    cacheData = res.data;
                    lastFetchTime = now;
                } catch (error) {
                    console.error('Error fetching Minecraft server status:', error);
                    // Keep old cache if the API errors out temporarily
                }
            }
            return cacheData;
        }

        // Helper function to render the updated Embed layout
        async function buildEmbed(data) {
            if (!data || !data.online) {
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

            const motdClean = data.motd && data.motd.clean ? data.motd.clean.join('\n') : 'No description visible';
            const version = data.version ? data.version : 'Unknown';
            const onlinePlayers = data.players ? `${data.players.online} / ${data.players.max}` : '0 / 0';

            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setDescription(
                    `🌐 **Server IP:**\n\`${ip}\`\n\n` +
                    `🛠 **Version:**\n${version}\n\n` +
                    `👥 **Online Players:**\n${onlinePlayers}\n\n` +
                    `🟢 **Status:**\nOnline\n\n` +
                    `📜 **MOTD:**\n\`\`\`${motdClean}\`\`\`\n` +
                    `🔄 **Next refresh in:** \`${countdown}s\``
                )
                .setTimestamp();

            if (data.icon) {
                embed.setThumbnail(`https://api.mcsrvstat.us/icon/${encodeURIComponent(ip)}`);
            }

            return embed;
        }

        // Initial launch execution
        let serverData = await getServerData();
        let currentEmbed = await buildEmbed(serverData);
        const mainMessage = await interaction.editReply({ embeds: [currentEmbed] });

        // Set up the internal 5-second ticking interval loop
        const refreshInterval = setInterval(async () => {
            countdown -= 5;

            // When countdown reaches zero, force a reload and reset timer parameters
            if (countdown <= 0) {
                countdown = 30;
            }

            try {
                // Fetch status (uses internal 30s check to hit API or pull cached state)
                serverData = await getServerData();
                const updatedEmbed = await buildEmbed(serverData);

                // Edit the original message directly without sending a new one
                await interaction.editReply({ embeds: [updatedEmbed] });
            } catch (err) {
                // If the message was deleted by a user or moderator, clear the interval loop safely
                if (err.code === 10008 || err.status === 404) {
                    clearInterval(refreshInterval);
                } else {
                    console.error('Failed to update live mcstatus loop:', err.message);
                }
            }
        }, 5000); // Ticks every 5 seconds

        // Automatically kill the loop after 1 hour to prevent infinite resource leaks on your server
        setTimeout(() => {
            clearInterval(refreshInterval);
        }, 3600000);
    }
};
