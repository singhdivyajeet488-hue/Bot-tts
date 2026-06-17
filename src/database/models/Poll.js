const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    guildId: { type: String, required: true },
    question: { type: String, required: true },
    options: [{
        text: String,
        votes: [String] // Array of User IDs
    }],
    endsAt: { type: Date, required: true },
    isActive: { type: Boolean, default: true }
});

module.exports = mongoose.model('Poll', pollSchema);
