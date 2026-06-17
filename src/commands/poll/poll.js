const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');
const Poll = require('../../database/models/Poll');
const PollService = require('../../services/PollService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a non-reaction dynamic button-based poll.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(o => o.setName('question').setDescription('The topic being evaluated').setRequired(true))
        .addStringOption(o => o.setName('option1').setDescription('First selectable option').setRequired(true))
        .addStringOption(o => o.setName('option2').setDescription('Second selectable option').setRequired(true))
        .addStringOption(o => o.setName('duration').setDescription('E.g. 1m, 5m, 1h, 24h').setRequired(true))
        .addStringOption(o => o.setName('option3').setDescription('Third optional selection'))
        .addStringOption(o => o.setName('option4').setDescription('Fourth optional selection'))
        .addStringOption(o => o.setName('option5').setDescription('Fifth optional selection')),

    async execute(interaction) {
        const question = interaction.options.getString('question');
        const durationStr = interaction.options.getString('duration');
        
        const rawOptions = [
            interaction.options.getString('option1'),
            interaction.options.getString('option2'),
            interaction.options.getString('option3'),
            interaction.options.getString('option4'),
            interaction.options.getString('option5')
        ].filter(Boolean);

        const allowedDurations = ['1m', '5m', '30m', '1h', '6h', '12h', '24h'];
        if (!allowedDurations.includes(durationStr)) {
            return interaction.reply({ content: `❌ Invalid duration structure. Choose either: ${allowedDurations.join(', ')}`, ephemeral: true });
        }

        const msCalculated = ms(durationStr);
        const endsAt = new Date(Date.now() + msCalculated);

        await interaction.deferReply();

        const newPollDoc = new Poll({
            messageId: 'PENDING',
            channelId: interaction.channelId,
            guildId: interaction.guildId,
            question: question,
            options: rawOptions.map(opt => ({ text: opt, votes: [] })),
            endsAt: endsAt,
            isActive: true
        });

        const placeholderEmbed = PollService.generateEmbed(newPollDoc);
        const placeholderComp = PollService.generateComponents(newPollDoc);

        const message = await interaction.editReply({ embeds: [placeholderEmbed], components: placeholderComp });
        
        newPollDoc.messageId = message.id;
        await newPollDoc.save();
    }
};
