const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, time } = require('discord.js');
const Poll = require('../database/models/Poll');
const config = require('../utils/config');

class PollService {
    static generateEmbed(poll) {
        const totalVotes = poll.options.reduce((acc, opt) => acc + opt.votes.length, 0);
        
        let desc = `### ${poll.question}\n\n`;
        poll.options.forEach((opt, idx) => {
            desc += `🔘 **Option ${idx + 1}**: ${opt.text} — **${opt.votes.length}** Votes\n`;
        });

        const statusString = poll.isActive 
            ? `⏳ Ends: ${time(poll.endsAt, 'R')}` 
            : `🛑 **Poll Concluded**`;

        const embed = new EmbedBuilder()
            .setTitle('📊 Poll Active')
            .setDescription(desc)
            .setColor(config.embedColor)
            .addFields(
                { name: 'Status', value: statusString, inline: true },
                { name: '👥 Total Votes', value: `${totalVotes}`, inline: true }
            );

        if (!poll.isActive) {
            let maxVotes = -1;
            let winners = [];
            poll.options.forEach(opt => {
                if (opt.votes.length > maxVotes) {
                    maxVotes = opt.votes.length;
                    winners = [opt.text];
                } else if (opt.votes.length === maxVotes && maxVotes > 0) {
                    winners.push(opt.text);
                }
            });

            const winnersText = maxVotes > 0 ? winners.join(', ') : 'No votes casted.';
            embed.setTitle('📊 Poll Closed')
                 .addFields({ name: '🏆 Winner(s)', value: `**${winnersText}**`, inline: false });
        }

        return embed;
    }

    static generateComponents(poll) {
        const row = new ActionRowBuilder();
        poll.options.forEach((opt, idx) => {
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`poll_vote_${idx}`)
                    .setLabel(`Option ${idx + 1}`)
                    .setStyle(ButtonStyle.Primary)
                    .setDisabled(!poll.isActive)
            );
        });
        return [row];
    }

    static async handleVote(interaction) {
        await interaction.deferUpdate();
        const optionIdx = parseInt(interaction.customId.replace('poll_vote_', ''), 10);
        const userId = interaction.user.id;

        const poll = await Poll.findOne({ messageId: interaction.message.id });
        if (!poll || !poll.isActive) return;

        // Strip previous selections
        poll.options.forEach(opt => {
            const index = opt.votes.indexOf(userId);
            if (index > -1) opt.votes.splice(index, 1);
        });

        // Apply new vote selection
        poll.options[optionIdx].votes.push(userId);
        await poll.save();

        const embed = this.generateEmbed(poll);
        await interaction.editReply({ embeds: [embed] });
    }

    static startUpdateLoop(client) {
        setInterval(async () => {
            try {
                const expiredPolls = await Poll.find({ endsAt: { $lte: new Date() }, isActive: true });
                for (const poll of expiredPolls) {
                    poll.isActive = false;
                    await poll.save();

                    const guild = client.guilds.cache.get(poll.guildId);
                    if (!guild) continue;
                    const channel = guild.channels.cache.get(poll.channelId);
                    if (!channel) continue;

                    try {
                        const message = await channel.messages.fetch(poll.messageId);
                        if (message) {
                            const closedEmbed = this.generateEmbed(poll);
                            const closedComp = this.generateComponents(poll);
                            await message.edit({ embeds: [closedEmbed], components: closedComp });
                        }
                    } catch (err) {
                        console.error(`Couldn't conclude message execution tracking for message ID ${poll.messageId}:`, err);
                    }
                }
            } catch (error) {
                console.error("Poll checking worker runtime exception:", error);
            }
        }, 15000); // Scans database intervals every 15 seconds
    }
}

module.exports = PollService;
