// Arranque y enrutador. Las rutas van en el hash: #/torneo/tor_abc.

import { $, $$, pintar } from './util.js';
import { vistaInicio } from './vistas/inicio.js';
import { vistaDeportes } from './vistas/deportes.js';
import { vistaPersonas } from './vistas/personas.js';
import { vistaNuevoTorneo } from './vistas/nuevo-torneo.js';
import { vistaTorneo } from './vistas/torneo.js';
import { vistaImprimir } from './vistas/imprimir.js';
import { vistaAjustes } from './vistas/ajustes.js';
import { cerrarModal } from './ui.js';

const RUTAS = [
  { patron: /^\/$/, vista: vistaInicio, nav: '/' },
  { patron: /^\/nuevo$/, vista: vistaNuevoTorneo, nav: '/' },
  { patron: /^\/torneo\/([\w-]+)$/, vista: vistaTorneo, nav: '/' },
  { patron: /^\/torneo\/([\w-]+)\/imprimir$/, vista: vistaImprimir, nav: '/' },
  { patron: /^\/deportes$/, vista: vistaDeportes, nav: '/deportes' },
  { patron: /^\/personas$/, vista: vistaPersonas, nav: '/personas' },
  { patron: /^\/ajustes$/, vista: vistaAjustes, nav: '/ajustes' },
];

/** Cambia de ruta. */
export function ir(ruta) {
  location.hash = `#${ruta}`;
}

/** Vuelve a dibujar la vista actual. */
export function redibujar() {
  dibujar();
}

function rutaActual() {
  const bruto = location.hash.replace(/^#/, '') || '/';
  return bruto.startsWith('/') ? bruto : `/${bruto}`;
}

function dibujar() {
  const ruta = rutaActual();
  const contenedor = $('#app');
  cerrarModal();

  for (const { patron, vista, nav } of RUTAS) {
    const coincide = ruta.match(patron);
    if (!coincide) continue;
    marcarMenu(nav);
    try {
      pintar(contenedor, vista(...coincide.slice(1)));
    } catch (error) {
      console.error(error);
      pintar(contenedor, mensajeDeError(error));
    }
    window.scrollTo({ top: 0 });
    return;
  }

  marcarMenu('/');
  pintar(contenedor, mensajeDeError(new Error(`La dirección "${ruta}" no existe.`)));
}

function marcarMenu(nav) {
  for (const enlace of $$('#menu a')) {
    const activo = enlace.dataset.ruta === nav;
    enlace.classList.toggle('activo', activo);
    if (activo) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
}

function mensajeDeError(error) {
  const bloque = document.createElement('div');
  bloque.className = 'vacio';
  bloque.innerHTML = `
    <span class="icono">😕</span>
    <h3>Algo salió mal</h3>
    <p class="nada">${error.message}</p>
    <p style="margin-top:14px"><a href="#/">Volver al inicio</a></p>`;
  return bloque;
}

window.addEventListener('hashchange', dibujar);
dibujar();
