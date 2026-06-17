const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus,
    StreamType,
    entersState 
} = require('@discordjs/voice');
const googleTTS = require('google-tts-api');
const emojiMap = require('emoji-name-map');

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
        });

        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.processQueue();
        });

        // Debug logging to track player state transitions in your console logs
        this.player.on('stateChange', (oldState, newState) => {
            console.log(`LOG [TTS Player]: Transitioned from ${oldState.status} to ${newState.status}`);
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
        
        // Convert emojis into clean textual labels
        cleanedContent = cleanedContent.replace(/[\u1F600-\u1F64F]/gu, (match) => {
            const mapLookup = emojiMap.get(match);
            return mapLookup ? ` ${mapLookup.replace(/:/g, '')} emoji ` : ' emoji ';
        });

        if (!cleanedContent) return;

        // Structure a clean reading string phrase
        const phrase = `${message.member.displayName} ne kaha, ${cleanedContent}`;
        const chunks = phrase.length > 200 ? phrase.match(/[\s\S]{1,180}/g) || [] : [phrase];

        this.queue.push(...chunks);
        this.processQueue();
    }

    async processQueue() {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;
        const currentText = this.queue.shift();

        try {
            const url = googleTTS.getAudioUrl(currentText, {
                lang: 'hi-IN',
                slow: false,
                host: 'https://translate.google.com',
                timeout: 10000,
            });

            // FIX: Explicitly pass StreamType.Arbitrary so FFmpeg demuxes the web link correctly
            const resource = createAudioResource(url, {
                inputType: StreamType.Arbitrary
            });

            this.player.play(resource);
        } catch (err) {
            console.error('Audio Generation Processing Error via TTS layer:', err);
            this.isPlaying = false;
            this.processQueue();
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
