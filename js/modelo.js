// Estado de la aplicación y persistencia en el navegador (localStorage).
//
// Todo vive en un único objeto `datos` con tres colecciones:
//   deportes  catálogo de deportes/juegos, cada uno con sus sistemas de anotación
//   personas  el registro de gente que puede jugar
//   torneos   los torneos creados, con sus equipos y partidos

import { id as nuevoId, normalizar } from './util.js';
import { DEPORTES_INICIALES } from './catalogo.js';

const CLAVE = 'torneos-deportivos-v1';
const VERSION = 1;

/** Estructura vacía de datos. */
function datosIniciales() {
  return {
    version: VERSION,
    deportes: structuredClone(DEPORTES_INICIALES),
    personas: [],
    torneos: [],
    incorporados: todosLosIdsDelCatalogo(),
  };
}

/** Ids de todo lo que trae el catálogo de fábrica. */
function todosLosIdsDelCatalogo() {
  return DEPORTES_INICIALES.flatMap((d) => [d.id, ...d.sistemas.map((s) => s.id)]);
}

let datos = cargar();
const suscriptores = new Set();

function cargar() {
  try {
    const bruto = localStorage.getItem(CLAVE);
    if (!bruto) return datosIniciales();
    const guardado = JSON.parse(bruto);
    // Nos aseguramos de que existan todas las colecciones aunque el guardado sea viejo.
    const datosGuardados = {
      version: VERSION,
      deportes: guardado.deportes?.length ? guardado.deportes : structuredClone(DEPORTES_INICIALES),
      personas: guardado.personas ?? [],
      torneos: guardado.torneos ?? [],
      incorporados: guardado.incorporados ?? [],
    };
    incorporarNovedades(datosGuardados);
    return datosGuardados;
  } catch (error) {
    console.warn('No se pudo leer el almacenamiento, se parte de cero.', error);
    return datosIniciales();
  }
}

/**
 * Suma al catálogo guardado los deportes y formas de anotar que vinieron en
 * versiones nuevas de la aplicación.
 *
 * Lo que ya se incorporó una vez queda anotado en `incorporados`, así que si
 * después lo borras no vuelve a aparecer solo.
 */
function incorporarNovedades(datosGuardados) {
  const yaVistos = new Set(datosGuardados.incorporados);

  for (const deporteNuevo of DEPORTES_INICIALES) {
    const existente = datosGuardados.deportes.find((d) => d.id === deporteNuevo.id);

    if (!existente) {
      if (yaVistos.has(deporteNuevo.id)) continue; // lo borró a propósito
      datosGuardados.deportes.push(structuredClone(deporteNuevo));
      datosGuardados.incorporados.push(deporteNuevo.id);
      for (const sistema of deporteNuevo.sistemas) datosGuardados.incorporados.push(sistema.id);
      continue;
    }

    for (const sistemaNuevo of deporteNuevo.sistemas) {
      if (yaVistos.has(sistemaNuevo.id)) continue;
      if (existente.sistemas.some((s) => s.id === sistemaNuevo.id)) {
        datosGuardados.incorporados.push(sistemaNuevo.id);
        continue;
      }
      existente.sistemas.push(structuredClone(sistemaNuevo));
      datosGuardados.incorporados.push(sistemaNuevo.id);
    }
  }
}

/** Guarda en localStorage y avisa a los suscriptores. */
export function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch (error) {
    console.error('No se pudo guardar.', error);
  }
  for (const avisar of suscriptores) avisar(datos);
}

/** Se suscribe a los cambios. Devuelve la función para desuscribirse. */
export function alCambiar(avisar) {
  suscriptores.add(avisar);
  return () => suscriptores.delete(avisar);
}

/** Acceso de lectura al estado completo. */
export const estado = () => datos;

// ----------------------------------------------------------------------------
// Deportes
// ----------------------------------------------------------------------------

export const deportes = () => datos.deportes;
export const deporte = (idDeporte) => datos.deportes.find((d) => d.id === idDeporte) || null;

/** Crea un deporte. Devuelve el deporte creado. */
export function crearDeporte({ nombre, icono = '🏅', tamanoEquipo = 1, sistemas = [] }) {
  const nuevo = { id: nuevoId('dep'), nombre: nombre.trim(), icono, tamanoEquipo, sistemas };
  datos.deportes.push(nuevo);
  guardar();
  return nuevo;
}

export function editarDeporte(idDeporte, cambios) {
  const objetivo = deporte(idDeporte);
  if (!objetivo) return null;
  Object.assign(objetivo, cambios);
  guardar();
  return objetivo;
}

/** Borra un deporte, salvo que algún torneo lo esté usando. */
export function borrarDeporte(idDeporte) {
  if (datos.torneos.some((t) => t.deporteId === idDeporte)) {
    return { ok: false, motivo: 'Hay torneos que usan este deporte.' };
  }
  datos.deportes = datos.deportes.filter((d) => d.id !== idDeporte);
  guardar();
  return { ok: true };
}

/** Agrega un sistema de anotación a un deporte. */
export function crearSistema(idDeporte, sistema) {
  const objetivo = deporte(idDeporte);
  if (!objetivo) return null;
  const nuevo = { ...sistema, id: sistema.id || nuevoId('sis') };
  objetivo.sistemas.push(nuevo);
  guardar();
  return nuevo;
}

export function editarSistema(idDeporte, idSistema, cambios) {
  const objetivo = deporte(idDeporte);
  const sistema = objetivo?.sistemas.find((s) => s.id === idSistema);
  if (!sistema) return null;
  Object.assign(sistema, cambios);
  guardar();
  return sistema;
}

export function borrarSistema(idDeporte, idSistema) {
  const objetivo = deporte(idDeporte);
  if (!objetivo) return { ok: false, motivo: 'Deporte no encontrado.' };
  if (datos.torneos.some((t) => t.sistemaId === idSistema)) {
    return { ok: false, motivo: 'Hay torneos que usan este sistema de anotación.' };
  }
  objetivo.sistemas = objetivo.sistemas.filter((s) => s.id !== idSistema);
  guardar();
  return { ok: true };
}

/** Busca un sistema de anotación en todos los deportes. */
export function sistema(idSistema) {
  for (const d of datos.deportes) {
    const encontrado = d.sistemas.find((s) => s.id === idSistema);
    if (encontrado) return encontrado;
  }
  return null;
}

// ----------------------------------------------------------------------------
// Personas
// ----------------------------------------------------------------------------

export const personas = () => datos.personas;
export const persona = (idPersona) => datos.personas.find((p) => p.id === idPersona) || null;

/** Crea una persona. Si ya existe alguien con el mismo nombre, devuelve esa. */
export function crearPersona({ nombre, apodo = '', notas = '' }) {
  const limpio = String(nombre || '').trim();
  if (!limpio) return null;
  const existente = datos.personas.find((p) => normalizar(p.nombre) === normalizar(limpio));
  if (existente) return existente;
  const nueva = { id: nuevoId('per'), nombre: limpio, apodo: apodo.trim(), notas, creada: new Date().toISOString() };
  datos.personas.push(nueva);
  guardar();
  return nueva;
}

export function editarPersona(idPersona, cambios) {
  const objetivo = persona(idPersona);
  if (!objetivo) return null;
  Object.assign(objetivo, cambios);
  guardar();
  return objetivo;
}

/** Borra una persona del registro y la saca de los equipos donde estaba. */
export function borrarPersona(idPersona) {
  datos.personas = datos.personas.filter((p) => p.id !== idPersona);
  for (const torneo of datos.torneos) {
    for (const equipo of torneo.equipos) {
      equipo.integrantes = equipo.integrantes.filter((i) => i !== idPersona);
    }
  }
  guardar();
  return { ok: true };
}

/** Cuántos torneos ha jugado una persona. */
export function torneosDePersona(idPersona) {
  return datos.torneos.filter((t) => t.equipos.some((e) => e.integrantes.includes(idPersona)));
}

// ----------------------------------------------------------------------------
// Torneos
// ----------------------------------------------------------------------------

export const torneos = () => datos.torneos;
export const torneo = (idTorneo) => datos.torneos.find((t) => t.id === idTorneo) || null;

/**
 * Crea un torneo. `datosTorneo` trae nombre, deporteId, sistemaId, tamanoEquipo,
 * campoNombre, modalidad, opciones y equipos.
 */
export function crearTorneo(datosTorneo) {
  const nuevo = {
    id: nuevoId('tor'),
    nombre: datosTorneo.nombre?.trim() || 'Torneo sin nombre',
    deporteId: datosTorneo.deporteId,
    sistemaId: datosTorneo.sistemaId,
    tamanoEquipo: datosTorneo.tamanoEquipo ?? 1,
    campoNombre: datosTorneo.campoNombre ?? 'nombre',
    modalidad: datosTorneo.modalidad,
    opciones: datosTorneo.opciones ?? {},
    equipos: datosTorneo.equipos ?? [],
    partidos: [],
    estado: 'borrador', // borrador | enCurso | terminado
    creado: new Date().toISOString(),
    notas: datosTorneo.notas ?? '',
  };
  datos.torneos.push(nuevo);
  guardar();
  return nuevo;
}

export function editarTorneo(idTorneo, cambios) {
  const objetivo = torneo(idTorneo);
  if (!objetivo) return null;
  Object.assign(objetivo, cambios);
  guardar();
  return objetivo;
}

export function borrarTorneo(idTorneo) {
  datos.torneos = datos.torneos.filter((t) => t.id !== idTorneo);
  guardar();
  return { ok: true };
}

/** Duplica un torneo con sus equipos, pero sin los partidos jugados. */
export function duplicarTorneo(idTorneo) {
  const original = torneo(idTorneo);
  if (!original) return null;
  const copia = structuredClone(original);
  copia.id = nuevoId('tor');
  copia.nombre = `${original.nombre} (copia)`;
  copia.partidos = [];
  copia.estado = 'borrador';
  copia.creado = new Date().toISOString();
  datos.torneos.push(copia);
  guardar();
  return copia;
}

// ----------------------------------------------------------------------------
// Respaldo
// ----------------------------------------------------------------------------

/** Exporta todo como texto JSON. */
export const exportar = () => JSON.stringify(datos, null, 2);

/** Importa un respaldo reemplazando los datos actuales. */
export function importar(texto) {
  try {
    const nuevo = JSON.parse(texto);
    if (!nuevo || typeof nuevo !== 'object') throw new Error('formato inválido');
    datos = {
      version: VERSION,
      deportes: nuevo.deportes ?? structuredClone(DEPORTES_INICIALES),
      personas: nuevo.personas ?? [],
      torneos: nuevo.torneos ?? [],
      incorporados: nuevo.incorporados ?? todosLosIdsDelCatalogo(),
    };
    guardar();
    return { ok: true };
  } catch (error) {
    return { ok: false, motivo: `No se pudo leer el archivo: ${error.message}` };
  }
}

/** Borra todo y vuelve al catálogo inicial. */
export function reiniciar() {
  datos = datosIniciales();
  guardar();
}
