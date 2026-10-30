// Ajustes: respaldo de los datos y reinicio.

import { el } from '../util.js';
import { exportar, importar, reiniciar, deportes, personas, torneos } from '../modelo.js';
import { abrirModal, confirmar, avisar, campo } from '../ui.js';
import { redibujar } from '../app.js';

export function vistaAjustes() {
  return [
    el('div', { class: 'encabezado-pagina' }, [
      el('div', {}, [
        el('h1', { text: 'Ajustes' }),
        el('p', { text: 'Todo se guarda en este navegador. Si cambias de computador o limpias el navegador, usa el respaldo.' }),
      ]),
    ]),

    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Lo que hay guardado' }),
      el('div', { class: 'rejilla', style: 'margin-top:12px' }, [
        recuadro('Deportes', deportes().length),
        recuadro('Personas', personas().length),
        recuadro('Torneos', torneos().length),
        recuadro('Partidos', torneos().reduce((suma, t) => suma + t.partidos.length, 0)),
      ]),
    ]),

    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Respaldo' }),
      el('p', { class: 'suave', text: 'Descarga un archivo con todo (deportes, personas y torneos) para guardarlo o llevarlo a otro navegador.' }),
      el('div', { class: 'fila' }, [
        el('button', { class: 'boton boton-primario', text: '⬇ Descargar respaldo', onclick: descargar }),
        el('button', { class: 'boton', text: '⬆ Restaurar desde archivo', onclick: subir }),
        el('button', { class: 'boton boton-fantasma', text: 'Ver / copiar el texto', onclick: verTexto }),
      ]),
    ]),

    el('div', { class: 'tarjeta' }, [
      el('h2', { text: 'Empezar de nuevo' }),
      el('p', { class: 'suave', text: 'Borra todos los torneos y personas, y devuelve el catálogo de deportes a como viene de fábrica.' }),
      el('button', {
        class: 'boton boton-peligro',
        text: 'Borrar todo y reiniciar',
        onclick: () => confirmar({
          titulo: 'Borrar todo',
          mensaje: 'Se van a borrar todos los torneos, personas y deportes agregados. Esto no se puede deshacer: conviene descargar el respaldo antes.',
          textoAceptar: 'Borrar todo',
          peligro: true,
          alAceptar: () => {
            reiniciar();
            avisar('Todo borrado. Volvimos al catálogo inicial.');
            redibujar();
          },
        }),
      }),
    ]),
  ];
}

function recuadro(titulo, valor) {
  return el('div', { style: 'background:var(--fondo-3);border-radius:var(--radio-chico);padding:14px;text-align:center' }, [
    el('div', { style: 'font-size:1.7rem;font-weight:700;color:var(--acento)', text: String(valor) }),
    el('small', { class: 'tenue', text: titulo }),
  ]);
}

function descargar() {
  const blob = new Blob([exportar()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const fecha = new Date().toISOString().slice(0, 10);
  const enlace = el('a', { href: url, download: `torneos-respaldo-${fecha}.json` });
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
  avisar('Respaldo descargado.');
}

function subir() {
  const entrada = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  entrada.addEventListener('change', async () => {
    const archivo = entrada.files?.[0];
    if (!archivo) return;
    const texto = await archivo.text();
    confirmar({
      titulo: 'Restaurar respaldo',
      mensaje: `Se va a reemplazar todo lo que hay ahora por el contenido de "${archivo.name}".`,
      textoAceptar: 'Restaurar',
      peligro: true,
      alAceptar: () => {
        const salida = importar(texto);
        if (!salida.ok) return avisar(salida.motivo, 'error');
        avisar('Respaldo restaurado.');
        redibujar();
      },
    });
  });
  document.body.append(entrada);
  entrada.click();
  entrada.remove();
}

function verTexto() {
  const area = el('textarea', { style: 'min-height:260px;font-family:monospace;font-size:0.8rem' });
  area.value = exportar();
  abrirModal({
    titulo: 'Respaldo en texto',
    ancho: true,
    contenido: () => el('div', {}, [
      el('p', { class: 'suave', text: 'Puedes copiar este texto y pegarlo donde quieras, o pegar aquí otro respaldo y restaurarlo.' }),
      campo({ control: area }),
    ]),
    acciones: ({ cerrar }) => [
      el('button', {
        class: 'boton boton-fantasma',
        text: 'Copiar',
        onclick: async () => {
          await navigator.clipboard.writeText(area.value);
          avisar('Copiado al portapapeles.');
        },
      }),
      el('button', {
        class: 'boton boton-primario',
        text: 'Restaurar lo que está escrito',
        onclick: () => {
          const salida = importar(area.value);
          if (!salida.ok) return avisar(salida.motivo, 'error');
          cerrar();
          avisar('Respaldo restaurado.');
          redibujar();
        },
      }),
    ],
  });
}
