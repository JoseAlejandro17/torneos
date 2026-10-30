// Registro de personas: quienes pueden jugar en los torneos.

import { el, pintar, normalizar, iniciales } from '../util.js';
import { personas, crearPersona, editarPersona, borrarPersona, torneosDePersona } from '../modelo.js';
import { abrirModal, confirmar, avisar, campo, vacio, etiqueta } from '../ui.js';
import { redibujar } from '../app.js';

export function vistaPersonas() {
  const todas = personas().slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const zonaLista = el('div', {});

  const buscador = el('input', { type: 'search', placeholder: 'Buscar por nombre o apodo...' });
  buscador.addEventListener('input', () => dibujarLista(buscador.value));

  function dibujarLista(filtro = '') {
    const texto = normalizar(filtro);
    const visibles = texto
      ? todas.filter((p) => normalizar(p.nombre).includes(texto) || normalizar(p.apodo).includes(texto))
      : todas;

    if (!visibles.length) {
      pintar(zonaLista, vacio({
        icono: todas.length ? '🔍' : '👥',
        titulo: todas.length ? 'Nadie coincide con la búsqueda' : 'Todavía no hay personas',
        mensaje: todas.length
          ? 'Prueba con otro nombre.'
          : 'Puedes agregarlas aquí, o directamente al armar los equipos de un torneo.',
      }));
      return;
    }
    pintar(zonaLista, el('div', { class: 'rejilla' }, visibles.map(tarjetaPersona)));
  }

  dibujarLista();

  return [
    el('div', { class: 'encabezado-pagina' }, [
      el('div', {}, [
        el('h1', { text: 'Personas' }),
        el('p', { text: 'El registro de jugadores. Al armar los equipos puedes elegir de aquí o agregar gente nueva en el momento.' }),
      ]),
      el('button', {
        class: 'boton boton-primario',
        text: '+ Agregar persona',
        onclick: () => formularioPersona(null),
      }),
    ]),
    todas.length > 6 ? el('div', { class: 'campo' }, [buscador]) : null,
    zonaLista,
  ];
}

function tarjetaPersona(per) {
  const cuantos = torneosDePersona(per.id).length;
  return el('div', { class: 'tarjeta', style: 'padding:14px' }, [
    el('div', { class: 'fila' }, [
      el('span', {
        class: 'escudo',
        style: 'background:var(--fondo-4);color:var(--texto)',
        text: iniciales(per.nombre),
      }),
      el('div', { class: 'crece', style: 'min-width:0' }, [
        el('div', { style: 'font-weight:650', text: per.nombre }),
        per.apodo ? el('small', { class: 'tenue', text: `"${per.apodo}"` }) : null,
      ]),
    ]),
    per.notas ? el('p', { class: 'suave', style: 'margin:10px 0 0;font-size:0.85rem', text: per.notas }) : null,
    el('div', { class: 'fila', style: 'margin-top:10px' }, [
      etiqueta(cuantos ? `${cuantos} ${cuantos === 1 ? 'torneo' : 'torneos'}` : 'sin torneos'),
      el('span', { class: 'crece' }),
      el('button', {
        class: 'boton boton-chico boton-fantasma',
        text: 'Editar',
        onclick: () => formularioPersona(per),
      }),
      el('button', {
        class: 'boton boton-chico boton-peligro',
        text: '×',
        title: 'Borrar',
        'aria-label': 'Borrar',
        onclick: () => confirmar({
          titulo: `Borrar a ${per.nombre}`,
          mensaje: cuantos
            ? `Está en ${cuantos} torneo(s). Si la borras, se la quita de esos equipos pero los partidos quedan igual.`
            : 'Se va a quitar del registro.',
          textoAceptar: 'Borrar',
          peligro: true,
          alAceptar: () => {
            borrarPersona(per.id);
            avisar('Persona borrada.');
            redibujar();
          },
        }),
      }),
    ]),
  ]);
}

function formularioPersona(per) {
  const esNuevo = !per;
  const nombre = el('input', { type: 'text', valor: per?.nombre || '', placeholder: 'Nombre y apellido' });
  const apodo = el('input', { type: 'text', valor: per?.apodo || '', placeholder: 'Opcional' });
  const notas = el('textarea', { placeholder: 'Opcional: mano, nivel, teléfono, lo que sirva.' });
  notas.value = per?.notas || '';

  abrirModal({
    titulo: esNuevo ? 'Agregar persona' : `Editar a ${per.nombre}`,
    contenido: () => el('div', {}, [
      campo({ etiqueta: 'Nombre', control: nombre }),
      campo({ etiqueta: 'Apodo', control: apodo }),
      campo({ etiqueta: 'Notas', control: notas }),
    ]),
    acciones: ({ cerrar }) => [
      el('button', { class: 'boton boton-fantasma', text: 'Cancelar', onclick: cerrar }),
      el('button', {
        class: 'boton boton-primario',
        text: esNuevo ? 'Agregar' : 'Guardar',
        onclick: () => {
          if (!nombre.value.trim()) return avisar('Falta el nombre.', 'error');
          const datos = { nombre: nombre.value.trim(), apodo: apodo.value.trim(), notas: notas.value.trim() };
          if (esNuevo) crearPersona(datos);
          else editarPersona(per.id, datos);
          cerrar();
          avisar(esNuevo ? 'Persona agregada.' : 'Cambios guardados.');
          redibujar();
        },
      }),
    ],
  });
}
