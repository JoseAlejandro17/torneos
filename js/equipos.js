// Cómo se muestra un equipo: el torneo define con qué campo se lo nombra.

import { persona } from './modelo.js';
import { iniciales } from './util.js';

/**
 * Nombre visible de un equipo. El torneo elige el campo (`campoNombre`) y si
 * ese campo está vacío se cae a los demás en orden, para que nunca quede en blanco.
 */
export function nombreEquipo(torneo, equipo) {
  if (!equipo) return 'Por definir';
  const orden = [torneo?.campoNombre || 'nombre', 'nombre', 'apodo', 'mascota', 'lema', 'integrantes'];
  for (const campo of orden) {
    const valor = campo === 'integrantes' ? nombresIntegrantes(equipo).join(' / ') : (equipo[campo] || '').trim();
    if (valor) return valor;
  }
  return `Equipo ${equipo.numero ?? ''}`.trim();
}

/** El segundo renglón de la tarjeta: algo distinto al nombre principal. */
export function subtituloEquipo(torneo, equipo) {
  if (!equipo) return '';
  const principal = nombreEquipo(torneo, equipo);
  const integrantes = nombresIntegrantes(equipo).join(' · ');
  if (integrantes && integrantes !== principal) return integrantes;
  for (const campo of ['apodo', 'mascota', 'lema']) {
    const valor = (equipo[campo] || '').trim();
    if (valor && valor !== principal) return valor;
  }
  return '';
}

/** Nombres de los integrantes, resueltos desde el registro de personas. */
export function nombresIntegrantes(equipo) {
  return (equipo?.integrantes || [])
    .map((idPersona) => persona(idPersona))
    .filter(Boolean)
    .map((p) => p.nombre);
}

/** Iniciales para el escudito del equipo. */
export function inicialesEquipo(torneo, equipo) {
  return iniciales(nombreEquipo(torneo, equipo));
}

/** Busca un equipo del torneo por id. */
export const equipoPorId = (torneo, idEquipo) =>
  torneo?.equipos.find((e) => e.id === idEquipo) || null;

/**
 * Nombre de un lado del partido. En las modalidades por equipos es un nombre
 * suelto; en el americano es la pareja de esa ronda ("Ana + Pepe").
 */
export function nombreLado(torneo, ids) {
  const nombres = (ids || [])
    .map((idEquipo) => equipoPorId(torneo, idEquipo))
    .filter(Boolean)
    .map((equipo) => nombreEquipo(torneo, equipo));
  return nombres.length ? nombres.join(' + ') : 'Por definir';
}

/** ¿Este torneo se juega con parejas que cambian en cada ronda? */
export const esRotativo = (torneo) => torneo?.modalidad === 'americano';
