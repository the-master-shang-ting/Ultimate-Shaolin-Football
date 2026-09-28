/**
 * Ultimate Shaolin Football (USF)
 * GameEngine.js - Motor central, loop a 60 FPS, orquestación de subsistemas y gestión de partidos
 */

window.USF = window.USF || {};

class GameEngine {
    constructor() {
        this.isRunning = false;
        this.isPaused = false;
        this.half = 1;
        this.goalDelay = null;
        this.halfTimeDelay = 0;
        this.hitStopTimer = 0; // Pausa sutil de impacto en disparos potentes (hit-stop)

        // Subsistemas
        this.sound = new window.USF.SoundEngine();
        window.USF.soundEngine = this.sound;

        const container = document.getElementById('game-container');
        this.renderer = new window.USF.RenderEngine(container);
        this.physics = new window.USF.PhysicsEngine();
        this.input = new window.USF.InputManager();
        this.rules = new window.USF.RulesEngine(this.renderer.scene, this.sound);
        this.ai = new window.USF.AIEngine(this.physics, this.rules, this.renderer);
        this.network = new window.USF.NetworkManager();
        this.replay = new window.USF.ReplaySystem(5, 60);
        this.ui = new window.USF.UIManager();
        this.squads = new window.USF.SquadManager(this);
        this.ai.onStatEvent=(teamId,key,amount)=>this.recordMatchStat(teamId,key,amount);

        // Equipos activos
        this.team1 = null;
        this.team2 = null;
        this.activeP1Index = 9; // Por defecto delantero centro
        this.activeP2Index = 9;

        // Cronómetro de partido (Escalado: 90 minutos de juego en 6 minutos reales)
        this.matchSeconds = 0;
        this.timeScale = 15.0; // 1 seg real = 15 segs de partido

        // Entrada remota para cliente LAN
        this.remoteClientInput = null;
        this.networkTargets = null;

        this.setupCallbacks();
        this.setupInitialMenu();

        // Iniciar loop principal
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.mainLoop(t));
    }

    setupCallbacks() {
        // UI
        this.ui.onStartMatch = (t1Id, t2Id, mode) => this.startMatch(t1Id, t2Id, mode);
        this.ui.onHostLAN = () => this.initLANHost();
        this.ui.onJoinLAN = (code) => this.initLANGuest(code);
        this.ui.onPauseMatch = () => this.setMatchPaused(true);
        this.ui.onResumeMatch = () => this.setMatchPaused(false);
        this.ui.onRestartMatch = () => {
            if(this.network.mode==='LAN_CLIENT') {this.setMatchPaused(true);this.ui.showToast('Partida online','El anfitrión puede reiniciar el partido.');return;}
            this.startMatch(this.team1.data.id,this.team2.data.id,this.network.mode);
        };
        this.ui.onQuitMatch = () => {
            this.cancelTransientState();
            this.network.disconnect();
            document.body.classList.remove('playing');
            this.isPaused = false;
            this.isRunning = false;
            this.isMenuState = true;
            this.input.isMenuNavigationActive = true;
            this.ui.focusedScreen = 'main-menu';
            this.ui.initScreenFocus();
        };

        // Conectar eventos de Gamepad Toast y Navegación de Menús
        this.input.onGamepadToast = (toast) => {
            this.ui.showToast(toast.title, toast.message, toast.icon, toast.type);
            if (this.sound) this.sound.playMenuHover();
        };

        this.input.onMenuNav = ({ dir }) => {
            this.ui.handleGamepadNav(dir);
        };

        this.input.onMenuConfirm = () => {
            this.ui.handleGamepadConfirm();
        };

        this.input.onMenuCancel = () => {
            this.ui.handleGamepadCancel();
        };

        this.input.onMenuTab = ({ dir }) => {
            this.ui.handleGamepadTab(dir);
        };

        this.input.onMenuPause = () => {
            if (this.squads.modal.style.display === 'flex') {this.squads.close();return;}
            if (this.isRunning && !this.isMenuState) {
                this.setMatchPaused(!this.isPaused);
            }
        };

        // Físicas
        this.physics.onWoodwork = (pos) => {
            this.sound.playBallPost();
            this.sound.playCrowdGasp();
            this.renderer.triggerScreenShake(0.85);
        };

        this.physics.onGoal = (scoringTeamId, pos) => {
            this.rules.registerGoal(scoringTeamId);
            this.physics.freeze();
        };

        // Reglas
        this.rules.onGoalEvent = (scoringTeamId, score) => {
            const team = (scoringTeamId === 'team1') ? this.team1 : this.team2;
            this.ui.showEventBanner("¡¡GOOOOOOL!!", team.data.name.toUpperCase(), 3.5);
            this.renderer.triggerScreenShake(1.2);

            this.goalDelay = 1.2;
            this.ui.updateScoreboard(score.team1,score.team2,this.matchSeconds);
        };

        this.rules.onCardEvent = (cardType, player) => {
            if(cardType==='YELLOW'||(cardType==='RED'&&player.cardReason==='Segunda amarilla'))this.recordMatchStat(player.teamId,'yellowCards',1);
            const title = (cardType === 'RED') ? "¡TARJETA ROJA!" : "TARJETA AMARILLA";
            const sub = `${player.playerData.name.toUpperCase()} (#${player.playerData.number}) · ${player.cardReason || ''}`;
            this.ui.showEventBanner(title, sub, 2.5);
            this.ui.showToast(title,sub,cardType==='RED'?'🟥':'🟨','connected',5000);
            if(this.network.isHost)this.network.sendControl({type:'CARD',cardType,teamId:player.teamId,id:player.playerData.id,reason:player.cardReason});
            if(cardType==='RED') this.handleSendingOff(player);
        };

        this.rules.onInjuryEvent = (player, injury) => this.registerInjury(player,injury,true,true);

        this.rules.onStateChange = (state, teamId) => {
            if(state==='CORNER')this.recordMatchStat(teamId,'corners',1);
            if (state === 'GOAL') {
                this.physics.freeze();
            } else if (state === 'OFFSIDE') {
                this.ui.showEventBanner("FUERA DE JUEGO", "Posición antirreglamentaria", 2.0);
            } else if (state === 'FOUL') {
                this.ui.showEventBanner("FALTA", "Tiro libre directo", 2.0);
            } else if (state === 'PENALTY') {
                this.ui.showEventBanner("¡PENALTI!", "Falta dentro del área", 2.8);
            } else if (state === 'THROW_IN') {
                this.ui.showEventBanner("SAQUE DE BANDA", `Balón para ${teamId === 'team1' ? this.team1.data.shortName : this.team2.data.shortName}`, 1.8);
            } else if (state === 'GOAL_KICK') {
                this.ui.showEventBanner("SAQUE DE META", "El balón salió por la línea de fondo", 1.8);
            } else if (state === 'CORNER') {
                this.ui.showEventBanner("TIRO DE ESQUINA", "Último toque de la defensa", 1.8);
            }
            if (['CORNER', 'FOUL', 'PENALTY', 'THROW_IN', 'GOAL_KICK', 'GOAL', 'OFFSIDE'].includes(state)) {
                this.recordStoppage(state);
            }
        };

        this.rules.onRestartReady = (kind,teamId,pos) => this.prepareRestart(kind,teamId,pos);
        const cycleCamera = () => {
            const label = this.renderer.cycleCamera();
            const button = document.getElementById('btn-camera');
            if (button) button.textContent = 'CÁMARA: ' + label;
            this.updateCameraContext();
            this.renderer.updateCamera(0, this.physics.ball);
        };
        document.getElementById('btn-camera')?.addEventListener('click', cycleCamera);
        window.addEventListener('keydown', e => {
            if (e.code === 'KeyC' && !e.repeat && this.isRunning && !this.isMenuState && !e.target.closest?.('input, textarea')) cycleCamera();
        });
        document.getElementById('btn-skip-replay')?.addEventListener('click', () => this.replay.stopReplay());
        window.addEventListener('blur', () => {
            if (this.isRunning && !this.isPaused && this.network.mode !== 'LAN_CLIENT') document.getElementById('btn-hud-pause').click();
        });
        // Red P2P
        this.network.onError = message => {
            const status=document.getElementById('lan-status');if(status)status.textContent='Error: '+message;
        };
        this.network.onDisconnected = () => {
            this.remoteClientInput=null;
            if(this.isRunning && !this.isMenuState && this.network.mode.startsWith('LAN')) {
                this.ui.showToast('Conexión interrumpida','Reiniciá la sala para reconectar.','!','disconnected');
                this.setMatchPaused(true,true);
            }
        };
        this.network.onRemoteInput = (input) => {
            if (!input || typeof input !== 'object') return;
            const previous=this.remoteClientInput||{};
            const numberOrPrevious=(key,min,max)=>Number.isFinite(Number(input[key]))
                ? THREE.MathUtils.clamp(Number(input[key]),min,max)
                : THREE.MathUtils.clamp(Number(previous[key])||0,min,max);
            const safe={moveX:numberOrPrevious('moveX',-1,1),moveZ:numberOrPrevious('moveZ',-1,1),
                aimX:numberOrPrevious('aimX',-1,1),aimY:numberOrPrevious('aimY',-1,1),
                sprint:input.sprint===undefined?!!previous.sprint:!!input.sprint,
                shootHold:input.shootHold===undefined?!!previous.shootHold:!!input.shootHold,
                currentShootPower:numberOrPrevious('currentShootPower',0,1),
                shootPower:numberOrPrevious('shootPower',0,1)};
            if(Number.isFinite(input.curveValue))safe.curveValue=THREE.MathUtils.clamp(input.curveValue,-1,1);
            else if(Number.isFinite(previous.curveValue))safe.curveValue=previous.curveValue;
            for(const key of ['pass','through','tackle','switchPlayer','shootReleased','shootPressed'])safe[key]=!!input[key]||!!previous[key];
            if(previous.shootReleased&&!input.shootReleased)safe.shootPower=previous.shootPower;
            this.remoteClientInput = safe;
            this.remoteInputTime = performance.now();
        };

        this.network.onRemoteState = (statePacket) => {
            this.applyNetworkState(statePacket);
        };
        this.network.onControl = packet => this.handleNetworkControl(packet);
        const curveRange=document.getElementById('set-piece-curve-range');
        const setCurve=value=>{
            const curve=THREE.MathUtils.clamp(Number(value)||0,-1,1);
            const asp=this.network.mode==='LAN_CLIENT'?this.remoteSetPiece:this.activeSetPiece;
            if(!asp || !this.canLocallyControlSetPiece(asp))return;
            if(this.network.mode==='LAN_CLIENT') {
                this.pendingCurve=curve;
                this.remoteSetPiece.curve=curve;
            } else this.activeSetPiece.curve=curve;
            if(curveRange)curveRange.value=String(Math.round(curve*100));
            this.updateSetPiecePanel(asp,true);
        };
        for(const [id,delta] of [['btn-curve-left',-.2],['btn-curve-reset',0],['btn-curve-right',.2]]) {
            document.getElementById(id).onclick=()=>{
                const current=(Number(curveRange?.value)||0)/100;
                setCurve(id==='btn-curve-reset'?0:current+delta);
            };
        }
        curveRange?.addEventListener('input',event=>setCurve(Number(event.target.value)/100));
        document.getElementById('btn-restart-target').onclick=()=>{
            const asp=this.network.mode==='LAN_CLIENT'?this.remoteSetPiece:this.activeSetPiece;
            if(!asp || !this.canLocallyControlSetPiece(asp))return;
            if(this.network.mode==='LAN_CLIENT')this.pendingRestartTarget=true;
            else this.cycleRestartTarget(this.activeSetPiece);
        };
    }

    setMatchPaused(paused, fromHost = false) {
        if(this.network.mode==='LAN_CLIENT' && !fromHost) {
            this.network.sendControl({type:'PAUSE_REQUEST',paused});
            // Wait for the authoritative pause/resume, including a rejected resume.
            this.ui.pauseModal.style.display=this.isPaused?'flex':'none';
            return;
        }
        if(!paused && Object.values(this.squads.editing).some(Boolean)) {
            this.ui.showToast('Plantillas abiertas','Cerrá las plantillas de ambos jugadores antes de reanudar.');
            if(this.squads.modal.style.display!=='flex')this.ui.pauseModal.style.display='flex';
            if(this.network.isHost)this.network.sendControl({type:'MATCH_MENU',paused:true});
            return;
        }
        this.isPaused=paused;this.input.reset();this.remoteClientInput=null;
        this.input.isMenuNavigationActive=paused;
        this.lastTime=performance.now();
        if(!paused) {
            this.ui.pauseModal.querySelector('.menu-container > div').textContent='PARTIDO EN PAUSA';
            document.querySelector('#btn-resume span').textContent='Reanudar partido';
        }
        if(this.squads.modal.style.display!=='flex')this.ui.pauseModal.style.display=paused?'flex':'none';
        if(paused)this.ui.initScreenFocus();
        if(this.network.isHost && !fromHost)this.network.sendControl({type:'MATCH_MENU',paused});
    }
    handleNetworkControl(packet) {
        if(this.network.isHost) {
            if(packet.type==='PAUSE_REQUEST')this.setMatchPaused(!!packet.paused);
            if(packet.type==='SQUAD_EDIT' && this.isPaused)this.squads.editing.team2=!!packet.editing;
            if(packet.type==='SQUAD_REQUEST') {
                const error=this.squads.apply('team2',packet.draft);
                if(!error)this.squads.broadcast();
                this.network.sendControl({type:'SQUAD_RESULT',error});
            }
        } else if(this.network.mode==='LAN_CLIENT') {
            if(packet.type==='MATCH_START' && window.USF.TeamsData.TEAMS[packet.team1] && window.USF.TeamsData.TEAMS[packet.team2])this.startMatch(packet.team1,packet.team2,'LAN_CLIENT');
            if(packet.type==='MATCH_MENU')this.setMatchPaused(!!packet.paused,true);
            if(packet.type==='SQUAD_EDIT')this.squads.editing.team1=!!packet.editing;
            if(packet.type==='SQUAD_SYNC') {this.squads.sync('team1',packet.team1);this.squads.sync('team2',packet.team2);}
            if(packet.type==='SQUAD_RESULT') {
                this.squads.message(packet.error||'Plantilla confirmada por el anfitrión.');
                if(!packet.error && this.squads.draft) {this.squads.draft=structuredClone(this.squads.snapshot(this.team2));this.squads.render();}
            }
            if(packet.type==='CARD') {
                const player=this[packet.teamId]?.players?.find(p=>p.playerData.id===packet.id);
                if(player) {
                    this.rules.cards[packet.teamId][packet.id]=packet.cardType;
                    if(packet.cardType==='RED' && !player.isSentOff) {
                        player.isSentOff=true;
                        this.handleSendingOff(player);
                    }
                    const title=packet.cardType==='RED'?'¡TARJETA ROJA!':'TARJETA AMARILLA';
                    this.ui.showEventBanner(title,`${player.playerData.name} · ${packet.reason}`,3);
                }
            }
            if(packet.type==='INJURY') {
                const player=this[packet.teamId]?.players?.find(p=>p.playerData.id===packet.id);
                if(player)this.registerInjury(player,packet.injury,true,false);
            }
        }
    }
    registerInjury(player, injury, announce = true, broadcast = false) {
        if(!player || !injury)return;
        const severity=THREE.MathUtils.clamp(Number(injury.severity)||.3,.15,.95);
        player.injury={type:injury.type||'GOLPE',severity,minute:injury.minute??Math.floor(this.matchSeconds/60)};
        player.model?.setInjured(true);
        if(announce) {
            const loss=Math.round(severity*((player.role||player.playerData.pos)==='GK'?60:45));
            const detail=`${player.playerData.name.toUpperCase()} · ${player.injury.type} · rendimiento -${loss}% · cambio recomendado`;
            this.ui.showEventBanner('✚ JUGADOR LESIONADO',detail,3.8);
            this.ui.showToast('Jugador lesionado',detail,'✚','disconnected',6500);
        }
        if(broadcast&&this.network.isHost)this.network.sendControl({type:'INJURY',teamId:player.teamId,id:player.playerData.id,injury:player.injury});
    }
    createMatchStats() {
        const empty=()=>({yellowCards:0,shotsOnTarget:0,passes:0,saves:0,corners:0,possession:0});
        return {team1:empty(),team2:empty()};
    }
    recordMatchStat(teamId,key,amount=1) {
        if(this.network.mode==='LAN_CLIENT'||!this.matchStats?.[teamId]||!Object.hasOwn(this.matchStats[teamId],key))return;
        this.matchStats[teamId][key]+=amount;
    }
    showFinalStatistics() {
        this.ui.showMatchStats(this.team1.data,this.team2.data,this.rules.score,this.matchStats||this.createMatchStats());
    }
    handleSendingOff(player) {
        const team=this[player.teamId], live=team.players.filter(p=>!p.isSentOff);
        for(const key of ['owner','passTarget'])if(this.physics.ball[key]===player)this.physics.ball[key]=null;
        const indexKey=player.teamId==='team1'?'activeP1Index':'activeP2Index';
        if(team.players[this[indexKey]]===player)this[indexKey]=Math.max(0,team.players.indexOf(live.find(p=>p.role!=='GK')||live[0]));
        if(player.role==='GK' && live.length) {
            const emergency=live.find(p=>(p.role||p.playerData.pos)==='GK')||live.reduce((a,b)=>a.playerData.stats.DEF>b.playerData.stats.DEF?a:b);
            emergency.role='GK';
            const emptySlot=emergency.formationIndex;emergency.formationIndex=player.formationIndex;player.formationIndex=emptySlot;
        }
        if(live.length<7) {
            this.rules.matchState='FULL_TIME';this.rules.stateTimer=0;this.physics.freeze();
            this.ui.showEventBanner('PARTIDO SUSPENDIDO',`${team.data.name}: menos de siete jugadores`,10);
            this.showFinalStatistics();
        }
    }
    canLocallyControlSetPiece(asp) {
        if(!asp)return false;
        if(this.network.mode==='LOCAL_1V1')return true;
        if(this.network.mode==='LAN_CLIENT')return asp.teamId==='team2';
        return asp.teamId==='team1';
    }
    cycleRestartTarget(asp) {
        const options=asp.team.players.filter(p=>p!==asp.kicker&&!p.isSentOff)
            .sort((a,b)=>Math.hypot(a.x-asp.pos.x,a.z-asp.pos.z)-Math.hypot(b.x-asp.pos.x,b.z-asp.pos.z));
        if(!options.length)return;
        asp.passTarget=options[(options.indexOf(asp.passTarget)+1)%options.length];
        asp.aimAngle=Math.atan2(asp.passTarget.x-asp.pos.x,asp.passTarget.z-asp.pos.z);
        this.updateSetPiecePanel(asp,this.canLocallyControlSetPiece(asp));
    }
    updateSetPiecePanel(asp, canControl=this.canLocallyControlSetPiece(asp)) {
        const panel=document.getElementById('set-piece-panel');
        panel.hidden=!asp||!canControl;
        if(!asp||!canControl)return;
        const curvable=['FOUL','FREE_KICK','CORNER'].includes(asp.kind);
        const curve=THREE.MathUtils.clamp(Number(asp.curve)||0,-1,1);
        const power=THREE.MathUtils.clamp(Number(asp.chargePower)||0,0,1);
        const kindNames={PENALTY:'PENALTI',CORNER:'TIRO DE ESQUINA',THROW_IN:'SAQUE DE BANDA',GOAL_KICK:'SAQUE DE META',FOUL:'TIRO LIBRE',FREE_KICK:'TIRO LIBRE'};
        const targetName=asp.passTarget?.playerData?.name||asp.targetName||'Sin receptor seleccionado';
        const side=Math.abs(curve)<.05?'TIRO RECTO':curve<0?'↶ CURVA IZQUIERDA':'CURVA DERECHA ↷';
        document.getElementById('set-piece-kind').textContent=kindNames[asp.kind]||'BALÓN PARADO';
        document.getElementById('set-piece-side').textContent=side;
        document.getElementById('set-piece-target-name').textContent=targetName;
        document.getElementById('set-piece-curve-value').textContent=`${curve>0?'+':''}${Math.round(curve*100)}%`;
        document.getElementById('set-piece-power-value').textContent=`${Math.round(power*100)}%`;
        document.getElementById('set-piece-power-fill').style.width=`${Math.round(power*100)}%`;
        const range=document.getElementById('set-piece-curve-range');
        if(document.activeElement!==range)range.value=String(Math.round(curve*100));
        document.getElementById('set-piece-curve-control').hidden=!curvable;
        const instruction=asp.kind==='PENALTY'
            ? '← → apuntar · mantené TIRO para cargar · PASE para remate colocado'
            : `← → dirección${curvable?' · ↑ ↓ efecto':''} · mantené TIRO para potencia · CAMBIO recorre compañeros`;
        document.getElementById('set-piece-info').textContent=instruction;
        for(const id of ['btn-curve-left','btn-curve-reset','btn-curve-right'])document.getElementById(id).hidden=!curvable;
        const targetButton=document.getElementById('btn-restart-target');
        targetButton.hidden=asp.kind==='PENALTY';
        targetButton.querySelector('span').textContent=asp.passTarget||asp.targetName?'Siguiente receptor':'Elegir receptor';
    }
    setupInitialMenu() {
        // En el menú principal, la cámara orbita suavemente el estadio
        this.isMenuState = true;

        // Auto-conexión si se pasa enlace de sala: ?room=XXXX o ?join=XXXX
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            try {
                const params = new URLSearchParams(window.location.search);
                const roomParam = params.get('room') || params.get('join');
                if (roomParam && roomParam.trim().length >= 4) {
                    const roomCode = roomParam.trim().toUpperCase();
                    setTimeout(() => {
                        this.ui.showLanModal();
                        const joinInput = document.getElementById('lan-code-input');
                        if (joinInput) joinInput.value = roomCode;
                        this.initLANGuest(roomCode);
                    }, 400);
                }
            } catch (e) {
                console.warn('[USF] Error parseando URL query room:', e);
            }
        }
    }

    startMatch(team1Id, team2Id, mode = 'AI') {
        this.cancelTransientState();
        this.networkTargets = null;
        this.isPaused = false;
        this.half = 1;
        this.stoppageAccumulated = { 1: 0, 2: 0 };
        this.addedMinutesAnnounced = { 1: 0, 2: 0 };
        this.activeSetPiece = null;
        this.input.localMultiplayer = mode === 'LOCAL_1V1';
        this.rules.cards = {team1:{},team2:{}};
        this.rules.foulCounts = {team1:{},team2:{}};
        this.rules.attacksRight = {team1:true,team2:false};
        this.activeP1Index = this.activeP2Index = 9;
        document.body.classList.add('playing');
        this.ui.hideAllMenus();
        this.ui.pauseModal.querySelector('.menu-container > div').textContent = 'PARTIDO EN PAUSA';
        this.network.mode = mode;
        this.isMenuState = false;
        this.input.isMenuNavigationActive = false;

        const allTeams = window.USF.TeamsData.TEAMS;
        const t1Data = allTeams[team1Id] || allTeams['real_madrid'];
        const t2Data = allTeams[team2Id] || allTeams['barcelona'];

        // Limpiar jugadores previos de la escena
        while (this.renderer.playersGroup.children.length > 0) {
            const mesh = this.renderer.playersGroup.children[0];
            mesh.traverse(object => {
                object.geometry?.dispose();
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                for(const m of materials) { m?.map?.dispose(); m?.dispose(); }
            });
            this.renderer.playersGroup.remove(mesh);
        }

        // Instanciar Equipo 1 (Ataca hacia la derecha)
        this.team1 = {
            id: 'team1',
            data: t1Data,
            formation: t1Data.formation,
            attacksRight: true,
            players: []
        };

        t1Data.players.forEach((pData, idx) => {
            const isGK = (pData.pos === 'GK');
            const model = new window.USF.PlayerModel(pData, t1Data, isGK);
            this.renderer.playersGroup.add(model.mesh);

            this.team1.players.push({
                teamId: 'team1',
                playerData: pData,
                model: model,
                formationIndex: idx,
                x: 0,
                z: 0,
                vx: 0,
                vz: 0,
                facingAngle: 0,
                stamina: 100,
                injury: null,
                isSentOff: false
            });
        });

        // Instanciar Equipo 2 (Ataca hacia la izquierda)
        this.team2 = {
            id: 'team2',
            data: t2Data,
            formation: t2Data.formation,
            attacksRight: false,
            players: []
        };

        t2Data.players.forEach((pData, idx) => {
            const isGK = (pData.pos === 'GK');
            const model = new window.USF.PlayerModel(pData, t2Data, isGK);
            this.renderer.playersGroup.add(model.mesh);

            this.team2.players.push({
                teamId: 'team2',
                playerData: pData,
                model: model,
                formationIndex: idx,
                x: 0,
                z: 0,
                vx: 0,
                vz: 0,
                facingAngle: Math.PI,
                stamina: 100,
                injury: null,
                isSentOff: false
            });
        });

        this.assignFormationSlots(this.team1);
        this.assignFormationSlots(this.team2);
        this.squads.reset();
        // Referencias mutuas para la IA
        this.team1.opponents = this.team2.players;
        this.team2.opponents = this.team1.players;

        this.rules.score = { team1: 0, team2: 0 };
        this.matchStats=this.createMatchStats();
        this.matchSeconds = 0;
        this.resetPositionsForKickoff('team1');

        this.ui.setupMatchHud(t1Data, t2Data);
        this.isRunning = true;
        this.sound.playWhistle('short');
        if(this.network.isHost)this.network.sendControl({type:'MATCH_START',team1:team1Id,team2:team2Id});
        this.setMatchPaused(true,mode==='LAN_CLIENT');
        this.ui.pauseModal.querySelector('.menu-container > div').textContent='PREPARAR PARTIDO';
        document.querySelector('#btn-resume span').textContent='Comenzar partido';
    }

    // Posicionamiento de saque inicial (Kickoff)
    resetPositionsForKickoff(kickingTeamId = 'team1') {
        this.physics.resetBall(0, 0.22, 0);
        this.rules.matchState = 'KICKOFF';
        this.rules.restartTeam = kickingTeamId;
        this.rules.restartPos = {x:0,z:0};
        this.rules.stateTimer = 1;
        this.physics.freeze();

        // Posicionar jugadores en sus mitades reglamentarias
        const posFormation = (team) => {
            const coords = window.USF.TeamsData.FORMATIONS[team.formation || '4-3-3'];
            const dir = team.attacksRight ? 1 : -1;

            team.players.forEach((p, idx) => {
                const c = coords[p.formationIndex] || { x: 0, z: 0 };
                // En kickoff los jugadores deben estar estrictamente en su mitad
                const clampedX = -Math.max(10, Math.abs(c.x)*44) * dir;
                p.x = clampedX;
                p.z = c.z * 28.0;
                p.vx = 0;
                p.vz = 0;
                p.facingAngle = dir > 0 ? Math.PI/2 : -Math.PI/2;
                p.actionCooldown = 0; p.tackleTimer = 0; p.isTackling = false; p.holdTimer = 0;

                if (p.model) {
                    p.model.mesh.position.set(p.x, 0, p.z);
                    p.model.mesh.rotation.y = p.facingAngle;
                    p.model.currentAnim = 'IDLE';
                }
            });
        };

        posFormation(this.team1);
        posFormation(this.team2);

        // Colocar al delantero del equipo que saca junto al balón
        const kickingTeam = (kickingTeamId === 'team1') ? this.team1 : this.team2;
        const striker = kickingTeam.players.find(p => p.playerData.pos === 'ST' && !p.isSentOff) || kickingTeam.players.find(p=>!p.isSentOff);
        if (striker) {
            striker.x = (kickingTeam.attacksRight ? -0.7 : 0.7);
            striker.z = 0;
            if (striker.model) striker.model.mesh.position.set(striker.x, 0, striker.z);
            this.physics.ball.lastKicker = striker;
        }

        if (kickingTeamId === 'team1') this.activeP1Index = kickingTeam.players.indexOf(striker);
        else this.activeP2Index = kickingTeam.players.indexOf(striker);
    }

    // --- Servidor LAN Host ---
    initLANHost() {
        this.network.startHost(
            (roomCode) => {
                const inviteLink = (typeof this.network.getInviteLink === 'function') ? this.network.getInviteLink(roomCode) : '';
                if (this.ui && typeof this.ui.setRoomCodeDisplay === 'function') {
                    this.ui.setRoomCodeDisplay(roomCode, inviteLink);
                } else {
                    const display = document.getElementById('lan-room-code-display');
                    if (display) display.innerText = roomCode;
                }
                const status = document.getElementById('lan-status');
                if (status) status.innerText = `Esperando al segundo jugador...`;
            },
            () => {
                const status = document.getElementById('lan-status');
                if (status) status.innerText = `¡Jugador 2 Conectado! Iniciando partido...`;
                setTimeout(() => {
                    this.ui.hideAllMenus();
                    this.startMatch('real_madrid', 'barcelona', 'LAN_HOST');
                }, 1000);
            }
        );
    }

    // --- Cliente LAN Guest ---
    initLANGuest(roomCode) {
        const status = document.getElementById('lan-status');
        if (status) status.innerText = `Conectando con Host [${roomCode}]...`;

        this.network.joinRoom(roomCode,
            () => {
                // El host es quien crea el partido y envía MATCH_START. Iniciar
                // también aquí duplicaba todos los modelos y el estado del guest.
                if (status) status.innerText = `¡Conectado! Esperando al anfitrión...`;
            },
            (err) => {
                if (status) status.innerText = `Error al conectar: ${err}`;
            }
        );
    }

    // Sincronización de cliente LAN con datos del Host
    applyNetworkState(packet) {
        if (!packet || !this.team1 || !this.team2) return;

        const ballData = Array.isArray(packet.b)
            ? {x:packet.b[0],y:packet.b[1],z:packet.b[2],vx:packet.b[3],vy:packet.b[4],vz:packet.b[5]}
            : packet.b;
        const playerData = (packet.p || []).map(player => Array.isArray(player) ? {
            x:player[0],z:player[1],fa:player[2],vx:player[3],vz:player[4],stamina:player[5],red:!!player[6],injury:player[7]||0
        } : player);
        const score = Array.isArray(packet.s) ? {team1:packet.s[0],team2:packet.s[1]} : packet.score;
        const active = Array.isArray(packet.a) ? packet.a : [packet.active1,packet.active2];
        const rawSetPiece = packet.sp ?? packet.setPiece;
        const sp = Array.isArray(rawSetPiece) ? {
            kind:rawSetPiece[0],teamId:rawSetPiece[1],pos:{x:rawSetPiece[2],z:rawSetPiece[3]},
            aimAngle:rawSetPiece[4],curve:rawSetPiece[5],chargePower:rawSetPiece[6],
            kickerIndex:rawSetPiece[7],targetName:rawSetPiece[8]
        } : rawSetPiece;

        this.networkTargets = {ball:ballData,players:playerData,receivedAt:performance.now()};
        const previousState=this.rules.matchState;
        this.rules.matchState = packet.g ?? packet.state;
        this.activeP1Index = active[0] ?? this.activeP1Index;
        this.activeP2Index = active[1] ?? this.activeP2Index;
        this.half = packet.h ?? packet.half ?? 1;
        this.rules.score = score || this.rules.score;
        this.rules.cards = packet.cards || this.rules.cards;
        if(Array.isArray(packet.ms)) {
            const decode=offset=>({yellowCards:packet.ms[offset]||0,shotsOnTarget:packet.ms[offset+1]||0,passes:packet.ms[offset+2]||0,
                saves:packet.ms[offset+3]||0,corners:packet.ms[offset+4]||0,possession:packet.ms[offset+5]||0});
            this.matchStats={team1:decode(0),team2:decode(6)};
        } else if(packet.ms)this.matchStats=packet.ms;
        this.remoteSetPiece = sp;
        const canControlSetPiece=this.canLocallyControlSetPiece(sp);
        this.renderer.setPieceCameraConfig=canControlSetPiece && sp && ['FOUL','FREE_KICK','PENALTY','CORNER'].includes(sp.kind) ? {...sp,pos:sp.pos,team:this[sp.teamId],kicker:this[sp.teamId].players[sp.kickerIndex],dir:this[sp.teamId].attacksRight?1:-1} : null;
        this.renderer.updateSetPieceAimGuide(sp?.pos,sp?.aimAngle||0,!!sp&&canControlSetPiece,sp?.chargePower||0,sp?.curve||0);
        this.updateSetPiecePanel(sp,canControlSetPiece);
        this.team1.attacksRight=this.half===1;this.team2.attacksRight=this.half!==1;
        this.matchSeconds = packet.t ?? packet.time;
        this.ui.updateScoreboard(this.rules.score.team1,this.rules.score.team2,this.matchSeconds);

        const allPlayers = [...this.team1.players,...this.team2.players];
        playerData.forEach((target,index) => {
            const player = allPlayers[index];
            if (!player) return;
            player.stamina = target.stamina ?? player.stamina;
            player.isSentOff = !!target.red;
            const packedInjury=Number(target.injury)||0;
            if(packedInjury>0) {
                const types={1:'MUSCULAR',2:'TOBILLO',3:'GOLPE',4:'HOMBRO'};
                const severity=(packedInjury%100)/100;
                player.injury={type:types[Math.floor(packedInjury/100)]||'GOLPE',severity};
            } else player.injury=null;
            player.model?.setInjured(!!player.injury);
            player.model.mesh.visible = !player.isSentOff;
        });
        if(previousState!=='FULL_TIME'&&this.rules.matchState==='FULL_TIME')this.showFinalStatistics();
    }

    interpolateNetworkState(dt) {
        const targets = this.networkTargets;
        if (!targets) return;
        const alpha = 1 - Math.exp(-Math.min(dt,.05) * 18);
        const age = Math.min(.1,Math.max(0,(performance.now()-targets.receivedAt)/1000));
        const ball = this.physics.ball, targetBall = targets.ball;
        if (targetBall) {
            ball.x += ((targetBall.x+(targetBall.vx||0)*age)-ball.x)*alpha;
            ball.y += ((targetBall.y+(targetBall.vy||0)*age)-ball.y)*alpha;
            ball.z += ((targetBall.z+(targetBall.vz||0)*age)-ball.z)*alpha;
            ball.vx=targetBall.vx||0;ball.vy=targetBall.vy||0;ball.vz=targetBall.vz||0;
        }
        const allPlayers=[...this.team1.players,...this.team2.players];
        targets.players.forEach((target,index)=>{
            const player=allPlayers[index];
            if(!player)return;
            const predictedX=target.x+(target.vx||0)*age;
            const predictedZ=target.z+(target.vz||0)*age;
            player.x+=(predictedX-player.x)*alpha;
            player.z+=(predictedZ-player.z)*alpha;
            const angleDelta=Math.atan2(Math.sin(target.fa-player.facingAngle),Math.cos(target.fa-player.facingAngle));
            player.facingAngle+=angleDelta*alpha;
            player.vx=target.vx||0;player.vz=target.vz||0;
            player.model.updateAnimation(dt,Math.hypot(player.vx,player.vz),player.facingAngle);
            player.model.mesh.position.set(player.x,0,player.z);
            player.model.mesh.rotation.y=player.facingAngle;
            player.model.setSelected(index===11+this.activeP2Index,0xFF2E55);
        });
    }

    // El NetworkManager decide la frecuencia adaptativa antes de construirlo.
    buildHostStatePacket() {
        const all = [...this.team1.players, ...this.team2.players];
        const injuryCodes={MUSCULAR:1,TOBILLO:2,GOLPE:3,HOMBRO:4};
        const pData = all.map(p => ({
            x: Math.round(p.x * 100) / 100,
            z: Math.round(p.z * 100) / 100,
            fa: Math.round(p.facingAngle * 100) / 100,
            red: p.isSentOff, role:p.role, slot:p.formationIndex, vx: p.vx, vz: p.vz, stamina: Math.round(p.stamina),
            injury:p.injury?(injuryCodes[p.injury.type]||3)*100+Math.min(99,Math.max(1,Math.round(p.injury.severity*100))):0
        }));

        return {
            b: this.physics.ball,
            score: this.rules.score,
            state: this.rules.matchState,
            time: this.matchSeconds,
            p: pData,
            cards:this.rules.cards,
            stats:this.matchStats,
            setPiece:this.activeSetPiece?{kind:this.activeSetPiece.kind,teamId:this.activeSetPiece.teamId,pos:this.activeSetPiece.pos,
                aimAngle:this.activeSetPiece.aimAngle,curve:this.activeSetPiece.curve,chargePower:this.activeSetPiece.chargePower,
                kickerIndex:this.activeSetPiece.team.players.indexOf(this.activeSetPiece.kicker),targetName:this.activeSetPiece.passTarget?.playerData.name}:null,
            active1: this.activeP1Index, active2: this.activeP2Index, half: this.half
        };
    }

    getSwitchCandidate(team, currentIdx, input = {}) {
        const ball = this.physics.ball;
        const current = team.players[currentIdx];
        const dir = team.attacksRight ? 1 : -1;
        const moving = Math.hypot(input.moveX || 0, input.moveZ || 0);
        const predicted = {x: THREE.MathUtils.clamp(ball.x + (ball.vx || 0) * .3, -52, 52),
            z: THREE.MathUtils.clamp(ball.z + (ball.vz || 0) * .3, -34, 34)};
        const state = this.selectionStates?.[team.id];
        let options = team.players.map((p, i) => ({p, i})).filter(({p,i}) =>
            i !== currentIdx && !p.isSentOff && (p.role||p.playerData.pos) !== 'GK' && !p.isTackling && p.model?.currentAnim !== 'FOUL_FALL');
        if (!options.length) options = team.players.map((p,i)=>({p,i})).filter(({p,i})=>i!==currentIdx&&!p.isSentOff&&(p.role||p.playerData.pos)!=='GK');
        const directional = moving > .3 && current;
        for (const option of options) {
            const {p} = option;
            const dx = p.x - (current?.x || 0), dz = p.z - (current?.z || 0), distance = Math.hypot(dx,dz);
            option.alignment = directional ? (dx * input.moveX + dz * input.moveZ) / Math.max(.01, distance * moving) : 0;
            const interceptTime = Math.hypot(p.x-predicted.x,p.z-predicted.z)/(4.2+p.playerData.stats.VEL/99*3.6);
            const goalSide = (p.x - ball.x) * dir < 0;
            option.score = interceptTime + (directional ? (1-option.alignment)*5 + distance*.025 : 0)
                - (!ball.owner || ball.owner.teamId!==team.id ? (goalSide ? .35 : 0) : 0)
                + (state?.history.some(h=>h.index===option.i&&state.time-h.time<1.2) ? 1.5 : 0);
        }
        if (directional && options.some(o=>o.alignment>.25)) options=options.filter(o=>o.alignment>.25);
        options.sort((a,b)=>a.score-b.score || a.i-b.i);
        return options[0]?.i ?? (current && !current.isSentOff ? currentIdx : team.players.findIndex(p=>!p.isSentOff));
    }
    autoSwitchActivePlayer(team, currentIdx, input = {}, dt = 1/60) {
        this.selectionStates ||= {};
        const state = this.selectionStates[team.id] ||= {time:0,lock:0,owner:null,pending:null,passTarget:null,history:[]};
        state.time += dt; state.lock = Math.max(0,state.lock-dt);
        state.history = state.history.filter(h=>state.time-h.time<1.2);
        const ball = this.physics.ball, owner = ball.owner;
        const eligible = p => p && p.teamId===team.id && !p.isSentOff && (p.role||p.playerData.pos)!=='GK';
        if (state.owner !== owner) {
            state.owner = owner;
            state.pending = eligible(owner) ? owner : null;
        }
        if (state.passTarget !== ball.passTarget) {state.passTarget=ball.passTarget;state.passHandled=false;}
        // Manual intent wins over a simultaneous reception and cannot be immediately undone.
        if (input.switchPlayer || !team.players[currentIdx] || team.players[currentIdx].isSentOff) {
            const next = this.getSwitchCandidate(team,currentIdx,input);
            state.history.push({index:currentIdx,time:state.time});
            state.lock = .8; state.pending = null; state.passHandled = true;
            return next < 0 ? currentIdx : next;
        }
        if (state.lock>0) return currentIdx;
        if (eligible(state.pending) && state.pending===owner) {
            const next=team.players.indexOf(owner);state.pending=null;
            return next;
        }
        // Hand control to the intended receiver once the pass has left the passer's feet.
        if (!owner && eligible(ball.passTarget) && !state.passHandled && ball.lastKicker?.teamId===team.id &&
            Math.hypot(ball.x-ball.lastKicker.x,ball.z-ball.lastKicker.z)>2.5) {
            state.passHandled=true;
            return team.players.indexOf(ball.passTarget);
        }
        return currentIdx;
    }
    updateCameraContext() {
        const client = this.network.mode === 'LAN_CLIENT';
        // Shared local screen follows P1; a LAN guest follows their own P2.
        const team = client ? this.team2 : this.team1;
        this.renderer.cameraContext = {player:team?.players[client?this.activeP2Index:this.activeP1Index],
            attacksRight:client?this.half===2:team?.attacksRight};
    }

    assignFormationSlots(team) {
        const slots=window.USF.TeamsData.FORMATIONS[team.formation];
        const available=new Set(slots.map((_,i)=>i));
        const pending=[];
        for(const p of team.players) {
            const exact=[...available].find(i=>slots[i].role===p.playerData.pos);
            if(exact===undefined)pending.push(p);
            else {p.formationIndex=exact;available.delete(exact);}
        }
        for(const p of pending) {const index=available.values().next().value;p.formationIndex=index;available.delete(index);}
        for(const p of team.players)p.role=slots[p.formationIndex].role;
    }
    recordStoppage(kind) {
        if (!this.stoppageAccumulated) this.stoppageAccumulated = { 1: 0, 2: 0 };
        const h = this.half || 1;
        const weights = {
            'CORNER': 26,
            'FOUL': 32,
            'PENALTY': 55,
            'THROW_IN': 18,
            'GOAL': 35,
            'GOAL_KICK': 22,
            'OFFSIDE': 20
        };
        this.stoppageAccumulated[h] = (this.stoppageAccumulated[h] || 0) + (weights[kind] || 20);
    }
    cancelTransientState() {
        this.goalDelay=null;this.halfTimeDelay=0;this.hitStopTimer=0;
        this.selectionStates = {};
        this.activeSetPiece = null;
        this.remoteSetPiece=null;this.pendingCurve=undefined;this.pendingRestartTarget=false;
        this.updateSetPiecePanel(null);
        if (this.physics?.ball) this.physics.ball.isSetPieceActive = false;
        if (this.renderer) this.renderer.setPieceCameraConfig = null;
        if (this.team1 && this.team2) {
            for (const p of [...this.team1.players, ...this.team2.players]) {
                p.isWallDefender = false;
                p.isBoxAttacker = false;
                p.wallPos = null;
                p.boxTargetPos = null;
            }
        }
        this.renderer?.updateSetPieceAimGuide(null, 0, false);
        this.ui?.updateControlHint('WASD mover · K pase · J tiro · Q cambiar · Shift correr · C cámara · Esc pausa');
        this.replay.onReplayComplete=null;this.replay.stopReplay();
        this.replay.writeIndex=0;this.replay.isFull=false;
        this.remoteClientInput=null;
        this.input.reset();
        if(this.ui.bannerTimer)clearTimeout(this.ui.bannerTimer);
        this.ui.eventBanner?.classList.remove('active');
    }
    executeSetPieceAction(actionType, power = 0.5) {
        if (!this.activeSetPiece) return;
        const asp = this.activeSetPiece;
        const kicker = asp.kicker;
        const team = asp.team;
        const opponents = asp.opponents;
        const kind = asp.kind;
        const dir = team.attacksRight ? 1 : -1;
        const aimAngle = asp.aimAngle;
        const dirVector = { x: Math.sin(aimAngle), z: Math.cos(aimAngle) };
        const techniqueFactor = this.ai.getInjuryFactor(kicker,'technique');
        if(['PENALTY','FOUL','FREE_KICK'].includes(kind)&&actionType==='SHOOT') {
            const goalX=dir*52.5,travel=(goalX-this.physics.ball.x)/(dirVector.x||dir*.001);
            const goalZ=this.physics.ball.z+dirVector.z*travel;
            if(travel>0&&Math.abs(goalZ)<=3.66)this.recordMatchStat(kicker.teamId,'shotsOnTarget',1);
        }

        this.activeSetPiece = null;
        if (this.physics?.ball) this.physics.ball.isSetPieceActive = false;
        this.updateSetPiecePanel(null);
        if (this.renderer) this.renderer.setPieceCameraConfig = null;
        for (const p of [...this.team1.players, ...this.team2.players]) {
            p.isWallDefender = false;
            p.isBoxAttacker = false;
            p.wallPos = null;
            p.boxTargetPos = null;
        }
        this.renderer.updateSetPieceAimGuide(null, 0, false);
        this.ui.updateControlHint('WASD mover · K pase · J tiro · Q cambiar · Shift correr · C cámara · Esc pausa');
        this.physics.unfreeze();
        this.physics.ball.owner = null;
        this.physics.ball.lastKicker = kicker;
        this.physics.ball.kickCooldown = 0.35;
        kicker.actionCooldown = 0.38;

        if(['FOUL','FREE_KICK','OFFSIDE','GOAL_KICK','CORNER'].includes(kind) && actionType!=='SHOOT') {
            const option=asp.passTarget && !asp.passTarget.isSentOff ? asp.passTarget : this.ai.findBestPassingOption(kicker,team,opponents,actionType==='THROUGH')?.teammate;
            if(option) {
                kicker.actionCooldown=0;
                this.ai.executePassToTeammate(kicker,option,this.physics.ball,actionType==='THROUGH',kicker.playerData.stats.PAS,team);
                return;
            }
        }
        if(actionType==='PASS'||actionType==='THROUGH'||kind==='CORNER'||kind==='THROW_IN')this.recordMatchStat(kicker.teamId,'passes',1);

        if (kind === 'PENALTY') {
            const lift = actionType === 'PASS' ? 0.03 : 0.06 + power * 0.20;
            const kickPower = (actionType === 'PASS' ? 0.45 : Math.max(0.42, power)) * techniqueFactor;
            this.physics.kickBall(dirVector, kickPower, lift, (Math.cos(aimAngle)) * 0.15, kicker);
            kicker.model?.triggerKick(kickPower > 0.7);
            this.sound?.playKick(kickPower, kickPower > 0.85);
        } else if (kind === 'CORNER') {
            if (actionType === 'PASS') {
                this.physics.kickBall(dirVector, 0.42*techniqueFactor, 0.02, 0, kicker);
            } else {
                const lift = 0.30;
                const kickPower = (0.52 + power * 0.38) * techniqueFactor;
                const rawCurve=THREE.MathUtils.clamp(asp.curve||0,-1,1);
                const curve = Math.sign(rawCurve)*Math.pow(Math.abs(rawCurve),.82)*1.08;
                this.physics.kickBall(dirVector, kickPower, lift, curve, kicker);
            }
            kicker.model?.triggerKick(power > 0.6);
            this.sound?.playKick(power, power > 0.8);
        } else if (kind === 'THROW_IN') {
            const throwPower = (actionType === 'THROUGH' || power > 0.6 ? 0.62 : 0.38) * techniqueFactor;
            this.physics.kickBall(dirVector, throwPower, 0.12, 0, kicker);
            kicker.model?.triggerKick(false);
            this.sound?.playKick(0.35);
        } else if (kind === 'GOAL_KICK') {
            if (actionType === 'PASS') {
                this.physics.kickBall(dirVector, 0.42*techniqueFactor, 0.02, 0, kicker);
            } else {
                this.physics.kickBall(dirVector, 0.85*techniqueFactor, 0.32, 0, kicker);
            }
            kicker.model?.triggerKick(power > 0.6);
            this.sound?.playKick(0.8);
        } else {
            // FOUL / TIRO LIBRE
            if (actionType === 'SHOOT') {
                const distance=Math.hypot(dir*52.5-asp.pos.x,asp.pos.z);
                const lift = THREE.MathUtils.clamp(.17+distance*.003-power*.035,.18,.32);
                const kickPower = (0.30 + power * 0.65) * techniqueFactor;
                const rawCurve=THREE.MathUtils.clamp(asp.curve||0,-1,1);
                const curve = Math.sign(rawCurve)*Math.pow(Math.abs(rawCurve),.82)*1.12;
                this.physics.kickBall(dirVector, kickPower, lift, curve, kicker);
                this.physics.ball.wx *= -.65;
                this.physics.ball.wz *= -.65;
            } else if (actionType === 'THROUGH') {
                this.physics.kickBall(dirVector, 0.6*techniqueFactor, 0.18, 0, kicker);
            } else {
                this.physics.kickBall(dirVector, 0.45*techniqueFactor, 0.02, 0, kicker);
            }
            kicker.model?.triggerKick(power > 0.65);
            this.sound?.playKick(power, power > 0.8);
        }
    }
    prepareRestart(kind,teamId,pos) {
        const team=teamId==='team1'?this.team1:this.team2;
        const opponents=teamId==='team1'?this.team2:this.team1;
        const dir=team.attacksRight?1:-1;
        const candidates=team.players.filter(p=>!p.isSentOff && (kind==='GOAL_KICK'?(p.role||p.playerData.pos)==='GK':(p.role||p.playerData.pos)!=='GK'));
        const kicker=candidates.sort((a,b)=>Math.hypot(a.x-pos.x,a.z-pos.z)-Math.hypot(b.x-pos.x,b.z-pos.z))[0];
        if(!kicker)return;

        // Limpiar estados tácticos de jugadas a balón parado previas
        for(const p of [...team.players, ...opponents.players]) {
            p.isWallDefender = false;
            p.isBoxAttacker = false;
            p.wallPos = null;
            p.boxTargetPos = null;
        }

        this.physics.resetBall(pos.x,.22,pos.z);
        kicker.x=pos.x-dir*.65;kicker.z=pos.z;
        kicker.facingAngle=dir*Math.PI/2;
        if(kind==='THROW_IN' || kind==='CORNER') {
            kicker.x=pos.x;kicker.z=pos.z-Math.sign(pos.z)*.65;
            kicker.facingAngle=pos.z>0?Math.PI:0;
        }
        kicker.actionCooldown=0;kicker.vx=kicker.vz=0;
        for(const p of opponents.players) {
            const dx=p.x-pos.x,dz=p.z-pos.z,d=Math.hypot(dx,dz),radius=kind==='THROW_IN'?2.5:9.15;
            if(d<radius) {p.x=THREE.MathUtils.clamp(pos.x+(dx/(d||1)||-dir)*radius,-51,51);p.z=THREE.MathUtils.clamp(pos.z+dz/(d||1)*radius,-33,33);}
        }
        // Posicionamiento de córner: atacantes y defensores al área
        const opponentGoalX = dir * 52.5;
        if (kind === 'CORNER') {
            const boxAttackers = team.players
                .filter(p => !p.isSentOff && p !== kicker && (p.role||p.playerData.pos) !== 'GK')
                .slice(0, 3);
            const boxSlots = [
                { x: opponentGoalX - dir * 7.0, z: -2.0 },
                { x: opponentGoalX - dir * 9.5, z: 2.0 },
                { x: opponentGoalX - dir * 13.0, z: 0.0 }
            ];
            boxAttackers.forEach((p, idx) => {
                p.isBoxAttacker = true;
                p.boxTargetPos = { ...boxSlots[idx] };
                p.x = boxSlots[idx].x;
                p.z = boxSlots[idx].z;
                p.facingAngle = Math.atan2(pos.x - p.x, pos.z - p.z);
                p.vx = p.vz = 0;
            });
            const boxDefenders = opponents.players
                .filter(p => !p.isSentOff && (p.role||p.playerData.pos) !== 'GK')
                .slice(0, 3);
            boxDefenders.forEach((p, idx) => {
                p.isBoxAttacker = true;
                const defPos = { x: opponentGoalX - dir * (6.0 + idx * 2.5), z: (idx % 2 === 0 ? -1.8 : 1.8) * (idx + 1) };
                p.boxTargetPos = defPos;
                p.x = defPos.x;
                p.z = defPos.z;
                p.facingAngle = Math.atan2(pos.x - p.x, pos.z - p.z);
                p.vx = p.vz = 0;
            });
        }
        // Barrera defensiva en tiros libres dentro de 34m del arco rival
        const distToOpponentGoal = Math.hypot(opponentGoalX - pos.x, 0 - pos.z);
        if ((kind === 'FOUL' || kind === 'FREE_KICK') && distToOpponentGoal < 34) {
            const toGoalX = opponentGoalX - pos.x, toGoalZ = 0 - pos.z;
            const toGoalDist = Math.hypot(toGoalX, toGoalZ) || 1;
            const wallCenterX = pos.x + (toGoalX / toGoalDist) * 9.15;
            const wallCenterZ = pos.z + (toGoalZ / toGoalDist) * 9.15;
            const perpX = -toGoalZ / toGoalDist, perpZ = toGoalX / toGoalDist;
            const wallDefenders = opponents.players
                .filter(p => !p.isSentOff && (p.role||p.playerData.pos) !== 'GK')
                .sort((a,b) => Math.hypot(a.x - wallCenterX, a.z - wallCenterZ) - Math.hypot(b.x - wallCenterX, b.z - wallCenterZ))
                .slice(0, 3);
            const offsets = [0, 0.75, -0.75];
            wallDefenders.forEach((p, idx) => {
                const wx = THREE.MathUtils.clamp(wallCenterX + perpX * offsets[idx], -51, 51);
                const wz = THREE.MathUtils.clamp(wallCenterZ + perpZ * offsets[idx], -33, 33);
                p.isWallDefender = true;
                p.wallPos = { x: wx, z: wz };
                p.x = wx;
                p.z = wz;
                p.facingAngle = Math.atan2(pos.x - p.x, pos.z - p.z);
                p.vx = p.vz = 0;
            });
        }
        if(kind==='PENALTY') {
            for(const p of [...team.players,...opponents.players]) {
                if(p!==kicker && (p.role||p.playerData.pos)!=='GK') {
                    p.x=pos.x-dir*10;
                    p.z=THREE.MathUtils.clamp(p.z,-28,28);
                    p.facingAngle = dir * Math.PI / 2;
                }
            }
            const gk = opponents.players.find(p => !p.isSentOff && (p.role||p.playerData.pos) === 'GK');
            if (gk) {
                gk.x = opponentGoalX - dir * 0.15;
                gk.z = 0;
                gk.facingAngle = -dir * Math.PI / 2;
                gk.vx = gk.vz = 0;
            }
        }
        this.physics.ball.lastKicker=kicker;
        this.physics.ball.owner=kicker;
        this.physics.ball.restartExempt=['THROW_IN','CORNER','GOAL_KICK'].includes(kind);
        this.physics.unfreeze();
        if(teamId==='team1')this.activeP1Index=team.players.indexOf(kicker);
        else this.activeP2Index=team.players.indexOf(kicker);
        for(const p of [...team.players,...opponents.players])p.model?.mesh.position.set(p.x,0,p.z);
        
        if(kind==='KICKOFF') return;

        const isHuman = (teamId === 'team1') || (teamId === 'team2' && ['LOCAL_1V1','LAN_HOST','LAN_CLIENT'].includes(this.network.mode));
        if (isHuman) {
            this.physics.ball.isSetPieceActive = true;
            this.activeSetPiece = {
                kind,
                teamId,
                kicker,
                team,
                opponents,
                pos: { x: pos.x, z: pos.z },
                aimAngle: ['FOUL','FREE_KICK','PENALTY'].includes(kind)?Math.atan2(opponentGoalX-pos.x,-pos.z):kicker.facingAngle,
                curve:kind==='CORNER'?Math.sign(pos.z)*-.22:0,
                passTarget:null,
                chargePower: 0,
                isCharging: false,
                afkTimer: 30.0
            };
            this.physics.freeze();
            const canPresent=this.canLocallyControlSetPiece(this.activeSetPiece);
            if (canPresent && kind !== 'THROW_IN' && ['PENALTY', 'FOUL', 'FREE_KICK', 'CORNER'].includes(kind)) {
                this.renderer.setPieceCameraConfig = {
                    kind,
                    teamId,
                    kicker,
                    team,
                    opponents,
                    dir,
                    pos: { x: pos.x, z: pos.z },
                    aimAngle: this.activeSetPiece.aimAngle
                };
            } else {
                this.renderer.setPieceCameraConfig = null;
            }
        } else {
            this.physics.ball.isSetPieceActive = false;
            this.renderer.setPieceCameraConfig = null;
            if(kind==='PENALTY')this.ai.executeKick(kicker,this.physics.ball,'SHOOT',.75,team);
            else this.ai.executePass(kicker,this.physics.ball,team,opponents,kind==='CORNER');
        }
    }
    updateHud(input={}) {
        this.updateCameraContext();
        const addedMinutes = this.half === 1 ? (this.addedMinutesAnnounced?.[1] || 0) : (this.addedMinutesAnnounced?.[2] || 0);
        this.ui.updateScoreboard(this.rules.score.team1,this.rules.score.team2,this.matchSeconds,addedMinutes);
        const client=this.network.mode==='LAN_CLIENT';
        const hudPlayer=client?this.team2.players[this.activeP2Index]:this.team1.players[this.activeP1Index];
        const displayedSetPiece=client?this.remoteSetPiece:this.activeSetPiece;
        const displayedSetPiecePower=this.canLocallyControlSetPiece(displayedSetPiece)?displayedSetPiece?.chargePower||0:0;
        const hudPower=displayedSetPiece?(this.canLocallyControlSetPiece(displayedSetPiece)?Math.max(displayedSetPiecePower,input.currentShootPower||0):0):(input.currentShootPower||0);
        this.ui.updateActivePlayer(hudPlayer,hudPower,this.rules.cards[hudPlayer.teamId][hudPlayer.playerData.id]);
        if(this.input.isTouchDevice) {
            const allPlayers=[...this.team1.players,...this.team2.players].filter(player=>!player.isSentOff);
            const nearest=allPlayers.reduce((best,player)=>{
                const distance=Math.hypot(player.x-this.physics.ball.x,player.z-this.physics.ball.z);
                return !best||distance<best.distance?{player,distance}:best;
            },null);
            const localTeam=client?this.team2:this.team1;
            // El host conoce al dueño exacto; el cliente WebRTC lo deduce por
            // proximidad porque los snapshots no envían referencias de objetos.
            const owner=client?null:this.physics.ball.owner;
            const opponentControlsBall=owner
                ? owner.teamId!==localTeam.id
                : nearest?.distance<1.7&&nearest.player.teamId!==localTeam.id&&this.physics.ball.y<1.1;
            const touchContext=displayedSetPiece&&this.canLocallyControlSetPiece(displayedSetPiece)
                ? 'set-piece'
                : opponentControlsBall?'defense':'attack';
            this.input.setTouchContext(touchContext);
        }
        this.ui.renderRadar(this.team1.players,this.team2.players,this.physics.ball);
        const team = client ? this.team2 : this.team1;
        const active = client ? this.activeP2Index : this.activeP1Index;
        const candidate = this.getSwitchCandidate(team,active,input);
        const playable = this.rules.matchState === 'IN_PLAY' && !this.replay.isReplaying;
        const setPieceTarget=(this.canLocallyControlSetPiece(this.activeSetPiece)?this.activeSetPiece?.passTarget:null) || (client&&this.remoteSetPiece?.teamId==='team2'&&this.remoteSetPiece?.targetName
            ? this.team2.players.find(player=>player.playerData.name===this.remoteSetPiece.targetName)
            : null);
        for(const p of [...this.team1.players,...this.team2.players])p.model?.setSuggested(
            (playable && p===team.players[candidate] && candidate!==active) || p===setPieceTarget
        );
        const next = document.getElementById('next-player');
        if(next)next.textContent = playable && candidate!==active ? 'CAMBIO → ' + team.players[candidate].playerData.name : 'Q / LB · CAMBIAR JUGADOR';
        const isOnline = this.network.mode === 'LAN_HOST' || this.network.mode === 'LAN_CLIENT';
        let pingStr = '';
        if (isOnline && this.network.currentPing !== null) {
            const pingVal = Math.round(this.network.currentPing);
            const pingDot = pingVal < 60 ? '🟢' : pingVal < 120 ? '🟡' : '🔴';
            pingStr = ` · ${pingDot} ${pingVal}ms`;
        }
        const modeLabel = this.network.mode === 'AI' ? 'VS IA' : isOnline ? 'ONLINE 1v1' : '1v1 LOCAL';
        const status = document.getElementById('match-status');
        if (status) {
            const baseStatus = this.rules.matchState === 'FULL_TIME' ? 'FINAL' :
                               this.rules.matchState === 'HALF_TIME' ? 'DESCANSO' :
                               this.rules.matchState === 'KICKOFF' ? 'SAQUE INICIAL' :
                               `${this.half}º TIEMPO · ${modeLabel}`;
            status.textContent = baseStatus + pingStr;
        }
    }
    mainLoop(currentTime) {
        requestAnimationFrame(t=>this.mainLoop(t));
        const dt=Math.max(0,Math.min((currentTime-this.lastTime)/1000,.05));
        this.lastTime=currentTime;
        this.input.update(dt);
        if(this.isMenuState) {
            this.renderer.render(dt,{x:0,y:.22,z:0,wx:0,wy:0,wz:0,speed:0});return;
        }
        if(!this.isRunning)return;
        if(this.isPaused) {this.renderer.renderer.render(this.renderer.scene,this.renderer.camera);return;}
        const rawP1=this.input.getPlayerInput(0);
        const p1={...this.renderer.toWorldInput(rawP1),aimX:rawP1.moveX||0,aimY:rawP1.moveZ||0};
        if(this.network.mode==='LAN_CLIENT') {
            if(this.pendingRestartTarget){p1.switchPlayer=true;this.pendingRestartTarget=false;}
            if(this.pendingCurve!==undefined){p1.curveValue=this.pendingCurve;this.pendingCurve=undefined;}
            this.network.sendClientInput(p1,currentTime);
            this.interpolateNetworkState(dt);
            this.updateHud(p1);this.renderer.render(dt,this.physics.ball);return;
        }
        if(this.replay.isReplaying) {
            this.replay.update(dt,snapshot=>{
                Object.assign(this.physics.ball,snapshot.ball);
                const players=[...this.team1.players,...this.team2.players];
                snapshot.players.forEach((sp,i)=>{const p=players[i];p.x=sp.x;p.z=sp.z;p.model.mesh.position.set(sp.x,0,sp.z);p.model.mesh.rotation.y=sp.facingAngle;});
            });
        } else if(this.goalDelay!==null) {
            this.goalDelay-=dt;
            if(this.goalDelay<=0) {
                this.goalDelay=null;
                this.replay.startReplay(()=>this.resetPositionsForKickoff(this.rules.restartTeam));
            }
        } else if(this.rules.matchState==='HALF_TIME') {
            this.halfTimeDelay-=dt;
            if(this.halfTimeDelay<=0) {
                this.half=2;
                this.team1.attacksRight=false;this.team2.attacksRight=true;
                this.rules.attacksRight={team1:false,team2:true};
                for(const p of [...this.team1.players,...this.team2.players])p.stamina=Math.min(100,p.stamina+30);
                this.resetPositionsForKickoff('team2');
            }
        } else if(this.rules.matchState!=='FULL_TIME') {
            const remoteFresh=currentTime-(this.remoteInputTime||0)<300;
            const rawP2=this.input.getPlayerInput(1);
            const p2=this.network.mode==='LOCAL_1V1'?{...this.renderer.toWorldInput(rawP2),aimX:rawP2.moveX||0,aimY:rawP2.moveZ||0}:(remoteFresh?this.remoteClientInput:null);
            if(!this.activeSetPiece) {
                this.activeP1Index=this.autoSwitchActivePlayer(this.team1,this.activeP1Index,p1,dt);
                this.activeP2Index=this.autoSwitchActivePlayer(this.team2,this.activeP2Index,p2||{},dt);
            }
            
            // Control interactivo de balón parado para jugadores humanos
            if (this.activeSetPiece) {
                const asp = this.activeSetPiece;
                const activeInput = asp.teamId === 'team1' ? p1 : (p2 || {});
                const kicker = asp.kicker;
                const canPresent=this.canLocallyControlSetPiece(asp);
                const curvable=['FOUL','FREE_KICK','CORNER'].includes(asp.kind);
                kicker.x = asp.pos.x - Math.sin(asp.aimAngle) * 0.65;
                kicker.z = asp.pos.z - Math.cos(asp.aimAngle) * 0.65;
                kicker.vx = kicker.vz = 0;

                const aimX=activeInput.aimX||0, aimY=activeInput.aimY||0;
                if(Math.abs(aimX)>.15) {asp.aimAngle-=aimX*dt*(activeInput.sprint ? .24 : .65);asp.passTarget=null;}
                if(curvable&&Math.abs(aimY)>.15)asp.curve=THREE.MathUtils.clamp(asp.curve-aimY*dt*.9,-1,1);
                if(Number.isFinite(activeInput.curveValue)) {asp.curve=activeInput.curveValue;delete activeInput.curveValue;}
                if(activeInput.switchPlayer && asp.kind!=='PENALTY')this.cycleRestartTarget(asp);
                if(activeInput.shootHold) {
                    asp.isCharging = true;
                    asp.chargePower = Math.min(1.0, asp.chargePower + dt * 1.5);
                    activeInput.currentShootPower = asp.chargePower;
                }
                kicker.facingAngle = asp.aimAngle;
                if (kicker.model?.mesh) {
                    kicker.model.mesh.position.set(kicker.x, 0, kicker.z);
                    kicker.model.mesh.rotation.y = asp.aimAngle;
                }

                if (this.renderer.setPieceCameraConfig) {
                    this.renderer.setPieceCameraConfig.aimAngle = asp.aimAngle;
                }

                this.renderer.updateSetPieceAimGuide(asp.pos, asp.aimAngle, canPresent, asp.chargePower, asp.curve);
                this.updateSetPiecePanel(asp,canPresent);

                const isP2 = (asp.teamId === 'team2' && this.network.mode === 'LOCAL_1V1');
                const moveKeys = isP2 ? 'Flechas' : 'WASD';
                const passKey = isP2 ? 'Num 1' : 'K';
                const shootKey = isP2 ? 'Num 2' : 'J';
                const throughKey = isP2 ? 'Num 3' : 'L';
                let hint = `TIRO LIBRE: [${moveKeys}] Apuntar · [${passKey}] Pase · [${shootKey}] Mantener y soltar Disparo · [${throughKey}] Filtrado`;
                if (asp.kind === 'PENALTY') hint = `¡PENALTI!: [${moveKeys}] Apuntar al arco · [${shootKey}] Mantener y soltar Disparo · [${passKey}] Colocado`;
                else if (asp.kind === 'CORNER') hint = `TIRO DE ESQUINA: [${moveKeys}] Apuntar · [${shootKey}] Centro bombeado · [${passKey}] Pase en corto`;
                else if (asp.kind === 'THROW_IN') hint = `SAQUE DE BANDA: [${moveKeys}] Apuntar · [${passKey}] Saque al pie · [${throughKey}] Saque largo`;
                else if (asp.kind === 'GOAL_KICK') hint = `SAQUE DE META: [${moveKeys}] Apuntar · [${passKey}] Pase en corto · [${shootKey}] Despeje largo`;
                if(canPresent)this.ui.updateControlHint(hint);

                if (activeInput.shootReleased || (!activeInput.shootHold && asp.isCharging && asp.chargePower > 0.05)) {
                    this.executeSetPieceAction('SHOOT', Math.max(0.25, asp.chargePower));
                } else if (activeInput.pass) {
                    this.executeSetPieceAction('PASS', 0.4);
                } else if (activeInput.through) {
                    this.executeSetPieceAction('THROUGH', 0.6);
                } else {
                    asp.afkTimer -= dt;
                    if (asp.afkTimer <= 0) this.executeSetPieceAction('PASS', 0.4);
                }
            }

            // Gestión de Tiempo Añadido (Descuento)
            const addedMin1 = this.stoppageAccumulated?.[1] ? Math.max(1, Math.min(6, Math.round(this.stoppageAccumulated[1] / 60))) : 0;
            const targetEnd1 = 2700 + addedMin1 * 60;
            const addedMin2 = this.stoppageAccumulated?.[2] ? Math.max(1, Math.min(6, Math.round(this.stoppageAccumulated[2] / 60))) : 0;
            const targetEnd2 = 5400 + addedMin2 * 60;

            if(this.rules.matchState==='IN_PLAY') {
                this.physics.update(dt);
                const lastTeam=this.physics.ball.lastKicker?.teamId||'team1';
                this.rules.checkPitchBoundaries(this.physics.ball,lastTeam,this.physics);
                if(this.rules.matchState==='IN_PLAY') {
                    this.ai.updateTeam(this.team1,this.team2,this.physics.ball,dt,false,this.activeP1Index,p1);
                    this.ai.updateTeam(this.team2,this.team1,this.physics.ball,dt,this.network.mode==='AI',this.activeP2Index,p2);
                    this.ai.resolvePlayerCollisions([...this.team1.players,...this.team2.players]);
                    this.rules.checkPitchBoundaries(this.physics.ball,this.physics.ball.lastKicker?.teamId||lastTeam,this.physics);
                }
                if(this.rules.matchState==='IN_PLAY') {
                    const possessionTeam=this.physics.ball.owner?.teamId;
                    if(possessionTeam)this.recordMatchStat(possessionTeam,'possession',dt);
                    this.matchSeconds = Math.min(targetEnd2 + 60, this.matchSeconds + dt * this.timeScale);
                }
                this.replay.recordFrame(this.physics.ball,[...this.team1.players,...this.team2.players]);
            } else this.rules.update(dt,this.physics);
            if(this.remoteClientInput)for(const key of ['pass','through','tackle','switchPlayer','shootReleased','shootPressed'])this.remoteClientInput[key]=false;
            
            if(this.half===1) {
                if(this.matchSeconds>=2700 && addedMin1>0 && !this.addedMinutesAnnounced?.[1]) {
                    this.addedMinutesAnnounced[1] = addedMin1;
                    this.sound.playWhistle('short');
                    this.ui.showEventBanner('TIEMPO AÑADIDO', `+${addedMin1} MINUTOS`, 2.8);
                }
                if(this.matchSeconds>=targetEnd1 && this.rules.matchState==='IN_PLAY') {
                    this.matchSeconds=targetEnd1;this.rules.matchState='HALF_TIME';this.halfTimeDelay=3;
                    this.physics.freeze();this.sound.playWhistle('long');
                    this.ui.showEventBanner('DESCANSO','Cambio de campo · Segundo tiempo',3);
                }
            } else if(this.half===2) {
                if(this.matchSeconds>=5400 && addedMin2>0 && !this.addedMinutesAnnounced?.[2]) {
                    this.addedMinutesAnnounced[2] = addedMin2;
                    this.sound.playWhistle('short');
                    this.ui.showEventBanner('TIEMPO AÑADIDO', `+${addedMin2} MINUTOS`, 2.8);
                }
                if(this.matchSeconds>=targetEnd2 && this.rules.matchState==='IN_PLAY') {
                    this.matchSeconds=targetEnd2;this.rules.matchState='FULL_TIME';this.physics.freeze();
                    this.sound.playWhistle('triple');
                    this.ui.showEventBanner('FINAL DEL PARTIDO',this.rules.score.team1+' - '+this.rules.score.team2,8);
                    this.showFinalStatistics();
                }
            }
            this.rules.updateOfficials(dt,this.physics.ball,0,0);
        }
        this.team1.players.forEach((p,i)=>p.model?.setSelected(i===this.activeP1Index,0x00E5FF));
        this.team2.players.forEach((p,i)=>p.model?.setSelected(i===this.activeP2Index&&this.network.mode!=='AI',0xFF2E55));
        if(this.network.shouldSendHostState(currentTime))this.network.broadcastHostState(this.buildHostStatePacket(),currentTime);
        this.updateHud(p1);this.renderer.render(dt,this.physics.ball);
    }
}
window.USF.GameEngine = GameEngine;
