/**
 * Ultimate Shaolin Football (USF)
 * PhysicsEngine.js - Físicas 3D del balón (Efecto Magnus, arrastre, rebote, fricción, postes y red)
 */

window.USF = window.USF || {};

class PhysicsEngine {
    constructor() {
        // Constantes del balón (Balón oficial FIFA Tamaño 5)
        this.radius = 0.22; // Metros
        this.mass = 0.43;   // Kilogramos
        this.airDensity = 1.225; // kg/m^3
        this.crossArea = Math.PI * this.radius * this.radius;
        this.dragCoeff = 0.24; // Coeficiente de resistencia aerodinámica
        this.magnusCoeff = 0.045; // Coeficiente del Efecto Magnus (curva)
        this.gravity = -9.81;

        // Estado del balón
        this.ball = {
            x: 0,
            y: this.radius,
            z: 0,
            vx: 0,
            vy: 0,
            vz: 0,
            // Velocidad angular (Spin / Rotación en rad/s)
            wx: 0,
            wy: 0,
            wz: 0,
            isGrounded: true,
            inNet: false,
            lastKicker: null,
            speed: 0
        };

        // Dimensiones reglamentarias de la cancha (en metros)
        this.PITCH_LENGTH = 105.0;
        this.PITCH_WIDTH = 68.0;
        this.HALF_LENGTH = 52.5;
        this.HALF_WIDTH = 34.0;

        // Dimensiones de la portería (ampliadas a escala de juego)
        this.GOAL_WIDTH = 9.6;
        this.GOAL_HALF_WIDTH = 4.8;
        this.GOAL_HEIGHT = 2.9;
        this.GOAL_DEPTH = 2.4;
        this.POST_RADIUS = 0.11;

        // Estado de congelamiento para saques y límites
        this.freezeBall = false;

        // Callbacks de eventos
        this.onGoal = null;
        this.onWoodwork = null;
        this.onOutOfBounds = null;

        // Parámetros de simulación
        this.subSteps = 4; // Sub-stepping para alta precisión a 60 FPS
    }

    freeze() {
        this.freezeBall = true;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.vz = 0;
        this.ball.wx = 0;
        this.ball.wy = 0;
        this.ball.wz = 0;
        this.ball.speed = 0;
    }

    unfreeze() {
        this.freezeBall = false;
    }

    resetBall(x = 0, y = this.radius, z = 0) {
        this.freezeBall = false;
        this.ball.x = x;
        this.ball.y = Math.max(this.radius, y);
        this.ball.z = z;
        this.ball.vx = 0;
        this.ball.vy = 0;
        this.ball.vz = 0;
        this.ball.wx = 0;
        this.ball.wy = 0;
        this.ball.wz = 0;
        this.ball.isGrounded = true;
        this.ball.inNet = false;
        this.ball.owner = null;
        this.ball.lastSelectedOwner = null;
        this.ball.lastKicker = null;
        this.ball.passTarget = null;
        this.ball.restartExempt = false;
        this.ball.kickCooldown = 0;
        this.ball.speed = 0;
    }

    // Aplicar fuerza de disparo / pase al balón con vector y rotación (Efecto Magnus)
    kickBall(direction, power, lift = 0.2, spinCurve = 0, kicker = null) {
        this.ball.owner = null;
        this.ball.passTarget = null;
        this.ball.restartExempt = false;
        this.ball.kickCooldown = 0.3;
        // Normalizar dirección en plano horizontal (X, Z)
        const dirLen = Math.hypot(direction.x, direction.z) || 1;
        const nx = direction.x / dirLen;
        const nz = direction.z / dirLen;

        // Magnitud de velocidad escalada por el stat TIR del jugador
        let tirScale = 1.0;
        let curveScale = 1.0;
        if (kicker && kicker.playerData && kicker.playerData.stats) {
            tirScale = 0.72 + (kicker.playerData.stats.TIR / 99) * 0.48;
            curveScale = 0.60 + (kicker.playerData.stats.TIR / 99) * 0.65;
        }

        const vMagnitude = (10.0 + power * 28.0) * tirScale;

        // Ángulo de elevación
        const elevation = Math.max(0.02, Math.min(0.65, lift));
        const horizScale = Math.cos(elevation);
        const vertScale = Math.sin(elevation);

        this.ball.vx = nx * vMagnitude * horizScale;
        this.ball.vy = vMagnitude * vertScale;
        this.ball.vz = nz * vMagnitude * horizScale;
        this.ball.speed = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz);

        // Rotación para Efecto Magnus:
        // spinCurve > 0 curva a la derecha, < 0 a la izquierda
        // wy genera efecto lateral. wx/wz generan topspin/backspin
        this.ball.wy = spinCurve * (15.0 + power * 25.0) * curveScale;
        this.ball.wx = -nz * (5.0 + power * 15.0);
        this.ball.wz = nx * (5.0 + power * 15.0);

        this.ball.isGrounded = false;
        this.ball.inNet = false;
        this.ball.lastKicker = kicker;
        this.freezeBall = false;
    }

    // Paso de integración física (dt en segundos)
    update(dt) {
        this.ball.kickCooldown = Math.max(0, (this.ball.kickCooldown || 0)-dt);
        if (this.ball.owner && !this.freezeBall) return;
        if (this.freezeBall) {
            this.ball.vx = 0;
            this.ball.vy = 0;
            this.ball.vz = 0;
            this.ball.speed = 0;
            return;
        }

        const subDt = dt / this.subSteps;

        for (let s = 0; s < this.subSteps; s++) {
            this.previousBall = { x: this.ball.x, y: this.ball.y, z: this.ball.z };
            this.stepPhysics(subDt);
            if (this.freezeBall) break;
        }

        this.ball.speed = Math.hypot(this.ball.vx, this.ball.vy, this.ball.vz);
    }

    stepPhysics(dt) {
        if (this.freezeBall) return;
        const b = this.ball;
        const vSq = b.vx * b.vx + b.vy * b.vy + b.vz * b.vz;
        const vMag = Math.sqrt(vSq);

        // --- 1. Fuerza de Arrastre Aerodinámico (Aerodynamic Drag) ---
        // F_drag = -0.5 * rho * Cd * A * v^2
        let fDragX = 0, fDragY = 0, fDragZ = 0;
        if (vMag > 0.001) {
            const dragMag = 0.5 * this.airDensity * this.dragCoeff * this.crossArea * vSq;
            fDragX = -dragMag * (b.vx / vMag);
            fDragY = -dragMag * (b.vy / vMag);
            fDragZ = -dragMag * (b.vz / vMag);
        }

        // --- 2. Efecto Magnus (Fuerza de sustentación y curvatura) ---
        // F_magnus = C_L * rho * r^3 * (omega x v)
        // Producto vectorial: (wy*vz - wz*vy, wz*vx - wx*vz, wx*vy - wy*vx)
        const magnusFactor = this.magnusCoeff * this.airDensity * Math.pow(this.radius, 3);
        const crossX = b.wy * b.vz - b.wz * b.vy;
        const crossY = b.wz * b.vx - b.wx * b.vz;
        const crossZ = b.wx * b.vy - b.wy * b.vx;

        const fMagX = magnusFactor * crossX;
        const fMagY = magnusFactor * crossY;
        const fMagZ = magnusFactor * crossZ;

        // --- 3. Aceleración total (Fuerzas / Masa + Gravedad) ---
        const ax = (fDragX + fMagX) / this.mass;
        const ay = (fDragY + fMagY) / this.mass + this.gravity;
        const az = (fDragZ + fMagZ) / this.mass;

        // Integración de velocidad
        b.vx += ax * dt;
        b.vy += ay * dt;
        b.vz += az * dt;

        // Disipación natural del spin en el aire
        const spinDecay = Math.exp(-0.45 * dt);
        b.wx *= spinDecay;
        b.wy *= spinDecay;
        b.wz *= spinDecay;

        // Integración de posición
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;

        // --- 4. Interacción con el Césped (Rebote y Fricción de Rodadura) ---
        if (b.y <= this.radius) {
            b.y = this.radius;

            if (b.vy < -0.6) {
                // Rebote inelástico
                const restitution = 0.68;
                b.vy = -b.vy * restitution;

                // Fricción tangential del impacto que induce o reduce spin
                b.vx *= 0.88;
                b.vz *= 0.88;
                b.wy *= 0.85;
                b.isGrounded = false;
            } else {
                // Rodando sobre el césped
                b.vy = 0;
                b.isGrounded = true;

                // Fricción de rodadura
                const rollingFriction = 3.6; // Desaceleración en m/s^2
                const horizSpeed = Math.hypot(b.vx, b.vz);
                if (horizSpeed > 0.01) {
                    const decel = Math.min(horizSpeed, rollingFriction * dt);
                    b.vx -= (b.vx / horizSpeed) * decel;
                    b.vz -= (b.vz / horizSpeed) * decel;

                    // El rodar sincroniza la rotación
                    b.wz = b.vx / this.radius;
                    b.wx = -b.vz / this.radius;
                } else {
                    b.vx = 0;
                    b.vz = 0;
                    b.wx = 0;
                    b.wz = 0;
                }
            }
        } else {
            b.isGrounded = false;
        }

        // --- 5. Colisiones con los Postes y el Travesaño ---
        this.checkGoalFrameCollisions();

        // --- 6. Física de la Red y Detección de Gol ---
        this.checkGoalNetPhysics(dt);
    }

    // Colisión con tubos de postes (izquierdo, derecho y travesaño)
    checkGoalFrameCollisions() {
        const b = this.ball;
        const goalsX = [-this.HALF_LENGTH, this.HALF_LENGTH];

        goalsX.forEach(gx => {
            // Postes verticales en z = -GOAL_HALF_WIDTH y z = +GOAL_HALF_WIDTH
            const postZs = [-this.GOAL_HALF_WIDTH, this.GOAL_HALF_WIDTH];

            postZs.forEach(pz => {
                // Comprobar colisión cilíndrica con poste vertical
                const dx = b.x - gx;
                const dz = b.z - pz;
                const distXZ = Math.hypot(dx, dz);
                const combinedRadius = this.radius + this.POST_RADIUS;

                if (distXZ < combinedRadius && b.y <= this.GOAL_HEIGHT + this.POST_RADIUS) {
                    // Impacto en poste vertical
                    const nx = dx / (distXZ || 1);
                    const nz = dz / (distXZ || 1);

                    // Reflejar velocidad
                    const dot = b.vx * nx + b.vz * nz;
                    if (dot < 0) {
                        b.vx = (b.vx - 2 * dot * nx) * 0.75;
                        b.vz = (b.vz - 2 * dot * nz) * 0.75;
                        b.x = gx + nx * (combinedRadius + 0.01);
                        b.z = pz + nz * (combinedRadius + 0.01);

                        if (this.onWoodwork) this.onWoodwork({ x: b.x, y: b.y, z: b.z });
                    }
                }
            });

            // Travesaño horizontal en y = GOAL_HEIGHT entre z = -GOAL_HALF_WIDTH y z = +GOAL_HALF_WIDTH
            if (Math.abs(b.z) <= this.GOAL_HALF_WIDTH + this.POST_RADIUS) {
                const dx = b.x - gx;
                const dy = b.y - this.GOAL_HEIGHT;
                const distXY = Math.hypot(dx, dy);
                const combinedRadius = this.radius + this.POST_RADIUS;

                if (distXY < combinedRadius) {
                    const nx = dx / (distXY || 1);
                    const ny = dy / (distXY || 1);

                    const dot = b.vx * nx + b.vy * ny;
                    if (dot < 0) {
                        b.vx = (b.vx - 2 * dot * nx) * 0.75;
                        b.vy = (b.vy - 2 * dot * ny) * 0.75;
                        b.x = gx + nx * (combinedRadius + 0.01);
                        b.y = this.GOAL_HEIGHT + ny * (combinedRadius + 0.01);

                        if (this.onWoodwork) this.onWoodwork({ x: b.x, y: b.y, z: b.z });
                    }
                }
            }
        });
    }

    // Amortiguación elástica de red y detección de gol
    checkGoalNetPhysics(dt) {
        const b=this.ball, previous=this.previousBall || b;
        // Si el balón ya está en la red, aplicar amortiguación elástica
        if(b.inNet) {
            for(const side of [-1,1]) {
                const goalX = side * this.HALF_LENGTH;
                const minX = goalX - (side > 0 ? this.GOAL_DEPTH : 0);
                const maxX = goalX + (side > 0 ? 0 : this.GOAL_DEPTH);
                if (b.x * side >= (this.HALF_LENGTH - 0.1) * side) {
                    this.dampenInNet(b, Math.min(minX, maxX), Math.max(minX, maxX), dt);
                    break;
                }
            }
            return;
        }
        for(const side of [-1,1]) {
            const line=side*(this.HALF_LENGTH+this.radius);
            if(previous.x*side>line*side || b.x*side<=line*side)continue;
            const fraction=(line-previous.x)/(b.x-previous.x);
            const y=previous.y+(b.y-previous.y)*fraction;
            const z=previous.z+(b.z-previous.z)*fraction;
            if(Math.abs(z)+this.radius<=this.GOAL_HALF_WIDTH && y+this.radius<=this.GOAL_HEIGHT) {
                b.inNet=true;
                this.onGoal?.(side>0?'team1':'team2',{x:line,y,z});
            }
        }
    }

    dampenInNet(b, minX, maxX, dt) {
        // Red trasera elástica
        if (b.x < minX + this.radius) {
            b.x = minX + this.radius;
            b.vx = -b.vx * 0.2;
        } else if (b.x > maxX - this.radius && b.inNet) {
            b.x = maxX - this.radius;
            b.vx = -b.vx * 0.2;
        }

        // Redes laterales
        if (Math.abs(b.z) > this.GOAL_HALF_WIDTH - this.radius) {
            b.z = Math.sign(b.z) * (this.GOAL_HALF_WIDTH - this.radius);
            b.vz = -b.vz * 0.2;
        }

        // Red superior
        if (b.y > this.GOAL_HEIGHT - this.radius) {
            b.y = this.GOAL_HEIGHT - this.radius;
            b.vy = -b.vy * 0.2;
        }

        // Resistencia continua de la red (frenar el balón en 0.4s)
        b.vx *= Math.pow(0.08, dt);
        b.vy *= Math.pow(0.08, dt);
        b.vz *= Math.pow(0.08, dt);
    }
}

window.USF.PhysicsEngine = PhysicsEngine;
