# FlexiWash – prototipo funcional (demo en dos dispositivos)

## Dos formas de correr la demo (cliente y prestador en celulares distintos)

### A) Con Supabase en la nube (recomendada para exponer: funciona con cualquier red)
1. Crea un proyecto gratis en supabase.com. En **SQL Editor** pega y ejecuta `supabase/setup.sql`.
2. En **Project Settings → API** copia la *Project URL* y la llave *anon/publishable*. Copia `.env.example` como `.env` y pega ambas.
3. `npm ci && npm run build`. Sube la carpeta `dist/` a un hosting estático (Netlify Drop, Vercel, GitHub Pages…): te da una URL HTTPS.
4. Abre esa URL en los dos celulares (datos móviles o Wi-Fi distintos): uno como cliente y otro con **"Soy prestador de servicios"**.
- Los datos viven en la tabla `fw_docs` y las fotos en el bucket `fw-photos`. La app consulta cada ~2 s, así que los cambios aparecen casi al instante.
- Sin el archivo `.env`, la app no usa la nube y recurre a la opción B.

### B) Servidor local (sin internet; ambos celulares en la misma Wi-Fi o hotspot)
```bash
npm ci
npm run demo
```
La terminal mostrará algo como `http://192.168.x.x:3001`. Abre esa dirección en los dos celulares.
Los cambios se sincronizan en tiempo real mediante `server.js` (solo Node 18+, sin dependencias extra).

- `npm run reset` (o el botón "Reiniciar datos de la demo" en Perfil del cliente) borra solicitudes, mensajes y fotos (en ambas opciones; los prestadores registrados se conservan).
- En la opción B los datos quedan en la carpeta `data/` y sobreviven a reiniciar el servidor.
- Desarrollo: `npm start` en una terminal y `npm run dev` en otra (Vite redirige /api al servidor).
- Sin servidor ni Supabase (hosting estático sin `.env`) la app cae a `localStorage`: solo sincroniza pestañas del mismo navegador.

## Flujo para exponer
1. Cliente: celular → Autos → agregar servicio → fecha y hora → prestador → pago en efectivo.
2. Prestador: "Iniciar sesión" (cuenta demo **667 555 0142 / PIN 1234**) → Aceptar → En camino → En proceso.
3. Prestador: en el servicio activo, **Agregar foto** (hasta 4, cámara o galería). El cliente las ve en "Estado del servicio".
4. Prestador: Finalizado → Cerrar servicio. Cliente: Calificar servicio.

## Prestadores (registro verificado)
- En el login del prestador, **"Registrarme como prestador"**: datos + CURP (validada por formato) + PIN, y un código por SMS **simulado** (se muestra en pantalla).
- Al verificar, el prestador aparece de inmediato en la lista del cliente (con etiqueta "Nuevo" hasta tener calificaciones) y puede iniciar sesión con teléfono + PIN desde cualquier celular.
- Los prestadores registrados **no se borran** con `npm run reset`. Para quitarlos, borra la carpeta `data/`.
- Ensayo recomendado: registra 1 prestador extra antes de la exposición; así se demuestra que el cliente elige entre dos.

## Versiones fijas
`package.json` y `package-lock.json` fijan versiones exactas (sin `^` ni `latest`; `.npmrc` con `save-exact=true`). Usa `npm ci` para instalar exactamente lo del lockfile. Haz `npm ci && npm run build` con internet **antes** del día de la exposición.

## Incluido
- Inicio de sesión demo, catálogo (Autos, Hogar, Muebles, Extras), carrito, cálculo de totales.
- **Precio de Autos según el vehículo**: Sedán (base), SUV +25%, Pickup +35%, Motocicleta −40%, redondeado a $5 (ej. Express: $120 / $150 / $160 / $70). Se ajusta en `AUTO_TYPE_FACTOR` de `src/App.jsx`.
- **Precio de Muebles según tamaño y material**: al agregar un mueble se elige tamaño (ej. sofá 1 plaza … seccional; colchón individual … king; alfombra chica … extra grande) y material (tela, piel, microfibra, memory foam, lana…). Precio = base × factor de tamaño × factor de material, redondeado a $5 (ej. sofá 3 plazas en tela $250, en piel $325). Se ajusta en `MUEBLES_CATEGORIES` de `src/App.jsx`. El tamaño y material aparecen en la solicitud que ve el prestador.
- **Precio de Hogar según las áreas elegidas**: se marcan las áreas a limpiar (sala, comedor, cocina, baño, recámara, patio, cochera, escaleras, lavandería; con cantidad, ej. 2 baños). Precio = suma de áreas × factor del servicio (básica ×1, profunda ×1.6, mudanza ×2, área específica ×1.5), con un mínimo por servicio. Se ajusta en `HOGAR_AREAS` y `HOGAR_CATEGORIES`.
- Pagos demo: efectivo, tarjeta, PayPal y Monedero FlexiWash (3% de recompensa).
- Agenda/disponibilidad del prestador, solicitudes, retiros, calificaciones.
- Chat y llamadas simuladas. Seguimiento con **mapa real** (Leaflet + OpenStreetMap) y ubicación del dispositivo (`navigator.geolocation`).
- **Inicio**: mientras haya un servicio en curso aparece la tarjeta "Tu servicio" (mini mapa, *Ver seguimiento* y, al finalizar, *Calificar servicio*); también se muestra en Actividad.
- **Notificaciones** (campana): cada aviso es tocable y lleva a su destino (seguimiento, calificación, mensaje, monedero o actividad).
- **Fotos del servicio** subidas por el prestador y visibles para el cliente (se reducen a 1280 px).

## Mapa y ubicación
- El cliente ve su posición real; el prestador comparte la suya (cada ~5 s o al moverse >10 m) solo mientras el servicio está *En camino* o *En proceso*, y el cliente ve su marcador y una llegada estimada calculada con la distancia real (30 km/h de referencia).
- `navigator.geolocation` solo funciona en **HTTPS o localhost**. Con la opción A (hosting HTTPS) funciona en los celulares; en la opción B (`http://192.168.x.x`) el navegador del celular la bloquea: el mapa se centra en Culiacán y se muestra un aviso.
- Los mosaicos vienen de `tile.openstreetmap.org` (uso ligero de demo). Para producción conviene un proveedor de mapas propio o con plan.

## Pendiente para producción
Autenticación real con Supabase Auth (hoy el PIN se guarda en claro y las políticas de la base son abiertas), políticas por usuario, pasarela de pago real, SMS,
panel de administrador.
