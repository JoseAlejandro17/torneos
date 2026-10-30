// Generador de PDF mínimo, sin librerías.
//
// Arma un PDF 1.4 con texto, líneas y rectángulos usando las fuentes estándar
// Helvetica y Helvetica-Bold, que todo lector trae incorporadas. El texto queda
// seleccionable y el archivo pesa unos pocos kilobytes.
//
// Las coordenadas que recibe esta clase son de arriba hacia abajo (como en una
// hoja), y adentro se convierten a las del PDF, que van de abajo hacia arriba.

/** Tamaños de hoja en puntos (1 punto = 1/72 pulgada). */
export const A4 = { ancho: 595.28, alto: 841.89 };

/** Anchos de los caracteres de Helvetica, en milésimas de em. */
const ANCHOS = {
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  0: 556, 1: 556, 2: 556, 3: 556, 4: 556, 5: 556, 6: 556, 7: 556, 8: 556, 9: 556,
  ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500,
  K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611,
  U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222,
  k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278,
  u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '{': 334, '|': 260, '}': 334, '~': 584,
};
const ANCHO_POR_OMISION = 556;

/** Caracteres que en WinAnsi no están donde los pone Unicode. */
const WINANSI = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85,
  '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8A,
  '‹': 0x8B, 'Œ': 0x8C, 'Ž': 0x8E, '‘': 0x91, '’': 0x92,
  '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97,
  '˜': 0x98, '™': 0x99, 'š': 0x9A, '›': 0x9B, 'œ': 0x9C,
  'ž': 0x9E, 'Ÿ': 0x9F,
};

/**
 * Pasa un texto a los bytes que entiende el PDF. Lo que no existe en esa
 * codificación (emojis, por ejemplo) simplemente se saca.
 */
function aWinAnsi(texto) {
  let salida = '';
  for (const caracter of String(texto ?? '')) {
    const especial = WINANSI[caracter];
    if (especial !== undefined) {
      salida += String.fromCharCode(especial);
      continue;
    }
    const codigo = caracter.codePointAt(0);
    if (codigo <= 0xff) salida += String.fromCharCode(codigo);
    // Lo que no entra se omite.
  }
  return salida;
}

/** Escapa los paréntesis y las barras, que en PDF delimitan las cadenas. */
const escapar = (texto) => aWinAnsi(texto).replace(/([\\()])/g, '\\$1');

/** Ancho de un texto en puntos. */
export function anchoDeTexto(texto, tamano, negrita = false) {
  let total = 0;
  for (const caracter of aWinAnsi(texto)) {
    total += ANCHOS[caracter] ?? ANCHO_POR_OMISION;
  }
  // La negrita de Helvetica es un poco más ancha.
  return (total / 1000) * tamano * (negrita ? 1.06 : 1);
}

/** Corta un texto para que no pase de un ancho, agregando puntos suspensivos. */
export function recortar(texto, anchoMaximo, tamano, negrita = false) {
  const limpio = String(texto ?? '');
  if (anchoDeTexto(limpio, tamano, negrita) <= anchoMaximo) return limpio;
  let corte = limpio;
  while (corte.length > 1 && anchoDeTexto(`${corte}...`, tamano, negrita) > anchoMaximo) {
    corte = corte.slice(0, -1);
  }
  return `${corte}...`;
}

/** Parte un texto en líneas que quepan en un ancho. */
export function repartirEnLineas(texto, anchoMaximo, tamano, negrita = false) {
  const palabras = String(texto ?? '').split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const palabra of palabras) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (anchoDeTexto(prueba, tamano, negrita) > anchoMaximo && actual) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Un documento PDF en construcción. */
export class Documento {
  constructor({ ancho = A4.ancho, alto = A4.alto, titulo = '' } = {}) {
    this.ancho = ancho;
    this.alto = alto;
    this.titulo = titulo;
    this.paginas = [];
    this.nuevaPagina();
  }

  /** Abre una página nueva y pasa a escribir en ella. */
  nuevaPagina() {
    this.actual = [];
    this.paginas.push(this.actual);
    return this;
  }

  /** Cuántas páginas lleva el documento. */
  get cantidadDePaginas() {
    return this.paginas.length;
  }

  /** Vuelve a una página ya escrita, para agregarle algo (el pie, por ejemplo). */
  irAPagina(indice) {
    if (this.paginas[indice]) this.actual = this.paginas[indice];
    return this;
  }

  /** Convierte una coordenada de arriba-abajo a la del PDF. */
  #y(y) {
    return this.alto - y;
  }

  #color(valor) {
    // Acepta un gris (0 a 1) o [r, g, b].
    if (Array.isArray(valor)) return valor.map((v) => v.toFixed(3)).join(' ');
    return [valor, valor, valor].map((v) => v.toFixed(3)).join(' ');
  }

  /** Escribe texto. `alinear` puede ser 'izquierda', 'centro' o 'derecha'. */
  texto(x, y, contenido, { tamano = 10, negrita = false, color = 0, alinear = 'izquierda' } = {}) {
    const limpio = String(contenido ?? '');
    if (!limpio.trim()) return this;
    let inicio = x;
    if (alinear !== 'izquierda') {
      const ancho = anchoDeTexto(limpio, tamano, negrita);
      inicio = alinear === 'centro' ? x - ancho / 2 : x - ancho;
    }
    this.actual.push(
      `BT ${this.#color(color)} rg /${negrita ? 'F2' : 'F1'} ${tamano} Tf`
      + ` ${inicio.toFixed(2)} ${this.#y(y).toFixed(2)} Td (${escapar(limpio)}) Tj ET`
    );
    return this;
  }

  /** Dibuja una línea. */
  linea(x1, y1, x2, y2, { grosor = 0.6, color = 0.4, punteada = false } = {}) {
    const guion = punteada ? '[1.6 1.6] 0 d' : '[] 0 d';
    this.actual.push(
      `q ${guion} ${grosor} w ${this.#color(color)} RG`
      + ` ${x1.toFixed(2)} ${this.#y(y1).toFixed(2)} m ${x2.toFixed(2)} ${this.#y(y2).toFixed(2)} l S Q`
    );
    return this;
  }

  /** Dibuja un rectángulo, con relleno, con borde o con los dos. */
  rectangulo(x, y, ancho, alto, { relleno = null, borde = null, grosor = 0.6 } = {}) {
    const partes = ['q'];
    if (relleno !== null) partes.push(`${this.#color(relleno)} rg`);
    if (borde !== null) partes.push(`${this.#color(borde)} RG ${grosor} w`);
    partes.push(`${x.toFixed(2)} ${this.#y(y + alto).toFixed(2)} ${ancho.toFixed(2)} ${alto.toFixed(2)} re`);
    if (relleno !== null && borde !== null) partes.push('B');
    else if (relleno !== null) partes.push('f');
    else partes.push('S');
    partes.push('Q');
    this.actual.push(partes.join(' '));
    return this;
  }

  /** Arma el archivo y lo devuelve como Blob, listo para descargar. */
  aBlob() {
    const objetos = [];
    const agregar = (contenido) => {
      objetos.push(contenido);
      return objetos.length; // el número de objeto es 1-based
    };

    // 1 catálogo, 2 páginas, 3 y 4 las fuentes; después, dos por página.
    agregar(null); // catálogo, se completa más abajo
    agregar(null); // lista de páginas
    agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');

    const idsDePagina = [];
    for (const instrucciones of this.paginas) {
      const cuerpo = instrucciones.join('\n');
      const idContenido = agregar(`<< /Length ${cuerpo.length} >>\nstream\n${cuerpo}\nendstream`);
      const idPagina = agregar(
        '<< /Type /Page /Parent 2 0 R'
        + ` /MediaBox [0 0 ${this.ancho.toFixed(2)} ${this.alto.toFixed(2)}]`
        + ' /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>'
        + ` /Contents ${idContenido} 0 R >>`
      );
      idsDePagina.push(idPagina);
    }

    objetos[0] = '<< /Type /Catalog /Pages 2 0 R >>';
    objetos[1] = `<< /Type /Pages /Kids [${idsDePagina.map((id) => `${id} 0 R`).join(' ')}]`
      + ` /Count ${idsDePagina.length} >>`;

    let archivo = '%PDF-1.4\n';
    const posiciones = [];
    objetos.forEach((contenido, indice) => {
      posiciones.push(archivo.length);
      archivo += `${indice + 1} 0 obj\n${contenido}\nendobj\n`;
    });

    const inicioTabla = archivo.length;
    archivo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
    for (const posicion of posiciones) {
      archivo += `${String(posicion).padStart(10, '0')} 00000 n \n`;
    }
    archivo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`
      + `startxref\n${inicioTabla}\n%%EOF`;

    // Un byte por carácter: por eso todo el texto va en WinAnsi.
    const bytes = new Uint8Array(archivo.length);
    for (let i = 0; i < archivo.length; i++) bytes[i] = archivo.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}

/** Descarga un Blob con el nombre indicado. */
export function descargar(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
