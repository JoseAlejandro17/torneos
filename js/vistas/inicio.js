// Pantalla de inicio: lista de torneos.

import { el, fechaLegible } from '../util.js';
import { torneos, deporte, sistema, borrarTorneo, duplicarTorneo, personas } from '../modelo.js';
import { resumenTorneo } from '../fixture.js';
import { resumenSistema } from '../anotacion.js';
import { nombreEquipo } from '../equipos.js';
import { MODALIDADES } from '../catalogo.js';
import { vacio, etiqueta, confirmar, avisar, barraAvance } from '../ui.js';
import { ir, redibujar } from '../app.js';

export function vistaInicio() {
  const lista = torneos().slice().reverse();

  const encabezado = el('div', { class: 'encabezado-pagina' }, [
    el('div', {}, [
      el('h1', { text: 'Mis torneos' }),
      el('p', {
        text: lista.length
          ? `${lista.length} ${lista.length === 1 ? 'torneo' : 'torneos'} · ${personas().length} personas en el registro`
          : 'Todavía no hay torneos creados.',
      }),
    ]),
  ]);

  if (!lista.length) {
    return [
      encabezado,
      vacio({
        icono: '🏆',
        titulo: 'Empecemos por el primer torneo',
        mensaje: 'Elige el deporte, arma los equipos y define la modalidad y la forma de anotar.',
        accion: el('a', { class: 'boton boton-primario boton-grande', href: '#/nuevo', text: 'Crear un torneo' }),
      }),
    ];
  }

  return [
    encabezado,
    el('div', { class: 'rejilla rejilla-ancha' }, lista.map(tarjetaTorneo)),
  ];
}

function tarjetaTorneo(torneo) {
  const dep = deporte(torneo.deporteId);
  const sis = sistema(torneo.sistemaId);
  const modalidad = MODALIDADES.find((m) => m.id === torneo.modalidad);
  const resumen = resumenTorneo(torneo, sis);

  const estado = resumen.terminado
    ? etiqueta('Terminado', 'acento')
    : torneo.partidos.length
      ? etiqueta('En curso', 'azul')
      : etiqueta('Sin empezar', 'aviso');

  const campeon = resumen.campeon
    ? torneo.equipos.find((e) => e.id === resumen.campeon)
    : null;

  return el('div', { class: 'torneo-tarjeta' }, [
    el('a', { href: `#/torneo/${torneo.id}`, style: 'color:inherit;display:block' }, [
      el('div', { class: 'fila-separada' }, [
        el('span', { class: 'deporte', text: dep?.icono || '🏅' }),
        estado,
      ]),
      el('h3', { text: torneo.nombre }),
      el('div', { class: 'suave', style: 'font-size:0.85rem' }, [
        `${dep?.nombre || 'Deporte'} · ${modalidad?.nombre || torneo.modalidad}`,
      ]),
      el('div', { class: 'tenue', style: 'font-size:0.8rem;margin-top:3px', text: resumenSistema(sis) }),
    ]),
    el('div', { style: 'margin-top:12px' }, [
      torneo.partidos.length
        ? barraAvance(resumen.jugados, resumen.total)
        : el('small', { class: 'tenue', text: 'El calendario todavía no está generado.' }),
    ]),
    campeon
      ? el('div', { style: 'margin-top:10px' }, [
          etiqueta(`🥇 ${nombreEquipo(torneo, campeon)}`, 'acento'),
        ])
      : null,
    el('div', { class: 'torneo-meta' }, [
      etiqueta(`${torneo.equipos.length} equipos`),
      etiqueta(`${torneo.tamanoEquipo} ${torneo.tamanoEquipo === 1 ? 'jugador' : 'por equipo'}`),
      etiqueta(fechaLegible(torneo.creado)),
    ]),
    el('div', { class: 'fila', style: 'margin-top:12px' }, [
      el('a', { class: 'boton boton-chico', href: `#/torneo/${torneo.id}`, text: 'Abrir' }),
      el('button', {
        class: 'boton boton-chico boton-fantasma',
        text: 'Duplicar',
        onclick: () => {
          const copia = duplicarTorneo(torneo.id);
          avisar(`Se creó "${copia.nombre}".`);
          ir(`/torneo/${copia.id}`);
        },
      }),
      el('button', {
        class: 'boton boton-chico boton-peligro',
        text: 'Borrar',
        onclick: () => confirmar({
          titulo: 'Borrar torneo',
          mensaje: `Se va a borrar "${torneo.nombre}" con todos sus partidos. Esto no se puede deshacer.`,
          textoAceptar: 'Borrar',
          peligro: true,
          alAceptar: () => {
            borrarTorneo(torneo.id);
            avisar('Torneo borrado.');
            redibujar();
          },
        }),
      }),
    ]),
  ]);
}
