// Catálogo de deportes y juegos, con sus sistemas de anotación.

import { el, pintar } from '../util.js';
import {
  deportes, crearDeporte, editarDeporte, borrarDeporte,
  crearSistema, editarSistema, borrarSistema, torneos,
} from '../modelo.js';
import { SETS_POR_OMISION, PUNTOS_POR_OMISION } from '../catalogo.js';
import { reglasLegibles, resumenSistema } from '../anotacion.js';
import { abrirModal, confirmar, avisar, etiqueta, campo, casilla, vacio } from '../ui.js';
import { redibujar } from '../app.js';

export function vistaDeportes() {
  const lista = deportes();

  return [
    el('div', { class: 'encabezado-pagina' }, [
      el('div', {}, [
        el('h1', { text: 'Deportes y juegos' }),
        el('p', { text: 'Cada deporte guarda sus propias formas de anotar. Puedes agregar las que falten en cualquier momento.' }),
      ]),
      el('button', {
        class: 'boton boton-primario',
        text: '+ Agregar deporte',
        onclick: () => formularioDeporte(null),
      }),
    ]),
    lista.length
      ? el('div', { class: 'apilado' }, lista.map(tarjetaDeporte))
      : vacio({ icono: '🏅', titulo: 'No hay deportes', mensaje: 'Agrega el primero para poder crear torneos.' }),
  ];
}

function tarjetaDeporte(dep) {
  const enUso = torneos().filter((t) => t.deporteId === dep.id).length;

  return el('div', { class: 'tarjeta' }, [
    el('div', { class: 'tarjeta-titulo' }, [
      el('div', { class: 'fila' }, [
        el('span', { style: 'font-size:1.8rem', text: dep.icono }),
        el('div', {}, [
          el('h2', { text: dep.nombre }),
          el('small', { class: 'tenue' }, [
            `${dep.tamanoEquipo} ${dep.tamanoEquipo === 1 ? 'jugador por lado' : 'jugadores por equipo'} · `,
            `${dep.sistemas.length} ${dep.sistemas.length === 1 ? 'forma de anotar' : 'formas de anotar'}`,
            enUso ? ` · usado en ${enUso} ${enUso === 1 ? 'torneo' : 'torneos'}` : '',
          ]),
        ]),
      ]),
      el('div', { class: 'fila' }, [
        el('button', {
          class: 'boton boton-chico',
          text: 'Editar',
          onclick: () => formularioDeporte(dep),
        }),
        el('button', {
          class: 'boton boton-chico boton-primario',
          text: '+ Anotación',
          onclick: () => formularioSistema(dep, null),
        }),
        el('button', {
          class: 'boton boton-chico boton-peligro',
          text: 'Borrar',
          onclick: () => confirmar({
            titulo: `Borrar ${dep.nombre}`,
            mensaje: enUso
              ? `No se puede borrar: hay ${enUso} torneo(s) usando este deporte.`
              : `Se va a borrar "${dep.nombre}" con sus ${dep.sistemas.length} formas de anotar.`,
            textoAceptar: 'Borrar',
            peligro: true,
            alAceptar: () => {
              const salida = borrarDeporte(dep.id);
              if (!salida.ok) return avisar(salida.motivo, 'error');
              avisar('Deporte borrado.');
              redibujar();
            },
          }),
        }),
      ]),
    ]),
    dep.sistemas.length
      ? el('div', { class: 'apilado', style: 'gap:8px' }, dep.sistemas.map((sis) => filaSistema(dep, sis)))
      : el('p', { class: 'tenue nada', text: 'Este deporte todavía no tiene formas de anotar. Agrega al menos una.' }),
  ]);
}

function filaSistema(dep, sis) {
  const enUso = torneos().some((t) => t.sistemaId === sis.id);
  return el('div', {
    class: 'opcion compacta',
    style: 'cursor:default;align-items:center',
  }, [
    el('span', { style: 'min-width:0;flex:1' }, [
      el('span', { class: 'titulo', style: 'display:block', text: sis.nombre }),
      el('span', { class: 'detalle', style: 'display:block', text: resumenSistema(sis) }),
    ]),
    el('span', { class: 'fila', style: 'gap:6px' }, [
      enUso ? etiqueta('en uso', 'azul') : null,
      el('button', {
        class: 'boton boton-chico boton-fantasma',
        text: 'Ver',
        onclick: () => abrirModal({
          titulo: sis.nombre,
          contenido: () => el('div', {}, [
            el('p', { class: 'suave', text: sis.descripcion || '' }),
            el('h4', { text: 'Cómo se cuenta' }),
            el('ul', { class: 'reglas' }, reglasLegibles(sis).map((linea) => el('li', { text: linea }))),
          ]),
        }),
      }),
      el('button', {
        class: 'boton boton-chico boton-fantasma',
        text: 'Editar',
        onclick: () => formularioSistema(dep, sis),
      }),
      el('button', {
        class: 'boton boton-chico boton-peligro',
        text: '×',
        title: 'Borrar',
        'aria-label': 'Borrar',
        onclick: () => confirmar({
          titulo: 'Borrar forma de anotar',
          mensaje: `Se va a borrar "${sis.nombre}".`,
          textoAceptar: 'Borrar',
          peligro: true,
          alAceptar: () => {
            const salida = borrarSistema(dep.id, sis.id);
            if (!salida.ok) return avisar(salida.motivo, 'error');
            avisar('Forma de anotar borrada.');
            redibujar();
          },
        }),
      }),
    ]),
  ]);
}

// ------------------------------------------------------- Formulario deporte

function formularioDeporte(dep) {
  const esNuevo = !dep;
  const nombre = el('input', { type: 'text', valor: dep?.nombre || '', placeholder: 'Pádel, taca-taca, metegol...' });
  const icono = el('input', { type: 'text', valor: dep?.icono || '🏅', placeholder: '🏅', maxlength: '4' });
  const tamano = el('input', { type: 'number', valor: String(dep?.tamanoEquipo || 1), min: '1', max: '50' });

  abrirModal({
    titulo: esNuevo ? 'Agregar deporte o juego' : `Editar ${dep.nombre}`,
    contenido: () => el('div', {}, [
      campo({ etiqueta: 'Nombre', control: nombre }),
      el('div', { class: 'campo-fila' }, [
        campo({ etiqueta: 'Emoji', ayuda: 'Para reconocerlo de un vistazo', control: icono }),
        campo({
          etiqueta: 'Jugadores por equipo (sugerido)',
          ayuda: 'Es solo el valor por omisión: en cada torneo se puede cambiar.',
          control: tamano,
        }),
      ]),
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: esNuevo ? 'Agregar' : 'Guardar',
        onclick: () => {
          if (!nombre.value.trim()) return avisar('Ponle un nombre al deporte.', 'error');
          const datos = {
            nombre: nombre.value.trim(),
            icono: icono.value.trim() || '🏅',
            tamanoEquipo: Math.max(1, Number(tamano.value) || 1),
          };
          if (esNuevo) crearDeporte({ ...datos, sistemas: [] });
          else editarDeporte(dep.id, datos);
          cerrar();
          avisar(esNuevo ? 'Deporte agregado.' : 'Deporte actualizado.');
          redibujar();
        },
      }),
    ],
  });
}

// ------------------------------------------------------- Formulario sistema

/** Formulario para crear o editar una forma de anotar. */
function formularioSistema(dep, sis) {
  const esNuevo = !sis;
  // Copia de trabajo: así se puede cancelar sin tocar lo guardado.
  const trabajo = {
    nombre: sis?.nombre || '',
    descripcion: sis?.descripcion || '',
    tipo: sis?.tipo || 'sets',
    config: structuredClone(sis?.config || SETS_POR_OMISION),
  };
  if (!sis) trabajo.config = { ...SETS_POR_OMISION };

  const zonaCampos = el('div', {});
  const zonaPrevia = el('div', { class: 'tarjeta', style: 'background:var(--fondo-3);padding:14px' });

  const refrescar = () => {
    pintar(zonaCampos, camposSegunTipo(trabajo, refrescar));
    pintar(zonaPrevia, [
      el('h4', { class: 'nada', style: 'margin-bottom:8px', text: 'Así se va a contar' }),
      el('ul', { class: 'reglas' }, reglasLegibles({ tipo: trabajo.tipo, config: trabajo.config })
        .map((linea) => el('li', { text: linea }))),
    ]);
  };

  const nombre = el('input', { type: 'text', valor: trabajo.nombre, placeholder: '3 sets a 6 games con punto de oro' });
  nombre.addEventListener('input', () => { trabajo.nombre = nombre.value; });
  const descripcion = el('textarea', { placeholder: 'Opcional: una línea explicando cuándo se usa.' });
  descripcion.value = trabajo.descripcion;
  descripcion.addEventListener('input', () => { trabajo.descripcion = descripcion.value; });

  const selectorTipo = el('select', {}, [
    el('option', { value: 'sets', text: 'Por sets y games (pádel, tenis, vóley, ping pong)' }),
    el('option', { value: 'puntos', text: 'Marcador corrido (goles, puntos)' }),
    el('option', { value: 'mejorDe', text: 'Al mejor de N rondas' }),
  ]);
  selectorTipo.value = trabajo.tipo;
  selectorTipo.addEventListener('change', () => {
    trabajo.tipo = selectorTipo.value;
    if (trabajo.tipo === 'sets') trabajo.config = { ...SETS_POR_OMISION };
    else if (trabajo.tipo === 'puntos') trabajo.config = { ...PUNTOS_POR_OMISION };
    else trabajo.config = { rondasParaGanar: 2 };
    refrescar();
  });

  refrescar();

  abrirModal({
    titulo: esNuevo ? `Nueva forma de anotar · ${dep.nombre}` : `Editar: ${sis.nombre}`,
    ancho: true,
    contenido: () => el('div', {}, [
      campo({ etiqueta: 'Nombre', control: nombre }),
      campo({ etiqueta: 'Descripción', control: descripcion }),
      campo({ etiqueta: 'Tipo de anotación', control: selectorTipo }),
      el('div', { class: 'separador' }),
      zonaCampos,
      el('div', { style: 'margin-top:14px' }, [zonaPrevia]),
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: esNuevo ? 'Agregar' : 'Guardar',
        onclick: () => {
          if (!trabajo.nombre.trim()) return avisar('Ponle un nombre a la forma de anotar.', 'error');
          const datos = {
            nombre: trabajo.nombre.trim(),
            descripcion: trabajo.descripcion.trim(),
            tipo: trabajo.tipo,
            config: trabajo.config,
          };
          if (esNuevo) crearSistema(dep.id, datos);
          else editarSistema(dep.id, sis.id, datos);
          cerrar();
          avisar(esNuevo ? 'Forma de anotar agregada.' : 'Cambios guardados.');
          redibujar();
        },
      }),
    ],
  });
}

/** Campos de configuración según el tipo de sistema. */
function camposSegunTipo(trabajo, refrescar) {
  const c = trabajo.config;
  const numero = (clave, { min = 0, max = 99, paso = 1 } = {}) => {
    const entrada = el('input', {
      type: 'number', valor: String(c[clave] ?? 0),
      min: String(min), max: String(max), step: String(paso),
    });
    entrada.addEventListener('input', () => {
      c[clave] = Number(entrada.value);
      refrescar();
    });
    return entrada;
  };

  if (trabajo.tipo === 'sets') {
    const conTiebreak = c.tiebreakEnEmpate !== null && c.tiebreakEnEmpate !== undefined;
    // Si el set entero es un tie-break, los games no pintan nada.
    const todoEsTiebreak = Boolean(c.ultimoSetSuperTiebreak) && Number(c.setsParaGanar) === 1;
    return [
      el('div', { class: 'campo-fila' }, [
        campo({
          etiqueta: 'Sets que hay que ganar',
          ayuda: '1 = set único · 2 = al mejor de 3 · 3 = al mejor de 5',
          control: numero('setsParaGanar', { min: 1, max: 5 }),
        }),
        todoEsTiebreak ? null : campo({
          etiqueta: 'Games para ganar el set',
          ayuda: 'En pádel: 6 (clásico), 4, 3... En vóley: 25.',
          control: numero('gamesParaGanarSet', { min: 1, max: 50 }),
        }),
        todoEsTiebreak ? null : campo({
          etiqueta: 'Diferencia mínima de games',
          ayuda: '2 = hay que ganar por dos (6-4). 1 = alcanza con uno (3-2).',
          control: numero('diferenciaGames', { min: 1, max: 5 }),
        }),
      ]),
      todoEsTiebreak ? null : casilla({
        texto: 'Usar tie-break cuando los games se empatan',
        marcada: conTiebreak,
        alCambiar: (marcada) => {
          c.tiebreakEnEmpate = marcada ? Math.max(1, (c.gamesParaGanarSet || 6) - (c.diferenciaGames === 1 ? 1 : 0)) : null;
          refrescar();
        },
      }),
      conTiebreak && !todoEsTiebreak
        ? el('div', { class: 'campo-fila' }, [
            campo({
              etiqueta: 'Empate que manda a tie-break',
              ayuda: 'Clásico: 6 (el 6-6). Variante de 5 games: 2 (el 2-2). De 7 games: 3 (el 3-3).',
              control: numero('tiebreakEnEmpate', { min: 0, max: 40 }),
            }),
            campo({ etiqueta: 'Puntos del tie-break', control: numero('puntosTiebreak', { min: 1, max: 30 }) }),
            campo({ etiqueta: 'Diferencia en el tie-break', control: numero('diferenciaTiebreak', { min: 1, max: 5 }) }),
          ])
        : null,
      todoEsTiebreak ? null : campo({
        etiqueta: 'Cómo se cuentan los puntos dentro del game',
        control: (() => {
          const selector = el('select', {}, [
            el('option', { value: 'clasico', text: '15 / 30 / 40 con ventaja' }),
            el('option', { value: 'oro', text: '15 / 30 / 40 con punto de oro (el 40-40 lo define un punto)' }),
            el('option', { value: 'directo', text: 'Puntos corridos, sin games internos (vóley, ping pong)' }),
          ]);
          selector.value = c.puntosGame;
          selector.addEventListener('change', () => { c.puntosGame = selector.value; refrescar(); });
          return selector;
        })(),
      }),
      casilla({
        texto: Number(c.setsParaGanar) === 1
          ? 'Todo el partido es un tie-break (sin games)'
          : 'El set decisivo se juega como super tie-break',
        marcada: Boolean(c.ultimoSetSuperTiebreak),
        alCambiar: (marcada) => { c.ultimoSetSuperTiebreak = marcada; refrescar(); },
      }),
      Number(c.setsParaGanar) === 1 && !c.ultimoSetSuperTiebreak
        ? el('div', { class: 'ayuda', style: 'margin:-4px 0 8px 25px' }, [
            'Márcala si lo que quieres es un tie-break suelto, por ejemplo "un tie-break a 7".',
          ])
        : null,
      c.ultimoSetSuperTiebreak
        ? campo({
            etiqueta: todoEsTiebreak ? 'Puntos del tie-break' : 'Puntos del super tie-break',
            ayuda: todoEsTiebreak
              ? 'El partido se lo lleva el primero que llegue a estos puntos con la diferencia de abajo.'
              : 'Lo habitual son 10 puntos con 2 de diferencia.',
            control: numero('puntosSuperTiebreak', { min: 2, max: 40 }),
          })
        : null,
      todoEsTiebreak
        ? campo({
            etiqueta: 'Diferencia mínima',
            ayuda: '2 = hay que ganar por dos (7-5, 9-7). 1 = alcanza con uno (7-6).',
            control: numero('diferenciaTiebreak', { min: 1, max: 5 }),
          })
        : null,
    ];
  }

  if (trabajo.tipo === 'puntos') {
    const etiquetaUnidad = el('input', { type: 'text', valor: c.etiqueta || 'Puntos', placeholder: 'Goles' });
    etiquetaUnidad.addEventListener('input', () => { c.etiqueta = etiquetaUnidad.value; refrescar(); });
    const conLimite = c.limite !== null && c.limite !== undefined;
    return [
      el('div', { class: 'campo-fila' }, [
        campo({ etiqueta: 'Nombre de la unidad', ayuda: 'Goles, puntos, canastas...', control: etiquetaUnidad }),
      ]),
      casilla({
        texto: 'El partido se cierra al llegar a un marcador',
        marcada: conLimite,
        alCambiar: (marcada) => { c.limite = marcada ? 21 : null; refrescar(); },
      }),
      conLimite
        ? campo({ etiqueta: 'Marcador que cierra el partido', control: numero('limite', { min: 1, max: 999 }) })
        : null,
      casilla({
        texto: 'Se permite que el partido termine empatado',
        marcada: Boolean(c.permiteEmpate),
        alCambiar: (marcada) => { c.permiteEmpate = marcada; refrescar(); },
      }),
    ];
  }

  return [
    campo({
      etiqueta: 'Rondas que hay que ganar',
      ayuda: '2 = al mejor de 3 rondas.',
      control: numero('rondasParaGanar', { min: 1, max: 20 }),
    }),
  ];
}
