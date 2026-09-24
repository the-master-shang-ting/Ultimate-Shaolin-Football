/**
 * Ultimate Shaolin Football (USF)
 * UIManager.js - Gestión de menús cinemáticos, selector de plantillas (Élite vs Modestos),
 * marcador de transmisión TV, Toast notifications y navegación completa con Gamepad
 */

window.USF = window.USF || {};

class UIManager {
    constructor() {
        // Elementos del HUD
        this.matchHud = document.getElementById('match-hud');
        this.sbTeam1Name = document.getElementById('sb-t1-name');
        this.sbTeam2Name = document.getElementById('sb-t2-name');
        this.sbTeam1Badge = document.getElementById('sb-t1-badge');
        this.sbTeam2Badge = document.getElementById('sb-t2-badge');
        this.sbScore = document.getElementById('sb-score');
        this.sbTime = document.getElementById('sb-time');

        // Tarjeta de Jugador Activo
        this.apName = document.getElementById('ap-name');
        this.apNumber = document.getElementById('ap-number');
        this.staminaFill = document.getElementById('stamina-fill');
        this.powerFill = document.getElementById('power-fill');

        // Radar 2D
        this.radarCanvas = document.getElementById('radar-canvas');
        this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

        // Banner de Eventos
        this.eventBanner = document.getElementById('match-event-banner');
        this.bannerTitle = document.getElementById('banner-title');
        this.bannerSub = document.getElementById('banner-sub');
        this.bannerTimer = null;

        // Contenedor de Notificaciones Toast
        this.toastContainer = document.getElementById('toast-container');

        // Pantallas
        this.mainMenu = document.getElementById('main-menu');
        this.teamSelectScreen = document.getElementById('team-select-screen');
        this.lanModal = document.getElementById('lan-modal');
        this.controlsModal = document.getElementById('controls-modal');
        this.pauseModal = document.getElementById('pause-modal');

        // Selección de Equipos
        this.selectedTeam1Id = 'real_madrid';
        this.selectedTeam2Id = 'barcelona';
        this.currentMode = 'AI'; // 'AI', 'LOCAL_1V1', 'LAN'
        this.currentTeamFilter = 'all'; // 'all', 'elite', 'modest'

        // Sistema de Foco para Navegación con Gamepad
        this.currentFocusElement = null;
        this.focusedScreen = 'main-menu';

        // Callbacks
        this.onStartMatch = null;
        this.onHostLAN = null;
        this.onJoinLAN = null;
        this.onResumeMatch = null;
        this.onRestartMatch = null;
        this.onQuitMatch = null;
        this.onPauseMatch = null;

        // Elementos y Modos del Menú FC26
        this.fcHeroEmblem = document.getElementById('fc-hero-emblem');
        this.fcHeroTitle = document.getElementById('fc-hero-title');
        this.fcHeroBullets = document.getElementById('fc-hero-bullets');
        this.fcHeroActionLabel = document.getElementById('fc-hero-action-label');
        this.fcHeroAction = document.getElementById('fc-hero-action');
        this.activeFCHeroMode = 'KICKOFF';
        this.currentInviteLink = null;

        this.bindEvents();
        this.initDefaultFocus();
        this.setFCHeroMode('KICKOFF');
    }

    setFCHeroMode(modeKey) {
        const MODES = {
            KICKOFF: {
                emblem: 'KO',
                title: '¿Listo para saltar a la cancha?',
                bullets: '<span>Elige tu club</span> • <span>Ajusta tu táctica</span> • <span>Busca la victoria</span>',
                actionLabel: 'Jugar Partido Rápido',
                action: () => {
                    this.currentMode = 'AI';
                    this.showTeamSelect();
                }
            },
            LOCAL_1V1: {
                emblem: '1V1',
                title: 'Duelo 1v1 Cara a Cara en Local',
                bullets: '<span>Mismo teclado</span> • <span>Dos mandos</span> • <span>PVP sin latencia</span>',
                actionLabel: 'Iniciar 1v1 Local',
                action: () => {
                    this.currentMode = 'LOCAL_1V1';
                    this.showTeamSelect();
                }
            },
            ONLINE: {
                emblem: 'NET',
                title: 'Multijugador Global WebRTC',
                bullets: '<span>Salas P2P mundiales</span> • <span>Enlace de invitación</span> • <span>Sin servidores</span>',
                actionLabel: 'Abrir Salas Online',
                action: () => {
                    this.showLanModal();
                }
            },
            CONTROLS: {
                emblem: 'CFG',
                title: 'Domina los Controles y Tácticas',
                bullets: '<span>Regates</span> • <span>Supertiros Shaolin</span> • <span>Barridas</span> • <span>Cámaras FC26</span>',
                actionLabel: 'Ver Guía de Controles',
                action: () => {
                    if (this.controlsModal) this.controlsModal.style.display = 'flex';
                    this.focusedScreen = 'controls-modal';
                    this.initScreenFocus();
                }
            }
        };

        const config = MODES[modeKey] || MODES.KICKOFF;
        this.activeFCHeroMode = modeKey;

        if (this.fcHeroEmblem) this.fcHeroEmblem.textContent = config.emblem;
        if (this.fcHeroTitle) this.fcHeroTitle.textContent = config.title;
        if (this.fcHeroBullets) this.fcHeroBullets.innerHTML = config.bullets;
        if (this.fcHeroActionLabel) this.fcHeroActionLabel.textContent = config.actionLabel;

        // Actualizar clase activa en la barra lateral
        document.querySelectorAll('.fc-nav-item').forEach(item => {
            const isActive = item.dataset.mode === modeKey;
            item.classList.toggle('active', isActive);
        });
    }

    bindEvents() {
        // Navegación de la Barra Lateral FC26
        document.querySelectorAll('.fc-nav-item').forEach(item => {
            const mode = item.dataset.mode || 'KICKOFF';
            item.addEventListener('mouseenter', () => {
                this.setFCHeroMode(mode);
                if (window.USF.soundEngine) window.USF.soundEngine.playMenuHover();
            });
            item.addEventListener('click', () => {
                this.setFCHeroMode(mode);
                if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
                // Al hacer clic, ejecutar directamente la acción del modo
                this.executeFCHeroAction();
            });
        });

        // Botón de Acción Principal de la Tarjeta Hero
        this.fcHeroAction?.addEventListener('click', () => {
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
            this.executeFCHeroAction();
        });


        // Botón Pantalla Completa Top Bar
        document.getElementById('btn-fullscreen-toggle')?.addEventListener('click', () => {
            this.toggleFullscreen();
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
        });

        // Botón Cerrar Controles
        document.getElementById('btn-close-controls')?.addEventListener('click', () => {
            if (this.controlsModal) this.controlsModal.style.display = 'none';
            this.focusedScreen = 'main-menu';
            this.initScreenFocus();
        });

        // Modal Multijugador Global Online
        document.getElementById('btn-lan-host')?.addEventListener('click', () => {
            if (this.onHostLAN) this.onHostLAN();
        });

        document.getElementById('btn-lan-join')?.addEventListener('click', () => {
            const codeInput = document.getElementById('lan-code-input');
            const code = codeInput ? codeInput.value : '';
            if (code && this.onJoinLAN) this.onJoinLAN(code);
        });

        document.getElementById('btn-close-lan')?.addEventListener('click', () => {
            if (this.lanModal) this.lanModal.style.display = 'none';
            this.focusedScreen = 'main-menu';
            this.initScreenFocus();
        });

        // Botón Copiar Enlace de Invitación
        document.getElementById('btn-copy-invite-link')?.addEventListener('click', () => {
            if (this.currentInviteLink) {
                navigator.clipboard?.writeText(this.currentInviteLink).then(() => {
                    this.showToast('¡Enlace Copiado!', 'Compartí el link para que tu rival se una al instante.', '🔗', 'connected', 4000);
                    if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
                }).catch(() => {
                    this.showToast('Enlace de Sala', this.currentInviteLink, '🔗', 'connected', 6000);
                });
            }
        });

        // Selector de Equipos - Botones de Filtro
        document.querySelectorAll('.filter-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentTeamFilter = btn.dataset.filter || 'all';
                this.renderTeamsGrid(this.currentTeamFilter);
                if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
            });
        });

        // Selector de Equipos - Acción Comenzar
        document.getElementById('btn-start-match')?.addEventListener('click', () => {
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
            this.hideAllMenus();
            if (this.onStartMatch) {
                this.onStartMatch(this.selectedTeam1Id, this.selectedTeam2Id, this.currentMode);
            }
        });

        document.getElementById('btn-back-team-select')?.addEventListener('click', () => {
            this.teamSelectScreen.style.display = 'none';
            this.mainMenu.style.display = 'flex';
            this.focusedScreen = 'main-menu';
            this.initScreenFocus();
        });

        // Botón de Pausa del HUD
        document.getElementById('btn-hud-pause')?.addEventListener('click', () => {
            if (this.pauseModal) this.pauseModal.style.display = 'flex';
            this.focusedScreen = 'pause-modal';
            this.initScreenFocus();
            if (this.onPauseMatch) this.onPauseMatch();
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
        });

        // Atajo Escape / P para Pausa
        window.addEventListener('keydown', (e) => {
            if (!e.repeat && (e.code === 'Escape' || e.code === 'KeyP')) {
                if (this.matchHud && this.matchHud.style.display === 'block') {
                    if (this.pauseModal && this.pauseModal.style.display === 'flex') {
                        this.pauseModal.style.display = 'none';
                        if (this.onResumeMatch) this.onResumeMatch();
                    } else if (this.pauseModal) {
                        this.pauseModal.style.display = 'flex';
                        this.focusedScreen = 'pause-modal';
                        this.initScreenFocus();
                        if (this.onPauseMatch) this.onPauseMatch();
                    }
                }
            }
        });

        // Menú de Pausa
        document.getElementById('btn-resume')?.addEventListener('click', () => {
            this.pauseModal.style.display = 'none';
            if (this.onResumeMatch) this.onResumeMatch();
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
        });

        document.getElementById('btn-restart')?.addEventListener('click', () => {
            this.pauseModal.style.display = 'none';
            if (this.onRestartMatch) this.onRestartMatch();
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
        });

        document.getElementById('btn-quit-menu')?.addEventListener('click', () => {
            this.pauseModal.style.display = 'none';
            this.matchHud.style.display = 'none';
            this.mainMenu.style.display = 'flex';
            this.focusedScreen = 'main-menu';
            this.initScreenFocus();
            if (this.onQuitMatch) this.onQuitMatch();
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
        });
    }

    // --- Notificaciones Toast Animadas (Estilo Consola) ---
    showToast(title, message, icon = '🎮', type = 'connected', duration = 3500) {
        if (!this.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast-item ${type}`;

        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-body">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
        `;

        this.toastContainer.appendChild(toast);

        // Desaparición y limpieza con animación
        setTimeout(() => {
            toast.classList.add('hide');
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 400);
        }, duration);
    }

    // --- Sistema de Navegación por Mando (D-Pad / Stick / Botones) ---
    initDefaultFocus() {
        this.focusedScreen = 'main-menu';
        this.initScreenFocus();
    }

    getCurrentFocusableElements() {
        let activeContainer = this.mainMenu;

        if (this.pauseModal && this.pauseModal.style.display === 'flex') {
            activeContainer = this.pauseModal;
        } else if (this.controlsModal && this.controlsModal.style.display === 'flex') {
            activeContainer = this.controlsModal;
        } else if (this.lanModal && this.lanModal.style.display === 'flex') {
            activeContainer = this.lanModal;
        } else if (this.teamSelectScreen && this.teamSelectScreen.style.display === 'flex') {
            activeContainer = this.teamSelectScreen;
        } else if (this.mainMenu && this.mainMenu.style.display !== 'none') {
            activeContainer = this.mainMenu;
        } else {
            return [];
        }

        // Obtener todos los botones interactivos o tarjetas de equipo visibles
        const elements = Array.from(activeContainer.querySelectorAll('button, .team-card, input'));
        return elements.filter(el => el.offsetParent !== null && !el.disabled);
    }

    initScreenFocus() {
        const focusables = this.getCurrentFocusableElements();
        if (focusables.length > 0) {
            this.setGamepadFocus(focusables[0]);
        }
    }

    setGamepadFocus(element) {
        if (this.currentFocusElement) {
            this.currentFocusElement.classList.remove('gamepad-focused');
        }
        this.currentFocusElement = element;
        if (element) {
            element.classList.add('gamepad-focused');
            element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuHover();
        }
    }

    handleGamepadNav(dir) {
        const focusables = this.getCurrentFocusableElements();
        if (!focusables.length) return;

        if (!this.currentFocusElement || !focusables.includes(this.currentFocusElement)) {
            this.setGamepadFocus(focusables[0]);
            return;
        }

        const currentIndex = focusables.indexOf(this.currentFocusElement);
        let nextIndex = currentIndex;

        // Si estamos en la pantalla de selección de equipos con grilla
        if (this.teamSelectScreen && this.teamSelectScreen.style.display === 'flex') {
            const isCard = this.currentFocusElement.classList.contains('team-card');
            const cards = focusables.filter(el => el.classList.contains('team-card'));

            if (isCard && cards.length > 0) {
                const cardIndex = cards.indexOf(this.currentFocusElement);
                const columns = 5; // Columnas aproximadas de la grilla

                if (dir === 'left') {
                    if (cardIndex > 0) nextIndex = focusables.indexOf(cards[cardIndex - 1]);
                } else if (dir === 'right') {
                    if (cardIndex < cards.length - 1) nextIndex = focusables.indexOf(cards[cardIndex + 1]);
                } else if (dir === 'down') {
                    if (cardIndex + columns < cards.length) {
                        nextIndex = focusables.indexOf(cards[cardIndex + columns]);
                    } else {
                        // Pasar a los botones de abajo (Comenzar partido)
                        const startBtn = document.getElementById('btn-start-match');
                        if (startBtn) nextIndex = focusables.indexOf(startBtn);
                    }
                } else if (dir === 'up') {
                    if (cardIndex - columns >= 0) {
                        nextIndex = focusables.indexOf(cards[cardIndex - columns]);
                    } else {
                        // Pasar a las pestañas de filtro de arriba
                        const activeTab = document.querySelector('.filter-tab-btn.active') || document.querySelector('.filter-tab-btn');
                        if (activeTab) nextIndex = focusables.indexOf(activeTab);
                    }
                }
            } else {
                // Navegación normal secuencial
                if (dir === 'down' || dir === 'right') {
                    nextIndex = (currentIndex + 1) % focusables.length;
                } else if (dir === 'up' || dir === 'left') {
                    nextIndex = (currentIndex - 1 + focusables.length) % focusables.length;
                }
            }
        } else if (this.focusedScreen === 'main-menu') {
            const isNav = this.currentFocusElement?.classList.contains('fc-nav-item');
            const navItems = Array.from(document.querySelectorAll('.fc-nav-item'));
            const heroAction = this.fcHeroAction;

            if (isNav) {
                const navIndex = navItems.indexOf(this.currentFocusElement);
                if (dir === 'down') {
                    const nextNav = navItems[(navIndex + 1) % navItems.length];
                    this.setGamepadFocus(nextNav);
                    this.setFCHeroMode(nextNav.dataset.mode || 'KICKOFF');
                    return;
                } else if (dir === 'up') {
                    const prevNav = navItems[(navIndex - 1 + navItems.length) % navItems.length];
                    this.setGamepadFocus(prevNav);
                    this.setFCHeroMode(prevNav.dataset.mode || 'KICKOFF');
                    return;
                } else if (dir === 'right' && heroAction) {
                    this.setGamepadFocus(heroAction);
                    return;
                }
            } else if (this.currentFocusElement === heroAction) {
                if (dir === 'left') {
                    const activeNav = document.querySelector('.fc-nav-item.active') || navItems[0];
                    if (activeNav) this.setGamepadFocus(activeNav);
                    return;
                }
            }
            // Navegación vertical general
            if (dir === 'down' || dir === 'right') {
                nextIndex = (currentIndex + 1) % focusables.length;
            } else if (dir === 'up' || dir === 'left') {
                nextIndex = (currentIndex - 1 + focusables.length) % focusables.length;
            }
        } else {
            // Menú vertical estándar
            if (dir === 'down' || dir === 'right') {
                nextIndex = (currentIndex + 1) % focusables.length;
            } else if (dir === 'up' || dir === 'left') {
                nextIndex = (currentIndex - 1 + focusables.length) % focusables.length;
            }
        }

        if (focusables[nextIndex]) {
            this.setGamepadFocus(focusables[nextIndex]);
        }
    }

    executeFCHeroAction() {
        const MODES = {
            KICKOFF: () => {
                this.currentMode = 'AI';
                this.showTeamSelect();
            },
            LOCAL_1V1: () => {
                this.currentMode = 'LOCAL_1V1';
                this.showTeamSelect();
            },
            ONLINE: () => {
                this.showLanModal();
            },
            CONTROLS: () => {
                if (this.controlsModal) this.controlsModal.style.display = 'flex';
                this.focusedScreen = 'controls-modal';
                this.initScreenFocus();
            }
        };
        const action = MODES[this.activeFCHeroMode] || MODES.KICKOFF;
        action();
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.().catch(() => {});
        }
    }

    setRoomCodeDisplay(code, inviteLink) {
        const codeDisplay = document.getElementById('lan-room-code-display');
        if (codeDisplay) codeDisplay.textContent = code;
        this.currentInviteLink = inviteLink;
        const copyBtn = document.getElementById('btn-copy-invite-link');
        if (copyBtn) {
            copyBtn.style.display = 'flex';
        }
    }

    handleGamepadConfirm() {
        if (this.currentFocusElement) {
            this.currentFocusElement.click();
            if (window.USF.soundEngine) window.USF.soundEngine.playMenuClick();
        }
    }

    handleGamepadCancel() {
        if (this.controlsModal && this.controlsModal.style.display === 'flex') {
            document.getElementById('btn-close-controls')?.click();
        } else if (this.lanModal && this.lanModal.style.display === 'flex') {
            document.getElementById('btn-close-lan')?.click();
        } else if (this.pauseModal && this.pauseModal.style.display === 'flex') {
            document.getElementById('btn-resume')?.click();
        } else if (this.teamSelectScreen && this.teamSelectScreen.style.display === 'flex') {
            document.getElementById('btn-back-team-select')?.click();
        }
    }

    handleGamepadTab(dir) {
        // En la pantalla de equipos, alternar entre pestañas de filtro (Todos -> Élite -> Modestos)
        if (this.teamSelectScreen && this.teamSelectScreen.style.display === 'flex') {
            const tabs = Array.from(document.querySelectorAll('.filter-tab-btn'));
            if (!tabs.length) return;
            const activeIndex = tabs.findIndex(t => t.classList.contains('active'));
            let nextIndex = (activeIndex + dir + tabs.length) % tabs.length;
            tabs[nextIndex].click();
        }
    }

    // --- Pantallas y Flujo ---
    showTeamSelect() {
        this.mainMenu.style.display = 'none';
        this.teamSelectScreen.style.display = 'flex';
        this.focusedScreen = 'team-select';
        this.renderTeamsGrid(this.currentTeamFilter);
        this.initScreenFocus();
    }

    showLanModal() {
        if (this.lanModal) {
            this.lanModal.style.display = 'flex';
            this.focusedScreen = 'lan-modal';
            this.initScreenFocus();
        }
    }

    hideAllMenus() {
        if (this.mainMenu) this.mainMenu.style.display = 'none';
        if (this.teamSelectScreen) this.teamSelectScreen.style.display = 'none';
        if (this.lanModal) this.lanModal.style.display = 'none';
        if (this.controlsModal) this.controlsModal.style.display = 'none';
        if (this.pauseModal) this.pauseModal.style.display = 'none';
        if (this.matchHud) this.matchHud.style.display = 'block';

        if (this.currentFocusElement) {
            this.currentFocusElement.classList.remove('gamepad-focused');
            this.currentFocusElement = null;
        }
    }

    // Renderizar tarjetas de selección de equipos con filtro Élite / Modesto
    renderTeamsGrid(filter = 'all') {
        const grid = document.getElementById('teams-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const teams = window.USF.TeamsData.TEAMS;

        const filteredTeams = Object.values(teams).filter(t => {
            if (filter === 'elite') return t.tier === 'elite';
            if (filter === 'modest') return t.tier === 'modest';
            return true;
        });

        filteredTeams.forEach(team => {
            const card = document.createElement('div');
            card.className = 'team-card';
            card.dataset.teamId = team.id;
            card.tabIndex = 0;

            if (team.id === this.selectedTeam1Id) card.classList.add('selected-p1');
            if (team.id === this.selectedTeam2Id) card.classList.add('selected-p2');

            // Promedio de stats
            const avgStats = { VEL: 0, TIR: 0, PAS: 0, DEF: 0, REG: 0, FIS: 0 };
            team.players.forEach(p => {
                for (let k in avgStats) avgStats[k] += p.stats[k];
            });
            for (let k in avgStats) avgStats[k] = Math.round(avgStats[k] / team.players.length);

            // Estrellas visuales según rating
            const fullStars = Math.floor(team.rating);
            const halfStar = (team.rating % 1 !== 0);
            let starsHtml = '★'.repeat(fullStars);
            if (halfStar) starsHtml += '½';

            const tierBadge = team.tier === 'elite'
                ? `<span class="tier-tag elite">TIER ÉLITE</span>`
                : `<span class="tier-tag modest">TIER MODESTO</span>`;

            card.innerHTML = `
                <div class="tc-header">
                    ${tierBadge}
                    <div class="tc-rating">${starsHtml}</div>
                </div>
                <div class="tc-badge">${team.badgeSvg}</div>
                <div class="tc-name">${team.name}</div>
                <div class="tc-stats-summary">
                    <div>VEL: <b class="${avgStats.VEL > 84 ? 'stat-high' : ''}">${avgStats.VEL}</b></div>
                    <div>TIR: <b class="${avgStats.TIR > 84 ? 'stat-high' : ''}">${avgStats.TIR}</b></div>
                    <div>PAS: <b class="${avgStats.PAS > 84 ? 'stat-high' : ''}">${avgStats.PAS}</b></div>
                    <div>DEF: <b class="${avgStats.DEF > 84 ? 'stat-high' : ''}">${avgStats.DEF}</b></div>
                    <div>REG: <b class="${avgStats.REG > 84 ? 'stat-high' : ''}">${avgStats.REG}</b></div>
                    <div>FIS: <b class="${avgStats.FIS > 84 ? 'stat-high' : ''}">${avgStats.FIS}</b></div>
                </div>
            `;

            card.addEventListener('click', () => {
                if (window.USF.soundEngine) window.USF.soundEngine.playMenuHover();

                if (this.currentMode === 'LOCAL_1V1') {
                    if (this.selectedTeam1Id !== team.id) {
                        this.selectedTeam2Id = this.selectedTeam1Id;
                        this.selectedTeam1Id = team.id;
                    }
                } else {
                    this.selectedTeam1Id = team.id;
                    const otherIds = Object.keys(teams).filter(id => id !== team.id);
                    // Si seleccionó un modesto, ponerle un rival modesto por defecto, o al revés
                    const peerTeams = otherIds.filter(id => teams[id].tier === team.tier);
                    this.selectedTeam2Id = peerTeams.length ? peerTeams[0] : otherIds[0];
                }

                this.renderTeamsGrid(this.currentTeamFilter);
            });

            grid.appendChild(card);
        });
    }

    // Inicializar HUD de partido con los dos equipos
    setupMatchHud(team1, team2) {
        if (this.sbTeam1Name) this.sbTeam1Name.innerText = team1.shortName;
        if (this.sbTeam2Name) this.sbTeam2Name.innerText = team2.shortName;
        if (this.sbTeam1Badge) this.sbTeam1Badge.innerHTML = team1.badgeSvg;
        if (this.sbTeam2Badge) this.sbTeam2Badge.innerHTML = team2.badgeSvg;
        if (this.sbScore) this.sbScore.innerText = `0 - 0`;
        if (this.sbTime) this.sbTime.innerText = `00:00`;
    }

    updateScoreboard(score1, score2, matchSeconds, addedMinutes = 0) {
        if (this.sbScore) this.sbScore.innerText = `${score1} - ${score2}`;

        if (this.sbTime) {
            const mins = Math.floor(matchSeconds / 60);
            const secs = Math.floor(matchSeconds % 60);
            const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            if (addedMinutes > 0) {
                this.sbTime.innerHTML = `${timeStr} <span style="color:#FFD700;font-size:0.9em;margin-left:4px;text-shadow:0 0 8px rgba(255,215,0,0.6);">+${addedMinutes}'</span>`;
            } else {
                this.sbTime.innerText = timeStr;
            }
        }
    }

    updateControlHint(hintText) {
        const hintEl = document.querySelector('.control-hint');
        if (hintEl) {
            hintEl.innerText = hintText;
        }
    }

    updateActivePlayer(player, currentShootPower = 0) {
        if (!player) return;
        if (this.apName) this.apName.innerText = player.playerData.name.toUpperCase();
        if (this.apNumber) this.apNumber.innerText = `#${player.playerData.number} (${player.playerData.pos})`;

        if (this.staminaFill) {
            this.staminaFill.style.width = `${Math.max(0, Math.min(100, player.stamina || 100))}%`;
        }

        if (this.powerFill) {
            this.powerFill.style.width = `${Math.min(100, currentShootPower * 100)}%`;
        }
    }

    showEventBanner(title, subtitle = '', duration = 2.5) {
        if (!this.eventBanner) return;

        if (this.bannerTimer) clearTimeout(this.bannerTimer);

        if (this.bannerTitle) this.bannerTitle.innerText = title;
        if (this.bannerSub) this.bannerSub.innerText = subtitle;

        this.eventBanner.classList.add('active');

        this.bannerTimer = setTimeout(() => {
            this.eventBanner.classList.remove('active');
        }, duration * 1000);
    }

    renderRadar(team1Players, team2Players, ball) {
        if (!this.radarCtx) return;
        const ctx = this.radarCtx;
        const w = this.radarCanvas.width;
        const h = this.radarCanvas.height;

        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(20, 45, 25, 0.75)';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(2, 2, w - 4, h - 4);

        ctx.beginPath();
        ctx.moveTo(w / 2, 2);
        ctx.lineTo(w / 2, h - 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 14, 0, Math.PI * 2);
        ctx.stroke();

        const toRadarX = (wx) => ((wx + 52.5) / 105.0) * (w - 8) + 4;
        const toRadarY = (wz) => ((wz + 34.0) / 68.0) * (h - 8) + 4;

        ctx.fillStyle = '#00E5FF';
        team1Players.forEach(p => {
            if (p.isSentOff) return;
            ctx.beginPath();
            ctx.arc(toRadarX(p.x), toRadarY(p.z), 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = '#FF2E55';
        team2Players.forEach(p => {
            if (p.isSentOff) return;
            ctx.beginPath();
            ctx.arc(toRadarX(p.x), toRadarY(p.z), 3, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(toRadarX(ball.x), toRadarY(ball.z), 3.5, 0, Math.PI * 2);
        ctx.fill();
    }
}

window.USF.UIManager = UIManager;
