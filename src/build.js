// Scarica gli export ufficiali MIMIT e genera un file statico `public/stations.json`
// consumato direttamente dal frontend (nessun backend necessario → GitHub Pages).
// Eseguire con: npm run build
import { mkdirSync, writeFileSync, statSync } from 'fs';
import { gzipSync } from 'zlib';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public');

const URL_ANAGRAFICA = 'https://www.mimit.gov.it/images/exportCSV/anagrafica_impianti_attivi.csv';
const URL_PREZZI = 'https://www.mimit.gov.it/images/exportCSV/prezzo_alle_8.csv';

async function scarica(url) {
  console.log(`→ Scarico ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 CarburantiItalia/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
  return await res.text();
}

// CSV separatore "|", salta riga 0 ("Estrazione del ...") e riga 1 (header colonne)
function righe(testo) {
  return testo.split(/\r?\n/).slice(2).filter((l) => l.trim().length > 0);
}
function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const [anaTxt, prezziTxt] = await Promise.all([scarica(URL_ANAGRAFICA), scarica(URL_PREZZI)]);

  // --- Impianti ---
  const brands = [];
  const brandIdx = new Map();
  const stationsById = new Map(); // id -> indice nell'array s

  const s = []; // [id, lat, lon, bIdx, nome, indirizzo, comune, prov, prezzi[]]
  for (const linea of righe(anaTxt)) {
    const c = linea.split('|');
    if (c.length < 10) continue;
    const id = parseInt(c[0], 10);
    const lat = num(c[8]);
    const lon = num(c[9]);
    if (!Number.isFinite(id) || lat == null || lon == null) continue;
    if (lat < 35 || lat > 48 || lon < 6 || lon > 19) continue; // fuori dall'Italia

    const bandiera = (c[2] || '').trim();
    if (!brandIdx.has(bandiera)) { brandIdx.set(bandiera, brands.length); brands.push(bandiera); }

    stationsById.set(id, s.length);
    s.push([
      id, +lat.toFixed(5), +lon.toFixed(5), brandIdx.get(bandiera),
      (c[4] || c[1] || '').trim(), (c[5] || '').trim(), (c[6] || '').trim(), (c[7] || '').trim(),
      [], // prezzi
    ]);
  }
  console.log(`✓ ${s.length} impianti`);

  // --- Carburanti (dizionario) + prezzi ---
  const fuels = [];
  const fuelIdx = new Map();
  let nPr = 0;
  for (const linea of righe(prezziTxt)) {
    const c = linea.split('|');
    if (c.length < 5) continue;
    const id = parseInt(c[0], 10);
    const prezzo = num(c[2]);
    const si = stationsById.get(id);
    if (si === undefined || prezzo == null || prezzo <= 0) continue;

    const carb = (c[1] || '').trim();
    if (!fuelIdx.has(carb)) { fuelIdx.set(carb, fuels.length); fuels.push(carb); }
    s[si][8].push([fuelIdx.get(carb), +prezzo.toFixed(3), c[3]?.trim() === '1' ? 1 : 0]);
    nPr++;
  }
  console.log(`✓ ${nPr} prezzi`);

  const payload = {
    updated: new Date().toISOString(),
    brands,
    fuels,
    s,
  };

  const json = JSON.stringify(payload);
  const path = join(OUT_DIR, 'stations.json');
  writeFileSync(path, json);
  const kb = (statSync(path).size / 1024).toFixed(0);
  const gz = (gzipSync(json).length / 1024).toFixed(0);
  console.log(`\n✅ Scritto ${path}\n   ${kb} KB (≈ ${gz} KB compresso/gzip, come lo serve GitHub Pages)`);
}

main().catch((err) => { console.error('❌ Errore:', err.message); process.exit(1); });
