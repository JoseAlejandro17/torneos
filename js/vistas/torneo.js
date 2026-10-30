// Pantalla de un torneo: calendario, llave, tablas, equipos y reglas.

import { el, pintar, iniciales, colorContraste } from '../util.js';
import {
  torneo as buscarTorneo, deporte, sistema, guardar, editarTorneo, borrarTorneo,
} from '../modelo.js';
import { MODALIDADES } from '../catalogo.js';
import {
  generarFixture, avanzarFixture, tablaPosiciones, tablasPorGrupo,
  resumenTorneo, partidosPorRonda, ganadorDePartido, siguienteRondaSuiza,
  ladosDe, ganadorLado,
} from '../fixture.js';
import { reglasLegibles, resumenSistema, textoResultado } from '../anotacion.js';
import {
  nombreEquipo, subtituloEquipo, nombresIntegrantes, equipoPorId, nombreLado, esRotativo,
} from '../equipos.js';
import {
  abrirModal, confirmar, avisar, etiqueta, vacio, barraAvance, pestanas,
  lineaEquipo, lineaLado, escudo, campo,
} from '../ui.js';
import { modalAsignarNombres } from './asignar.js';
import { ir } from '../app.js';
import { modalResultado } from './resultado.js';

/** Pestaña abierta, recordada entre redibujados. */
const pestanaPorTorneo = new Map();

export function vistaTorneo(idTorneo) {
  const torneo = buscarTorneo(idTorneo);
  if (!torneo) {
    return vacio({
      icono: '🔍',
      titulo: 'No encontramos ese torneo',
      mensaje: 'Puede que lo hayas borrado.',
      accion: el('a', { class: 'boton boton-primario', href: '#/', text: 'Ver mis torneos' }),
    });
  }

  const dep = deporte(torneo.deporteId);
  const sis = sistema(torneo.sistemaId);
  const modalidad = MODALIDADES.find((m) => m.id === torneo.modalidad);
  const resumen = resumenTorneo(torneo, sis);

  const contenedor = el('div', {});

  const disponibles = [
    { clave: 'calendario', etiqueta: '📅 Calendario' },
    torneo.partidos.some((p) => p.fase === 'llave' || p.fase === 'tercerPuesto')
      ? { clave: 'llave', etiqueta: '🏆 Llave' } : null,
    ['roundRobin', 'grupos', 'suizo', 'americano'].includes(torneo.modalidad)
      ? { clave: 'tabla', etiqueta: '📊 Posiciones' } : null,
    { clave: 'equipos', etiqueta: esRotativo(torneo) ? '👥 Jugadores' : '👥 Equipos' },
    { clave: 'reglas', etiqueta: '📏 Reglas' },
  ].filter(Boolean);

  const dibujar = () => {
    let activa = pestanaPorTorneo.get(torneo.id) || 'calendario';
    if (!disponibles.some((p) => p.clave === activa)) activa = 'calendario';

    const cuerpo = {
      calendario: () => panelCalendario(torneo, sis, dibujar),
      llave: () => panelLlave(torneo, sis, dibujar),
      tabla: () => panelTablas(torneo, sis),
      equipos: () => panelEquipos(torneo),
      reglas: () => panelReglas(torneo, dep, sis, modalidad),
    }[activa]();

    pintar(contenedor, [
      cabeceraTorneo(torneo, dep, sis, modalidad, resumenTorneo(torneo, sis), dibujar),
      pestanas(disponibles, activa, (clave) => {
        pestanaPorTorneo.set(torneo.id, clave);
        dibujar();
      }),
      cuerpo,
    ]);
  };

  dibujar();
  return contenedor;
}

// --------------------------------------------------------------- Cabecera

function cabeceraTorneo(torneo, dep, sis, modalidad, resumen, dibujar) {
  const piezas = [];

  if (resumen.terminado && resumen.campeon) {
    const campeon = equipoPorId(torneo, resumen.campeon);
    const sub = resumen.subcampeon ? equipoPorId(torneo, resumen.subcampeon) : null;
    const tercero = resumen.tercero ? equipoPorId(torneo, resumen.tercero) : null;
    piezas.push(el('div', { class: 'banner-campeon' }, [
      el('div', { style: 'font-size:2.4rem', text: '🏆' }),
      el('h2', { class: 'nada', text: `¡${nombreEquipo(torneo, campeon)} campeón!` }),
      // En el americano el "equipo" es la persona: no repetimos el nombre.
      !esRotativo(torneo) && nombresIntegrantes(campeon).length
        ? el('p', { class: 'suave nada', text: nombresIntegrantes(campeon).join(' · ') })
        : null,
      el('div', { class: 'podio' }, [
        sub ? puestoPodio('🥈', '2º', nombreEquipo(torneo, sub)) : null,
        tercero ? puestoPodio('🥉', '3º', nombreEquipo(torneo, tercero)) : null,
      ]),
    ]));
  }

  piezas.push(el('div', { class: 'encabezado-pagina' }, [
    el('div', {}, [
      el('div', { class: 'fila', style: 'margin-bottom:4px' }, [
        el('a', { href: '#/', class: 'tenue', style: 'font-size:0.85rem', text: '← Torneos' }),
      ]),
      el('h1', { class: 'nada', text: `${dep?.icono || ''} ${torneo.nombre}` }),
      el('div', { class: 'fila', style: 'margin-top:8px' }, [
        etiqueta(modalidad?.nombre || torneo.modalidad),
        etiqueta(resumenSistema(sis)),
        etiqueta(`${torneo.equipos.length} ${esRotativo(torneo) ? 'jugadores' : 'equipos'}`),
        resumen.terminado
          ? etiqueta('Terminado', 'acento')
          : torneo.partidos.length ? etiqueta('En curso', 'azul') : etiqueta('Sin calendario', 'aviso'),
      ]),
    ]),
    el('div', { class: 'fila' }, [
      torneo.partidos.length
        ? el('a', {
            class: 'boton boton-chico',
            href: `#/torneo/${torneo.id}/imprimir`,
            text: '🖨 Imprimir',
            title: 'Hojas para anotar los resultados a mano',
          })
        : null,
      el('button', {
        class: 'boton boton-chico',
        text: esRotativo(torneo) ? '✏ Nombres' : '✏ Asignar nombres',
        title: 'Ponerle nombre a cada letra y asignar integrantes',
        onclick: () => modalAsignarNombres({ torneo, alGuardar: dibujar }),
      }),
      el('button', {
        class: 'boton boton-chico',
        text: 'Renombrar',
        onclick: () => renombrar(torneo, dibujar),
      }),
      el('button', {
        class: 'boton boton-chico boton-peligro',
        text: 'Borrar',
        onclick: () => confirmar({
          titulo: 'Borrar torneo',
          mensaje: `Se borra "${torneo.nombre}" con todos sus partidos.`,
          textoAceptar: 'Borrar',
          peligro: true,
          alAceptar: () => { borrarTorneo(torneo.id); avisar('Torneo borrado.'); ir('/'); },
        }),
      }),
    ]),
  ]));

  if (torneo.partidos.length) {
    piezas.push(el('div', { class: 'tarjeta', style: 'padding:14px;margin-bottom:20px' }, [
      barraAvance(resumen.jugados, resumen.total),
    ]));
  }

  return el('div', {}, piezas);
}

function puestoPodio(medalla, puesto, nombre) {
  return el('div', { class: 'podio-puesto' }, [
    el('div', { class: 'medalla', text: medalla }),
    el('small', { class: 'tenue', text: puesto }),
    el('div', { class: 'nombre', text: nombre }),
  ]);
}

function renombrar(torneo, dibujar) {
  const entrada = el('input', { type: 'text', valor: torneo.nombre });
  abrirModal({
    titulo: 'Renombrar torneo',
    contenido: () => el('div', { class: 'campo' }, [entrada]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: 'Guardar',
        onclick: () => {
          if (!entrada.value.trim()) return avisar('El nombre no puede quedar vacío.', 'error');
          editarTorneo(torneo.id, { nombre: entrada.value.trim() });
          cerrar();
          dibujar();
        },
      }),
    ],
  });
}

// ------------------------------------------------------------- Calendario

function panelCalendario(torneo, sis, dibujar) {
  if (!torneo.partidos.length) {
    return vacio({
      icono: '📅',
      titulo: 'El calendario todavía no está generado',
      mensaje: 'Al generarlo se arman los cruces según la modalidad elegida.',
      accion: el('button', {
        class: 'boton boton-primario boton-grande',
        text: 'Generar calendario',
        onclick: () => {
          torneo.partidos = generarFixture(torneo);
          avanzarFixture(torneo, sis);
          torneo.estado = 'enCurso';
          guardar();
          avisar('Calendario generado.');
          dibujar();
        },
      }),
    });
  }

  const grupos = partidosPorRonda(torneo.partidos);
  const piezas = [];

  // En el sistema suizo se van agregando rondas a medida que se cierran.
  if (torneo.modalidad === 'suizo') {
    const pendientes = siguienteRondaSuiza(torneo, sis);
    const rondasPedidas = Number(torneo.opciones?.rondas) || 3;
    const rondasHechas = new Set(torneo.partidos.map((p) => p.ronda)).size;
    if (pendientes.length) {
      piezas.push(el('div', { class: 'tarjeta', style: 'margin-bottom:16px' }, [
        el('div', { class: 'fila-separada' }, [
          el('div', {}, [
            el('strong', { text: `Ronda ${rondasHechas + 1} lista para emparejar` }),
            el('div', { class: 'ayuda', text: 'Se cruzan los equipos con puntaje parecido, sin repetir rivales.' }),
          ]),
          el('button', {
            class: 'boton boton-primario',
            text: 'Emparejar la siguiente ronda',
            onclick: () => {
              torneo.partidos.push(...siguienteRondaSuiza(torneo, sis));
              guardar();
              avisar('Ronda emparejada.');
              dibujar();
            },
          }),
        ]),
      ]));
    } else if (rondasHechas < rondasPedidas) {
      piezas.push(el('p', { class: 'ayuda', text: `Faltan resultados de la ronda ${rondasHechas} para emparejar la siguiente.` }));
    }
  }

  for (const grupo of grupos) {
    piezas.push(el('div', { class: 'ronda-titulo', text: grupo.rotulo }));
    for (const partido of grupo.partidos) {
      piezas.push(filaPartido(torneo, sis, partido, dibujar));
    }
  }

  piezas.push(el('div', { class: 'separador' }));
  piezas.push(el('div', { class: 'fila' }, [
    el('button', {
      class: 'boton boton-chico boton-peligro',
      text: '↺ Regenerar calendario',
      onclick: () => confirmar({
        titulo: 'Regenerar el calendario',
        mensaje: 'Se vuelven a armar los cruces y se pierden todos los resultados anotados.',
        textoAceptar: 'Regenerar',
        peligro: true,
        alAceptar: () => {
          torneo.partidos = generarFixture(torneo);
          avanzarFixture(torneo, sis);
          guardar();
          avisar('Calendario regenerado.');
          dibujar();
        },
      }),
    }),
  ]));

  return el('div', {}, piezas);
}

/** Una fila de partido con su marcador y el botón para anotar. */
function filaPartido(torneo, sis, partido, dibujar) {
  const lados = ladosDe(partido);
  const lado = ganadorLado(partido, sis);

  if (partido.estado === 'descanso') {
    const descansan = [...lados.a, ...lados.b];
    return el('div', { class: 'partido descanso' }, [
      lineaLado(torneo, descansan),
      el('div', { class: 'centro' }, [
        el('small', { class: 'tenue', text: descansan.length > 1 ? 'descansan' : 'descansa' }),
      ]),
      el('div', {}),
    ]);
  }

  const completo = lados.a.length && lados.b.length;

  const centro = partido.resultado
    ? el('div', { class: 'centro' }, [
        el('div', { class: 'marcador', text: textoResultado(sis, partido.resultado) }),
        el('small', { class: 'tenue', text: 'editar' }),
      ])
    : el('div', { class: 'centro' }, [
        el('button', { class: 'boton boton-chico boton-primario', text: 'Anotar', disabled: !completo }),
      ]);

  const abrir = () => {
    if (!completo) return avisar('Este partido todavía espera a los equipos de rondas anteriores.', 'atencion');
    modalResultado({ torneo, sistema: sis, partido, alGuardar: dibujar });
  };

  const fila = el('div', { class: `partido ${partido.resultado ? 'jugado' : ''}`, style: 'cursor:pointer' }, [
    el('div', { class: `lado ${lado === 'A' ? 'ganador' : ''}` }, [lineaLado(torneo, lados.a)]),
    centro,
    el('div', { class: `lado derecho ${lado === 'B' ? 'ganador' : ''}` }, [
      lineaLado(torneo, lados.b, { invertido: true }),
    ]),
  ]);
  fila.addEventListener('click', abrir);
  return fila;
}

// ------------------------------------------------------------------ Llave

function panelLlave(torneo, sis, dibujar) {
  const deLlave = torneo.partidos.filter((p) => p.fase === 'llave');
  const porTercero = torneo.partidos.filter((p) => p.fase === 'tercerPuesto');
  const rondas = [...new Set(deLlave.map((p) => p.ronda))].sort((a, b) => a - b);

  return el('div', {}, [
    el('div', { class: 'llave' }, rondas.map((ronda) => {
      const partidos = deLlave.filter((p) => p.ronda === ronda).sort((x, y) => x.orden - y.orden);
      return el('div', { class: 'llave-ronda' }, [
        el('h4', { text: partidos[0]?.rotulo || `Ronda ${ronda + 1}` }),
        ...partidos.map((partido) => tarjetaLlave(torneo, sis, partido, dibujar)),
      ]);
    })),
    porTercero.length
      ? el('div', {}, [
          el('div', { class: 'ronda-titulo', text: 'Tercer lugar' }),
          ...porTercero.map((partido) => filaPartido(torneo, sis, partido, dibujar)),
        ])
      : null,
  ]);
}

function tarjetaLlave(torneo, sis, partido, dibujar) {
  const ganador = ganadorDePartido(partido, sis);
  const sets = partido.resultado?.sets || [];

  const lado = (ladoLetra) => {
    const equipo = equipoPorId(torneo, partido[`equipo${ladoLetra}`]);
    const esGanador = ganador && ganador === partido[`equipo${ladoLetra}`];
    const puntos = partido.resultado
      ? (sis?.tipo === 'sets'
          ? sets.map((s) => (ladoLetra === 'A' ? s.a : s.b)).join(' ')
          : String(ladoLetra === 'A' ? partido.resultado.a : partido.resultado.b))
      : '';
    return el('div', { class: `llave-equipo ${esGanador ? 'gana' : ''}` }, [
      el('div', { class: 'fila', style: 'gap:7px;min-width:0' }, [
        escudo(torneo, equipo, 'escudo-chico'),
        equipo
          ? el('span', { class: 'nombre', text: nombreEquipo(torneo, equipo) })
          : el('span', { class: 'llave-vacio', text: pistaOrigen(partido, ladoLetra) }),
      ]),
      el('span', { class: 'puntos', text: puntos }),
    ]);
  };

  return el('div', {
    class: 'llave-partido',
    onclick: () => {
      if (!partido.equipoA || !partido.equipoB) {
        return avisar('Este partido espera a los ganadores de la ronda anterior.', 'atencion');
      }
      modalResultado({ torneo, sistema: sis, partido, alGuardar: dibujar });
    },
  }, [lado('A'), lado('B')]);
}

/** Texto de quién va a ocupar un lado todavía vacío. */
function pistaOrigen(partido, ladoLetra) {
  const origen = partido[`origen${ladoLetra}`];
  if (!origen) return 'Descansa';
  if (origen.tipo === 'ganador') return 'Ganador anterior';
  if (origen.tipo === 'perdedor') return 'Perdedor de semis';
  if (origen.tipo === 'posicionGrupo') return `${origen.posicion}º del grupo ${origen.grupo}`;
  if (origen.tipo === 'posicionTabla') return `${origen.posicion}º de la tabla`;
  return 'Por definir';
}

// --------------------------------------------------------------- Posiciones

function panelTablas(torneo, sis) {
  if (torneo.modalidad === 'grupos') {
    const tablas = tablasPorGrupo(torneo, sis);
    const clasifican = Number(torneo.opciones?.clasificanPorGrupo) || 2;
    const entradas = Object.entries(tablas);
    if (!entradas.length) {
      return vacio({ icono: '📊', titulo: 'Sin tabla todavía', mensaje: 'Genera el calendario para ver las posiciones.' });
    }
    return el('div', { class: 'apilado' }, entradas.map(([letra, tabla]) =>
      el('div', { class: 'tarjeta' }, [
        el('h3', { text: `Grupo ${letra}` }),
        tablaDePosiciones(torneo, sis, tabla, clasifican),
      ])
    ));
  }

  const tabla = tablaPosiciones(torneo, sis, (p) => p.fase !== 'llave' && p.fase !== 'tercerPuesto');
  const rotativo = esRotativo(torneo);
  return el('div', { class: 'tarjeta' }, [
    el('h3', { text: rotativo ? 'Tabla individual' : 'Tabla de posiciones' }),
    rotativo
      ? el('p', { class: 'ayuda', style: 'margin-top:-4px', text: 'Cada jugador suma lo que hace con todos sus compañeros. Gana el que más partidos se lleva.' })
      : null,
    tablaDePosiciones(torneo, sis, tabla, torneo.opciones?.playoffFinal ? 2 : 0),
  ]);
}

function tablaDePosiciones(torneo, sis, tabla, clasifican) {
  const rotativo = esRotativo(torneo);
  const esSets = sis?.tipo === 'sets';
  const unidadMayor = esSets ? 'Sets' : (sis?.config?.etiqueta || 'Pts');
  const unidadMenor = esSets ? (sis?.config?.etiquetaGame === 'punto' ? 'Puntos' : 'Games') : null;
  const hayEmpates = tabla.some((f) => f.empatados > 0);
  const hayDescansos = tabla.some((f) => f.descansos > 0);

  const cabeceras = [
    el('th', { class: 'num', text: '#' }),
    el('th', { text: rotativo ? 'Jugador' : 'Equipo' }),
    el('th', { class: 'num', title: 'Puntos', text: 'Pts' }),
    el('th', { class: 'num', title: 'Partidos jugados', text: 'PJ' }),
    el('th', { class: 'num', title: 'Ganados', text: 'G' }),
    hayEmpates ? el('th', { class: 'num', title: 'Empatados', text: 'E' }) : null,
    el('th', { class: 'num', title: 'Perdidos', text: 'P' }),
    hayDescansos ? el('th', { class: 'num', title: 'Descansos', text: 'Desc' }) : null,
    el('th', { class: 'num', title: `${unidadMayor} a favor y en contra`, text: unidadMayor }),
    unidadMenor ? el('th', { class: 'num', title: `${unidadMenor} a favor y en contra`, text: unidadMenor }) : null,
  ].filter(Boolean);

  const filas = tabla.map((fila) => {
    const equipo = equipoPorId(torneo, fila.equipoId);
    return el('tr', { class: clasifican && fila.posicion <= clasifican ? 'clasifica' : '' }, [
      el('td', { class: 'num mono', text: String(fila.posicion) }),
      el('td', {}, [lineaEquipo(torneo, equipo, { tamano: 'escudo-chico', mostrarSub: false })]),
      el('td', { class: 'num mono', style: 'font-weight:700', text: String(fila.puntos) }),
      el('td', { class: 'num mono', text: String(fila.jugados) }),
      el('td', { class: 'num mono', text: String(fila.ganados) }),
      hayEmpates ? el('td', { class: 'num mono', text: String(fila.empatados) }) : null,
      el('td', { class: 'num mono', text: String(fila.perdidos) }),
      hayDescansos ? el('td', { class: 'num mono', text: String(fila.descansos) }) : null,
      el('td', { class: 'num mono', text: `${fila.mayorFavor}-${fila.mayorContra}` }),
      unidadMenor ? el('td', { class: 'num mono', text: `${fila.menorFavor}-${fila.menorContra}` }) : null,
    ].filter(Boolean));
  });

  return el('div', { class: 'tabla-envoltura' }, [
    el('table', {}, [
      el('thead', {}, [el('tr', {}, cabeceras)]),
      el('tbody', {}, filas),
    ]),
    clasifican
      ? el('p', { class: 'ayuda', text: `La línea verde marca a los ${clasifican} que clasifican.` })
      : null,
  ]);
}

// ----------------------------------------------------------------- Equipos

function panelEquipos(torneo) {
  return el('div', { class: 'rejilla rejilla-ancha' }, torneo.equipos.map((equipo, indice) => {
    const integrantes = nombresIntegrantes(equipo);
    return el('div', { class: 'equipo-tarjeta', style: `border-left-color:${equipo.color}` }, [
      el('div', { class: 'equipo-cabeza' }, [
        el('span', {
          class: 'escudo escudo-grande',
          style: `background:${equipo.color};color:${colorContraste(equipo.color)}`,
          text: iniciales(nombreEquipo(torneo, equipo)) || String(indice + 1),
        }),
        el('div', { class: 'crece', style: 'min-width:0' }, [
          el('h3', { class: 'nada', text: nombreEquipo(torneo, equipo) }),
          subtituloEquipo(torneo, equipo)
            ? el('small', { class: 'tenue', text: subtituloEquipo(torneo, equipo) })
            : null,
        ]),
      ]),
      el('div', { class: 'fila', style: 'gap:6px;margin-bottom:10px' }, [
        equipo.mascota ? etiqueta(`🐾 ${equipo.mascota}`) : null,
        equipo.apodo ? etiqueta(`💬 ${equipo.apodo}`) : null,
      ]),
      equipo.lema ? el('p', { class: 'suave', style: 'font-style:italic;margin:0 0 10px', text: `"${equipo.lema}"` }) : null,
      el('div', {}, [
        el('label', { text: `Integrantes (${integrantes.length} de ${torneo.tamanoEquipo})` }),
        integrantes.length
          ? el('div', { class: 'integrantes' }, integrantes.map((nombre) => el('div', { class: 'integrante' }, [
              el('span', {
                class: 'escudo escudo-chico',
                style: 'background:var(--fondo-4);color:var(--texto)',
                text: iniciales(nombre),
              }),
              el('span', { text: nombre }),
            ])))
          : el('p', { class: 'tenue nada', text: 'Sin integrantes asignados.' }),
      ]),
    ]);
  }));
}

// ------------------------------------------------------------------ Reglas

function panelReglas(torneo, dep, sis, modalidad) {
  return el('div', { class: 'apilado' }, [
    el('div', { class: 'tarjeta' }, [
      el('h3', { text: `📏 ${sis?.nombre || 'Forma de anotar'}` }),
      sis?.descripcion ? el('p', { class: 'suave', text: sis.descripcion }) : null,
      el('ul', { class: 'reglas' }, reglasLegibles(sis).map((linea) => el('li', { text: linea }))),
    ]),
    el('div', { class: 'tarjeta' }, [
      el('h3', { text: `${modalidad?.icono || ''} ${modalidad?.nombre || torneo.modalidad}` }),
      el('p', { class: 'suave', text: modalidad?.descripcion || '' }),
      el('ul', { class: 'reglas' }, opcionesLegibles(torneo).map((linea) => el('li', { text: linea }))),
    ]),
    el('div', { class: 'tarjeta' }, [
      el('h3', { text: 'Ficha del torneo' }),
      el('div', { class: 'rejilla' }, [
        ficha('Deporte', `${dep?.icono || ''} ${dep?.nombre || '—'}`),
        ficha('Jugadores por equipo', String(torneo.tamanoEquipo)),
        ficha('Equipos', String(torneo.equipos.length)),
        ficha('Partidos', String(torneo.partidos.length)),
      ]),
    ]),
  ]);
}

function opcionesLegibles(torneo) {
  const o = torneo.opciones || {};
  const lineas = [];
  if (torneo.modalidad === 'roundRobin') {
    lineas.push(o.vueltas > 1 ? 'Se juega ida y vuelta.' : 'Se juega a una sola vuelta.');
    if (o.playoffFinal) lineas.push('Cierra con una final entre el 1º y el 2º de la tabla.');
  }
  if (torneo.modalidad === 'grupos') {
    lineas.push(`${o.cantidadGrupos} grupos; clasifican ${o.clasificanPorGrupo} de cada uno.`);
  }
  if (torneo.modalidad === 'suizo') {
    lineas.push(`${o.rondas} rondas.`);
  }
  if (torneo.modalidad === 'americano') {
    lineas.push(`${o.porLado === 1 ? 'Uno' : 'Dos'} por lado en cada partido.`);
    lineas.push(
      o.emparejamiento === 'companeros'
        ? 'Cada jugador juega una vez junto a cada uno de los demás.'
        : 'Cada pareja enfrenta a todas las parejas que se pueden armar con el resto.'
    );
    if (o.rondasAmericano) lineas.push(`Se juegan solo ${o.rondasAmericano} rondas.`);
    lineas.push('La tabla es individual: gana el jugador que más partidos se lleva.');
  }
  if (torneo.modalidad === 'eliminacion') {
    lineas.push(o.sembrado === 'azar' ? 'La llave se sorteó al azar.' : 'La llave sigue el orden de siembra de la lista.');
  }
  if (o.tercerPuesto && ['eliminacion', 'grupos'].includes(torneo.modalidad)) {
    lineas.push('Se juega el partido por el tercer lugar.');
  }
  if (['roundRobin', 'grupos', 'suizo'].includes(torneo.modalidad)) {
    lineas.push(`Puntos: ${o.puntosVictoria ?? 3} por ganar, ${o.puntosEmpate ?? 1} por empatar, ${o.puntosDerrota ?? 0} por perder.`);
  }
  return lineas;
}

function ficha(titulo, valor) {
  return el('div', { style: 'background:var(--fondo-3);border-radius:var(--radio-chico);padding:12px' }, [
    el('small', { class: 'tenue', text: titulo }),
    el('div', { style: 'font-weight:600;margin-top:2px', text: valor }),
  ]);
}
