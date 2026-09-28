/**
 * Ultimate Shaolin Football (USF)
 * ReplaySystem.js - Buffer circular de repetición instantánea de 5s para goles en cámara lenta
 */

window.USF = window.USF || {};

class ReplaySystem {
    constructor(maxSeconds = 5, fps = 60) {
        this.bufferCapacity = maxSeconds * fps; // 300 frames
        this.buffer = new Array(this.bufferCapacity);
        this.writeIndex = 0;
        this.isFull = false;

        // Estado de reproducción
        this.isReplaying = false;
        this.playbackIndex = 0;
        this.playbackSpeed = 0.38; // Cámara lenta estilo televisión (38% de velocidad)
        this.playbackProgress = 0;
        this.onReplayComplete = null;
    }

    // Capturar snapshot del estado actual del partido
    recordFrame(ball, players) {
        if (this.isReplaying) return;

        const snapshot = {
            ball: {
                x: ball.x,
                y: ball.y,
                z: ball.z,
                wx: ball.wx,
                wy: ball.wy,
                wz: ball.wz
            },
            players: players.map(p => ({
                id: p.playerData.id,
                x: p.x,
                z: p.z,
                vx: p.vx || 0,
                vz: p.vz || 0,
                facingAngle: p.facingAngle || 0,
                anim: p.model ? p.model.currentAnim : 'IDLE',
                isSentOff: !!p.isSentOff
            }))
        };

        this.buffer[this.writeIndex] = snapshot;
        this.writeIndex = (this.writeIndex + 1) % this.bufferCapacity;
        if (this.writeIndex === 0) {
            this.isFull = true;
        }
    }

    // Iniciar la repetición instantánea del gol
    startReplay(onComplete) {
        this.onReplayComplete = onComplete;
        this.isReplaying = true;

        // Comenzar 5 segundos atrás (o desde el inicio del buffer si aún no se llenó)
        const totalFrames = this.isFull ? this.bufferCapacity : this.writeIndex;
        this.playbackIndex = this.isFull ? this.writeIndex : 0;
        this.remainingFrames = totalFrames;
        this.playbackProgress = 0;

        // Mostrar overlay de TV Replay
        const replayOverlay = document.getElementById('replay-overlay');
        if (replayOverlay) replayOverlay.style.display = 'flex';
    }

    // Actualizar reproducción en el loop
    update(dt, applySnapshotCallback) {
        if (!this.isReplaying) return;

        // Acumular avance de frames con cámara lenta
        this.playbackProgress += 60 * dt * this.playbackSpeed;

        while (this.playbackProgress >= 1.0) {
            this.playbackProgress -= 1.0;

            const snapshot = this.buffer[this.playbackIndex];
            if (snapshot && applySnapshotCallback) {
                applySnapshotCallback(snapshot);
            }

            this.playbackIndex = (this.playbackIndex + 1) % this.bufferCapacity;
            this.remainingFrames--;

            if (this.remainingFrames <= 0) {
                this.stopReplay();
                break;
            }
        }
    }

    stopReplay() {
        this.isReplaying = false;
        const replayOverlay = document.getElementById('replay-overlay');
        if (replayOverlay) replayOverlay.style.display = 'none';

        if (this.onReplayComplete) {
            this.onReplayComplete();
            this.onReplayComplete = null;
        }
    }
}

window.USF.ReplaySystem = ReplaySystem;

