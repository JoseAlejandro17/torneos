// Utilidades generales: creación de elementos, ids, mezcla aleatoria y formateo.

/** Genera un id corto y único. */
export function id(prefijo = 'x') {
  return `${prefijo}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

/** Atajo para document.querySelector. */
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
/** Atajo para querySelectorAll, devuelto como arreglo. */
export const $$ = (sel, raiz = document) => Array.from(raiz.querySelectorAll(sel));

/**
 * Crea un elemento. `props` acepta atributos, `class`, `text`, `html`,
 * `dataset` y manejadores `onclick`, `oninput`, etc.
 */
export function el(etiqueta, props = {}, hijos = []) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === 'class') nodo.className = valor;
    else if (clave === 'text') nodo.textContent = valor;
    else if (clave === 'html') nodo.innerHTML = valor;
    else if (clave === 'dataset') Object.assign(nodo.dataset, valor);
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else if (clave === 'valor') nodo.value = valor;
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of [].concat(hijos)) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    nodo.append(hijo instanceof Node ? hijo : document.createTextNode(String(hijo)));
  }
  return nodo;
}

/** Vacía un contenedor y le pone contenido nuevo. */
export function pintar(contenedor, ...contenido) {
  contenedor.replaceChildren(...contenido.flat().filter(Boolean));
  return contenedor;
}

/** Mezcla un arreglo (copia) con Fisher-Yates. */
export function mezclar(arreglo) {
  const copia = arreglo.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Reparte los elementos en `cantidad` grupos, en serpentina (1-2-3-3-2-1). */
export function repartirSerpentina(elementos, cantidad) {
  const grupos = Array.from({ length: cantidad }, () => []);
  let indice = 0, paso = 1;
  for (const elemento of elementos) {
    grupos[indice].push(elemento);
    if (indice + paso < 0 || indice + paso >= cantidad) paso = -paso;
    else indice += paso;
  }
  return grupos;
}

/** La potencia de 2 igual o mayor a n. */
export function potenciaDeDos(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Fecha legible en formato chileno. */
export function fechaLegible(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Texto seguro para comparar: sin tildes, en minúsculas. */
export function normalizar(texto) {
  return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** Devuelve el color de texto (claro u oscuro) que contrasta con un fondo hex. */
export function colorContraste(hex) {
  const limpio = String(hex || '#888888').replace('#', '');
  const r = parseInt(limpio.slice(0, 2), 16) || 0;
  const g = parseInt(limpio.slice(2, 4), 16) || 0;
  const b = parseInt(limpio.slice(4, 6), 16) || 0;
  const luminancia = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminancia > 0.6 ? '#1a1a1f' : '#ffffff';
}

/** Iniciales de un nombre, para los avatares. */
export function iniciales(nombre) {
  return String(nombre || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase();
}
