/* Modelo procedural articulado. API compatible con GameEngine y AIEngine. */
window.USF = window.USF || {};

class PlayerModel {
    constructor(playerData = {}, teamData = {}, isGoalkeeper = false) {
        this.playerData = playerData;
        this.teamData = teamData;
        this.isGoalkeeper = isGoalkeeper;
        this.mesh = new THREE.Group();
        this.joints = {};
        this.currentAnim = 'IDLE';
        this.animTime = Math.random() * Math.PI * 2;
        this.kickProgress = this.tackleProgress = this.fallProgress = 0;
        this.diveProgress = this.jumpProgress = this.celebrationProgress = 0;
        this.diveDirection = this.fallDirection = 1;
        const outfield = {
            primary: teamData.primaryColor || '#1E5EFF', secondary: teamData.secondaryColor || '#FFFFFF',
            accent: teamData.accentColor || teamData.secondaryColor || '#FFFFFF', shorts: teamData.shortsColor || '#FFFFFF',
            socks: teamData.socksColor || '#FFFFFF', number: teamData.numberColor || '#FFFFFF'
        };
        const gk = teamData.gkKit || {};
        this.kitColors = isGoalkeeper ? {
            primary: gk.primary || '#F0B000', secondary: gk.secondary || gk.primary || '#181818',
            accent: gk.accent || gk.secondary || '#FFFFFF', shorts: gk.shorts || '#181818',
            socks: gk.socks || '#F0B000', number: gk.number || '#FFFFFF'
        } : outfield;
        this.buildProceduralBody();
        this.mesh.scale.set(1.4,1.25,1.4);
        this.selectionRing = new THREE.Mesh(new THREE.RingGeometry(.6,.74,32),new THREE.MeshBasicMaterial({color:0x00e5ff,side:THREE.DoubleSide,depthWrite:false}));
        this.selectionRing.rotation.x = -Math.PI/2;
        this.selectionRing.position.y=.025;
        this.selectionRing.visible=false;
        this.mesh.add(this.selectionRing);
        this.suggestionRing = new THREE.Mesh(new THREE.RingGeometry(.52,.59,24),new THREE.MeshBasicMaterial({color:0xffd76a,side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));
        this.suggestionRing.rotation.x = -Math.PI/2;
        this.suggestionRing.position.y = .03;
        this.suggestionRing.visible = false;
        this.mesh.add(this.suggestionRing);
    }

    createJerseyTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(canvas);
        ctx.fillStyle = this.kitColors.primary;
        ctx.fillRect(0, 0, 256, 256);
        ctx.fillStyle = this.kitColors.secondary;
        [0, 107, 214].forEach(x => ctx.fillRect(x, 0, 42, 256));
        ctx.fillStyle = this.kitColors.accent;
        ctx.beginPath(); ctx.arc(128, 0, 38, 0, Math.PI); ctx.fill();
        ctx.fillStyle = this.kitColors.number;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 88px Arial Black, sans-serif';
        ctx.fillText(String(this.playerData.number || ''), 128, 142);
        ctx.font = 'bold 21px Arial, sans-serif';
        ctx.fillText(String(this.playerData.name || '').toUpperCase().slice(0, 9), 128, 70);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }

    buildProceduralBody() {
        const s = (Number(this.playerData.height) || 1.8) / 1.8;
        const skin = new THREE.MeshLambertMaterial({ color: this.playerData.skinColor || '#e0ac69' });
        const hair = new THREE.MeshLambertMaterial({ color: this.playerData.hairColor || '#222222' });
        const shirt = new THREE.MeshLambertMaterial({ map: this.createJerseyTexture() });
        const shorts = new THREE.MeshLambertMaterial({ color: this.kitColors.shorts });
        const socks = new THREE.MeshLambertMaterial({ color: this.kitColors.socks });
        const boots = new THREE.MeshLambertMaterial({ color: '#111111' });
        const make = (parent, geometry, material, x = 0, y = 0, z = 0) => {
            const m = new THREE.Mesh(geometry, material);
            m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m;
        };
        const pelvis = make(this.mesh, new THREE.BoxGeometry(.38*s, .22*s, .24*s), shorts, 0, .95*s);
        const torso = make(pelvis, new THREE.BoxGeometry(.42*s, .46*s, .26*s), shirt, 0, .34*s);
        this.joints.pelvis = pelvis; this.joints.torso = torso;
        const neck = make(torso, new THREE.CylinderGeometry(.08, .09, .10*s, 8), skin, 0, .28*s);
        const head = make(neck, new THREE.BoxGeometry(.22*s, .26*s, .24*s), skin, 0, .18*s);
        this.joints.head = head;
        make(head, new THREE.BoxGeometry(.24*s, .12*s, .26*s), hair, 0, .11*s);
        const thigh = new THREE.BoxGeometry(.16*s, .40*s, .17*s);
        const shin = new THREE.BoxGeometry(.14*s, .42*s, .14*s);
        const boot = new THREE.BoxGeometry(.13*s, .11*s, .25*s);
        const arm = new THREE.BoxGeometry(.12*s, .32*s, .13*s);
        const forearm = new THREE.BoxGeometry(.10*s, .28*s, .11*s);
        const leg = (side, name) => {
            const hip = new THREE.Group(); hip.position.set(side*.13*s, -.11*s, 0); pelvis.add(hip);
            const upper = make(hip, thigh, shorts, 0, -.20*s);
            const knee = new THREE.Group(); knee.position.set(0, -.20*s, 0); upper.add(knee);
            const lower = make(knee, shin, socks, 0, -.21*s);
            make(lower, boot, boots, 0, -.22*s, .05*s);
            this.joints[`${name}Hip`] = hip; this.joints[`${name}Knee`] = knee;
        };
        leg(-1, 'left'); leg(1, 'right');
        const addArm = (side, name) => {
            const shoulder = new THREE.Group(); shoulder.position.set(side*.25*s, .18*s, 0); torso.add(shoulder);
            const upper = make(shoulder, arm, shirt, 0, -.16*s);
            const elbow = new THREE.Group(); elbow.position.set(0, -.16*s, 0); upper.add(elbow);
            make(elbow, forearm, skin, 0, -.14*s);
            this.joints[`${name}Shoulder`] = shoulder; this.joints[`${name}Elbow`] = elbow;
        };
        addArm(-1, 'left'); addArm(1, 'right');
        this.chevron = new THREE.Mesh(new THREE.ConeGeometry(.18, .32, 4), new THREE.MeshBasicMaterial({ color: 0xFF2222 }));
        this.chevron.rotation.x = Math.PI; this.chevron.position.y = 2.25*s; this.chevron.visible = false; this.mesh.add(this.chevron);
    }

    setSelected(selected, color = 0x00FF88) { if(this.selectionRing) {this.selectionRing.visible=!!selected;this.selectionRing.material.color.setHex(color);}
        if (this.chevron) { this.chevron.visible = !!selected; this.chevron.material.color.setHex(color); } }
    setSuggested(suggested) { this.suggestionRing.visible = !!suggested && !this.selectionRing.visible; }
    triggerKick(power = false) { this.currentAnim = power ? 'KICK_POWER' : 'KICK'; this.kickProgress = 0; }
    triggerSlideTackle() { this.currentAnim = 'TACKLE'; this.tackleProgress = 0; }
    triggerFoulFall(direction = 1) { this.currentAnim = 'FOUL_FALL'; this.fallDirection = direction || 1; this.fallProgress = 0; }
    triggerGoalkeeperDive(direction = 1) { this.currentAnim = 'DIVE'; this.diveDirection = direction || 1; this.diveProgress = 0; }
    triggerGoalkeeperJump() { this.currentAnim = 'GK_JUMP'; this.jumpProgress = 0; }
    triggerCelebration() { this.currentAnim = 'CELEBRATE'; this.celebrationProgress = 0; }

    resetPose() {
        const j = this.joints;
        this.mesh.rotation.z = 0;
        j.pelvis.position.y = .95; j.pelvis.rotation.set(0, 0, 0);
        j.torso.rotation.set(0, 0, 0); j.torso.scale.set(1, 1, 1); j.head.rotation.set(0, 0, 0);
        ['leftHip','rightHip','leftKnee','rightKnee','leftShoulder','rightShoulder','leftElbow','rightElbow'].forEach(k => j[k].rotation.set(0, 0, 0));
    }

    updateAnimation(dt, currentSpeed = 0, targetFacingAngle) {
        const j = this.joints;
        if (!j.pelvis || !Number.isFinite(dt)) return;
        dt = Math.min(Math.max(dt, 0), .05);
        currentSpeed = Number.isFinite(currentSpeed) ? Math.max(0, currentSpeed) : 0;
        if (Number.isFinite(targetFacingAngle) && this.currentAnim !== 'TACKLE' && this.currentAnim !== 'FOUL_FALL') {
            let turn = targetFacingAngle - this.mesh.rotation.y;
            turn = Math.atan2(Math.sin(turn), Math.cos(turn));
            this.mesh.rotation.y += turn * Math.min(1, dt * 14);
        }
        if (this.currentAnim === 'KICK' || this.currentAnim === 'KICK_POWER') {
            this.kickProgress += dt * (this.currentAnim === 'KICK_POWER' ? 4.2 : 5.8);
            const t = this.kickProgress;
            if (t < .38) { const p=t/.38; j.rightHip.rotation.x=-1.1*p; j.rightKnee.rotation.x=1.3*p; j.leftHip.rotation.x=.25*p; j.torso.rotation.set(.28*p,-.35*p,0); j.leftShoulder.rotation.x=-.6*p; j.rightShoulder.rotation.x=.7*p; }
            else if (t < .78) { const p=(t-.38)/.40; j.rightHip.rotation.x=-1.1+2.1*p; j.rightKnee.rotation.x=1.3-1.4*p; j.torso.rotation.set(.28-.55*p,-.35+.60*p,0); j.rightShoulder.rotation.x=.7-1.2*p; }
            else if (t < 1) { const p=(t-.78)/.22; j.rightHip.rotation.x=1-p; j.torso.rotation.set(-.27*(1-p),.25*(1-p),0); }
            else { this.currentAnim='IDLE'; this.kickProgress=0; this.resetPose(); }
            return;
        }
        if (this.currentAnim === 'TACKLE') {
            this.tackleProgress += dt*2.5; const t=this.tackleProgress;
            if (t < .45) { const p=t/.45; j.pelvis.position.y=.95-.68*p; j.pelvis.rotation.x=-.55*p; j.torso.rotation.x=-.50*p; j.rightHip.rotation.x=1.65*p; j.leftHip.rotation.x=-.75*p; j.leftKnee.rotation.x=1.6*p; j.leftShoulder.rotation.z=-1.1*p; j.rightShoulder.rotation.z=.8*p; }
            else if (t < .85) { j.pelvis.position.y=.27; j.pelvis.rotation.x=-.55; j.torso.rotation.x=-.50; j.rightHip.rotation.x=1.65; j.leftHip.rotation.x=-.75; j.leftKnee.rotation.x=1.6; }
            else if (t < 1) { const p=(t-.85)/.15; j.pelvis.position.y=.27+.68*p; j.pelvis.rotation.x=-.55*(1-p); j.torso.rotation.x=-.50*(1-p); j.rightHip.rotation.x=1.65*(1-p); j.leftHip.rotation.x=-.75*(1-p); j.leftKnee.rotation.x=1.6*(1-p); }
            else { this.currentAnim='IDLE'; this.tackleProgress=0; this.resetPose(); }
            return;
        }
        if (this.currentAnim === 'FOUL_FALL') {
            this.fallProgress += dt*1.8; const t=this.fallProgress, dir=this.fallDirection;
            if (t < .35) { const p=t/.35; j.pelvis.position.y=.95-.72*p; this.mesh.rotation.z=dir*.7*p; j.torso.rotation.x=-.6*p; j.head.rotation.x=.4*p; j.leftHip.rotation.x=.9*p; j.rightHip.rotation.x=1.2*p; }
            else if (t < .8) { j.pelvis.position.y=.22; this.mesh.rotation.z=dir*.7; j.torso.rotation.x=.4; j.rightKnee.rotation.x=1.5; j.leftKnee.rotation.x=.8; j.leftShoulder.rotation.set(.8,0,.3); j.rightShoulder.rotation.set(.8,0,-.3); }
            else if (t < 1) { const p=(t-.8)/.2; j.pelvis.position.y=.22+.73*p; this.mesh.rotation.z=dir*.7*(1-p); j.torso.rotation.x=.4*(1-p); }
            else { this.currentAnim='IDLE'; this.fallProgress=0; this.resetPose(); }
            return;
        }
        if (this.currentAnim === 'DIVE') {
            this.diveProgress += dt*2.2; const t=this.diveProgress, dir=this.diveDirection;
            if (t < .45) { const p=t/.45; j.pelvis.position.y=.95-.40*p; this.mesh.rotation.z=-dir*1.35*p; j.leftShoulder.rotation.z=-dir*1.5*p; j.rightShoulder.rotation.z=-dir*1.5*p; }
            else if (t < .8) { j.pelvis.position.y=.35; this.mesh.rotation.z=-dir*1.35; j.leftShoulder.rotation.z=-dir*1.5; j.rightShoulder.rotation.z=-dir*1.5; }
            else if (t < 1) { const p=(t-.8)/.2; j.pelvis.position.y=.35+.60*p; this.mesh.rotation.z=-dir*1.35*(1-p); j.leftShoulder.rotation.z=-dir*1.5*(1-p); j.rightShoulder.rotation.z=-dir*1.5*(1-p); }
            else { this.currentAnim='IDLE'; this.diveProgress=0; this.resetPose(); }
            return;
        }
        if (this.currentAnim === 'GK_JUMP') {
            this.jumpProgress += dt*2.4; const t=this.jumpProgress;
            if (t < .45) { const p=t/.45; j.pelvis.position.y=.95+.75*Math.sin(p*Math.PI*.5); j.leftShoulder.rotation.z=2.6*p; j.rightShoulder.rotation.z=-2.6*p; }
            else if (t < .85) { const p=(t-.45)/.40; j.pelvis.position.y=1.70-.75*p; j.leftShoulder.rotation.z=2.6*(1-p); j.rightShoulder.rotation.z=-2.6*(1-p); }
            else { this.currentAnim='IDLE'; this.jumpProgress=0; this.resetPose(); }
            return;
        }
        if (this.currentAnim === 'CELEBRATE') { this.animTime+=dt*5; j.leftShoulder.rotation.z=2.4+Math.sin(this.animTime)*.2; j.rightShoulder.rotation.z=-2.4-Math.sin(this.animTime)*.2; j.torso.rotation.x=-.2; j.head.rotation.x=-.3; j.pelvis.position.y=.95+Math.abs(Math.sin(this.animTime*1.5))*.16; return; }
        const speed=Math.min(1,currentSpeed/8.5); this.animTime+=dt*(speed>.04 ? 6.8+speed*8.5 : 1.8);
        if (speed > .04) { const leg=Math.sin(this.animTime)*(.42+speed*.52), arm=Math.sin(this.animTime)*(.40+speed*.45); j.leftHip.rotation.x=leg; j.rightHip.rotation.x=-leg; j.leftKnee.rotation.x=leg<0 ? -leg*1.25 : .05; j.rightKnee.rotation.x=leg>0 ? leg*1.25 : .05; j.leftShoulder.rotation.x=-arm; j.rightShoulder.rotation.x=arm; j.leftElbow.rotation.x=j.rightElbow.rotation.x=.35+speed*.45; j.torso.rotation.x=.10+speed*.24; j.pelvis.position.y=.95+Math.abs(Math.sin(this.animTime))*.045; }
        else { const breath=Math.sin(this.animTime)*.035; j.torso.rotation.set(breath*.5,0,0); j.torso.scale.set(1+breath*.18,1+breath*.10,1+breath*.18); j.leftHip.rotation.x=j.rightHip.rotation.x=0; j.leftKnee.rotation.x=j.rightKnee.rotation.x=.05; j.leftShoulder.rotation.set(.08,0,.14); j.rightShoulder.rotation.set(.08,0,-.14); j.leftElbow.rotation.x=j.rightElbow.rotation.x=.22; j.pelvis.position.y=.95+breath*.012; }
    }
}

window.USF.PlayerModel = PlayerModel;
