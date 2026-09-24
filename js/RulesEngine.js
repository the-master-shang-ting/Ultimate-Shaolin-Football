/**
 * Ultimate Shaolin Football (USF)
 * RulesEngine.js - Motor reglamentario (Fueras de juego, faltas, tarjetas, saques, penales y árbitros visuales)
 */

window.USF = window.USF || {};

class RulesEngine {
    constructor(scene, soundEngine) {
        this.scene = scene;
        this.soundEngine = soundEngine;

        this.matchState = 'KICKOFF'; // KICKOFF, IN_PLAY, THROW_IN, GOAL_KICK, CORNER, FOUL, PENALTY, GOAL
        this.stateTimer = 0;
        this.restartTeam = 'team1'; // Equipo al que le corresponde el saque
        this.restartPos = { x: 0, z: 0 };
        this.activeKicker = null;

        // Marcador y estadísticas
        this.score = { team1: 0, team2: 0 };
        this.cards = { team1: {}, team2: {} }; // Registro de amarillas y rojas por jugador

        // Callbacks
        this.onStateChange = null;
        this.onGoalEvent = null;
        this.onCardEvent = null;

        // Construir árbitros visuales 3D
        this.buildOfficials();
    }

    buildOfficials() {
        this.officialsGroup = new THREE.Group();
        this.scene.add(this.officialsGroup);

        // Árbitro Principal (Uniforme Neón Amarillo)
        this.referee = this.createOfficialMesh(0xFFFF00, 0x111111);
        this.referee.position.set(0, 0, 10);
        this.officialsGroup.add(this.referee);

        // Juez de Línea 1 (Banda Norte, z = -34.8)
        this.linesman1 = this.createOfficialMesh(0x00E5FF, 0x111111, true);
        this.linesman1.position.set(15, 0, -34.8);
        this.officialsGroup.add(this.linesman1);

        // Juez de Línea 2 (Banda Sur, z = +34.8)
        this.linesman2 = this.createOfficialMesh(0x00E5FF, 0x111111, true);
        this.linesman2.position.set(-15, 0, 34.8);
        this.officialsGroup.add(this.linesman2);
    }

    createOfficialMesh(shirtColor, shortsColor, hasFlag = false) {
        const group = new THREE.Group();
        const shirtMat = new THREE.MeshLambertMaterial({ color: shirtColor });
        const shortsMat = new THREE.MeshLambertMaterial({ color: shortsColor });
        const skinMat = new THREE.MeshLambertMaterial({ color: 0xe0ac69 });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.44, 0.22), shirtMat);
        torso.position.y = 1.25;
        torso.castShadow = true;
        group.add(torso);

        // Cabeza
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.22, 0.2), skinMat);
        head.position.y = 1.62;
        group.add(head);

        // Piernas
        const legMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
        const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), legMat);
        lLeg.position.set(-0.1, 0.4, 0);
        group.add(lLeg);

        const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), legMat);
        rLeg.position.set(0.1, 0.4, 0);
        group.add(rLeg);

        // Bandera para el juez de línea
        if (hasFlag) {
            const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.8), new THREE.MeshLambertMaterial({ color: 0xFFFFFF }));
            flagPole.position.set(0.3, 1.1, 0.2);
            flagPole.rotation.z = Math.PI / 4;
            group.add(flagPole);

            const flagCloth = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshBasicMaterial({ color: 0xFF9900, side: THREE.DoubleSide }));
            flagCloth.position.set(0.48, 1.28, 0.2);
            group.add(flagCloth);
            group.flagMesh = flagPole;
        }

        return group;
    }

    // Actualizar movimiento de los árbitros siguiendo el flujo del partido
    updateOfficials(dt, ballPos, offsideDefLine1, offsideDefLine2) {
        // 1. Árbitro principal: Se posiciona en diagonal respecto al balón (a unos 14m)
        const targetRefX = ballPos.x * 0.75 + (ballPos.z > 0 ? -7 : 7);
        const targetRefZ = ballPos.z * 0.45 + (ballPos.z > 0 ? -12 : 12);

        this.referee.position.x += (targetRefX - this.referee.position.x) * dt * 2.2;
        this.referee.position.z += (targetRefZ - this.referee.position.z) * dt * 2.2;
        this.referee.lookAt(ballPos.x, 1.0, ballPos.z);

        // 2. Juez de línea 1: Sigue la línea del último defensor del equipo 2
        const targetL1X = THREE.MathUtils.clamp(offsideDefLine2 || ballPos.x, -50, 50);
        this.linesman1.position.x += (targetL1X - this.linesman1.position.x) * dt * 3.5;
        this.linesman1.lookAt(this.linesman1.position.x, 0, 0);

        // 3. Juez de línea 2: Sigue la línea del último defensor del equipo 1
        const targetL2X = THREE.MathUtils.clamp(offsideDefLine1 || ballPos.x, -50, 50);
        this.linesman2.position.x += (targetL2X - this.linesman2.position.x) * dt * 3.5;
        this.linesman2.lookAt(this.linesman2.position.x, 0, 0);
    }

    // --- Verificación de Fuera de Juego (Offside) en el instante del Pase ---
    checkOffsideOnPass(passerTeamId, passerPos, receiverPos, defendingPlayers, receiverPlayer = null) {
        const isAttackingRight = this.attacksRight?.[passerTeamId] ?? (passerTeamId === 'team1');
        const receiverX = receiverPlayer ? receiverPlayer.x : receiverPos.x;

        // En campo propio nunca hay fuera de juego
        if ((isAttackingRight && receiverX <= 0) || (!isAttackingRight && receiverX >= 0)) {
            return false;
        }

        // El receptor debe estar más adelantado que el balón en la dirección de ataque
        const receiverAheadOfBall = isAttackingRight ? (receiverX > passerPos.x + 0.1) : (receiverX < passerPos.x - 0.1);
        if (!receiverAheadOfBall) return false;

        // Filtrar jugadores expulsados y ordenar defensores por cercanía a su propia línea de fondo
        const activeDefenders = defendingPlayers.filter(p => !p.isSentOff);
        if (activeDefenders.length === 0) return false;

        const sortedDefenders = [...activeDefenders].sort((a, b) => {
            return isAttackingRight ? (b.x - a.x) : (a.x - b.x);
        });

        // Penúltimo defensor (el último habitualmente es el guardameta)
        const penultDefender = sortedDefenders[1] || sortedDefenders[0];
        if (!penultDefender) return false;

        const isOffside = isAttackingRight
            ? (receiverX > penultDefender.x + 0.15)
            : (receiverX < penultDefender.x - 0.15);

        if (isOffside) {
            const awardedTeam = (passerTeamId === 'team1') ? 'team2' : 'team1';
            this.triggerOffside(awardedTeam, { x: receiverX, z: receiverPlayer ? receiverPlayer.z : receiverPos.z });
            return true;
        }
        return false;
    }

    triggerOffside(awardedTeam, foulPos) {
        this.matchState = 'OFFSIDE';
        this.restartTeam = awardedTeam;
        this.restartPos = { x: THREE.MathUtils.clamp(foulPos.x, -46.0, 46.0), z: THREE.MathUtils.clamp(foulPos.z, -30.0, 30.0) };
        this.stateTimer = 2.0;

        if (this.soundEngine) this.soundEngine.playWhistle('double');
        if (this.onStateChange) this.onStateChange('OFFSIDE', awardedTeam);
    }

    // --- Verificación Estricta de Límites de Cancha (Saques de Banda, Meta, Córner y Gol) ---
    checkPitchBoundaries(ball, lastKickerTeam, physicsEngine = null) {
        if (this.matchState !== 'IN_PLAY') return;

        const ballRadius = (physicsEngine && physicsEngine.radius) ? physicsEngine.radius : 0.22;
        const PITCH_HALF_L = 52.5;
        const PITCH_HALF_W = 34.0;
        const GOAL_HALF_W = (physicsEngine && physicsEngine.GOAL_HALF_WIDTH) ? physicsEngine.GOAL_HALF_WIDTH : 4.8;
        const GOAL_H = (physicsEngine && physicsEngine.GOAL_HEIGHT) ? physicsEngine.GOAL_HEIGHT : 2.9;

        // 1. Saque de Banda: la esfera completa debe rebasar la línea.
        if (Math.abs(ball.z) - ballRadius > PITCH_HALF_W) {
            const awardedTeam = (lastKickerTeam === 'team1') ? 'team2' : 'team1';
            this.matchState = 'THROW_IN';
            this.restartTeam = awardedTeam;

            // Congelar balón y fijar posición exacta sobre la línea de banda
            const exitX = THREE.MathUtils.clamp(ball.x, -51.0, 51.0);
            const exitZ = Math.sign(ball.z) * PITCH_HALF_W;

            ball.x = exitX;
            ball.z = exitZ;
            ball.y = ballRadius;
            ball.vx = 0;
            ball.vy = 0;
            ball.vz = 0;
            if (physicsEngine) physicsEngine.freeze();

            this.restartPos = { x: exitX, z: exitZ };
            this.stateTimer = 2.0;

            if (this.soundEngine) this.soundEngine.playWhistle('short');
            if (this.onStateChange) this.onStateChange('THROW_IN', awardedTeam);
            return;
        }

        // 2. Líneas de Meta / Fondo: la esfera completa debe rebasar la línea.
        if (Math.abs(ball.x) - ballRadius > PITCH_HALF_L) {
            const isRightGoalLine = ball.x > 0;

            // La física detecta el cruce del plano de gol, evitando goles por entrar desde atrás.
            if (ball.inNet) return;

            // Balón salió fuera del arco: Determinar Saque de Meta vs Tiro de Esquina
            ball.vx = 0;
            ball.vy = 0;
            ball.vz = 0;
            if (physicsEngine) physicsEngine.freeze();

            const side=isRightGoalLine?1:-1;
            const rightAttacker=(this.attacksRight?.team1 ?? true)?'team1':'team2';
            const attackingTeam=isRightGoalLine?rightAttacker:(rightAttacker==='team1'?'team2':'team1');
            const defendingTeam=attackingTeam==='team1'?'team2':'team1';
            if(lastKickerTeam===attackingTeam) {
                this.matchState='GOAL_KICK';this.restartTeam=defendingTeam;
                this.restartPos={x:47*side,z:Math.sign(ball.z||1)*4.5};
            } else {
                this.matchState='CORNER';this.restartTeam=attackingTeam;
                this.restartPos={x:52.1*side,z:Math.sign(ball.z||1)*33.6};
            }
            ball.x=this.restartPos.x;ball.z=this.restartPos.z;ball.y=ballRadius;

            this.stateTimer = 2.0;
            if (this.soundEngine) this.soundEngine.playWhistle('short');
            if (this.onStateChange) this.onStateChange(this.matchState, this.restartTeam);
        }
    }

    // Gestiona la pausa reglamentaria y deja el balón listo para el saque.
    // Se llama desde el bucle principal, no desde setTimeout, para evitar que
    // un partido pausado o una repetición alteren el estado en segundo plano.
    update(dt, physicsEngine) {
        const states=['THROW_IN','GOAL_KICK','CORNER','FOUL','PENALTY','OFFSIDE','KICKOFF'];
        if(!states.includes(this.matchState))return;
        this.stateTimer=Math.max(0,this.stateTimer-dt);
        if(this.stateTimer>0)return;
        const kind=this.matchState;
        this.matchState='IN_PLAY';
        this.onRestartReady?.(kind,this.restartTeam,this.restartPos);
        if(physicsEngine)physicsEngine.unfreeze();
        this.onStateChange?.('IN_PLAY',this.restartTeam);
    }

    // --- Evaluación de Faltas y Tarjetas en Entradas (Tackles) ---
    evaluateTackle(tackler, ballCarrier, ballPos, physicsEngine = null) {
        if (this.matchState !== 'IN_PLAY') return false;

        const distToBall = Math.hypot(tackler.x - ballPos.x, tackler.z - ballPos.z);
        const distToCarrier = Math.hypot(tackler.x - ballCarrier.x, tackler.z - ballCarrier.z);

        // Si el tackler impacta las piernas del rival antes del balón: FALTA
        if (distToCarrier < 1.15 && distToBall > 0.80) {
            const ownGoalSign = (this.attacksRight?.[tackler.teamId] ?? (tackler.teamId === 'team1')) ? -1 : 1;
            const isInsidePenBox = ballCarrier.x * ownGoalSign > 36 && Math.abs(ballCarrier.z) < 20.16;
            const awardedTeam = (tackler.teamId === 'team1') ? 'team2' : 'team1';

            // Activar tropiezo y caída al suelo del jugador agredido
            const dz = ballCarrier.z - tackler.z;
            if (ballCarrier.model && ballCarrier.model.triggerFoulFall) {
                ballCarrier.model.triggerFoulFall(Math.sign(dz) || 1);
            }
            ballCarrier.vx = 0;
            ballCarrier.vz = 0;

            if (physicsEngine) physicsEngine.freeze();

            // Entrada por detrás o con fuerza desmedida
            const dx = tackler.x-ballCarrier.x;
            const backDot = dx*Math.sin(ballCarrier.facingAngle)+(tackler.z-ballCarrier.z)*Math.cos(ballCarrier.facingAngle);
            const isFromBehind = backDot < -.3;

            if (isInsidePenBox) {
                // TIRO PENAL
                this.matchState = 'PENALTY';
                this.restartTeam = awardedTeam;
                this.restartPos = { x: (ballCarrier.x > 0 ? 41.5 : -41.5), z: 0 };
            } else {
                // TIRO LIBRE DIRECTO
                this.matchState = 'FOUL';
                this.restartTeam = awardedTeam;
                this.restartPos = { x: ballCarrier.x, z: ballCarrier.z };
            }

            // Sanción disciplinaria
            let cardType = null;
            const playerId = tackler.playerData.id;
            const teamCards = this.cards[tackler.teamId];

            if (isFromBehind && Math.hypot(tackler.vx || 0, tackler.vz || 0) > 7.5) {
                if (teamCards[playerId] === 'YELLOW') {
                    // ROJA DIRECTA O DOBLE AMARILLA
                    teamCards[playerId] = 'RED';
                    cardType = 'RED';
                    tackler.isSentOff = true;
                    if (tackler.model && tackler.model.mesh) tackler.model.mesh.visible = false;
                } else {
                    // TARJETA AMARILLA
                    teamCards[playerId] = 'YELLOW';
                    cardType = 'YELLOW';
                }
            }

            this.stateTimer = 2.5;
            if (this.soundEngine) this.soundEngine.playWhistle('long');
            if (this.onCardEvent && cardType) this.onCardEvent(cardType, tackler);
            if (this.onStateChange) this.onStateChange(this.matchState, awardedTeam);

            return true;
        }

        return false;
    }

    // Notificación de Gol
    registerGoal(scoringTeamId) {
        if (this.matchState !== 'IN_PLAY') return;

        this.matchState = 'GOAL';
        this.score[scoringTeamId]++;
        this.stateTimer = 3.5;

        // El equipo que recibió gol saca del medio
        this.restartTeam = (scoringTeamId === 'team1') ? 'team2' : 'team1';
        this.restartPos = { x: 0, z: 0 };

        if (this.soundEngine) {
            this.soundEngine.playGoalCheer();
            this.soundEngine.playWhistle('long');
        }

        if (this.onGoalEvent) this.onGoalEvent(scoringTeamId, this.score);
        if (this.onStateChange) this.onStateChange('GOAL', scoringTeamId);
    }
}

window.USF.RulesEngine = RulesEngine;
