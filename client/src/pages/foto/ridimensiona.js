// Prepara una foto per la galleria direttamente sul telefono dell'invitato:
// una versione grande per guardarla a schermo intero e una miniatura per la
// griglia, entrambe JPEG. Il server non ha librerie di immagini (l'immagine
// Docker è minimale) e così il Wi-Fi della sala porta meno dati. Ridisegnando
// su canvas si perdono anche i dati EXIF, posizione GPS compresa: le versioni
// che vede il pubblico non rivelano dove è stata scattata la foto.

const LATO_GRANDE = 2048;
const LATO_MINI = 480;

// createImageBitmap applica da sé l'orientamento EXIF: una foto scattata in
// verticale non esce di fianco. Dove manca (browser vecchi) si ripiega su <img>.
async function decodifica(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { sorgente: bitmap, w: bitmap.width, h: bitmap.height, chiudi: () => bitmap.close?.() };
    } catch { /* formato non supportato così: si prova con <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return { sorgente: img, w: img.naturalWidth, h: img.naturalHeight, chiudi: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function disegna(sorgente, w, h, lato) {
  const k = Math.min(1, lato / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * k));
  canvas.height = Math.max(1, Math.round(h * k));
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sorgente, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const inBlob = (canvas, qualita) => new Promise((ok, ko) => {
  canvas.toBlob(b => (b ? ok(b) : ko(new Error('Conversione non riuscita'))), 'image/jpeg', qualita);
});

// → { grande, mini, larghezza, altezza } (le dimensioni sono quelle della versione grande)
export async function preparaFoto(file) {
  const foto = await decodifica(file);
  try {
    if (!foto.w || !foto.h) throw new Error('Foto non leggibile');
    const grande = disegna(foto.sorgente, foto.w, foto.h, LATO_GRANDE);
    const mini = disegna(grande, grande.width, grande.height, LATO_MINI);
    return {
      grande: await inBlob(grande, 0.84),
      mini: await inBlob(mini, 0.78),
      larghezza: grande.width,
      altezza: grande.height,
    };
  } finally {
    foto.chiudi();
  }
}
