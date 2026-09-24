/* Run in the game page: await runRegression(). No external test framework needed. */
window.runRegression = function () {
    const g=window.game,results=[];
    const assert=(condition,message)=>{if(!condition)throw new Error(message);};
    const test=(name,fn)=>{try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.message});}};
    const originalLoop=g.mainLoop,originalRender=g.renderer.render,originalRAF=window.requestAnimationFrame;
    window.requestAnimationFrame=()=>0;
    g.mainLoop=()=>{};g.renderer.render=()=>{};
    const fresh=()=>{g.startMatch('real_madrid','barcelona','AI');g.rules.update(1.1,g.physics);};
    const tick=(dt=.016)=>{g.lastTime=performance.now();originalLoop.call(g,g.lastTime+dt*1000);};
    fresh();
    test('Solo el seleccionado recibe el control manual',()=>{
        const manual=g.ai.executePlayerInput,field=g.ai.updateFieldPlayerAI,keeper=g.ai.updateGoalkeeperAI;
        const calls=[],ai=[],gks=[];
        g.ai.executePlayerInput=p=>calls.push(p);g.ai.updateFieldPlayerAI=p=>ai.push(p);g.ai.updateGoalkeeperAI=p=>gks.push(p);
        try {g.ai.updateTeam(g.team1,g.team2,g.physics.ball,.016,false,9,{moveX:1});
            assert(calls.length===1&&calls[0]===g.team1.players[9],'Entrada compartida');assert(ai.length===9&&gks.length===1,'Roles incompletos');
            calls.length=0;g.ai.updateTeam(g.team2,g.team1,g.physics.ball,.016,true,9,null);assert(calls.length===0,'Jugador IA omitido');
        } finally {g.ai.executePlayerInput=manual;g.ai.updateFieldPlayerAI=field;g.ai.updateGoalkeeperAI=keeper;}
    });
    test('Cambio y pase se disparan una vez por pulsación',()=>{
        g.input.keys={KeyQ:true,KeyK:true};g.input.update(.016);assert(g.input.getPlayerInput().switchPlayer&&g.input.getPlayerInput().pass,'No detectó pulsación');
        g.input.update(.016);assert(!g.input.getPlayerInput().switchPlayer&&!g.input.getPlayerInput().pass,'Repite al mantener');g.input.reset();
    });
    test('Teclado local separado y disparo al soltar',()=>{
        g.input.localMultiplayer=true;g.input.keys={ArrowRight:true,Numpad2:true};g.input.update(.3);
        assert(g.input.getPlayerInput(0).moveX===0&&g.input.getPlayerInput(1).moveX===1,'Controles mezclados');
        g.input.keys={};g.input.update(.016);assert(g.input.getPlayerInput(1).shootReleased&&g.input.getPlayerInput(1).shootPower>.3,'No dispara');
        g.input.update(.016);assert(!g.input.getPlayerInput(1).shootReleased,'Disparo duplicado');g.input.reset();g.input.localMultiplayer=false;
    });
    test('Pase libre y bloqueo de recaptura del pateador',()=>{
        fresh();const p=g.team1.players[9];g.ai.executePassToTeammate(p,g.team1.players[6],g.physics.ball,false,90,g.team1);
        assert(!g.physics.ball.owner&&g.physics.ball.kickCooldown>0,'Pase sigue pegado');
        assert(!g.ai.controlBall(p,g.physics.ball),'Pateador recaptura');
    });
    test('Recepción de balón suelto por IA',()=>{
        fresh();const p=g.team2.players[6];g.physics.resetBall(p.x,.22,p.z);assert(g.ai.controlBall(p,g.physics.ball),'IA no controla');assert(g.physics.ball.owner===p,'Posesión incorrecta');
    });
    test('Un tackle lejano no mueve la pelota',()=>{
        fresh();const p=g.team2.players[2];g.physics.resetBall(20,.22,12);g.ai.executeSlideTackle(p,g.physics.ball,g.team1);assert(g.physics.ball.vx===0&&g.physics.ball.vz===0,'Tackle remoto');
    });
    test('Arquero ataja por contacto sin temporizadores',()=>{
        fresh();const p=g.team1.players[0];p.x=-50;p.z=0;g.physics.resetBall(-49.4,.22,0);g.ai.updateGoalkeeperAI(p,g.physics.ball,g.team1,g.team2,.016);assert(g.physics.ball.owner===p,'No recoge junto a sus pies');
    });
    test('Gol solo al cruzar toda la línea, una sola vez',()=>{
        const p=new USF.PhysicsEngine();let count=0;p.onGoal=()=>count++;
        p.resetBall(52.4,.22,0);p.ball.vx=8;p.update(.02);assert(count===0,'Gol prematuro');
        p.update(.05);p.update(.05);assert(count===1,'Gol ausente o duplicado');
    });
    test('No hay gol sobre travesaño ni entrando por detrás',()=>{
        const p=new USF.PhysicsEngine();let count=0;p.onGoal=()=>count++;
        p.resetBall(52.6,3.2,0);p.ball.vx=8;p.update(.05);assert(count===0,'Gol alto');
        p.resetBall(54,.22,0);p.ball.vx=-8;p.update(.1);assert(count===0,'Gol desde atrás');
    });
    test('Poste devuelve el balón',()=>{
        const p=new USF.PhysicsEngine();let hits=0;p.onWoodwork=()=>hits++;p.resetBall(51.7,.6,p.GOAL_HALF_WIDTH);p.ball.vx=25;p.update(.05);assert(hits>0&&p.ball.vx<0,'Sin rebote en poste');
    });
    test('Banda espera cruce completo y asigna el saque rival',()=>{
        fresh();g.physics.resetBall(5,.22,34.1);g.rules.checkPitchBoundaries(g.physics.ball,'team1',g.physics);assert(g.rules.matchState==='IN_PLAY','Salida anticipada');
        g.physics.ball.z=34.3;g.rules.checkPitchBoundaries(g.physics.ball,'team1',g.physics);assert(g.rules.matchState==='THROW_IN'&&g.rules.restartTeam==='team2','Equipo incorrecto');
        g.rules.update(2.1,g.physics);assert(g.rules.matchState==='IN_PLAY'&&!g.physics.freezeBall&&g.physics.ball.lastKicker.teamId==='team2','Saque sin ejecutante');
    });
    test('Córner y saque de meta en ambos tiempos',()=>{
        for(const second of [false,true])for(const side of [-1,1])for(const defendingTouch of [false,true]) {
            fresh();g.rules.attacksRight={team1:!second,team2:second};
            const attacker=(side===1)!==second?'team1':'team2',defender=attacker==='team1'?'team2':'team1';
            g.physics.resetBall(side*53,.22,12);g.rules.checkPitchBoundaries(g.physics.ball,defendingTouch?defender:attacker,g.physics);
            assert(g.rules.matchState===(defendingTouch?'CORNER':'GOAL_KICK'),'Tipo incorrecto');assert(g.rules.restartTeam===(defendingTouch?attacker:defender),'Equipo incorrecto');
        }
    });
    test('Fuera de juego respeta la dirección de ataque',()=>{
        fresh();const d=[{x:50},{x:30}];assert(g.rules.checkOffsideOnPass('team1',{x:20},{x:35,z:0},d),'No detecta adelantado');
        g.rules.matchState='IN_PLAY';assert(!g.rules.checkOffsideOnPass('team1',{x:40},{x:35,z:0},d),'Penaliza pase atrás');
        g.rules.attacksRight={team1:false,team2:true};assert(g.rules.checkOffsideOnPass('team1',{x:-20},{x:-35,z:0},[{x:-50},{x:-30}]),'No cambia dirección');
    });
    test('Falta solo es penal en el área propia del defensor',()=>{
        fresh();const t=g.team1.players[2],c=g.team2.players[9];t.x=40;t.z=0;c.x=40.8;c.z=0;c.facingAngle=Math.PI/2;
        assert(g.rules.evaluateTackle(t,c,{x:42,z:0},g.physics),'No sanciona falta');assert(g.rules.matchState==='FOUL','Penal en área rival');
        fresh();const t2=g.team1.players[2],c2=g.team2.players[9];t2.x=-40;t2.z=0;c2.x=-40.8;c2.z=0;
        g.rules.evaluateTackle(t2,c2,{x:-42,z:0},g.physics);assert(g.rules.matchState==='PENALTY','No sanciona penal propio');
    });
    test('Pausa congela cronómetro y celebración',()=>{
        fresh();g.rules.registerGoal('team1');const delay=g.goalDelay,time=g.matchSeconds;g.isPaused=true;tick(.04);
        assert(g.goalDelay===delay&&g.matchSeconds===time,'Tiempo avanza pausado');g.isPaused=false;
    });
    test('Descanso cambia campo y final detiene el balón',()=>{
        fresh();g.matchSeconds=2699.99;tick(.04);assert(g.rules.matchState==='HALF_TIME','No hay descanso');
        g.halfTimeDelay=.001;tick(.04);assert(g.half===2&&!g.team1.attacksRight&&g.rules.restartTeam==='team2','Cambio de campo incorrecto');
        g.rules.update(1.1,g.physics);g.matchSeconds=5399.99;tick(.04);assert(g.rules.matchState==='FULL_TIME'&&g.physics.freezeBall,'No finaliza');
    });
    test('Reiniciar elimina tarjetas, expulsados y repeticiones',()=>{
        fresh();g.team1.players[1].isSentOff=true;g.rules.cards.team1.x='RED';g.replay.isReplaying=true;g.goalDelay=1;
        g.ui.onRestartMatch();assert(!g.replay.isReplaying&&g.goalDelay===null&&!g.isPaused,'Estado transitorio');assert(Object.keys(g.rules.cards.team1).length===0&&g.team1.players.every(p=>!p.isSentOff),'Sanciones persistentes');
    });
    test('Los puestos de laterales y extremos corresponden a su formación',()=>{
        fresh();const slots=USF.TeamsData.FORMATIONS[g.team1.formation];
        for(const p of g.team1.players)assert(slots[p.formationIndex].role===p.playerData.pos,'Puesto intercambiado: '+p.playerData.name);
        assert(new Set(g.team1.players.map(p=>p.formationIndex)).size===11,'Puestos duplicados');
    });
    test('Mando estándar no confunde stick derecho con gatillo',()=>{
        const gp={connected:true,id:'Xbox',mapping:'standard',axes:[0,0,1,1,1,1],buttons:Array.from({length:16},()=>({pressed:false}))};
        const state=g.input.normalizeGamepadState(gp);assert(!state.sprint&&!state.dpadDown,'Ejes interpretados como botones');
    });
    test('Gol conducido y autoría tras cambio de campo',()=>{
        fresh();g.team1.attacksRight=false;g.team2.attacksRight=true;g.rules.attacksRight={team1:false,team2:true};
        g.physics.resetBall(-52.6,.22,0);g.physics.ball.vx=-10;g.physics.update(.03);assert(g.rules.score.team1===1,'Autoría invertida');
        fresh();const p=g.team1.players[9];p.x=52.1;p.z=0;p.facingAngle=Math.PI/2;
        g.physics.resetBall(52.6,.22,0);g.physics.ball.owner=p;g.ai.controlBall(p,g.physics.ball);assert(g.rules.score.team1===1,'Conducción no cuenta como gol');
    });
    test('Cancha completa dentro del encuadre horizontal y vertical',()=>{
        const r=g.renderer;const w=r.width,h=r.height;
        for(const [width,height] of [[1440,900],[390,844],[844,390]]) {
            r.width=width;r.height=height;r.cameraMode='FULL';r.cameraTarget.set(0,0,0);r.updateCamera(1,{x:50,z:30});r.camera.updateMatrixWorld();
            for(const x of [-55,55])for(const z of [-34,34]) {
                const v=new THREE.Vector3(x,0,z).project(r.camera);assert(Math.abs(v.x)<1&&Math.abs(v.y)<1,'Campo recortado en '+width+'x'+height);
            }
        }
        r.width=w;r.height=h;r.fitCamera();
    });
    test('Las cuatro cámaras completan un ciclo y usan la proyección correcta',()=>{
        const r=g.renderer;r.setCameraMode('FULL');
        for(const mode of ['TV','SIDELINE','PLAYER','FULL']) {
            r.cycleCamera();r.updateCamera(.016,g.physics.ball);
            assert(r.cameraMode===mode,'Orden incorrecto');
            assert(r.camera.isPerspectiveCamera===true === ['SIDELINE','PLAYER'].includes(mode),'Proyección incorrecta');
        }
    });
    test('Cámara del jugador encuadra al seleccionado en ambos campos y en móvil',()=>{
        const r=g.renderer,w=r.width,h=r.height;
        for(const [width,height] of [[1440,900],[390,844]])for(const dir of [-1,1])for(const x of [-50,0,50])for(const z of [-32,0,32]) {
            r.width=width;r.height=height;r.setCameraMode('PLAYER');r.lastCameraMode=null;
            r.cameraContext={player:{x,z,vx:dir*8,vz:0},attacksRight:dir===1};
            r.updateCamera(1,{x:THREE.MathUtils.clamp(x+dir*8,-52,52),y:.22,z:z-2});
            const v=new THREE.Vector3(x,1,z).project(r.camera);
            assert(Math.abs(v.x)<.96&&Math.abs(v.y)<.96&&v.z<1,'Jugador fuera de cámara: '+[width,dir,x,z]);
            assert(r.camera.position.y>=5&&Math.abs(r.camera.position.x)<=60,'Cámara dentro de las gradas');
        }
        r.width=w;r.height=h;r.setCameraMode('FULL');g.updateCameraContext();
    });
    test('Cámara del jugador conserva el balón cercano que llega por detrás',()=>{
        const r=g.renderer;r.setCameraMode('PLAYER');r.lastCameraMode=null;
        r.cameraContext={player:{x:0,z:0,vx:0,vz:0},attacksRight:true};
        r.updateCamera(1,{x:-10,y:.22,z:3});
        const v=new THREE.Vector3(-10,.22,3).project(r.camera);
        assert(Math.abs(v.x)<.95&&Math.abs(v.y)<.95,'Balón cercano recortado');
        r.setCameraMode('FULL');g.updateCameraContext();
    });
    test('Direcciones relativas a pantalla en las dos cámaras nuevas',()=>{
        const r=g.renderer;
        for(const mode of ['SIDELINE','PLAYER'])for(const attacksRight of [true,false]) {
            r.setCameraMode(mode);r.lastCameraMode=null;r.cameraContext={player:{x:0,z:0},attacksRight};r.updateCamera(1,{x:0,y:.22,z:0});
            const input=r.toWorldInput({moveX:1,moveZ:0});
            const origin=new THREE.Vector3(0,0,0).project(r.camera);
            const moved=new THREE.Vector3(input.moveX,0,input.moveZ).project(r.camera);
            assert(moved.x>origin.x,'Derecha se invierte');assert(Math.abs(Math.hypot(input.moveX,input.moveZ)-1)<.001,'Velocidad alterada');
        }
        r.setCameraMode('FULL');g.updateCameraContext();
    });
    test('Cambio direccional elige un compañero hacia el lado indicado',()=>{
        fresh();const players=g.team1.players;for(const p of players){p.x=-30;p.z=25;}
        players[9].x=0;players[9].z=0;players[6].x=10;players[6].z=0;players[7].x=-1;players[7].z=0;
        g.physics.resetBall(-1,.22,0);
        assert(g.getSwitchCandidate(g.team1,9,{moveX:1,moveZ:0})===6,'Ignora dirección elegida');
        assert(g.getSwitchCandidate(g.team1,9,{})===7,'Ignora compañero mejor situado');
    });
    test('Cambio manual tiene prioridad y no vuelve solo al poseedor',()=>{
        fresh();const players=g.team1.players;for(const p of players){p.x=25;p.z=25;}
        players[9].x=0;players[9].z=0;players[6].x=8;players[6].z=0;players[7].x=-5;players[7].z=0;
        g.physics.ball.owner=players[6];
        const selected=g.autoSwitchActivePlayer(g.team1,9,{switchPlayer:true,moveX:-1,moveZ:0});
        assert(selected===7,'Recepción anula selección manual');
        assert(g.autoSwitchActivePlayer(g.team1,selected,{},1)===selected,'Cambio automático devuelve el control');
        g.physics.ball.owner=players[8];assert(g.autoSwitchActivePlayer(g.team1,selected,{},1)===8,'No selecciona nuevo receptor');
    });
    test('Control del receptor durante el vuelo del pase',()=>{
        fresh();const passer=g.team1.players[9],target=g.team1.players[6];passer.x=0;passer.z=0;
        g.physics.resetBall(3,.22,0);g.physics.ball.lastKicker=passer;g.physics.ball.passTarget=target;
        assert(g.autoSwitchActivePlayer(g.team1,9,{})===6,'Espera demasiado para controlar receptor');
    });
    test('Cambio excluye arquero, expulsados y jugadores caídos',()=>{
        fresh();g.physics.resetBall(0,.22,0);for(const p of g.team1.players){p.x=35;p.z=25;}
        g.team1.players[0].x=0;g.team1.players[0].z=0;
        g.team1.players[6].x=.1;g.team1.players[6].z=0;g.team1.players[6].isSentOff=true;
        g.team1.players[7].x=.2;g.team1.players[7].z=0;g.team1.players[7].model.currentAnim='FOUL_FALL';
        g.team1.players[8].x=3;g.team1.players[8].z=0;
        assert(g.getSwitchCandidate(g.team1,9,{})===8,'Selecciona compañero no disponible');
    });
    test('Una pulsación rápida de cambio entre fotogramas no se pierde',()=>{
        fresh();g.input.reset();
        window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyQ',bubbles:true}));
        window.dispatchEvent(new KeyboardEvent('keyup',{code:'KeyQ',bubbles:true}));
        g.input.update(.016);assert(g.input.getPlayerInput().switchPlayer,'Pierde la pulsación rápida');
        g.input.update(.016);assert(!g.input.getPlayerInput().switchPlayer,'Repite el cambio rápido');g.input.reset();
    });
    test('Cámara LAN sigue al invitado y respeta el segundo tiempo',()=>{
        fresh();const mode=g.network.mode;g.network.mode='LAN_CLIENT';g.half=1;g.updateCameraContext();
        assert(g.renderer.cameraContext.player===g.team2.players[g.activeP2Index]&&!g.renderer.cameraContext.attacksRight,'Sigue al rival');
        g.half=2;g.updateCameraContext();assert(g.renderer.cameraContext.attacksRight,'No cambia sentido');g.network.mode=mode;g.half=1;
    });
    test('Barrida despoja limpiamente al rival e impulsa el balón',()=>{
        fresh();
        const tackler = g.team1.players[2];
        const carrier = g.team2.players[9];
        carrier.x = 10; carrier.z = 5; carrier.facingAngle = 0;
        tackler.x = 10; tackler.z = 3.8; tackler.facingAngle = 0; // Frente a frente en z
        g.physics.resetBall(10, 0.22, 5);
        g.physics.ball.owner = carrier;
        g.ai.executeSlideTackle(tackler, g.physics.ball, g.team2);
        assert(g.physics.ball.owner === null, 'La pelota sigue pegada al rival tras la barrida');
        assert(carrier.dispossessTimer > 0, 'No se aplicó tiempo de pérdida de control al rival');
        assert(!g.ai.controlBall(carrier, g.physics.ball), 'El rival recapturó la pelota inmediatamente');
        assert(tackler.isTackling, 'No activó estado de barrida');
    });
    test('Arco ampliado permite goles en las nuevas esquinas',()=>{
        const p = new USF.PhysicsEngine();
        let goalCount = 0;
        p.onGoal = () => goalCount++;
        // Con z = 4.2 (antes fuera de los 3.66m antiguos, ahora dentro del arco de 4.80m)
        p.resetBall(52.4, 1.2, 4.2);
        p.ball.vx = 10;
        p.update(0.04);
        p.update(0.04);
        assert(goalCount === 1, 'No entra el gol en la zona ampliada del arco');
        assert(p.GOAL_WIDTH === 9.6 && p.GOAL_HEIGHT === 2.9, 'Dimensiones del arco incorrectas');
    });
    test('Balón parado humano es interactivo y no se autoejecuta',()=>{
        fresh();
        g.prepareRestart('CORNER', 'team1', { x: 52.1, z: 33.6 });
        assert(g.activeSetPiece !== null, 'No inició modo de balón parado interactivo');
        assert(g.activeSetPiece.kind === 'CORNER', 'Tipo de jugada incorrecta');
        assert(g.physics.freezeBall, 'El balón no quedó quieto para apuntar');
        // El usuario ejecuta con potencia
        g.executeSetPieceAction('SHOOT', 0.8);
        assert(g.activeSetPiece === null, 'No finalizó el modo de balón parado tras patear');
        assert(!g.physics.freezeBall, 'El balón quedó congelado tras patear');
        assert(g.physics.ball.speed > 5, 'El balón no adquirió velocidad al ejecutar');
    });
    test('Tiempo añadido acumula descuento por interrupciones',()=>{
        fresh();
        g.recordStoppage('CORNER');
        g.recordStoppage('FOUL');
        g.recordStoppage('PENALTY');
        assert(g.stoppageAccumulated[1] > 60, 'No acumuló tiempo de descuento');
        const addedMin = Math.round(g.stoppageAccumulated[1] / 60);
        assert(addedMin >= 1, 'Descuento menor a 1 minuto');
    });
    test('Cámaras FC26 activas para penales, tiros libres y corners, pero estándar para saques de banda',()=>{
        fresh();
        // Tiro libre
        g.prepareRestart('FOUL', 'team1', { x: 30, z: 5 });
        assert(g.renderer.setPieceCameraConfig !== null, 'No configuró cámara de tiro libre');
        assert(g.renderer.setPieceCameraConfig.kind === 'FOUL', 'Tipo de cámara incorrecto');
        g.renderer.updateCamera(0.016, g.physics.ball);
        assert(g.renderer.camera === g.renderer.perspectiveCamera, 'No activó cámara en perspectiva');

        // Penalty
        g.prepareRestart('PENALTY', 'team1', { x: 41.5, z: 0 });
        assert(g.renderer.setPieceCameraConfig?.kind === 'PENALTY', 'No configuró cámara de penalti');

        // Corner
        g.prepareRestart('CORNER', 'team1', { x: 52.1, z: 33.6 });
        assert(g.renderer.setPieceCameraConfig?.kind === 'CORNER', 'No configuró cámara de córner');

        // Saque de banda: debe mantener la cámara estándar (null en setPieceCameraConfig)
        g.prepareRestart('THROW_IN', 'team1', { x: 10, z: 34 });
        assert(g.renderer.setPieceCameraConfig === null, 'Saque de banda no debe usar cámara especial FC26');
    });
    test('Aislamiento del balón parado: rivales no tocan ni roban la pelota',()=>{
        fresh();
        g.prepareRestart('FOUL', 'team1', { x: 25, z: 5 });
        const kicker = g.activeSetPiece.kicker;
        const opponent = g.team2.players[9];
        opponent.x = 25.5; opponent.z = 5.2; opponent.facingAngle = 0;

        assert(g.physics.ball.isSetPieceActive === true, 'No marcó balón parado como activo');
        assert(!g.ai.controlBall(opponent, g.physics.ball), 'Rival pudo controlar la pelota durante balón parado');
        
        // Intento de barrida del rival
        g.ai.executeSlideTackle(opponent, g.physics.ball, g.team1);
        assert(g.physics.ball.owner === kicker, 'Rival despojó al pateador durante balón parado');
        assert(!opponent.isTackling, 'Se permitió barrida durante balón parado');
    });
    test('PVP 1v1 soporta balón parado para Jugador 2 (cámara simétrica hacia la izquierda)',()=>{
        fresh();
        g.startMatch('real_madrid', 'barcelona', 'LOCAL_1V1');
        g.prepareRestart('FOUL', 'team2', { x: -28, z: -4 });
        assert(g.activeSetPiece !== null, 'No activó balón parado para Jugador 2 en 1v1');
        assert(g.activeSetPiece.teamId === 'team2', 'El equipo activo no es el del Jugador 2');
        assert(g.renderer.setPieceCameraConfig !== null, 'No configuró cámara para Jugador 2');
        assert(g.renderer.setPieceCameraConfig.dir === -1, 'Dirección de cámara de Jugador 2 incorrecta');

        // Ejecutar tiro de Jugador 2
        g.executeSetPieceAction('SHOOT', 0.7);
        assert(g.activeSetPiece === null, 'No finalizó el tiro libre de Jugador 2');
        assert(g.physics.ball.isSetPieceActive === false, 'isSetPieceActive no se limpió');
        assert(g.renderer.setPieceCameraConfig === null, 'setPieceCameraConfig no se restauró');
    });
    test('Menú FC26: cambio dinámico de hero card y acción',()=>{
        assert(g.ui.fcHeroTitle !== null, 'No se encontró el título del hero card');
        g.ui.setFCHeroMode('LOCAL_1V1');
        assert(g.ui.activeFCHeroMode === 'LOCAL_1V1', 'No cambió a modo LOCAL_1V1');
        assert(g.ui.fcHeroTitle.textContent.includes('1v1') || g.ui.fcHeroTitle.textContent.includes('1 VS 1'), 'Título no refleja modo 1v1');
        g.ui.setFCHeroMode('ONLINE');
        assert(g.ui.activeFCHeroMode === 'ONLINE', 'No cambió a modo ONLINE');
        assert(g.ui.fcHeroActionLabel.textContent.includes('Salas') || g.ui.fcHeroActionLabel.textContent.includes('Online'), 'Texto de acción incorrecto para ONLINE');
        g.ui.setFCHeroMode('KICKOFF');
        assert(g.ui.activeFCHeroMode === 'KICKOFF', 'No restauró a modo KICKOFF');
    });
    test('Multijugador Global: enlace de invitación con room code',()=>{
        const link = g.network.getInviteLink('AB12CD');
        assert(typeof link === 'string', 'getInviteLink no retornó string');
        assert(link.includes('?room=AB12CD'), 'El enlace no contiene el parámetro ?room=AB12CD: ' + link);
    });
    test('Multijugador Global: cálculo y latencia de ping',()=>{
        g.network.currentPing = null;
        const fakePongTime = performance.now() - 52;
        const rtt = performance.now() - fakePongTime;
        g.network.currentPing = (g.network.currentPing === null) ? rtt : (g.network.currentPing * 0.7 + rtt * 0.3);
        assert(g.network.currentPing >= 40 && g.network.currentPing <= 150, 'Ping fuera de rango esperado: ' + g.network.currentPing);
        g.network.currentPing = null;
    });
    test('Controles táctiles FC Mobile: joystick flotante dinámico',()=>{
        const inp = g.input;
        assert(typeof inp.updateJoystick === 'function', 'updateJoystick no implementado');
        inp.updateJoystick(0, -40, 48, null);
        assert(Math.abs(inp.touchInput.moveX) < 0.05, 'touchInput.moveX debería ser ~0');
        assert(inp.touchInput.moveZ < -0.7, 'touchInput.moveZ debería ser negativo hacia arriba: ' + inp.touchInput.moveZ);
        // Deadzone (< 8px)
        inp.updateJoystick(3, 3, 48, null);
        assert(inp.touchInput.moveX === 0 && inp.touchInput.moveZ === 0, 'Deadzone no aplicó en movimiento mínimo');
        inp.touchInput.moveX = 0; inp.touchInput.moveZ = 0;
    });
    window.requestAnimationFrame=originalRAF;
    g.renderer.render=originalRender;g.mainLoop=originalLoop;g.startMatch('real_madrid','barcelona','AI');
    console.table(results);return results;
};
