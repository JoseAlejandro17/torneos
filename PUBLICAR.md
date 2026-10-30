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

## Paso 3 — Vercel ✅ hecho

La aplicación está publicada y abierta a cualquiera:

**https://torneos-ppalejandro17-6877s-projects.vercel.app**

Quedó conectada al repositorio, así que cada `git push` la actualiza sola en menos de un
minuto. No hay variables de entorno ni nada que configurar.

> Para que se viera desde afuera hubo que apagar **Settings → Deployment Protection →
> Vercel Authentication**, que Vercel deja encendida por omisión: sin eso, el sitio le pedía
> iniciar sesión a cualquiera que entrara.

Si quieres una dirección más corta y fácil de dictar, en **Settings → Domains** puedes
agregar `torneos.vercel.app` (estaba libre). Queda funcionando en las dos.

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
