// Percorsi e controlli della galleria foto degli invitati.
//
// Le foto vivono su una cartella esterna (la NAS, montata sulla VM e passata al
// container con un bind mount) o, senza GALLERIA_NAS, in uploads/galleria. Se il
// mount salta, la cartella sul container resta vuota e le foto finirebbero sul
// disco della VM senza che nessuno se ne accorga: per questo, con la NAS, l'app
// scrive solo se nella cartella c'è il file segnaposto creato a mano una volta.
const fs = require('fs');
const path = require('path');

const NAS = process.env.GALLERIA_NAS === '1';
const DIR = path.resolve(process.env.GALLERIA_PATH || path.join(__dirname, 'uploads/galleria'));
const MARCATORE = '.galleria-nas';
const SOTTOCARTELLE = ['originali', 'grandi', 'mini', '.incoming'];

// Cartella pronta a ricevere foto. Con la NAS serve il segnaposto; in locale la
// cartella si crea da sola.
function pronta() {
  try {
    if (NAS) return fs.existsSync(path.join(DIR, MARCATORE));
    fs.mkdirSync(DIR, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

function preparaCartelle() {
  for (const s of SOTTOCARTELLE) fs.mkdirSync(path.join(DIR, s), { recursive: true });
}

const percorso = (sotto, codice, estensione) => path.join(DIR, sotto, `${codice}.${estensione}`);

// Tipo vero del file dai primi byte, non dall'estensione né dal Content-Type,
// che il client sceglie come vuole. null = non è un'immagine che accettiamo.
function tipoImmagine(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(16);
    const n = fs.readSync(fd, b, 0, 16, 0);
    if (n < 12) return null;
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
    if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'webp';
    if (b.toString('ascii', 4, 8) === 'ftyp') {
      const marca = b.toString('ascii', 8, 12);
      if (['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(marca)) return 'heic';
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }
}

const rimuovi = file => { try { fs.unlinkSync(file); } catch { /* già assente */ } };

module.exports = { NAS, DIR, MARCATORE, pronta, preparaCartelle, percorso, tipoImmagine, rimuovi };
