// Hojas para imprimir un torneo y anotarlo a mano en la cancha.
//
// La idea: se imprime el torneo con los cruces ya sorteados, se juega anotando
// con lápiz, y después se vuelve a la aplicación a cargar los resultados. Si los
// equipos todavía no tienen nombre, salen como letras y la hoja trae una tabla
// para escribir a quién corresponde cada una.

import { el, pintar, fechaLegible } from '../util.js';
import { torneo as buscarTorneo, deporte, sistema } from '../modelo.js';
import { MODALIDADES } from '../catalogo.js';
import { reglasLegibles, resumenSistema, maximoSets } from '../anotacion.js';
import { partidosPorRonda, ladosDe } from '../fixture.js';
import { nombreLado, nombresIntegrantes, esRotativo } from '../equipos.js';
import { vacio, casilla, avisar } from '../ui.js';
import { letraDe } from './asignar.js';
import { descargarHojaPdf } from '../hoja-pdf.js';

/** Opciones de impresión; se recuerdan mientras dure la sesión. */
const opciones = {
  tablaNombres: true,
  reglas: true,
  posiciones: true,
  unaHojaPorRonda: false,
  integrantes: true,
};

export function vistaImprimir(idTorneo) {
  const torneo = buscarTorneo(idTorneo);
  if (!torneo) {
    return vacio({
      icono: '🔍',
      titulo: 'No encontramos ese torneo',
      accion: el('a', { class: 'boton boton-primario', href: '#/', text: 'Ver mis torneos' }),
    });
  }

  const hoja = el('div', { class: 'hoja' });
  const dibujarHoja = () => pintar(hoja, armarHoja(torneo));
  dibujarHoja();

  const controles = el('div', { class: 'tarjeta no-imprimir' }, [
    el('div', { class: 'tarjeta-titulo' }, [
      el('div', {}, [
        el('h2', { class: 'nada', text: 'Hoja para anotar a mano' }),
        el('small', { class: 'tenue', text: 'Elige qué incluir y dale a imprimir. Lo de abajo es la vista previa.' }),
      ]),
      el('div', { class: 'fila' }, [
        el('a', { class: 'boton boton-fantasma', href: `#/torneo/${torneo.id}`, text: '← Volver al torneo' }),
        el('button', {
          class: 'boton',
          text: '⬇ Descargar PDF',
          onclick: () => {
            descargarHojaPdf(torneo, opciones);
            avisar('PDF descargado.');
          },
        }),
        el('button', { class: 'boton boton-primario', text: '🖨 Imprimir', onclick: () => window.print() }),
      ]),
    ]),
    el('div', { class: 'opciones-impresion' }, [
      casilla({
        texto: 'Tabla para escribir los nombres',
        marcada: opciones.tablaNombres,
        alCambiar: (v) => { opciones.tablaNombres = v; dibujarHoja(); },
      }),
      casilla({
        texto: 'Integrantes de cada equipo',
        marcada: opciones.integrantes,
        alCambiar: (v) => { opciones.integrantes = v; dibujarHoja(); },
      }),
      casilla({
        texto: 'Reglas de anotación',
        marcada: opciones.reglas,
        alCambiar: (v) => { opciones.reglas = v; dibujarHoja(); },
      }),
      casilla({
        texto: 'Tabla de posiciones en blanco',
        marcada: opciones.posiciones,
        alCambiar: (v) => { opciones.posiciones = v; dibujarHoja(); },
      }),
      casilla({
        texto: 'Una hoja por ronda',
        marcada: opciones.unaHojaPorRonda,
        alCambiar: (v) => { opciones.unaHojaPorRonda = v; dibujarHoja(); },
      }),
    ]),
  ]);

  return [controles, hoja];
}

// ------------------------------------------------------------- La hoja

function armarHoja(torneo) {
  const dep = deporte(torneo.deporteId);
  const sis = sistema(torneo.sistemaId);
  const modalidad = MODALIDADES.find((m) => m.id === torneo.modalidad);
  const rotativo = esRotativo(torneo);
  const piezas = [];

  piezas.push(el('header', { class: 'hoja-cabecera' }, [
    el('div', {}, [
      el('h1', { text: torneo.nombre }),
      el('p', { class: 'hoja-sub', text: [
        dep?.nombre,
        modalidad?.nombre,
        `${torneo.equipos.length} ${rotativo ? 'jugadores' : 'equipos'}`,
        resumenSistema(sis),
      ].filter(Boolean).join('  ·  ') }),
    ]),
    el('div', { class: 'hoja-fecha' }, [
      el('div', { text: 'Fecha: ______________' }),
      el('div', { class: 'tenue-papel', text: `Creado el ${fechaLegible(torneo.creado)}` }),
    ]),
  ]));

  if (opciones.reglas) {
    piezas.push(el('section', { class: 'bloque' }, [
      el('h2', { text: 'Cómo se anota' }),
      el('ul', { class: 'lista-papel' }, reglasLegibles(sis).map((linea) => el('li', { text: linea }))),
    ]));
  }

  if (opciones.tablaNombres) {
    piezas.push(tablaDeNombres(torneo, rotativo));
  }

  piezas.push(...bloquesDePartidos(torneo, sis));

  if (opciones.posiciones && ['roundRobin', 'grupos', 'suizo', 'americano'].includes(torneo.modalidad)) {
    piezas.push(tablaPosicionesBlanco(torneo, sis, rotativo));
  }

  piezas.push(el('footer', { class: 'hoja-pie' }, [
    'Anotado a mano · después se carga en la aplicación',
  ]));

  return piezas;
}

/** Tabla de letras: a quién corresponde cada equipo o jugador. */
function tablaDeNombres(torneo, rotativo) {
  const tamano = rotativo ? 0 : torneo.tamanoEquipo;

  const filas = torneo.equipos.map((equipo, indice) => {
    const letra = equipo.letra || letraDe(indice);
    const integrantes = nombresIntegrantes(equipo);
    const nombrePuesto = (equipo.nombre || '').trim();
    // Si el equipo se llama "Equipo A" todavía no tiene nombre de verdad.
    const sinNombre = !nombrePuesto || /^(equipo|jugador)\s+[A-Z]+$/i.test(nombrePuesto);

    return el('tr', {}, [
      el('td', { class: 'celda-letra', text: letra }),
      el('td', { class: 'celda-nombre' }, [
        sinNombre ? el('span', { class: 'linea-para-escribir' }) : el('span', { text: nombrePuesto }),
      ]),
      tamano && opciones.integrantes
        ? el('td', { class: 'celda-integrantes' }, [
            integrantes.length
              ? el('span', { text: integrantes.join(' · ') })
              : el('span', {}, Array.from({ length: tamano }, () => el('span', { class: 'linea-para-escribir corta' }))),
          ])
        : null,
    ].filter(Boolean));
  });

  return el('section', { class: 'bloque' }, [
    el('h2', { text: rotativo ? 'Quién es cada jugador' : 'Quién es cada equipo' }),
    el('table', { class: 'tabla-papel' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { style: 'width:34px', text: '' }),
        el('th', { text: rotativo ? 'Jugador' : 'Nombre del equipo' }),
        tamano && opciones.integrantes ? el('th', { text: 'Integrantes' }) : null,
      ].filter(Boolean))]),
      el('tbody', {}, filas),
    ]),
  ]);
}

/** Los partidos agrupados por ronda, con casilleros para el marcador. */
function bloquesDePartidos(torneo, sis) {
  const grupos = partidosPorRonda(torneo.partidos);
  const casillas = sis?.tipo === 'sets' ? maximoSets(sis.config) : 1;

  return grupos.map((grupo, indice) => el('section', {
    class: `bloque ${opciones.unaHojaPorRonda && indice > 0 ? 'salto-de-hoja' : ''}`,
  }, [
    el('h2', { text: grupo.rotulo }),
    el('div', { class: 'partidos-papel' },
      grupo.partidos.map((partido) => partidoPapel(torneo, partido, casillas, sis))),
  ]));
}

function partidoPapel(torneo, partido, casillas, sis) {
  const lados = ladosDe(partido);

  if (partido.estado === 'descanso') {
    const quienes = nombreLado(torneo, [...lados.a, ...lados.b]);
    return el('div', { class: 'partido-papel descansa' }, [
      el('span', { text: `Descansa: ${quienes}` }),
    ]);
  }

  const etiquetaCasilla = (indice) => {
    if (sis?.tipo !== 'sets') return sis?.config?.etiqueta || 'Puntos';
    const total = maximoSets(sis.config);
    if (sis.config.ultimoSetSuperTiebreak && indice === total - 1) return 'S.TB';
    return `Set ${indice + 1}`;
  };

  // Si todavía no se sabe quién juega (llaves), va una línea para escribirlo.
  const filaLado = (ids) => el('tr', {}, [
    el('td', { class: 'celda-equipo' }, [
      ids.length
        ? el('span', { text: nombreLado(torneo, ids) })
        : el('span', { class: 'linea-para-escribir' }),
    ]),
    ...Array.from({ length: casillas }, () => el('td', { class: 'casilla-marcador' })),
    el('td', { class: 'casilla-ganador' }),
  ]);

  return el('table', { class: 'tabla-partido' }, [
    el('thead', {}, [el('tr', {}, [
      el('th', { class: 'celda-equipo' }),
      ...Array.from({ length: casillas }, (_, i) => el('th', { class: 'casilla-marcador', text: etiquetaCasilla(i) })),
      el('th', { class: 'casilla-ganador', text: 'Gana' }),
    ])]),
    el('tbody', {}, [filaLado(lados.a), filaLado(lados.b)]),
  ]);
}

/** Tabla de posiciones vacía, para ir llevándola a mano. */
function tablaPosicionesBlanco(torneo, sis, rotativo) {
  const esSets = sis?.tipo === 'sets';
  const columnas = ['PJ', 'G', 'P', esSets ? 'Sets' : 'Favor', esSets ? 'Games' : 'Contra', 'Pts'];

  const filas = torneo.equipos.map((equipo, indice) => el('tr', {}, [
    el('td', { class: 'celda-letra', text: equipo.letra || letraDe(indice) }),
    el('td', { class: 'celda-nombre' }, [
      el('span', { text: (equipo.nombre || '').trim() || '' }),
    ]),
    ...columnas.map(() => el('td', { class: 'casilla-marcador' })),
  ]));

  return el('section', { class: 'bloque' }, [
    el('h2', { text: rotativo ? 'Tabla individual' : 'Tabla de posiciones' }),
    el('table', { class: 'tabla-papel' }, [
      el('thead', {}, [el('tr', {}, [
        el('th', { style: 'width:34px' }),
        el('th', { text: rotativo ? 'Jugador' : 'Equipo' }),
        ...columnas.map((c) => el('th', { class: 'casilla-marcador', text: c })),
      ])]),
      el('tbody', {}, filas),
    ]),
  ]);
}
