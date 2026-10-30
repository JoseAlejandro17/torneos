// Modal para ponerle nombre a los equipos o jugadores de un torneo.
//
// Sirve sobre todo para el flujo de papel: se imprime el torneo con los equipos
// como letras (A, B, C...), se juega y se anota a mano, y después se vuelve acá
// a decir quién era cada letra.

import { el, pintar, normalizar, iniciales, id as nuevoId } from '../util.js';
import { personas, crearPersona, guardar } from '../modelo.js';
import { nombreEquipo, esRotativo } from '../equipos.js';
import { abrirModal, avisar, campo } from '../ui.js';

/** Letra que le toca a un equipo según su posición: A, B, ... Z, AA, AB... */
export function letraDe(indice) {
  let resto = indice;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (resto % 26)) + letra;
    resto = Math.floor(resto / 26) - 1;
  } while (resto >= 0);
  return letra;
}

/** Nombra a los equipos de un torneo con letras: Equipo A, Equipo B... */
export function nombrarConLetras(equipos, { rotativo = false } = {}) {
  equipos.forEach((equipo, indice) => {
    equipo.letra = letraDe(indice);
    equipo.nombre = rotativo ? `Jugador ${equipo.letra}` : `Equipo ${equipo.letra}`;
  });
  return equipos;
}

export function modalAsignarNombres({ torneo, alGuardar }) {
  const rotativo = esRotativo(torneo);
  const tamano = rotativo ? 1 : torneo.tamanoEquipo;

  // Copia de trabajo: solo se guarda al aceptar.
  const trabajo = torneo.equipos.map((equipo) => ({
    id: equipo.id,
    letra: equipo.letra || letraDe(torneo.equipos.indexOf(equipo)),
    nombre: equipo.nombre || '',
    integrantes: (equipo.integrantes || []).slice(),
  }));

  const listaPersonas = el('datalist', { id: 'personas-conocidas' },
    personas().map((p) => el('option', { value: p.nombre })));

  const zona = el('div', { class: 'asignacion' });

  const dibujar = () => {
    pintar(zona, trabajo.map((fila, indice) => filaAsignacion({
      fila, indice, tamano, rotativo, dibujar,
    })));
  };
  dibujar();

  abrirModal({
    titulo: rotativo ? 'Nombres de los jugadores' : 'Nombres de los equipos',
    ancho: true,
    contenido: () => el('div', {}, [
      el('p', { class: 'suave' }, [
        rotativo
          ? 'Escribe quién es cada letra. Los resultados que ya anotaste se mantienen.'
          : 'Escribe el nombre de cada equipo y quiénes lo integran. Los resultados que ya anotaste se mantienen.',
      ]),
      listaPersonas,
      zona,
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: 'Guardar nombres',
        onclick: () => {
          for (const fila of trabajo) {
            const equipo = torneo.equipos.find((e) => e.id === fila.id);
            if (!equipo) continue;
            equipo.letra = fila.letra;
            equipo.nombre = fila.nombre.trim() || `${rotativo ? 'Jugador' : 'Equipo'} ${fila.letra}`;
            equipo.integrantes = fila.integrantes;
          }
          guardar();
          cerrar();
          avisar('Nombres guardados.');
          alGuardar();
        },
      }),
    ],
  });
}

function filaAsignacion({ fila, indice, tamano, rotativo, dibujar }) {
  const entradaNombre = el('input', {
    type: 'text',
    valor: fila.nombre,
    list: 'personas-conocidas',
    placeholder: rotativo ? 'Nombre del jugador' : 'Nombre del equipo',
  });
  entradaNombre.addEventListener('input', () => { fila.nombre = entradaNombre.value; });

  // En el americano cada jugador es una persona: el nombre escrito es la persona.
  if (rotativo) {
    entradaNombre.addEventListener('change', () => {
      const escrito = entradaNombre.value.trim();
      if (!escrito) return;
      const per = crearPersona({ nombre: escrito });
      if (per) fila.integrantes = [per.id];
    });
    return el('div', { class: 'fila-asignacion' }, [
      el('span', { class: 'letra-equipo', text: fila.letra }),
      entradaNombre,
    ]);
  }

  const integrantes = el('div', { class: 'fichas', style: 'margin-top:6px' }, [
    ...fila.integrantes.map((idPersona) => {
      const per = personas().find((p) => p.id === idPersona);
      return el('span', { class: 'ficha', style: 'cursor:default' }, [
        el('span', {
          class: 'escudo escudo-chico',
          style: 'background:var(--fondo-4);color:var(--texto)',
          text: iniciales(per?.nombre || '?'),
        }),
        el('span', { text: per?.nombre || 'Persona borrada' }),
        el('button', {
          class: 'quitar',
          text: '×',
          title: 'Quitar',
          'aria-label': 'Quitar',
          onclick: () => {
            fila.integrantes = fila.integrantes.filter((i) => i !== idPersona);
            dibujar();
          },
        }),
      ]);
    }),
    fila.integrantes.length < tamano
      ? (() => {
          const entrada = el('input', {
            type: 'text',
            list: 'personas-conocidas',
            placeholder: '+ integrante',
            style: 'width:150px;padding:5px 10px;font-size:0.85rem',
          });
          const sumar = () => {
            const escrito = entrada.value.trim();
            if (!escrito) return;
            const existente = personas().find((p) => normalizar(p.nombre) === normalizar(escrito));
            const per = existente || crearPersona({ nombre: escrito });
            if (per && !fila.integrantes.includes(per.id)) fila.integrantes.push(per.id);
            entrada.value = '';
            dibujar();
          };
          entrada.addEventListener('change', sumar);
          entrada.addEventListener('keydown', (evento) => {
            if (evento.key === 'Enter') { evento.preventDefault(); sumar(); }
          });
          return entrada;
        })()
      : null,
  ]);

  return el('div', { class: 'fila-asignacion ancha' }, [
    el('span', { class: 'letra-equipo', text: fila.letra }),
    el('div', { class: 'crece', style: 'min-width:0' }, [
      entradaNombre,
      integrantes,
    ]),
  ]);
}
