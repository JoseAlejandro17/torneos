// Componentes de interfaz compartidos: modales, avisos, escudos y fichas.

import { el, pintar, $, colorContraste } from './util.js';
import { nombreEquipo, subtituloEquipo, inicialesEquipo, equipoPorId } from './equipos.js';

// ------------------------------------------------------------------- Avisos

/** Muestra un aviso flotante. `tono` puede ser 'ok', 'error' o 'atencion'. */
export function avisar(mensaje, tono = 'ok') {
  const contenedor = $('#avisos');
  const nodo = el('div', { class: `aviso ${tono === 'ok' ? '' : tono}`, text: mensaje });
  contenedor.append(nodo);
  setTimeout(() => {
    nodo.style.opacity = '0';
    setTimeout(() => nodo.remove(), 200);
  }, 3200);
}

// ------------------------------------------------------------------ Modales

let cerrarActual = null;

/**
 * Abre un modal. `armar` recibe { cerrar, cuerpo, pie } y arma el contenido.
 * Devuelve la función para cerrarlo.
 */
export function abrirModal({ titulo, ancho = false, contenido, acciones = [] }) {
  const capa = $('#capa-modal');
  const focoPrevio = document.activeElement;
  const cerrar = () => {
    capa.classList.add('oculto');
    capa.replaceChildren();
    cerrarActual = null;
    document.removeEventListener('keydown', alPresionar);
    // Devolvemos el foco a donde estaba, para no perder a quien navega con teclado.
    if (focoPrevio?.isConnected) focoPrevio.focus();
  };
  const alPresionar = (evento) => {
    if (evento.key === 'Escape') { cerrar(); return; }
    if (evento.key !== 'Tab') return;
    // El tabulador se queda dentro del diálogo mientras está abierto.
    const focos = modal.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])'
    );
    if (!focos.length) return;
    const primero = focos[0];
    const ultimo = focos[focos.length - 1];
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  };
  cerrarActual = cerrar;

  const cuerpo = el('div', { class: 'modal-cuerpo' });
  const pie = el('div', { class: 'modal-pie' });

  const idTitulo = `titulo-modal-${Math.random().toString(36).slice(2, 8)}`;
  const modal = el('div', {
    class: `modal ${ancho ? 'modal-ancho' : ''}`,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': idTitulo,
  }, [
    el('div', { class: 'modal-cabeza' }, [
      el('h3', { id: idTitulo, text: titulo }),
      el('button', { class: 'cerrar', onclick: cerrar, 'aria-label': 'Cerrar', text: '×' }),
    ]),
    cuerpo,
    pie,
  ]);

  const nodos = typeof contenido === 'function' ? contenido({ cerrar }) : contenido;
  pintar(cuerpo, [].concat(nodos));

  const botones = typeof acciones === 'function' ? acciones({ cerrar }) : acciones;
  if (botones.length) pintar(pie, botones);
  else pie.remove();

  capa.replaceChildren(modal);
  capa.classList.remove('oculto');
  capa.onclick = (evento) => { if (evento.target === capa) cerrar(); };
  document.addEventListener('keydown', alPresionar);

  // El foco entra al primer campo; si el diálogo no tiene, al primer botón útil.
  const primerCampo = cuerpo.querySelector('input, select, textarea')
    || cuerpo.querySelector('button')
    || pie.querySelector('button');
  if (primerCampo) setTimeout(() => primerCampo.focus(), 40);

  return cerrar;
}

/** Cierra el modal abierto, si hay alguno. */
export function cerrarModal() {
  if (cerrarActual) cerrarActual();
}

/** Pide confirmación. Llama a `alAceptar` si el usuario acepta. */
export function confirmar({ titulo, mensaje, textoAceptar = 'Aceptar', peligro = false, alAceptar }) {
  abrirModal({
    titulo,
    contenido: () => el('p', { class: 'suave nada', text: mensaje }),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: `boton ${peligro ? 'boton-peligro' : 'boton-primario'}`,
        text: textoAceptar,
        onclick: () => { cerrar(); alAceptar(); },
      }),
    ],
  });
}

// ------------------------------------------------------------------ Piezas

/** Escudo con las iniciales y el color del equipo. */
export function escudo(torneo, equipo, tamano = '') {
  const color = equipo?.color || '#3a4050';
  return el('span', {
    class: `escudo ${tamano}`,
    style: `background:${color};color:${colorContraste(color)}`,
    text: equipo ? inicialesEquipo(torneo, equipo) : '?',
    title: equipo ? nombreEquipo(torneo, equipo) : 'Por definir',
  });
}

/** Línea con escudo, nombre y subtítulo de un equipo. */
export function lineaEquipo(torneo, equipo, { tamano = '', mostrarSub = true, invertido = false } = {}) {
  const textos = el('div', { style: 'min-width:0' }, [
    el('div', { class: 'nombre', text: equipo ? nombreEquipo(torneo, equipo) : 'Por definir' }),
    mostrarSub && equipo && subtituloEquipo(torneo, equipo)
      ? el('div', { class: 'sub', text: subtituloEquipo(torneo, equipo) })
      : null,
  ]);
  return el('div', { class: `equipo-linea ${invertido ? 'derecho' : ''}` }, [escudo(torneo, equipo, tamano), textos]);
}

/**
 * Un lado del partido: un equipo, o la pareja de esa ronda en el americano.
 * `ids` es la lista de equipos (o jugadores) que están de ese lado.
 */
export function lineaLado(torneo, ids, { invertido = false, tamano = 'escudo-chico' } = {}) {
  const equipos = (ids || []).map((idEquipo) => equipoPorId(torneo, idEquipo)).filter(Boolean);
  if (equipos.length === 1) {
    return lineaEquipo(torneo, equipos[0], { invertido, tamano: tamano === 'escudo-chico' ? '' : tamano });
  }
  if (!equipos.length) {
    return el('div', { class: `equipo-linea ${invertido ? 'derecho' : ''}` }, [
      escudo(torneo, null, tamano),
      el('div', { class: 'nombre tenue', text: 'Por definir' }),
    ]);
  }
  return el('div', { class: `equipo-linea ${invertido ? 'derecho' : ''}` }, [
    el('span', { class: 'escudos-pareja' }, equipos.map((equipo) => escudo(torneo, equipo, tamano))),
    el('div', { style: 'min-width:0' }, [
      el('div', { class: 'nombre', text: equipos.map((e) => nombreEquipo(torneo, e)).join(' + ') }),
    ]),
  ]);
}

/** Bloque de estado vacío. */
export function vacio({ icono = '📋', titulo, mensaje, accion = null }) {
  return el('div', { class: 'vacio' }, [
    el('span', { class: 'icono', text: icono }),
    el('h3', { text: titulo }),
    mensaje ? el('p', { class: 'nada', text: mensaje }) : null,
    accion ? el('div', { style: 'margin-top:16px' }, [accion]) : null,
  ]);
}

/** Etiqueta chica de color. */
export function etiqueta(texto, tono = '') {
  return el('span', { class: `etiqueta ${tono ? `etiqueta-${tono}` : ''}`, text: texto });
}

/** Campo numérico con botones de más y menos. */
export function contador({ valor, minimo = 0, maximo = 99, alCambiar }) {
  const entrada = el('input', { type: 'number', valor: String(valor), min: String(minimo), max: String(maximo) });
  const ajustar = (delta) => {
    const nuevo = Math.min(maximo, Math.max(minimo, Number(entrada.value || 0) + delta));
    entrada.value = String(nuevo);
    alCambiar(nuevo);
  };
  entrada.addEventListener('input', () => {
    const nuevo = Math.min(maximo, Math.max(minimo, Number(entrada.value || 0)));
    alCambiar(nuevo);
  });
  return el('div', { class: 'contador' }, [
    el('button', { type: 'button', text: '−', onclick: () => ajustar(-1), 'aria-label': 'Restar' }),
    entrada,
    el('button', { type: 'button', text: '+', onclick: () => ajustar(1), 'aria-label': 'Sumar' }),
  ]);
}

/** Tarjeta clicable para elegir una opción de una lista. */
export function tarjetaOpcion({ icono, titulo, detalle, elegida, compacta = false, alElegir }) {
  return el('button', {
    type: 'button',
    class: `opcion ${elegida ? 'elegida' : ''} ${compacta ? 'compacta' : ''}`,
    onclick: alElegir,
  }, [
    icono ? el('span', { class: 'icono', text: icono }) : null,
    el('span', { style: 'min-width:0' }, [
      el('span', { class: 'titulo', style: 'display:block', text: titulo }),
      detalle ? el('span', { class: 'detalle', style: 'display:block', text: detalle }) : null,
    ]),
  ]);
}

/** Campo de formulario con etiqueta y ayuda. */
export function campo({ etiqueta: textoEtiqueta, ayuda, control }) {
  return el('div', { class: 'campo' }, [
    textoEtiqueta ? el('label', { text: textoEtiqueta }) : null,
    control,
    ayuda ? el('div', { class: 'ayuda', text: ayuda }) : null,
  ]);
}

/** Casilla de verificación con texto al lado. */
export function casilla({ texto, marcada, alCambiar }) {
  const entrada = el('input', { type: 'checkbox' });
  entrada.checked = Boolean(marcada);
  entrada.addEventListener('change', () => alCambiar(entrada.checked));
  return el('label', { class: 'casilla' }, [entrada, el('span', { text: texto })]);
}

/** Barra de avance con texto. */
export function barraAvance(hechos, total) {
  const porcentaje = total ? Math.round((hechos / total) * 100) : 0;
  return el('div', {}, [
    el('div', { class: 'fila-separada', style: 'margin-bottom:6px' }, [
      el('small', { class: 'tenue', text: `${hechos} de ${total} partidos jugados` }),
      el('small', { class: 'tenue', text: `${porcentaje}%` }),
    ]),
    el('div', { class: 'barra-avance' }, [el('div', { style: `width:${porcentaje}%` })]),
  ]);
}

/** Pestañas simples. `alCambiar` recibe la clave elegida. */
export function pestanas(items, activa, alCambiar) {
  return el('div', { class: 'pestanas' },
    items.map((item) => el('button', {
      type: 'button',
      class: item.clave === activa ? 'activa' : '',
      text: item.etiqueta,
      onclick: () => alCambiar(item.clave),
    }))
  );
}
