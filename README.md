# Torneos

Gestor de torneos deportivos para cualquier deporte o juego, con la cantidad de
integrantes por equipo que uno quiera. Empezamos con pádel, pero nada en la
aplicación está amarrado a un deporte en particular.

Todo corre en el navegador y se guarda en el mismo computador (`localStorage`):
no hay servidor, ni cuentas, ni internet de por medio.

## Cómo se echa a andar

Doble clic en **`iniciar.bat`**. Se abre el navegador en <http://localhost:4173>.

O desde la consola:

```bash
node servidor.mjs
```

Hace falta el servidor porque la aplicación usa módulos de JavaScript, y el
navegador los bloquea si se abre `index.html` directo desde el disco.

## Qué se puede hacer

### 1. Deportes y formas de anotar

Cada deporte guarda sus propias formas de anotar. Vienen cargados pádel, tenis,
fútbol, básquetbol, vóleibol, tenis de mesa y ajedrez, y se pueden agregar más
(desde la pantalla *Deportes* o en el momento de crear el torneo).

Hay tres tipos de anotación y con ellos se arma cualquier variante:

| Tipo | Para qué sirve | Qué se configura |
|---|---|---|
| **Por sets y games** | Pádel, tenis, vóley, ping pong | Sets a ganar, games por set, diferencia mínima, tie-break, puntos del game, super tie-break |
| **Marcador corrido** | Fútbol, básquetbol, americanos | Nombre de la unidad, límite, si admite empate |
| **Al mejor de N rondas** | Juegos de mesa, ajedrez | Rondas para ganar |

#### Variantes de pádel que vienen cargadas

- Clásico · 3 sets a 6 games (con ventaja)
- Clásico · 3 sets a 6 games (punto de oro)
- 3 sets a 6 games con super tie-break decisivo
- Set único a 6 games
- 5 sets a 6 games
- 3 sets de **5 games · gana 3** (tie-break en 2-2), con y sin punto de oro
- 3 sets de **7 games · gana 4** (tie-break en 3-3), con y sin punto de oro
- Set único de 7 games · gana 4
- 3 sets cortos a 4 games (tie-break en 4-4)
- Pro set a 9 games (tie-break en 8-8)
- Pro set a 8 games (tie-break en 7-7)
- Tie-break único a 7
- Super tie-break único a 10
- Americano a 16, 24 o 32 puntos corridos

Si falta alguna, se crea en *Deportes → + Anotación*: el formulario muestra en
vivo, en castellano, cómo va a quedar contando el partido.

### 2. Equipos

Al crear el torneo se elige cuánta gente va por equipo (de 1 a 50; con 1 el
torneo es individual). Cada equipo tiene **nombre, nombrete, mascota, lema y
color**, y ninguno es obligatorio: lo único que se define es **con cuál de esos
campos se nombra a los equipos** en el calendario y las tablas. Si el campo
elegido queda vacío, se usa el siguiente que tenga algo.

Los integrantes salen del registro de *Personas*, y se puede agregar gente nueva
sin salir de la pantalla: se escribe el nombre y se presiona Enter.

### 3. Modalidades

- **Eliminación simple** — llave directa, con siembra o sorteo, descansos
  automáticos cuando los equipos no son potencia de 2 y partido opcional por el
  tercer lugar.
- **Todos contra todos** — a una o dos vueltas, con final opcional entre el 1º y
  el 2º de la tabla.
- **Fase de grupos + eliminatoria** — grupos repartidos en serpentina, los
  mejores de cada grupo pasan a la llave sin cruzarse entre primeros.
- **Sistema suizo** — rondas fijas, emparejando por puntaje sin repetir rivales;
  con cantidad impar, uno descansa cada ronda y suma como si hubiera ganado.
- **Americano (parejas rotativas)** — nadie tiene pareja fija: en cada ronda
  cambian los compañeros y gana el jugador que más partidos se lleva.

Los puntos de la tabla (ganar, empatar, perder) se configuran por torneo.

### 3b. Americano: todos rotan

En el paso de equipos se puede elegir **«Todos rotan (americano)»** en vez de
equipos fijos. Ahí se agregan jugadores sueltos (no parejas) y la aplicación
arma las rondas sola. La tabla es **individual**: cada uno suma lo que hace con
todos sus compañeros, y gana el que más partidos se lleva.

Hay dos formas de armar los cruces:

**Todas las combinaciones** (la que viene por omisión). Cada pareja enfrenta a
todas las parejas que se pueden formar con el resto. Con 5 jugadores, la pareja
A+B juega contra C+D, C+E y D+E; en total salen 15 partidos, cada jugador juega
12 y descansa 3. La cantidad crece rápido: son `3 × C(n,4)` partidos, o sea 3
con 4 jugadores, 15 con 5 y 45 con 6, así que la pantalla avisa cuántos son
antes de empezar.

**Cada uno con cada compañero.** La versión corta: alcanza con que todos jueguen
una vez junto a cada uno de los demás. Con 5 jugadores son 5 rondas.

En las dos, los descansos se reparten parejo, nadie juega dos veces en la misma
ronda y se puede cortar el torneo en menos rondas si no alcanza el tiempo.
También se puede jugar individual (1 por lado), que termina siendo un todos
contra todos.

### 4. Anotar resultados

Cada partido se puede anotar de dos maneras:

- **Escribir el marcador**: se escribe a mano, sin restricciones. Manda lo que
  escribas: si el marcador no cuadra con las reglas del sistema, la aplicación
  lo dice pero igual lo guarda y calcula el ganador contando los sets. Al lado
  de cada set hay un desplegable con los marcadores habituales de ese sistema,
  como atajo. Si hacen falta más sets de los que el sistema contempla, se
  agregan con «+ Otro set».
- **Punto por punto**: botones de «+ Punto» y el motor lleva el 15/30/40, la
  ventaja o el punto de oro, el cambio de saque, el tie-break y el super
  tie-break. Tiene deshacer.

También se puede registrar un **retiro o no presentación**.

Al guardar, los ganadores avanzan solos en la llave y las tablas se recalculan.

## Jugar en papel y cargarlo después

El botón **Imprimir** de cada torneo arma una hoja para llevar a la cancha, con
los cruces ya sorteados y casilleros para anotar a lápiz. Se elige qué incluir:
la tabla de nombres, los integrantes, las reglas de anotación, una tabla de
posiciones en blanco y si va una hoja por ronda.

Ahí mismo está **Descargar PDF**, que baja el archivo de una, sin pasar por el
cuadro de impresión. El PDF lo arma la propia aplicación (`js/pdf.js`): texto
seleccionable, unos 30 KB, numeración en cada hoja y el nombre del torneo como
nombre de archivo.

Para armar los equipos recién en la cancha, al crear el torneo se usa **«Sin
nombre (A, B, C…)»**: se eligen cuántos equipos (o jugadores) son y quedan como
letras. La hoja impresa trae entonces una tabla para escribir a mano quién es
cada letra, y los cruces salen como «Equipo A vs Equipo H».

Después, de vuelta en la aplicación, el botón **Asignar nombres** abre una lista
letra por letra para escribir los nombres y los integrantes. Los cruces y los
resultados ya anotados se mantienen: solo cambia cómo se llaman.

## Cuando la aplicación se actualiza

Los deportes y las formas de anotar se guardan en el navegador la primera vez
que se abre. Si una versión nueva trae deportes o anotaciones que antes no
estaban, se agregan solos al abrirla, sin tocar nada de lo que ya tenías. Lo que
borres a mano no vuelve a aparecer.

## Respaldo

En *Ajustes* se descarga un archivo con todo (deportes, personas y torneos) y se
puede restaurar en otro navegador o computador. Conviene hacerlo antes de
limpiar el navegador: los datos viven solo ahí.

## Cómo está armado

Sin dependencias ni compilación: HTML, CSS y módulos de JavaScript.

```
index.html              Cáscara de la aplicación
css/estilos.css         Estilos (tema oscuro, responsivo)
servidor.mjs            Servidor estático para desarrollo
iniciar.bat             Lanzador para Windows
js/
  app.js                Enrutador por hash
  modelo.js             Estado y guardado en localStorage
  catalogo.js           Deportes, sistemas de anotación y modalidades iniciales
  anotacion.js          Motor de anotación: reglas, validación y marcador en vivo
  fixture.js            Generación de calendario, avance de llave y tablas
  equipos.js            Cómo se nombra y se muestra un equipo
  pdf.js                Generador de PDF (texto, líneas y recuadros)
  hoja-pdf.js           La hoja del torneo dibujada en PDF
  ui.js                 Modales, avisos y piezas de interfaz
  util.js               Utilidades generales
  vistas/               Una pantalla por archivo
    imprimir.js         Hoja para anotar a mano
    asignar.js          Ponerle nombre a las letras
pruebas/                Pruebas del motor de anotación y del fixture
```

### Diseño

El estilo sigue las directrices de `.claude/skills/modern-web-design/SKILL.md`:
paleta zinc en modo oscuro sin negro puro, acento verde reservado para acciones
primarias y estados activos, escala de espaciado de 4px, radios de 8 a 16px,
transiciones de 150ms, foco visible en todo lo interactivo y contraste AA.

La skill sugiere Tailwind + Radix. Acá está aplicado sobre CSS propio con
variables, porque el proyecto no tiene compilación ni dependencias: sumar
Tailwind obligaría a un build o a cargarlo por CDN, que no es para producción.
Los principios son los mismos; si en algún momento se quiere migrar, las
variables de `:root` son el punto de partida.

### Pruebas

```bash
npm run prueba
```

Cubren las variantes de pádel (marcadores válidos por sistema, ventaja contra
punto de oro, tie-break en 6-6, 2-2 y 3-3, super tie-break), la generación de
las modalidades, el cálculo de las tablas y el PDF (que el archivo esté bien
armado y que la hoja traiga todo lo que debe traer).

## Lo que todavía no está

- Doble eliminación (llave de perdedores).
- Horarios y canchas por partido.
