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
const { Readable } = require('stream');

class TTSManager {
    constructor(guildId, textChannelId, voiceChannelId, client) {
        this.guildId = guildId;
        this.textChannelId = textChannelId;
        this.voiceChannelId = voiceChannelId;
        this.client = client;
        this.queue = [];
        this.isPlaying = false;

        this.connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guildId,
            adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.processQueue();
        });

        this.player.on('error', error => {
            console.error('LOG [TTS Player Error]:', error.message);
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
        
        // Convert emojis into clean readable terms
        cleanedContent = cleanedContent.replace(/[\u1F600-\u1F64F]/gu, (match) => {
            const mapLookup = emojiMap.get(match);
            return mapLookup ? ` ${mapLookup.replace(/:/g, '')} emoji ` : ' emoji ';
        });

        if (!cleanedContent) return;

        // "Rahul ne kaha, Hello" format
        const phrase = `${message.member.displayName} ne kaha, ${cleanedContent}`;
        
        // Split chunks smoothly if the sentence is excessively long
        const chunks = phrase.length > 200 ? phrase.match(/[\s\S]{1,150}/g) || [] : [phrase];

        this.queue.push(...chunks);
        this.processQueue();
    }

    async processQueue() {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;
        const currentText = this.queue.shift();

        try {
            // Fetch high-quality text synthesis from the free API stream pipeline
            const response = await axios.post('https://api.threads-coin.com/tts', {
                text: currentText,
                voice: 'en_us_001' // Crystal-clear voice engine that handles blended English/Hindi structures perfectly
            }, { timeout: 8000 });

            if (!response.data || !response.data.audio_base64) {
                throw new Error('Invalid audio data returned from API engine.');
            }

            // Convert the raw base64 string directly back into a readable Node stream buffer
            const audioBuffer = Buffer.from(response.data.audio_base64, 'base64');
            const stream = Readable.from(audioBuffer);

            const resource = createAudioResource(stream, {
                inputType: StreamType.Arbitrary
            });

            this.player.play(resource);
        } catch (err) {
            console.error('TTS Audio Stream processing error:', err.message);
            this.isPlaying = false;
            // Delay slightly before retrying the queue to prevent loop hammering on failure
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
