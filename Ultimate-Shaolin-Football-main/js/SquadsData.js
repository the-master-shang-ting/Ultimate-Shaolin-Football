/* Historical squad selection, based on the game's 2024/25 club database.
 * Names/roles are real; ratings and appearances are game balancing values.
 * Sources and scope: docs/squads-and-match-controls.md.
 */
(() => {
    const data = window.USF.TeamsData;
    const layouts = {
        '4-2-3-1': [['GK',-.92,0],['LB',-.65,-.68],['CB',-.72,-.24],['CB',-.72,.24],['RB',-.65,.68],['CDM',-.4,-.26],['CDM',-.4,.26],['LW',.1,-.65],['CAM',.12,0],['RW',.1,.65],['ST',.52,0]],
        '4-1-2-1-2': [['GK',-.92,0],['LB',-.65,-.68],['CB',-.72,-.24],['CB',-.72,.24],['RB',-.65,.68],['CDM',-.45,0],['CM',-.15,-.4],['CM',-.15,.4],['CAM',.18,0],['ST',.48,-.25],['ST',.48,.25]],
        '3-5-2': [['GK',-.92,0],['CB',-.66,-.45],['CB',-.75,0],['CB',-.66,.45],['LM',-.15,-.8],['CDM',-.38,0],['CM',-.12,-.32],['CM',-.12,.32],['RM',-.15,.8],['ST',.48,-.25],['ST',.48,.25]],
        '5-3-2': [['GK',-.92,0],['LB',-.48,-.8],['CB',-.7,-.4],['CB',-.76,0],['CB',-.7,.4],['RB',-.48,.8],['CM',-.2,-.38],['CDM',-.35,0],['CM',-.2,.38],['ST',.48,-.25],['ST',.48,.25]]
    };
    for (const [name, slots] of Object.entries(layouts)) data.FORMATIONS[name] = slots.map(([role,x,z]) => ({role,x,z}));
    const reserves = {
        real_madrid: [['Lunin','GK',13],['Lucas Vázquez','RB',17],['Fran García','LB',20],['Modrić','CM',10],['Tchouaméni','CDM',14],['Arda Güler','CAM',15],['Brahim Díaz','RW',21],['Endrick','ST',16]],
        barcelona: [['Iñaki Peña','GK',13],['Christensen','CB',15],['Eric García','CB',24],['Iñigo Martínez','CB',5],['Fermín López','CAM',16],['Pablo Torre','CM',14],['Ferran Torres','ST',7],['Ansu Fati','LW',10]],
        argentina: [['Armani','GK',1],['Montiel','RB',4],['Lisandro Martínez','CB',25],['Paredes','CDM',5],['Lo Celso','CM',16],['Palacios','CM',14],['Lautaro Martínez','ST',22],['Nicolás González','LW',15]],
        brasil: [['Bento','GK',12],['Éder Militão','CB',3],['Wendell','LB',6],['João Gomes','CM',15],['Douglas Luiz','CM',18],['Rodrygo','RW',10],['Gabriel Martinelli','LW',22],['Evanilson','ST',21]],
        lombardia_fc: [['Josep Martínez','GK',13],['De Vrij','CB',6],['Acerbi','CB',15],['Carlos Augusto','LB',30],['Darmian','RB',36],['Frattesi','CM',16],['Asllani','CDM',21],['Taremi','ST',99]],
        piemonte_fc: [['Perin','GK',1],['Kalulu','CB',15],['Danilo','CB',6],['McKennie','CM',16],['Douglas Luiz','CDM',26],['Fagioli','CM',21],['Weah','RW',22],['Mbangula','LW',51]],
        rayo_vallecano: [['Cárdenas','GK',1],['Balliu','RB',20],['Aridane','CB',5],['Espino','LB',22],['Pathé Ciss','CDM',6],['Pedro Díaz','CM',4],['De Frutos','RW',19],['Nteka','ST',11]],
        cadiz_cf: [['José Antonio Caro','GK',13],['Zaldua','RB',2],['Glauder','CB',24],['Kovacevic','CB',14],['Álex Fernández','CM',8],['Fede San Emeterio','CDM',6],['Roger Martí','ST',9],['Carlos Fernández','ST',23]]
    };
    for (const team of Object.values(data.TEAMS)) {
        const entries = reserves[team.id];
        team.squadLabel = entries ? 'Plantel histórico 2024–25 · atributos de juego' : 'Equipo ficticio USF';
        team.bench = (entries || [['Suplente POR','GK',12],['Suplente DEF','CB',13],['Suplente MED','CM',14],['Suplente DEL','ST',15]]).map(([name,pos,number],i) => {
            const template = team.players.find(p => p.pos === pos) || team.players.find(p => p.pos === (pos === 'GK' ? 'GK' : 'CM')) || team.players[1];
            return {...template, id:`${team.id}_sub_${i}`, name, pos, number,
                stats:Object.fromEntries(Object.entries(template.stats).map(([key,val]) => [key,Math.max(25,val-4)]))};
        });
    }
    data.TEAMS.argentina.squadLabel = 'Selección histórica · Copa América 2024 · atributos de juego';
    data.TEAMS.brasil.squadLabel = 'Selección histórica USF · jugadores de Brasil · atributos de juego';
    data.TEAMS.lombardia_fc.name = 'Inter de Milán';
    data.TEAMS.piemonte_fc.name = 'Juventus';
})();
