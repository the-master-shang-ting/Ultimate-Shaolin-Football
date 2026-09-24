/**
 * Ultimate Shaolin Football (USF)
 * InputManager.js - Gestor universal de entradas (Xbox, Switch Pro, PS, Teclado, Touch)
 * Con normalización de botones, deadzone radial de 0.15, navegación de menús y eventos Toast
 */

window.USF = window.USF || {};

class InputManager {
    constructor() {
        this.keys = {};
        this.prevKeys = {};
        this.pressedKeys = new Set();
        this.pressedTouch = new Set();
        this.previousRaw = [{},{},{},{}];
        this.frameInputs = [];
        this.localMultiplayer = false;

        // Estado acumulativo de disparo por jugador (carga de potencia de 0 a 1)
        this.playerShootCharges = [0, 0, 0, 0];
        this.playerShootCharging = [false, false, false, false];

        // Estado anterior de botones de mandos para detectar "just pressed"
        this.prevGamepadButtons = [{}, {}, {}, {}];

        // Registro de mandos conectados previamente conocidos
        this.knownGamepads = new Map();

        // Control de repetición de navegación por menús con mando
        this.menuNavTimer = 0;
        this.menuNavInitialDelay = 0.26;
        this.menuNavRepeatRate = 0.13;
        this.isMenuNavigationActive = true; // Activo mientras no estemos en pleno partido

        // Detección de dispositivos táctiles
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.touchInput = {
            moveX: 0,
            moveZ: 0,
            pass: false,
            shoot: false,
            shootPower: 0,
            through: false,
            sprint: false
        };

        // Callbacks para navegación de UI y Toasts
        this.onGamepadToast = null;
        this.onMenuNav = null;
        this.onMenuConfirm = null;
        this.onMenuCancel = null;
        this.onMenuTab = null;
        this.onMenuPause = null;

        this.setupKeyboard();
        this.setupMouse();
        this.setupGamepadListeners();
        if (this.isTouchDevice) {
            this.setupTouchControls();
        }
    }

    // Identificar tipo de mando a partir del ID del navegador
    identifyGamepadType(idString = '') {
        const id = idString.toLowerCase();
        if (id.includes('xbox') || id.includes('xinput') || id.includes('microsoft')) {
            return {
                type: 'XBOX',
                displayName: 'Xbox Wireless Controller',
                icon: '🎮'
            };
        }
        if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('sony') || id.includes('054c')) {
            return {
                type: 'PLAYSTATION',
                displayName: id.includes('dualsense') ? 'PS5 DualSense Controller' : 'PS4 DualShock Controller',
                icon: '🎮'
            };
        }
        if (id.includes('switch') || id.includes('joy-con') || id.includes('nintendo') || id.includes('pro controller') || id.includes('057e')) {
            return {
                type: 'SWITCH',
                displayName: 'Nintendo Switch Pro Controller',
                icon: '🎮'
            };
        }
        return {
            type: 'GENERIC',
            displayName: idString.slice(0, 24) || 'Gamepad USB',
            icon: '🎮'
        };
    }

    setupGamepadListeners() {
        window.addEventListener('gamepadconnected', (e) => {
            const info = this.identifyGamepadType(e.gamepad.id);
            this.knownGamepads.set(e.gamepad.index, { ...info, id: e.gamepad.id });
            const slot = e.gamepad.index + 1;
            console.log(`InputManager: Mando conectado en slot ${slot}: ${info.displayName}`);

            if (this.onGamepadToast) {
                this.onGamepadToast({
                    title: 'Mando Conectado',
                    message: `${info.displayName} asignado a Jugador ${slot}`,
                    icon: info.icon,
                    type: 'connected'
                });
            }
        });

        window.addEventListener('gamepaddisconnected', (e) => {
            const info = this.knownGamepads.get(e.gamepad.index) || { displayName: 'Mando' };
            const slot = e.gamepad.index + 1;
            this.knownGamepads.delete(e.gamepad.index);
            console.log(`InputManager: Mando desconectado del slot ${slot}`);

            if (this.onGamepadToast) {
                this.onGamepadToast({
                    title: 'Mando Desconectado',
                    message: `${info.displayName} retirado (Jugador ${slot})`,
                    icon: '⚠️',
                    type: 'disconnected'
                });
            }
        });
    }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.target.closest?.('input, textarea')) return;
            if (!this.keys[e.code] && !e.repeat) this.pressedKeys.add(e.code);
            this.keys[e.code] = true;
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });

        window.addEventListener('blur', () => {
            this.reset();
        });
    }

    setupMouse() {
        this.mouseDown = false;
        window.addEventListener('mousedown', (e) => {
            if (e.target.closest('#game-container') && !this.isMenuNavigationActive) {
                if (e.button === 0) {
                    this.mouseDown = true;
                    this.mousePressed = true;
                }
            }
        });

        window.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.mouseDown = false;
            }
        });
    }

    setupTouchControls() {
        const touchContainer = document.getElementById('touch-controls');
        if (!touchContainer) return;
        touchContainer.dataset.enabled = 'true';

        const joystickZone = document.getElementById('joystick-zone');
        const joystickBase = document.getElementById('joystick-base');
        const joystickKnob = document.getElementById('joystick-knob');
        if (!joystickZone || !joystickKnob) return;

        let touchId = null;
        let startX = 0, startY = 0;
        const maxDist = 48;

        joystickZone.addEventListener('touchstart', (e) => {
            const touch = e.changedTouches[0];
            touchId = touch.identifier;
            startX = touch.clientX;
            startY = touch.clientY;
            
            // Posicionar el joystick exactamente bajo el dedo del usuario (Joystick Flotante)
            if (joystickBase) {
                joystickBase.style.left = `${startX}px`;
                joystickBase.style.top = `${startY}px`;
                joystickBase.style.bottom = 'auto';
                joystickBase.style.opacity = '1';
            }
            this.updateJoystick(0, 0, maxDist, joystickKnob);
            e.preventDefault();
        }, { passive: false });

        joystickZone.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === touchId) {
                    this.updateJoystick(touch.clientX - startX, touch.clientY - startY, maxDist, joystickKnob);
                    break;
                }
            }
            e.preventDefault();
        }, { passive: false });

        const resetJoystick = (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === touchId) {
                    touchId = null;
                    if (joystickKnob) joystickKnob.style.transform = `translate(-50%, -50%)`;
                    if (joystickBase) joystickBase.style.opacity = '0.6';
                    this.touchInput.moveX = 0;
                    this.touchInput.moveZ = 0;
                    break;
                }
            }
        };

        joystickZone.addEventListener('touchend', resetJoystick);
        joystickZone.addEventListener('touchcancel', resetJoystick);

        this.bindTouchButton('btn-touch-pass', (pressed) => { this.touchInput.pass = pressed; });
        this.bindTouchButton('btn-touch-through', (pressed) => { this.touchInput.through = pressed; });
        this.bindTouchButton('btn-touch-sprint', (pressed) => { this.touchInput.sprint = pressed; });
        this.bindTouchButton('btn-touch-shoot', (pressed) => { this.touchInput.shootCharging = pressed; });
        this.bindTouchButton('btn-touch-switch', (pressed) => { this.touchInput.switchPlayer = pressed; });

        // Botones auxiliares móviles
        document.getElementById('btn-touch-fullscreen')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFullscreen();
        });
        document.getElementById('btn-touch-pause')?.addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('btn-hud-pause')?.click();
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }

    updateJoystick(dx, dy, maxDist, knob) {
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);

        const kx = Math.cos(angle) * clampedDist;
        const ky = Math.sin(angle) * clampedDist;
        if (knob) knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

        // Deadzone radial suave
        if (clampedDist < 8) {
            this.touchInput.moveX = 0;
            this.touchInput.moveZ = 0;
        } else {
            this.touchInput.moveX = kx / maxDist;
            this.touchInput.moveZ = ky / maxDist;
        }
    }

    bindTouchButton(id, callback) {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.pressedTouch.add(id);
            btn.classList.add('active');
            if (window.navigator?.vibrate) {
                try { window.navigator.vibrate(12); } catch (err) {}
            }
            callback(true);
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            callback(false);
        }, { passive: false });
        btn.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            btn.classList.remove('active');
            callback(false);
        }, { passive: false });
    }

    // --- Zona Muerta Radial (Deadzone ~0.15) ---
    applyDeadzone(x, y, deadzone = 0.15) {
        const rawDist = Math.hypot(x, y);
        if (rawDist < deadzone) {
            return { x: 0, y: 0 };
        }
        // Escalar suavemente de 0 a 1 eliminando el salto brusco al superar el umbral
        const factor = Math.min(1.0, (rawDist - deadzone) / (1.0 - deadzone));
        return {
            x: (x / rawDist) * factor,
            y: (y / rawDist) * factor
        };
    }

    // --- Normalización Universal de Botones para Xbox, Switch Pro y PlayStation ---
    normalizeGamepadState(gp) {
        if (!gp || !gp.connected) return null;

        const info = this.identifyGamepadType(gp.id);
        const b = gp.buttons;
        const axes = gp.axes;

        // Eje principal de movimiento (Stick Izquierdo) con deadzone radial
        const stickLeftRawX = axes[0] || 0;
        const stickLeftRawY = axes[1] || 0;
        const stickLeft = this.applyDeadzone(stickLeftRawX, stickLeftRawY, 0.15);

        // D-Pad (Cruceta direccional)
        // En mapeo estándar: 12=Arriba, 13=Abajo, 14=Izquierda, 15=Derecha
        let dpadUp = !!(b[12] && b[12].pressed);
        let dpadDown = !!(b[13] && b[13].pressed);
        let dpadLeft = !!(b[14] && b[14].pressed);
        let dpadRight = !!(b[15] && b[15].pressed);

        // Fallback para DirectInput. Algunos Switch Pro exponen la cruceta en
        // axes 6/7; otros mandos genéricos la dejan en 4/5.
        if (gp.mapping !== 'standard' && !dpadUp && !dpadDown && !dpadLeft && !dpadRight) {
            const dpadAxisX = (info.type === 'SWITCH' && axes.length > 7) ? axes[6] : axes[4];
            const dpadAxisY = (info.type === 'SWITCH' && axes.length > 7) ? axes[7] : axes[5];
            if ((dpadAxisY || 0) < -0.5) dpadUp = true;
            if ((dpadAxisY || 0) > 0.5) dpadDown = true;
            if ((dpadAxisX || 0) < -0.5) dpadLeft = true;
            if ((dpadAxisX || 0) > 0.5) dpadRight = true;
        }

        // Mapeo normalizado ergonómico:
        // bottomBtn: Pase / Confirmar (Xbox A, PS Cross, Switch Pro B físico / botón inferior)
        // leftBtn: Tiro / Entrada Fuerte (Xbox X, PS Square, Switch Pro Y físico / botón izquierdo)
        // topBtn: Pase Filtrado (Xbox Y, PS Triangle, Switch Pro X físico / botón superior)
        // rightBtn: Tackle / Volver / Cancelar (Xbox B, PS Circle, Switch Pro A físico / botón derecho)
        let btnBottom = false;
        let btnRight = false;
        let btnLeft = false;
        let btnTop = false;

        if (info.type === 'SWITCH' && gp.mapping !== 'standard') {
            // Reasignación para Nintendo Switch Pro en drivers DirectInput donde B=0, A=1, Y=2, X=3
            btnBottom = !!(b[0] && b[0].pressed); // B físico (abajo)
            btnRight = !!(b[1] && b[1].pressed);  // A físico (derecha)
            btnLeft = !!(b[2] && b[2].pressed);   // Y físico (izquierda)
            btnTop = !!(b[3] && b[3].pressed);    // X físico (arriba)
        } else {
            // Estándar XInput / Web Standard (Xbox, PlayStation, etc.)
            btnBottom = !!(b[0] && b[0].pressed);
            btnRight = !!(b[1] && b[1].pressed);
            btnLeft = !!(b[2] && b[2].pressed);
            btnTop = !!(b[3] && b[3].pressed);
        }

        const btnLB = !!(b[4] && b[4].pressed);
        const btnRB = !!(b[5] && b[5].pressed);
        // Chrome/Edge suelen informar los gatillos como botones; ciertos
        // drivers DirectInput los publican como ejes. No reutilizamos los ejes
        // reservados para la cruceta del Switch Pro.
        const triggerAxisL = info.type === 'SWITCH' ? axes[4] : axes[2];
        const triggerAxisR = axes[5];
        const btnLT = !!(b[6] && b[6].pressed) || (gp.mapping !== 'standard' && (triggerAxisL || 0) > 0.5);
        const btnRT = !!(b[7] && b[7].pressed) || (gp.mapping !== 'standard' && (triggerAxisR || 0) > 0.5);
        const btnStart = !!(b[9] && b[9].pressed);
        const btnSelect = !!(b[8] && b[8].pressed);

        return {
            info,
            stickX: stickLeft.x,
            stickZ: stickLeft.y,
            dpadUp,
            dpadDown,
            dpadLeft,
            dpadRight,
            pass: btnBottom,
            shoot: btnLeft,
            through: btnTop,
            tackle: btnRight,
            sprint: btnRT || btnRB,
            switchPlayer: btnLB,
            pause: btnStart,
            select: btnSelect,
            confirm: btnBottom,
            cancel: btnRight,
            tabLeft: btnLB,
            tabRight: btnRB
        };
    }

    // --- Navegación de Menús con Mando (D-Pad / Stick + A / B / LB / RB) ---
    processMenuGamepadNavigation(dt, gamepads) {
        if (!this.isMenuNavigationActive) return;

        this.menuNavTimer -= dt;

        // Comprobar primer mando conectado o cualquiera que envíe señales
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (!gp || !gp.connected) continue;

            const state = this.normalizeGamepadState(gp);
            if (!state) continue;

            const prev = this.prevGamepadButtons[i] || {};

            // Detección de pulsación única (Just Pressed) para botones
            const justConfirm = state.confirm && !prev.confirm;
            const justCancel = state.cancel && !prev.cancel;
            const justTabLeft = state.tabLeft && !prev.tabLeft;
            const justTabRight = state.tabRight && !prev.tabRight;
            const justPause = state.pause && !prev.pause;

            if (justConfirm && this.onMenuConfirm) this.onMenuConfirm({ slot: i });
            if (justCancel && this.onMenuCancel) this.onMenuCancel({ slot: i });
            if (justTabLeft && this.onMenuTab) this.onMenuTab({ dir: -1, slot: i });
            if (justTabRight && this.onMenuTab) this.onMenuTab({ dir: 1, slot: i });
            if (justPause && this.onMenuPause) this.onMenuPause({ slot: i });

            // Navegación direccional con cruceta o stick izquierdo
            const navUp = state.dpadUp || state.stickZ < -0.55;
            const navDown = state.dpadDown || state.stickZ > 0.55;
            const navLeft = state.dpadLeft || state.stickX < -0.55;
            const navRight = state.dpadRight || state.stickX > 0.55;

            const hasNavInput = navUp || navDown || navLeft || navRight;

            if (hasNavInput && this.menuNavTimer <= 0) {
                let dir = null;
                if (navUp) dir = 'up';
                else if (navDown) dir = 'down';
                else if (navLeft) dir = 'left';
                else if (navRight) dir = 'right';

                if (dir && this.onMenuNav) {
                    this.onMenuNav({ dir, slot: i });
                    // Primer retraso más largo para evitar repeticiones accidentales
                    this.menuNavTimer = (!prev.hasNavInput) ? this.menuNavInitialDelay : this.menuNavRepeatRate;
                }
            } else if (!hasNavInput) {
                // Si suelta la cruceta/stick, resetear timer de navegación
                this.menuNavTimer = 0;
            }

            // Guardar estado previo
            this.prevGamepadButtons[i] = {
                confirm: state.confirm,
                cancel: state.cancel,
                tabLeft: state.tabLeft,
                tabRight: state.tabRight,
                pause: state.pause,
                hasNavInput
            };
        }
    }

    // --- Polling de Entrada por Frame ---
    update(dt = 0.016) {
        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

        // Detección de mandos en navegadores que no disparan eventos iniciales
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp && gp.connected && !this.knownGamepads.has(i)) {
                const info = this.identifyGamepadType(gp.id);
                this.knownGamepads.set(i, { ...info, id: gp.id });
                if (this.onGamepadToast) {
                    this.onGamepadToast({
                        title: 'Mando Detectado',
                        message: `${info.displayName} listo en Slot ${i + 1}`,
                        icon: info.icon,
                        type: 'connected'
                    });
                }
            }
        }

        // Navegación de menús con gamepad
        this.processMenuGamepadNavigation(dt, gamepads);

        for (let slot=0;slot<4;slot++) {
            const raw=this.getRawInputForSlot(slot,gamepads), prev=this.previousRaw[slot]||{};
            const gp=this.normalizeGamepadState(gamepads[slot]);
            if (!this.isMenuNavigationActive && gp?.pause && !prev.pause) this.onMenuPause?.();
            if (this.isMenuNavigationActive) {
                // En menú: reiniciar carga y bloquear inputs de juego
                this.playerShootCharges[slot]=0;
                this.frameInputs[slot]={moveX:0,moveZ:0,currentShootPower:0};
            } else {
                // Durante el partido: acumular carga de disparo y procesar eventos
                if(raw.shootHold) {
                    this.playerShootCharges[slot]=Math.min(1,(this.playerShootCharges[slot]||0)+dt*1.35);
                    if (slot === 0) {
                        const gauge = document.getElementById('touch-shoot-gauge');
                        if (gauge) gauge.style.height = `${Math.round(this.playerShootCharges[0] * 100)}%`;
                    }
                }
                const released=!!prev.shootHold && !raw.shootHold;
                this.frameInputs[slot]={...raw,
                    pass:!!raw.pass&&!prev.pass,through:!!raw.through&&!prev.through,
                    tackle:!!raw.tackle&&!prev.tackle,switchPlayer:!!raw.switchPlayer&&!prev.switchPlayer,
                    shootPressed:!!raw.shootHold&&!prev.shootHold,shootReleased:released,
                    shootPower:released?Math.max(.15,this.playerShootCharges[slot]):0,
                    currentShootPower:this.playerShootCharges[slot]};
                if(released) {
                    this.playerShootCharges[slot]=0;
                    if (slot === 0) {
                        const gauge = document.getElementById('touch-shoot-gauge');
                        if (gauge) gauge.style.height = '0%';
                    }
                }
            }
            this.previousRaw[slot]={...raw,pause:gp?.pause};
        }
        this.pressedKeys.clear();
        this.pressedTouch.clear();
        this.mousePressed = false;
    }


    getRawInputForSlot(slot, gamepads) {
        const keys = {...this.keys};
        for (const code of this.pressedKeys) keys[code] = true;
        // Slot 0: Teclado + Mouse + Gamepad 0 (o Touch)
        if (slot === 0) {
            let moveX = 0;
            let moveZ = 0;

            if (keys['KeyA'] || (!this.localMultiplayer && keys['ArrowLeft'])) moveX -= 1;
            if (keys['KeyD'] || (!this.localMultiplayer && keys['ArrowRight'])) moveX += 1;
            if (keys['KeyW'] || (!this.localMultiplayer && keys['ArrowUp'])) moveZ -= 1;
            if (keys['KeyS'] || (!this.localMultiplayer && keys['ArrowDown'])) moveZ += 1;

            const len = Math.hypot(moveX, moveZ);
            if (len > 0) {
                moveX /= len;
                moveZ /= len;
            }

            const passKey = !!(keys['KeyK'] || this.mouseDown || this.mousePressed);
            const shootHold = !!keys['KeyJ'];
            const throughKey = !!keys['KeyL'];
            const tackleKey = !!(keys['KeyE'] || keys['KeyI'] || keys['KeyB']);
            const sprintKey = !!(keys['ShiftLeft'] || (!this.localMultiplayer && keys['ShiftRight']));
            const switchKey = !!(keys['Space'] || keys['KeyQ']);

            // Mando Slot 0
            const gp0 = gamepads[0];
            const gpState = this.normalizeGamepadState(gp0);

            let gpMoveX = 0, gpMoveZ = 0, gpPass = false, gpShootHold = false, gpThrough = false, gpTackle = false, gpSprint = false, gpSwitch = false;

            if (gpState) {
                gpMoveX = gpState.stickX;
                gpMoveZ = gpState.stickZ;
                gpPass = gpState.pass;
                gpShootHold = gpState.shoot;
                gpThrough = gpState.through;
                gpTackle = gpState.tackle;
                gpSprint = gpState.sprint;
                gpSwitch = gpState.switchPlayer;
            }

            return {
                moveX: Math.abs(gpMoveX) > 0.05 ? gpMoveX : (this.touchInput.moveX || moveX),
                moveZ: Math.abs(gpMoveZ) > 0.05 ? gpMoveZ : (this.touchInput.moveZ || moveZ),
                pass: passKey || gpPass || this.touchInput.pass || this.pressedTouch.has('btn-touch-pass'),
                shootHold: shootHold || gpShootHold || this.touchInput.shootCharging || this.pressedTouch.has('btn-touch-shoot'),
                through: throughKey || gpThrough || this.touchInput.through || this.pressedTouch.has('btn-touch-through'),
                tackle: tackleKey || gpTackle,
                sprint: sprintKey || gpSprint || this.touchInput.sprint,
                switchPlayer: switchKey || gpSwitch || this.touchInput.switchPlayer || this.pressedTouch.has('btn-touch-switch')
            };
        }

        if (slot===1 && this.localMultiplayer && !gamepads[1]) {
            let x=Number(!!keys.ArrowRight)-Number(!!keys.ArrowLeft);
            let z=Number(!!keys.ArrowDown)-Number(!!keys.ArrowUp);
            const length=Math.max(1,Math.hypot(x,z));
            return {moveX:x/length,moveZ:z/length,pass:!!keys.Numpad1,shootHold:!!keys.Numpad2,
                through:!!keys.Numpad3,tackle:!!keys.Numpad0,sprint:!!keys.ShiftRight,switchPlayer:!!keys.Enter};
        }
        // Slots 1, 2, 3: Mandos secundarios
        const gpIndex = slot;
        const gp = gamepads[gpIndex];
        const gpState = this.normalizeGamepadState(gp);

        if (gpState) {
            return {
                moveX: gpState.stickX,
                moveZ: gpState.stickZ,
                pass: gpState.pass,
                shootHold: gpState.shoot,
                through: gpState.through,
                tackle: gpState.tackle,
                sprint: gpState.sprint,
                switchPlayer: gpState.switchPlayer
            };
        }

        return { moveX: 0, moveZ: 0, pass: false, shootHold: false, through: false, tackle: false, sprint: false, switchPlayer: false };
    }

    getPlayerInput(slot = 0) {
        return this.frameInputs[slot] || {moveX:0,moveZ:0,currentShootPower:0};
    }
    reset() {
        this.keys={};this.mouseDown=false;this.mousePressed=false;
        this.pressedKeys.clear();this.pressedTouch.clear();
        this.previousRaw=[{},{},{},{}];this.frameInputs=[];
        this.playerShootCharges=[0,0,0,0];this.playerShootCharging=[false,false,false,false];
        for(const key of Object.keys(this.touchInput))this.touchInput[key]=0;
        const knob=document.getElementById('joystick-knob');
        if(knob)knob.style.transform='translate(-50%, -50%)';
    }
}
window.USF.InputManager = InputManager;
