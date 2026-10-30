// Generación del calendario de partidos y cálculo de tablas de posiciones.
//
// Un partido se ve así:
//   {
//     id, fase, ronda, rotulo, grupo, orden,
//     equipoA, equipoB,            ids de equipo, o null si todavía no se sabe
//     origenA, origenB,            de dónde sale cada lado en una llave
//     destinoGanador, destinoPerdedor,
//     resultado, estado            'pendiente' | 'jugado' | 'descanso'
//   }

import { id as nuevoId, mezclar, potenciaDeDos, repartirSerpentina } from './util.js';
import { ganadorAnotado, desglose } from './anotacion.js';

// ----------------------------------------------------------------------------
// Herramientas de llave
// ----------------------------------------------------------------------------

/** Orden de siembra estándar de una llave: para 8 da 1-8, 4-5, 2-7, 3-6. */
export function ordenSembrado(tamano) {
  let orden = [1];
  while (orden.length < tamano) {
    const total = orden.length * 2;
    const siguiente = [];
    for (const posicion of orden) {
      siguiente.push(posicion, total + 1 - posicion);
    }
    orden = siguiente;
  }
  return orden;
}

/** Nombre de la ronda según cuántos partidos tiene. */
export function rotuloRonda(partidosEnRonda) {
  if (partidosEnRonda === 1) return 'Final';
  if (partidosEnRonda === 2) return 'Semifinales';
  if (partidosEnRonda === 4) return 'Cuartos de final';
  if (partidosEnRonda === 8) return 'Octavos de final';
  if (partidosEnRonda === 16) return 'Dieciseisavos';
  return `Ronda de ${partidosEnRonda * 2}`;
}

function partidoBase(extra) {
  return {
    id: nuevoId('par'),
    fase: 'llave',
    ronda: 0,
    rotulo: '',
    grupo: null,
    orden: 0,
    equipoA: null,
    equipoB: null,
    origenA: null,
    origenB: null,
    destinoGanador: null,
    destinoPerdedor: null,
    resultado: null,
    estado: 'pendiente',
    cancha: '',
    fecha: '',
    ...extra,
  };
}

// ----------------------------------------------------------------------------
// Eliminación simple
// ----------------------------------------------------------------------------

/**
 * Arma una llave de eliminación directa. `entradas` es una lista de
 * { equipoId } u { origen } en orden de siembra (del mejor al peor).
 */
function construirLlave(entradas, { tercerPuesto = false, faseInicial = 0, prefijo = '' } = {}) {
  const tamano = potenciaDeDos(Math.max(entradas.length, 2));
  const orden = ordenSembrado(tamano);
  // Las posiciones que sobran quedan vacías: son los descansos de la primera ronda.
  const ranuras = orden.map((posicion) => entradas[posicion - 1] ?? null);

  const partidos = [];
  let rondaActual = [];
  for (let i = 0; i < ranuras.length; i += 2) {
    const partido = partidoBase({
      fase: 'llave',
      ronda: faseInicial,
      orden: i / 2,
      rotulo: prefijo + rotuloRonda(ranuras.length / 2),
    });
    asignarEntrada(partido, 'A', ranuras[i]);
    asignarEntrada(partido, 'B', ranuras[i + 1]);
    partidos.push(partido);
    rondaActual.push(partido);
  }

  let ronda = faseInicial + 1;
  while (rondaActual.length > 1) {
    const siguiente = [];
    for (let i = 0; i < rondaActual.length; i += 2) {
      const partido = partidoBase({
        fase: 'llave',
        ronda,
        orden: i / 2,
        rotulo: prefijo + rotuloRonda(rondaActual.length / 2),
      });
      rondaActual[i].destinoGanador = { partidoId: partido.id, lado: 'A' };
      rondaActual[i + 1].destinoGanador = { partidoId: partido.id, lado: 'B' };
      partido.origenA = { partidoId: rondaActual[i].id, tipo: 'ganador' };
      partido.origenB = { partidoId: rondaActual[i + 1].id, tipo: 'ganador' };
      partidos.push(partido);
      siguiente.push(partido);
    }
    rondaActual = siguiente;
    ronda++;
  }

  // El partido por el tercer lugar junta a los perdedores de las semifinales.
  if (tercerPuesto) {
    const semis = partidos.filter((p) => p.rotulo === prefijo + 'Semifinales');
    if (semis.length === 2) {
      const partido = partidoBase({
        fase: 'tercerPuesto',
        ronda: ronda - 1,
        orden: 1,
        rotulo: 'Tercer lugar',
      });
      semis[0].destinoPerdedor = { partidoId: partido.id, lado: 'A' };
      semis[1].destinoPerdedor = { partidoId: partido.id, lado: 'B' };
      partido.origenA = { partidoId: semis[0].id, tipo: 'perdedor' };
      partido.origenB = { partidoId: semis[1].id, tipo: 'perdedor' };
      partidos.push(partido);
    }
  }

  return partidos;
}

function asignarEntrada(partido, lado, entrada) {
  if (!entrada) return;
  if (entrada.equipoId) partido[`equipo${lado}`] = entrada.equipoId;
  else if (entrada.origen) partido[`origen${lado}`] = entrada.origen;
}

// ----------------------------------------------------------------------------
// Todos contra todos
// ----------------------------------------------------------------------------

/**
 * Jornadas de todos contra todos con el método del círculo: cada equipo juega
 * una vez por jornada. Con cantidad impar, uno descansa cada jornada.
 */
function jornadasRoundRobin(ids) {
  const lista = ids.slice();
  if (lista.length % 2 === 1) lista.push(null); // el null es el que descansa
  const total = lista.length;
  const jornadas = [];
  for (let j = 0; j < total - 1; j++) {
    const cruces = [];
    for (let i = 0; i < total / 2; i++) {
      const local = lista[i];
      const visita = lista[total - 1 - i];
      if (local && visita) {
        // Alternamos la localía para repartir el primer saque / la primera mención.
        cruces.push(j % 2 === 0 ? [local, visita] : [visita, local]);
      }
    }
    jornadas.push(cruces);
    // Rotación: el primero queda fijo y los demás giran.
    lista.splice(1, 0, lista.pop());
  }
  return jornadas;
}

function partidosRoundRobin(ids, { vueltas = 1, fase = 'liga', grupo = null, rondaInicial = 0 } = {}) {
  const partidos = [];
  let ronda = rondaInicial;
  for (let vuelta = 0; vuelta < vueltas; vuelta++) {
    for (const cruces of jornadasRoundRobin(ids)) {
      let orden = 0;
      for (const [local, visita] of cruces) {
        const [a, b] = vuelta % 2 === 0 ? [local, visita] : [visita, local];
        partidos.push(partidoBase({
          fase,
          grupo,
          ronda,
          orden: orden++,
          rotulo: grupo
            ? `Grupo ${grupo} · Fecha ${ronda - rondaInicial + 1}`
            : `Fecha ${ronda - rondaInicial + 1}`,
          equipoA: a,
          equipoB: b,
        }));
      }
      ronda++;
    }
  }
  return partidos;
}

// ----------------------------------------------------------------------------
// Generación según modalidad
// ----------------------------------------------------------------------------

/**
 * Genera todos los partidos de un torneo. Para el sistema suizo solo crea la
 * primera ronda: las siguientes se arman al cerrar la anterior.
 */
export function generarFixture(torneo) {
  const opciones = torneo.opciones || {};
  const equipos = torneo.equipos.slice();
  const ids = opciones.sembrado === 'azar'
    ? mezclar(equipos).map((e) => e.id)
    : equipos.map((e) => e.id);

  if (torneo.modalidad === 'eliminacion') {
    return construirLlave(ids.map((equipoId) => ({ equipoId })), {
      tercerPuesto: Boolean(opciones.tercerPuesto),
    });
  }

  if (torneo.modalidad === 'roundRobin') {
    const partidos = partidosRoundRobin(ids, { vueltas: opciones.vueltas || 1, fase: 'liga' });
    if (opciones.playoffFinal) {
      const ultimaRonda = Math.max(...partidos.map((p) => p.ronda)) + 1;
      const final = partidoBase({
        fase: 'llave',
        ronda: ultimaRonda,
        rotulo: 'Final',
        origenA: { tipo: 'posicionTabla', posicion: 1 },
        origenB: { tipo: 'posicionTabla', posicion: 2 },
      });
      partidos.push(final);
    }
    return partidos;
  }

  if (torneo.modalidad === 'grupos') {
    const cantidadGrupos = Math.max(2, Number(opciones.cantidadGrupos) || 2);
    const clasificanPorGrupo = Math.max(1, Number(opciones.clasificanPorGrupo) || 2);
    const grupos = repartirSerpentina(ids, cantidadGrupos);
    const letras = grupos.map((_, i) => String.fromCharCode(65 + i));

    const partidos = [];
    grupos.forEach((grupo, indice) => {
      partidos.push(...partidosRoundRobin(grupo, {
        vueltas: opciones.vueltas || 1,
        fase: 'grupos',
        grupo: letras[indice],
        rondaInicial: 0,
      }));
    });

    // Entradas de la llave: 1º del A contra 2º del B, etc.
    const entradas = [];
    for (let posicion = 1; posicion <= clasificanPorGrupo; posicion++) {
      const letrasOrdenadas = posicion % 2 === 1 ? letras : letras.slice().reverse();
      for (const letra of letrasOrdenadas) {
        entradas.push({ origen: { tipo: 'posicionGrupo', grupo: letra, posicion } });
      }
    }

    const rondaLlave = Math.max(0, ...partidos.map((p) => p.ronda)) + 1;
    partidos.push(...construirLlave(entradas, {
      tercerPuesto: Boolean(opciones.tercerPuesto),
      faseInicial: rondaLlave,
    }));
    return partidos;
  }

  if (torneo.modalidad === 'suizo') {
    return rondaSuiza(torneo, ids, 0);
  }

  if (torneo.modalidad === 'americano') {
    // 'completo' = todas las combinaciones de parejas; 'companeros' = cada uno
    // juega una vez con cada compañero.
    const porLado = Math.max(1, Number(torneo.opciones?.porLado) || 2);
    const emparejamiento = torneo.opciones?.emparejamiento || 'completo';
    return emparejamiento === 'completo' && porLado === 2
      ? fixtureAmericanoCompleto(torneo, ids)
      : fixtureAmericano(torneo, ids);
  }

  return [];
}

/** Empareja una ronda del sistema suizo. */
function rondaSuiza(torneo, idsOrdenados, numeroRonda) {
  const yaJugaron = new Set();
  for (const partido of torneo.partidos || []) {
    if (partido.equipoA && partido.equipoB) {
      yaJugaron.add([partido.equipoA, partido.equipoB].sort().join('|'));
    }
  }

  const disponibles = idsOrdenados.slice();
  const cruces = [];
  while (disponibles.length > 1) {
    const local = disponibles.shift();
    // Buscamos el rival mejor ubicado con el que todavía no haya jugado.
    let indice = disponibles.findIndex(
      (rival) => !yaJugaron.has([local, rival].sort().join('|'))
    );
    if (indice === -1) indice = 0; // si no queda nadie nuevo, repetimos rival
    const visita = disponibles.splice(indice, 1)[0];
    cruces.push([local, visita]);
  }
  const descansa = disponibles[0] ?? null;

  const partidos = cruces.map(([a, b], orden) => partidoBase({
    fase: 'suizo',
    ronda: numeroRonda,
    orden,
    rotulo: `Ronda ${numeroRonda + 1}`,
    equipoA: a,
    equipoB: b,
  }));

  if (descansa) {
    partidos.push(partidoBase({
      fase: 'suizo',
      ronda: numeroRonda,
      orden: partidos.length,
      rotulo: `Ronda ${numeroRonda + 1}`,
      equipoA: descansa,
      equipoB: null,
      estado: 'descanso',
    }));
  }
  return partidos;
}

/**
 * Agrega la siguiente ronda suiza si corresponde. Devuelve los partidos nuevos.
 */
export function siguienteRondaSuiza(torneo, sistema) {
  const rondas = Math.max(1, Number(torneo.opciones?.rondas) || 3);
  const rondaActual = Math.max(-1, ...(torneo.partidos || []).map((p) => p.ronda));
  if (rondaActual + 1 >= rondas) return [];

  const pendientes = (torneo.partidos || []).filter(
    (p) => p.ronda === rondaActual && p.estado === 'pendiente'
  );
  if (pendientes.length) return [];

  const tabla = tablaPosiciones(torneo, sistema);
  const ids = tabla.map((fila) => fila.equipoId);
  return rondaSuiza(torneo, ids, rondaActual + 1);
}

// ----------------------------------------------------------------------------
// Americano con rotación
// ----------------------------------------------------------------------------

/**
 * Los participantes de cada lado de un partido.
 *
 * En las modalidades por equipos cada lado es un solo equipo (`equipoA`), y en
 * el americano cada lado es una pareja que cambia ronda a ronda (`ladoA`).
 */
export function ladosDe(partido) {
  return {
    a: partido.ladoA ?? (partido.equipoA ? [partido.equipoA] : []),
    b: partido.ladoB ?? (partido.equipoB ? [partido.equipoB] : []),
  };
}

/** Todas las formas de elegir `tamano` elementos de una lista, sin repetir. */
function combinaciones(lista, tamano) {
  if (tamano === 0) return [[]];
  if (lista.length < tamano) return [];
  const [primero, ...resto] = lista;
  return [
    ...combinaciones(resto, tamano - 1).map((c) => [primero, ...c]),
    ...combinaciones(resto, tamano),
  ];
}

/**
 * Todos los enfrentamientos posibles entre parejas: se eligen 4 jugadores y se
 * los reparte en dos parejas de las tres maneras que hay.
 *
 * Con 5 jugadores salen 15 partidos y cada pareja enfrenta a las tres parejas
 * que se pueden armar con los otros tres (AB juega contra CD, CE y DE).
 */
function todosLosCruces(ids) {
  const cruces = [];
  for (const [p, q, r, s] of combinaciones(ids, 4)) {
    cruces.push([[p, q], [r, s]]);
    cruces.push([[p, r], [q, s]]);
    cruces.push([[p, s], [q, r]]);
  }
  return cruces;
}

/** Cuántos partidos salen de jugar todas las combinaciones de parejas. */
export function partidosDeAmericanoCompleto(cantidad) {
  if (cantidad < 4) return 0;
  const n = cantidad;
  const combinacionesDe4 = (n * (n - 1) * (n - 2) * (n - 3)) / 24;
  return combinacionesDe4 * 3;
}

/**
 * Americano jugando todas las combinaciones de parejas.
 *
 * Se ordenan los partidos de manera que siempre entre a la cancha quien menos
 * ha jugado, y después se agrupan en rondas donde nadie se repite (con muchos
 * jugadores eso permite varias canchas a la vez).
 */
function fixtureAmericanoCompleto(torneo, ids) {
  const tope = Number(torneo.opciones?.rondasAmericano) || 0;
  const pendientes = todosLosCruces(ids);
  const jugados = new Map(ids.map((id) => [id, 0]));
  const ultimaVezDeLaPareja = new Map();
  const clave = (pareja) => pareja.slice().sort().join('+');
  const ordenados = [];

  // En cada turno entra el partido donde juegan los que menos han jugado; si
  // hay varios iguales, gana el que repite parejas menos recientes.
  while (pendientes.length) {
    let elegido = 0;
    let mejorPuntaje = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const cruce = pendientes[i];
      const carga = cruce.flat().reduce((suma, id) => suma + jugados.get(id), 0);
      const reciente = Math.max(
        ultimaVezDeLaPareja.get(clave(cruce[0])) ?? -1,
        ultimaVezDeLaPareja.get(clave(cruce[1])) ?? -1
      );
      const puntaje = carga * 10000 + reciente;
      if (puntaje < mejorPuntaje) { mejorPuntaje = puntaje; elegido = i; }
    }
    const cruce = pendientes.splice(elegido, 1)[0];
    for (const id of cruce.flat()) jugados.set(id, jugados.get(id) + 1);
    ultimaVezDeLaPareja.set(clave(cruce[0]), ordenados.length);
    ultimaVezDeLaPareja.set(clave(cruce[1]), ordenados.length);
    ordenados.push(cruce);
  }

  // Agrupamos en rondas: un partido entra en la ronda actual si ninguno de sus
  // jugadores está ya en ella.
  const rondas = [];
  let actual = { cruces: [], ocupados: new Set() };
  for (const cruce of ordenados) {
    const enCancha = cruce.flat();
    if (enCancha.some((id) => actual.ocupados.has(id))) {
      rondas.push(actual);
      actual = { cruces: [], ocupados: new Set() };
    }
    actual.cruces.push(cruce);
    for (const id of enCancha) actual.ocupados.add(id);
  }
  if (actual.cruces.length) rondas.push(actual);

  const partidos = [];
  rondas.slice(0, tope || rondas.length).forEach((ronda, numeroRonda) => {
    const rotulo = `Ronda ${numeroRonda + 1}`;
    ronda.cruces.forEach(([ladoA, ladoB], orden) => {
      partidos.push(partidoBase({
        fase: 'americano', ronda: numeroRonda, orden, rotulo, ladoA, ladoB,
      }));
    });
    const descansan = ids.filter((id) => !ronda.ocupados.has(id));
    if (descansan.length) {
      partidos.push(partidoBase({
        fase: 'americano', ronda: numeroRonda, orden: 99, rotulo,
        ladoA: descansan, ladoB: [], estado: 'descanso',
      }));
    }
  });

  return partidos;
}

/**
 * Americano corto: nadie tiene pareja fija y cada jugador juega junto con cada
 * uno de los demás exactamente una vez.
 *
 * Las parejas salen del mismo método del círculo que el todos contra todos, así
 * que con 5 jugadores salen 5 rondas y las 10 parejas posibles.
 */
function fixtureAmericano(torneo, ids) {
  const porLado = Math.max(1, Number(torneo.opciones?.porLado) || 2);
  const tope = Number(torneo.opciones?.rondasAmericano) || 0; // 0 = todas
  const partidos = [];

  // Cuántas veces descansó cada uno, para ir repartiendo parejo.
  const descansosPrevios = new Map(ids.map((id) => [id, 0]));

  let numeroRonda = 0;
  for (const cruces of jornadasRoundRobin(ids)) {
    if (tope && numeroRonda >= tope) break;
    const rotulo = `Ronda ${numeroRonda + 1}`;
    const jugando = new Set();

    if (porLado === 1) {
      // Individual: cada cruce del círculo es un partido.
      cruces.forEach(([a, b], orden) => {
        partidos.push(partidoBase({
          fase: 'americano', ronda: numeroRonda, orden, rotulo,
          ladoA: [a], ladoB: [b], equipoA: a, equipoB: b,
        }));
        jugando.add(a); jugando.add(b);
      });
    } else {
      // Por parejas: cada cruce del círculo es una pareja, y las parejas se
      // enfrentan de a dos. Si sobra una, descansa la que menos ha descansado.
      const parejas = cruces.slice();
      if (parejas.length % 2 === 1) {
        const acumulado = (pareja) => pareja.reduce((suma, id) => suma + (descansosPrevios.get(id) || 0), 0);
        let elegida = 0;
        for (let i = 1; i < parejas.length; i++) {
          if (acumulado(parejas[i]) < acumulado(parejas[elegida])) elegida = i;
        }
        for (const jugador of parejas[elegida]) {
          descansosPrevios.set(jugador, (descansosPrevios.get(jugador) || 0) + 1);
        }
        parejas.splice(elegida, 1);
      }
      let orden = 0;
      for (let i = 0; i + 1 < parejas.length; i += 2) {
        const ladoA = parejas[i];
        const ladoB = parejas[i + 1];
        partidos.push(partidoBase({
          fase: 'americano', ronda: numeroRonda, orden: orden++, rotulo,
          ladoA, ladoB,
        }));
        for (const jugador of [...ladoA, ...ladoB]) jugando.add(jugador);
      }
    }

    const descansan = ids.filter((id) => !jugando.has(id));
    // Con cantidad impar hay alguien que el círculo deja fuera: también descansa.
    for (const jugador of descansan) {
      if (porLado === 1 || !descansosPrevios.has(jugador)) continue;
      if (!cruces.some((par) => par.includes(jugador))) {
        descansosPrevios.set(jugador, (descansosPrevios.get(jugador) || 0) + 1);
      }
    }
    if (descansan.length) {
      partidos.push(partidoBase({
        fase: 'americano', ronda: numeroRonda, orden: 99, rotulo,
        ladoA: descansan, ladoB: [], estado: 'descanso',
      }));
    }
    numeroRonda++;
  }

  return partidos;
}

/** Cuántas rondas tiene un americano con esta cantidad de jugadores. */
export function rondasDeAmericano(cantidad) {
  return cantidad % 2 === 0 ? cantidad - 1 : cantidad;
}

// ----------------------------------------------------------------------------
// Avance de la llave
// ----------------------------------------------------------------------------

/**
 * Propaga los resultados: pasa ganadores y perdedores a los partidos que
 * dependen de ellos, resuelve descansos y clasificados de grupos.
 * Modifica `torneo.partidos` y devuelve true si hubo cambios.
 */
export function avanzarFixture(torneo, sistema) {
  let cambios = false;
  const porId = new Map(torneo.partidos.map((p) => [p.id, p]));

  // 1. Descansos: un partido con un solo equipo lo pasa directo.
  for (const partido of torneo.partidos) {
    if (partido.fase === 'americano') continue; // ahí los descansos vienen marcados
    const soloUno = (partido.equipoA && !partido.equipoB && !partido.origenB)
      || (!partido.equipoA && partido.equipoB && !partido.origenA);
    if (soloUno && partido.estado !== 'descanso') {
      partido.estado = 'descanso';
      partido.resultado = null;
      cambios = true;
    }
  }

  // 2. Clasificados de la fase de grupos.
  const tablas = torneo.modalidad === 'grupos' ? tablasPorGrupo(torneo, sistema) : null;
  if (tablas) {
    const gruposCerrados = new Set();
    for (const [letra] of Object.entries(tablas)) {
      const faltan = torneo.partidos.some(
        (p) => p.fase === 'grupos' && p.grupo === letra && p.estado === 'pendiente'
      );
      if (!faltan) gruposCerrados.add(letra);
    }
    for (const partido of torneo.partidos) {
      for (const lado of ['A', 'B']) {
        const origen = partido[`origen${lado}`];
        if (origen?.tipo === 'posicionGrupo' && !partido[`equipo${lado}`]) {
          if (!gruposCerrados.has(origen.grupo)) continue;
          const fila = tablas[origen.grupo]?.[origen.posicion - 1];
          if (fila) {
            partido[`equipo${lado}`] = fila.equipoId;
            cambios = true;
          }
        }
      }
    }
  }

  // 3. Clasificados por tabla general (playoff final del todos contra todos).
  const hayOrigenTabla = torneo.partidos.some(
    (p) => p.origenA?.tipo === 'posicionTabla' || p.origenB?.tipo === 'posicionTabla'
  );
  if (hayOrigenTabla) {
    const ligaCerrada = !torneo.partidos.some((p) => p.fase === 'liga' && p.estado === 'pendiente');
    if (ligaCerrada) {
      const tabla = tablaPosiciones(torneo, sistema, (p) => p.fase === 'liga');
      for (const partido of torneo.partidos) {
        for (const lado of ['A', 'B']) {
          const origen = partido[`origen${lado}`];
          if (origen?.tipo === 'posicionTabla' && !partido[`equipo${lado}`]) {
            const fila = tabla[origen.posicion - 1];
            if (fila) {
              partido[`equipo${lado}`] = fila.equipoId;
              cambios = true;
            }
          }
        }
      }
    }
  }

  // 4. Ganadores y perdedores de la llave (repetimos hasta que no haya más cambios).
  let seguir = true;
  while (seguir) {
    seguir = false;
    for (const partido of torneo.partidos) {
      const ganador = ganadorDePartido(partido, sistema);
      if (!ganador) continue;
      const perdedor = ganador === partido.equipoA ? partido.equipoB : partido.equipoA;

      if (partido.destinoGanador) {
        const destino = porId.get(partido.destinoGanador.partidoId);
        const campo = `equipo${partido.destinoGanador.lado}`;
        if (destino && destino[campo] !== ganador) {
          destino[campo] = ganador;
          seguir = true;
          cambios = true;
        }
      }
      if (partido.destinoPerdedor && perdedor) {
        const destino = porId.get(partido.destinoPerdedor.partidoId);
        const campo = `equipo${partido.destinoPerdedor.lado}`;
        if (destino && destino[campo] !== perdedor) {
          destino[campo] = perdedor;
          seguir = true;
          cambios = true;
        }
      }
    }
  }

  return cambios;
}

/** Qué lado ganó el partido: 'A', 'B' o null si todavía no se sabe. */
export function ganadorLado(partido, sistema) {
  if (!partido.resultado) return null;
  return ganadorAnotado(sistema, partido.resultado);
}

/** Id del equipo ganador de un partido, o null si todavía no está definido. */
export function ganadorDePartido(partido, sistema) {
  if (partido.estado === 'descanso') return partido.equipoA || partido.equipoB || null;
  const lado = ganadorLado(partido, sistema);
  if (!lado) return null;
  return lado === 'A' ? partido.equipoA : partido.equipoB;
}

// ----------------------------------------------------------------------------
// Tabla de posiciones
// ----------------------------------------------------------------------------

/** Puntos por resultado; se pueden ajustar en las opciones del torneo. */
function puntajes(torneo) {
  const o = torneo.opciones || {};
  return {
    victoria: Number(o.puntosVictoria ?? 3),
    empate: Number(o.puntosEmpate ?? 1),
    derrota: Number(o.puntosDerrota ?? 0),
    descanso: Number(o.puntosDescanso ?? 3),
  };
}

/**
 * Calcula la tabla de posiciones. `filtro` permite mirar solo una fase
 * (por ejemplo los partidos de un grupo).
 */
export function tablaPosiciones(torneo, sistema, filtro = null) {
  const puntos = puntajes(torneo);
  const filas = new Map();

  const nuevaFila = (equipoId) => ({
    equipoId,
    jugados: 0, ganados: 0, empatados: 0, perdidos: 0,
    puntos: 0,
    mayorFavor: 0, mayorContra: 0,   // sets, o el marcador principal
    menorFavor: 0, menorContra: 0,   // games o puntos
    descansos: 0,
  });

  const incluir = (equipoId) => {
    if (!equipoId) return null;
    if (!filas.has(equipoId)) filas.set(equipoId, nuevaFila(equipoId));
    return filas.get(equipoId);
  };

  // Todos los equipos aparecen, aunque no hayan jugado.
  for (const equipo of torneo.equipos) incluir(equipo.id);

  const partidos = (torneo.partidos || []).filter((p) => (filtro ? filtro(p) : true));

  for (const partido of partidos) {
    const lados = ladosDe(partido);

    if (partido.estado === 'descanso') {
      for (const equipoId of [...lados.a, ...lados.b]) {
        const fila = incluir(equipoId);
        if (!fila) continue;
        fila.descansos++;
        fila.puntos += puntos.descanso;
      }
      continue;
    }
    if (!partido.resultado || !lados.a.length || !lados.b.length) continue;

    // En el americano cada lado es una pareja: lo que pasa en el partido se le
    // anota a cada uno de sus integrantes.
    const filasA = lados.a.map(incluir).filter(Boolean);
    const filasB = lados.b.map(incluir).filter(Boolean);
    const d = desglose(sistema, partido.resultado);
    const ganador = ganadorAnotado(sistema, partido.resultado);

    for (const fila of [...filasA, ...filasB]) fila.jugados++;
    if (d) {
      for (const fila of filasA) {
        fila.mayorFavor += d.unidadMayorA; fila.mayorContra += d.unidadMayorB;
        fila.menorFavor += d.unidadMenorA; fila.menorContra += d.unidadMenorB;
      }
      for (const fila of filasB) {
        fila.mayorFavor += d.unidadMayorB; fila.mayorContra += d.unidadMayorA;
        fila.menorFavor += d.unidadMenorB; fila.menorContra += d.unidadMenorA;
      }
    }

    const anotar = (filas, resultado) => {
      for (const fila of filas) {
        if (resultado === 'gana') { fila.ganados++; fila.puntos += puntos.victoria; }
        else if (resultado === 'pierde') { fila.perdidos++; fila.puntos += puntos.derrota; }
        else { fila.empatados++; fila.puntos += puntos.empate; }
      }
    };

    if (ganador === 'A') { anotar(filasA, 'gana'); anotar(filasB, 'pierde'); }
    else if (ganador === 'B') { anotar(filasB, 'gana'); anotar(filasA, 'pierde'); }
    else { anotar(filasA, 'empata'); anotar(filasB, 'empata'); }
  }

  const resultado = Array.from(filas.values());
  for (const fila of resultado) {
    fila.difMayor = fila.mayorFavor - fila.mayorContra;
    fila.difMenor = fila.menorFavor - fila.menorContra;
  }

  // Desempates: puntos, diferencia principal, diferencia secundaria, ganados.
  resultado.sort((x, y) =>
    y.puntos - x.puntos
    || y.difMayor - x.difMayor
    || y.difMenor - x.difMenor
    || y.ganados - x.ganados
    || 0
  );
  resultado.forEach((fila, indice) => { fila.posicion = indice + 1; });
  return resultado;
}

/** Una tabla por cada grupo. */
export function tablasPorGrupo(torneo, sistema) {
  const letras = [...new Set(
    (torneo.partidos || []).filter((p) => p.fase === 'grupos').map((p) => p.grupo)
  )].filter(Boolean).sort();

  const salida = {};
  for (const letra of letras) {
    const equiposDelGrupo = new Set();
    for (const partido of torneo.partidos) {
      if (partido.fase === 'grupos' && partido.grupo === letra) {
        if (partido.equipoA) equiposDelGrupo.add(partido.equipoA);
        if (partido.equipoB) equiposDelGrupo.add(partido.equipoB);
      }
    }
    const subTorneo = {
      ...torneo,
      equipos: torneo.equipos.filter((e) => equiposDelGrupo.has(e.id)),
    };
    salida[letra] = tablaPosiciones(
      subTorneo, sistema,
      (p) => p.fase === 'grupos' && p.grupo === letra
    );
  }
  return salida;
}

// ----------------------------------------------------------------------------
// Estado del torneo
// ----------------------------------------------------------------------------

/** Resumen de avance: jugados, totales y campeón si ya terminó. */
export function resumenTorneo(torneo, sistema) {
  const partidos = torneo.partidos || [];
  const jugables = partidos.filter((p) => p.estado !== 'descanso');
  const jugados = jugables.filter((p) => p.resultado).length;
  const pendientes = jugables.length - jugados;

  let campeon = null;
  let subcampeon = null;
  let tercero = null;

  if (!pendientes && jugables.length) {
    if (torneo.modalidad === 'eliminacion' || torneo.modalidad === 'grupos') {
      const final = partidos
        .filter((p) => p.fase === 'llave')
        .sort((x, y) => y.ronda - x.ronda)[0];
      if (final) {
        campeon = ganadorDePartido(final, sistema);
        subcampeon = campeon === final.equipoA ? final.equipoB : final.equipoA;
      }
      const porTercero = partidos.find((p) => p.fase === 'tercerPuesto');
      if (porTercero) tercero = ganadorDePartido(porTercero, sistema);
    } else if (torneo.opciones?.playoffFinal) {
      const final = partidos.find((p) => p.rotulo === 'Final');
      if (final) {
        campeon = ganadorDePartido(final, sistema);
        subcampeon = campeon === final.equipoA ? final.equipoB : final.equipoA;
      }
    } else {
      const tabla = tablaPosiciones(torneo, sistema);
      campeon = tabla[0]?.equipoId ?? null;
      subcampeon = tabla[1]?.equipoId ?? null;
      tercero = tabla[2]?.equipoId ?? null;
    }
  }

  return {
    total: jugables.length,
    jugados,
    pendientes,
    terminado: Boolean(jugables.length) && pendientes === 0,
    campeon,
    subcampeon,
    tercero,
  };
}

/** Agrupa los partidos por ronda para mostrarlos ordenados. */
export function partidosPorRonda(partidos) {
  const mapa = new Map();
  for (const partido of partidos) {
    const clave = `${partido.ronda}|${partido.rotulo}`;
    if (!mapa.has(clave)) mapa.set(clave, { ronda: partido.ronda, rotulo: partido.rotulo, partidos: [] });
    mapa.get(clave).partidos.push(partido);
  }
  return Array.from(mapa.values())
    .sort((x, y) => x.ronda - y.ronda || x.rotulo.localeCompare(y.rotulo))
    .map((grupo) => ({ ...grupo, partidos: grupo.partidos.sort((x, y) => x.orden - y.orden) }));
}
