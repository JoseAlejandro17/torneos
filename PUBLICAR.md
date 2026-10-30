# Publicar Torneos en internet

Guía para que la aplicación quede en una dirección pública y puedas entrar desde el
celular, en la cancha, sin depender de tu computador.

**Tiempo estimado:** 10 minutos la primera vez.

Es más corta que la de la tienda porque acá no hay base de datos ni claves: son archivos
sueltos que Vercel sirve tal cual.

---

## Antes de empezar

Ya tienes las dos cuentas que hacen falta, las mismas de `tienda-al-tiro`:

| Para qué | Dónde |
|---|---|
| Guardar el código | [github.com](https://github.com) · usuario `JoseAlejandro17` |
| Publicar la web | [vercel.com](https://vercel.com) · entras con GitHub |

El repositorio local ya está hecho, con el primer commit listo. Solo falta conectarlo.

> **Este sí puede ser público.** La tienda tenía que ser privada porque manejaba datos de
> vecinos y claves en `.env`. Acá no hay nada de eso: los torneos se guardan en el navegador
> de cada persona, no en un servidor. Si prefieres que igual sea privado, no cambia nada del
> resto de la guía.

---

## Pasos 1 y 2 — GitHub ✅ hecho

El repositorio está creado y el código subido:

**https://github.com/JoseAlejandro17/torneos**

De aquí en adelante, cada `git push` sube los cambios nuevos.

## Paso 3 — Publicar en Vercel

1. Entra a [vercel.com/new](https://vercel.com/new).
2. Elige el repositorio `torneos`.
3. **No toques nada más.** Vercel va a mostrar:
   - Framework Preset: **Other**
   - Build Command: vacío
   - Output Directory: vacío

   Así está bien: no hay nada que compilar, son archivos listos para servir.
4. Apreta **Deploy** y espera menos de un minuto.

Vercel te va a dar una dirección tipo `https://torneos.vercel.app`. Si ese nombre está
tomado, te propone otro (`torneos-joses-projects.vercel.app` o parecido); también lo puedes
cambiar después en **Settings → Domains**.

Listo: esa dirección se abre desde cualquier celular.

---

## Sobre el despliegue temporal

Mientras tanto hay una versión andando en una dirección provisoria de Vercel, hecha sin
cuenta. **Dura 60 minutos** y después se apaga sola. Sirvió para comprobar que todo funciona
publicado, pero no reemplaza el paso 3: conectar el repositorio deja la dirección para
siempre y, además, la actualiza sola con cada `git push`.

---

## Cómo funciona de ahí en adelante

Cada vez que hagas `git push`, Vercel publica la versión nueva sola, en unos segundos.

```bash
git add -A
git commit -m "Lo que cambiaste"
git push
```

---

## Cosas que conviene saber

**Los torneos no se comparten entre dispositivos.** Todo se guarda en el navegador de cada
persona (`localStorage`). Si armas un torneo en el computador, no aparece en tu celular. Para
pasarlo: *Ajustes → Descargar respaldo* en uno y *Restaurar* en el otro.

Si en algún momento quieres que varios vean el mismo torneo en vivo, ahí sí hace falta una
base de datos y cambia bastante el proyecto. Se puede hacer, pero es otro trabajo.

**Se puede usar sin internet.** Una vez abierta, la aplicación anda sin señal —útil en
canchas con mala cobertura—. Lo único que necesita internet es la tipografía; sin ella se ve
con la letra del sistema, nada más.

**El plan gratis alcanza de sobra.** Vercel regala 100 GB al mes y esta aplicación pesa menos
de 100 KB. La licencia del plan gratis pide que sea un proyecto personal: un torneo con los
amigos lo es.

**Si quieres dominio propio**, un `.cl` sale unos $10.000 al año en [NIC Chile](https://nic.cl)
y se conecta en Vercel desde **Settings → Domains**.

---

## Si algo sale mal

| Qué ves | Qué pasó |
|---|---|
| Página en blanco | Mira la consola del navegador (F12). Casi siempre es que falta un archivo en el push: revisa con `git status` que no haya quedado nada sin subir. |
| "404: NOT_FOUND" | Vercel no encontró `index.html` en la raíz. En Settings → General, el Output Directory tiene que estar vacío. |
| Los cambios no se ven | Recarga con Ctrl+Shift+R. El `vercel.json` ya pide que no se guarde en caché, pero el navegador a veces insiste. |
| Vercel intenta compilar y falla | En Settings → General, Framework Preset tiene que decir **Other** y el Build Command estar vacío. |
