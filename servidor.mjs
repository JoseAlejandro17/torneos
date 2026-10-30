// Servidor estático mínimo para abrir la aplicación en el navegador.
// Uso: node servidor.mjs [puerto]
//
// Hace falta un servidor (y no abrir index.html directo) porque la aplicación
// usa módulos de JavaScript, y el navegador los bloquea sobre file://.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const RAIZ = resolve(import.meta.dirname);
const PUERTO = Number(process.argv[2]) || 4173;

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const servidor = createServer(async (peticion, respuesta) => {
  try {
    const ruta = decodeURIComponent(new URL(peticion.url, 'http://localhost').pathname);
    const relativa = normalize(ruta === '/' ? 'index.html' : ruta.slice(1));

    // Nunca servimos nada fuera de la carpeta del proyecto.
    const archivo = join(RAIZ, relativa);
    if (!archivo.startsWith(RAIZ)) {
      respuesta.writeHead(403).end('Prohibido');
      return;
    }

    const contenido = await readFile(archivo);
    respuesta.writeHead(200, {
      'Content-Type': TIPOS[extname(archivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    respuesta.end(contenido);
  } catch (error) {
    if (error.code === 'ENOENT') respuesta.writeHead(404).end('No encontrado');
    else {
      console.error(error);
      respuesta.writeHead(500).end('Error del servidor');
    }
  }
});

servidor.listen(PUERTO, () => {
  console.log(`\n  Torneos andando en:  http://localhost:${PUERTO}\n`);
  console.log('  Para detenerlo: Ctrl + C\n');
});
