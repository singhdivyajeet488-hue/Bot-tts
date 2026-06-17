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
const say = require('say');
const fs = require('fs');
const path = require('path');

class TTSManager {
    constructor(guildId, textChannelId, voiceChannelId, client) {
        this.guildId = guildId;
        this.textChannelId = textChannelId;
        this.voiceChannelId = voiceChannelId;
        this.client = client;
        this.queue = [];
        this.isPlaying = false;
        
        // Dynamic temporary local path location for processing audio output frames
        this.tempFilePath = path.join(__dirname, `../../temp_tts_${this.guildId}.wav`);

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
            this.cleanupTempFile();
            this.isPlaying = false;
            this.processQueue();
        });

        this.player.on('error', error => {
            console.error('LOG [TTS Local Player Exception]:', error.message);
            this.cleanupTempFile();
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
        
        // Local engine limits can process large text streams cleanly
        const chunks = phrase.length > 200 ? phrase.match(/[\s\S]{1,180}/g) || [] : [phrase];

        this.queue.push(...chunks);
        this.processQueue();
    }

    async processQueue() {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;
        const currentText = this.queue.shift();

        // Export text locally as a standard WAV file via Festival
        say.export(currentText, null, 1.0, this.tempFilePath, (err) => {
            if (err) {
                console.error('Local TTS Export Error:', err);
                this.isPlaying = false;
                return this.processQueue();
            }

            try {
                // Instantly inject the local file directly into the player
                const resource = createAudioResource(fs.createReadStream(this.tempFilePath), {
                    inputType: StreamType.Arbitrary
                });

                this.player.play(resource);
            } catch (streamErr) {
                console.error('Local File Streaming Error:', streamErr);
                this.isPlaying = false;
                this.processQueue();
            }
        });
    }

    cleanupTempFile() {
        try {
            if (fs.existsSync(this.tempFilePath)) {
                fs.unlinkSync(this.tempFilePath);
            }
        } catch (e) {
            console.error('Failed to clean up temp voice cache:', e.message);
        }
    }

    destroy() {
        this.queue = [];
        this.player.stop();
        this.cleanupTempFile();
        if (this.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            this.connection.destroy();
        }
        this.client.ttsManagers.delete(this.guildId);
    }
}

module.exports = TTSManager;
