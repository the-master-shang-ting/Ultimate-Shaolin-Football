window.USF = window.USF || {};

class SquadManager {
    constructor(game) {
        this.game = game;
        this.editing = { team1: false, team2: false };
        this.modal = document.getElementById('squad-modal');
        this.selected = null;
        this.pointerGesture = null;
        this.suppressClickUntil = 0;

        document.getElementById('btn-squads').onclick = () => this.open();
        document.getElementById('btn-close-squads').onclick = () => this.close();
        document.getElementById('btn-save-squads').onclick = () => this.save();
    }

    get teamId() {
        return this.game.network.mode === 'LAN_CLIENT' ? 'team2' : 'team1';
    }

    reset() {
        this.cleanupDrag();
        this.modal.style.display = 'none';
        this.editing = { team1: false, team2: false };
        this.draft = null;
        this.selected = null;
        for (const team of [this.game.team1, this.game.team2]) {
            team.bench = [...(team.data.bench || [])];
            team.substituted = [];
            team.substitutions = 0;
            team.squadRevision = 0;
        }
    }

    snapshot(team) {
        return {
            formation: team.formation,
            ids: team.players.map(p => p.playerData.id),
            slots: team.players.map(p => p.formationIndex),
            bench: team.bench.map(p => p.id),
            substituted: team.substituted,
            substitutions: team.substitutions,
            revision: team.squadRevision
        };
    }

    open(teamId = this.teamId) {
        if (!this.game.isPaused || !this.game.team1) return;
        if (this.game.network.mode !== 'LOCAL_1V1') teamId = this.teamId;
        this.currentTeam = teamId;
        this.draft = structuredClone(this.snapshot(this.game[teamId]));
        this.selected = null;
        this.message('');
        this.editing[this.teamId] = true;
        this.game.network.sendControl({ type: 'SQUAD_EDIT', editing: true });
        this.game.ui.pauseModal.style.display = 'none';
        this.modal.style.display = 'flex';
        this.render();
    }

    close() {
        this.cleanupDrag();
        this.modal.style.display = 'none';
        this.editing[this.teamId] = false;
        this.game.network.sendControl({ type: 'SQUAD_EDIT', editing: false });
        this.draft = null;
        this.selected = null;
        this.game.ui.pauseModal.style.display = 'flex';
        this.game.ui.initScreenFocus();
    }

    render() {
        if (!this.draft) return;
        const focusedKey = document.activeElement?.dataset.squadKey || this.game.ui.currentFocusElement?.dataset.squadKey;
        const team = this.game[this.currentTeam];
        const draft = this.draft;
        const roster = [...team.data.players, ...team.data.bench];
        const find = id => roster.find(p => p.id === id);
        const cards = this.game.rules.cards[team.id];
        const formation = window.USF.TeamsData.FORMATIONS[draft.formation];
        const pitch = this.modal.querySelector('.squad-pitch');
        pitch.dataset.formation = draft.formation;

        document.getElementById('squad-title').textContent = team.data.name;
        document.getElementById('squad-description').textContent =
            `${team.data.squadLabel} · Cambios ${team.substitutions}/5`;

        const tabs = document.getElementById('squad-teams');
        tabs.replaceChildren();
        if (this.game.network.mode === 'LOCAL_1V1') {
            for (const id of ['team1', 'team2']) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `filter-tab-btn${this.currentTeam === id ? ' active' : ''}`;
                button.textContent = `${id === 'team1' ? 'J1' : 'J2'} · ${this.game[id].data.shortName}`;
                button.dataset.squadKey = `team-${id}`;
                button.onclick = () => this.open(id);
                tabs.append(button);
            }
        }

        const formations = document.getElementById('squad-formations');
        formations.replaceChildren();
        for (const name of Object.keys(window.USF.TeamsData.FORMATIONS)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `filter-tab-btn${draft.formation === name ? ' active' : ''}`;
            button.textContent = name;
            button.dataset.squadKey = `formation-${name}`;
            button.setAttribute('aria-pressed', String(draft.formation === name));
            button.onclick = () => {
                draft.formation = name;
                this.selected = null;
                this.message(`Formación ${name} lista para guardar.`);
                this.render();
            };
            formations.append(button);
        }

        const starters = document.getElementById('squad-starters');
        const bench = document.getElementById('squad-bench');
        starters.replaceChildren();
        bench.replaceChildren();

        draft.ids.forEach((id, index) => {
            const player = find(id);
            if (!player) return;
            const slotIndex = draft.slots[index] ?? index;
            const slot = formation[slotIndex] || formation[index];
            const injury = team.players.find(p => p.playerData.id === id)?.injury || null;
            const button = this.createPlayerButton(player, 'starter', index, slot.role, cards[id], injury);
            button.style.setProperty('--slot-left', `${Math.max(14, Math.min(86, 50 + slot.z * 45))}%`);
            button.style.setProperty('--slot-top', `${Math.max(8, Math.min(90, 88 - ((slot.x + 0.92) / 1.44) * 78))}%`);
            starters.append(button);
        });

        draft.bench.forEach((id, index) => {
            const player = find(id);
            if (!player) return;
            bench.append(this.createPlayerButton(player, 'bench', index, player.pos, cards[id], null));
        });

        this.renderPlayerInfo(find);

        const focus = [...this.modal.querySelectorAll('[data-squad-key]')]
            .find(button => button.dataset.squadKey === focusedKey && !button.disabled);
        if (focus) this.game.ui.setGamepadFocus(focus);
        else {
            const preferred = starters.querySelector('button:not(:disabled)');
            if (preferred) this.game.ui.setGamepadFocus(preferred);
            else this.game.ui.initScreenFocus();
        }
    }

    createPlayerButton(player, origin, index, role, card, injury = null) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `squad-player squad-player-${origin}`;
        button.dataset.squadOrigin = origin;
        button.dataset.squadIndex = String(index);
        button.dataset.squadKey = `${origin}-${index}`;
        button.disabled = card === 'RED';
        button.setAttribute('aria-label', `${player.name}, ${role}${card === 'RED' ? ', expulsado' : ''}${injury ? ', lesionado, cambio recomendado' : ''}`);
        button.classList.toggle('injured',!!injury);

        if (this.selected?.origin === origin && this.selected.index === index) {
            button.classList.add('selected');
            button.setAttribute('aria-pressed', 'true');
        } else {
            button.setAttribute('aria-pressed', 'false');
        }

        const roleText = document.createElement('span');
        roleText.className = 'squad-player-role';
        roleText.textContent = role;
        const nameText = document.createElement('span');
        nameText.className = 'squad-player-name';
        nameText.textContent = player.name;
        button.append(roleText, nameText);

        if (card) {
            const cardText = document.createElement('span');
            cardText.className = `squad-card squad-card-${card.toLowerCase()}`;
            cardText.textContent = card === 'RED' ? 'EXPULSADO' : 'AMARILLA';
            button.append(cardText);
        }
        if (injury) {
            const injuryText = document.createElement('span');
            injuryText.className = 'squad-injury';
            injuryText.textContent = '✚ LESIONADO · CAMBIAR';
            button.append(injuryText);
        }

        button.onclick = () => {
            if (performance.now() < this.suppressClickUntil) return;
            this.activate(origin, index);
        };
        this.bindPointerDrag(button, origin, index);
        return button;
    }

    activate(origin, index) {
        if (!this.draft) return;
        if (!this.selected) {
            this.selected = { origin, index };
            this.message('Ahora elegí el jugador con el que querés intercambiarlo.');
            this.render();
            return;
        }
        if (this.selected.origin === origin && this.selected.index === index) {
            this.selected = null;
            this.message('Selección cancelada.');
            this.render();
            return;
        }
        this.movePlayer(this.selected, { origin, index });
    }

    movePlayer(source, target) {
        if (!this.draft || !source || !target) return;
        const sourceList = source.origin === 'starter' ? this.draft.ids : this.draft.bench;
        const targetList = target.origin === 'starter' ? this.draft.ids : this.draft.bench;
        if (!sourceList[source.index] || !targetList[target.index]) return;

        const sourceId = sourceList[source.index];
        const targetId = targetList[target.index];
        sourceList[source.index] = targetId;
        targetList[target.index] = sourceId;
        this.selected = null;
        this.message('Cambio preparado. Guardá la plantilla para aplicarlo.');
        this.render();
    }

    bindPointerDrag(button, origin, index) {
        button.addEventListener('pointerdown', event => {
            if (button.disabled || (event.pointerType === 'mouse' && event.button !== 0)) return;
            this.cleanupDrag();
            this.pointerGesture = {
                pointerId: event.pointerId,
                source: { origin, index },
                button,
                startX: event.clientX,
                startY: event.clientY,
                moved: false,
                ghost: null,
                dropTarget: null
            };
            this.game.ui.setGamepadFocus(button);
            button.setPointerCapture?.(event.pointerId);
            event.preventDefault();
        });

        button.addEventListener('pointermove', event => {
            const drag = this.pointerGesture;
            if (!drag || drag.pointerId !== event.pointerId) return;
            if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 7) {
                drag.moved = true;
                drag.button.classList.add('dragging');
                drag.ghost = drag.button.cloneNode(true);
                drag.ghost.removeAttribute('data-squad-key');
                drag.ghost.classList.remove('gamepad-focused', 'selected', 'dragging');
                drag.ghost.classList.add('squad-drag-ghost');
                drag.ghost.disabled = false;
                document.body.append(drag.ghost);
            }
            if (!drag.moved) return;
            this.positionDragGhost(event.clientX, event.clientY);
            const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-squad-origin]');
            if (drag.dropTarget !== target) {
                drag.dropTarget?.classList.remove('drop-target');
                drag.dropTarget = target && !target.disabled ? target : null;
                drag.dropTarget?.classList.add('drop-target');
            }
            event.preventDefault();
        });

        const finish = event => {
            const drag = this.pointerGesture;
            if (!drag || drag.pointerId !== event.pointerId) return;
            const moved = drag.moved;
            const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-squad-origin]');
            const target = targetElement && !targetElement.disabled ? {
                origin: targetElement.dataset.squadOrigin,
                index: Number(targetElement.dataset.squadIndex)
            } : null;
            const source = drag.source;
            this.suppressClickUntil = performance.now() + 350;
            this.cleanupDrag();
            if (moved && target && (source.origin !== target.origin || source.index !== target.index)) {
                this.movePlayer(source, target);
            } else if (!moved) {
                this.activate(source.origin, source.index);
            }
            event.preventDefault();
        };

        button.addEventListener('pointerup', finish);
        button.addEventListener('pointercancel', () => this.cleanupDrag());
        button.addEventListener('dragstart', event => event.preventDefault());
    }

    positionDragGhost(x, y) {
        const ghost = this.pointerGesture?.ghost;
        if (!ghost) return;
        ghost.style.left = `${x}px`;
        ghost.style.top = `${y}px`;
    }

    cleanupDrag() {
        const drag = this.pointerGesture;
        drag?.button?.classList.remove('dragging');
        drag?.dropTarget?.classList.remove('drop-target');
        drag?.ghost?.remove();
        this.pointerGesture = null;
    }

    renderPlayerInfo(find) {
        const info = document.getElementById('squad-player-info');
        info.replaceChildren();
        if (!this.selected) {
            info.textContent = 'Elegí un jugador para ver su posición y preparar un cambio.';
            return;
        }
        const list = this.selected.origin === 'starter' ? this.draft.ids : this.draft.bench;
        const player = find(list[this.selected.index]);
        if (!player) return;
        const role = this.selected.origin === 'starter'
            ? window.USF.TeamsData.FORMATIONS[this.draft.formation][this.draft.slots[this.selected.index]]?.role
            : player.pos;
        const name = document.createElement('strong');
        name.textContent = player.name;
        const detail = document.createElement('span');
        detail.textContent = `${role || player.pos} · dorsal ${player.number}`;
        info.append(name, detail);
        const livePlayer = this.game[this.currentTeam].players.find(p => p.playerData.id === player.id);
        if (livePlayer?.injury) {
            const injury = document.createElement('span');
            injury.className = 'squad-injury-detail';
            injury.textContent = `✚ LESIÓN DE ${livePlayer.injury.type || 'CONTACTO'} · rendimiento reducido · sustitución recomendada`;
            info.append(injury);
        }
    }

    message(text) {
        document.getElementById('squad-status').textContent = text;
    }

    save() {
        if (!this.draft) return;
        if (this.game.network.mode === 'LAN_CLIENT') {
            this.game.network.sendControl({ type: 'SQUAD_REQUEST', draft: this.draft });
            this.message('Esperando confirmación del anfitrión…');
        } else {
            const error = this.apply(this.currentTeam, this.draft);
            this.message(error || 'Plantilla guardada.');
            if (!error) {
                this.draft = structuredClone(this.snapshot(this.game[this.currentTeam]));
                this.render();
                this.broadcast();
            }
        }
    }

    apply(teamId, draft) {
        const team = this.game[teamId], forms = window.USF.TeamsData.FORMATIONS;
        if (!this.game.isPaused || !draft || !Object.hasOwn(forms, draft.formation) || draft.revision !== team.squadRevision) return 'La plantilla cambió. Volvé a abrir el menú.';
        if (!Array.isArray(draft.ids) || draft.ids.length !== 11 || new Set(draft.ids).size !== 11) return 'Se requieren once puestos sin duplicados.';
        const current = team.players.map(p => p.playerData.id), pool = [...team.data.players, ...team.data.bench];
        const allowed = new Set([...current, ...team.bench.map(p => p.id)]);
        if (draft.ids.some(id => !allowed.has(id))) return 'Jugador no disponible o ya sustituido.';
        for (let i = 0; i < 11; i++) if (team.players[i].isSentOff && draft.ids[i] !== current[i]) return 'Un expulsado no puede ser reemplazado ni movido.';
        const incoming = draft.ids.filter(id => !current.includes(id));
        const outgoing = current.filter(id => !draft.ids.includes(id));
        if (this.game.matchSeconds > 0 && team.substitutions + incoming.length > 5) return 'Máximo de cinco sustituciones por equipo.';
        const active = draft.ids.filter(id => this.game.rules.cards[teamId][id] !== 'RED');
        const keepers = active.filter(id => pool.find(p => p.id === id)?.pos === 'GK');
        if (keepers.length !== 1 && !team.players.some(p => p.isSentOff && p.playerData.pos === 'GK')) return 'Debe jugar exactamente un arquero.';
        const slots = team.players.map(p => p.formationIndex);
        if (keepers.length === 1 && forms[draft.formation][slots[draft.ids.indexOf(keepers[0])]].role !== 'GK') return 'Colocá al arquero en el puesto GK.';
        if (keepers.length > 1) return 'Solo puede haber un arquero.';
        const oldById = new Map(team.players.map(p => [p.playerData.id, p]));
        const oldPlayers = [...team.players];
        const outgoingPlayers = oldPlayers.filter(p => !draft.ids.includes(p.playerData.id));
        let incomingIndex = 0;
        const activeKey = teamId === 'team1' ? 'activeP1Index' : 'activeP2Index';
        const oldActive = team.players[this.game[activeKey]];
        const replacements = new Map();
        team.players = draft.ids.map((id, index) => {
            let p = oldById.get(id);
            if (!p) {
                const playerData = pool.find(data => data.id === id), old = outgoingPlayers[incomingIndex++];
                const model = new window.USF.PlayerModel(playerData, team.data, playerData.pos === 'GK');
                this.game.renderer.playersGroup.add(model.mesh);
                p = { ...old, playerData, model, stamina: 100, injury: null, isSentOff: false, isTackling: false, tackleTimer: 0, actionCooldown: 0, dispossessTimer: 0, vx: 0, vz: 0 };
                model.setInjured(false);
                replacements.set(old, p);
            }
            p.formationIndex = slots[index];
            p.role = forms[draft.formation][slots[index]].role;
            p.model.mesh.position.set(p.x, 0, p.z);
            return p;
        });
        this.game[activeKey] = Math.max(0, team.players.indexOf(replacements.get(oldActive) || oldActive));
        if (this.game.activeSetPiece?.passTarget && !team.players.includes(this.game.activeSetPiece.passTarget) && this.game.activeSetPiece.passTarget.teamId === teamId) this.game.activeSetPiece.passTarget = null;
        for (const old of oldPlayers) if (!team.players.includes(old)) {
            this.game.renderer.playersGroup.remove(old.model.mesh);
            old.model.mesh.traverse(obj => {
                obj.geometry?.dispose();
                for (const mat of (Array.isArray(obj.material) ? obj.material : [obj.material])) {
                    mat?.map?.dispose();
                    mat?.dispose();
                }
            });
            const replacement = replacements.get(old) || team.players.find(p => !p.isSentOff);
            for (const key of ['owner', 'lastKicker', 'passTarget']) if (this.game.physics.ball[key] === old) this.game.physics.ball[key] = replacement;
            if (this.game.activeSetPiece?.kicker === old) {
                this.game.activeSetPiece.kicker = replacement;
                if (this.game.renderer.setPieceCameraConfig) this.game.renderer.setPieceCameraConfig.kicker = replacement;
            }
        }
        team.formation = draft.formation;
        const preMatch = this.game.matchSeconds === 0;
        if (!preMatch) {
            team.substitutions += incoming.length;
            team.substituted.push(...outgoing);
        }
        team.bench = pool.filter(p => !draft.ids.includes(p.id) && !team.substituted.includes(p.id) && this.game.rules.cards[teamId][p.id] !== 'RED');
        team.squadRevision++;
        this.game.team1.opponents = this.game.team2.players;
        this.game.team2.opponents = this.game.team1.players;
        this.game.selectionStates = {};
        this.game.replay.writeIndex = 0;
        this.game.replay.isFull = false;
        this.game.input.reset();
        return null;
    }

    broadcast() {
        if (this.game.network.isHost) this.game.network.sendControl({
            type: 'SQUAD_SYNC',
            team1: this.snapshot(this.game.team1),
            team2: this.snapshot(this.game.team2)
        });
    }

    sync(teamId, snapshot) {
        const team = this.game[teamId];
        if (!team || !snapshot || snapshot.revision === team.squadRevision) return;
        const paused = this.game.isPaused, seconds = this.game.matchSeconds;
        this.game.isPaused = true;
        this.game.matchSeconds = 0;
        const error = this.apply(teamId, { ...snapshot, revision: team.squadRevision });
        this.game.isPaused = paused;
        this.game.matchSeconds = seconds;
        if (!error) {
            team.substitutions = snapshot.substitutions;
            team.substituted = snapshot.substituted;
            const pool = [...team.data.players, ...team.data.bench];
            team.bench = snapshot.bench.map(id => pool.find(p => p.id === id)).filter(Boolean);
            team.squadRevision = snapshot.revision;
        }
    }
}

window.USF.SquadManager = SquadManager;
