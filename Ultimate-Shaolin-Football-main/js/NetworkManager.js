/**
 * Ultimate Shaolin Football (USF)
 * Red P2P con dos canales WebRTC:
 * - control fiable para menús, plantillas y acciones puntuales;
 * - tiempo real no fiable para entradas continuas y snapshots descartables.
 */

window.USF = window.USF || {};

class NetworkManager {
    constructor() {
        this.isHost = false;
        this.isConnected = false;
        this.mode = 'AI';
        this.peer = null;
        this.conn = null;
        this.controlConn = null;
        this.realtimeConn = null;
        this.roomCode = null;

        this.onConnected = null;
        this.onDisconnected = null;
        this.onRemoteInput = null;
        this.onRemoteState = null;

        this.currentPing = null;
        this.pingInterval = null;
        this.connectionTimeout = null;
        this.readyNotified = false;
        this.readyCallback = null;
        this.channelOpen = { control: false, realtime: false };

        this.stateSequence = 0;
        this.inputSequence = 0;
        this.inputEdgeSequence = 0;
        this.lastRemoteStateSequence = -1;
        this.lastRemoteInputSequence = -1;
        this.lastRemoteInputEdgeSequence = -1;
        this.lastStateSentAt = 0;
        this.lastInputSentAt = 0;
        this.maxRealtimeBuffer = 48 * 1024;
    }

    getInviteLink(code = this.roomCode) {
        if (!code) return window.location.href;
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('room', code);
            return url.toString();
        } catch (error) {
            return `${window.location.origin}${window.location.pathname}?room=${code}`;
        }
    }

    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
        return code;
    }

    getPeerOptions() {
        const custom = window.USF_WEBRTC_CONFIG || {};
        const defaultIceServers = [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.cloudflare.com:3478' }
        ];
        const iceServers = Array.isArray(custom.iceServers) && custom.iceServers.length
            ? custom.iceServers
            : defaultIceServers;
        return {
            debug: 1,
            ...(custom.peerOptions || {}),
            config: {
                ...(custom.peerOptions?.config || {}),
                iceServers,
                sdpSemantics: 'unified-plan'
            }
        };
    }

    startHost(onRoomReady, onClientConnected) {
        this.disconnect();
        this.mode = 'LAN_HOST';
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        this.readyCallback = onClientConnected;
        const peerId = `usf-room-${this.roomCode.toLowerCase()}`;

        if (typeof Peer === 'undefined') {
            this.onError?.('La biblioteca de red no está disponible.');
            return;
        }

        try {
            this.peer = new Peer(peerId, this.getPeerOptions());
            this.peer.on('open', () => onRoomReady?.(this.roomCode, this.getInviteLink(this.roomCode)));
            this.peer.on('connection', connection => {
                const kind = connection.label === 'usf-realtime' ? 'realtime' : 'control';
                this.registerConnection(connection, kind);
            });
            this.bindPeerErrors();
        } catch (error) {
            this.onError?.('No se pudo crear la sala WebRTC.');
        }
    }

    joinRoom(code, onSuccess, onError) {
        this.disconnect();
        this.mode = 'LAN_CLIENT';
        this.isHost = false;
        this.roomCode = code.trim().toUpperCase();
        this.readyCallback = onSuccess;
        this.joinErrorCallback = onError;
        const hostPeerId = `usf-room-${this.roomCode.toLowerCase()}`;

        if (typeof Peer === 'undefined') {
            onError?.('Librería WebRTC no disponible.');
            return;
        }

        try {
            this.peer = new Peer(this.getPeerOptions());
            this.peer.on('open', () => {
                this.registerConnection(this.peer.connect(hostPeerId, {
                    label: 'usf-control', serialization: 'binary', reliable: true
                }), 'control');
                this.registerConnection(this.peer.connect(hostPeerId, {
                    label: 'usf-realtime', serialization: 'binary', reliable: false
                }), 'realtime');
                this.connectionTimeout = setTimeout(() => {
                    if (!this.isConnected) {
                        const message = 'No se completó la conexión P2P. Esta red puede necesitar un servidor TURN.';
                        this.onError?.(message);
                        this.joinErrorCallback?.(message);
                    }
                }, 15000);
            });
            this.bindPeerErrors(onError);
        } catch (error) {
            onError?.('No se pudo iniciar la conexión WebRTC.');
        }
    }

    bindPeerErrors(joinError) {
        this.peer?.on('error', error => {
            const messages = {
                'peer-unavailable': 'La sala no existe o todavía no está disponible.',
                'unavailable-id': 'El código de sala ya está en uso. Creá otra sala.',
                'network': 'No se pudo contactar al servidor de señalización.',
                'webrtc': 'El navegador no pudo establecer la ruta WebRTC.'
            };
            const message = messages[error.type] || error.type || 'Error de conexión WebRTC';
            this.onError?.(message);
            joinError?.(message);
        });
    }

    registerConnection(connection, kind) {
        if (!connection) return;
        const property = kind === 'realtime' ? 'realtimeConn' : 'controlConn';
        const previous = this[property];
        if (previous && previous !== connection && previous.open) {
            connection.close();
            return;
        }
        this[property] = connection;
        if (kind === 'control') this.conn = connection;
        this.setupConnectionHandlers(connection, kind);

        connection.on('open', () => {
            this.channelOpen[kind] = true;
            const channel = connection.dataChannel;
            if (channel) channel.bufferedAmountLowThreshold = 16 * 1024;
            this.notifyReadyIfComplete();
        });
    }

    notifyReadyIfComplete() {
        if (this.readyNotified || !this.channelOpen.control || !this.channelOpen.realtime) return;
        this.readyNotified = true;
        this.isConnected = true;
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
        this.connectionTimeout = null;
        this.startPingMeasurement();
        this.readyCallback?.();
        this.onConnected?.();
    }

    startPingMeasurement() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.controlConn?.open) this.controlConn.send({ type: 'PING', t: performance.now() });
        }, 2000);
    }

    setupConnectionHandlers(connection, kind) {
        connection.on('data', data => {
            if (!data || typeof data !== 'object') return;

            if (kind === 'control') {
                if (data.type === 'PING') {
                    if (connection.open) connection.send({ type: 'PONG', t: data.t });
                    return;
                }
                if (data.type === 'PONG') {
                    this.currentPing = Math.max(1, Math.round(performance.now() - (data.t || 0)));
                    return;
                }
                if (data.type === 'INPUT_EDGE' && this.isHost) {
                    if (Number.isFinite(data.n) && data.n <= this.lastRemoteInputEdgeSequence) return;
                    this.lastRemoteInputEdgeSequence = data.n;
                    this.onRemoteInput?.(data.e || {});
                    return;
                }
                if (['MATCH_MENU', 'PAUSE_REQUEST', 'SQUAD_EDIT', 'SQUAD_REQUEST', 'SQUAD_SYNC', 'SQUAD_RESULT', 'MATCH_START', 'CARD'].includes(data.type)) {
                    this.onControl?.(data);
                }
                return;
            }

            if (this.isHost && data.type === 'INPUT') {
                if (Number.isFinite(data.n) && data.n <= this.lastRemoteInputSequence) return;
                this.lastRemoteInputSequence = data.n;
                const input = data.i || [];
                this.onRemoteInput?.({
                    moveX: input[0] || 0,
                    moveZ: input[1] || 0,
                    aimX: input[2] || 0,
                    aimY: input[3] || 0,
                    shootHold: !!input[4],
                    currentShootPower: input[5] || 0,
                    sprint: !!input[6]
                });
            } else if (!this.isHost && data.type === 'STATE') {
                if (Number.isFinite(data.n) && data.n <= this.lastRemoteStateSequence) return;
                this.lastRemoteStateSequence = data.n;
                this.onRemoteState?.(data);
            }
        });

        connection.on('close', () => this.handleConnectionClose(kind));
        connection.on('error', error => this.onError?.(error.type || `Error en canal ${kind}`));
    }

    handleConnectionClose(kind) {
        this.channelOpen[kind] = false;
        const wasConnected = this.isConnected;
        this.isConnected = false;
        if (wasConnected) this.onDisconnected?.();
    }

    getRealtimeBufferedAmount() {
        const channelAmount = this.realtimeConn?.dataChannel?.bufferedAmount || 0;
        const peerQueue = (this.realtimeConn?.bufferSize || 0) * 1024;
        return channelAmount + peerQueue;
    }

    canSendRealtime() {
        return !!this.realtimeConn?.open && this.getRealtimeBufferedAmount() < this.maxRealtimeBuffer;
    }

    getStateInterval() {
        if (this.currentPing > 180) return 80;
        if (this.currentPing > 100) return 60;
        return 50;
    }

    shouldSendHostState(now = performance.now()) {
        return this.isConnected && this.isHost && this.canSendRealtime()
            && now - this.lastStateSentAt >= this.getStateInterval();
    }

    broadcastHostState(gameState, now = performance.now()) {
        if (!this.shouldSendHostState(now)) return;
        const setPiece = gameState.setPiece;
        const packet = {
            type: 'STATE',
            n: ++this.stateSequence,
            b: [
                this.round(gameState.b.x, 2), this.round(gameState.b.y, 2), this.round(gameState.b.z, 2),
                this.round(gameState.b.vx, 1), this.round(gameState.b.vy, 1), this.round(gameState.b.vz, 1)
            ],
            s: [gameState.score.team1, gameState.score.team2],
            g: gameState.state,
            t: this.round(gameState.time, 1),
            sp: setPiece ? [setPiece.kind, setPiece.teamId, this.round(setPiece.pos.x, 2), this.round(setPiece.pos.z, 2),
                this.round(setPiece.aimAngle, 3), this.round(setPiece.curve, 2), this.round(setPiece.chargePower, 2),
                setPiece.kickerIndex, setPiece.targetName || ''] : null,
            a: [gameState.active1, gameState.active2],
            h: gameState.half,
            p: gameState.p.map(player => [
                player.x, player.z, player.fa,
                this.round(player.vx, 1), this.round(player.vz, 1),
                player.stamina, player.red ? 1 : 0
            ])
        };
        try {
            this.realtimeConn.send(packet);
            this.lastStateSentAt = now;
        } catch (error) {
            // El siguiente snapshot sustituye a este; nunca se acumulan estados viejos.
        }
    }

    sendClientInput(input, now = performance.now()) {
        if (!this.isConnected || this.isHost) return;

        const edge = {};
        for (const key of ['pass', 'through', 'tackle', 'switchPlayer', 'shootPressed', 'shootReleased']) {
            if (input[key]) edge[key] = true;
        }
        if (input.shootReleased) edge.shootPower = this.clampNumber(input.shootPower, 0, 1);
        if (Number.isFinite(input.curveValue)) edge.curveValue = this.clampNumber(input.curveValue, -1, 1);
        if (Object.keys(edge).length && this.controlConn?.open) {
            try {
                this.controlConn.send({ type: 'INPUT_EDGE', n: ++this.inputEdgeSequence, e: edge });
            } catch (error) {
                // El cierre del canal se procesa en su evento correspondiente.
            }
        }

        const interval = this.currentPing > 160 ? 50 : 1000 / 30;
        if (!this.canSendRealtime() || now - this.lastInputSentAt < interval) return;
        const packet = {
            type: 'INPUT',
            n: ++this.inputSequence,
            i: [
                this.round(this.clampNumber(input.moveX, -1, 1), 2),
                this.round(this.clampNumber(input.moveZ, -1, 1), 2),
                this.round(this.clampNumber(input.aimX, -1, 1), 2),
                this.round(this.clampNumber(input.aimY, -1, 1), 2),
                input.shootHold ? 1 : 0,
                this.round(this.clampNumber(input.currentShootPower, 0, 1), 2),
                input.sprint ? 1 : 0
            ]
        };
        try {
            this.realtimeConn.send(packet);
            this.lastInputSentAt = now;
        } catch (error) {
            // La próxima entrada continua reemplaza a la descartada.
        }
    }

    sendControl(packet) {
        if (!this.isConnected || !this.controlConn?.open) return;
        try {
            this.controlConn.send(packet);
        } catch (error) {
            this.onError?.('No se pudo enviar un mensaje de control.');
        }
    }

    round(value, decimals) {
        const number = Number(value) || 0;
        const factor = 10 ** decimals;
        return Math.round(number * factor) / factor;
    }

    clampNumber(value, min, max) {
        const number = Number(value) || 0;
        return Math.max(min, Math.min(max, number));
    }

    disconnect() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
        this.pingInterval = null;
        this.connectionTimeout = null;
        this.currentPing = null;
        this.isConnected = false;
        this.readyNotified = false;
        this.channelOpen = { control: false, realtime: false };

        const connections = new Set([this.controlConn, this.realtimeConn, this.conn].filter(Boolean));
        for (const connection of connections) connection.close();
        this.peer?.destroy();

        this.peer = null;
        this.conn = null;
        this.controlConn = null;
        this.realtimeConn = null;
        this.readyCallback = null;
        this.joinErrorCallback = null;
        this.isHost = false;
        this.mode = 'AI';
        this.stateSequence = 0;
        this.inputSequence = 0;
        this.inputEdgeSequence = 0;
        this.lastRemoteStateSequence = -1;
        this.lastRemoteInputSequence = -1;
        this.lastRemoteInputEdgeSequence = -1;
        this.lastStateSentAt = 0;
        this.lastInputSentAt = 0;
    }
}

window.USF.NetworkManager = NetworkManager;
