// Pruebas de la generación de fixture y de las tablas de posiciones.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ordenSembrado, generarFixture, avanzarFixture, tablaPosiciones,
  tablasPorGrupo, resumenTorneo, siguienteRondaSuiza, ganadorDePartido,
  partidosDeAmericanoCompleto,
} from '../js/fixture.js';
import { DEPORTES_INICIALES } from '../js/catalogo.js';

const padel = DEPORTES_INICIALES.find((d) => d.id === 'dep-padel');
const sistemaSet = padel.sistemas.find((s) => s.id === 'padel-1set-6');

/** Torneo de prueba con `cantidad` equipos. */
function torneoDe(cantidad, modalidad, opciones = {}) {
  return {
    id: 't1',
    nombre: 'Prueba',
    deporteId: 'dep-padel',
    sistemaId: sistemaSet.id,
    tamanoEquipo: 2,
    campoNombre: 'nombre',
    modalidad,
    opciones,
    equipos: Array.from({ length: cantidad }, (_, i) => ({
      id: `e${i + 1}`, nombre: `Equipo ${i + 1}`, integrantes: [], color: '#333',
    })),
    partidos: [],
    estado: 'enCurso',
  };
}

/** Anota un 6-x a favor del lado indicado. */
function anotar(partido, lado, games = 1) {
  partido.resultado = lado === 'A' ? { sets: [{ a: 6, b: games }] } : { sets: [{ a: games, b: 6 }] };
  partido.estado = 'jugado';
}

test('la siembra sigue el orden estándar de llave', () => {
  assert.deepEqual(ordenSembrado(2), [1, 2]);
  assert.deepEqual(ordenSembrado(4), [1, 4, 2, 3]);
  assert.deepEqual(ordenSembrado(8), [1, 8, 4, 5, 2, 7, 3, 6]);
});

test('eliminación con 8 equipos: 7 partidos y el 1 enfrenta al 8', () => {
  const torneo = torneoDe(8, 'eliminacion');
  torneo.partidos = generarFixture(torneo);
  assert.equal(torneo.partidos.length, 7);
  const cuartos = torneo.partidos.filter((p) => p.rotulo === 'Cuartos de final');
  assert.equal(cuartos.length, 4);
  assert.deepEqual([cuartos[0].equipoA, cuartos[0].equipoB], ['e1', 'e8']);
  assert.equal(torneo.partidos.filter((p) => p.rotulo === 'Final').length, 1);
});

test('eliminación con 6 equipos: los dos mejores descansan en la primera ronda', () => {
  const torneo = torneoDe(6, 'eliminacion');
  torneo.partidos = generarFixture(torneo);
  avanzarFixture(torneo, sistemaSet);
  const descansos = torneo.partidos.filter((p) => p.estado === 'descanso');
  assert.equal(descansos.length, 2, 'con 6 equipos en una llave de 8 hay 2 descansos');
  assert.deepEqual(descansos.map((p) => p.equipoA).sort(), ['e1', 'e2']);
  // El que descansa queda puesto en semifinales sin jugar.
  const semis = torneo.partidos.filter((p) => p.rotulo === 'Semifinales');
  assert.ok(semis.some((p) => p.equipoA === 'e1' || p.equipoB === 'e1'));
});

test('eliminación: el ganador avanza y se corona al campeón', () => {
  const torneo = torneoDe(4, 'eliminacion', { tercerPuesto: true });
  torneo.partidos = generarFixture(torneo);
  const semis = torneo.partidos.filter((p) => p.rotulo === 'Semifinales');
  anotar(semis[0], 'A');            // e1 le gana a e4
  anotar(semis[1], 'A');            // e2 le gana a e3
  avanzarFixture(torneo, sistemaSet);

  const final = torneo.partidos.find((p) => p.rotulo === 'Final');
  assert.equal(final.equipoA, 'e1');
  assert.equal(final.equipoB, 'e2');
  const tercero = torneo.partidos.find((p) => p.fase === 'tercerPuesto');
  assert.ok(tercero, 'se generó el partido por el tercer lugar');
  assert.deepEqual([tercero.equipoA, tercero.equipoB].sort(), ['e3', 'e4']);

  anotar(final, 'A');
  anotar(tercero, 'A');
  avanzarFixture(torneo, sistemaSet);
  const resumen = resumenTorneo(torneo, sistemaSet);
  assert.equal(resumen.terminado, true);
  assert.equal(resumen.campeon, 'e1');
  assert.equal(resumen.subcampeon, 'e2');
});

test('todos contra todos: cada equipo juega una vez contra cada rival', () => {
  const torneo = torneoDe(5, 'roundRobin');
  torneo.partidos = generarFixture(torneo);
  assert.equal(torneo.partidos.length, 10, 'con 5 equipos son 10 cruces');
  const cruces = new Set(torneo.partidos.map((p) => [p.equipoA, p.equipoB].sort().join('|')));
  assert.equal(cruces.size, 10, 'no se repite ningún cruce');
  // Cada fecha tiene a lo más un partido por equipo.
  const porRonda = new Map();
  for (const p of torneo.partidos) {
    const lista = porRonda.get(p.ronda) || [];
    lista.push(p.equipoA, p.equipoB);
    porRonda.set(p.ronda, lista);
  }
  for (const [ronda, equipos] of porRonda) {
    assert.equal(new Set(equipos).size, equipos.length, `la fecha ${ronda} repite un equipo`);
  }
});

test('todos contra todos a dos vueltas duplica los partidos', () => {
  const torneo = torneoDe(4, 'roundRobin', { vueltas: 2 });
  torneo.partidos = generarFixture(torneo);
  assert.equal(torneo.partidos.length, 12);
});

test('tabla de posiciones: ordena por puntos y diferencia', () => {
  const torneo = torneoDe(3, 'roundRobin');
  torneo.partidos = generarFixture(torneo);
  // e1 gana sus dos partidos, e2 gana el que le queda.
  for (const partido of torneo.partidos) {
    if (partido.equipoA === 'e1') anotar(partido, 'A', 0);
    else if (partido.equipoB === 'e1') anotar(partido, 'B', 0);
    else if (partido.equipoA === 'e2') anotar(partido, 'A', 4);
    else anotar(partido, 'B', 4);
  }
  const tabla = tablaPosiciones(torneo, sistemaSet);
  assert.deepEqual(tabla.map((f) => f.equipoId), ['e1', 'e2', 'e3']);
  assert.equal(tabla[0].puntos, 6);
  assert.equal(tabla[0].ganados, 2);
  assert.equal(tabla[2].perdidos, 2);
  assert.equal(tabla[0].difMayor, 2, 'ganó 2 sets y no perdió ninguno');
});

test('fase de grupos: reparte en grupos y arma la llave con los clasificados', () => {
  const torneo = torneoDe(8, 'grupos', { cantidadGrupos: 2, clasificanPorGrupo: 2 });
  torneo.partidos = generarFixture(torneo);
  const deGrupos = torneo.partidos.filter((p) => p.fase === 'grupos');
  assert.equal(deGrupos.length, 12, 'dos grupos de 4 son 6 partidos cada uno');
  const llave = torneo.partidos.filter((p) => p.fase === 'llave');
  assert.equal(llave.length, 3, 'semifinales y final');

  // Jugamos toda la fase de grupos: siempre gana el equipo A.
  for (const partido of deGrupos) anotar(partido, 'A');
  avanzarFixture(torneo, sistemaSet);

  const tablas = tablasPorGrupo(torneo, sistemaSet);
  assert.deepEqual(Object.keys(tablas), ['A', 'B']);
  assert.equal(tablas.A.length, 4);
  const semis = torneo.partidos.filter((p) => p.rotulo === 'Semifinales');
  assert.ok(semis.every((p) => p.equipoA && p.equipoB), 'las semifinales quedaron con equipos');
  // El primero de un grupo no puede cruzarse con el primero del otro en semis.
  const primeroA = tablas.A[0].equipoId;
  const primeroB = tablas.B[0].equipoId;
  const juntos = semis.some(
    (p) => [p.equipoA, p.equipoB].includes(primeroA) && [p.equipoA, p.equipoB].includes(primeroB)
  );
  assert.equal(juntos, false, 'los dos primeros van en semifinales distintas');
});

test('sistema suizo: genera rondas sin repetir rivales', () => {
  const torneo = torneoDe(8, 'suizo', { rondas: 3 });
  torneo.partidos = generarFixture(torneo);
  assert.equal(torneo.partidos.length, 4, 'la primera ronda son 4 partidos');

  for (let ronda = 0; ronda < 3; ronda++) {
    const actuales = torneo.partidos.filter((p) => p.ronda === ronda);
    for (const partido of actuales) anotar(partido, 'A');
    const nuevos = siguienteRondaSuiza(torneo, sistemaSet);
    torneo.partidos.push(...nuevos);
  }
  assert.equal(torneo.partidos.length, 12, '3 rondas de 4 partidos');
  const cruces = torneo.partidos.map((p) => [p.equipoA, p.equipoB].sort().join('|'));
  assert.equal(new Set(cruces).size, cruces.length, 'no se repitió ningún cruce');
  assert.equal(siguienteRondaSuiza(torneo, sistemaSet).length, 0, 'no genera más rondas de las pedidas');
});

test('sistema suizo con cantidad impar: alguien descansa y suma puntos', () => {
  const torneo = torneoDe(5, 'suizo', { rondas: 2 });
  torneo.partidos = generarFixture(torneo);
  const descanso = torneo.partidos.find((p) => p.estado === 'descanso');
  assert.ok(descanso, 'hay un partido de descanso');
  assert.equal(descanso.equipoB, null);
  const tabla = tablaPosiciones(torneo, sistemaSet);
  const filaDescanso = tabla.find((f) => f.equipoId === descanso.equipoA);
  assert.equal(filaDescanso.descansos, 1);
  assert.equal(filaDescanso.puntos, 3, 'el descanso suma como una victoria');
});

test('el retiro de un equipo le da el partido al otro', () => {
  const torneo = torneoDe(2, 'eliminacion');
  torneo.partidos = generarFixture(torneo);
  const final = torneo.partidos[0];
  final.resultado = { sets: [], retiro: 'A' };
  final.estado = 'jugado';
  assert.equal(ganadorDePartido(final, sistemaSet), 'e2');
  assert.equal(resumenTorneo(torneo, sistemaSet).campeon, 'e2');
});

test('todos contra todos con final: la final toma al 1º y al 2º de la tabla', () => {
  const torneo = torneoDe(4, 'roundRobin', { playoffFinal: true });
  torneo.partidos = generarFixture(torneo);
  const liga = torneo.partidos.filter((p) => p.fase === 'liga');
  assert.equal(liga.length, 6);
  for (const partido of liga) {
    // Hacemos que e1 gane todo y e2 le gane a los demás.
    if (partido.equipoA === 'e1') anotar(partido, 'A');
    else if (partido.equipoB === 'e1') anotar(partido, 'B');
    else if (partido.equipoA === 'e2') anotar(partido, 'A');
    else if (partido.equipoB === 'e2') anotar(partido, 'B');
    else anotar(partido, 'A');
  }
  avanzarFixture(torneo, sistemaSet);
  const final = torneo.partidos.find((p) => p.rotulo === 'Final');
  assert.equal(final.equipoA, 'e1');
  assert.equal(final.equipoB, 'e2');
});

// ---------------------------------------------------------------- Americano

/** Torneo americano con `cantidad` jugadores (cada "equipo" es una persona). */
function americanoDe(cantidad, opciones = {}) {
  return {
    id: 'ta', nombre: 'Americano', deporteId: 'dep-padel', sistemaId: sistemaSet.id,
    tamanoEquipo: 1, campoNombre: 'nombre', modalidad: 'americano',
    opciones: {
      porLado: 2, emparejamiento: 'companeros',
      puntosVictoria: 1, puntosEmpate: 0, puntosDerrota: 0, puntosDescanso: 0,
      ...opciones,
    },
    equipos: Array.from({ length: cantidad }, (_, i) => ({
      id: `j${i + 1}`, nombre: `Jugador ${i + 1}`, integrantes: [], color: '#333',
    })),
    partidos: [], estado: 'enCurso',
  };
}

test('americano corto con 5 jugadores: 5 rondas, uno descansa y nadie repite compañero', () => {
  const torneo = americanoDe(5);
  torneo.partidos = generarFixture(torneo);

  const rondas = [...new Set(torneo.partidos.map((p) => p.ronda))];
  assert.equal(rondas.length, 5, 'con 5 jugadores salen 5 rondas');

  const jugables = torneo.partidos.filter((p) => p.estado !== 'descanso');
  assert.equal(jugables.length, 5, 'una cancha por ronda');

  // Cada ronda: 4 jugadores en cancha y 1 descansando.
  for (const ronda of rondas) {
    const deLaRonda = torneo.partidos.filter((p) => p.ronda === ronda);
    const partido = deLaRonda.find((p) => p.estado !== 'descanso');
    const descanso = deLaRonda.find((p) => p.estado === 'descanso');
    assert.equal(partido.ladoA.length, 2);
    assert.equal(partido.ladoB.length, 2);
    assert.equal(descanso.ladoA.length, 1, 'descansa exactamente uno');
    const enCancha = [...partido.ladoA, ...partido.ladoB];
    assert.equal(new Set(enCancha).size, 4, 'nadie juega dos veces en la misma ronda');
    assert.ok(!enCancha.includes(descanso.ladoA[0]), 'el que descansa no está en cancha');
  }

  // Las 10 parejas posibles salen una sola vez cada una.
  const parejas = jugables.flatMap((p) => [p.ladoA, p.ladoB]).map((par) => par.slice().sort().join('+'));
  assert.equal(parejas.length, 10);
  assert.equal(new Set(parejas).size, 10, 'nadie repite compañero');

  // Y cada jugador juega 4 veces y descansa 1.
  for (const equipo of torneo.equipos) {
    const juega = jugables.filter((p) => [...p.ladoA, ...p.ladoB].includes(equipo.id)).length;
    assert.equal(juega, 4, `${equipo.nombre} debería jugar 4 partidos`);
  }
});

test('americano: la tabla es individual y gana el que más partidos ganó', () => {
  const torneo = americanoDe(5);
  torneo.partidos = generarFixture(torneo);

  // Gana siempre el lado donde esté el jugador 1; si no juega, gana el lado A.
  for (const partido of torneo.partidos.filter((p) => p.estado !== 'descanso')) {
    const ganaA = partido.ladoA.includes('j1') || !partido.ladoB.includes('j1');
    anotar(partido, ganaA ? 'A' : 'B');
  }

  const tabla = tablaPosiciones(torneo, sistemaSet);
  assert.equal(tabla.length, 5, 'están los 5 jugadores');
  assert.equal(tabla[0].equipoId, 'j1', 'el jugador 1 ganó sus 4 partidos');
  assert.equal(tabla[0].ganados, 4);
  assert.equal(tabla[0].jugados, 4);
  assert.equal(tabla[0].descansos, 1);
  assert.equal(tabla[0].puntos, 4, 'una victoria vale un punto');

  // Los puntos repartidos cuadran: 2 ganadores por partido, 5 partidos.
  const victorias = tabla.reduce((suma, fila) => suma + fila.ganados, 0);
  assert.equal(victorias, 10, 'cada partido deja dos ganadores');

  const resumen = resumenTorneo(torneo, sistemaSet);
  assert.equal(resumen.terminado, true);
  assert.equal(resumen.campeon, 'j1');
});

test('americano corto con 8 jugadores: dos canchas por ronda y nadie descansa', () => {
  const torneo = americanoDe(8);
  torneo.partidos = generarFixture(torneo);
  assert.equal([...new Set(torneo.partidos.map((p) => p.ronda))].length, 7);
  assert.equal(torneo.partidos.filter((p) => p.estado === 'descanso').length, 0);
  for (let ronda = 0; ronda < 7; ronda++) {
    assert.equal(torneo.partidos.filter((p) => p.ronda === ronda).length, 2);
  }
  const parejas = torneo.partidos.flatMap((p) => [p.ladoA, p.ladoB]).map((par) => par.slice().sort().join('+'));
  assert.equal(new Set(parejas).size, 28, 'las 28 parejas posibles, una vez cada una');
});

test('americano corto con 6 jugadores: reparte los descansos entre todos', () => {
  const torneo = americanoDe(6);
  torneo.partidos = generarFixture(torneo);
  const descansos = torneo.partidos.filter((p) => p.estado === 'descanso');
  assert.equal(descansos.length, 5, 'una pareja descansa en cada una de las 5 rondas');
  const veces = new Map();
  for (const partido of descansos) {
    for (const id of partido.ladoA) veces.set(id, (veces.get(id) || 0) + 1);
  }
  assert.equal(veces.size, 6, 'todos descansan alguna vez');
  for (const [, cuantas] of veces) {
    assert.ok(cuantas <= 2, 'nadie descansa más de dos veces');
  }
});

test('americano individual (uno por lado) es un todos contra todos', () => {
  const torneo = americanoDe(5, { porLado: 1 });
  torneo.partidos = generarFixture(torneo);
  const jugables = torneo.partidos.filter((p) => p.estado !== 'descanso');
  assert.equal(jugables.length, 10, 'los 10 cruces posibles');
  assert.ok(jugables.every((p) => p.ladoA.length === 1 && p.ladoB.length === 1));
});

test('americano: se puede cortar en menos rondas de las que da el sorteo', () => {
  const torneo = americanoDe(8, { rondasAmericano: 3 });
  torneo.partidos = generarFixture(torneo);
  assert.equal([...new Set(torneo.partidos.map((p) => p.ronda))].length, 3);
  assert.equal(torneo.partidos.length, 6);
});

// ------------------------------- Americano con todas las combinaciones

test('americano completo con 5 jugadores: cada pareja enfrenta a las 3 posibles', () => {
  const torneo = americanoDe(5, { emparejamiento: 'completo' });
  torneo.partidos = generarFixture(torneo);

  const jugables = torneo.partidos.filter((p) => p.estado !== 'descanso');
  assert.equal(jugables.length, 15, 'con 5 jugadores son 15 partidos');
  assert.equal(partidosDeAmericanoCompleto(5), 15);

  // Lo que pidió el usuario: la pareja AB juega contra CD, CE y DE.
  const clave = (pareja) => pareja.slice().sort().join('+');
  const rivalesDe = new Map();
  for (const partido of jugables) {
    const a = clave(partido.ladoA);
    const b = clave(partido.ladoB);
    if (!rivalesDe.has(a)) rivalesDe.set(a, new Set());
    if (!rivalesDe.has(b)) rivalesDe.set(b, new Set());
    rivalesDe.get(a).add(b);
    rivalesDe.get(b).add(a);
  }
  assert.equal(rivalesDe.size, 10, 'aparecen las 10 parejas posibles');
  for (const [pareja, rivales] of rivalesDe) {
    assert.equal(rivales.size, 3, `${pareja} debería enfrentar a 3 parejas`);
  }
  assert.deepEqual(
    [...rivalesDe.get('j1+j2')].sort(),
    ['j3+j4', 'j3+j5', 'j4+j5'],
    'j1+j2 enfrenta a las tres parejas que salen de j3, j4 y j5'
  );

  // Ningún enfrentamiento se repite.
  const enfrentamientos = jugables.map((p) => [clave(p.ladoA), clave(p.ladoB)].sort().join(' vs '));
  assert.equal(new Set(enfrentamientos).size, 15, 'no se repite ningún cruce');
});

test('americano completo: todos juegan y descansan lo mismo', () => {
  const torneo = americanoDe(5, { emparejamiento: 'completo' });
  torneo.partidos = generarFixture(torneo);
  const jugables = torneo.partidos.filter((p) => p.estado !== 'descanso');

  for (const equipo of torneo.equipos) {
    const juega = jugables.filter((p) => [...p.ladoA, ...p.ladoB].includes(equipo.id)).length;
    assert.equal(juega, 12, `${equipo.nombre} juega 12 de los 15 partidos`);
  }
  // En los 3 partidos que no juega, aparece como descanso.
  const descansos = torneo.partidos.filter((p) => p.estado === 'descanso');
  assert.equal(descansos.length, 15);
  const veces = new Map();
  for (const partido of descansos) {
    for (const id of partido.ladoA) veces.set(id, (veces.get(id) || 0) + 1);
  }
  for (const [, cuantas] of veces) assert.equal(cuantas, 3, 'cada uno descansa 3 veces');
});

test('americano completo con 4 jugadores: las 3 combinaciones posibles', () => {
  const torneo = americanoDe(4, { emparejamiento: 'completo' });
  torneo.partidos = generarFixture(torneo);
  assert.equal(torneo.partidos.length, 3, 'con 4 jugadores solo hay 3 partidos');
  assert.equal(torneo.partidos.filter((p) => p.estado === 'descanso').length, 0);
  const clave = (p) => [p.ladoA.slice().sort().join('+'), p.ladoB.slice().sort().join('+')].sort().join(' vs ');
  assert.deepEqual(
    torneo.partidos.map(clave).sort(),
    ['j1+j2 vs j3+j4', 'j1+j3 vs j2+j4', 'j1+j4 vs j2+j3']
  );
});

test('americano completo: nadie juega dos veces en la misma ronda', () => {
  for (const cantidad of [5, 6, 7]) {
    const torneo = americanoDe(cantidad, { emparejamiento: 'completo' });
    torneo.partidos = generarFixture(torneo);
    const rondas = [...new Set(torneo.partidos.map((p) => p.ronda))];
    for (const ronda of rondas) {
      const deLaRonda = torneo.partidos.filter((p) => p.ronda === ronda && p.estado !== 'descanso');
      const enCancha = deLaRonda.flatMap((p) => [...p.ladoA, ...p.ladoB]);
      assert.equal(new Set(enCancha).size, enCancha.length,
        `con ${cantidad} jugadores alguien se repite en la ronda ${ronda + 1}`);
    }
  }
});

test('americano completo: se puede cortar en menos rondas', () => {
  const torneo = americanoDe(5, { emparejamiento: 'completo', rondasAmericano: 6 });
  torneo.partidos = generarFixture(torneo);
  assert.equal([...new Set(torneo.partidos.map((p) => p.ronda))].length, 6);
  assert.equal(torneo.partidos.filter((p) => p.estado !== 'descanso').length, 6);
});

// ------------------------------- Un solo grupo: liga con playoffs

test('un grupo con 6 equipos: todos contra todos y semis 1-4 y 2-3', () => {
  const torneo = torneoDe(6, 'grupos', {
    cantidadGrupos: 1, clasificanPorGrupo: 4, tercerPuesto: true, vueltas: 1,
    puntosVictoria: 3, puntosEmpate: 1, puntosDerrota: 0,
  });
  torneo.partidos = generarFixture(torneo);

  const fase = torneo.partidos.filter((p) => p.fase === 'grupos');
  assert.equal(fase.length, 15, 'con 6 equipos son 15 cruces');
  assert.equal(new Set(fase.map((p) => p.grupo)).size, 1, 'hay un solo grupo');
  assert.ok(fase.every((p) => p.rotulo.startsWith('Fecha')), 'no dice "Grupo A": es una liga');

  // Jugamos todo de forma que la tabla quede ordenada e1 > e2 > ... > e6.
  for (const partido of fase) {
    const iA = Number(partido.equipoA.slice(1));
    const iB = Number(partido.equipoB.slice(1));
    anotar(partido, iA < iB ? 'A' : 'B');
  }
  avanzarFixture(torneo, sistemaSet);

  const tabla = tablasPorGrupo(torneo, sistemaSet).A;
  assert.deepEqual(tabla.slice(0, 4).map((f) => f.equipoId), ['e1', 'e2', 'e3', 'e4']);

  // Lo que pidió el usuario: 1º contra 4º y 2º contra 3º.
  const semis = torneo.partidos.filter((p) => p.rotulo === 'Semifinales');
  assert.equal(semis.length, 2);
  const cruces = semis.map((p) => [p.equipoA, p.equipoB].join(' vs '));
  assert.ok(cruces.includes('e1 vs e4'), `esperaba 1º vs 4º, salió ${cruces}`);
  assert.ok(cruces.includes('e2 vs e3'), `esperaba 2º vs 3º, salió ${cruces}`);

  // Y el torneo se puede terminar.
  for (const partido of semis) anotar(partido, 'A');
  avanzarFixture(torneo, sistemaSet);
  const final = torneo.partidos.find((p) => p.rotulo === 'Final');
  assert.deepEqual([final.equipoA, final.equipoB], ['e1', 'e2']);
  const tercero = torneo.partidos.find((p) => p.fase === 'tercerPuesto');
  assert.deepEqual([tercero.equipoA, tercero.equipoB].sort(), ['e3', 'e4']);
});

test('un grupo a ida y vuelta duplica los partidos de la fase', () => {
  const torneo = torneoDe(6, 'grupos', { cantidadGrupos: 1, clasificanPorGrupo: 4, vueltas: 2 });
  torneo.partidos = generarFixture(torneo);
  assert.equal(torneo.partidos.filter((p) => p.fase === 'grupos').length, 30);
});

test('un grupo con 2 clasificados va directo a la final', () => {
  const torneo = torneoDe(5, 'grupos', { cantidadGrupos: 1, clasificanPorGrupo: 2 });
  torneo.partidos = generarFixture(torneo);
  const llave = torneo.partidos.filter((p) => p.fase === 'llave');
  assert.equal(llave.length, 1);
  assert.equal(llave[0].rotulo, 'Final');
});

test('con varios grupos se sigue rotulando cada grupo', () => {
  const torneo = torneoDe(8, 'grupos', { cantidadGrupos: 2, clasificanPorGrupo: 2 });
  torneo.partidos = generarFixture(torneo);
  const fase = torneo.partidos.filter((p) => p.fase === 'grupos');
  assert.ok(fase.some((p) => p.rotulo.startsWith('Grupo A')));
  assert.ok(fase.some((p) => p.rotulo.startsWith('Grupo B')));
});
