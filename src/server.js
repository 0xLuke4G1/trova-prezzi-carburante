// Server statico per lo sviluppo locale: serve la cartella public/.
// In produzione il sito gira su GitHub Pages (nessun backend necessario).
import express from 'express';
import compression from 'compression';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const PUBLIC = join(__dirname, '..', 'public');

if (!existsSync(join(PUBLIC, 'stations.json'))) {
  console.error('❌ public/stations.json non trovato. Esegui prima:  npm run build');
  process.exit(1);
}

const app = express();
app.use(compression());
app.use(express.static(PUBLIC));

app.listen(PORT, () => {
  console.log(`\n🚗 Carburanti Italia (locale) su  http://localhost:${PORT}\n`);
});
