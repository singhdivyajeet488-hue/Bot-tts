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

        // Establish the connection with optimized cloud streaming configurations
        this.connection = joinVoiceChannel({
            channelId: voiceChannelId,
            guildId: guildId,
            adapterCreator: client.guilds.cache.get(guildId).voiceAdapterCreator,
            selfDeaf: false,
            selfMute: false
        });

        this.player = createAudioPlayer();
        this.connection.subscribe(this.player);

        // Debug Tracker: Prints exactly what the player is doing inside Railway Deploy Logs
        this.player.on('stateChange', (oldState, newState) => {
            console.log(`LOG [TTS Player]: Changed status from ${oldState.status} to ${newState.status}`);
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.processQueue();
        });

        this.player.on('error', error => {
            console.error('LOG [TTS Player Runtime Error]:', error.message);
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
        
        cleanedContent = cleanedContent.replace(/[\u1F600-\u1F64F]/gu, (match) => {
            const mapLookup = emojiMap.get(match);
            return mapLookup ? ` ${mapLookup.replace(/:/g, '')} emoji ` : ' emoji ';
        });

        if (!cleanedContent) return;

        const phrase = `${message.member.displayName} ne kaha, ${cleanedContent}`;
        const chunks = phrase.length > 200 ? phrase.match(/[\s\S]{1,150}/g) || [] : [phrase];

        this.queue.push(...chunks);
        this.processQueue();
    }

    async processQueue() {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;
        const currentText = this.queue.shift();

        try {
            // Unrestricted Google engine matrix query link
            const targetUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(currentText)}&tl=hi&total=1&idx=0&textlen=${currentText.length}&client=tw-ob&ttsspeed=1`;

            const response = await axios({
                method: 'get',
                url: targetUrl,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            // Convert raw input using Arbitrary stream types and force inline volume activation
            const resource = createAudioResource(response.data, {
                inputType: StreamType.Arbitrary,
                inlineVolume: true
            });

            // Set absolute scale volume to 1.0 (100%) to ensure it pushes data down the pipe
            resource.volume.setVolume(1.0);

            this.player.play(resource);
        } catch (err) {
            console.error('TTS Audio Processing Layer Error:', err.message);
            this.isPlaying = false;
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
