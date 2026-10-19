// Reduce una foto (p. ej. de 4000×3000 px y 5 MB tomada con el celular) a un JPEG de ~1280 px y
// ~150–300 KB, respetando la orientación EXIF. Devuelve un data URL listo para subir.
const MAX_SIDE = 1280;
const QUALITY = 0.8;

const loadBitmap = async (file) => {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch { /* cae al método clásico */ }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = url;
    });
  } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
};

export async function compressImage(file) {
  if (!file || !/^image\//.test(file.type)) throw new Error("Selecciona un archivo de imagen.");
  const src = await loadBitmap(file);
  const w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w0 * scale));
  canvas.height = Math.max(1, Math.round(h0 * scale));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); // PNG con transparencia -> fondo blanco
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  src.close?.();
  return canvas.toDataURL("image/jpeg", QUALITY);
}
