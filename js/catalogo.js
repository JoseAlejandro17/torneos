// Catálogo inicial de deportes y sistemas de anotación.
//
// Un sistema de anotación tiene un `tipo` que define cómo se cuenta el resultado:
//
//   'sets'    Jerárquico: partido -> sets -> games -> puntos. Sirve para pádel,
//             tenis, ping pong, vóley. La configuración describe las reglas.
//   'puntos'  Marcador corrido: un número por lado (goles, puntos, canastas).
//   'mejorDe' Al mejor de N rondas o manos, sin marcador interno.
//
// Configuración del tipo 'sets':
//   setsParaGanar          Sets que hay que ganar (1 = un solo set, 2 = al mejor de 3...).
//   gamesParaGanarSet      Games (o puntos) necesarios para llevarse el set.
//   diferenciaGames        Diferencia mínima de games para cerrar el set (1 o 2).
//   tiebreakEnEmpate       Games empatados que mandan a tie-break (null = sin tie-break).
//   puntosTiebreak         Puntos del tie-break.
//   diferenciaTiebreak     Diferencia mínima en el tie-break.
//   puntosGame             'clasico' (15/30/40 con ventaja) | 'oro' (punto de oro)
//                          | 'directo' (se cuentan puntos sueltos, como en vóley).
//   ultimoSetSuperTiebreak Si el set decisivo se juega como super tie-break.
//   puntosSuperTiebreak    Puntos de ese super tie-break.
//   etiquetaGame           Cómo se llama la unidad: 'game', 'punto'...
//
// Configuración del tipo 'puntos':
//   etiqueta        Nombre de la unidad ('Goles', 'Puntos').
//   permiteEmpate   Si un partido puede terminar igualado.
//   limite          Marcador que cierra el partido (null = sin límite).

/** Valores por omisión de un sistema tipo 'sets'. */
export const SETS_POR_OMISION = {
  setsParaGanar: 2,
  gamesParaGanarSet: 6,
  diferenciaGames: 2,
  tiebreakEnEmpate: 6,
  puntosTiebreak: 7,
  diferenciaTiebreak: 2,
  puntosGame: 'clasico',
  ultimoSetSuperTiebreak: false,
  puntosSuperTiebreak: 10,
  etiquetaGame: 'game',
};

/** Valores por omisión de un sistema tipo 'puntos'. */
export const PUNTOS_POR_OMISION = {
  etiqueta: 'Puntos',
  permiteEmpate: true,
  limite: null,
};

const sets = (cfg) => ({ ...SETS_POR_OMISION, ...cfg });
const puntos = (cfg) => ({ ...PUNTOS_POR_OMISION, ...cfg });

/**
 * Sistemas de anotación de pádel. Es el deporte con el que arrancamos, así que
 * están todas las variantes habituales de games, tie-break y punto de oro.
 */
const SISTEMAS_PADEL = [
  {
    id: 'padel-3set-6-ventaja',
    nombre: 'Clásico · 3 sets a 6 games (con ventaja)',
    descripcion: 'Al mejor de 3 sets. Set a 6 games con 2 de diferencia y tie-break a 7 en 6-6. Games con ventaja.',
    tipo: 'sets',
    config: sets({}),
  },
  {
    id: 'padel-3set-6-oro',
    nombre: 'Clásico · 3 sets a 6 games (punto de oro)',
    descripcion: 'Igual al clásico, pero en 40-40 se juega un único punto decisivo. Es el formato del circuito profesional.',
    tipo: 'sets',
    config: sets({ puntosGame: 'oro' }),
  },
  {
    id: 'padel-3set-6-super',
    nombre: '3 sets a 6 games con super tie-break decisivo',
    descripcion: 'Dos sets normales a 6 games y, si queda 1-1, el tercer set se reemplaza por un super tie-break a 10.',
    tipo: 'sets',
    config: sets({ ultimoSetSuperTiebreak: true, puntosSuperTiebreak: 10 }),
  },
  {
    id: 'padel-1set-6',
    nombre: 'Set único a 6 games',
    descripcion: 'Un solo set a 6 games con 2 de diferencia y tie-break a 7 en 6-6. Ideal para torneos de un día.',
    tipo: 'sets',
    config: sets({ setsParaGanar: 1 }),
  },
  {
    id: 'padel-5set-6',
    nombre: '5 sets a 6 games',
    descripcion: 'Al mejor de 5 sets. Formato largo: se usa poco, pero queda disponible.',
    tipo: 'sets',
    config: sets({ setsParaGanar: 3 }),
  },
  {
    id: 'padel-3set-5-gana3',
    nombre: '3 sets de 5 games · gana 3 (tie-break en 2-2)',
    descripcion: 'Máximo 5 games por set: el primero que llega a 3 gana, y si quedan 2-2 lo define un tie-break a 7.',
    tipo: 'sets',
    config: sets({ gamesParaGanarSet: 3, diferenciaGames: 1, tiebreakEnEmpate: 2 }),
  },
  {
    id: 'padel-3set-5-gana3-oro',
    nombre: '3 sets de 5 games · gana 3 · punto de oro',
    descripcion: 'La variante corta de 5 games con punto de oro en 40-40. Muy usada cuando la cancha está arrendada por hora.',
    tipo: 'sets',
    config: sets({ gamesParaGanarSet: 3, diferenciaGames: 1, tiebreakEnEmpate: 2, puntosGame: 'oro' }),
  },
  {
    id: 'padel-3set-7-gana4',
    nombre: '3 sets de 7 games · gana 4 (tie-break en 3-3)',
    descripcion: 'Máximo 7 games por set: el primero que llega a 4 gana, y si quedan 3-3 lo define un tie-break a 7.',
    tipo: 'sets',
    config: sets({ gamesParaGanarSet: 4, diferenciaGames: 1, tiebreakEnEmpate: 3 }),
  },
  {
    id: 'padel-3set-7-gana4-oro',
    nombre: '3 sets de 7 games · gana 4 · punto de oro',
    descripcion: 'La variante de 7 games con punto de oro en 40-40.',
    tipo: 'sets',
    config: sets({ gamesParaGanarSet: 4, diferenciaGames: 1, tiebreakEnEmpate: 3, puntosGame: 'oro' }),
  },
  {
    id: 'padel-1set-7-gana4',
    nombre: 'Set único de 7 games · gana 4 (tie-break en 3-3)',
    descripcion: 'Un solo set corto: el primero que llega a 4 games gana y 3-3 se define en tie-break.',
    tipo: 'sets',
    config: sets({ setsParaGanar: 1, gamesParaGanarSet: 4, diferenciaGames: 1, tiebreakEnEmpate: 3 }),
  },
  {
    id: 'padel-3set-4-tb',
    nombre: '3 sets cortos a 4 games (tie-break en 4-4)',
    descripcion: 'Sets a 4 games con 2 de diferencia y tie-break a 7 en 4-4. Formato express con punto de oro.',
    tipo: 'sets',
    config: sets({ gamesParaGanarSet: 4, diferenciaGames: 2, tiebreakEnEmpate: 4, puntosGame: 'oro' }),
  },
  {
    id: 'padel-1set-9',
    nombre: 'Pro set a 9 games (tie-break en 8-8)',
    descripcion: 'Un set largo a 9 games con 2 de diferencia; en 8-8 lo define un tie-break a 7.',
    tipo: 'sets',
    config: sets({ setsParaGanar: 1, gamesParaGanarSet: 9, tiebreakEnEmpate: 8 }),
  },
  {
    id: 'padel-1set-8',
    nombre: 'Pro set a 8 games (tie-break en 7-7)',
    descripcion: 'Un set a 8 games con 2 de diferencia; en 7-7 lo define un tie-break a 7.',
    tipo: 'sets',
    config: sets({ setsParaGanar: 1, gamesParaGanarSet: 8, tiebreakEnEmpate: 7 }),
  },
  {
    id: 'padel-tb-7',
    nombre: 'Tie-break único a 7',
    descripcion: 'Un solo tie-break a 7 puntos con 2 de diferencia. El partido más corto posible.',
    tipo: 'sets',
    config: sets({
      setsParaGanar: 1, gamesParaGanarSet: 1, diferenciaGames: 1, tiebreakEnEmpate: 0,
      puntosTiebreak: 7, ultimoSetSuperTiebreak: true, puntosSuperTiebreak: 7,
    }),
  },
  {
    id: 'padel-super-tb-10',
    nombre: 'Super tie-break único a 10',
    descripcion: 'Un solo tie-break a 10 puntos con 2 de diferencia. Para desempates o fases muy rápidas.',
    tipo: 'sets',
    config: sets({
      setsParaGanar: 1, gamesParaGanarSet: 1, diferenciaGames: 1, tiebreakEnEmpate: 0,
      puntosTiebreak: 10, ultimoSetSuperTiebreak: true, puntosSuperTiebreak: 10,
    }),
  },
  {
    id: 'padel-americano-16',
    nombre: 'Americano · a 16 puntos corridos',
    descripcion: 'Se juegan 16 puntos en total y gana quien sume más. Pensado para americanos donde cada pareja acumula puntos.',
    tipo: 'puntos',
    config: puntos({ etiqueta: 'Puntos', permiteEmpate: true, limite: 16 }),
  },
  {
    id: 'padel-americano-24',
    nombre: 'Americano · a 24 puntos corridos',
    descripcion: 'Igual al anterior pero a 24 puntos, para rondas un poco más largas.',
    tipo: 'puntos',
    config: puntos({ etiqueta: 'Puntos', permiteEmpate: true, limite: 24 }),
  },
  {
    id: 'padel-americano-32',
    nombre: 'Americano · a 32 puntos corridos',
    descripcion: 'Versión larga del americano por puntos.',
    tipo: 'puntos',
    config: puntos({ etiqueta: 'Puntos', permiteEmpate: true, limite: 32 }),
  },
];

/** Deportes y juegos con los que parte la aplicación. */
export const DEPORTES_INICIALES = [
  {
    id: 'dep-padel',
    nombre: 'Pádel',
    icono: '🎾',
    tamanoEquipo: 2,
    sistemas: SISTEMAS_PADEL,
  },
  {
    id: 'dep-tenis',
    nombre: 'Tenis',
    icono: '🎾',
    tamanoEquipo: 1,
    sistemas: [
      {
        id: 'tenis-3set-6-ventaja',
        nombre: '3 sets a 6 games (con ventaja)',
        descripcion: 'Al mejor de 3 sets, tie-break a 7 en 6-6.',
        tipo: 'sets',
        config: sets({}),
      },
      {
        id: 'tenis-3set-super',
        nombre: '3 sets con super tie-break decisivo',
        descripcion: 'Dos sets a 6 games y super tie-break a 10 como tercer set.',
        tipo: 'sets',
        config: sets({ ultimoSetSuperTiebreak: true }),
      },
      {
        id: 'tenis-1set-6',
        nombre: 'Set único a 6 games',
        descripcion: 'Un set a 6 games con tie-break en 6-6.',
        tipo: 'sets',
        config: sets({ setsParaGanar: 1 }),
      },
    ],
  },
  {
    id: 'dep-futbol',
    nombre: 'Fútbol',
    icono: '⚽',
    tamanoEquipo: 11,
    sistemas: [
      {
        id: 'futbol-goles',
        nombre: 'Goles (puede terminar empatado)',
        descripcion: 'Marcador corrido de goles; se admite el empate.',
        tipo: 'puntos',
        config: puntos({ etiqueta: 'Goles', permiteEmpate: true }),
      },
      {
        id: 'futbol-goles-sin-empate',
        nombre: 'Goles con definición a penales',
        descripcion: 'Marcador de goles sin empate: si quedan iguales hay que anotar quién ganó los penales.',
        tipo: 'puntos',
        config: puntos({ etiqueta: 'Goles', permiteEmpate: false }),
      },
    ],
  },
  {
    id: 'dep-basquetbol',
    nombre: 'Básquetbol',
    icono: '🏀',
    tamanoEquipo: 5,
    sistemas: [
      {
        id: 'basquet-puntos',
        nombre: 'Puntos (sin empate)',
        descripcion: 'Marcador corrido de puntos; si hay igualdad se juega prórroga.',
        tipo: 'puntos',
        config: puntos({ etiqueta: 'Puntos', permiteEmpate: false }),
      },
      {
        id: 'basquet-21',
        nombre: 'A 21 puntos (pickup)',
        descripcion: 'Gana el primero que llega a 21 puntos.',
        tipo: 'puntos',
        config: puntos({ etiqueta: 'Puntos', permiteEmpate: false, limite: 21 }),
      },
    ],
  },
  {
    id: 'dep-voleibol',
    nombre: 'Vóleibol',
    icono: '🏐',
    tamanoEquipo: 6,
    sistemas: [
      {
        id: 'voley-5set-25',
        nombre: '5 sets a 25 puntos',
        descripcion: 'Al mejor de 5 sets a 25 puntos con 2 de diferencia.',
        tipo: 'sets',
        config: sets({
          setsParaGanar: 3, gamesParaGanarSet: 25, diferenciaGames: 2,
          tiebreakEnEmpate: null, puntosGame: 'directo', etiquetaGame: 'punto',
        }),
      },
      {
        id: 'voley-3set-25',
        nombre: '3 sets a 25 puntos',
        descripcion: 'Al mejor de 3 sets a 25 puntos con 2 de diferencia.',
        tipo: 'sets',
        config: sets({
          setsParaGanar: 2, gamesParaGanarSet: 25, diferenciaGames: 2,
          tiebreakEnEmpate: null, puntosGame: 'directo', etiquetaGame: 'punto',
        }),
      },
    ],
  },
  {
    id: 'dep-tenis-mesa',
    nombre: 'Tenis de mesa',
    icono: '🏓',
    tamanoEquipo: 1,
    sistemas: [
      {
        id: 'tm-5set-11',
        nombre: '5 sets a 11 puntos',
        descripcion: 'Al mejor de 5 sets a 11 puntos con 2 de diferencia.',
        tipo: 'sets',
        config: sets({
          setsParaGanar: 3, gamesParaGanarSet: 11, diferenciaGames: 2,
          tiebreakEnEmpate: null, puntosGame: 'directo', etiquetaGame: 'punto',
        }),
      },
      {
        id: 'tm-3set-11',
        nombre: '3 sets a 11 puntos',
        descripcion: 'Al mejor de 3 sets a 11 puntos con 2 de diferencia.',
        tipo: 'sets',
        config: sets({
          setsParaGanar: 2, gamesParaGanarSet: 11, diferenciaGames: 2,
          tiebreakEnEmpate: null, puntosGame: 'directo', etiquetaGame: 'punto',
        }),
      },
    ],
  },
  {
    id: 'dep-ajedrez',
    nombre: 'Ajedrez',
    icono: '♟️',
    tamanoEquipo: 1,
    sistemas: [
      {
        id: 'ajedrez-partida',
        nombre: 'Partida única (admite tablas)',
        descripcion: 'Una partida; puede terminar en tablas.',
        tipo: 'puntos',
        config: puntos({ etiqueta: 'Puntos', permiteEmpate: true, limite: 1 }),
      },
      {
        id: 'ajedrez-mejor-3',
        nombre: 'Al mejor de 3 partidas',
        descripcion: 'Gana quien se lleve 2 partidas.',
        tipo: 'mejorDe',
        config: { rondasParaGanar: 2 },
      },
    ],
  },
];

/** Modalidades de torneo disponibles. */
export const MODALIDADES = [
  {
    id: 'eliminacion',
    nombre: 'Eliminación simple',
    icono: '🏆',
    descripcion: 'Llave directa: el que pierde queda fuera. Si los equipos no son potencia de 2, se reparten descansos en la primera ronda.',
    minimoEquipos: 2,
  },
  {
    id: 'roundRobin',
    nombre: 'Todos contra todos',
    icono: '🔁',
    descripcion: 'Cada equipo juega contra todos los demás. Se puede jugar a una o dos vueltas y la tabla define al campeón.',
    minimoEquipos: 2,
  },
  {
    id: 'grupos',
    nombre: 'Fase de grupos + eliminatoria',
    icono: '🗂️',
    descripcion: 'Se arman grupos que juegan todos contra todos y los mejores pasan a una llave de eliminación. Con un solo grupo queda una liga con playoffs: 1º contra 4º y 2º contra 3º.',
    minimoEquipos: 4,
  },
  {
    id: 'americano',
    nombre: 'Americano (parejas rotativas)',
    icono: '🔄',
    descripcion: 'Nadie tiene pareja fija: en cada ronda cambian los compañeros y gana el jugador que más partidos se lleva. Cada uno juega con todos los demás una vez.',
    minimoEquipos: 4,
    individual: true,
  },
  {
    id: 'suizo',
    nombre: 'Sistema suizo',
    icono: '🔀',
    descripcion: 'Cantidad fija de rondas. En cada ronda se enfrentan equipos con puntaje parecido, sin repetir rivales y sin eliminar a nadie.',
    minimoEquipos: 4,
  },
];

/** Campos con los que se puede identificar a un equipo. */
export const CAMPOS_EQUIPO = [
  { clave: 'nombre', etiqueta: 'Nombre', ejemplo: 'Los Tiburones', icono: '🏷️' },
  { clave: 'apodo', etiqueta: 'Nombrete / apodo', ejemplo: 'Los Tibus', icono: '💬' },
  { clave: 'mascota', etiqueta: 'Mascota', ejemplo: 'Tiburón', icono: '🐾' },
  { clave: 'lema', etiqueta: 'Lema', ejemplo: 'Nadamos o nos hundimos', icono: '📣' },
  { clave: 'integrantes', etiqueta: 'Nombres de los integrantes', ejemplo: 'Pepe y Ana', icono: '👥' },
];

/** Paleta sugerida para los colores de equipo. */
export const COLORES_SUGERIDOS = [
  '#e2574c', '#f2a93b', '#f7d154', '#5cb85c', '#2fa3a3', '#3b82c4',
  '#5b5bd6', '#9b59b6', '#e05fa0', '#7a5c3e', '#4a5568', '#1f2430',
];
