// Modal para anotar el resultado de un partido.
//
// Tiene dos formas de trabajar:
//   Libre:   se escribe el marcador final a mano. No se bloquea nada; si algo
//            no cuadra con las reglas del sistema, se avisa y se puede guardar igual.
//   En vivo: se van sumando los puntos y el motor lleva games, sets y tie-breaks.

import { el, pintar, colorContraste } from '../util.js';
import { guardar } from '../modelo.js';
import {
  maximoSets, reglasDelSet, marcadoresPosibles, ganadorAnotado, advertencias,
  iniciarVivo, anotarPunto, deshacerPunto, textoPuntosVivo, vivoAResultado, setsVisibles,
} from '../anotacion.js';
import { avanzarFixture, ladosDe } from '../fixture.js';
import { nombreLado, equipoPorId } from '../equipos.js';
import { abrirModal, avisar, campo, confirmar, pestanas, lineaLado } from '../ui.js';

/** Abre el modal de resultado de un partido. */
export function modalResultado({ torneo, sistema, partido, alGuardar }) {
  const lados = ladosDe(partido);
  // Cada lado puede ser un equipo o, en el americano, la pareja de esa ronda.
  const equipoA = { ids: lados.a, nombre: nombreLado(torneo, lados.a), color: colorDe(torneo, lados.a) };
  const equipoB = { ids: lados.b, nombre: nombreLado(torneo, lados.b), color: colorDe(torneo, lados.b) };
  const cuerpo = el('div', {});
  const pie = el('div', { class: 'fila', style: 'width:100%;justify-content:flex-end;gap:8px;flex-wrap:wrap' });

  let modo = 'libre';
  let cerrarModal = null;

  const aplicar = (resultado) => {
    partido.resultado = resultado;
    partido.estado = resultado ? 'jugado' : 'pendiente';
    avanzarFixture(torneo, sistema);
    guardar();
    if (cerrarModal) cerrarModal();
    avisar(resultado ? 'Resultado guardado.' : 'Resultado borrado.');
    alGuardar();
  };

  const dibujar = () => {
    const panel = modo === 'libre'
      ? panelLibre({ torneo, sistema, partido, equipoA, equipoB, aplicar, pie })
      : panelVivo({ torneo, sistema, partido, equipoA, equipoB, aplicar, pie });

    pintar(cuerpo, [
      el('div', { class: 'fila-separada', style: 'margin-bottom:16px' }, [
        lineaLado(torneo, lados.a),
        el('span', { class: 'tenue', text: 'vs' }),
        lineaLado(torneo, lados.b, { invertido: true }),
      ]),
      sistema?.tipo === 'sets'
        ? pestanas(
            [{ clave: 'libre', etiqueta: '⌨ Escribir marcador' }, { clave: 'vivo', etiqueta: '🎾 Punto por punto' }],
            modo,
            (clave) => { modo = clave; dibujar(); }
          )
        : null,
      panel,
    ]);
  };

  dibujar();

  cerrarModal = abrirModal({
    titulo: partido.rotulo || 'Resultado',
    ancho: true,
    contenido: () => cuerpo,
    acciones: () => [pie],
  });
}

// ------------------------------------------------------- Marcador escrito

function panelLibre({ torneo, sistema, partido, equipoA, equipoB, aplicar, pie }) {
  const contenedor = el('div', {});
  const aviso = el('div', { class: 'aviso-marcador' });

  if (sistema?.tipo === 'sets') {
    const config = sistema.config;
    // Arrancamos con los sets del sistema, o con los que ya estaban anotados.
    const guardados = partido.resultado?.sets || [];
    const filasIniciales = Math.max(maximoSets(config), guardados.length, 1);
    const valores = Array.from({ length: filasIniciales }, (_, i) => ({
      a: guardados[i] ? String(guardados[i].a) : '',
      b: guardados[i] ? String(guardados[i].b) : '',
    }));

    const zonaSets = el('div', { class: 'sets-entrada' });

    const leer = () => ({
      sets: valores
        .filter((s) => s.a !== '' || s.b !== '')
        .map((s) => ({ a: Number(s.a) || 0, b: Number(s.b) || 0 })),
    });

    const revisar = () => {
      const propuesta = leer();
      if (!propuesta.sets.length) {
        pintar(aviso, el('span', { class: 'tenue', text: 'Escribe el marcador de al menos un set.' }));
        return null;
      }
      pintar(aviso, piezasDeAviso(sistema, propuesta, equipoA, equipoB));
      return propuesta;
    };

    const dibujarSets = () => {
      pintar(zonaSets, [
        ...valores.map((valor, indice) => filaSet({
          valor, indice, config, sistema, alCambiar: revisar,
          alQuitar: valores.length > 1 ? () => {
            valores.splice(indice, 1);
            dibujarSets();
            revisar();
          } : null,
        })),
        el('button', {
          class: 'boton boton-chico boton-fantasma',
          type: 'button',
          text: '+ Otro set',
          onclick: () => { valores.push({ a: '', b: '' }); dibujarSets(); revisar(); },
        }),
      ]);
    };

    dibujarSets();
    pintar(contenedor, [zonaSets, aviso]);
    revisar();
    pintar(pie, botonesPie({ partido, aplicar, obtener: revisar, equipoA, equipoB }));
    return contenedor;
  }

  // Marcador corrido: dos números y listo.
  const esPuntos = sistema?.tipo === 'puntos';
  const etiquetaUnidad = esPuntos ? (sistema.config.etiqueta || 'Puntos') : 'Rondas';

  const entradaA = el('input', { type: 'number', min: '0', inputmode: 'numeric' });
  const entradaB = el('input', { type: 'number', min: '0', inputmode: 'numeric' });
  entradaA.value = partido.resultado?.a ?? '';
  entradaB.value = partido.resultado?.b ?? '';

  const revisar = () => {
    if (entradaA.value === '' && entradaB.value === '') {
      pintar(aviso, el('span', { class: 'tenue', text: 'Escribe el marcador de los dos lados.' }));
      return null;
    }
    const propuesta = { a: Number(entradaA.value) || 0, b: Number(entradaB.value) || 0 };
    pintar(aviso, piezasDeAviso(sistema, propuesta, equipoA, equipoB));
    return propuesta;
  };

  entradaA.addEventListener('input', revisar);
  entradaB.addEventListener('input', revisar);

  pintar(contenedor, [
    el('div', { class: 'campo-fila' }, [
      campo({ etiqueta: `${etiquetaUnidad} · ${equipoA.nombre}`, control: entradaA }),
      campo({ etiqueta: `${etiquetaUnidad} · ${equipoB.nombre}`, control: entradaB }),
    ]),
    aviso,
  ]);
  revisar();
  pintar(pie, botonesPie({ partido, aplicar, obtener: revisar, equipoA, equipoB }));
  return contenedor;
}

/** Una fila de set: dos números libres y, al lado, los marcadores sugeridos. */
function filaSet({ valor, indice, config, sistema, alCambiar, alQuitar }) {
  const reglas = reglasDelSet(indice, config);
  const sugeridos = marcadoresPosibles(reglas).slice(0, 40);
  const idLista = `sugeridos-${indice}`;

  const entrada = (clave) => {
    const nodo = el('input', {
      type: 'number', min: '0', inputmode: 'numeric',
      'aria-label': `${clave === 'a' ? 'Primer' : 'Segundo'} equipo, set ${indice + 1}`,
    });
    nodo.value = valor[clave];
    nodo.addEventListener('input', () => { valor[clave] = nodo.value; alCambiar(); });
    return nodo;
  };

  const rotulo = reglas.esSuperTiebreak ? 'Super TB' : `Set ${indice + 1}`;

  return el('div', { class: 'set-fila' }, [
    el('label', { text: rotulo }),
    entrada('a'),
    el('span', { class: 'tenue', text: '–' }),
    entrada('b'),
    // Atajo: los marcadores habituales de este sistema, por si sirven.
    sugeridos.length
      ? el('select', {
          class: 'sugeridos',
          'aria-label': `Marcadores habituales del set ${indice + 1}`,
          onchange: (evento) => {
            if (!evento.target.value) return;
            const [a, b] = evento.target.value.split('-');
            valor.a = a; valor.b = b;
            const campos = evento.target.closest('.set-fila').querySelectorAll('input');
            campos[0].value = a;
            campos[1].value = b;
            evento.target.value = '';
            alCambiar();
          },
        }, [
          el('option', { value: '', text: 'habituales…' }),
          ...sugeridos.map(([a, b]) => el('option', { value: `${a}-${b}`, text: `${a} - ${b}` })),
        ])
      : null,
    alQuitar
      ? el('button', {
          class: 'boton boton-chico boton-fantasma',
          type: 'button', text: '×',
          title: 'Quitar este set', 'aria-label': 'Quitar este set',
          onclick: alQuitar,
        })
      : null,
  ]);
}

/** Resumen de quién gana más los avisos de lo que no cuadra con las reglas. */
function piezasDeAviso(sistema, propuesta, equipoA, equipoB) {
  const ganador = ganadorAnotado(sistema, propuesta);
  const avisos = advertencias(sistema, propuesta);
  const piezas = [];

  if (ganador) {
    const nombre = ganador === 'A' ? equipoA.nombre : equipoB.nombre;
    piezas.push(el('div', { class: 'marcador-ok', text: `✓ Gana ${nombre}.` }));
  } else {
    piezas.push(el('div', { class: 'marcador-empate', text: 'Queda sin ganador: el partido figura empatado.' }));
  }

  for (const texto of avisos) {
    piezas.push(el('div', { class: 'marcador-ojo', text: `⚠ ${texto}` }));
  }
  if (avisos.length) {
    piezas.push(el('div', { class: 'ayuda', text: 'Puedes guardarlo igual: manda lo que escribas.' }));
  }
  return piezas;
}

/** Botones del pie: borrar, retiro y guardar. */
function botonesPie({ partido, aplicar, obtener, equipoA, equipoB }) {
  return [
    partido.resultado
      ? el('button', {
          class: 'boton boton-peligro boton-chico',
          text: 'Borrar resultado',
          onclick: () => confirmar({
            titulo: 'Borrar el resultado',
            mensaje: 'El partido vuelve a quedar pendiente. Si había equipos que avanzaron por este resultado, hay que volver a anotarlo.',
            textoAceptar: 'Borrar',
            peligro: true,
            alAceptar: () => aplicar(null),
          }),
        })
      : null,
    el('button', {
      class: 'boton boton-chico boton-fantasma',
      text: 'Retiro / no se presentó',
      onclick: () => abrirModal({
        titulo: 'Retiro',
        contenido: () => el('p', { class: 'suave', text: '¿Quién se retiró o no se presentó? El partido se lo lleva el otro.' }),
        acciones: ({ cerrar }) => [
          el('button', {
            class: 'boton',
            text: equipoA.nombre,
            onclick: () => { cerrar(); aplicar({ sets: [], retiro: 'A' }); },
          }),
          el('button', {
            class: 'boton',
            text: equipoB.nombre,
            onclick: () => { cerrar(); aplicar({ sets: [], retiro: 'B' }); },
          }),
        ],
      }),
    }),
    el('button', {
      class: 'boton boton-primario',
      text: 'Guardar',
      onclick: () => {
        const resultado = obtener();
        if (!resultado) return avisar('Escribe el marcador antes de guardar.', 'error');
        aplicar(resultado);
      },
    }),
  ].filter(Boolean);
}

// ------------------------------------------------------------- Punto a punto

function panelVivo({ torneo, sistema, partido, equipoA, equipoB, aplicar, pie }) {
  const contenedor = el('div', { class: 'marcador-vivo' });
  // Si el partido ya tiene resultado, el marcador en vivo parte de cero.
  let vivo = iniciarVivo(sistema);

  const dibujar = () => {
    const puntos = textoPuntosVivo(vivo, sistema);
    const sets = setsVisibles(vivo);

    const columnaEquipo = (ladoLetra, equipo, clave) => el('div', { class: 'marcador-equipo' }, [
      el('span', {
        class: 'escudo escudo-grande',
        style: `background:${equipo.color};color:${colorContraste(equipo.color)}`,
        text: (equipo.nombre || '?').slice(0, 2).toUpperCase(),
      }),
      el('div', { class: 'nombre', text: equipo.nombre }),
      el('div', { class: 'marcador-puntos', text: puntos[clave] }),
      el('div', { class: 'saque', text: vivo.saca === ladoLetra && !vivo.terminado ? '● saca' : '' }),
      el('button', {
        class: 'boton boton-primario',
        style: 'width:100%',
        text: '+ Punto',
        disabled: vivo.terminado,
        onclick: () => { vivo = anotarPunto(vivo, clave, sistema); dibujar(); },
      }),
    ]);

    pintar(contenedor, [
      el('div', { class: 'marcador-sets' }, sets.map((set, indice) => el('div', {
        class: `set-caja ${set.cerrado ? '' : 'encurso'}`,
      }, [
        el('div', { class: 'rotulo', text: reglasDelSet(indice, sistema.config).esSuperTiebreak ? 'Super TB' : `Set ${indice + 1}` }),
        el('div', { class: 'valor', text: `${set.a} - ${set.b}` }),
      ]))),

      el('div', { class: 'marcador-nota', text: puntos.nota }),

      el('div', { class: 'marcador-tablero' }, [
        columnaEquipo('A', equipoA, 'a'),
        el('div', { class: 'marcador-separador', text: '–' }),
        columnaEquipo('B', equipoB, 'b'),
      ]),

      el('div', { class: 'fila', style: 'justify-content:center' }, [
        el('button', {
          class: 'boton boton-chico boton-fantasma',
          text: '↶ Deshacer punto',
          disabled: !vivo.historial.length,
          onclick: () => { vivo = deshacerPunto(vivo); dibujar(); },
        }),
        el('button', {
          class: 'boton boton-chico boton-fantasma',
          text: '↺ Reiniciar',
          onclick: () => { vivo = iniciarVivo(sistema); dibujar(); },
        }),
      ]),

      vivo.terminado
        ? el('div', { class: 'tarjeta', style: 'margin-top:16px;border-color:var(--acento-borde)' }, [
            el('h3', { class: 'nada', text: `🏆 Gana ${(vivo.ganador === 'A' ? equipoA : equipoB).nombre}` }),
            el('p', { class: 'suave nada', text: vivo.setsCerrados.map((s) => `${s.a}-${s.b}`).join('  ') }),
          ])
        : el('p', { class: 'ayuda', text: 'Anota cada punto con los botones. El marcador aplica solo las reglas del sistema elegido.' }),
    ]);

    pintar(pie, [
      el('button', {
        class: 'boton boton-primario',
        text: vivo.terminado ? 'Guardar resultado' : 'Guardar como va',
        disabled: !vivo.setsCerrados.length,
        onclick: () => {
          if (!vivo.terminado) {
            return confirmar({
              titulo: 'El partido no terminó',
              mensaje: `Se van a guardar solo los ${vivo.setsCerrados.length} set(s) cerrados. El set en curso se pierde.`,
              textoAceptar: 'Guardar así',
              alAceptar: () => aplicar(vivoAResultado(vivo)),
            });
          }
          aplicar(vivoAResultado(vivo));
        },
      }),
    ]);
  };

  dibujar();
  return contenedor;
}

/** Color del lado: el del equipo, o el del primero de la pareja. */
function colorDe(torneo, ids) {
  const primero = equipoPorId(torneo, (ids || [])[0]);
  return primero?.color || '#3a4050';
}
