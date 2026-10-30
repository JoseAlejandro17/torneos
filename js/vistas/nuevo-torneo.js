// Asistente para crear un torneo, en cinco pasos:
//   1. Deporte      2. Equipos e integrantes   3. Modalidad
//   4. Anotación    5. Revisar y crear

import { el, pintar, id as nuevoId, normalizar, iniciales, mezclar } from '../util.js';
import {
  deportes, deporte, personas, crearPersona, crearTorneo, crearDeporte, guardar,
} from '../modelo.js';
import { MODALIDADES, CAMPOS_EQUIPO, COLORES_SUGERIDOS } from '../catalogo.js';
import { reglasLegibles, resumenSistema } from '../anotacion.js';
import {
  generarFixture, avanzarFixture, rondasDeAmericano, partidosDeAmericanoCompleto,
} from '../fixture.js';
import { nombreEquipo } from '../equipos.js';
import { letraDe, nombrarConLetras } from './asignar.js';
import {
  abrirModal, avisar, campo, casilla, tarjetaOpcion, confirmar, vacio,
} from '../ui.js';
import { ir } from '../app.js';

const PASOS = [
  { clave: 'deporte', titulo: 'Deporte' },
  { clave: 'equipos', titulo: 'Equipos' },
  { clave: 'modalidad', titulo: 'Modalidad' },
  { clave: 'anotacion', titulo: 'Anotación' },
  { clave: 'revisar', titulo: 'Revisar' },
];

/** Borrador en memoria: sobrevive a los redibujados mientras no se recargue. */
let borrador = null;

function borradorNuevo() {
  return {
    paso: 0,
    nombre: '',
    deporteId: null,
    rotativo: false,     // americano: nadie tiene pareja fija
    tamanoEquipo: 2,
    campoNombre: 'nombre',
    equipos: [],
    modalidad: null,
    opciones: {
      porLado: 2,
      emparejamiento: 'completo',
      rondasAmericano: 0,
      vueltas: 1,
      tercerPuesto: true,
      sembrado: 'orden',
      cantidadGrupos: 2,
      clasificanPorGrupo: 2,
      rondas: 3,
      playoffFinal: false,
      puntosVictoria: 3,
      puntosEmpate: 1,
      puntosDerrota: 0,
    },
    sistemaId: null,
    generarAhora: true,
  };
}

/** Reinicia el borrador (se usa al terminar de crear un torneo). */
export function limpiarBorrador() {
  borrador = null;
}

export function vistaNuevoTorneo() {
  if (!borrador) borrador = borradorNuevo();
  const contenedor = el('div', {});

  const dibujar = () => pintar(contenedor, [
    el('div', { class: 'encabezado-pagina' }, [
      el('div', {}, [
        el('h1', { text: 'Nuevo torneo' }),
        el('p', { text: 'Cinco pasos: deporte, equipos, modalidad, anotación y listo.' }),
      ]),
      el('button', {
        class: 'boton boton-fantasma',
        text: 'Empezar de cero',
        onclick: () => confirmar({
          titulo: 'Empezar de cero',
          mensaje: 'Se pierde lo que llevas armado en este asistente.',
          textoAceptar: 'Empezar de cero',
          peligro: true,
          alAceptar: () => { borrador = borradorNuevo(); dibujar(); },
        }),
      }),
    ]),
    barraPasos(dibujar),
    contenidoPaso(dibujar),
  ]);

  dibujar();
  return contenedor;
}

// ----------------------------------------------------------------- Pasos

function barraPasos(dibujar) {
  return el('div', { class: 'pasos' }, PASOS.map((paso, indice) => {
    const alcanzable = indice <= borrador.paso || pasoCompleto(indice - 1);
    const clases = ['paso'];
    if (indice === borrador.paso) clases.push('activo');
    else if (pasoCompleto(indice)) clases.push('listo');
    return el('button', {
      class: clases.join(' '),
      style: 'font-family:inherit;cursor:' + (alcanzable ? 'pointer' : 'default'),
      disabled: !alcanzable,
      onclick: () => { if (alcanzable) { borrador.paso = indice; dibujar(); } },
    }, [
      el('span', { class: 'numero', text: String(indice + 1) }),
      el('span', { text: paso.titulo }),
    ]);
  }));
}

/** ¿El paso tiene lo mínimo para seguir? */
function pasoCompleto(indice) {
  switch (indice) {
    case 0: return Boolean(borrador.deporteId);
    case 1: return borrador.equipos.length >= (borrador.rotativo ? 4 : 2);
    case 2: return Boolean(borrador.modalidad) && borrador.equipos.length >= minimoDeModalidad();
    case 3: return Boolean(borrador.sistemaId);
    case 4: return [0, 1, 2, 3].every(pasoCompleto);
    default: return false;
  }
}

function minimoDeModalidad() {
  const modalidad = MODALIDADES.find((m) => m.id === borrador.modalidad);
  return modalidad?.minimoEquipos ?? 2;
}

function contenidoPaso(dibujar) {
  const cuerpo = [
    pasoDeporte, pasoEquipos, pasoModalidad, pasoAnotacion, pasoRevisar,
  ][borrador.paso](dibujar);

  const esUltimo = borrador.paso === PASOS.length - 1;
  const puedeSeguir = pasoCompleto(borrador.paso);

  return el('div', {}, [
    cuerpo,
    el('div', { class: 'pie-asistente' }, [
      borrador.paso > 0
        ? el('button', {
            class: 'boton boton-fantasma',
            text: '← Atrás',
            onclick: () => { borrador.paso--; dibujar(); },
          })
        : el('a', { class: 'boton boton-fantasma', href: '#/', text: '← Cancelar' }),
      el('div', { class: 'fila' }, [
        !puedeSeguir ? el('small', { class: 'tenue', text: pistaDelPaso() }) : null,
        esUltimo
          ? el('button', {
              class: 'boton boton-primario boton-grande',
              text: '🏆 Crear el torneo',
              onclick: () => crear(),
            })
          : el('button', {
              class: 'boton boton-primario',
              text: 'Siguiente →',
              disabled: !puedeSeguir,
              onclick: () => { borrador.paso++; dibujar(); },
            }),
      ]),
    ]),
  ]);
}

function pistaDelPaso() {
  switch (borrador.paso) {
    case 0: return 'Elige un deporte para seguir.';
    case 1: return borrador.rotativo
      ? 'Hacen falta al menos 4 jugadores.'
      : 'Hacen falta al menos 2 equipos.';
    case 2: return borrador.modalidad
      ? `Esta modalidad necesita al menos ${minimoDeModalidad()} equipos.`
      : 'Elige una modalidad.';
    case 3: return 'Elige cómo se anota.';
    default: return '';
  }
}

// ------------------------------------------------------------ 1. Deporte

function pasoDeporte(dibujar) {
  const nombre = el('input', {
    type: 'text',
    valor: borrador.nombre,
    placeholder: 'Torneo de pádel del sábado',
  });
  nombre.addEventListener('input', () => { borrador.nombre = nombre.value; });

  return el('div', { class: 'apilado' }, [
    el('div', { class: 'tarjeta' }, [
      campo({
        etiqueta: 'Nombre del torneo',
        ayuda: 'Opcional: si lo dejas en blanco le ponemos uno con el deporte y la fecha.',
        control: nombre,
      }),
    ]),
    el('div', { class: 'tarjeta' }, [
      el('div', { class: 'tarjeta-titulo' }, [
        el('h2', { text: '¿Qué deporte o juego?' }),
        el('button', {
          class: 'boton boton-chico',
          text: '+ Agregar otro deporte',
          onclick: () => formularioDeporteRapido(dibujar),
        }),
      ]),
      el('div', { class: 'opciones' }, deportes().map((dep) => tarjetaOpcion({
        icono: dep.icono,
        titulo: dep.nombre,
        detalle: `${dep.sistemas.length} ${dep.sistemas.length === 1 ? 'forma de anotar' : 'formas de anotar'} · sugerido ${dep.tamanoEquipo} por equipo`,
        elegida: borrador.deporteId === dep.id,
        alElegir: () => {
          borrador.deporteId = dep.id;
          borrador.tamanoEquipo = dep.tamanoEquipo;
          borrador.sistemaId = null;
          // Si cambian de deporte, ajustamos las ranuras de los equipos.
          for (const equipo of borrador.equipos) {
            equipo.integrantes = equipo.integrantes.slice(0, dep.tamanoEquipo);
          }
          dibujar();
        },
      }))),
    ]),
  ]);
}

function formularioDeporteRapido(dibujar) {
  const nombre = el('input', { type: 'text', placeholder: 'Taca-taca, bowling, dardos...' });
  const icono = el('input', { type: 'text', valor: '🏅', maxlength: '4' });
  const tamano = el('input', { type: 'number', valor: '1', min: '1', max: '50' });

  abrirModal({
    titulo: 'Agregar deporte o juego',
    contenido: () => el('div', {}, [
      campo({ etiqueta: 'Nombre', control: nombre }),
      el('div', { class: 'campo-fila' }, [
        campo({ etiqueta: 'Emoji', control: icono }),
        campo({ etiqueta: 'Jugadores por equipo', control: tamano }),
      ]),
      el('p', { class: 'ayuda', text: 'Después, en el paso de anotación, podrás crear la forma de contar los puntos para este deporte.' }),
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: 'Agregar y elegir',
        onclick: () => {
          if (!nombre.value.trim()) return avisar('Falta el nombre.', 'error');
          const dep = crearDeporte({
            nombre: nombre.value.trim(),
            icono: icono.value.trim() || '🏅',
            tamanoEquipo: Math.max(1, Number(tamano.value) || 1),
            sistemas: [],
          });
          borrador.deporteId = dep.id;
          borrador.tamanoEquipo = dep.tamanoEquipo;
          borrador.sistemaId = null;
          cerrar();
          avisar(`"${dep.nombre}" agregado.`);
          dibujar();
        },
      }),
    ],
  });
}

// ------------------------------------------------------------- 2. Equipos

function pasoEquipos(dibujar) {
  const elegirModo = el('div', { class: 'tarjeta' }, [
    el('h2', { text: '¿Hay parejas fijas?' }),
    el('div', { class: 'opciones', style: 'margin-top:12px' }, [
      tarjetaOpcion({
        icono: '🛡️',
        titulo: 'Equipos fijos',
        detalle: 'Cada equipo se arma antes y juega junto todo el torneo.',
        elegida: !borrador.rotativo,
        alElegir: () => {
          if (!borrador.rotativo) return;
          borrador.rotativo = false;
          borrador.modalidad = null;
          borrador.equipos = [];
          borrador.tamanoEquipo = deporte(borrador.deporteId)?.tamanoEquipo || 2;
          dibujar();
        },
      }),
      tarjetaOpcion({
        icono: '🔄',
        titulo: 'Todos rotan (americano)',
        detalle: 'No hay parejas fijas: cambian en cada ronda y gana el jugador que más partidos se lleva.',
        elegida: borrador.rotativo,
        alElegir: () => {
          if (borrador.rotativo) return;
          borrador.rotativo = true;
          borrador.modalidad = 'americano';
          borrador.equipos = [];
          borrador.tamanoEquipo = 1;
          borrador.campoNombre = 'nombre';
          // En el americano gana el que más partidos se lleva: una victoria, un punto.
          Object.assign(borrador.opciones, {
            puntosVictoria: 1, puntosEmpate: 0, puntosDerrota: 0, puntosDescanso: 0,
          });
          dibujar();
        },
      }),
    ]),
  ]);

  return el('div', { class: 'apilado' }, [
    elegirModo,
    borrador.rotativo ? panelJugadores(dibujar) : panelEquiposFijos(dibujar),
  ]);
}

// ------------------------------------------- 2a. Americano: los jugadores

function panelJugadores(dibujar) {
  const porLado = el('select', {}, [
    el('option', { value: '2', text: 'Parejas (2 por lado)' }),
    el('option', { value: '1', text: 'Individual (1 por lado)' }),
  ]);
  porLado.value = String(borrador.opciones.porLado);
  porLado.addEventListener('change', () => {
    borrador.opciones.porLado = Number(porLado.value);
    dibujar();
  });

  const entrada = el('input', {
    type: 'text', list: 'personas-registradas',
    placeholder: 'Nombre del jugador y Enter...',
  });
  const sumar = () => {
    const escrito = entrada.value.trim();
    if (!escrito) return;
    const existente = personas().find((p) => normalizar(p.nombre) === normalizar(escrito));
    const per = existente || crearPersona({ nombre: escrito });
    agregarEquipo({ nombre: per.nombre, integrantes: [per.id] });
    entrada.value = '';
    dibujar();
    setTimeout(() => entrada.focus(), 30);
  };
  entrada.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') { evento.preventDefault(); sumar(); }
  });

  const minimo = borrador.opciones.porLado === 2 ? 4 : 3;
  const cantidad = borrador.equipos.length;

  return el('div', { class: 'tarjeta' }, [
    el('div', { class: 'tarjeta-titulo' }, [
      el('h2', { text: `Jugadores (${cantidad})` }),
      el('div', { class: 'fila' }, [
        el('button', {
          class: 'boton boton-chico boton-fantasma',
          text: 'Sin nombre (A, B, C…)',
          title: 'Agregar jugadores como letras para llenarlos después en papel',
          onclick: () => agregarPorLetras(dibujar, { rotativo: true }),
        }),
      ]),
    ]),
    el('div', { class: 'campo-fila' }, [
      campo({
        etiqueta: 'Cuántos juegan por lado',
        ayuda: borrador.opciones.porLado === 2
          ? 'Lo normal en pádel: cada punto lo juegan 4, dos contra dos.'
          : 'Uno contra uno; termina siendo un todos contra todos.',
        control: porLado,
      }),
      campo({
        etiqueta: 'Agregar jugador',
        ayuda: 'Escribe el nombre y presiona Enter. Si no está en el registro, se crea.',
        control: entrada,
      }),
    ]),
    el('datalist', { id: 'personas-registradas' },
      personas().map((p) => el('option', { value: p.nombre }))),

    cantidad
      ? el('div', { class: 'fichas', style: 'margin-top:4px' }, borrador.equipos.map((jugador, indice) =>
          el('span', { class: 'ficha', style: `cursor:default;border-left:3px solid ${jugador.color}` }, [
            el('span', {
              class: 'escudo escudo-chico',
              style: `background:${jugador.color};color:#fff`,
              text: iniciales(jugador.nombre) || String(indice + 1),
            }),
            el('span', { text: jugador.nombre || `Jugador ${indice + 1}` }),
            el('button', {
              class: 'quitar',
              text: '×',
              title: 'Quitar',
              'aria-label': 'Quitar',
              onclick: () => {
                borrador.equipos.splice(indice, 1);
                borrador.equipos.forEach((e, i) => { e.numero = i + 1; });
                dibujar();
              },
            }),
          ])))
      : el('p', { class: 'tenue nada', style: 'margin-top:8px', text: 'Todavía no hay jugadores.' }),

    cantidad >= minimo
      ? el('p', { class: 'ayuda', style: 'margin-top:12px' }, [
          borrador.opciones.porLado === 2
            ? `Con ${cantidad} jugadores se pueden armar ${partidosDeAmericanoCompleto(cantidad)} partidos distintos entre parejas. En el paso siguiente eliges si se juegan todos o solo una vuelta corta.`
            : `Con ${cantidad} jugadores cada uno juega una vez contra cada rival.`,
        ])
      : el('p', { class: 'ayuda', style: 'margin-top:12px;color:var(--aviso)', text: `Hacen falta al menos ${minimo} jugadores.` }),
  ]);
}

// --------------------------------------------- 2b. Equipos fijos

function panelEquiposFijos(dibujar) {
  const dep = deporte(borrador.deporteId);

  const tamano = el('input', {
    type: 'number', valor: String(borrador.tamanoEquipo), min: '1', max: '50',
  });
  tamano.addEventListener('change', () => {
    const nuevo = Math.max(1, Number(tamano.value) || 1);
    borrador.tamanoEquipo = nuevo;
    for (const equipo of borrador.equipos) {
      equipo.integrantes = equipo.integrantes.slice(0, nuevo);
    }
    dibujar();
  });

  const cabecera = el('div', { class: 'tarjeta' }, [
    el('div', { class: 'campo-fila' }, [
      campo({
        etiqueta: 'Jugadores por equipo',
        ayuda: borrador.tamanoEquipo === 1
          ? 'Con 1 por equipo el torneo es individual.'
          : `Cada equipo lleva ${borrador.tamanoEquipo} integrantes.`,
        control: tamano,
      }),
      campo({
        etiqueta: '¿Con qué se nombra a los equipos?',
        ayuda: 'Es lo que se va a mostrar en el calendario y en las tablas. Nada más es obligatorio.',
        control: (() => {
          const selector = el('select', {}, CAMPOS_EQUIPO.map((c) =>
            el('option', { value: c.clave, text: `${c.icono} ${c.etiqueta}` })
          ));
          selector.value = borrador.campoNombre;
          selector.addEventListener('change', () => {
            borrador.campoNombre = selector.value;
            dibujar();
          });
          return selector;
        })(),
      }),
    ]),
  ]);

  const acciones = el('div', { class: 'tarjeta-titulo' }, [
    el('h2', { text: `Equipos (${borrador.equipos.length})` }),
    el('div', { class: 'fila' }, [
      el('button', {
        class: 'boton boton-chico',
        text: '+ Agregar equipo',
        onclick: () => { agregarEquipo(); dibujar(); },
      }),
      el('button', {
        class: 'boton boton-chico boton-fantasma',
        text: '+ Agregar 4',
        onclick: () => { for (let i = 0; i < 4; i++) agregarEquipo(); dibujar(); },
      }),
      el('button', {
        class: 'boton boton-chico boton-fantasma',
        text: 'Sin nombre (A, B, C…)',
        title: 'Agregar equipos como letras para llenarlos después en papel',
        onclick: () => agregarPorLetras(dibujar),
      }),
      borrador.equipos.length >= 2
        ? el('button', {
            class: 'boton boton-chico boton-fantasma',
            text: '🎲 Sortear integrantes',
            title: 'Reparte al azar entre los equipos a toda la gente ya asignada',
            onclick: () => { sortearIntegrantes(); dibujar(); },
          })
        : null,
    ]),
  ]);

  return el('div', { class: 'apilado' }, [
    cabecera,
    el('div', { class: 'tarjeta' }, [
      acciones,
      borrador.equipos.length
        ? el('div', { class: 'rejilla rejilla-ancha' },
            borrador.equipos.map((equipo, indice) => tarjetaEquipo(equipo, indice, dibujar)))
        : vacio({
            icono: '👥',
            titulo: 'Todavía no hay equipos',
            mensaje: dep
              ? `Agrega al menos dos equipos de ${borrador.tamanoEquipo} ${borrador.tamanoEquipo === 1 ? 'jugador' : 'jugadores'}.`
              : 'Primero elige un deporte.',
            accion: el('button', {
              class: 'boton boton-primario',
              text: '+ Agregar el primer equipo',
              onclick: () => { agregarEquipo(); dibujar(); },
            }),
          }),
    ]),
  ]);
}

function agregarEquipo(datos = {}) {
  const numero = borrador.equipos.length + 1;
  const equipo = {
    id: nuevoId('eq'),
    numero,
    letra: letraDe(numero - 1),
    nombre: '',
    apodo: '',
    mascota: '',
    lema: '',
    color: COLORES_SUGERIDOS[(numero - 1) % COLORES_SUGERIDOS.length],
    integrantes: [],
    ...datos,
  };
  borrador.equipos.push(equipo);
  return equipo;
}

/**
 * Agrega varios equipos de una vez nombrados con letras, para imprimir el
 * torneo y llenar los nombres a mano después.
 */
function agregarPorLetras(dibujar, { rotativo = false } = {}) {
  const sugerido = rotativo ? 5 : 8;
  const cantidad = el('input', { type: 'number', valor: String(sugerido), min: '2', max: '64' });

  abrirModal({
    titulo: rotativo ? 'Jugadores sin nombre' : 'Equipos sin nombre',
    contenido: () => el('div', {}, [
      el('p', { class: 'suave' }, [
        rotativo
          ? 'Se agregan como Jugador A, Jugador B, Jugador C… Imprimes el torneo, anotas en papel quién es cada letra, y después se los pones acá.'
          : 'Se agregan como Equipo A, Equipo B, Equipo C… Imprimes el torneo con la tabla de letras, la llenas a mano y después les pones nombre acá.',
      ]),
      campo({
        etiqueta: rotativo ? '¿Cuántos jugadores?' : '¿Cuántos equipos?',
        control: cantidad,
      }),
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: 'Agregar',
        onclick: () => {
          const cuantos = Math.min(64, Math.max(2, Number(cantidad.value) || sugerido));
          for (let i = 0; i < cuantos; i++) agregarEquipo();
          nombrarConLetras(borrador.equipos, { rotativo });
          cerrar();
          dibujar();
        },
      }),
    ],
  });
}

/** Reparte al azar entre los equipos a toda la gente ya asignada. */
function sortearIntegrantes() {
  const todos = mezclar(borrador.equipos.flatMap((e) => e.integrantes));
  if (!todos.length) return avisar('Primero asigna gente a los equipos.', 'atencion');
  let indice = 0;
  for (const equipo of borrador.equipos) {
    equipo.integrantes = [];
  }
  for (const equipo of borrador.equipos) {
    while (equipo.integrantes.length < borrador.tamanoEquipo && indice < todos.length) {
      equipo.integrantes.push(todos[indice++]);
    }
  }
  avisar('Integrantes repartidos al azar.');
}

function tarjetaEquipo(equipo, indice, dibujar) {
  const faltan = borrador.tamanoEquipo - equipo.integrantes.length;
  const campoActivo = CAMPOS_EQUIPO.find((c) => c.clave === borrador.campoNombre);

  const entrada = (clave, marcador) => {
    const nodo = el('input', { type: 'text', valor: equipo[clave] || '', placeholder: marcador });
    nodo.addEventListener('input', () => {
      equipo[clave] = nodo.value;
      cabeza.replaceChildren(...piezasCabeza());
    });
    return nodo;
  };

  const cabeza = el('div', { class: 'equipo-cabeza' });
  const piezasCabeza = () => [
    el('span', {
      class: 'escudo',
      style: `background:${equipo.color};color:#fff`,
      text: iniciales(nombreEquipo(borrador, equipo)) || String(indice + 1),
    }),
    el('div', { class: 'crece' }, [
      el('div', { style: 'font-weight:650', text: nombreEquipo(borrador, equipo) || `Equipo ${indice + 1}` }),
      el('small', { class: 'tenue', text: `Equipo ${indice + 1}` }),
    ]),
    el('button', {
      class: 'boton boton-chico boton-peligro',
      text: '×',
      title: 'Quitar equipo',
      'aria-label': 'Quitar equipo',
      onclick: () => {
        borrador.equipos.splice(indice, 1);
        borrador.equipos.forEach((e, i) => { e.numero = i + 1; });
        dibujar();
      },
    }),
  ];
  cabeza.replaceChildren(...piezasCabeza());

  // El campo que nombra a los equipos va primero y más visible.
  const camposTexto = CAMPOS_EQUIPO
    .filter((c) => c.clave !== 'integrantes')
    .sort((a, b) => (a.clave === borrador.campoNombre ? -1 : b.clave === borrador.campoNombre ? 1 : 0));

  return el('div', { class: `equipo-tarjeta ${faltan > 0 ? 'incompleto' : ''}`, style: `border-left-color:${equipo.color}` }, [
    cabeza,

    ...camposTexto.map((c) => campo({
      etiqueta: c.clave === borrador.campoNombre ? `${c.icono} ${c.etiqueta} · nombra al equipo` : `${c.icono} ${c.etiqueta}`,
      control: entrada(c.clave, c.ejemplo),
    })),

    campo({
      etiqueta: '🎨 Color',
      control: el('div', { class: 'fila' }, [
        (() => {
          const selector = el('input', { type: 'color', valor: equipo.color });
          selector.addEventListener('input', () => {
            equipo.color = selector.value;
            dibujar();
          });
          return selector;
        })(),
        el('div', { class: 'paleta' }, COLORES_SUGERIDOS.map((color) => el('button', {
          type: 'button',
          class: equipo.color === color ? 'elegido' : '',
          style: `background:${color}`,
          title: color,
          onclick: () => { equipo.color = color; dibujar(); },
        }))),
      ]),
    }),

    el('div', {}, [
      el('label', {
        text: `👥 Integrantes (${equipo.integrantes.length} de ${borrador.tamanoEquipo})`,
      }),
      el('div', { class: 'integrantes' }, [
        ...equipo.integrantes.map((idPersona) => {
          const per = personas().find((p) => p.id === idPersona);
          return el('div', { class: 'integrante' }, [
            el('span', {
              class: 'escudo escudo-chico',
              style: 'background:var(--fondo-4);color:var(--texto)',
              text: iniciales(per?.nombre || '?'),
            }),
            el('span', { text: per?.nombre || 'Persona borrada' }),
            el('button', {
              class: 'quitar',
              text: '×',
              title: 'Quitar del equipo',
              'aria-label': 'Quitar del equipo',
              onclick: () => {
                equipo.integrantes = equipo.integrantes.filter((i) => i !== idPersona);
                dibujar();
              },
            }),
          ]);
        }),
        ...Array.from({ length: Math.max(0, faltan) }, () => el('button', {
          class: 'ranura-vacia',
          type: 'button',
          onclick: () => selectorPersonas(equipo, dibujar),
        }, ['+ Agregar integrante'])),
      ]),
      campoActivo?.clave === 'integrantes' && !equipo.integrantes.length
        ? el('div', { class: 'ayuda', text: 'Los equipos se nombran con sus integrantes, así que conviene asignarlos.' })
        : null,
    ]),
  ]);
}

/** Modal para elegir personas del registro o crear nuevas al vuelo. */
function selectorPersonas(equipo, dibujar) {
  const usados = new Set(borrador.equipos.flatMap((e) => e.integrantes));
  const zonaFichas = el('div', { class: 'fichas' });
  const buscador = el('input', { type: 'search', placeholder: 'Buscar o escribir un nombre nuevo...' });

  const refrescar = () => {
    const texto = normalizar(buscador.value);
    const lista = personas()
      .filter((p) => !texto || normalizar(p.nombre).includes(texto) || normalizar(p.apodo).includes(texto))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    const fichas = lista.map((per) => {
      const yaEsta = equipo.integrantes.includes(per.id);
      const enOtro = usados.has(per.id) && !yaEsta;
      return el('button', {
        type: 'button',
        class: `ficha ${yaEsta ? 'elegida' : ''} ${enOtro ? 'usada' : ''}`,
        disabled: enOtro || (!yaEsta && equipo.integrantes.length >= borrador.tamanoEquipo),
        title: enOtro ? 'Ya está en otro equipo' : '',
        onclick: () => {
          if (yaEsta) {
            equipo.integrantes = equipo.integrantes.filter((i) => i !== per.id);
            usados.delete(per.id);
          } else {
            equipo.integrantes.push(per.id);
            usados.add(per.id);
          }
          refrescar();
          dibujar();
        },
      }, [
        el('span', {
          class: 'escudo escudo-chico',
          style: 'background:var(--fondo-4);color:var(--texto)',
          text: iniciales(per.nombre),
        }),
        el('span', { text: per.nombre }),
        yaEsta ? el('span', { text: '✓' }) : null,
      ]);
    });

    const escrito = buscador.value.trim();
    const yaExiste = personas().some((p) => normalizar(p.nombre) === normalizar(escrito));
    const nodos = [];
    if (escrito && !yaExiste) {
      nodos.push(el('button', {
        type: 'button',
        class: 'ficha',
        style: 'border-color:var(--acento);color:var(--acento)',
        onclick: () => {
          const per = crearPersona({ nombre: escrito });
          if (equipo.integrantes.length < borrador.tamanoEquipo) {
            equipo.integrantes.push(per.id);
            usados.add(per.id);
          }
          buscador.value = '';
          refrescar();
          dibujar();
          avisar(`"${per.nombre}" agregado al registro.`);
        },
      }, [`+ Crear "${escrito}"`]));
    }
    nodos.push(...fichas);
    if (!nodos.length) {
      nodos.push(el('p', { class: 'tenue nada', text: 'No hay nadie en el registro. Escribe un nombre para crearlo.' }));
    }
    pintar(zonaFichas, nodos);
  };

  buscador.addEventListener('input', refrescar);
  buscador.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter') return;
    const escrito = buscador.value.trim();
    if (!escrito) return;
    const existente = personas().find((p) => normalizar(p.nombre) === normalizar(escrito));
    const per = existente || crearPersona({ nombre: escrito });
    if (!equipo.integrantes.includes(per.id) && equipo.integrantes.length < borrador.tamanoEquipo) {
      equipo.integrantes.push(per.id);
      usados.add(per.id);
    }
    buscador.value = '';
    refrescar();
    dibujar();
  });

  refrescar();

  abrirModal({
    titulo: `Integrantes de ${nombreEquipo(borrador, equipo) || 'el equipo'}`,
    contenido: () => el('div', {}, [
      el('p', { class: 'suave', text: `Puedes elegir ${borrador.tamanoEquipo} ${borrador.tamanoEquipo === 1 ? 'persona' : 'personas'}. Si alguien no está en la lista, escribe su nombre y presiona Enter.` }),
      campo({ control: buscador }),
      zonaFichas,
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-primario', text: 'Listo', onclick: cerrar }),
    ],
  });
}

// ----------------------------------------------------------- 3. Modalidad

function pasoModalidad(dibujar) {
  const cantidad = borrador.equipos.length;
  // En el americano la modalidad ya quedó decidida al elegir que todos roten.
  const candidatas = MODALIDADES.filter((m) => Boolean(m.individual) === borrador.rotativo);

  return el('div', { class: 'apilado' }, [
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: `¿Cómo se juega? (${cantidad} ${borrador.rotativo ? 'jugadores' : 'equipos'})` }),
      el('div', { class: 'opciones', style: 'margin-top:12px' }, candidatas.map((modalidad) => {
        const alcanza = cantidad >= modalidad.minimoEquipos;
        return el('button', {
          type: 'button',
          class: `opcion ${borrador.modalidad === modalidad.id ? 'elegida' : ''}`,
          disabled: !alcanza,
          style: alcanza ? '' : 'opacity:0.45;cursor:not-allowed',
          onclick: () => { borrador.modalidad = modalidad.id; dibujar(); },
        }, [
          el('span', { class: 'icono', text: modalidad.icono }),
          el('span', { style: 'min-width:0' }, [
            el('span', { class: 'titulo', style: 'display:block', text: modalidad.nombre }),
            el('span', { class: 'detalle', style: 'display:block', text: modalidad.descripcion }),
            !alcanza
              ? el('span', { class: 'detalle', style: 'display:block;color:var(--aviso)', text: `Necesita al menos ${modalidad.minimoEquipos} equipos.` })
              : null,
          ]),
        ]);
      })),
    ]),
    borrador.modalidad ? opcionesDeModalidad(dibujar) : null,
  ]);
}

function opcionesDeModalidad(dibujar) {
  const o = borrador.opciones;
  const cantidad = borrador.equipos.length;
  const piezas = [];

  const numero = (clave, { min, max }) => {
    const entrada = el('input', { type: 'number', valor: String(o[clave]), min: String(min), max: String(max) });
    entrada.addEventListener('change', () => {
      o[clave] = Math.min(max, Math.max(min, Number(entrada.value) || min));
      dibujar();
    });
    return entrada;
  };

  if (borrador.modalidad === 'eliminacion' || borrador.modalidad === 'grupos') {
    piezas.push(casilla({
      texto: 'Jugar el partido por el tercer lugar',
      marcada: o.tercerPuesto,
      alCambiar: (valor) => { o.tercerPuesto = valor; },
    }));
  }

  if (borrador.modalidad === 'eliminacion') {
    piezas.push(campo({
      etiqueta: 'Orden de la llave',
      ayuda: 'Por orden de la lista: el primer equipo enfrenta al último (siembra clásica). Al azar: se sortea la llave.',
      control: (() => {
        const selector = el('select', {}, [
          el('option', { value: 'orden', text: 'Por orden de la lista (siembra)' }),
          el('option', { value: 'azar', text: 'Sorteo al azar' }),
        ]);
        selector.value = o.sembrado;
        selector.addEventListener('change', () => { o.sembrado = selector.value; });
        return selector;
      })(),
    }));
    const sobran = (() => {
      let potencia = 1;
      while (potencia < cantidad) potencia *= 2;
      return potencia - cantidad;
    })();
    if (sobran) {
      piezas.push(el('p', { class: 'ayuda', text: `Con ${cantidad} equipos la llave es de ${cantidad + sobran}: ${sobran} ${sobran === 1 ? 'equipo descansa' : 'equipos descansan'} en la primera ronda.` }));
    }
  }

  if (borrador.modalidad === 'roundRobin') {
    piezas.push(campo({
      etiqueta: 'Vueltas',
      ayuda: 'Dos vueltas significa que cada cruce se juega dos veces.',
      control: (() => {
        const selector = el('select', {}, [
          el('option', { value: '1', text: 'Una vuelta' }),
          el('option', { value: '2', text: 'Ida y vuelta' }),
        ]);
        selector.value = String(o.vueltas);
        selector.addEventListener('change', () => { o.vueltas = Number(selector.value); dibujar(); });
        return selector;
      })(),
    }));
    piezas.push(casilla({
      texto: 'Cerrar con una final entre el 1º y el 2º de la tabla',
      marcada: o.playoffFinal,
      alCambiar: (valor) => { o.playoffFinal = valor; },
    }));
    const total = (cantidad * (cantidad - 1) / 2) * o.vueltas;
    piezas.push(el('p', { class: 'ayuda', text: `Van a salir ${total} partidos.` }));
  }

  if (borrador.modalidad === 'grupos') {
    const maxGrupos = Math.max(1, Math.floor(cantidad / 2));
    const unSoloGrupo = Number(o.cantidadGrupos) === 1;

    piezas.push(el('div', { class: 'campo-fila' }, [
      campo({
        etiqueta: 'Cantidad de grupos',
        ayuda: unSoloGrupo ? 'Con 1 grupo: todos contra todos y después la llave.' : null,
        control: numero('cantidadGrupos', { min: 1, max: Math.max(1, maxGrupos) }),
      }),
      campo({
        etiqueta: unSoloGrupo ? 'Cuántos clasifican' : 'Clasifican por grupo',
        control: numero('clasificanPorGrupo', { min: 1, max: Math.max(2, cantidad) }),
      }),
      campo({
        etiqueta: 'Vueltas',
        control: (() => {
          const selector = el('select', {}, [
            el('option', { value: '1', text: 'Una vuelta' }),
            el('option', { value: '2', text: 'Ida y vuelta' }),
          ]);
          selector.value = String(o.vueltas || 1);
          selector.addEventListener('change', () => { o.vueltas = Number(selector.value); dibujar(); });
          return selector;
        })(),
      }),
    ]));

    const porGrupo = Math.ceil(cantidad / o.cantidadGrupos);
    const clasificados = o.cantidadGrupos * o.clasificanPorGrupo;
    const partidosFase = (porGrupo * (porGrupo - 1) / 2) * o.cantidadGrupos * (o.vueltas || 1);

    piezas.push(el('p', { class: 'ayuda' }, [
      unSoloGrupo
        ? `Los ${cantidad} equipos juegan todos contra todos (${partidosFase} partidos) y pasan ${clasificados} a la eliminatoria.`
        : `Quedan grupos de ${porGrupo} equipos (${partidosFase} partidos en total) y pasan ${clasificados} a la eliminatoria.`,
      clasificados > cantidad ? ' ⚠ Clasifican más equipos de los que hay.' : '',
      clasificados > 1 ? ` ${textoDeCruces(clasificados, unSoloGrupo)}` : '',
    ]));
  }

  if (borrador.modalidad === 'americano') {
    const completo = o.emparejamiento !== 'companeros' && o.porLado === 2;
    const partidosCompleto = partidosDeAmericanoCompleto(cantidad);
    const rondasCortas = rondasDeAmericano(cantidad);

    if (o.porLado === 2) {
      piezas.push(campo({
        etiqueta: 'Cómo se arman los cruces',
        control: el('div', { class: 'opciones', style: 'margin-top:4px' }, [
          tarjetaOpcion({
            icono: '🔁',
            titulo: 'Todas las combinaciones',
            detalle: `Cada pareja enfrenta a todas las parejas que se pueden armar con el resto. Con ${cantidad} jugadores son ${partidosCompleto} partidos.`,
            elegida: completo,
            alElegir: () => { o.emparejamiento = 'completo'; dibujar(); },
          }),
          tarjetaOpcion({
            icono: '⚡',
            titulo: 'Cada uno con cada compañero',
            detalle: `Más corto: alcanza con que todos jueguen una vez junto a cada uno. Con ${cantidad} jugadores son ${rondasCortas} rondas.`,
            elegida: !completo,
            alElegir: () => { o.emparejamiento = 'companeros'; dibujar(); },
          }),
        ]),
      }));
    }

    const totalRondas = completo ? rondasDelCompleto(cantidad, partidosCompleto) : rondasCortas;
    const selector = el('select', {}, [
      el('option', { value: '0', text: `Todas (${totalRondas} rondas)` }),
      ...Array.from({ length: Math.max(0, totalRondas - 1) }, (_, i) => i + 1)
        .map((n) => el('option', { value: String(n), text: `${n} ${n === 1 ? 'ronda' : 'rondas'}` })),
    ]);
    selector.value = String(o.rondasAmericano || 0);
    selector.addEventListener('change', () => { o.rondasAmericano = Number(selector.value); dibujar(); });
    piezas.push(campo({
      etiqueta: 'Cuántas rondas jugar',
      ayuda: completo
        ? 'Si no alcanza el tiempo para todas, se puede cortar antes: igual todos van jugando parejo.'
        : 'Si tienen menos tiempo, se puede cortar antes.',
      control: selector,
    }));
  }

  if (borrador.modalidad === 'suizo') {
    const sugeridas = Math.max(3, Math.ceil(Math.log2(cantidad)));
    piezas.push(campo({
      etiqueta: 'Cantidad de rondas',
      ayuda: `Para ${cantidad} equipos se suelen jugar ${sugeridas} rondas.`,
      control: numero('rondas', { min: 1, max: 15 }),
    }));
  }

  // Puntajes de la tabla, para las modalidades que la usan.
  if (['roundRobin', 'grupos', 'suizo', 'americano'].includes(borrador.modalidad)) {
    piezas.push(el('div', { class: 'separador' }));
    piezas.push(el('label', { text: 'Puntos de la tabla de posiciones' }));
    piezas.push(el('div', { class: 'campo-fila' }, [
      campo({ etiqueta: 'Por ganar', control: numero('puntosVictoria', { min: 0, max: 10 }) }),
      campo({ etiqueta: 'Por empatar', control: numero('puntosEmpate', { min: 0, max: 10 }) }),
      campo({ etiqueta: 'Por perder', control: numero('puntosDerrota', { min: 0, max: 10 }) }),
    ]));
  }

  return el('div', { class: 'tarjeta' }, [
    el('h3', { text: 'Detalles de la modalidad' }),
    ...piezas,
  ]);
}

// ---------------------------------------------------------- 4. Anotación

function pasoAnotacion(dibujar) {
  const dep = deporte(borrador.deporteId);
  const elegido = dep?.sistemas.find((s) => s.id === borrador.sistemaId) || null;

  return el('div', { class: 'apilado' }, [
    el('div', { class: 'tarjeta' }, [
      el('div', { class: 'tarjeta-titulo' }, [
        el('div', {}, [
          el('h2', { text: `¿Cómo se anota en ${dep?.nombre}?` }),
          el('small', { class: 'tenue', text: 'Elige una de las formas guardadas, o crea otra si te falta alguna variante.' }),
        ]),
        el('button', {
          class: 'boton boton-chico',
          text: '+ Crear otra forma',
          onclick: () => ir('/deportes'),
        }),
      ]),
      dep?.sistemas.length
        ? el('div', { class: 'lista-sistemas' }, dep.sistemas.map((sis) => el('button', {
            type: 'button',
            class: `opcion ${borrador.sistemaId === sis.id ? 'elegida' : ''}`,
            onclick: () => { borrador.sistemaId = sis.id; dibujar(); },
          }, [
            el('span', { class: 'icono', text: borrador.sistemaId === sis.id ? '✅' : '⚪' }),
            el('span', { style: 'min-width:0' }, [
              el('span', { class: 'titulo', style: 'display:block', text: sis.nombre }),
              el('span', { class: 'detalle', style: 'display:block', text: sis.descripcion || resumenSistema(sis) }),
            ]),
          ])))
        : vacio({
            icono: '📏',
            titulo: 'Este deporte no tiene formas de anotar',
            mensaje: 'Ve a la pantalla de Deportes para crear al menos una.',
            accion: el('a', { class: 'boton boton-primario', href: '#/deportes', text: 'Ir a Deportes' }),
          }),
    ]),
    elegido
      ? el('div', { class: 'tarjeta' }, [
          el('h3', { text: 'Cómo se va a contar' }),
          el('ul', { class: 'reglas' }, reglasLegibles(elegido).map((linea) => el('li', { text: linea }))),
        ])
      : null,
  ]);
}

// ------------------------------------------------------------ 5. Revisar

function pasoRevisar(dibujar) {
  const dep = deporte(borrador.deporteId);
  const sis = dep?.sistemas.find((s) => s.id === borrador.sistemaId);
  const modalidad = MODALIDADES.find((m) => m.id === borrador.modalidad);
  const sinGente = borrador.equipos.filter((e) => e.integrantes.length < borrador.tamanoEquipo);

  return el('div', { class: 'apilado' }, [
    el('div', { class: 'tarjeta' }, [
      el('h2', { text: borrador.nombre.trim() || `${dep?.nombre} · ${new Date().toLocaleDateString('es-CL')}` }),
      el('div', { class: 'rejilla', style: 'margin-top:14px' }, [
        dato('Deporte', `${dep?.icono} ${dep?.nombre}`),
        dato('Modalidad', `${modalidad?.icono} ${modalidad?.nombre}`),
        dato('Anotación', sis?.nombre || '—'),
        dato(
          borrador.rotativo ? 'Jugadores' : 'Equipos',
          borrador.rotativo
            ? `${borrador.equipos.length}, ${borrador.opciones.porLado} por lado`
            : `${borrador.equipos.length} de ${borrador.tamanoEquipo} ${borrador.tamanoEquipo === 1 ? 'jugador' : 'jugadores'}`
        ),
      ]),
    ]),

    el('div', { class: 'tarjeta' }, [
      el('h3', { text: borrador.rotativo ? 'Los jugadores' : 'Los equipos' }),
      el('div', { class: 'rejilla' }, borrador.equipos.map((equipo, indice) => el('div', {
        class: 'fila',
        style: `padding:9px 11px;background:var(--fondo-3);border-radius:var(--radio-chico);border-left:3px solid ${equipo.color}`,
      }, [
        el('span', {
          class: 'escudo escudo-chico',
          style: `background:${equipo.color};color:#fff`,
          text: iniciales(nombreEquipo(borrador, equipo)) || String(indice + 1),
        }),
        el('div', { class: 'crece', style: 'min-width:0' }, [
          el('div', { style: 'font-weight:600;font-size:0.9rem', text: nombreEquipo(borrador, equipo) || `Equipo ${indice + 1}` }),
          el('small', { class: 'tenue', text: equipo.integrantes.length
            ? equipo.integrantes.map((i) => personas().find((p) => p.id === i)?.nombre).filter(Boolean).join(', ')
            : 'sin integrantes' }),
        ]),
      ]))),
      sinGente.length && !borrador.rotativo
        ? el('p', { class: 'ayuda', style: 'color:var(--aviso)', text: `${sinGente.length} ${sinGente.length === 1 ? 'equipo está' : 'equipos están'} incompletos. Puedes crear el torneo igual y completarlos después.` })
        : null,
    ]),

    el('div', { class: 'tarjeta' }, [
      el('h3', { text: 'Reglas de anotación' }),
      el('ul', { class: 'reglas' }, reglasLegibles(sis).map((linea) => el('li', { text: linea }))),
    ]),

    el('div', { class: 'tarjeta' }, [
      casilla({
        texto: 'Generar el calendario de partidos al crear el torneo',
        marcada: borrador.generarAhora,
        alCambiar: (valor) => { borrador.generarAhora = valor; },
      }),
      el('div', { class: 'ayuda', text: 'Si lo dejas sin marcar, podrás generarlo cuando quieras desde la pantalla del torneo.' }),
    ]),
  ]);
}

function dato(etiquetaTexto, valor) {
  return el('div', { style: 'background:var(--fondo-3);border-radius:var(--radio-chico);padding:12px' }, [
    el('small', { class: 'tenue', text: etiquetaTexto }),
    el('div', { style: 'font-weight:600;margin-top:2px', text: valor }),
  ]);
}

// ------------------------------------------------------------------ Crear

function crear() {
  const dep = deporte(borrador.deporteId);
  const sis = dep?.sistemas.find((s) => s.id === borrador.sistemaId);
  if (!dep || !sis) return avisar('Faltan el deporte o la forma de anotar.', 'error');
  const minimo = borrador.rotativo ? 4 : 2;
  if (borrador.equipos.length < minimo) {
    return avisar(`Hacen falta al menos ${minimo} ${borrador.rotativo ? 'jugadores' : 'equipos'}.`, 'error');
  }

  const torneo = crearTorneo({
    nombre: borrador.nombre.trim() || `${dep.nombre} · ${new Date().toLocaleDateString('es-CL')}`,
    deporteId: borrador.deporteId,
    sistemaId: borrador.sistemaId,
    tamanoEquipo: borrador.tamanoEquipo,
    campoNombre: borrador.campoNombre,
    modalidad: borrador.modalidad,
    opciones: { ...borrador.opciones },
    equipos: structuredClone(borrador.equipos),
  });

  if (borrador.generarAhora) {
    torneo.partidos = generarFixture(torneo);
    avanzarFixture(torneo, sis);
    torneo.estado = 'enCurso';
    guardar(); // crearTorneo ya guardó: esto persiste el calendario recién armado.
  }

  limpiarBorrador();
  avisar(`"${torneo.nombre}" creado.`);
  ir(`/torneo/${torneo.id}`);
}

/** Cuántas rondas salen del americano completo, según cuántas canchas caben. */
function rondasDelCompleto(cantidad, partidos) {
  const canchas = Math.max(1, Math.floor(cantidad / 4));
  return Math.ceil(partidos / canchas);
}

/** Cómo se cruzan los clasificados en la llave, dicho en palabras. */
function textoDeCruces(clasificados, unSoloGrupo) {
  if (!unSoloGrupo) return 'Los primeros de cada grupo no se cruzan entre sí hasta el final.';
  if (clasificados === 2) return 'La final la juegan el 1º y el 2º.';
  if (clasificados === 4) return 'Las semifinales son 1º contra 4º y 2º contra 3º.';
  if (clasificados === 8) return 'Los cuartos son 1º-8º, 4º-5º, 2º-7º y 3º-6º.';
  return 'El mejor ubicado enfrenta al peor, y así hacia el centro de la tabla.';
}
