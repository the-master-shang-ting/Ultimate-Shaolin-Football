/**
 * Ultimate Shaolin Football (USF)
 * NetworkManager.js - Multijugador LAN P2P con PeerJS (WebRTC DataChannels a 60Hz) y 1v1 Local
 */

window.USF = window.USF || {};

class NetworkManager {
    constructor() {
        this.isHost = false;
        this.isConnected = false;
        this.mode = 'AI'; // 'AI', 'LOCAL_1V1', 'LAN_HOST', 'LAN_CLIENT'

        this.peer = null;
        this.conn = null;
        this.roomCode = null;

        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onRemoteInput = null;
        this.onRemoteState = null;

        // Buffer de sincronización y métricas de red
        this.lastStatePacket = null;
        this.currentPing = 0;
        this.pingInterval = null;
    }

    // Generar enlace directo para compartir sala (One-Click Join)
    getInviteLink(code = this.roomCode) {
        if (!code) return window.location.href;
        try {
            const url = new URL(window.location.href);
            url.searchParams.set('room', code);
            return url.toString();
        } catch (e) {
            return window.location.origin + window.location.pathname + '?room=' + code;
        }
    }

    // Generar código aleatorio amigable de 5 caracteres
    generateRoomCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 5; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // --- Iniciar como HOST de la partida LAN / Online Global ---
    startHost(onRoomReady, onClientConnected) {
        this.disconnect();
        this.mode = 'LAN_HOST';
        this.isHost = true;
        this.roomCode = this.generateRoomCode();
        const peerId = 'usf-room-' + this.roomCode.toLowerCase();

        // Inicializar PeerJS con servidores STUN públicos globales
        if (typeof Peer === 'undefined') {
            this.onError?.('La biblioteca de red no está disponible.');
            console.warn("NetworkManager: PeerJS no está cargado.");
            return;
        }

        try {
            this.peer = new Peer(peerId, {
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun.cloudflare.com:3478' }
                    ]
                }
            });

            this.peer.on('open', (id) => {
                console.log(`NetworkManager: Sala Host creada con código [${this.roomCode}]`);
                if (onRoomReady) onRoomReady(this.roomCode, this.getInviteLink(this.roomCode));
            });

            this.peer.on('connection', (connection) => {
                if (this.isConnected) { connection.close(); return; }
                this.conn = connection;
                this.setupConnectionHandlers();
                connection.on('open', () => {
                    this.isConnected = true;
                    this.startPingMeasurement();
                    if (onClientConnected) onClientConnected();
                    if (this.onConnected) this.onConnected();
                });
            });

            this.peer.on('error', (err) => {
                console.error("NetworkManager Error en Host:", err);
                this.onError?.(err.type || 'No se pudo crear la sala');
            });
        } catch (e) {
            console.error("NetworkManager: Excepción al crear Peer Host", e);
        }
    }

    // --- Conectarse como CLIENTE (Guest) a un Host ---
    joinRoom(code, onSuccess, onError) {
        this.disconnect();
        this.mode = 'LAN_CLIENT';
        this.isHost = false;
        this.roomCode = code.trim().toUpperCase();
        const hostPeerId = 'usf-room-' + this.roomCode.toLowerCase();

        if (typeof Peer === 'undefined') {
            console.warn("NetworkManager: PeerJS no está disponible.");
            if (onError) onError("Librería WebRTC no disponible.");
            return;
        }

        try {
            this.peer = new Peer({
                debug: 1,
                config: {
                    iceServers: [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun.cloudflare.com:3478' }
                    ]
                }
            });

            this.peer.on('open', () => {
                console.log(`NetworkManager: Conectando a sala [${hostPeerId}]...`);
                this.conn = this.peer.connect(hostPeerId, { reliable: true });
                this.setupConnectionHandlers();

                this.conn.on('open', () => {
                    this.isConnected = true;
                    console.log("NetworkManager: Conexión P2P establecida con el Host.");
                    this.startPingMeasurement();
                    if (onSuccess) onSuccess();
                    if (this.onConnected) this.onConnected();
                });
            });

            this.peer.on('error', (err) => {
                console.error("NetworkManager Error en Cliente:", err);
                if (onError) onError(err.type || "Error de conexión con el rival");
            });
        } catch (e) {
            console.error("NetworkManager: Excepción al unirse", e);
            if (onError) onError("Excepción al conectar");
        }
    }

    startPingMeasurement() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
            if (this.conn && this.conn.open) {
                this.conn.send({ type: 'PING', t: performance.now() });
            }
        }, 1500);
    }

    setupConnectionHandlers() {
        if (!this.conn) return;

        this.conn.on('data', (data) => {
            if (data.type === 'PING') {
                if (this.conn?.open) this.conn.send({ type: 'PONG', t: data.t });
                return;
            }
            if (data.type === 'PONG') {
                this.currentPing = Math.max(1, Math.round(performance.now() - (data.t || 0)));
                return;
            }

            if (this.isHost) {
                // Host recibe entradas (INPUT) del Guest
                if (data.type === 'INPUT' && this.onRemoteInput) {
                    this.onRemoteInput(data.input);
                }
            } else {
                // Guest recibe el estado del mundo (STATE) del Host
                if (data.type === 'STATE' && this.onRemoteState) {
                    this.onRemoteState(data);
                }
            }
        });

        this.conn.on('close', () => {
            console.log("NetworkManager: Conexión cerrada.");
            this.isConnected = false;
            if (this.onDisconnected) this.onDisconnected();
        });
    }

    // --- Envío de paquetes a 60 FPS ---
    // El Host envía el estado autoritativo a la red
    broadcastHostState(gameState) {
        if (!this.isConnected || !this.conn || !this.isHost) return;

        // Comprimir estado a paquete ligero
        const packet = {
            type: 'STATE',
            b: {
                x: Math.round(gameState.ball.x * 100) / 100,
                y: Math.round(gameState.ball.y * 100) / 100,
                z: Math.round(gameState.ball.z * 100) / 100,
                vx: Math.round(gameState.ball.vx * 10) / 10,
                vy: Math.round(gameState.ball.vy * 10) / 10,
                vz: Math.round(gameState.ball.vz * 10) / 10
            },
            score: gameState.score,
            state: gameState.matchState,
            time: Math.floor(gameState.matchTime),
            active1:gameState.active1,active2:gameState.active2,half:gameState.half,
            p: gameState.playersData // Array comprimido de los 22 jugadores
        };

        if(this.conn.open)this.conn.send(packet);
    }

    // El Guest envía su entrada al Host
    sendClientInput(input) {
        if (!this.isConnected || !this.conn?.open || this.isHost) return;

        this.conn.send({
            type: 'INPUT',
            input: {
                moveX: input.moveX,
                moveZ: input.moveZ,
                tackle: input.tackle, shootPressed: input.shootPressed,
                shootHold: input.shootHold, currentShootPower: input.currentShootPower,
                pass: input.pass,
                through: input.through,
                sprint: input.sprint,
                shootReleased: input.shootReleased,
                shootPower: input.shootPower,
                switchPlayer: input.switchPlayer
            }
        });
    }

    disconnect() {
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = null;
        this.currentPing = 0;
        if (this.conn) this.conn.close();
        if (this.peer) this.peer.destroy();
        this.isConnected = false;
        this.isHost = false;
        this.mode = 'AI';
    }
}

window.USF.NetworkManager = NetworkManager;

