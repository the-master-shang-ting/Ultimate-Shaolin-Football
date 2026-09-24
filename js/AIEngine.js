/** Tactical movement, individual controls and ball contacts. All timers use simulation time. */
window.USF = window.USF || {};
class AIEngine {
    constructor(physics, rules, renderer) {
        this.physics = physics;
        this.rules = rules;
        this.renderer = renderer;
    }
    updateTeam(team, opposition, ball, dt, isAIControlled = true, selected = -1, input = null) {
        const live = team.players.filter(p => !p.isSentOff);
        const nearest = live.filter(p => p.playerData.pos !== 'GK').sort((a,b) =>
            Math.hypot(a.x-ball.x,a.z-ball.z)-Math.hypot(b.x-ball.x,b.z-ball.z))[0];
        team.possession = ball.owner?.teamId === team.id;
        for (const [i,p] of team.players.entries()) {
            if (p.isSentOff || this.rules.matchState !== 'IN_PLAY') continue;
            p.actionCooldown = Math.max(0, (p.actionCooldown || 0)-dt);
            p.tackleTimer = Math.max(0, (p.tackleTimer || 0)-dt);
            p.dispossessTimer = Math.max(0, (p.dispossessTimer || 0)-dt);
            p.isTackling = p.tackleTimer > 0;
            // Exactly ONE player receives this controller. Everyone else retains their role.
            p.isUserControlled = !isAIControlled && i === selected;
            if (p.isUserControlled) this.executePlayerInput(p, input || {}, ball, dt, team, opposition);
            else if (p.playerData.pos === 'GK') this.updateGoalkeeperAI(p, ball, team, opposition, dt);
            else this.updateFieldPlayerAI(p, p === nearest, '', ball, team, opposition, dt);
        }
    }
    move(p, dx, dz, speed, dt, sprint = false) {
        const length = Math.hypot(dx,dz);
        const factor = length > 1 ? 1/length : 1;
        if (p.isTackling) speed *= 1.2;
        const targetVX = dx*factor*speed, targetVZ = dz*factor*speed;
        const blend = p.isTackling ? (1-Math.exp(-6*dt)) : (1-Math.exp(-16*dt));
        p.vx += (targetVX-p.vx)*blend;
        p.vz += (targetVZ-p.vz)*blend;
        p.x = THREE.MathUtils.clamp(p.x+p.vx*dt,-52.1,52.1);
        p.z = THREE.MathUtils.clamp(p.z+p.vz*dt,-33.7,33.7);
        if (length > 0.05) p.facingAngle = Math.atan2(dx,dz);
        p.stamina = THREE.MathUtils.clamp(p.stamina + dt*(sprint && length > .1 ? -12 : 7),0,100);
        if (p.model) {
            p.model.mesh.position.set(p.x,0,p.z);
            p.model.updateAnimation(dt,Math.hypot(p.vx,p.vz),p.facingAngle);
        }
    }
    controlBall(p, ball) {
        if (this.physics.freezeBall || p.isTackling || p.actionCooldown > 0 || (p.dispossessTimer > 0)) return false;
        if (ball.isSetPieceActive && p !== ball.owner) return false;
        const distance = Math.hypot(p.x-ball.x,p.z-ball.z);
        if (ball.owner && ball.owner !== p) return false;
        if (ball.owner === p || (distance < 1.05 && ball.y < .8 && !(ball.lastKicker === p && ball.kickCooldown > 0))) {
            ball.owner = p;
            ball.lastKicker = p;
            this.physics.previousBall={x:ball.x,y:ball.y,z:ball.z};
            ball.x = p.x + Math.sin(p.facingAngle)*.65;
            ball.z = p.z + Math.cos(p.facingAngle)*.65;
            ball.y = this.physics.radius;
            ball.vx = p.vx; ball.vz = p.vz; ball.vy = 0;
            ball.speed = Math.hypot(p.vx,p.vz);
            this.physics.checkGoalNetPhysics(0);
            return this.rules.matchState === 'IN_PLAY';
        }
        return false;
    }
    executePlayerInput(p, input, ball, dt, team, opposition) {
        if (ball.isSetPieceActive && p !== ball.owner) {
            const isOpponent = team.id !== ball.owner?.teamId;
            const minDist = isOpponent ? 9.5 : 3.5;
            const distToBall = Math.hypot(p.x - ball.x, p.z - ball.z);
            let moveX = Number(input.moveX) || 0;
            let moveZ = Number(input.moveZ) || 0;
            if (distToBall < minDist) {
                const awayX = (p.x - ball.x) || (isOpponent ? -1 : 1);
                const awayZ = (p.z - ball.z) || 0.1;
                const awayLen = Math.hypot(awayX, awayZ) || 1;
                moveX = awayX / awayLen;
                moveZ = awayZ / awayLen;
            } else if (distToBall < minDist + 1.2) {
                const toBallX = (ball.x - p.x);
                const toBallZ = (ball.z - p.z);
                const dot = moveX * toBallX + moveZ * toBallZ;
                if (dot > 0) {
                    moveX -= (toBallX / (distToBall || 1)) * (dot / (distToBall || 1));
                    moveZ -= (toBallZ / (distToBall || 1)) * (dot / (distToBall || 1));
                }
            }
            const speed = 4.2 + (p.playerData.stats.VEL / 99) * 3.6;
            this.move(p, moveX, moveZ, speed, dt, false);
            return;
        }
        const sprint = !!input.sprint && p.stamina > 10;
        const speed = (4.2+p.playerData.stats.VEL/99*3.6)*(sprint ? 1.4 : 1);
        this.move(p, Number(input.moveX)||0, Number(input.moveZ)||0, speed,dt,sprint);
        const hasBall = this.controlBall(p,ball);
        if (hasBall && p.actionCooldown <= 0) {
            if (input.shootReleased) this.executeKick(p,ball,'SHOOT',Math.max(.15,input.shootPower||0),team);
            else if (input.pass || input.through) this.executePass(p,ball,team,opposition,!!input.through);
        } else if ((input.tackle || input.shootPressed || input.pass) && !hasBall) {
            if (!ball.isSetPieceActive) {
                this.executeSlideTackle(p,ball,opposition);
            }
        }
    }
    updateFieldPlayerAI(p, nearest, phase, ball, team, opposition, dt) {
        if (ball.isSetPieceActive) {
            if (ball.owner === p) {
                p.vx = 0; p.vz = 0;
                if (p.model) {
                    p.model.mesh.position.set(p.x, 0, p.z);
                    p.model.updateAnimation(dt, 0, p.facingAngle);
                }
                return;
            }
            if (p.isWallDefender && p.wallPos) {
                const wdx = p.wallPos.x - p.x, wdz = p.wallPos.z - p.z, wd = Math.hypot(wdx, wdz);
                if (wd > 0.15) this.move(p, wdx / Math.max(1, wd), wdz / Math.max(1, wd), Math.min(4.5, wd / Math.max(dt, 0.001)), dt);
                else {
                    p.vx = 0; p.vz = 0;
                    p.facingAngle = Math.atan2(ball.x - p.x, ball.z - p.z);
                    if (p.model) {
                        p.model.mesh.position.set(p.x, 0, p.z);
                        p.model.updateAnimation(dt, 0, p.facingAngle);
                    }
                }
                return;
            }
            if (p.isBoxAttacker && p.boxTargetPos) {
                const bdx = p.boxTargetPos.x - p.x, bdz = p.boxTargetPos.z - p.z, bd = Math.hypot(bdx, bdz);
                if (bd > 0.2) this.move(p, bdx / Math.max(1, bd), bdz / Math.max(1, bd), Math.min(4.0, bd / Math.max(dt, 0.001)), dt);
                else {
                    p.vx = 0; p.vz = 0;
                    p.facingAngle = Math.atan2(ball.x - p.x, ball.z - p.z);
                    if (p.model) {
                        p.model.mesh.position.set(p.x, 0, p.z);
                        p.model.updateAnimation(dt, 0, p.facingAngle);
                    }
                }
                return;
            }
            const isOpponent = team.id !== ball.owner?.teamId;
            const minDist = isOpponent ? 9.5 : 3.5;
            const distToBall = Math.hypot(p.x - ball.x, p.z - ball.z);
            if (distToBall < minDist) {
                const awayX = (p.x - ball.x) || (isOpponent ? -1 : 1);
                const awayZ = (p.z - ball.z) || 0.1;
                const awayLen = Math.hypot(awayX, awayZ) || 1;
                this.move(p, awayX / awayLen, awayZ / awayLen, 4.0, dt);
                return;
            }
            let target = this.getFormationWorldPos(p, team, ball);
            const distTargetToBall = Math.hypot(target.x - ball.x, target.z - ball.z);
            if (distTargetToBall < minDist) {
                const ang = Math.atan2(target.z - ball.z, target.x - ball.x);
                target.x = ball.x + Math.cos(ang) * (minDist + 1.2);
                target.z = ball.z + Math.sin(ang) * (minDist + 1.2);
            }
            const tdx = target.x - p.x, tdz = target.z - p.z, td = Math.hypot(tdx, tdz);
            if (td > 0.5) this.move(p, tdx / Math.max(1, td), tdz / Math.max(1, td), Math.min(3.2, td / Math.max(dt, 0.001)), dt);
            else {
                p.vx = 0; p.vz = 0;
                p.facingAngle = Math.atan2(ball.x - p.x, ball.z - p.z);
                if (p.model) {
                    p.model.mesh.position.set(p.x, 0, p.z);
                    p.model.updateAnimation(dt, 0, p.facingAngle);
                }
            }
            return;
        }
        const hasBall = this.controlBall(p,ball);
        const dir = team.attacksRight ? 1 : -1;
        let target = this.getFormationWorldPos(p,team,ball), sprint = false;
        if (hasBall) {
            const distanceToGoal = 52.5-p.x*dir;
            if (p.actionCooldown <= 0 && distanceToGoal < 23 && Math.abs(p.z)<15) {
                this.executeKick(p,ball,'SHOOT',.55+distanceToGoal/80,team);
                return;
            }
            const pressure = opposition.players.some(o => !o.isSentOff && Math.hypot(o.x-p.x,o.z-p.z)<5);
            const option = this.findBestPassingOption(p,team,opposition);
            p.thinkTimer = (p.thinkTimer || 0)+dt;
            if (option && p.thinkTimer > .65 && (pressure || option.score > 115)) {
                p.thinkTimer = 0;
                this.executePassToTeammate(p,option.teammate,ball,false,p.playerData.stats.PAS,team);
                return;
            }
            target = {x:p.x+dir*10,z:p.z*.78}; sprint = true;
        } else if (!ball.owner && (nearest || ball.passTarget === p)) {
            target = {x:ball.x+ball.vx*.18,z:ball.z+ball.vz*.18}; sprint = true;
        } else if (ball.owner?.teamId !== team.id && nearest) {
            target = {x:ball.x-dir*.5,z:ball.z}; sprint = true;
            if (Math.hypot(p.x-ball.x,p.z-ball.z)<1.35 && p.actionCooldown<=0)
                this.executeSlideTackle(p,ball,opposition);
        }
        // Local separation keeps formation slots from collapsing into a single cluster.
        for (const other of team.players) {
            if (other===p || other.isSentOff) continue;
            const dx=p.x-other.x,dz=p.z-other.z,d=Math.hypot(dx,dz);
            if (d>0 && d<2.2) { target.x+=dx/d*(2.2-d); target.z+=dz/d*(2.2-d); }
        }
        const dx=target.x-p.x,dz=target.z-p.z,d=Math.hypot(dx,dz);
        const speed=(4+p.playerData.stats.VEL/99*3.3)*(sprint && p.stamina>10 ? 1.17 : .78);
        this.move(p,d>.25?dx/Math.max(1,d):0,d>.25?dz/Math.max(1,d):0,Math.min(speed,d/Math.max(dt,.001)),dt,sprint);
        if (hasBall && ball.owner===p) this.controlBall(p,ball);
    }
    updateGoalkeeperAI(gk,ball,team,opposition,dt) {
        if (ball.isSetPieceActive) {
            const dir = team.attacksRight ? 1 : -1, goalX = -52.5 * dir;
            let tx = goalX + dir * 1.5;
            let tz = THREE.MathUtils.clamp(ball.z * 0.25, -3.2, 3.2);
            const dx = tx - gk.x, dz = tz - gk.z, d = Math.hypot(dx, dz);
            this.move(gk, dx / Math.max(d, 1), dz / Math.max(d, 1), Math.min(3.5, d / Math.max(dt, 0.001)), dt);
            gk.facingAngle = Math.atan2(ball.x - gk.x, ball.z - gk.z);
            if (gk.model) {
                gk.model.mesh.position.set(gk.x, 0, gk.z);
                gk.model.updateAnimation(dt, Math.hypot(gk.vx, gk.vz), gk.facingAngle);
            }
            return;
        }
        const dir=team.attacksRight?1:-1, goalX=-52.5*dir;
        const distance=Math.hypot(gk.x-ball.x,gk.z-ball.z);
        if (ball.owner===gk) {
            gk.holdTimer=(gk.holdTimer||0)+dt;
            ball.x=gk.x; ball.z=gk.z; ball.y=1;
            ball.vx=ball.vy=ball.vz=0;
            if (gk.holdTimer>.8) {
                gk.holdTimer=0;
                this.executePass(gk,ball,team,opposition,false);
            }
            return;
        }
        const inBox=(ball.x-goalX)*dir>0 && (ball.x-goalX)*dir<16.5 && Math.abs(ball.z)<20.16;
        let tx=goalX+dir*2.2, tz=THREE.MathUtils.clamp(ball.z*.28,-3.8,3.8);
        const incoming=ball.vx*dir < -3;
        const time=incoming?(gk.x-ball.x)/ball.vx:Infinity;
        if (time>0 && time<1.2) tz=THREE.MathUtils.clamp(ball.z+ball.vz*time,-4.3,4.3);
        if (!ball.owner && inBox && ball.speed<12 && distance<9) {tx=ball.x;tz=ball.z;}
        const dx=tx-gk.x,dz=tz-gk.z,d=Math.hypot(dx,dz);
        const gkSpeed = 4.2 + ((gk.playerData?.stats?.POR || 80) / 99) * 2.2;
        this.move(gk,dx/Math.max(d,1),dz/Math.max(d,1),Math.min(gkSpeed,d/Math.max(dt,.001)),dt);
        
        // Atajadas en el arco ampliado: tiros esquinados o potentes pueden superar al arquero
        const reach = incoming ? 1.45 : 1.1;
        const porSkill = (gk.playerData?.stats?.POR || 80) / 99;
        const cornerDanger = (Math.abs(ball.z) > 3.4 || ball.y > 2.2);
        const canCatch = !cornerDanger || (porSkill > 0.82 && ball.speed < 23);

        if (inBox && !ball.owner && Math.hypot(gk.x-ball.x,gk.z-ball.z)<reach && ball.y<2.8 && gk.actionCooldown<=0 && canCatch) {
            if (ball.speed>14) {
                gk.model?.triggerGoalkeeperDive(Math.sign(ball.z-gk.z)||1);
                ball.vx=dir*7; ball.vz=(Math.sign(ball.z)||1)*9; ball.vy=2;
                ball.lastKicker=gk; ball.owner=null; ball.passTarget=null;
                gk.actionCooldown=.8;
            } else {
                ball.owner=gk;ball.lastKicker=gk;ball.vx=ball.vy=ball.vz=0;gk.holdTimer=0;
            }
        }
    }
    executeKick(p,ball,type,power,team) {
        if (this.physics.freezeBall || p.actionCooldown>0) return;
        const goalX=team.attacksRight?52.5:-52.5;
        const aimedZ = p.isUserControlled ? THREE.MathUtils.clamp(Math.cos(p.facingAngle)*4.2,-4.2,4.2) : (p.z>0?-3.4:3.4);
        const distance=Math.hypot(goalX-p.x,aimedZ-p.z);
        this.physics.kickBall({x:goalX-p.x,z:aimedZ-p.z},power,type==='CLEAR'?.48:THREE.MathUtils.clamp(distance*.0035,.035,.18),0,p);
        p.actionCooldown=.32;
        p.model?.triggerKick(power>.85);
        window.USF.soundEngine?.playKick(power,power>.85);
    }
    executePass(p,ball,team,opposition,through) {
        const option=this.findBestPassingOption(p,team,opposition,through);
        if (option) this.executePassToTeammate(p,option.teammate,ball,through,p.playerData.stats.PAS,team);
        else {
            this.physics.kickBall({x:Math.sin(p.facingAngle),z:Math.cos(p.facingAngle)},.25,.02,0,p);
            p.actionCooldown=.3;
        }
    }
    executePassToTeammate(p,target,ball,through,pas,team) {
        if (this.rules.matchState!=='IN_PLAY' || p.actionCooldown>0) return;
        if (!ball.restartExempt && this.rules.checkOffsideOnPass(p.teamId,ball,target,team.opponents||[],target)) {
            this.physics.freeze(); return;
        }
        const dir=team.attacksRight?1:-1;
        const tx=target.x+(through?dir*5:target.vx*.2),tz=target.z+(through?target.vz*.35:target.vz*.2);
        const distance=Math.hypot(tx-ball.x,tz-ball.z);
        this.physics.kickBall({x:tx-ball.x,z:tz-ball.z},THREE.MathUtils.clamp(distance/65,.08,.7),.02,0,p);
        ball.passTarget=target;
        p.actionCooldown=.3;
        p.model?.triggerKick(false);
        window.USF.soundEngine?.playKick(.4);
    }
    executeSlideTackle(p,ball,opposition) {
        if (p.actionCooldown>0 || p.isTackling || this.rules.matchState!=='IN_PLAY' || ball.isSetPieceActive) return;
        p.tackleTimer = 0.55;
        p.isTackling = true;
        p.actionCooldown = 1.0;

        // Impulso y desplazamiento dinámico hacia adelante
        const fwdX = Math.sin(p.facingAngle), fwdZ = Math.cos(p.facingAngle);
        p.vx += fwdX * 6.2;
        p.vz += fwdZ * 6.2;

        p.model?.triggerSlideTackle();
        this.renderer?.emitTackleTurf(p,{x:fwdX,z:fwdZ});
        window.USF.soundEngine?.playTackleGrass();

        const carrier = ball.owner;
        // Evaluar si es falta reglamentaria
        if (carrier && carrier.teamId!==p.teamId && this.rules.evaluateTackle(p,carrier,ball,this.physics)) {
            ball.owner = null;
            return;
        }

        // Si el rival lleva el balón y no fue falta: ¡DESPOJO EFECTIVO!
        const distToBall = Math.hypot(p.x - ball.x, p.z - ball.z);
        const distToCarrier = carrier ? Math.hypot(p.x - carrier.x, p.z - carrier.z) : 999;

        if (carrier && carrier.teamId !== p.teamId && (distToBall < 1.85 || distToCarrier < 1.65)) {
            // Despojar al rival del balón
            ball.owner = null;
            ball.lastKicker = p;
            carrier.actionCooldown = 0.75;
            carrier.dispossessTimer = 0.85;
            carrier.vx *= 0.25;
            carrier.vz *= 0.25;
            carrier.stamina = Math.max(0, (carrier.stamina || 100) - 15);

            // Despeje o robo físico con impulso
            const defStat = p.playerData?.stats?.DEF || 70;
            const tacklePower = 0.25 + (defStat / 99) * 0.35;
            this.physics.kickBall({x: fwdX, z: fwdZ}, tacklePower, 0.04, 0, p);
        } else if (distToBall < 1.85 && ball.y < 1.0) {
            // Contacto limpio con balón suelto
            ball.owner = null;
            this.physics.kickBall({x: fwdX, z: fwdZ}, 0.35, 0.04, 0, p);
        }
    }
    findBestPassingOption(p,team,opposition,through=false) {
        let best=null;
        const dir=team.attacksRight?1:-1;
        const defenders=opposition.players.filter(o=>!o.isSentOff).map(o=>o.x*dir).sort((a,b)=>b-a);
        for (const t of team.players) {
            if (t===p || t.isSentOff) continue;
            const dx=t.x-p.x,dz=t.z-p.z,d=Math.hypot(dx,dz);
            if(d<3 || d>42) continue;
            if(t.x*dir>Math.max(0,p.x*dir,defenders[1]??52.5)) continue;
            let score=100-d*.8+dx*dir*(through?2:1);
            if(p.isUserControlled) score+=(dx*Math.sin(p.facingAngle)+dz*Math.cos(p.facingAngle))/d*45;
            if(t.playerData.pos==='GK') score-=35;
            for(const o of opposition.players) {
                if(o.isSentOff)continue;
                const projection=((o.x-p.x)*dx+(o.z-p.z)*dz)/(d*d);
                if(projection>0 && projection<1 && Math.abs((o.x-p.x)*dz-(o.z-p.z)*dx)/d<1.8)score-=65;
            }
            if(!best || score>best.score)best={teammate:t,score,isLeadingRun:through};
        }
        return best;
    }
    resolvePlayerCollisions(players) {
        for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++) {
            const a=players[i],b=players[j];if(a.isSentOff||b.isSentOff)continue;
            const dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);
            if(d>=.85)continue;
            const nx=d>0?dx/d:1,nz=d>0?dz/d:0,push=(.85-d)*.5;
            a.x=THREE.MathUtils.clamp(a.x-nx*push,-52.1,52.1);a.z=THREE.MathUtils.clamp(a.z-nz*push,-33.7,33.7);
            b.x=THREE.MathUtils.clamp(b.x+nx*push,-52.1,52.1);b.z=THREE.MathUtils.clamp(b.z+nz*push,-33.7,33.7);
            a.model?.mesh.position.set(a.x,0,a.z);b.model?.mesh.position.set(b.x,0,b.z);
        }
    }
    getFormationWorldPos(p,team,ball) {
        const slot=window.USF.TeamsData.FORMATIONS[team.formation][p.formationIndex];
        const dir=team.attacksRight?1:-1;
        const attacking=ball.owner?.teamId===team.id;
        const forward=['ST','LW','RW','CAM'].includes(p.playerData.pos);
        const ballProgress=ball.x*dir;
        let x=slot.x*32+THREE.MathUtils.clamp(ballProgress*.4,-14,22)+(attacking?8:-5);
        if(forward && attacking)x=Math.max(x,ballProgress+8);
        const defenders=team.opponents.filter(o=>!o.isSentOff).map(o=>o.x*dir).sort((a,b)=>b-a);
        if(attacking && forward)x=Math.min(x,Math.max(ballProgress,defenders[1]??48)-1.5);
        return {x:THREE.MathUtils.clamp(x*dir,-48,48),z:THREE.MathUtils.clamp(slot.z*(attacking?30:24)+ball.z*.16,-30,30)};
    }
}
window.USF.AIEngine = AIEngine;
