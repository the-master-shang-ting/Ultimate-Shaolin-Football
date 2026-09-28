/**
 * Ultimate Shaolin Football (USF)
 * SoundEngine.js - Motor de audio procedural sintetizado con Web Audio API
 */

window.USF = window.USF || {};

class SoundEngine {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.masterVolume = 0.8;
        this.crowdGain = null;
        this.crowdSource = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            
            // Master gain
            this.masterGainNode = this.ctx.createGain();
            this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
            this.masterGainNode.connect(this.ctx.destination);

            this.startCrowdMurmur();
            this.initialized = true;
            console.log("SoundEngine: Web Audio API inicializado con éxito.");
        } catch (e) {
            console.warn("SoundEngine: No se pudo inicializar Web Audio API", e);
        }
    }

    ensureContext() {
        if (!this.initialized) {
            this.init();
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    setVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        if (this.masterGainNode && this.ctx) {
            this.masterGainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.masterVolume, this.ctx.currentTime, 0.05);
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.setVolume(this.masterVolume);
        return this.isMuted;
    }

    // --- Silbato del Árbitro ---
    // Simula silbato Fox 40 Classic con dos frecuencias armónicas batientes y vibrato
    playWhistle(type = 'short') {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const patterns = {
            'short': [0.25],
            'double': [0.15, 0.1, 0.28], // bip, pausa, bip largo
            'triple': [0.15, 0.08, 0.15, 0.08, 0.45], // Final de partido
            'long': [0.65] // Falta grave / Gol
        };

        const sequence = patterns[type] || patterns['short'];
        let startTime = this.ctx.currentTime;

        sequence.forEach((dur, idx) => {
            if (idx % 2 === 1) {
                // Pausa
                startTime += dur;
                return;
            }

            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            // Modulador de frecuencia (trémolo del guisante del silbato)
            const tremoloOsc = this.ctx.createOscillator();
            const tremoloGain = this.ctx.createGain();
            tremoloOsc.frequency.setValueAtTime(32, startTime); // 32 Hz trémolo
            tremoloGain.gain.setValueAtTime(120, startTime);
            tremoloOsc.connect(osc1.frequency);
            tremoloOsc.connect(osc2.frequency);

            osc1.type = 'sine';
            osc2.type = 'sine';
            osc1.frequency.setValueAtTime(2850, startTime);
            osc2.frequency.setValueAtTime(3120, startTime);

            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(3000, startTime);
            filter.Q.setValueAtTime(4.0, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02);
            gain.gain.setValueAtTime(0.32, startTime + dur - 0.04);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

            osc1.connect(filter);
            osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGainNode);

            osc1.start(startTime);
            osc2.start(startTime);
            tremoloOsc.start(startTime);

            osc1.stop(startTime + dur);
            osc2.stop(startTime + dur);
            tremoloOsc.stop(startTime + dur);

            startTime += dur;
        });
    }

    // --- Golpe al Balón ---
    playKick(power = 1.0, isSuper = false) {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const normPower = Math.max(0.2, Math.min(1.0, power));

        // Sub-graves (impacto de la bota)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        const startFreq = 160 + normPower * 90;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(38, now + 0.12);

        gain.gain.setValueAtTime(0.4 * normPower, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc.connect(gain);
        gain.connect(this.masterGainNode);

        osc.start(now);
        osc.stop(now + 0.15);

        // Transitorio crujiente (chasquido del cuero)
        const bufferSize = Math.floor(this.ctx.sampleRate * 0.04);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(1400, now);
        noiseFilter.Q.setValueAtTime(2.0, now);

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.3 * normPower, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.masterGainNode);

        noise.start(now);

        // Si es tiro especial Shaolin: explosión y ráfaga flamígera
        if (isSuper) {
            this.playShaolinExplosion();
        }
    }

    // --- Efecto Shaolin Super Shot ---
    playShaolinExplosion() {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;

        const dur = 0.8;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.linearRampToValueAtTime(180, now + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGainNode);

        noise.start(now);
    }

    // --- Pelotazo al Poste (Impacto Metálico) ---
    playBallPost() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const freqs = [620, 1240, 2480, 3100];
        const decays = [0.8, 0.6, 0.4, 0.25];

        freqs.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
            osc.frequency.setValueAtTime(f, now);

            gain.gain.setValueAtTime(0.25 / (idx + 1), now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + decays[idx]);

            osc.connect(gain);
            gain.connect(this.masterGainNode);

            osc.start(now);
            osc.stop(now + decays[idx]);
        });
    }

    // --- Balón a la Red ---
    playNetSwish() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const dur = 0.28;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4));
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(850, now);
        filter.Q.setValueAtTime(1.5, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGainNode);

        noise.start(now);
    }

    // --- Deslizamiento en Césped (Slide Tackle) ---
    playTackleGrass() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const dur = 0.35;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / bufferSize);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, now);
        filter.frequency.linearRampToValueAtTime(400, now + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGainNode);

        noise.start(now);
    }

    // --- Murmullo Constante de la Multitud ---
    startCrowdMurmur() {
        if (!this.ctx || this.crowdGain) return;

        // Generamos un buffer de ruido rosa filtrado de 4 segundos en loop
        const dur = 4.0;
        const sampleRate = this.ctx.sampleRate;
        const bufferSize = sampleRate * dur;
        const buffer = this.ctx.createBuffer(2, bufferSize, sampleRate);

        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.05;
                b6 = white * 0.115926;
            }
        }

        this.crowdSource = this.ctx.createBufferSource();
        this.crowdSource.buffer = buffer;
        this.crowdSource.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(550, this.ctx.currentTime);
        filter.Q.setValueAtTime(1.0, this.ctx.currentTime);

        this.crowdGain = this.ctx.createGain();
        this.crowdGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

        this.crowdSource.connect(filter);
        filter.connect(this.crowdGain);
        this.crowdGain.connect(this.masterGainNode);

        this.crowdSource.start();
    }

    // --- Ovación y Celebración de Gol ---
    playGoalCheer() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const dur = 4.5;

        // Subir intensidad del murmullo
        if (this.crowdGain) {
            this.crowdGain.gain.cancelScheduledValues(now);
            this.crowdGain.gain.setValueAtTime(0.12, now);
            this.crowdGain.gain.linearRampToValueAtTime(0.45, now + 0.4);
            this.crowdGain.gain.exponentialRampToValueAtTime(0.12, now + dur);
        }

        // Estruendo masivo de hinchada
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(2, bufferSize, this.ctx.sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.min(1.0, (i / (this.ctx.sampleRate * 0.5))) * Math.exp(-i / (bufferSize * 0.6));
            }
        }

        const roar = this.ctx.createBufferSource();
        roar.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1800, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.7, now + 0.35);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        roar.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGainNode);

        roar.start(now);

        // Bocina de gol de estadio
        this.playStadiumHorn(now);
    }

    // --- Bocina de Estadio ---
    playStadiumHorn(startTime) {
        const freqs = [155, 196, 233]; // Acorde mayor pesado
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(f, startTime);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(650, startTime);

            gain.gain.setValueAtTime(0.001, startTime);
            gain.gain.linearRampToValueAtTime(0.15, startTime + 0.1);
            gain.gain.setValueAtTime(0.15, startTime + 1.2);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + 1.8);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGainNode);

            osc.start(startTime);
            osc.stop(startTime + 1.8);
        });
    }

    // --- Jadeo / "Uyyy" de la Hinchada (Ocasión Fallada) ---
    playCrowdGasp() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const dur = 1.2;
        const bufferSize = Math.floor(this.ctx.sampleRate * dur);
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / bufferSize);
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, now);
        filter.frequency.linearRampToValueAtTime(750, now + 0.5);
        filter.frequency.linearRampToValueAtTime(320, now + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.25);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGainNode);

        noise.start(now);
    }

    // --- Clics de Interfaz UI ---
    playMenuClick() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.masterGainNode);

        osc.start(now);
        osc.stop(now + 0.06);
    }

    playMenuHover() {
        this.ensureContext();
        if (!this.ctx || this.isMuted) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.03);

        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.masterGainNode);

        osc.start(now);
        osc.stop(now + 0.04);
    }
}

window.USF.SoundEngine = SoundEngine;

