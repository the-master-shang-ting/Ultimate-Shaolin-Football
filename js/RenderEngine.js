/**
 * Ultimate Shaolin Football (USF)
 * RenderEngine.js - Motor gráfico Three.js (Estadio 3D, césped procedural, focos, sombras, público, cámara TV y partículas)
 */

window.USF = window.USF || {};

class RenderEngine {
    constructor(containerElement) {
        this.container = containerElement || document.body;
        this.width = window.innerWidth;
        this.height = window.innerHeight;

        // Escena y Cámara
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x060913); // Cielo nocturno profundo
        this.scene.fog = new THREE.FogExp2(0x060913, 0.0018);

        this.camera = new THREE.OrthographicCamera(-70,70,48,-48,.1,500);
        this.camera.position.set(0, 100, 78);
        this.overviewCamera = this.camera;
        this.perspectiveCamera = new THREE.PerspectiveCamera(58, this.width / this.height, 0.15, 500);
        this.cameraModes = ['FULL', 'TV', 'SIDELINE', 'PLAYER'];
        this.cameraLabels = { FULL: 'COMPLETA', TV: 'TV', SIDELINE: 'COMENTARISTA', PLAYER: 'JUGADOR' };
        this.cameraContext = {};
        this.cameraMode = 'FULL'; // Plano TV alto, por delante de las gradas

        // Renderizador WebGL optimizado
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(this.width, this.height);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.container.appendChild(this.renderer.domElement);

        // Control de cámara TV
        this.cameraTarget = new THREE.Vector3(0, 0, 0);
        this.cameraShake = 0;
        this.cameraShakeVector = new THREE.Vector3();

        // Parámetros de la cancha
        this.PITCH_L = 105;
        this.PITCH_W = 68;

        // Grupos de la escena
        this.stadiumGroup = new THREE.Group();
        this.pitchGroup = new THREE.Group();
        this.playersGroup = new THREE.Group();
        this.fxGroup = new THREE.Group();
        this.scene.add(this.stadiumGroup);
        this.scene.add(this.pitchGroup);
        this.scene.add(this.playersGroup);
        this.scene.add(this.fxGroup);

        // Partículas
        this.particles = [];

        this.buildPitch();
        this.buildGoals();
        this.buildCornerFlags();
        this.buildStadium();
        this.buildLighting();
        this.buildBallMesh();

        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.fitCamera();
        this.renderer.setSize(this.width, this.height);
    }

    // --- Césped Procedural y Líneas Reglamentarias (105m x 68m exactos) ---
    buildPitch() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1326; // Proporción exacta 105:68
        const ctx = canvas.getContext('2d');

        // 1. Franjas de corte de césped
        const numStripes = 18;
        const stripeW = canvas.width / numStripes;
        for (let i = 0; i < numStripes; i++) {
            ctx.fillStyle = (i % 2 === 0) ? '#226927' : '#2b7830';
            ctx.fillRect(i * stripeW, 0, stripeW, canvas.height);
        }

        // Ruido sutil de textura de hierba
        ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
        for (let i = 0; i < 75000; i++) {
            const rx = Math.random() * canvas.width;
            const ry = Math.random() * canvas.height;
            ctx.fillRect(rx, ry, 2, 2);
        }

        // 2. Líneas blancas reglamentarias (Alineadas 1:1 con las coordenadas 3D)
        const lineW = 4;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = lineW;
        ctx.lineCap = 'square';

        const pW = canvas.width - lineW;
        const pH = canvas.height - lineW;
        const startX = lineW / 2;
        const startY = lineW / 2;
        const scaleX = pW / 105;
        const scaleY = pH / 68;

        // Límites perimetrales (105m x 68m)
        ctx.strokeRect(startX, startY, pW, pH);

        // Línea de medio campo
        const midX = startX + pW / 2;
        ctx.beginPath();
        ctx.moveTo(midX, startY);
        ctx.lineTo(midX, startY + pH);
        ctx.stroke();

        // Círculo central (Radio 9.15m)
        const midY = startY + pH / 2;
        ctx.beginPath();
        ctx.arc(midX, midY, 9.15 * scaleY, 0, Math.PI * 2);
        ctx.stroke();

        // Punto central
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(midX, midY, 6, 0, Math.PI * 2);
        ctx.fill();

        // Áreas de Penal (16.5m x 40.32m) y de Meta (5.5m x 18.32m)
        const drawBoxes = (isLeft) => {
            const goalLineX = isLeft ? startX : startX + pW;
            const dir = isLeft ? 1 : -1;

            // Área grande (16.5m x 40.32m)
            const penW = 16.5 * scaleX;
            const penH = 40.32 * scaleY;
            ctx.strokeRect(isLeft ? goalLineX : goalLineX - penW, midY - penH / 2, penW, penH);

            // Área chica (5.5m x 18.32m)
            const goalBoxW = 5.5 * scaleX;
            const goalBoxH = 18.32 * scaleY;
            ctx.strokeRect(isLeft ? goalLineX : goalLineX - goalBoxW, midY - goalBoxH / 2, goalBoxW, goalBoxH);

            // Punto de penal (11m de la línea de meta)
            const spotX = goalLineX + dir * (11.0 * scaleX);
            ctx.beginPath();
            ctx.arc(spotX, midY, 5, 0, Math.PI * 2);
            ctx.fill();

            // Arco de penal (media luna exterior a 9.15m del punto de penal)
            ctx.beginPath();
            const startAngle = isLeft ? -0.92 : Math.PI - 0.92;
            const endAngle = isLeft ? 0.92 : Math.PI + 0.92;
            ctx.arc(spotX, midY, 9.15 * scaleY, startAngle, endAngle, false);
            ctx.stroke();
        };

        drawBoxes(true);
        drawBoxes(false);

        // Banderines de córner (Arcos de 1m de radio)
        const cornerArcs = [
            { x: startX, y: startY, sa: 0, ea: Math.PI / 2 },
            { x: startX + pW, y: startY, sa: Math.PI / 2, ea: Math.PI },
            { x: startX + pW, y: startY + pH, sa: Math.PI, ea: Math.PI * 1.5 },
            { x: startX, y: startY + pH, sa: Math.PI * 1.5, ea: Math.PI * 2 }
        ];
        cornerArcs.forEach(c => {
            ctx.beginPath();
            ctx.arc(c.x, c.y, 1.0 * scaleY, c.sa, c.ea);
            ctx.stroke();
        });

        const pitchTex = new THREE.CanvasTexture(canvas);
        pitchTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

        const pitchGeom = new THREE.PlaneGeometry(105, 68);
        const pitchMat = new THREE.MeshLambertMaterial({ map: pitchTex });
        const pitchMesh = new THREE.Mesh(pitchGeom, pitchMat);
        pitchMesh.rotation.x = -Math.PI / 2;
        pitchMesh.receiveShadow = true;
        this.pitchGroup.add(pitchMesh);

        // Margen exterior de césped (alrededor de la cancha: 125m x 88m)
        const outerPitchGeom = new THREE.PlaneGeometry(125, 88);
        const outerPitchMat = new THREE.MeshLambertMaterial({ color: 0x1a501e });
        const outerPitchMesh = new THREE.Mesh(outerPitchGeom, outerPitchMat);
        outerPitchMesh.rotation.x = -Math.PI / 2;
        outerPitchMesh.position.y = -0.02;
        outerPitchMesh.receiveShadow = true;
        this.pitchGroup.add(outerPitchMesh);
    }

    // Textura procedural de red de fútbol en Canvas 2D
    createNetGridTexture() {
        const netCanvas = document.createElement('canvas');
        netCanvas.width = 128;
        netCanvas.height = 128;
        const nCtx = netCanvas.getContext('2d');

        nCtx.clearRect(0, 0, 128, 128);
        nCtx.strokeStyle = '#FFFFFF';
        nCtx.lineWidth = 2.5;

        // Malla cuadriculada blanca con transparencia
        const step = 16;
        for (let x = 0; x <= 128; x += step) {
            nCtx.beginPath();
            nCtx.moveTo(x, 0);
            nCtx.lineTo(x, 128);
            nCtx.stroke();
        }
        for (let y = 0; y <= 128; y += step) {
            nCtx.beginPath();
            nCtx.moveTo(0, y);
            nCtx.lineTo(128, y);
            nCtx.stroke();
        }

        const netTex = new THREE.CanvasTexture(netCanvas);
        netTex.wrapS = THREE.RepeatWrapping;
        netTex.wrapT = THREE.RepeatWrapping;
        netTex.repeat.set(2, 1);
        return netTex;
    }

    // --- Porterías 3D de Alto Contraste y Redes con Profundidad ---
    buildGoals() {
        // Material blanco brillante con emisividad para máxima visibilidad
        const postMat = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            roughness: 0.15,
            metalness: 0.05,
            emissive: 0x444444
        });

        const frameSupportMat = new THREE.MeshStandardMaterial({
            color: 0xCCCCCC,
            roughness: 0.25,
            metalness: 0.1,
            emissive: 0x222222
        });

        const netTexture = this.createNetGridTexture();
        const netMat = new THREE.MeshStandardMaterial({
            map: netTexture,
            transparent: true,
            opacity: 0.72,
            depthWrite: false,
            alphaTest: 0.12,
            side: THREE.DoubleSide,
            color: 0xF0F0F0,
            roughness: 0.5,
            emissive: 0x222222
        });

        const goalWidth = 9.6;
        const halfWidth = 4.8;
        const goalHeight = 2.9;
        const goalDepth = 2.4;
        const postRadius = 0.11; // Diámetro visible reforzado

        [-52.5, 52.5].forEach(gx => {
            const goalGroup = new THREE.Group();
            goalGroup.position.set(gx, 0, 0);
            const dir = gx > 0 ? 1 : -1; // 1: hacia +X (fuera), -1: hacia -X (fuera)

            // 1. Postes verticales (Izquierdo y Derecho)
            [-halfWidth, halfWidth].forEach(pz => {
                const postGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 20);
                const postMesh = new THREE.Mesh(postGeom, postMat);
                postMesh.position.set(0, goalHeight / 2, pz);
                postMesh.castShadow = true;
                goalGroup.add(postMesh);

                // Codo superior redondeado
                const elbowGeom = new THREE.SphereGeometry(postRadius * 1.05, 16, 16);
                const elbowMesh = new THREE.Mesh(elbowGeom, postMat);
                elbowMesh.position.set(0, goalHeight, pz);
                goalGroup.add(elbowMesh);
            });

            // 2. Travesaño horizontal
            const crossbarGeom = new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 20);
            const crossbarMesh = new THREE.Mesh(crossbarGeom, postMat);
            crossbarMesh.rotation.x = Math.PI / 2;
            crossbarMesh.position.set(0, goalHeight, 0);
            crossbarMesh.castShadow = true;
            goalGroup.add(crossbarMesh);

            // 3. Estructura de soporte trasero
            // Barras superiores hacia atrás
            [-halfWidth, halfWidth].forEach(pz => {
                const topBarGeom = new THREE.CylinderGeometry(0.05, 0.05, goalDepth, 12);
                const topBar = new THREE.Mesh(topBarGeom, frameSupportMat);
                topBar.rotation.z = Math.PI / 2;
                topBar.position.set(dir * goalDepth / 2, goalHeight, pz);
                goalGroup.add(topBar);

                // Barras de base en el césped hacia atrás
                const bottomBarGeom = new THREE.CylinderGeometry(0.05, 0.05, goalDepth, 12);
                const bottomBar = new THREE.Mesh(bottomBarGeom, frameSupportMat);
                bottomBar.rotation.z = Math.PI / 2;
                bottomBar.position.set(dir * goalDepth / 2, 0.05, pz);
                goalGroup.add(bottomBar);

                // Tensores diagonales traseros
                const diagLength = Math.hypot(goalDepth * 0.4, goalHeight);
                const diagBarGeom = new THREE.CylinderGeometry(0.04, 0.04, diagLength, 12);
                const diagBar = new THREE.Mesh(diagBarGeom, frameSupportMat);
                const diagAngle = Math.atan2(goalDepth * 0.4, goalHeight);
                diagBar.rotation.z = dir * diagAngle;
                diagBar.position.set(dir * (goalDepth - goalDepth * 0.2), goalHeight / 2, pz);
                goalGroup.add(diagBar);
            });

            // Barra transversal trasera superior
            const rearTopBarGeom = new THREE.CylinderGeometry(0.05, 0.05, goalWidth, 12);
            const rearTopBar = new THREE.Mesh(rearTopBarGeom, frameSupportMat);
            rearTopBar.rotation.x = Math.PI / 2;
            rearTopBar.position.set(dir * goalDepth, goalHeight, 0);
            goalGroup.add(rearTopBar);

            // Barra transversal trasera inferior en el suelo
            const rearBottomBarGeom = new THREE.CylinderGeometry(0.05, 0.05, goalWidth, 12);
            const rearBottomBar = new THREE.Mesh(rearBottomBarGeom, frameSupportMat);
            rearBottomBar.rotation.x = Math.PI / 2;
            rearBottomBar.position.set(dir * goalDepth, 0.05, 0);
            goalGroup.add(rearBottomBar);

            // 4. Malla 3D de la Red (Pared trasera, techo y laterales)
            // Pared Trasera
            const backNetGeom = new THREE.PlaneGeometry(goalWidth, goalHeight);
            const backNet = new THREE.Mesh(backNetGeom, netMat);
            backNet.position.set(dir * goalDepth, goalHeight / 2, 0);
            backNet.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
            goalGroup.add(backNet);

            // Techo de la Red
            const topNetGeom = new THREE.PlaneGeometry(goalDepth, goalWidth);
            const topNet = new THREE.Mesh(topNetGeom, netMat);
            topNet.position.set(dir * goalDepth / 2, goalHeight, 0);
            topNet.rotation.x = -Math.PI / 2;
            topNet.rotation.z = dir > 0 ? 0 : Math.PI;
            goalGroup.add(topNet);

            // Lateral Izquierdo de la Red (z = -halfWidth)
            const sideLeftGeom = new THREE.PlaneGeometry(goalDepth, goalHeight);
            const sideLeftNet = new THREE.Mesh(sideLeftGeom, netMat);
            sideLeftNet.position.set(dir * goalDepth / 2, goalHeight / 2, -halfWidth);
            sideLeftNet.rotation.y = 0;
            goalGroup.add(sideLeftNet);

            // Lateral Derecho de la Red (z = +halfWidth)
            const sideRightGeom = new THREE.PlaneGeometry(goalDepth, goalHeight);
            const sideRightNet = new THREE.Mesh(sideRightGeom, netMat);
            sideRightNet.position.set(dir * goalDepth / 2, goalHeight / 2, halfWidth);
            sideRightNet.rotation.y = 0;
            goalGroup.add(sideRightNet);

            goalGroup.name = gx > 0 ? 'goal-right' : 'goal-left';
        this.pitchGroup.add(goalGroup);
        });
    }

    // --- Banderines de Córner ---
    buildCornerFlags() {
        const flagPoleGeom = new THREE.CylinderGeometry(0.02, 0.02, 1.5, 8);
        const flagPoleMat = new THREE.MeshLambertMaterial({ color: 0xFFFF00 });
        const clothGeom = new THREE.PlaneGeometry(0.4, 0.28);
        const clothMat = new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide });

        const corners = [
            [-52.5, -34], [-52.5, 34],
            [52.5, -34], [52.5, 34]
        ];

        corners.forEach(([cx, cz]) => {
            const flagGroup = new THREE.Group();
            flagGroup.position.set(cx, 0, cz);

            const pole = new THREE.Mesh(flagPoleGeom, flagPoleMat);
            pole.position.y = 0.75;
            flagGroup.add(pole);

            const cloth = new THREE.Mesh(clothGeom, clothMat);
            cloth.position.set(0.2, 1.35, 0);
            flagGroup.add(cloth);

            this.pitchGroup.add(flagGroup);
        });
    }

    // --- Estadio 3D, Tribunas y Público ---
    buildStadium() {
        // Tribunas escalonadas (4 lados)
        const standMat = new THREE.MeshLambertMaterial({ color: 0x1a2130 });
        // Las antiguas gradas azul intenso funcionaban visualmente como muros.
        // Un acabado oscuro reduce el bloqueo visual y el contraste con el césped.
        const seatMat = new THREE.MeshLambertMaterial({ color: 0x263142 });

        const createStand = (width, depth, height, posX, posZ, rotY) => {
            const standGroup = new THREE.Group();
            standGroup.position.set(posX, 0, posZ);
            standGroup.rotation.y = rotY;

            // 8 Niveles de gradas
            const tiers = 8;
            for (let t = 0; t < tiers; t++) {
                const stepH = (height / tiers) * (t + 1);
                const stepD = depth / tiers;
                const tierGeom = new THREE.BoxGeometry(width, stepH, stepD);
                const tierMesh = new THREE.Mesh(tierGeom, (t % 2 === 0) ? standMat : seatMat);
                tierMesh.position.set(0, stepH / 2, t * stepD);
                tierMesh.receiveShadow = true;
                standGroup.add(tierMesh);
            }

            // Techo voladizo
            const roofGeom = new THREE.BoxGeometry(width, 0.6, depth * 1.3);
            const roofMat = new THREE.MeshLambertMaterial({ color: 0x0e131d });
            const roof = new THREE.Mesh(roofGeom, roofMat);
            roof.position.set(0, height + 4, depth * 0.4);
            standGroup.add(roof);

            // Open camera-side stand: no opaque roof between the camera and the pitch.
        if (posZ > 0) standGroup.visible = false;
        this.stadiumGroup.add(standGroup);
        };

        // Gradas Norte y Sur (Longitudinales)
        createStand(125, 20, 16, 0, 60, 0);
        createStand(125, 20, 16, 0, -60, Math.PI);

        // Gradas Este y Oeste (Cabeceras)
        createStand(78, 22, 16, 68, 0, Math.PI / 2);
        createStand(78, 22, 16, -68, 0, -Math.PI / 2);

        // Vallas publicitarias LED animadas
        this.buildAdBoards();

        // Espectadores animados (Instanced Mesh)
        this.buildCrowd();
    }

    buildAdBoards() {
        const adCanvas = document.createElement('canvas');
        adCanvas.width = 1024;
        adCanvas.height = 128;
        this.adCtx = adCanvas.getContext('2d');
        this.adTex = new THREE.CanvasTexture(adCanvas);

        this.adTime = 0;

        const boardMat = new THREE.MeshBasicMaterial({ map: this.adTex });
        const h = 1.0;

        // Laterales
        const longGeom = new THREE.PlaneGeometry(108, h);
        const boardNorth = new THREE.Mesh(longGeom, boardMat);
        boardNorth.position.set(0, h / 2, -36.5);
        this.stadiumGroup.add(boardNorth);

        // No se coloca valla en el lado de cámara: una superficie vertical
        // entre la cámara TV y el césped tapa el campo a ras de línea lateral.

        // Fondos
        const shortGeom = new THREE.PlaneGeometry(72, h);
        const boardEast = new THREE.Mesh(shortGeom, boardMat);
        boardEast.position.set(55.5, h / 2, 0);
        boardEast.rotation.y = -Math.PI / 2;
        this.stadiumGroup.add(boardEast);

        const boardWest = new THREE.Mesh(shortGeom, boardMat);
        boardWest.position.set(-55.5, h / 2, 0);
        boardWest.rotation.y = Math.PI / 2;
        this.stadiumGroup.add(boardWest);
    }

    updateAdBoards(dt) {
        if (!this.adCtx) return;
        this.adTime += dt * 120;

        const ctx = this.adCtx;
        ctx.fillStyle = '#0a101f';
        ctx.fillRect(0, 0, 1024, 128);

        // Texto deslizante con efecto neón
        ctx.font = 'bold 44px "Impact", "Arial Black", sans-serif';
        ctx.fillStyle = '#00FF88';
        ctx.shadowColor = '#00FF88';
        ctx.shadowBlur = 15;

        const text = "★ ULTIMATE SHAOLIN FOOTBALL 26 ★ FIFA WORLD TOUR ★ SUPER SHOTS ★ POWER STRIKE ★ ";
        const offset = -(this.adTime % 600);
        ctx.fillText(text + text, offset, 82);

        this.adTex.needsUpdate = true;
    }

    // Espectadores en las gradas
    buildCrowd() {
        const crowdCount = 1400;
        const geom = new THREE.BoxGeometry(0.35, 0.6, 0.35);
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        this.crowdInstanced = new THREE.InstancedMesh(geom, mat, crowdCount);

        const colors = [
            new THREE.Color('#FFFFFF'),
            new THREE.Color('#A50044'),
            new THREE.Color('#75AADB'),
            new THREE.Color('#FEDF00'),
            new THREE.Color('#1B2456'),
            new THREE.Color('#004D98'),
            new THREE.Color('#E74C3C')
        ];

        const dummy = new THREE.Object3D();
        let idx = 0;

        // Distribución en 4 sectores
        for (let i = 0; i < crowdCount; i++) {
            const sector = i % 4;
            let x = 0, y = 0, z = 0;
            const tier = Math.floor(Math.random() * 8);

            if (sector === 0) { // Norte
                x = (Math.random() - 0.5) * 115;
                z = -60 - tier * 2.5;
                y = 2.0 + tier * 1.8;
            } else if (sector === 1) { // Sur
                x = (Math.random() - 0.5) * 115;
                z = 64 + tier * 2.5;
                y = 2.0 + tier * 1.8;
            } else if (sector === 2) { // Este
                x = 68 + tier * 2.2;
                z = (Math.random() - 0.5) * 65;
                y = 2.0 + tier * 1.8;
            } else { // Oeste
                x = -68 - tier * 2.2;
                z = (Math.random() - 0.5) * 65;
                y = 2.0 + tier * 1.8;
            }

            if (sector === 1) y = -10;
            dummy.position.set(x, y, z);
            dummy.updateMatrix();
            this.crowdInstanced.setMatrixAt(idx, dummy.matrix);
            this.crowdInstanced.setColorAt(idx, colors[Math.floor(Math.random() * colors.length)]);
            idx++;
        }

        this.crowdInstanced.instanceMatrix.needsUpdate = true;
        this.crowdInstanced.instanceColor.needsUpdate = true;
        this.stadiumGroup.add(this.crowdInstanced);
    }

    // --- Torres de Iluminación Nocturna (4 Torres de Focos) ---
    buildLighting() {
        // Luz ambiental fría de estadio
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        this.scene.add(ambientLight);

        // Luz direccional cenital suave
        const sunLight = new THREE.DirectionalLight(0xa5c2ff, 0.4);
        sunLight.position.set(-20, 60, 20);
        this.scene.add(sunLight);

        // 4 Torres en los vértices del estadio
        const towerPositions = [
            [-58, 38, -42],
            [58, 38, -42],
            [-58, 38, 42],
            [58, 38, 42]
        ];

        towerPositions.forEach(([tx, ty, tz], idx) => {
            // Estructura de la torre
            const towerGeom = new THREE.BoxGeometry(1.2, ty, 1.2);
            const towerMat = new THREE.MeshLambertMaterial({ color: 0x222633 });
            const towerMesh = new THREE.Mesh(towerGeom, towerMat);
            towerMesh.position.set(tx, ty / 2, tz);
            this.stadiumGroup.add(towerMesh);

            // Batería de focos (SpotLight)
            const spot = new THREE.SpotLight(0xfff8ee, 1.6);
            spot.position.set(tx, ty, tz);
            // Apuntar a áreas clave de la cancha
            spot.target.position.set(tx > 0 ? 18 : -18, 0, tz > 0 ? 8 : -8);
            spot.angle = Math.PI / 3.8;
            spot.penumbra = 0.45;
            spot.decay = 1.2;
            spot.distance = 160;

            if (idx === 0) {
                spot.castShadow = true;
                spot.shadow.mapSize.width = 1024;
                spot.shadow.mapSize.height = 1024;
                spot.shadow.camera.near = 10;
                spot.shadow.camera.far = 160;
                spot.shadow.bias = -0.001;
                spot.shadow.normalBias = 0.03;
            }

            this.scene.add(spot);
            this.scene.add(spot.target);
        });
    }

    // --- Malla 3D del Balón ---
    buildBallMesh() {
        const ballGeom = new THREE.SphereGeometry(0.22, 24, 24);

        // Textura clásica pentagonal en Canvas
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 512, 256);

        // Pentágonos negros y detalles dorados Shaolin
        ctx.fillStyle = '#111111';
        for (let i = 0; i < 8; i++) {
            const cx = (i % 4) * 128 + 64;
            const cy = Math.floor(i / 4) * 128 + 64;
            ctx.beginPath();
            for (let p = 0; p < 5; p++) {
                const angle = (p * Math.PI * 2) / 5 - Math.PI / 2;
                const px = cx + Math.cos(angle) * 32;
                const py = cy + Math.sin(angle) * 32;
                if (p === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Rayas neón doradas
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 4;
        ctx.strokeRect(10, 10, 492, 236);

        const ballTex = new THREE.CanvasTexture(canvas);
        const ballMat = new THREE.MeshStandardMaterial({
            map: ballTex,
            roughness: 0.35,
            metalness: 0.15
        });

        this.ballMesh = new THREE.Mesh(ballGeom, ballMat);
        this.ballMesh.castShadow = true;
        this.ballMesh.scale.setScalar(1.3);
        this.scene.add(this.ballMesh);
        this.ballMarker = new THREE.Mesh(new THREE.RingGeometry(.38,.5,24), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.65,side:THREE.DoubleSide}));
        this.ballMarker.rotation.x=-Math.PI/2;
        this.scene.add(this.ballMarker);

        // Luz tenue que acompaña el balón para visibilidad óptima
        this.ballGlow = new THREE.PointLight(0xFFFFFF, 0.4, 6);
        this.ballMesh.add(this.ballGlow);
    }

    // Sincronizar posición del balón físico
    syncBall(physBall) {
        this.ballMesh.position.set(physBall.x, physBall.y, physBall.z);
        this.ballMarker.position.set(physBall.x,.035,physBall.z);

        // Rotación continua según el spin físico
        this.ballMesh.rotation.x += physBall.wx * 0.016;
        this.ballMesh.rotation.y += physBall.wy * 0.016;
        this.ballMesh.rotation.z += physBall.wz * 0.016;

        // Estela de disparo potente / Shaolin
        if (physBall.speed > 22.0) {
            this.emitShaolinTrail(physBall);
        }
    }

    // Partículas de estela de supertiro (Shaolin Flame Trail)
    emitShaolinTrail(physBall) {
        const count = 3;
        for (let i = 0; i < count; i++) {
            const pGeom = new THREE.SphereGeometry(0.12, 6, 6);
            const pMat = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.4 ? 0xFF4400 : 0xFFCC00,
                transparent: true,
                opacity: 0.85
            });
            const pMesh = new THREE.Mesh(pGeom, pMat);
            pMesh.position.set(
                physBall.x + (Math.random() - 0.5) * 0.2,
                physBall.y + (Math.random() - 0.5) * 0.2,
                physBall.z + (Math.random() - 0.5) * 0.2
            );
            this.fxGroup.add(pMesh);

            this.particles.push({
                mesh: pMesh,
                life: 0.3,
                maxLife: 0.3,
                scaleDecay: true
            });
        }
    }

    // Partículas de césped levantado en tackles
    emitTackleTurf(pos, dir) {
        for (let i = 0; i < 12; i++) {
            const pGeom = new THREE.BoxGeometry(0.06, 0.06, 0.06);
            const pMat = new THREE.MeshLambertMaterial({
                color: Math.random() > 0.5 ? 0x246b28 : 0x4a3718
            });
            const pMesh = new THREE.Mesh(pGeom, pMat);
            pMesh.position.set(pos.x, 0.1, pos.z);
            this.fxGroup.add(pMesh);

            this.particles.push({
                mesh: pMesh,
                vx: dir.x * 2.5 + (Math.random() - 0.5) * 2.0,
                vy: 2.0 + Math.random() * 2.5,
                vz: dir.z * 2.5 + (Math.random() - 0.5) * 2.0,
                life: 0.45,
                maxLife: 0.45,
                gravity: true
            });
        }
    }

    triggerScreenShake(intensity = 0.6) {
        this.cameraShake = intensity;
    }

    // --- Actualización de Cámara Estilo Transmisión TV ---
    setCameraMode(mode) {
        if (!this.cameraModes.includes(mode)) return;
        this.cameraMode = mode;
        this.fitCamera();
    }
    cycleCamera() {
        this.setCameraMode(this.cameraModes[(this.cameraModes.indexOf(this.cameraMode) + 1) % this.cameraModes.length]);
        return this.cameraLabels[this.cameraMode];
    }
    fitCamera() {
        const aspect = this.width / Math.max(1, this.height);
        const perspective = !!this.setPieceCameraConfig || ['SIDELINE', 'PLAYER'].includes(this.cameraMode);
        this.camera = perspective ? this.perspectiveCamera : this.overviewCamera;
        if (perspective) this.camera.aspect = aspect;
        else {
            const full = this.cameraMode === 'FULL';
            const halfH = Math.max(full ? 42 : 29, (full ? 62 : (aspect < 1 ? 22 : 40)) / aspect);
            this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
            this.camera.top = halfH; this.camera.bottom = -halfH;
        }
        this.camera.updateProjectionMatrix();
    }
    // Screen directions stay intuitive when the camera looks along the pitch.
    toWorldInput(input) {
        if (!input) return input;
        if (this.setPieceCameraConfig || ['SIDELINE', 'PLAYER'].includes(this.cameraMode)) {
            const forward = this.camera.getWorldDirection(new THREE.Vector3());
            forward.y = 0; forward.normalize();
            const right = new THREE.Vector3(-forward.z, 0, forward.x);
            return {...input,
                moveX: right.x * (input.moveX || 0) - forward.x * (input.moveZ || 0),
                moveZ: right.z * (input.moveX || 0) - forward.z * (input.moveZ || 0)};
        }
        return input;
    }
    updateCamera(dt, ballPos) {
        this.fitCamera();
        const clamp = THREE.MathUtils.clamp;
        const changed = this.lastCameraMode !== this.cameraMode || (!!this.setPieceCameraConfig !== !!this.lastSetPieceCamera);
        const blend = changed ? 0.35 : 1 - Math.exp(-6 * dt);
        const desired = new THREE.Vector3(), target = new THREE.Vector3();
        
        if (this.setPieceCameraConfig && ['PENALTY', 'FOUL', 'FREE_KICK', 'CORNER'].includes(this.setPieceCameraConfig.kind)) {
            const sp = this.setPieceCameraConfig;
            const dir = sp.dir || (sp.team?.attacksRight ? 1 : -1);
            const goalX = dir * 52.5;
            const kicker = sp.kicker || { x: ballPos.x, z: ballPos.z };
            const aim = sp.aimAngle ?? kicker.facingAngle ?? (dir * Math.PI / 2);

            if (sp.kind === 'PENALTY') {
                target.set(goalX, 1.45, 0);
                desired.set(sp.pos.x - dir * 8.2, 3.0, kicker.z * 0.35);
                const fov = 48;
                this.camera.fov += (fov - this.camera.fov) * blend;
            } else if (sp.kind === 'CORNER') {
                target.set(goalX - dir * 8.5, 1.6, Math.sign(sp.pos.z) * 3.5);
                desired.set(sp.pos.x - dir * 4.8, 4.6, sp.pos.z + Math.sign(sp.pos.z) * 5.0);
                const fov = 56;
                this.camera.fov += (fov - this.camera.fov) * blend;
            } else {
                // FOUL / TIRO LIBRE: Vista detrás del pateador hacia el arco y la barrera
                const fwdX = Math.sin(aim), fwdZ = Math.cos(aim);
                target.set(sp.pos.x + fwdX * 28, 1.4, sp.pos.z + fwdZ * 28);
                desired.set(sp.pos.x - fwdX * 9.5, 4.2, sp.pos.z - fwdZ * 9.5);
                const fov = 52;
                this.camera.fov += (fov - this.camera.fov) * blend;
            }
        } else if (this.cameraMode === 'SIDELINE') {
            // Low commentary gantry, inside the stands and outside the touchline.
            target.set(clamp(ballPos.x + (ballPos.vx || 0) * .3, -51, 51), 1.1, clamp(ballPos.z, -33, 33));
            desired.set(clamp(ballPos.x * .65, -36, 36), 5.2, 43);
            const distance = desired.distanceTo(target);
            const aspect = this.width / Math.max(1, this.height);
            const fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(15 / (distance * Math.min(1, aspect)))), 30, 78);
            this.camera.fov += (fov - this.camera.fov) * blend;
        } else if (this.cameraMode === 'PLAYER') {
            const p = this.cameraContext.player || {x: ballPos.x, z: ballPos.z, vx: 0, vz: 0};
            const dir = this.cameraContext.attacksRight === false ? -1 : 1;
            const speed = Math.hypot(p.vx || 0, p.vz || 0);
            const dx = ballPos.x - p.x, dz = ballPos.z - p.z;
            const distance = Math.hypot(dx, dz);
            const ballWeight = Math.min(.4, 10 / Math.max(1, distance));
            target.set(p.x + dir * 2.5 + dx * ballWeight, .9, p.z + dz * ballWeight);
            // Follow the attack direction, not every turn of the player's body.
            // Pull back when sprinting or when the ball is away from the player.
            const retreat = 12 + Math.min(5, speed * .35 + distance * .07);
            desired.set(clamp(p.x - dir * retreat, -60, 60), 7 + Math.min(3, distance * .06), clamp(p.z + 8, -40, 42));
            const fov = this.width < this.height ? 78 : 60;
            this.camera.fov += (fov - this.camera.fov) * blend;
            // Keep nearby contests in frame, including a ball arriving from behind.
            if (distance < 32) {
                const forward = target.clone().sub(desired).normalize();
                const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0,1,0)).normalize();
                const up = new THREE.Vector3().crossVectors(right,forward).normalize();
                const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
                const aspect = this.width / Math.max(1,this.height);
                let pullback = 0;
                for (const point of [new THREE.Vector3(p.x,0,p.z),new THREE.Vector3(p.x,2.8,p.z),new THREE.Vector3(ballPos.x,ballPos.y || .22,ballPos.z)]) {
                    const offset = point.sub(desired), depth = offset.dot(forward);
                    pullback = Math.max(pullback,Math.abs(offset.dot(right))/(tan*aspect*.75)-depth,
                        Math.abs(offset.dot(up))/(tan*.65)-depth);
                }
                desired.addScaledVector(forward,-Math.min(24,Math.max(0,pullback)));
                desired.x=clamp(desired.x,-60,60);desired.z=clamp(desired.z,-43,43);
            }
        } else {
            target.set(this.cameraMode === 'FULL' ? 0 : clamp(ballPos.x * .72, -38, 38), 0,
                this.cameraMode === 'FULL' ? 0 : ballPos.z * .18);
            this.cameraTarget.lerp(target, blend);
            desired.set(this.cameraTarget.x, 100, this.cameraTarget.z + 100);
        }
        if (changed && this.setPieceCameraConfig) {
            this.cameraTarget.copy(target);
            this.camera.position.copy(desired);
            this.camera.updateProjectionMatrix();
        } else if (this.camera.isPerspectiveCamera) {
            this.cameraTarget.lerp(target, blend);
            this.camera.position.lerp(desired, blend);
            this.camera.updateProjectionMatrix();
        } else this.camera.position.copy(desired);
        this.camera.lookAt(this.cameraTarget);
        this.camera.updateMatrixWorld();
        this.lastCameraMode = this.cameraMode;
        this.lastSetPieceCamera = !!this.setPieceCameraConfig;
    }

    // Actualizar partículas
    updateParticles(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= dt;

            if (p.life <= 0) {
                this.fxGroup.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
                this.particles.splice(i, 1);
                continue;
            }

            const normLife = p.life / p.maxLife;

            if (p.gravity) {
                p.vy -= 9.8 * dt;
                p.mesh.position.x += p.vx * dt;
                p.mesh.position.y += p.vy * dt;
                p.mesh.position.z += p.vz * dt;
                if (p.mesh.position.y < 0.02) p.mesh.position.y = 0.02;
            }

            if (p.scaleDecay) {
                p.mesh.scale.setScalar(normLife);
                p.mesh.material.opacity = normLife;
            }
        }
    }

    // Guía visual de apuntado para tiros libres, córners, penales y saques de banda
    updateSetPieceAimGuide(ballPos, dirAngle, active, power = 0) {
        if (!this.aimGuideGroup) {
            this.aimGuideGroup = new THREE.Group();
            
            // Línea de trayectoria en el suelo
            const lineGeom = new THREE.PlaneGeometry(0.35, 8.0);
            lineGeom.translate(0, 4.0, 0); // Origen en la base
            const lineMat = new THREE.MeshBasicMaterial({
                color: 0x00E5FF,
                transparent: true,
                opacity: 0.65,
                depthWrite: false,
                side: THREE.DoubleSide
            });
            this.aimLineMesh = new THREE.Mesh(lineGeom, lineMat);
            this.aimLineMesh.rotation.x = -Math.PI / 2;
            this.aimGuideGroup.add(this.aimLineMesh);

            // Marcador de destino / flecha
            const arrowGeom = new THREE.ConeGeometry(0.6, 1.2, 16);
            arrowGeom.rotateX(Math.PI / 2);
            arrowGeom.translate(0, 0, 8.0);
            const arrowMat = new THREE.MeshBasicMaterial({
                color: 0xFFD700,
                transparent: true,
                opacity: 0.85,
                depthWrite: false
            });
            this.aimArrowMesh = new THREE.Mesh(arrowGeom, arrowMat);
            this.aimArrowMesh.position.y = 0.02;
            this.aimGuideGroup.add(this.aimArrowMesh);

            this.pitchGroup.add(this.aimGuideGroup);
        }

        if (!active || !ballPos) {
            this.aimGuideGroup.visible = false;
            return;
        }

        this.aimGuideGroup.visible = true;
        this.aimGuideGroup.position.set(ballPos.x, 0.03, ballPos.z);
        this.aimGuideGroup.rotation.y = dirAngle;

        // Escalar longitud según la potencia cargada
        const lengthScale = 1.0 + (power || 0) * 1.2;
        this.aimGuideGroup.scale.set(1.0, 1.0, lengthScale);

        // Color más intenso al cargar potencia
        if (this.aimLineMesh && this.aimLineMesh.material) {
            const chargeColor = power > 0.6 ? 0xFF3366 : (power > 0.2 ? 0xFFCC00 : 0x00E5FF);
            this.aimLineMesh.material.color.setHex(chargeColor);
        }
    }

    // Render del frame
    render(dt, physBall) {
        this.updateAdBoards(dt);
        this.updateParticles(dt);
        this.syncBall(physBall);
        this.updateCamera(dt, physBall);

        this.renderer.render(this.scene, this.camera);
    }
}

window.USF.RenderEngine = RenderEngine;
