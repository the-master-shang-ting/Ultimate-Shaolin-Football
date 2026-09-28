/**
 * Ultimate Shaolin Football (USF)
 * TeamsData.js - Base de datos de equipos ampliada (Tier Élite vs Tier Modesto)
 * 10 Clubes y Selecciones con 110 jugadores y estadísticas individuales (1-99)
 */

window.USF = window.USF || {};

window.USF.TeamsData = {
    FORMATIONS: {
        '4-3-3': [
            { role: 'GK', x: -0.92, z: 0.00 },
            { role: 'LB', x: -0.65, z: -0.68 },
            { role: 'CB', x: -0.72, z: -0.24 },
            { role: 'CB', x: -0.72, z: 0.24 },
            { role: 'RB', x: -0.65, z: 0.68 },
            { role: 'CDM', x: -0.45, z: 0.00 },
            { role: 'CM', x: -0.25, z: -0.42 },
            { role: 'CM', x: -0.25, z: 0.42 },
            { role: 'LW', x: 0.40, z: -0.65 },
            { role: 'ST', x: 0.52, z: 0.00 },
            { role: 'RW', x: 0.40, z: 0.65 }
        ],
        '4-4-2': [
            { role: 'GK', x: -0.92, z: 0.00 },
            { role: 'LB', x: -0.65, z: -0.68 },
            { role: 'CB', x: -0.72, z: -0.24 },
            { role: 'CB', x: -0.72, z: 0.24 },
            { role: 'RB', x: -0.65, z: 0.68 },
            { role: 'LM', x: -0.20, z: -0.65 },
            { role: 'CM', x: -0.30, z: -0.22 },
            { role: 'CM', x: -0.30, z: 0.22 },
            { role: 'RM', x: -0.20, z: 0.65 },
            { role: 'ST', x: 0.45, z: -0.25 },
            { role: 'ST', x: 0.45, z: 0.25 }
        ]
    },

    TEAMS: {
        // ==========================================
        // TIER ÉLITE (Stats 85 - 95)
        // ==========================================
        'real_madrid': {
            id: 'real_madrid',
            name: 'Real Madrid CF',
            shortName: 'RMA',
            country: 'España',
            tier: 'elite',
            formation: '4-3-3',
            rating: 5,
            primaryColor: '#F5F5F5',
            secondaryColor: '#D4AF37',
            accentColor: '#1B2456',
            numberColor: '#1B2456',
            shortsColor: '#FFFFFF',
            socksColor: '#FFFFFF',
            gkKit: { primary: '#1B2456', secondary: '#D4AF37', accent: '#FFFFFF', shorts: '#1B2456', socks: '#1B2456', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <circle cx="50" cy="50" r="46" fill="#1B2456" stroke="#D4AF37" stroke-width="4"/>
                <circle cx="50" cy="50" r="38" fill="#F5F5F5"/>
                <path d="M25 50 L75 50 M50 25 L50 75" stroke="#D4AF37" stroke-width="3" opacity="0.3"/>
                <path d="M32 68 L50 32 L68 68 L58 68 L50 48 L42 68 Z" fill="#1B2456"/>
                <polygon points="50,15 56,26 68,26 59,34 63,45 50,38 37,45 41,34 32,26 44,26" fill="#D4AF37"/>
            </svg>`,
            players: [
                { id: 'rma_1', name: 'Courtois', number: 1, pos: 'GK', stats: { VEL: 52, TIR: 30, PAS: 74, DEF: 91, REG: 50, FIS: 88 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.99 },
                { id: 'rma_2', name: 'Carvajal', number: 2, pos: 'RB', stats: { VEL: 82, TIR: 66, PAS: 83, DEF: 86, REG: 81, FIS: 84 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'buzz', height: 1.73 },
                { id: 'rma_3', name: 'Militão', number: 3, pos: 'CB', stats: { VEL: 86, TIR: 50, PAS: 72, DEF: 88, REG: 73, FIS: 86 }, skinColor: '#8d5524', hairColor: '#1a1105', hairStyle: 'short', height: 1.86 },
                { id: 'rma_4', name: 'Rüdiger', number: 22, pos: 'CB', stats: { VEL: 88, TIR: 58, PAS: 75, DEF: 89, REG: 70, FIS: 92 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.90 },
                { id: 'rma_5', name: 'Mendy', number: 23, pos: 'LB', stats: { VEL: 89, TIR: 60, PAS: 77, DEF: 85, REG: 79, FIS: 87 }, skinColor: '#4a2c11', hairColor: '#0f0f0f', hairStyle: 'buzz', height: 1.80 },
                { id: 'rma_6', name: 'Valverde', number: 8, pos: 'CDM', stats: { VEL: 90, TIR: 88, PAS: 87, DEF: 84, REG: 84, FIS: 92 }, skinColor: '#f1c27d', hairColor: '#5c4033', hairStyle: 'short', height: 1.82 },
                { id: 'rma_7', name: 'Camavinga', number: 6, pos: 'CM', stats: { VEL: 83, TIR: 70, PAS: 85, DEF: 83, REG: 86, FIS: 82 }, skinColor: '#4a2c11', hairColor: '#0f0f0f', hairStyle: 'dreads', height: 1.82 },
                { id: 'rma_8', name: 'Bellingham', number: 5, pos: 'CM', stats: { VEL: 82, TIR: 87, PAS: 88, DEF: 80, REG: 90, FIS: 88 }, skinColor: '#8d5524', hairColor: '#1a1105', hairStyle: 'fade', height: 1.86 },
                { id: 'rma_9', name: 'Rodrygo', number: 11, pos: 'RW', stats: { VEL: 89, TIR: 83, PAS: 82, DEF: 45, REG: 88, FIS: 68 }, skinColor: '#8d5524', hairColor: '#111111', hairStyle: 'fade', height: 1.74 },
                { id: 'rma_10', name: 'Mbappé', number: 9, pos: 'ST', stats: { VEL: 97, TIR: 93, PAS: 82, DEF: 38, REG: 94, FIS: 80 }, skinColor: '#8d5524', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.78 },
                { id: 'rma_11', name: 'Vinícius Jr', number: 7, pos: 'LW', stats: { VEL: 96, TIR: 86, PAS: 83, DEF: 40, REG: 95, FIS: 75 }, skinColor: '#5c3818', hairColor: '#050505', hairStyle: 'fade', height: 1.76 }
            ]
        },

        'barcelona': {
            id: 'barcelona',
            name: 'FC Barcelona',
            shortName: 'BAR',
            country: 'España',
            tier: 'elite',
            formation: '4-3-3',
            rating: 5,
            primaryColor: '#A50044',
            secondaryColor: '#004D98',
            accentColor: '#EDBB00',
            numberColor: '#EDBB00',
            shortsColor: '#004D98',
            socksColor: '#A50044',
            gkKit: { primary: '#2ECC71', secondary: '#27AE60', accent: '#004D98', shorts: '#2ECC71', socks: '#2ECC71', number: '#004D98' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <path d="M15 15 C 30 5, 70 5, 85 15 C 88 55, 65 85, 50 95 C 35 85, 12 55, 15 15 Z" fill="#004D98" stroke="#EDBB00" stroke-width="4"/>
                <path d="M22 22 H48 V45 H22 Z" fill="#FFFFFF"/>
                <rect x="32" y="22" width="6" height="23" fill="#A50044"/>
                <rect x="22" y="31" width="26" height="6" fill="#A50044"/>
                <rect x="52" y="22" width="26" height="23" fill="#EDBB00"/>
                <path d="M57 22 V45 M65 22 V45 M73 22 V45" stroke="#A50044" stroke-width="3"/>
                <rect x="20" y="47" width="60" height="7" fill="#EDBB00"/>
                <path d="M25 57 C 32 75, 45 84, 50 88 C 55 84, 68 75, 75 57 Z" fill="#A50044"/>
                <path d="M40 57 V82 M60 57 V82" stroke="#004D98" stroke-width="7"/>
                <circle cx="50" cy="70" r="6" fill="#EDBB00"/>
            </svg>`,
            players: [
                { id: 'bar_1', name: 'Ter Stegen', number: 1, pos: 'GK', stats: { VEL: 50, TIR: 28, PAS: 87, DEF: 89, REG: 48, FIS: 82 }, skinColor: '#f5d6a8', hairColor: '#b08d57', hairStyle: 'short', height: 1.87 },
                { id: 'bar_2', name: 'Koundé', number: 23, pos: 'RB', stats: { VEL: 84, TIR: 54, PAS: 78, DEF: 87, REG: 77, FIS: 83 }, skinColor: '#8d5524', hairColor: '#151515', hairStyle: 'dreads', height: 1.80 },
                { id: 'bar_3', name: 'Araújo', number: 4, pos: 'CB', stats: { VEL: 85, TIR: 50, PAS: 68, DEF: 89, REG: 66, FIS: 90 }, skinColor: '#b87c4c', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.88 },
                { id: 'bar_4', name: 'Cubarsí', number: 2, pos: 'CB', stats: { VEL: 74, TIR: 45, PAS: 86, DEF: 84, REG: 75, FIS: 76 }, skinColor: '#f5d6a8', hairColor: '#5c4033', hairStyle: 'short', height: 1.84 },
                { id: 'bar_5', name: 'Balde', number: 3, pos: 'LB', stats: { VEL: 94, TIR: 62, PAS: 76, DEF: 78, REG: 82, FIS: 75 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.75 },
                { id: 'bar_6', name: 'De Jong', number: 21, pos: 'CDM', stats: { VEL: 81, TIR: 72, PAS: 88, DEF: 81, REG: 89, FIS: 83 }, skinColor: '#f1c27d', hairColor: '#d4af37', hairStyle: 'parted', height: 1.81 },
                { id: 'bar_7', name: 'Pedri', number: 8, pos: 'CM', stats: { VEL: 79, TIR: 75, PAS: 90, DEF: 73, REG: 91, FIS: 72 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.74 },
                { id: 'bar_8', name: 'Gavi', number: 6, pos: 'CM', stats: { VEL: 78, TIR: 72, PAS: 84, DEF: 82, REG: 85, FIS: 86 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.73 },
                { id: 'bar_9', name: 'Lamine Yamal', number: 19, pos: 'RW', stats: { VEL: 92, TIR: 84, PAS: 87, DEF: 44, REG: 93, FIS: 68 }, skinColor: '#8d5524', hairColor: '#0a0a0a', hairStyle: 'afro_fade', height: 1.78 },
                { id: 'bar_10', name: 'Lewandowski', number: 9, pos: 'ST', stats: { VEL: 76, TIR: 92, PAS: 79, DEF: 42, REG: 84, FIS: 85 }, skinColor: '#f5d6a8', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.85 },
                { id: 'bar_11', name: 'Raphinha', number: 11, pos: 'LW', stats: { VEL: 91, TIR: 86, PAS: 84, DEF: 58, REG: 87, FIS: 78 }, skinColor: '#8d5524', hairColor: '#0a0a0a', hairStyle: 'short', height: 1.76 }
            ]
        },

        'argentina': {
            id: 'argentina',
            name: 'Selección Argentina',
            shortName: 'ARG',
            country: 'Argentina',
            tier: 'elite',
            formation: '4-3-3',
            rating: 5,
            primaryColor: '#75AADB',
            secondaryColor: '#FFFFFF',
            accentColor: '#F6B40E',
            numberColor: '#1B2456',
            shortsColor: '#1B2456',
            socksColor: '#FFFFFF',
            gkKit: { primary: '#E74C3C', secondary: '#C0392B', accent: '#FFFFFF', shorts: '#E74C3C', socks: '#E74C3C', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <path d="M20 15 H80 V60 C80 80, 50 95, 50 95 C50 95, 20 80, 20 60 Z" fill="#75AADB" stroke="#F6B40E" stroke-width="4"/>
                <rect x="32" y="18" width="12" height="60" fill="#FFFFFF"/>
                <rect x="56" y="18" width="12" height="60" fill="#FFFFFF"/>
                <circle cx="50" cy="48" r="14" fill="#F6B40E"/>
                <circle cx="50" cy="48" r="9" fill="#75AADB"/>
                <text x="50" y="52" font-family="Arial" font-size="10" font-weight="bold" fill="#F6B40E" text-anchor="middle">AFA</text>
                <polygon points="35,10 38,15 32,15" fill="#F6B40E"/>
                <polygon points="50,6 53,11 47,11" fill="#F6B40E"/>
                <polygon points="65,10 68,15 62,15" fill="#F6B40E"/>
            </svg>`,
            players: [
                { id: 'arg_1', name: 'D. Martínez', number: 23, pos: 'GK', stats: { VEL: 54, TIR: 30, PAS: 76, DEF: 90, REG: 55, FIS: 89 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.95 },
                { id: 'arg_2', name: 'Molina', number: 26, pos: 'RB', stats: { VEL: 88, TIR: 68, PAS: 79, DEF: 81, REG: 80, FIS: 78 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'buzz', height: 1.75 },
                { id: 'arg_3', name: 'C. Romero', number: 13, pos: 'CB', stats: { VEL: 82, TIR: 52, PAS: 74, DEF: 91, REG: 72, FIS: 89 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'short', height: 1.85 },
                { id: 'arg_4', name: 'Otamendi', number: 19, pos: 'CB', stats: { VEL: 70, TIR: 55, PAS: 75, DEF: 87, REG: 65, FIS: 88 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'fade', height: 1.83 },
                { id: 'arg_5', name: 'Tagliafico', number: 3, pos: 'LB', stats: { VEL: 81, TIR: 60, PAS: 78, DEF: 83, REG: 76, FIS: 80 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.72 },
                { id: 'arg_6', name: 'De Paul', number: 7, pos: 'CM', stats: { VEL: 80, TIR: 79, PAS: 85, DEF: 83, REG: 82, FIS: 89 }, skinColor: '#e0ac69', hairColor: '#d4af37', hairStyle: 'fade', height: 1.80 },
                { id: 'arg_7', name: 'Enzo F.', number: 24, pos: 'CDM', stats: { VEL: 78, TIR: 82, PAS: 89, DEF: 81, REG: 84, FIS: 82 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'short', height: 1.78 },
                { id: 'arg_8', name: 'Mac Allister', number: 20, pos: 'CM', stats: { VEL: 77, TIR: 84, PAS: 88, DEF: 78, REG: 86, FIS: 81 }, skinColor: '#f5d6a8', hairColor: '#b05a2e', hairStyle: 'short', height: 1.76 },
                { id: 'arg_9', name: 'Messi', number: 10, pos: 'RW', stats: { VEL: 84, TIR: 95, PAS: 96, DEF: 36, REG: 96, FIS: 74 }, skinColor: '#f1c27d', hairColor: '#5c4033', hairStyle: 'beard_short', height: 1.70 },
                { id: 'arg_10', name: 'J. Álvarez', number: 9, pos: 'ST', stats: { VEL: 87, TIR: 88, PAS: 82, DEF: 62, REG: 86, FIS: 83 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.70 },
                { id: 'arg_11', name: 'Di María', number: 11, pos: 'LW', stats: { VEL: 84, TIR: 86, PAS: 89, DEF: 48, REG: 89, FIS: 71 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'short', height: 1.80 }
            ]
        },

        'brasil': {
            id: 'brasil',
            name: 'Selección de Brasil',
            shortName: 'BRA',
            country: 'Brasil',
            tier: 'elite',
            formation: '4-3-3',
            rating: 5,
            primaryColor: '#FEDF00',
            secondaryColor: '#009739',
            accentColor: '#002776',
            numberColor: '#009739',
            shortsColor: '#002776',
            socksColor: '#FFFFFF',
            gkKit: { primary: '#111111', secondary: '#222222', accent: '#FEDF00', shorts: '#111111', socks: '#111111', number: '#FEDF00' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <path d="M20 15 H80 V60 C80 80, 50 95, 50 95 C50 95, 20 80, 20 60 Z" fill="#009739" stroke="#FEDF00" stroke-width="4"/>
                <polygon points="50,22 80,50 50,78 20,50" fill="#FEDF00"/>
                <circle cx="50" cy="50" r="16" fill="#002776"/>
                <path d="M35 50 Q 50 44 65 52" stroke="#FFFFFF" stroke-width="2" fill="none"/>
                <text x="50" y="53" font-family="Arial" font-size="8" font-weight="bold" fill="#FEDF00" text-anchor="middle">CBF</text>
                <polygon points="50,6 53,11 47,11" fill="#FEDF00"/>
            </svg>`,
            players: [
                { id: 'bra_1', name: 'Alisson', number: 1, pos: 'GK', stats: { VEL: 53, TIR: 25, PAS: 86, DEF: 90, REG: 52, FIS: 85 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'beard_short', height: 1.93 },
                { id: 'bra_2', name: 'Danilo', number: 2, pos: 'RB', stats: { VEL: 80, TIR: 68, PAS: 78, DEF: 82, REG: 77, FIS: 81 }, skinColor: '#8d5524', hairColor: '#151515', hairStyle: 'buzz', height: 1.84 },
                { id: 'bra_3', name: 'Marquinhos', number: 4, pos: 'CB', stats: { VEL: 81, TIR: 54, PAS: 77, DEF: 89, REG: 74, FIS: 82 }, skinColor: '#8d5524', hairColor: '#151515', hairStyle: 'fade', height: 1.83 },
                { id: 'bra_4', name: 'Gabriel M.', number: 14, pos: 'CB', stats: { VEL: 81, TIR: 50, PAS: 74, DEF: 87, REG: 70, FIS: 88 }, skinColor: '#8d5524', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.90 },
                { id: 'bra_5', name: 'G. Arana', number: 16, pos: 'LB', stats: { VEL: 86, TIR: 64, PAS: 77, DEF: 78, REG: 80, FIS: 77 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.76 },
                { id: 'bra_6', name: 'Casemiro', number: 5, pos: 'CDM', stats: { VEL: 68, TIR: 76, PAS: 79, DEF: 89, REG: 72, FIS: 92 }, skinColor: '#8d5524', hairColor: '#151515', hairStyle: 'buzz', height: 1.85 },
                { id: 'bra_7', name: 'Bruno G.', number: 8, pos: 'CM', stats: { VEL: 77, TIR: 76, PAS: 86, DEF: 81, REG: 84, FIS: 84 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.82 },
                { id: 'bra_8', name: 'Paquetá', number: 7, pos: 'CM', stats: { VEL: 78, TIR: 80, PAS: 85, DEF: 74, REG: 87, FIS: 80 }, skinColor: '#b87c4c', hairColor: '#151515', hairStyle: 'fade', height: 1.80 },
                { id: 'bra_9', name: 'Raphinha', number: 11, pos: 'RW', stats: { VEL: 91, TIR: 85, PAS: 83, DEF: 54, REG: 88, FIS: 77 }, skinColor: '#8d5524', hairColor: '#0a0a0a', hairStyle: 'short', height: 1.76 },
                { id: 'bra_10', name: 'Endrick', number: 9, pos: 'ST', stats: { VEL: 89, TIR: 85, PAS: 74, DEF: 42, REG: 86, FIS: 86 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'fade', height: 1.73 },
                { id: 'bra_11', name: 'Vinícius Jr', number: 7, pos: 'LW', stats: { VEL: 96, TIR: 86, PAS: 83, DEF: 40, REG: 95, FIS: 75 }, skinColor: '#5c3818', hairColor: '#050505', hairStyle: 'fade', height: 1.76 }
            ]
        },

        'lombardia_fc': {
            id: 'lombardia_fc',
            name: 'Lombardía FC',
            shortName: 'LOM',
            country: 'Italia',
            tier: 'elite',
            formation: '4-3-3',
            rating: 5,
            primaryColor: '#001C9A', // Azul Inter
            secondaryColor: '#111111', // Negro
            accentColor: '#FFFFFF',
            numberColor: '#FFFFFF',
            shortsColor: '#111111',
            socksColor: '#001C9A',
            gkKit: { primary: '#E67E22', secondary: '#D35400', accent: '#FFFFFF', shorts: '#E67E22', socks: '#E67E22', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <circle cx="50" cy="50" r="46" fill="#001C9A" stroke="#FFFFFF" stroke-width="3"/>
                <circle cx="50" cy="50" r="38" fill="#111111"/>
                <circle cx="50" cy="50" r="28" fill="#001C9A"/>
                <text x="50" y="58" font-family="Arial Black" font-size="20" font-weight="bold" fill="#FFFFFF" text-anchor="middle">IM</text>
                <polygon points="50,10 54,18 63,18 56,24 59,32 50,27 41,32 44,24 37,18 46,18" fill="#FFD700"/>
            </svg>`,
            players: [
                { id: 'lom_1', name: 'Sommer', number: 1, pos: 'GK', stats: { VEL: 52, TIR: 20, PAS: 76, DEF: 88, REG: 49, FIS: 80 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.83 },
                { id: 'lom_2', name: 'Dumfries', number: 2, pos: 'RB', stats: { VEL: 89, TIR: 68, PAS: 75, DEF: 82, REG: 78, FIS: 89 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.88 },
                { id: 'lom_3', name: 'Pavard', number: 28, pos: 'CB', stats: { VEL: 77, TIR: 65, PAS: 80, DEF: 86, REG: 74, FIS: 81 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.86 },
                { id: 'lom_4', name: 'Bastoni', number: 95, pos: 'CB', stats: { VEL: 78, TIR: 54, PAS: 86, DEF: 89, REG: 78, FIS: 85 }, skinColor: '#f5d6a8', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.90 },
                { id: 'lom_5', name: 'Dimarco', number: 32, pos: 'LB', stats: { VEL: 84, TIR: 82, PAS: 88, DEF: 80, REG: 83, FIS: 77 }, skinColor: '#f5d6a8', hairColor: '#b08d57', hairStyle: 'buzz', height: 1.75 },
                { id: 'lom_6', name: 'Çalhanoğlu', number: 20, pos: 'CDM', stats: { VEL: 74, TIR: 87, PAS: 90, DEF: 82, REG: 84, FIS: 79 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'short', height: 1.78 },
                { id: 'lom_7', name: 'Barella', number: 23, pos: 'CM', stats: { VEL: 84, TIR: 79, PAS: 87, DEF: 84, REG: 87, FIS: 84 }, skinColor: '#f1c27d', hairColor: '#5c4033', hairStyle: 'short', height: 1.75 },
                { id: 'lom_8', name: 'Mkhitaryan', number: 22, pos: 'CM', stats: { VEL: 75, TIR: 78, PAS: 85, DEF: 76, REG: 84, FIS: 74 }, skinColor: '#e0ac69', hairColor: '#222222', hairStyle: 'short', height: 1.77 },
                { id: 'lom_9', name: 'Zielinski', number: 7, pos: 'RW', stats: { VEL: 80, TIR: 81, PAS: 86, DEF: 65, REG: 85, FIS: 73 }, skinColor: '#f5d6a8', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.80 },
                { id: 'lom_10', name: 'L. Martínez', number: 10, pos: 'ST', stats: { VEL: 86, TIR: 91, PAS: 80, DEF: 52, REG: 88, FIS: 87 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'fade', height: 1.74 },
                { id: 'lom_11', name: 'M. Thuram', number: 9, pos: 'LW', stats: { VEL: 90, TIR: 84, PAS: 77, DEF: 46, REG: 85, FIS: 88 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'short', height: 1.92 }
            ]
        },

        'piemonte_fc': {
            id: 'piemonte_fc',
            name: 'Piemonte FC',
            shortName: 'PIE',
            country: 'Italia',
            tier: 'elite',
            formation: '4-3-3',
            rating: 4.5,
            primaryColor: '#FFFFFF', // Rayas Blanco y Negro
            secondaryColor: '#111111',
            accentColor: '#E5B338',
            numberColor: '#E5B338',
            shortsColor: '#FFFFFF',
            socksColor: '#111111',
            gkKit: { primary: '#00A859', secondary: '#008544', accent: '#FFFFFF', shorts: '#00A859', socks: '#00A859', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <path d="M25 15 H75 V65 C75 85, 50 95, 50 95 C50 95, 25 85, 25 65 Z" fill="#FFFFFF" stroke="#111111" stroke-width="4"/>
                <path d="M38 18 V65 M50 18 V68 M62 18 V65" stroke="#111111" stroke-width="6"/>
                <circle cx="50" cy="40" r="14" fill="#E5B338"/>
                <text x="50" y="46" font-family="Arial Black" font-size="14" font-weight="bold" fill="#111111" text-anchor="middle">J</text>
            </svg>`,
            players: [
                { id: 'pie_1', name: 'Di Gregorio', number: 29, pos: 'GK', stats: { VEL: 51, TIR: 20, PAS: 74, DEF: 86, REG: 48, FIS: 82 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'buzz', height: 1.87 },
                { id: 'pie_2', name: 'Savona', number: 37, pos: 'RB', stats: { VEL: 80, TIR: 60, PAS: 74, DEF: 79, REG: 75, FIS: 78 }, skinColor: '#f5d6a8', hairColor: '#3a2010', hairStyle: 'short', height: 1.83 },
                { id: 'pie_3', name: 'Bremer', number: 3, pos: 'CB', stats: { VEL: 84, TIR: 52, PAS: 70, DEF: 90, REG: 68, FIS: 91 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.88 },
                { id: 'pie_4', name: 'Gatti', number: 4, pos: 'CB', stats: { VEL: 75, TIR: 55, PAS: 68, DEF: 85, REG: 65, FIS: 89 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.90 },
                { id: 'pie_5', name: 'Cambiaso', number: 27, pos: 'LB', stats: { VEL: 84, TIR: 70, PAS: 82, DEF: 81, REG: 82, FIS: 78 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.82 },
                { id: 'pie_6', name: 'Locatelli', number: 5, pos: 'CDM', stats: { VEL: 72, TIR: 75, PAS: 84, DEF: 83, REG: 79, FIS: 83 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.85 },
                { id: 'pie_7', name: 'Thuram Jr', number: 19, pos: 'CM', stats: { VEL: 82, TIR: 70, PAS: 79, DEF: 80, REG: 81, FIS: 87 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'dreads', height: 1.92 },
                { id: 'pie_8', name: 'Koopmeiners', number: 8, pos: 'CM', stats: { VEL: 76, TIR: 85, PAS: 86, DEF: 78, REG: 82, FIS: 83 }, skinColor: '#f5d6a8', hairColor: '#d4af37', hairStyle: 'short', height: 1.84 },
                { id: 'pie_9', name: 'Conceição', number: 7, pos: 'RW', stats: { VEL: 90, TIR: 77, PAS: 78, DEF: 44, REG: 88, FIS: 64 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.70 },
                { id: 'pie_10', name: 'Vlahović', number: 9, pos: 'ST', stats: { VEL: 83, TIR: 89, PAS: 73, DEF: 42, REG: 80, FIS: 88 }, skinColor: '#f5d6a8', hairColor: '#151515', hairStyle: 'fade', height: 1.90 },
                { id: 'pie_11', name: 'Yildiz', number: 10, pos: 'LW', stats: { VEL: 86, TIR: 82, PAS: 81, DEF: 45, REG: 87, FIS: 75 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.85 }
            ]
        },

        // ==========================================
        // TIER MEDIO Y MODESTO (Stats 58 - 74)
        // ==========================================
        'rayo_vallecano': {
            id: 'rayo_vallecano',
            name: 'Rayo Vallecano',
            shortName: 'RAY',
            country: 'España',
            tier: 'modest',
            formation: '4-4-2',
            rating: 3.5,
            primaryColor: '#FFFFFF', // Blanco con franja roja
            secondaryColor: '#D31127',
            accentColor: '#111111',
            numberColor: '#D31127',
            shortsColor: '#FFFFFF',
            socksColor: '#FFFFFF',
            gkKit: { primary: '#111111', secondary: '#333333', accent: '#D31127', shorts: '#111111', socks: '#111111', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <rect x="20" y="15" width="60" height="70" rx="6" fill="#FFFFFF" stroke="#D31127" stroke-width="4"/>
                <line x1="20" y1="20" x2="80" y2="80" stroke="#D31127" stroke-width="12"/>
                <text x="50" y="55" font-family="Arial Black" font-size="16" font-weight="bold" fill="#111111" text-anchor="middle">RVM</text>
            </svg>`,
            players: [
                { id: 'ray_1', name: 'Batalla', number: 13, pos: 'GK', stats: { VEL: 48, TIR: 18, PAS: 68, DEF: 76, REG: 44, FIS: 74 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.87 },
                { id: 'ray_2', name: 'Ratiu', number: 2, pos: 'RB', stats: { VEL: 88, TIR: 58, PAS: 68, DEF: 72, REG: 73, FIS: 75 }, skinColor: '#f5d6a8', hairColor: '#00E5FF', hairStyle: 'buzz', height: 1.83 }, // Pelo azul Ratiu
                { id: 'ray_3', name: 'Lejeune', number: 24, pos: 'CB', stats: { VEL: 62, TIR: 74, PAS: 72, DEF: 78, REG: 60, FIS: 84 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'buzz', height: 1.90 },
                { id: 'ray_4', name: 'Mumin', number: 16, pos: 'CB', stats: { VEL: 74, TIR: 44, PAS: 62, DEF: 76, REG: 61, FIS: 82 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'short', height: 1.88 },
                { id: 'ray_5', name: 'Chavarría', number: 3, pos: 'LB', stats: { VEL: 79, TIR: 56, PAS: 69, DEF: 71, REG: 72, FIS: 72 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.76 },
                { id: 'ray_6', name: 'Álvaro G.', number: 18, pos: 'LM', stats: { VEL: 89, TIR: 72, PAS: 72, DEF: 60, REG: 77, FIS: 70 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.68 },
                { id: 'ray_7', name: 'Ó. Valentín', number: 23, pos: 'CM', stats: { VEL: 68, TIR: 55, PAS: 72, DEF: 79, REG: 70, FIS: 82 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.78 },
                { id: 'ray_8', name: 'Unai López', number: 17, pos: 'CM', stats: { VEL: 66, TIR: 73, PAS: 77, DEF: 68, REG: 76, FIS: 67 }, skinColor: '#f5d6a8', hairColor: '#5c4033', hairStyle: 'short', height: 1.70 },
                { id: 'ray_9', name: 'Isi Palazón', number: 7, pos: 'RM', stats: { VEL: 76, TIR: 78, PAS: 79, DEF: 64, REG: 81, FIS: 74 }, skinColor: '#f1c27d', hairColor: '#111111', hairStyle: 'buzz', height: 1.69 },
                { id: 'ray_10', name: 'Camello', number: 14, pos: 'ST', stats: { VEL: 78, TIR: 75, PAS: 69, DEF: 48, REG: 75, FIS: 71 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.77 },
                { id: 'ray_11', name: 'Trejo', number: 8, pos: 'ST', stats: { VEL: 64, TIR: 72, PAS: 78, DEF: 58, REG: 76, FIS: 70 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'beard_short', height: 1.80 }
            ]
        },

        'cadiz_cf': {
            id: 'cadiz_cf',
            name: 'Cádiz CF',
            shortName: 'CAD',
            country: 'España',
            tier: 'modest',
            formation: '4-4-2',
            rating: 3,
            primaryColor: '#FFE600', // Amarillo
            secondaryColor: '#003882', // Azul
            accentColor: '#FFFFFF',
            numberColor: '#003882',
            shortsColor: '#003882',
            socksColor: '#FFE600',
            gkKit: { primary: '#E74C3C', secondary: '#C0392B', accent: '#FFFFFF', shorts: '#E74C3C', socks: '#E74C3C', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <polygon points="50,12 85,32 75,85 50,95 25,85 15,32" fill="#FFE600" stroke="#003882" stroke-width="4"/>
                <polygon points="50,22 75,38 68,78 50,86 32,78 25,38" fill="#003882"/>
                <text x="50" y="58" font-family="Arial Black" font-size="14" font-weight="bold" fill="#FFE600" text-anchor="middle">CADIZ</text>
            </svg>`,
            players: [
                { id: 'cad_1', name: 'David Gil', number: 1, pos: 'GK', stats: { VEL: 46, TIR: 15, PAS: 64, DEF: 74, REG: 42, FIS: 73 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.86 },
                { id: 'cad_2', name: 'Iza', number: 20, pos: 'RB', stats: { VEL: 74, TIR: 54, PAS: 67, DEF: 70, REG: 68, FIS: 72 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.72 },
                { id: 'cad_3', name: 'Fali', number: 3, pos: 'CB', stats: { VEL: 58, TIR: 45, PAS: 62, DEF: 77, REG: 55, FIS: 88 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'beard_short', height: 1.87 },
                { id: 'cad_4', name: 'Víctor Chust', number: 5, pos: 'CB', stats: { VEL: 68, TIR: 42, PAS: 65, DEF: 74, REG: 62, FIS: 77 }, skinColor: '#f5d6a8', hairColor: '#3a2010', hairStyle: 'short', height: 1.82 },
                { id: 'cad_5', name: 'Matos', number: 18, pos: 'LB', stats: { VEL: 77, TIR: 50, PAS: 65, DEF: 68, REG: 69, FIS: 70 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'short', height: 1.70 },
                { id: 'cad_6', name: 'B. Ocampo', number: 10, pos: 'LM', stats: { VEL: 82, TIR: 73, PAS: 72, DEF: 44, REG: 81, FIS: 66 }, skinColor: '#e0ac69', hairColor: '#d4af37', hairStyle: 'fade', height: 1.73 },
                { id: 'cad_7', name: 'Alcaraz', number: 4, pos: 'CM', stats: { VEL: 60, TIR: 74, PAS: 75, DEF: 73, REG: 70, FIS: 79 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.82 },
                { id: 'cad_8', name: 'Escalante', number: 17, pos: 'CM', stats: { VEL: 66, TIR: 68, PAS: 71, DEF: 74, REG: 69, FIS: 83 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'short', height: 1.82 },
                { id: 'cad_9', name: 'Sobrino', number: 7, pos: 'RM', stats: { VEL: 78, TIR: 68, PAS: 66, DEF: 58, REG: 72, FIS: 76 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.85 },
                { id: 'cad_10', name: 'Chris Ramos', number: 16, pos: 'ST', stats: { VEL: 86, TIR: 73, PAS: 58, DEF: 45, REG: 69, FIS: 85 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'fade', height: 1.93 },
                { id: 'cad_11', name: 'Ontiveros', number: 22, pos: 'ST', stats: { VEL: 74, TIR: 77, PAS: 74, DEF: 40, REG: 78, FIS: 68 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.74 }
            ]
        },

        'deportivo_tapita': {
            id: 'deportivo_tapita',
            name: 'Deportivo Tapita',
            shortName: 'TAP',
            country: 'Argentina',
            tier: 'modest',
            formation: '4-4-2',
            rating: 2,
            primaryColor: '#4A90E2', // Celeste gastado
            secondaryColor: '#8B572A', // Marrón
            accentColor: '#FFFFFF',
            numberColor: '#FFFFFF',
            shortsColor: '#111111',
            socksColor: '#4A90E2',
            gkKit: { primary: '#27AE60', secondary: '#1E8449', accent: '#FFFFFF', shorts: '#111111', socks: '#111111', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <circle cx="50" cy="50" r="46" fill="#8B572A" stroke="#FFFFFF" stroke-width="3"/>
                <circle cx="50" cy="50" r="38" fill="#4A90E2"/>
                <path d="M30 65 Q 50 30 70 65" stroke="#FFFFFF" stroke-width="4" fill="none"/>
                <text x="50" y="52" font-family="Arial Black" font-size="12" font-weight="bold" fill="#FFFFFF" text-anchor="middle">TAPITA</text>
                <circle cx="50" cy="68" r="7" fill="#8B572A"/>
            </svg>`,
            players: [
                { id: 'tap_1', name: 'El Ruso', number: 1, pos: 'GK', stats: { VEL: 42, TIR: 15, PAS: 54, DEF: 68, REG: 36, FIS: 78 }, skinColor: '#f5d6a8', hairColor: '#b08d57', hairStyle: 'buzz', height: 1.84 },
                { id: 'tap_2', name: 'Cacho F.', number: 4, pos: 'RB', stats: { VEL: 60, TIR: 45, PAS: 58, DEF: 64, REG: 56, FIS: 75 }, skinColor: '#e0ac69', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.74 },
                { id: 'tap_3', name: 'Hacha Q.', number: 2, pos: 'CB', stats: { VEL: 54, TIR: 40, PAS: 50, DEF: 72, REG: 46, FIS: 89 }, skinColor: '#8d5524', hairColor: '#151515', hairStyle: 'buzz', height: 1.86 },
                { id: 'tap_4', name: 'El Negro', number: 6, pos: 'CB', stats: { VEL: 58, TIR: 38, PAS: 52, DEF: 69, REG: 48, FIS: 85 }, skinColor: '#5c3818', hairColor: '#0a0a0a', hairStyle: 'buzz', height: 1.85 },
                { id: 'tap_5', name: 'Beto R.', number: 3, pos: 'LB', stats: { VEL: 64, TIR: 48, PAS: 56, DEF: 62, REG: 58, FIS: 68 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'short', height: 1.70 },
                { id: 'tap_6', name: 'Pocho L.', number: 8, pos: 'LM', stats: { VEL: 68, TIR: 62, PAS: 64, DEF: 54, REG: 66, FIS: 62 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.72 },
                { id: 'tap_7', name: 'El Gordo', number: 5, pos: 'CM', stats: { VEL: 52, TIR: 66, PAS: 68, DEF: 66, REG: 60, FIS: 90 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'beard_short', height: 1.80 },
                { id: 'tap_8', name: 'Tito M.', number: 14, pos: 'CM', stats: { VEL: 60, TIR: 58, PAS: 62, DEF: 65, REG: 61, FIS: 74 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.76 },
                { id: 'tap_9', name: 'Flecha R.', number: 7, pos: 'RM', stats: { VEL: 76, TIR: 60, PAS: 58, DEF: 44, REG: 68, FIS: 64 }, skinColor: '#8d5524', hairColor: '#111111', hairStyle: 'short', height: 1.71 },
                { id: 'tap_10', name: 'El Tanque', number: 9, pos: 'ST', stats: { VEL: 62, TIR: 76, PAS: 55, DEF: 42, REG: 60, FIS: 92 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.88 },
                { id: 'tap_11', name: 'Pichi M.', number: 11, pos: 'ST', stats: { VEL: 72, TIR: 68, PAS: 62, DEF: 40, REG: 70, FIS: 63 }, skinColor: '#e0ac69', hairColor: '#151515', hairStyle: 'short', height: 1.68 }
            ]
        },

        'bad_homburg': {
            id: 'bad_homburg',
            name: 'FC Bad Homburg',
            shortName: 'HOM',
            country: 'Alemania',
            tier: 'modest',
            formation: '4-4-2',
            rating: 2,
            primaryColor: '#1E4620', // Verde bosque
            secondaryColor: '#FFFFFF', // Blanco
            accentColor: '#D4AF37',
            numberColor: '#FFFFFF',
            shortsColor: '#1E4620',
            socksColor: '#FFFFFF',
            gkKit: { primary: '#F39C12', secondary: '#D68910', accent: '#FFFFFF', shorts: '#1E4620', socks: '#1E4620', number: '#FFFFFF' },
            badgeSvg: `<svg viewBox="0 0 100 100" width="48" height="48">
                <rect x="20" y="15" width="60" height="70" rx="8" fill="#1E4620" stroke="#D4AF37" stroke-width="4"/>
                <polygon points="50,22 70,40 50,58 30,40" fill="#FFFFFF"/>
                <text x="50" y="75" font-family="Arial Black" font-size="11" font-weight="bold" fill="#D4AF37" text-anchor="middle">HOMBURG</text>
            </svg>`,
            players: [
                { id: 'hom_1', name: 'Becker', number: 1, pos: 'GK', stats: { VEL: 44, TIR: 15, PAS: 56, DEF: 69, REG: 38, FIS: 79 }, skinColor: '#f5d6a8', hairColor: '#b08d57', hairStyle: 'short', height: 1.91 },
                { id: 'hom_2', name: 'Müller J.', number: 2, pos: 'RB', stats: { VEL: 63, TIR: 48, PAS: 60, DEF: 65, REG: 58, FIS: 76 }, skinColor: '#f5d6a8', hairColor: '#5c4033', hairStyle: 'short', height: 1.80 },
                { id: 'hom_3', name: 'Schmidt', number: 4, pos: 'CB', stats: { VEL: 56, TIR: 44, PAS: 55, DEF: 71, REG: 49, FIS: 85 }, skinColor: '#f1c27d', hairColor: '#3a2010', hairStyle: 'buzz', height: 1.89 },
                { id: 'hom_4', name: 'Weber', number: 5, pos: 'CB', stats: { VEL: 55, TIR: 40, PAS: 58, DEF: 70, REG: 50, FIS: 84 }, skinColor: '#f5d6a8', hairColor: '#d4af37', hairStyle: 'short', height: 1.87 },
                { id: 'hom_5', name: 'Wagner', number: 3, pos: 'LB', stats: { VEL: 65, TIR: 50, PAS: 61, DEF: 64, REG: 59, FIS: 73 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.78 },
                { id: 'hom_6', name: 'Schneider', number: 11, pos: 'LM', stats: { VEL: 70, TIR: 64, PAS: 63, DEF: 52, REG: 66, FIS: 68 }, skinColor: '#f5d6a8', hairColor: '#b08d57', hairStyle: 'short', height: 1.76 },
                { id: 'hom_7', name: 'Klein', number: 6, pos: 'CM', stats: { VEL: 58, TIR: 60, PAS: 67, DEF: 68, REG: 62, FIS: 80 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'short', height: 1.83 },
                { id: 'hom_8', name: 'Richter', number: 8, pos: 'CM', stats: { VEL: 60, TIR: 65, PAS: 68, DEF: 62, REG: 64, FIS: 75 }, skinColor: '#f5d6a8', hairColor: '#5c4033', hairStyle: 'short', height: 1.81 },
                { id: 'hom_9', name: 'Bauer', number: 7, pos: 'RM', stats: { VEL: 72, TIR: 62, PAS: 62, DEF: 50, REG: 67, FIS: 71 }, skinColor: '#f1c27d', hairColor: '#2b1d0c', hairStyle: 'short', height: 1.75 },
                { id: 'hom_10', name: 'Hoffmann', number: 9, pos: 'ST', stats: { VEL: 66, TIR: 73, PAS: 56, DEF: 44, REG: 62, FIS: 84 }, skinColor: '#f5d6a8', hairColor: '#3a2010', hairStyle: 'short', height: 1.88 },
                { id: 'hom_11', name: 'Fischer', number: 10, pos: 'ST', stats: { VEL: 68, TIR: 71, PAS: 64, DEF: 42, REG: 69, FIS: 72 }, skinColor: '#f1c27d', hairColor: '#151515', hairStyle: 'fade', height: 1.79 }
            ]
        }
    }
};
