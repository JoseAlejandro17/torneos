// Pruebas del generador de PDF y de la hoja del torneo.
//
// La hoja usa el modelo, que guarda en localStorage: acá se le pone uno de
// mentira para poder correrla fuera del navegador.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.localStorage = {
  datos: {},
  getItem(clave) { return this.datos[clave] ?? null; },
  setItem(clave, valor) { this.datos[clave] = valor; },
};

const { Documento, anchoDeTexto, recortar, repartirEnLineas } = await import('../js/pdf.js');
const modelo = await import('../js/modelo.js');
const { generarFixture } = await import('../js/fixture.js');
const { construirHoja } = await import('../js/hoja-pdf.js');

/** Lee el PDF como texto para revisarlo (no van comprimidos). */
async function comoTexto(doc) {
  return new TextDecoder('latin1').decode(await doc.aBlob().arrayBuffer());
}

/** Revisa que el archivo esté bien armado, como lo haría un lector. */
function revisarEstructura(texto) {
  assert.ok(texto.startsWith('%PDF-1.4'), 'le falta la cabecera');
  assert.ok(texto.trimEnd().endsWith('%%EOF'), 'le falta el cierre');

  const inicioTabla = texto.indexOf('\nxref\n') + 1;
  assert.ok(inicioTabla > 0, 'no tiene tabla xref');
  const tabla = texto.slice(inicioTabla, texto.indexOf('trailer'));
  const offsets = [...tabla.matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));

  offsets.forEach((offset, indice) => {
    assert.ok(
      texto.startsWith(`${indice + 1} 0 obj`, offset),
      `el objeto ${indice + 1} no está donde dice la tabla`
    );
  });

  const apunta = Number(texto.match(/startxref\n(\d+)/)[1]);
  assert.equal(apunta, inicioTabla, 'startxref no apunta a la tabla');

  for (const coincidencia of texto.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const declarado = Number(coincidencia[1]);
    const inicio = coincidencia.index + coincidencia[0].length;
    const real = texto.indexOf('\nendstream', inicio) - inicio;
    assert.equal(declarado, real, 'un stream declara un largo que no es el suyo');
  }
  return offsets.length;
}

/** El texto que se ve en cada página. */
function textosPorPagina(texto) {
  return [...texto.matchAll(/<< \/Length \d+ >>\nstream\n([\s\S]*?)\nendstream/g)]
    .map((m) => [...m[1].matchAll(/\((.*?)\) Tj/g)].map((t) => t[1]));
}

test('el PDF que sale está bien armado', async () => {
  const doc = new Documento({});
  doc.texto(50, 60, 'Hola', { tamano: 12 });
  doc.rectangulo(50, 80, 100, 20, { borde: 0.5 });
  doc.nuevaPagina();
  doc.texto(50, 60, 'Segunda página', { tamano: 12, negrita: true });

  const texto = await comoTexto(doc);
  const objetos = revisarEstructura(texto);
  assert.equal(objetos, 8, '2 fuentes + catálogo + páginas + 2 por cada hoja');
  assert.equal((texto.match(/\/Type \/Page[^s]/g) || []).length, 2);
});

test('los acentos y la ñ sobreviven; los emojis se descartan', async () => {
  const doc = new Documento({});
  doc.texto(50, 60, 'Pádel · canción ñandú ¿qué? 🎾🏆', { tamano: 12 });
  const texto = await comoTexto(doc);
  const [primera] = textosPorPagina(texto);
  // En el PDF el texto va en WinAnsi: un byte por carácter. Donde iban los
  // emojis no queda nada (apenas el espacio que los separaba).
  assert.equal(primera[0].trimEnd(), 'P\xe1del \xb7 canci\xf3n \xf1and\xfa \xbfqu\xe9?');
  for (const caracter of primera[0]) {
    assert.ok(caracter.codePointAt(0) <= 0xff, 'quedó un carácter que el PDF no sabe dibujar');
  }
});

test('los paréntesis del texto no rompen el archivo', async () => {
  const doc = new Documento({});
  doc.texto(50, 60, 'Tie-break a 7 (con 2 de diferencia) \\ fin', { tamano: 10 });
  const texto = await comoTexto(doc);
  revisarEstructura(texto);
  assert.ok(texto.includes('\\(con 2 de diferencia\\)'), 'los paréntesis van escapados');
});

test('las medidas de texto sirven para recortar y repartir', () => {
  assert.ok(anchoDeTexto('iii', 10) < anchoDeTexto('MMM', 10), 'la i es más angosta que la M');
  assert.equal(recortar('Los Tiburones', 500, 10), 'Los Tiburones', 'si cabe, no lo toca');
  const corto = recortar('Los Tiburones del Pacífico Sur', 60, 10);
  assert.ok(corto.endsWith('...') && corto.length < 30);
  const lineas = repartirEnLineas('una frase bastante larga que hay que partir en varias líneas', 80, 9);
  assert.ok(lineas.length > 1);
  assert.equal(lineas.join(' '), 'una frase bastante larga que hay que partir en varias líneas');
});

test('la hoja del torneo sale completa y paginada', async () => {
  const equipos = Array.from({ length: 6 }, (_, i) => ({
    id: `p${i}`, numero: i + 1, letra: 'ABCDEF'[i], nombre: `Equipo ${'ABCDEF'[i]}`,
    apodo: '', mascota: '', lema: '', color: '#3b82c4', integrantes: [],
  }));
  const torneo = modelo.crearTorneo({
    nombre: 'Copa del sábado', deporteId: 'dep-padel', sistemaId: 'padel-3set-5-gana3',
    tamanoEquipo: 2, campoNombre: 'nombre', modalidad: 'roundRobin',
    opciones: { vueltas: 1, puntosVictoria: 3, puntosEmpate: 1, puntosDerrota: 0 },
    equipos,
  });
  torneo.partidos = generarFixture(torneo);

  const doc = construirHoja(torneo, {
    tablaNombres: true, integrantes: true, reglas: true, posiciones: true,
  });
  const texto = await comoTexto(doc);
  revisarEstructura(texto);

  const paginas = textosPorPagina(texto);
  assert.ok(paginas.length >= 2, 'con 15 partidos no cabe en una hoja');

  const todo = paginas.flat().join(' | ');
  assert.ok(todo.includes('Copa del s\xe1bado'), 'va el nombre del torneo');
  assert.ok(todo.includes('C\xd3MO SE ANOTA'), 'van las reglas');
  assert.ok(todo.includes('QUI\xc9N ES CADA EQUIPO'), 'va la tabla de nombres');
  assert.ok(todo.includes('FECHA 1'), 'van las fechas');
  assert.ok(todo.includes('SET 1') && todo.includes('GANA'), 'van los casilleros');
  assert.ok(todo.includes('TABLA DE POSICIONES'), 'va la tabla en blanco');

  // Todos los equipos aparecen en la hoja.
  for (const equipo of equipos) {
    assert.ok(todo.includes(equipo.nombre), `falta ${equipo.nombre}`);
  }
  // Y cada hoja lleva su pie con la numeración.
  paginas.forEach((textos, indice) => {
    const pie = textos.join(' | ');
    assert.ok(pie.includes(`P\xe1gina ${indice + 1} de ${paginas.length}`), `la hoja ${indice + 1} no tiene pie`);
  });
  // Ninguna hoja queda solo con el pie.
  for (const textos of paginas) {
    assert.ok(textos.length > 4, 'quedó una hoja casi vacía');
  }
});

test('la hoja respeta lo que se elige incluir', async () => {
  const torneo = modelo.torneos()[0];
  const minima = await comoTexto(construirHoja(torneo, {
    tablaNombres: false, integrantes: false, reglas: false, posiciones: false,
  }));
  revisarEstructura(minima);
  const todo = textosPorPagina(minima).flat().join(' | ');
  assert.ok(!todo.includes('C\xd3MO SE ANOTA'), 'las reglas quedaron fuera');
  assert.ok(!todo.includes('QUI\xc9N ES CADA EQUIPO'), 'la tabla de nombres quedó fuera');
  assert.ok(!todo.includes('TABLA DE POSICIONES'), 'la tabla en blanco quedó fuera');
  assert.ok(todo.includes('FECHA 1'), 'los partidos siempre van');
});

test('una hoja por ronda abre una página por fecha', async () => {
  const torneo = modelo.torneos()[0];
  const doc = construirHoja(torneo, {
    tablaNombres: false, reglas: false, posiciones: false, unaHojaPorRonda: true,
  });
  const paginas = textosPorPagina(await comoTexto(doc));
  // El torneo tiene 5 fechas: una por hoja.
  assert.equal(paginas.length, 5);
  paginas.forEach((textos, indice) => {
    assert.ok(textos.join(' ').includes(`FECHA ${indice + 1}`), `la hoja ${indice + 1} no trae su fecha`);
  });
});
