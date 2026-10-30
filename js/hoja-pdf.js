// Dibuja la hoja del torneo en PDF, con la misma estructura que la vista
// previa en pantalla: encabezado, reglas, tabla de nombres, los partidos con
// casilleros para anotar a mano y la tabla de posiciones en blanco.

import { Documento, A4, anchoDeTexto, recortar, repartirEnLineas, descargar } from './pdf.js';
import { deporte, sistema } from './modelo.js';
import { MODALIDADES } from './catalogo.js';
import { reglasLegibles, resumenSistema, maximoSets } from './anotacion.js';
import { partidosPorRonda, ladosDe } from './fixture.js';
import { nombreLado, nombresIntegrantes, esRotativo } from './equipos.js';
import { fechaLegible } from './util.js';
import { letraDe } from './vistas/asignar.js';

const MARGEN = 42;
const NEGRO = 0.1;
const GRIS = 0.42;
const GRIS_CLARO = 0.66;
const BORDE = 0.6;
const FONDO_CABECERA = 0.94;

/** Arma el PDF del torneo y lo descarga. */
export function descargarHojaPdf(torneo, opciones) {
  const doc = construirHoja(torneo, opciones);
  const limpio = torneo.nombre.replace(/[\\/:*?"<>|]/g, '-').trim() || 'torneo';
  descargar(doc.aBlob(), `${limpio}.pdf`);
}

/** Construye el documento; separado para poder probarlo. */
export function construirHoja(torneo, opciones = {}) {
  const dep = deporte(torneo.deporteId);
  const sis = sistema(torneo.sistemaId);
  const modalidad = MODALIDADES.find((m) => m.id === torneo.modalidad);
  const rotativo = esRotativo(torneo);

  const doc = new Documento({ titulo: torneo.nombre });
  const derecha = A4.ancho - MARGEN;
  const anchoUtil = derecha - MARGEN;
  const fondo = A4.alto - MARGEN;

  // `y` es el cursor vertical, de arriba hacia abajo.
  const estado = { y: MARGEN };

  /** Asegura que quede espacio; si no, abre otra página. */
  const asegurar = (altoNecesario) => {
    if (estado.y + altoNecesario <= fondo) return;
    doc.nuevaPagina();
    estado.y = MARGEN;
  };

  const tituloSeccion = (texto) => {
    asegurar(26);
    doc.texto(MARGEN, estado.y + 8, texto.toUpperCase(), { tamano: 8.5, negrita: true, color: GRIS });
    doc.linea(MARGEN, estado.y + 11, derecha, estado.y + 11, { grosor: 1, color: NEGRO });
    estado.y += 20;
  };

  // ------------------------------------------------------------ Encabezado
  doc.texto(MARGEN, estado.y + 13, torneo.nombre, { tamano: 16, negrita: true, color: NEGRO });
  doc.texto(derecha, estado.y + 9, 'Fecha: _______________', { tamano: 9, color: NEGRO, alinear: 'derecha' });
  doc.texto(derecha, estado.y + 20, `Creado el ${fechaLegible(torneo.creado)}`, {
    tamano: 7.5, color: GRIS_CLARO, alinear: 'derecha',
  });
  const subtitulo = [
    dep?.nombre,
    modalidad?.nombre,
    `${torneo.equipos.length} ${rotativo ? 'jugadores' : 'equipos'}`,
    resumenSistema(sis),
  ].filter(Boolean).join('  ·  ');
  doc.texto(MARGEN, estado.y + 26, recortar(subtitulo, anchoUtil - 150, 9), { tamano: 9, color: GRIS });
  estado.y += 32;
  doc.linea(MARGEN, estado.y, derecha, estado.y, { grosor: 1.6, color: NEGRO });
  estado.y += 16;

  // ---------------------------------------------------------------- Reglas
  if (opciones.reglas !== false) {
    tituloSeccion('Cómo se anota');
    for (const regla of reglasLegibles(sis)) {
      for (const linea of repartirEnLineas(regla, anchoUtil - 14, 9)) {
        asegurar(13);
        doc.texto(MARGEN + 14, estado.y + 7, linea, { tamano: 9, color: NEGRO });
        estado.y += 12;
      }
      doc.texto(MARGEN + 5, estado.y - 5, '•', { tamano: 9, color: GRIS });
    }
    estado.y += 8;
  }

  // ------------------------------------------------------- Quién es quién
  if (opciones.tablaNombres !== false) {
    tituloSeccion(rotativo ? 'Quién es cada jugador' : 'Quién es cada equipo');
    const conIntegrantes = !rotativo && opciones.integrantes !== false && torneo.tamanoEquipo > 0;
    const anchoLetra = 26;
    const anchoNombre = conIntegrantes ? (anchoUtil - anchoLetra) * 0.42 : anchoUtil - anchoLetra;
    const anchoIntegrantes = anchoUtil - anchoLetra - anchoNombre;

    const cabecera = [
      { texto: '', ancho: anchoLetra },
      { texto: rotativo ? 'Jugador' : 'Nombre del equipo', ancho: anchoNombre },
      conIntegrantes ? { texto: 'Integrantes', ancho: anchoIntegrantes } : null,
    ].filter(Boolean);

    asegurar(20);
    filaDeCabecera(doc, MARGEN, estado.y, cabecera, 16);
    estado.y += 16;

    torneo.equipos.forEach((equipo, indice) => {
      asegurar(20);
      const letra = equipo.letra || letraDe(indice);
      const nombre = (equipo.nombre || '').trim();
      // Si todavía se llama "Equipo A", en el papel va una línea para escribir.
      const sinNombre = !nombre || /^(equipo|jugador)\s+[A-Z]+$/i.test(nombre);
      const integrantes = nombresIntegrantes(equipo);
      const alto = 18;
      let x = MARGEN;

      doc.rectangulo(x, estado.y, anchoLetra, alto, { relleno: 0.97, borde: BORDE });
      doc.texto(x + anchoLetra / 2, estado.y + 12.5, letra, {
        tamano: 10, negrita: true, color: NEGRO, alinear: 'centro',
      });
      x += anchoLetra;

      doc.rectangulo(x, estado.y, anchoNombre, alto, { borde: BORDE });
      if (sinNombre) doc.linea(x + 6, estado.y + 13, x + anchoNombre - 6, estado.y + 13, { punteada: true, color: GRIS_CLARO });
      else doc.texto(x + 6, estado.y + 12.5, recortar(nombre, anchoNombre - 12, 10), { tamano: 10, color: NEGRO });
      x += anchoNombre;

      if (conIntegrantes) {
        doc.rectangulo(x, estado.y, anchoIntegrantes, alto, { borde: BORDE });
        if (integrantes.length) {
          doc.texto(x + 6, estado.y + 12.5, recortar(integrantes.join(' · '), anchoIntegrantes - 12, 9), {
            tamano: 9, color: GRIS,
          });
        } else {
          // Una línea por integrante que falte.
          const cuantas = Math.max(1, torneo.tamanoEquipo);
          const anchoLinea = (anchoIntegrantes - 12 - (cuantas - 1) * 8) / cuantas;
          for (let i = 0; i < cuantas; i++) {
            const inicio = x + 6 + i * (anchoLinea + 8);
            doc.linea(inicio, estado.y + 13, inicio + anchoLinea, estado.y + 13, { punteada: true, color: GRIS_CLARO });
          }
        }
      }
      estado.y += alto;
    });
    estado.y += 14;
  }

  // -------------------------------------------------------------- Partidos
  const casillas = sis?.tipo === 'sets' ? maximoSets(sis.config) : 1;
  const grupos = partidosPorRonda(torneo.partidos);

  grupos.forEach((grupo, indice) => {
    if (opciones.unaHojaPorRonda && indice > 0) {
      doc.nuevaPagina();
      estado.y = MARGEN;
    }
    tituloSeccion(grupo.rotulo);

    for (const partido of grupo.partidos) {
      const lados = ladosDe(partido);

      if (partido.estado === 'descanso') {
        asegurar(18);
        const quienes = nombreLado(torneo, [...lados.a, ...lados.b]);
        doc.texto(MARGEN + 4, estado.y + 9, `Descansa: ${recortar(quienes, anchoUtil - 70, 9)}`, {
          tamano: 9, color: GRIS,
        });
        estado.y += 16;
        continue;
      }

      const anchoCasilla = 34;
      const anchoGana = 46;
      const anchoEquipo = anchoUtil - casillas * anchoCasilla - anchoGana;
      const altoFila = 19;

      asegurar(14 + altoFila * 2 + 8);

      // Cabecera del partido: Set 1, Set 2... y Gana.
      const columnas = [
        { texto: '', ancho: anchoEquipo },
        ...Array.from({ length: casillas }, (_, i) => ({
          texto: rotuloCasilla(sis, i),
          ancho: anchoCasilla,
          centrado: true,
        })),
        { texto: 'Gana', ancho: anchoGana, centrado: true },
      ];
      filaDeCabecera(doc, MARGEN, estado.y, columnas, 14);
      estado.y += 14;

      for (const ids of [lados.a, lados.b]) {
        let x = MARGEN;
        doc.rectangulo(x, estado.y, anchoEquipo, altoFila, { borde: BORDE });
        if (ids.length) {
          doc.texto(x + 6, estado.y + 13, recortar(nombreLado(torneo, ids), anchoEquipo - 12, 10, true), {
            tamano: 10, negrita: true, color: NEGRO,
          });
        } else {
          // Todavía no se sabe quién juega: línea para escribirlo.
          doc.linea(x + 6, estado.y + 13.5, x + anchoEquipo - 6, estado.y + 13.5, { punteada: true, color: GRIS_CLARO });
        }
        x += anchoEquipo;

        for (let i = 0; i < casillas; i++) {
          doc.rectangulo(x, estado.y, anchoCasilla, altoFila, { borde: BORDE });
          x += anchoCasilla;
        }
        doc.rectangulo(x, estado.y, anchoGana, altoFila, { relleno: 0.97, borde: BORDE });
        estado.y += altoFila;
      }
      estado.y += 9;
    }
  });

  // ---------------------------------------------------------- Posiciones
  const conTabla = ['roundRobin', 'grupos', 'suizo', 'americano'].includes(torneo.modalidad);
  if (opciones.posiciones !== false && conTabla) {
    const esSets = sis?.tipo === 'sets';
    const columnas = ['PJ', 'G', 'P', esSets ? 'Sets' : 'Favor', esSets ? 'Games' : 'Contra', 'Pts'];
    const anchoLetra = 26;
    const anchoDato = 38;
    const anchoNombre = anchoUtil - anchoLetra - columnas.length * anchoDato;

    tituloSeccion(rotativo ? 'Tabla individual' : 'Tabla de posiciones');
    asegurar(20);
    filaDeCabecera(doc, MARGEN, estado.y, [
      { texto: '', ancho: anchoLetra },
      { texto: rotativo ? 'Jugador' : 'Equipo', ancho: anchoNombre },
      ...columnas.map((c) => ({ texto: c, ancho: anchoDato, centrado: true })),
    ], 16);
    estado.y += 16;

    torneo.equipos.forEach((equipo, indice) => {
      asegurar(20);
      const alto = 18;
      let x = MARGEN;
      doc.rectangulo(x, estado.y, anchoLetra, alto, { relleno: 0.97, borde: BORDE });
      doc.texto(x + anchoLetra / 2, estado.y + 12.5, equipo.letra || letraDe(indice), {
        tamano: 10, negrita: true, color: NEGRO, alinear: 'centro',
      });
      x += anchoLetra;

      doc.rectangulo(x, estado.y, anchoNombre, alto, { borde: BORDE });
      const nombre = (equipo.nombre || '').trim();
      const sinNombre = !nombre || /^(equipo|jugador)\s+[A-Z]+$/i.test(nombre);
      if (!sinNombre) {
        doc.texto(x + 6, estado.y + 12.5, recortar(nombre, anchoNombre - 12, 10), { tamano: 10, color: NEGRO });
      }
      x += anchoNombre;

      for (let i = 0; i < columnas.length; i++) {
        doc.rectangulo(x, estado.y, anchoDato, alto, { borde: BORDE });
        x += anchoDato;
      }
      estado.y += alto;
    });
    estado.y += 12;
  }

  // -------------------------------------------------------------------- Pie
  // Va en el margen de cada hoja, así que no ocupa lugar ni abre páginas nuevas.
  const total = doc.cantidadDePaginas;
  const yPie = A4.alto - MARGEN + 16;
  for (let i = 0; i < total; i++) {
    doc.irAPagina(i);
    doc.linea(MARGEN, yPie - 9, derecha, yPie - 9, { grosor: 0.5, color: 0.84 });
    doc.texto(MARGEN, yPie, recortar(torneo.nombre, anchoUtil / 2, 7.5), {
      tamano: 7.5, color: GRIS_CLARO,
    });
    doc.texto(A4.ancho / 2, yPie, 'Anotado a mano · después se carga en la aplicación', {
      tamano: 7.5, color: GRIS_CLARO, alinear: 'centro',
    });
    if (total > 1) {
      doc.texto(derecha, yPie, `Página ${i + 1} de ${total}`, {
        tamano: 7.5, color: GRIS_CLARO, alinear: 'derecha',
      });
    }
  }

  return doc;
}

/** Fila de cabecera gris con los rótulos de las columnas. */
function filaDeCabecera(doc, x0, y, columnas, alto) {
  let x = x0;
  for (const columna of columnas) {
    doc.rectangulo(x, y, columna.ancho, alto, { relleno: FONDO_CABECERA, borde: BORDE });
    if (columna.texto) {
      const centro = columna.centrado;
      doc.texto(centro ? x + columna.ancho / 2 : x + 6, y + alto - 4.5, columna.texto.toUpperCase(), {
        tamano: 7, negrita: true, color: GRIS, alinear: centro ? 'centro' : 'izquierda',
      });
    }
    x += columna.ancho;
  }
}

/** Rótulo de cada casillero: Set 1, Set 2, Super TB o la unidad del marcador. */
function rotuloCasilla(sis, indice) {
  if (sis?.tipo !== 'sets') return sis?.config?.etiqueta || 'Puntos';
  const total = maximoSets(sis.config);
  if (sis.config.ultimoSetSuperTiebreak && indice === total - 1) return 'S.TB';
  return `Set ${indice + 1}`;
}
