// Pruebas del motor de anotación. Se corren con: npm run prueba
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  reglasDelSet, marcadorSetValido, validarResultado, iniciarVivo,
  anotarPunto, vivoAResultado, textoPuntosVivo, deshacerPunto, esSetDecisivo,
  ganadorAnotado, advertencias,
} from '../js/anotacion.js';
import { DEPORTES_INICIALES } from '../js/catalogo.js';

const padel = DEPORTES_INICIALES.find((d) => d.id === 'dep-padel');
const sis = (idSistema) => padel.sistemas.find((s) => s.id === idSistema);

/** Juega un partido completo dándole puntos seguidos a un lado. */
function jugar(sistema, secuencia) {
  let vivo = iniciarVivo(sistema);
  for (const lado of secuencia) vivo = anotarPunto(vivo, lado, sistema);
  return vivo;
}

/** Gana `cantidad` games corridos el lado indicado (asumiendo game clásico). */
function gamesSeguidos(sistema, lado, cantidad) {
  return Array.from({ length: cantidad * 4 }, () => lado);
}

test('set clásico a 6 games: marcadores válidos e inválidos', () => {
  const reglas = reglasDelSet(0, sis('padel-3set-6-ventaja').config);
  for (const [a, b] of [[6, 0], [6, 4], [7, 5], [7, 6], [0, 6], [6, 3]]) {
    assert.ok(marcadorSetValido(a, b, reglas), `${a}-${b} debería ser válido`);
  }
  for (const [a, b] of [[6, 5], [6, 6], [8, 6], [7, 4], [5, 3], [6, 6], [9, 7]]) {
    assert.ok(!marcadorSetValido(a, b, reglas), `${a}-${b} no debería ser válido`);
  }
});

test('variante de 5 games ganando 3: tie-break en 2-2 permite el 3-2', () => {
  const reglas = reglasDelSet(0, sis('padel-3set-5-gana3').config);
  for (const [a, b] of [[3, 0], [3, 1], [3, 2], [2, 3]]) {
    assert.ok(marcadorSetValido(a, b, reglas), `${a}-${b} debería ser válido`);
  }
  for (const [a, b] of [[2, 2], [4, 2], [3, 3], [2, 1]]) {
    assert.ok(!marcadorSetValido(a, b, reglas), `${a}-${b} no debería ser válido`);
  }
});

test('variante de 7 games ganando 4: tie-break en 3-3 permite el 4-3', () => {
  const reglas = reglasDelSet(0, sis('padel-3set-7-gana4').config);
  for (const [a, b] of [[4, 0], [4, 3], [4, 2], [1, 4]]) {
    assert.ok(marcadorSetValido(a, b, reglas), `${a}-${b} debería ser válido`);
  }
  for (const [a, b] of [[3, 3], [5, 3], [5, 4]]) {
    assert.ok(!marcadorSetValido(a, b, reglas), `${a}-${b} no debería ser válido`);
  }
});

test('set express a 4 games con 2 de diferencia: el 4-3 no cierra, el 5-3 sí', () => {
  const reglas = reglasDelSet(0, sis('padel-3set-4-tb').config);
  assert.ok(marcadorSetValido(4, 2, reglas));
  assert.ok(!marcadorSetValido(4, 3, reglas), 'con 2 de diferencia el 4-3 no cierra');
  assert.ok(marcadorSetValido(5, 3, reglas));
  assert.ok(marcadorSetValido(5, 4, reglas), 'el 5-4 sale del tie-break en 4-4');
  assert.ok(!marcadorSetValido(6, 4, reglas));
});

test('el set decisivo con super tie-break se juega a 10 puntos', () => {
  const config = sis('padel-3set-6-super').config;
  assert.ok(esSetDecisivo(2, config));
  const reglasTercero = reglasDelSet(2, config);
  assert.ok(reglasTercero.esSuperTiebreak);
  assert.ok(marcadorSetValido(10, 8, reglasTercero));
  assert.ok(marcadorSetValido(12, 10, reglasTercero));
  assert.ok(!marcadorSetValido(10, 9, reglasTercero));
  // Los dos primeros sets siguen siendo sets normales a 6 games.
  assert.ok(marcadorSetValido(7, 6, reglasDelSet(0, config)));
});

test('validarResultado acepta un 3 sets bien anotado y rechaza sets de más', () => {
  const sistema = sis('padel-3set-6-ventaja');
  const bueno = validarResultado(sistema, { sets: [{ a: 6, b: 4 }, { a: 3, b: 6 }, { a: 7, b: 5 }] });
  assert.equal(bueno.ok, true);
  assert.equal(bueno.ganador, 'A');
  assert.deepEqual(bueno.detalle, { setsA: 2, setsB: 1 });

  const incompleto = validarResultado(sistema, { sets: [{ a: 6, b: 4 }] });
  assert.equal(incompleto.ok, false);

  const sobran = validarResultado(sistema, { sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }, { a: 6, b: 1 }] });
  assert.equal(sobran.ok, false);
  assert.match(sobran.motivo, /sobran/);
});

test('marcador en vivo: 4 puntos seguidos son un game', () => {
  const sistema = sis('padel-3set-6-ventaja');
  const vivo = jugar(sistema, ['a', 'a', 'a', 'a']);
  assert.deepEqual(vivo.games, { a: 1, b: 0 });
  assert.deepEqual(vivo.puntos, { a: 0, b: 0 });
  assert.equal(vivo.saca, 'B', 'el saque cambia al terminar el game');
});

test('marcador en vivo con ventaja: el 40-40 no se define en un punto', () => {
  const sistema = sis('padel-3set-6-ventaja');
  let vivo = jugar(sistema, ['a', 'a', 'a', 'b', 'b', 'b']);
  assert.equal(textoPuntosVivo(vivo, sistema).nota, 'Iguales');
  vivo = anotarPunto(vivo, 'a', sistema);
  assert.equal(textoPuntosVivo(vivo, sistema).a, 'AD');
  assert.deepEqual(vivo.games, { a: 0, b: 0 }, 'con ventaja todavía no gana el game');
  vivo = anotarPunto(vivo, 'a', sistema);
  assert.deepEqual(vivo.games, { a: 1, b: 0 });
});

test('marcador en vivo con punto de oro: el 40-40 se define al siguiente punto', () => {
  const sistema = sis('padel-3set-6-oro');
  let vivo = jugar(sistema, ['a', 'a', 'a', 'b', 'b', 'b']);
  assert.equal(textoPuntosVivo(vivo, sistema).nota, '¡Punto de oro!');
  vivo = anotarPunto(vivo, 'b', sistema);
  assert.deepEqual(vivo.games, { a: 0, b: 1 }, 'el punto de oro cierra el game al toque');
});

test('marcador en vivo: el 6-6 entra en tie-break y lo cierra 7-6', () => {
  const sistema = sis('padel-3set-6-ventaja');
  let vivo = iniciarVivo(sistema);
  for (let i = 0; i < 6; i++) {
    vivo = jugarGames(vivo, sistema, 'a', 1);
    vivo = jugarGames(vivo, sistema, 'b', 1);
  }
  assert.deepEqual(vivo.games, { a: 6, b: 6 });
  assert.equal(vivo.enTiebreak, true);
  for (let i = 0; i < 7; i++) vivo = anotarPunto(vivo, 'a', sistema);
  assert.deepEqual(vivo.setsCerrados, [{ a: 7, b: 6 }]);
  assert.equal(vivo.enTiebreak, false, 'el tie-break termina con el set');
});

test('marcador en vivo: partido completo 6-0 6-0 queda terminado', () => {
  const sistema = sis('padel-3set-6-ventaja');
  let vivo = iniciarVivo(sistema);
  vivo = jugarGames(vivo, sistema, 'a', 12);
  assert.equal(vivo.terminado, true);
  assert.equal(vivo.ganador, 'A');
  const resultado = vivoAResultado(vivo);
  assert.deepEqual(resultado.sets, [{ a: 6, b: 0 }, { a: 6, b: 0 }]);
  assert.equal(validarResultado(sistema, resultado).ok, true, 'lo que produce el motor tiene que validar');
});

test('marcador en vivo: con super tie-break el tercer set se juega a 10', () => {
  const sistema = sis('padel-3set-6-super');
  let vivo = iniciarVivo(sistema);
  vivo = jugarGames(vivo, sistema, 'a', 6);
  vivo = jugarGames(vivo, sistema, 'b', 6);
  assert.equal(vivo.setsCerrados.length, 2, 'van 1-1 en sets');
  assert.equal(vivo.enTiebreak, true, 'el tercer set arranca como super tie-break');
  for (let i = 0; i < 10; i++) vivo = anotarPunto(vivo, 'a', sistema);
  assert.equal(vivo.terminado, true);
  assert.deepEqual(vivo.setsCerrados.at(-1), { a: 10, b: 0 });
  assert.equal(validarResultado(sistema, vivoAResultado(vivo)).ok, true);
});

test('super tie-break único a 10: todo se define en un tie-break', () => {
  const sistema = sis('padel-super-tb-10');
  let vivo = iniciarVivo(sistema);
  assert.equal(vivo.enTiebreak, true);
  for (let i = 0; i < 9; i++) vivo = anotarPunto(vivo, 'a', sistema);
  for (let i = 0; i < 9; i++) vivo = anotarPunto(vivo, 'b', sistema);
  assert.equal(vivo.terminado, false, '9-9 todavía no cierra: faltan 2 de diferencia');
  vivo = anotarPunto(vivo, 'a', sistema);
  assert.equal(vivo.terminado, false, '10-9 tampoco');
  vivo = anotarPunto(vivo, 'a', sistema);
  assert.equal(vivo.terminado, true, '11-9 cierra');
  assert.equal(validarResultado(sistema, vivoAResultado(vivo)).ok, true);
});

test('deshacer devuelve el marcador al estado anterior', () => {
  const sistema = sis('padel-3set-6-ventaja');
  let vivo = jugar(sistema, ['a', 'a', 'a', 'a', 'b']);
  assert.deepEqual(vivo.games, { a: 1, b: 0 });
  assert.deepEqual(vivo.puntos, { a: 0, b: 1 });
  vivo = deshacerPunto(vivo);
  assert.deepEqual(vivo.puntos, { a: 0, b: 0 });
  vivo = deshacerPunto(vivo);
  assert.deepEqual(vivo.games, { a: 0, b: 0 });
  assert.deepEqual(vivo.puntos, { a: 3, b: 0 }, 'queda en 40-0');
});

test('americano por puntos: valida el límite y permite empate', () => {
  const sistema = sis('padel-americano-16');
  assert.equal(validarResultado(sistema, { a: 10, b: 6 }).ok, true);
  assert.equal(validarResultado(sistema, { a: 8, b: 8 }).ok, true);
  assert.equal(validarResultado(sistema, { a: 8, b: 8 }).ganador, null);
  assert.equal(validarResultado(sistema, { a: 20, b: 2 }).ok, false);
});

test('vóley a 25 puntos: no hay tie-break y manda la diferencia de 2', () => {
  const voley = DEPORTES_INICIALES.find((d) => d.id === 'dep-voleibol');
  const sistema = voley.sistemas.find((s) => s.id === 'voley-3set-25');
  const reglas = reglasDelSet(0, sistema.config);
  assert.ok(marcadorSetValido(25, 23, reglas));
  assert.ok(marcadorSetValido(27, 25, reglas));
  assert.ok(!marcadorSetValido(25, 24, reglas));
  // Con puntos directos cada punto anotado es un punto del set.
  let vivo = iniciarVivo(sistema);
  for (let i = 0; i < 25; i++) vivo = anotarPunto(vivo, 'a', sistema);
  assert.deepEqual(vivo.setsCerrados, [{ a: 25, b: 0 }]);
});

/** Hace que un lado gane `cantidad` games enteros (sirve con game clásico). */
function jugarGames(vivo, sistema, lado, cantidad) {
  let actual = vivo;
  for (let g = 0; g < cantidad; g++) {
    if (actual.terminado) break;
    if (actual.enTiebreak) {
      const meta = sistema.config.puntosTiebreak;
      for (let p = 0; p < meta; p++) actual = anotarPunto(actual, lado, sistema);
    } else {
      for (let p = 0; p < 4; p++) actual = anotarPunto(actual, lado, sistema);
    }
  }
  return actual;
}

// -------------------------------------------------- Anotación libre

test('tie-break único a 7: los marcadores salen en puntos, no en games', () => {
  const sistema = sis('padel-tb-7');
  const reglas = reglasDelSet(0, sistema.config);
  assert.ok(reglas.esSuperTiebreak, 'el set único se juega como tie-break');
  assert.equal(reglas.umbral, 7);
  for (const [a, b] of [[7, 5], [7, 0], [9, 7], [5, 7]]) {
    assert.ok(marcadorSetValido(a, b, reglas), `${a}-${b} debería valer`);
  }
  for (const [a, b] of [[7, 6], [8, 5], [1, 0]]) {
    assert.ok(!marcadorSetValido(a, b, reglas), `${a}-${b} no debería valer`);
  }
  // Y el motor en vivo lo juega como tie-break.
  let vivo = iniciarVivo(sistema);
  assert.equal(vivo.enTiebreak, true);
  for (let i = 0; i < 7; i++) vivo = anotarPunto(vivo, 'a', sistema);
  assert.equal(vivo.terminado, true);
  assert.deepEqual(vivo.setsCerrados, [{ a: 7, b: 0 }]);
});

test('ganadorAnotado respeta lo escrito aunque no cuadre con las reglas', () => {
  const sistema = sis('padel-3set-6-ventaja');
  // Un 9-7 no es un set clásico, pero si lo escribo así, gana quien lo ganó.
  assert.equal(ganadorAnotado(sistema, { sets: [{ a: 9, b: 7 }, { a: 6, b: 3 }] }), 'A');
  assert.equal(ganadorAnotado(sistema, { sets: [{ a: 3, b: 6 }] }), 'B');
  // Un solo set basta para definir ganador aunque falten sets.
  assert.equal(ganadorAnotado(sistema, { sets: [{ a: 6, b: 4 }] }), 'A');
  // Empatado en sets: sin ganador.
  assert.equal(ganadorAnotado(sistema, { sets: [{ a: 6, b: 4 }, { a: 2, b: 6 }] }), null);
  // El retiro manda sobre el marcador.
  assert.equal(ganadorAnotado(sistema, { sets: [], retiro: 'A' }), 'B');
  // Marcador corrido.
  const americano = sis('padel-americano-16');
  assert.equal(ganadorAnotado(americano, { a: 20, b: 4 }), 'A');
  assert.equal(ganadorAnotado(americano, { a: 8, b: 8 }), null);
});

test('advertencias avisa de lo raro sin bloquear nada', () => {
  const sistema = sis('padel-3set-6-ventaja');
  assert.deepEqual(advertencias(sistema, { sets: [{ a: 6, b: 4 }, { a: 6, b: 2 }] }), []);

  const raro = advertencias(sistema, { sets: [{ a: 9, b: 7 }] });
  assert.ok(raro.some((a) => a.includes('set 1')), 'avisa del set raro');
  assert.ok(raro.some((a) => a.includes('sets')), 'avisa de que no cierra el partido');

  const empatado = advertencias(sistema, { sets: [{ a: 5, b: 5 }] });
  assert.ok(empatado.some((a) => a.includes('empatado')));

  const demas = advertencias(sistema, {
    sets: [{ a: 6, b: 4 }, { a: 6, b: 4 }, { a: 6, b: 4 }, { a: 6, b: 4 }],
  });
  assert.ok(demas.some((a) => a.includes('llega hasta')));

  // En un marcador corrido con límite.
  const americano = sis('padel-americano-16');
  assert.ok(advertencias(americano, { a: 20, b: 4 }).some((a) => a.includes('16')));
});
