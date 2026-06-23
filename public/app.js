'use strict';

// ====== Dati statici (nessun backend: tutto da ./stations.json) ======
// Formato: { updated, brands:[], fuels:[], s:[ [id,lat,lon,bIdx,nome,ind,comune,prov, [[fIdx,prezzo,self],...]] ] }
let DATA = null;
const CARBURANTI_PRINCIPALI = ['Benzina', 'Gasolio', 'GPL', 'Metano'];

const state = {
  fuel: 'Benzina',
  fuelIdx: -1,
  self: '',          // '' = tutti, '1' = self, '0' = servito
  range: { min: 0, max: 0 },
};

// ====== Mappa ======
const map = L.map('map', { zoomControl: true, preferCanvas: true }).setView([42.5, 12.5], 6);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap, &copy; CARTO',
  maxZoom: 19,
  subdomains: 'abcd',
}).addTo(map);

const cluster = L.markerClusterGroup({
  chunkedLoading: true,
  maxClusterRadius: 55,
  spiderfyOnMaxZoom: true,
  disableClusteringAtZoom: 15,
});
map.addLayer(cluster);

// ====== Colore in base al prezzo ======
function colorFor(prezzo) {
  const { min, max } = state.range;
  if (max <= min) return '#1a9850';
  const t = Math.max(0, Math.min(1, (prezzo - min) / (max - min)));
  const stops = [
    [0.0, [26, 152, 80]], [0.25, [145, 207, 96]], [0.5, [254, 224, 139]],
    [0.75, [252, 141, 89]], [1.0, [215, 48, 39]],
  ];
  let a = stops[0], b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const f = (t - a[0]) / (b[0] - a[0] || 1);
  const c = a[1].map((v, i) => Math.round(v + (b[1][i] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ====== Calcolo prezzo migliore per la stazione, dato fuel + filtro self ======
function bestPrice(station) {
  const prezzi = station[8];
  let best = Infinity;
  for (const [fIdx, prezzo, self] of prezzi) {
    if (fIdx !== state.fuelIdx) continue;
    if (state.self === '1' && self !== 1) continue;
    if (state.self === '0' && self !== 0) continue;
    if (prezzo < best) best = prezzo;
  }
  return best === Infinity ? null : best;
}

// ====== Render dei marker per il carburante selezionato ======
function loadStations() {
  if (!DATA) return;
  showLoader('Aggiorno la mappa…');

  // raccogli i prezzi validi per calcolare i percentili (scala colore robusta)
  const prezzi = [];
  const visibili = [];
  for (const st of DATA.s) {
    const p = bestPrice(st);
    if (p == null) continue;
    visibili.push([st, p]);
    prezzi.push(p);
  }
  prezzi.sort((a, b) => a - b);
  const perc = (q) => prezzi.length ? prezzi[Math.floor((prezzi.length - 1) * q)] : 0;
  state.range = { min: +perc(0.05).toFixed(3), max: +perc(0.95).toFixed(3) };

  cluster.clearLayers();
  const markers = [];
  for (const [st, p] of visibili) {
    const col = colorFor(p);
    const icon = L.divIcon({
      className: '',
      html: `<div class="price-marker" style="background:${col};padding:0 5px">${p.toFixed(3)}</div>`,
      iconSize: null,
      iconAnchor: [22, 11],
    });
    const m = L.marker([st[1], st[2]], { icon });
    m.on('click', () => openStation(st));
    markers.push(m);
  }
  cluster.addLayers(markers);

  document.getElementById('legend-min').textContent = state.range.min ? state.range.min.toFixed(3) + ' €' : '—';
  document.getElementById('legend-max').textContent = state.range.max ? state.range.max.toFixed(3) + ' €' : '—';
  document.getElementById('count-line').textContent =
    `${visibili.length.toLocaleString('it-IT')} distributori con ${state.fuel}`;
  hideLoader();
}

// ====== Loader badge ======
let loaderBadge;
function showLoader(txt) {
  if (!loaderBadge) {
    loaderBadge = document.createElement('div');
    loaderBadge.className = 'loader-badge';
    document.getElementById('map').appendChild(loaderBadge);
  }
  loaderBadge.textContent = txt;
  loaderBadge.style.display = 'block';
}
function hideLoader() { if (loaderBadge) loaderBadge.style.display = 'none'; }

// ====== Dettaglio impianto (bottom sheet) ======
const sheet = document.getElementById('sheet');
const sheetContent = document.getElementById('sheet-content');

function openStation(st) {
  sheet.hidden = false;
  const [id, lat, lon, bIdx, nome, ind, comune, prov, prezzi] = st;
  const bandiera = DATA.brands[bIdx] || '';

  // Raggruppa i prezzi per carburante: { carb: {self, servito, eta} }
  const order = ['Benzina', 'Gasolio', 'GPL', 'Metano'];
  const gruppi = new Map();
  let etaMin = 255;
  for (const [fIdx, prezzo, self, eta] of prezzi) {
    const carb = DATA.fuels[fIdx];
    if (!gruppi.has(carb)) gruppi.set(carb, { carb, self: null, servito: null, eta: 255 });
    const g = gruppi.get(carb);
    if (self === 1) g.self = prezzo; else g.servito = prezzo;
    g.eta = Math.min(g.eta, eta ?? 255);
    if ((eta ?? 255) < etaMin) etaMin = eta ?? 255;
  }
  const lista = [...gruppi.values()].sort((a, b) => {
    const ia = order.indexOf(a.carb), ib = order.indexOf(b.carb);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.carb.localeCompare(b.carb);
  });

  const maps = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
  const cards = lista.map((g) => `
    <div class="fuel-card">
      <div class="fuel-card-head">
        <span class="fuel-name">${esc(g.carb)}</span>
        <span class="fuel-age">${etaLabel(g.eta)}</span>
      </div>
      <div class="fuel-prices">
        ${priceCell('Self', g.self)}
        ${priceCell('Servito', g.servito)}
      </div>
    </div>`).join('');

  sheetContent.innerHTML = `
    <h3 class="st-name">${esc(nome || bandiera || 'Distributore')}</h3>
    ${bandiera ? `<span class="st-brand">${esc(bandiera)}</span>` : ''}
    <p class="st-addr">${esc(ind || '')}${comune ? ' — ' + esc(comune) : ''} ${prov ? '(' + esc(prov) + ')' : ''}
      <br /><a href="${maps}" target="_blank" rel="noopener">▸ Indicazioni stradali</a></p>
    <div class="fuel-cards">${cards || '<p>Nessun prezzo disponibile</p>'}</div>
    <p class="freshness">Prezzi comunicati dal gestore al MIMIT · aggiornamento più recente: <strong>${etaLabel(etaMin)}</strong></p>`;
}

// Cella prezzo per modalità (Self / Servito)
function priceCell(label, prezzo) {
  if (prezzo == null) {
    return `<div class="price-cell empty"><span class="pc-mode">${label}</span><span class="pc-val">—</span></div>`;
  }
  return `<div class="price-cell"><span class="pc-mode">${label}</span>
    <span class="pc-val">${prezzo.toFixed(3)}<small>€/l</small></span></div>`;
}

// Etichetta "freschezza" a partire dai giorni trascorsi dalla comunicazione
function etaLabel(giorni) {
  if (giorni == null || giorni >= 255) return 'data non disponibile';
  if (giorni <= 0) return 'oggi';
  if (giorni === 1) return 'ieri';
  if (giorni < 7) return `${giorni} giorni fa`;
  if (giorni < 14) return 'oltre 1 settimana fa';
  if (giorni < 31) return `${Math.round(giorni / 7)} settimane fa`;
  return 'oltre 1 mese fa';
}

function closeSheet() { sheet.hidden = true; }
document.getElementById('sheet-close').addEventListener('click', closeSheet);
sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ====== Controlli: carburante ======
function buildFuelButtons(principali) {
  const wrap = document.getElementById('fuel-buttons');
  wrap.innerHTML = '';
  principali.forEach((f) => {
    const b = document.createElement('button');
    b.textContent = f;
    if (f === state.fuel) b.classList.add('active');
    b.addEventListener('click', () => {
      state.fuel = f;
      state.fuelIdx = DATA.fuels.indexOf(f);
      wrap.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      loadStations();
    });
    wrap.appendChild(b);
  });
}

// ====== Controlli: self/servito ======
document.querySelectorAll('#self-toggle button').forEach((btn) => {
  btn.addEventListener('click', () => {
    state.self = btn.dataset.self;
    document.querySelectorAll('#self-toggle button').forEach((x) => x.classList.toggle('active', x === btn));
    loadStations();
  });
});

// ====== Ricerca (client-side su comune / indirizzo / nome) ======
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
let searchTimer;

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = searchInput.value.trim().toLowerCase();
  if (q.length < 2) { searchResults.hidden = true; return; }
  searchTimer = setTimeout(() => doSearch(q), 180);
});

function doSearch(q) {
  if (!DATA) return;
  const out = [];
  for (const st of DATA.s) {
    const comune = (st[6] || '').toLowerCase();
    const ind = (st[5] || '').toLowerCase();
    const nome = (st[4] || '').toLowerCase();
    if (comune.includes(q) || ind.includes(q) || nome.includes(q)) {
      out.push(st);
      if (out.length >= 25) break;
    }
  }
  if (!out.length) { searchResults.hidden = true; return; }
  searchResults.innerHTML = out.map((st, i) => `
    <li data-i="${i}">
      <div class="r-title">${esc(st[4] || st[6])}</div>
      <div class="r-sub">${esc(st[5] || '')} — ${esc(st[6])} (${esc(st[7])})</div>
    </li>`).join('');
  searchResults.hidden = false;
  searchResults.querySelectorAll('li').forEach((li) => {
    li.addEventListener('click', () => {
      const st = out[+li.dataset.i];
      map.setView([st[1], st[2]], 15);
      searchResults.hidden = true;
      searchInput.value = '';
      openStation(st);
    });
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search')) searchResults.hidden = true;
});

// ====== Pannello mobile ======
document.getElementById('panel-toggle').addEventListener('click', () => {
  document.getElementById('panel').classList.toggle('open');
});

// ====== Avvio ======
async function init() {
  showLoader('Carico i distributori…');
  try {
    const res = await fetch('./stations.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    DATA = await res.json();
  } catch (e) {
    showLoader('Errore nel caricamento dei dati');
    return;
  }

  const principali = CARBURANTI_PRINCIPALI.filter((f) => DATA.fuels.includes(f));
  if (!principali.includes(state.fuel)) state.fuel = principali[0];
  state.fuelIdx = DATA.fuels.indexOf(state.fuel);
  buildFuelButtons(principali);

  const d = DATA.estrazione ? new Date(DATA.estrazione) : (DATA.updated ? new Date(DATA.updated) : null);
  const dataTxt = d ? d.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';
  document.getElementById('meta-line').textContent =
    `${DATA.s.length.toLocaleString('it-IT')} distributori · dati ufficiali MIMIT del ${dataTxt}`;

  loadStations();
}

init();
