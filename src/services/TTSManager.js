const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    StreamType,
    entersState 
} = require('@discordjs/voice');
const emojiMap = require('emoji-name-map');
const axios = require('axios');

class TTSManager {
    constructor(guildId, textChannelId, voiceChannelId, client) {
        this.guildId = guildId;
        this.textChannelId = textChannelId;
        this.voiceChannelId = voiceChannelId;
        this.client = client;
        this.queue = [];
        this.isPlaying = false;

        // Establish the voice link parameters explicitly
        this.connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guildId,
            adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        // Core execution listener loops
        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.processQueue();
        });

        this.player.on('error', error => {
            console.error('LOG [TTS Streaming Exception]:', error.message);
            this.isPlaying = false;
            this.processQueue();
        });

        this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
            try {
                await Promise.race([
                    entersState(this.connection, VoiceConnectionStatus.Signalling, 5000),
                    entersState(this.connection, VoiceConnectionStatus.Connecting, 5000),
                ]);
            } catch (error) {
                this.destroy();
            }
        });
    }

    enqueue(message) {
        let cleanedContent = message.content.replace(/<@!?\d+>/g, '').trim();
        
        // Convert emojis into clean words
        cleanedContent = cleanedContent.replace(/[\u1F600-\u1F64F]/gu, (match) => {
            const mapLookup = emojiMap.get(match);
            return mapLookup ? ` ${mapLookup.replace(/:/g, '')} emoji ` : ' emoji ';
        });

        if (!cleanedContent) return;

        // Formulate standard natural reading string phrase: "Name ne kaha, message"
        const phrase = `${message.member.displayName} ne kaha, ${cleanedContent}`;
        
        // Segment longer strings into safe digestible chunks
        const chunks = phrase.length > 200 ? phrase.match(/[\s\S]{1,150}/g) || [] : [phrase];

        this.queue.push(...chunks);
        this.processQueue();
    }

    async processQueue() {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;
        const currentText = this.queue.shift();

        try {
            // Bulletproof, unrestricted streaming endpoint with custom headers mimicking standard browser requests
            const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(currentText)}&tl=hi&total=1&idx=0&textlen=${currentText.length}&client=tw-ob&ttsspeed=1`;

            const response = await axios({
                method: 'get',
                url: targetUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36'
                }
            });

            // Convert the response directly into an audio track stream framework
            const resource = createAudioResource(response.data, {
                inputType: StreamType.Arbitrary
            });

            this.player.play(resource);
        } catch (err) {
            console.error('TTS Engine streaming failed:', err.message);
            this.isPlaying = false;
            // Delay slightly before cycling to prevent system locking loops
            setTimeout(() => this.processQueue(), 1000);
        }
    }

    destroy() {
        this.queue = [];
        this.player.stop();
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            this.connection.destroy();
        }
        this.client.ttsManagers.delete(this.guildId);
    }
}

module.exports = TTSManager;
