// Motor de anotación.
//
// Se encarga de tres cosas:
//   1. Describir en palabras las reglas de un sistema de anotación.
//   2. Validar un resultado escrito a mano (que el marcador sea posible según las reglas).
//   3. Llevar un marcador en vivo punto por punto, respetando games, ventaja,
//      punto de oro, tie-break y super tie-break.

// ----------------------------------------------------------------------------
// Reglas legibles
// ----------------------------------------------------------------------------

/** Devuelve una lista de frases que describen las reglas del sistema. */
export function reglasLegibles(sistema) {
  if (!sistema) return [];
  const c = sistema.config || {};

  if (sistema.tipo === 'sets') {
    const unidad = c.etiquetaGame === 'punto' ? 'puntos' : 'games';
    const lineas = [];
    const totalSets = c.setsParaGanar * 2 - 1;
    lineas.push(
      c.setsParaGanar === 1
        ? 'Se juega un set único.'
        : `Al mejor de ${totalSets} sets: gana quien se lleve ${c.setsParaGanar}.`
    );

    if (!(c.ultimoSetSuperTiebreak && c.setsParaGanar === 1)) {
      lineas.push(
        `Cada set se gana con ${c.gamesParaGanarSet} ${unidad} y ${c.diferenciaGames} de diferencia.`
      );
      if (c.tiebreakEnEmpate !== null && c.tiebreakEnEmpate !== undefined) {
        lineas.push(
          `Si quedan ${c.tiebreakEnEmpate}-${c.tiebreakEnEmpate}, el set lo define un tie-break a ${c.puntosTiebreak} (con ${c.diferenciaTiebreak} de diferencia).`
        );
      } else {
        lineas.push('No hay tie-break: el set se estira hasta que haya diferencia.');
      }
    }

    if (c.puntosGame === 'clasico') lineas.push('Los games se cuentan 15 / 30 / 40 y con ventaja en el 40-40.');
    else if (c.puntosGame === 'oro') lineas.push('Punto de oro: el 40-40 se define en un solo punto.');
    else lineas.push('Se cuentan puntos corridos, sin games internos.');

    if (c.ultimoSetSuperTiebreak) {
      lineas.push(
        c.setsParaGanar === 1
          ? `Todo se define en un super tie-break a ${c.puntosSuperTiebreak} puntos (con ${c.diferenciaTiebreak} de diferencia).`
          : `El set decisivo se reemplaza por un super tie-break a ${c.puntosSuperTiebreak} puntos.`
      );
    }
    return lineas;
  }

  if (sistema.tipo === 'puntos') {
    const lineas = [`Marcador corrido de ${String(c.etiqueta || 'puntos').toLowerCase()}.`];
    if (c.limite) lineas.push(`El partido se cierra en ${c.limite}.`);
    lineas.push(c.permiteEmpate ? 'Se permite el empate.' : 'No se permite el empate: siempre hay un ganador.');
    return lineas;
  }

  if (sistema.tipo === 'mejorDe') {
    return [`Gana quien se lleve ${c.rondasParaGanar} rondas.`];
  }

  return [];
}

/** Resumen de una línea para mostrar en tarjetas y listados. */
export function resumenSistema(sistema) {
  if (!sistema) return '';
  const c = sistema.config || {};
  if (sistema.tipo === 'sets') {
    const partes = [];
    partes.push(c.setsParaGanar === 1 ? '1 set' : `al mejor de ${c.setsParaGanar * 2 - 1} sets`);
    if (!(c.ultimoSetSuperTiebreak && c.setsParaGanar === 1)) {
      partes.push(`a ${c.gamesParaGanarSet} ${c.etiquetaGame === 'punto' ? 'puntos' : 'games'}`);
      if (c.tiebreakEnEmpate != null) partes.push(`tie-break en ${c.tiebreakEnEmpate}-${c.tiebreakEnEmpate}`);
    }
    if (c.puntosGame === 'oro') partes.push('punto de oro');
    if (c.ultimoSetSuperTiebreak) partes.push(`super tie-break a ${c.puntosSuperTiebreak}`);
    return partes.join(' · ');
  }
  if (sistema.tipo === 'puntos') {
    return c.limite ? `${c.etiqueta} a ${c.limite}` : `${c.etiqueta} corridos`;
  }
  if (sistema.tipo === 'mejorDe') return `al mejor de ${c.rondasParaGanar * 2 - 1} rondas`;
  return '';
}

// ----------------------------------------------------------------------------
// Reglas de un set
// ----------------------------------------------------------------------------

/** El set decisivo es el último que se puede llegar a jugar. */
export function esSetDecisivo(indiceSet, config) {
  return indiceSet === config.setsParaGanar * 2 - 2;
}

/** Cuántos sets como máximo se pueden jugar. */
export const maximoSets = (config) => config.setsParaGanar * 2 - 1;

/** Reglas efectivas de un set: el decisivo puede ser un super tie-break. */
export function reglasDelSet(indiceSet, config) {
  if (config.ultimoSetSuperTiebreak && esSetDecisivo(indiceSet, config)) {
    return {
      umbral: config.puntosSuperTiebreak,
      diferencia: config.diferenciaTiebreak,
      tiebreakEnEmpate: null,
      esSuperTiebreak: true,
    };
  }
  return {
    umbral: config.gamesParaGanarSet,
    diferencia: config.diferenciaGames,
    tiebreakEnEmpate: config.tiebreakEnEmpate,
    esSuperTiebreak: false,
  };
}

/**
 * ¿Con este marcador el set ya está cerrado?
 * Con tie-break, una vez que los dos llegan al número de empate, el siguiente
 * game cierra el set (6-6 -> 7-6). Sin tie-break manda la diferencia mínima.
 */
export function setCerrado(a, b, reglas) {
  const alto = Math.max(a, b);
  const bajo = Math.min(a, b);
  if (reglas.tiebreakEnEmpate != null && bajo >= reglas.tiebreakEnEmpate) {
    return alto >= reglas.tiebreakEnEmpate + 1;
  }
  return alto >= reglas.umbral && alto - bajo >= reglas.diferencia;
}

/**
 * ¿Es un marcador final posible? Tiene que estar cerrado y, además, no haberlo
 * estado un game antes: así se descartan marcadores como 7-4 o 8-6 en un set a 6.
 */
export function marcadorSetValido(a, b, reglas) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) return false;
  if (a === b) return false;
  if (!setCerrado(a, b, reglas)) return false;
  const [ganador, perdedor] = a > b ? [a, b] : [b, a];
  return !setCerrado(ganador - 1, perdedor, reglas);
}

/** Lista de marcadores finales posibles para un set, para los menús desplegables. */
export function marcadoresPosibles(reglas) {
  const tope = (reglas.tiebreakEnEmpate != null ? reglas.tiebreakEnEmpate + 1 : reglas.umbral + reglas.diferencia + 8);
  const salida = [];
  for (let a = 0; a <= tope; a++) {
    for (let b = 0; b <= tope; b++) {
      if (marcadorSetValido(a, b, reglas)) salida.push([a, b]);
    }
  }
  return salida;
}

// ----------------------------------------------------------------------------
// Validación de resultados completos
// ----------------------------------------------------------------------------

/** Estructura de resultado vacía según el tipo de sistema. */
export function nuevoResultado(sistema) {
  if (sistema.tipo === 'sets') return { sets: [], ganador: null };
  if (sistema.tipo === 'puntos') return { a: 0, b: 0, ganador: null };
  return { a: 0, b: 0, ganador: null };
}

/**
 * Valida un resultado y calcula el ganador.
 * Devuelve { ok, motivo, ganador, detalle }.
 */
export function validarResultado(sistema, resultado) {
  if (!sistema) return { ok: false, motivo: 'Falta el sistema de anotación.' };
  const c = sistema.config || {};

  if (sistema.tipo === 'sets') {
    const sets = (resultado.sets || []).filter((s) => s && (s.a !== '' || s.b !== ''));
    if (!sets.length) return { ok: false, motivo: 'Hay que anotar al menos un set.' };

    let ganaA = 0;
    let ganaB = 0;
    for (let i = 0; i < sets.length; i++) {
      const a = Number(sets[i].a);
      const b = Number(sets[i].b);
      const reglas = reglasDelSet(i, c);
      if (!marcadorSetValido(a, b, reglas)) {
        return {
          ok: false,
          motivo: `El set ${i + 1} (${a}-${b}) no es un marcador posible con este sistema.`,
        };
      }
      if (a > b) ganaA++; else ganaB++;
      // Si alguien ya ganó el partido, no puede haber más sets anotados.
      if ((ganaA === c.setsParaGanar || ganaB === c.setsParaGanar) && i < sets.length - 1) {
        return { ok: false, motivo: `El partido ya estaba definido en el set ${i + 1}; sobran sets.` };
      }
    }
    if (ganaA < c.setsParaGanar && ganaB < c.setsParaGanar) {
      return {
        ok: false,
        motivo: `Falta cerrar el partido: van ${ganaA}-${ganaB} en sets y se necesitan ${c.setsParaGanar}.`,
      };
    }
    return {
      ok: true,
      ganador: ganaA > ganaB ? 'A' : 'B',
      detalle: { setsA: ganaA, setsB: ganaB },
    };
  }

  if (sistema.tipo === 'puntos') {
    const a = Number(resultado.a);
    const b = Number(resultado.b);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
      return { ok: false, motivo: 'El marcador tiene que ser un número positivo.' };
    }
    if (c.limite && (a > c.limite || b > c.limite)) {
      return { ok: false, motivo: `El marcador no puede pasar de ${c.limite}.` };
    }
    if (c.limite && Math.max(a, b) !== c.limite && !c.permiteEmpate) {
      return { ok: false, motivo: `Alguien tiene que llegar a ${c.limite}.` };
    }
    if (a === b && !c.permiteEmpate) {
      return { ok: false, motivo: 'Este sistema no permite empate: hay que definir un ganador.' };
    }
    return { ok: true, ganador: a === b ? null : (a > b ? 'A' : 'B'), detalle: { a, b } };
  }

  if (sistema.tipo === 'mejorDe') {
    const a = Number(resultado.a);
    const b = Number(resultado.b);
    const meta = c.rondasParaGanar;
    if (a > meta || b > meta) return { ok: false, motivo: `Nadie puede ganar más de ${meta} rondas.` };
    if (a !== meta && b !== meta) return { ok: false, motivo: `Alguien tiene que llegar a ${meta} rondas.` };
    return { ok: true, ganador: a > b ? 'A' : 'B', detalle: { a, b } };
  }

  return { ok: false, motivo: 'Tipo de sistema desconocido.' };
}

/**
 * Quién ganó según lo que se anotó, sin exigir que el marcador cumpla las
 * reglas. Es lo que usa la aplicación para avanzar las llaves y las tablas:
 * el marcador se escribe libre y manda lo anotado.
 */
export function ganadorAnotado(sistema, resultado) {
  if (!resultado) return null;
  if (resultado.retiro) return resultado.retiro === 'A' ? 'B' : 'A';

  if (sistema?.tipo === 'sets') {
    let ganaA = 0;
    let ganaB = 0;
    for (const set of resultado.sets || []) {
      const a = Number(set.a);
      const b = Number(set.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      if (a > b) ganaA++;
      else if (b > a) ganaB++;
    }
    if (ganaA === ganaB) return null;
    return ganaA > ganaB ? 'A' : 'B';
  }

  const a = Number(resultado.a);
  const b = Number(resultado.b);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return null;
  return a > b ? 'A' : 'B';
}

/**
 * Avisos sobre un marcador escrito a mano. No bloquea nada: solo cuenta en qué
 * se aparta de las reglas del sistema, por si fue un error de tipeo.
 */
export function advertencias(sistema, resultado) {
  if (!sistema || !resultado || resultado.retiro) return [];
  const c = sistema.config || {};
  const avisos = [];

  if (sistema.tipo === 'sets') {
    const sets = (resultado.sets || []).filter((s) => s && s.a !== '' && s.b !== '');
    let ganaA = 0;
    let ganaB = 0;

    sets.forEach((set, indice) => {
      const a = Number(set.a);
      const b = Number(set.b);
      const reglas = reglasDelSet(indice, c);
      if (a === b) avisos.push(`El set ${indice + 1} quedó empatado (${a}-${b}).`);
      else if (!marcadorSetValido(a, b, reglas)) {
        avisos.push(`El set ${indice + 1} (${a}-${b}) no es un marcador típico de este sistema.`);
      }
      if (a > b) ganaA++; else if (b > a) ganaB++;
    });

    if (sets.length > maximoSets(c)) {
      avisos.push(`Se anotaron ${sets.length} sets y el sistema llega hasta ${maximoSets(c)}.`);
    }
    if (sets.length && ganaA < c.setsParaGanar && ganaB < c.setsParaGanar) {
      avisos.push(`Van ${ganaA}-${ganaB} en sets y para ganar hacen falta ${c.setsParaGanar}.`);
    }
    return avisos;
  }

  const a = Number(resultado.a);
  const b = Number(resultado.b);
  if (sistema.tipo === 'puntos') {
    if (c.limite && (a > c.limite || b > c.limite)) {
      avisos.push(`El marcador pasa de ${c.limite}, que es donde se cierra el partido.`);
    }
    if (a === b && !c.permiteEmpate) avisos.push('Este sistema no contempla el empate.');
  }
  if (sistema.tipo === 'mejorDe' && (a > c.rondasParaGanar || b > c.rondasParaGanar)) {
    avisos.push(`Nadie debería ganar más de ${c.rondasParaGanar} rondas.`);
  }
  return avisos;
}

/** Texto corto del resultado: "6-4 3-6 10-8" o "3-1". */
export function textoResultado(sistema, resultado) {
  if (!resultado) return '';
  if (resultado.retiro) {
    return `${resultado.retiro === 'A' ? 'Retiro del equipo 1' : 'Retiro del equipo 2'}`;
  }
  if (sistema?.tipo === 'sets') {
    return (resultado.sets || []).map((s) => `${s.a}-${s.b}`).join('  ');
  }
  return `${resultado.a ?? 0}-${resultado.b ?? 0}`;
}

/** Sets o puntos ganados por cada lado, para las tablas de posiciones. */
export function desglose(sistema, resultado) {
  if (!resultado) return null;
  if (sistema?.tipo === 'sets') {
    let setsA = 0, setsB = 0, gamesA = 0, gamesB = 0;
    for (const s of resultado.sets || []) {
      const a = Number(s.a), b = Number(s.b);
      gamesA += a; gamesB += b;
      if (a > b) setsA++; else if (b > a) setsB++;
    }
    return { unidadMayorA: setsA, unidadMayorB: setsB, unidadMenorA: gamesA, unidadMenorB: gamesB };
  }
  const a = Number(resultado.a) || 0;
  const b = Number(resultado.b) || 0;
  return { unidadMayorA: a, unidadMayorB: b, unidadMenorA: a, unidadMenorB: b };
}

// ----------------------------------------------------------------------------
// Marcador en vivo, punto por punto
// ----------------------------------------------------------------------------

const ETIQUETAS_CLASICAS = ['0', '15', '30', '40'];

/** Arranca un marcador en vivo. */
export function iniciarVivo(sistema, sacaPrimero = 'A') {
  return {
    setsCerrados: [],
    games: { a: 0, b: 0 },
    puntos: { a: 0, b: 0 },
    enTiebreak: esTiebreakDeEntrada(sistema.config, 0),
    saca: sacaPrimero,
    puntosDelSaque: 0,
    terminado: false,
    ganador: null,
    historial: [],
  };
}

/** El set arranca directamente en tie-break cuando es un super tie-break. */
function esTiebreakDeEntrada(config, indiceSet) {
  const reglas = reglasDelSet(indiceSet, config);
  return Boolean(reglas.esSuperTiebreak);
}

/** Cuántos puntos necesita el tie-break en curso. */
function metaTiebreak(config, indiceSet) {
  const reglas = reglasDelSet(indiceSet, config);
  return reglas.esSuperTiebreak ? config.puntosSuperTiebreak : config.puntosTiebreak;
}

/** Suma un punto a un lado ('a' o 'b') y aplica todas las reglas. */
export function anotarPunto(vivo, lado, sistema) {
  if (vivo.terminado) return vivo;
  const c = sistema.config;
  const siguiente = structuredClone(vivo);
  siguiente.historial.push({
    setsCerrados: structuredClone(vivo.setsCerrados),
    games: { ...vivo.games },
    puntos: { ...vivo.puntos },
    enTiebreak: vivo.enTiebreak,
    saca: vivo.saca,
    puntosDelSaque: vivo.puntosDelSaque,
    terminado: vivo.terminado,
    ganador: vivo.ganador,
  });

  const indiceSet = siguiente.setsCerrados.length;
  const otro = lado === 'a' ? 'b' : 'a';

  if (siguiente.enTiebreak) {
    siguiente.puntos[lado]++;
    const meta = metaTiebreak(c, indiceSet);
    const alto = siguiente.puntos[lado];
    const bajo = siguiente.puntos[otro];
    // En el tie-break el saque cambia tras el primer punto y luego cada dos.
    const totalPuntos = siguiente.puntos.a + siguiente.puntos.b;
    if (totalPuntos % 2 === 1) siguiente.saca = siguiente.saca === 'A' ? 'B' : 'A';
    if (alto >= meta && alto - bajo >= c.diferenciaTiebreak) {
      const reglas = reglasDelSet(indiceSet, c);
      // En un super tie-break el marcador del set son los propios puntos.
      if (reglas.esSuperTiebreak) {
        cerrarSet(siguiente, siguiente.puntos.a, siguiente.puntos.b, c);
      } else {
        siguiente.games[lado]++;
        cerrarSet(siguiente, siguiente.games.a, siguiente.games.b, c);
      }
    }
    return siguiente;
  }

  if (c.puntosGame === 'directo') {
    // Vóley, ping pong: cada punto es un "game" del set.
    siguiente.games[lado]++;
    revisarSet(siguiente, c);
    return siguiente;
  }

  siguiente.puntos[lado]++;
  const p = siguiente.puntos[lado];
  const q = siguiente.puntos[otro];
  const ganaGame = c.puntosGame === 'oro'
    ? (p >= 4 && (p - q >= 2 || q === 3))
    : (p >= 4 && p - q >= 2);

  if (ganaGame) {
    siguiente.games[lado]++;
    siguiente.puntos = { a: 0, b: 0 };
    siguiente.saca = siguiente.saca === 'A' ? 'B' : 'A';
    revisarSet(siguiente, c);
  }
  return siguiente;
}

/** Tras ganar un game, vemos si el set terminó o si toca tie-break. */
function revisarSet(vivo, config) {
  const indiceSet = vivo.setsCerrados.length;
  const reglas = reglasDelSet(indiceSet, config);
  const { a, b } = vivo.games;

  if (setCerrado(a, b, reglas)) {
    cerrarSet(vivo, a, b, config);
    return;
  }
  if (reglas.tiebreakEnEmpate != null && a === reglas.tiebreakEnEmpate && b === reglas.tiebreakEnEmpate) {
    vivo.enTiebreak = true;
    vivo.puntos = { a: 0, b: 0 };
  }
}

/** Guarda el set terminado y decide si el partido sigue. */
function cerrarSet(vivo, a, b, config) {
  vivo.setsCerrados.push({ a, b });
  vivo.games = { a: 0, b: 0 };
  vivo.puntos = { a: 0, b: 0 };

  let ganaA = 0;
  let ganaB = 0;
  for (const s of vivo.setsCerrados) {
    if (s.a > s.b) ganaA++; else ganaB++;
  }
  if (ganaA >= config.setsParaGanar || ganaB >= config.setsParaGanar) {
    vivo.terminado = true;
    vivo.ganador = ganaA > ganaB ? 'A' : 'B';
    vivo.enTiebreak = false;
    return;
  }
  vivo.enTiebreak = esTiebreakDeEntrada(config, vivo.setsCerrados.length);
}

/** Deshace el último punto. */
export function deshacerPunto(vivo) {
  if (!vivo.historial.length) return vivo;
  const anterior = vivo.historial.at(-1);
  return { ...structuredClone(anterior), historial: vivo.historial.slice(0, -1) };
}

/** Cómo se muestran los puntos del game en curso. */
export function textoPuntosVivo(vivo, sistema) {
  const c = sistema.config;
  if (vivo.terminado) return { a: '—', b: '—', nota: 'Partido terminado' };
  if (vivo.enTiebreak) {
    const indiceSet = vivo.setsCerrados.length;
    const reglas = reglasDelSet(indiceSet, c);
    return {
      a: String(vivo.puntos.a),
      b: String(vivo.puntos.b),
      nota: reglas.esSuperTiebreak
        ? `Super tie-break a ${c.puntosSuperTiebreak}`
        : `Tie-break a ${c.puntosTiebreak}`,
    };
  }
  if (c.puntosGame === 'directo') {
    return { a: '—', b: '—', nota: 'Se cuentan puntos directos' };
  }
  const { a, b } = vivo.puntos;
  if (a >= 3 && b >= 3) {
    if (c.puntosGame === 'oro' && a === 3 && b === 3) return { a: '40', b: '40', nota: '¡Punto de oro!' };
    if (a === b) return { a: '40', b: '40', nota: 'Iguales' };
    return a > b
      ? { a: 'AD', b: '40', nota: 'Ventaja' }
      : { a: '40', b: 'AD', nota: 'Ventaja' };
  }
  return { a: ETIQUETAS_CLASICAS[a] ?? String(a), b: ETIQUETAS_CLASICAS[b] ?? String(b), nota: '' };
}

/** Convierte un marcador en vivo a un resultado guardable. */
export function vivoAResultado(vivo) {
  return { sets: structuredClone(vivo.setsCerrados), ganador: vivo.ganador };
}

/** Los sets ya cerrados más el set en curso, para mostrar la fila del marcador. */
export function setsVisibles(vivo) {
  const visibles = vivo.setsCerrados.map((s) => ({ ...s, cerrado: true }));
  if (!vivo.terminado) visibles.push({ a: vivo.games.a, b: vivo.games.b, cerrado: false });
  return visibles;
}
