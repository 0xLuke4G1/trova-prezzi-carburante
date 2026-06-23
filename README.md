# ⛽ Prezzi Carburanti Italia

Sito web **statico** che mostra su una mappa interattiva i prezzi di **Benzina,
Gasolio, GPL e Metano** di tutti i distributori in Italia (~24.000 impianti).

I dati provengono dall'unica fonte ufficiale e pubblica: il portale
**[Osservaprezzi Carburanti del MIMIT](https://www.mimit.gov.it/it/open-data/elenco-dataset/carburanti-prezzi-praticati-e-anagrafica-degli-impianti)**.
I gestori comunicano i prezzi per legge e il Ministero li pubblica in un **export
aggiornato ogni giorno**. Non esiste in Italia un dato "al secondo": questa è la
versione più aggiornata e affidabile disponibile.

## Funzionalità

- 🗺️ Mappa di tutta Italia con **clustering** automatico (fluida anche con 24k punti)
- 💶 Prezzo mostrato **direttamente sul marker**, scala colore verde→rosso (conveniente → caro)
- ⛽ Filtro per **carburante** (Benzina / Gasolio / GPL / Metano) e **Self / Servito / Tutti**
- 🔍 **Ricerca** per comune, indirizzo o nome impianto
- 📋 Scheda dettaglio con tutti i prezzi e link alle **indicazioni stradali**
- 📱 Interfaccia **chiara, semplice e responsive**
- ☁️ **Nessun backend**: è un sito statico, ospitabile gratis su GitHub Pages

## Come funziona

`src/build.js` scarica i due CSV ufficiali MIMIT e genera un singolo file statico
`public/stations.json` (~3,5 MB, ~1 MB compresso). Il frontend lo carica una volta
e gestisce mappa, filtri, ricerca e dettaglio interamente nel browser.

## Sviluppo locale

```bash
npm install
npm run build     # scarica i dati MIMIT → public/stations.json
npm start         # server statico locale su http://localhost:3000
# oppure in un colpo solo:
npm run dev
```

## Pubblicazione su GitHub Pages

Il repository include la workflow `.github/workflows/deploy.yml` che:

1. **a ogni push** sul branch `main` ricostruisce i dati e pubblica il sito;
2. **ogni giorno alle 07:30 UTC** (~09:30 ora italiana) riscarica i prezzi MIMIT
   aggiornati e ripubblica automaticamente — così il sito resta sempre aggiornato;
3. è avviabile anche **manualmente** dalla tab *Actions*.

### Passi una tantum

1. Crea un repository su GitHub e fai push di questo progetto sul branch `main`.
2. Vai in **Settings → Pages** e imposta *Source* = **GitHub Actions**.
3. Fatto: a ogni push e ogni mattina il sito si aggiorna da solo.

> Nota: il file `public/stations.json` è in `.gitignore` perché viene rigenerato
> dalla workflow a ogni deploy. Non serve committarlo.

## Struttura

```
src/
  build.js     download + parsing CSV MIMIT → public/stations.json
  server.js    server statico per lo sviluppo locale
public/
  index.html   struttura pagina
  style.css    stile (tema chiaro, responsive)
  app.js       mappa, filtri, ricerca, dettaglio (tutto client-side)
.github/workflows/deploy.yml   build dati + deploy automatico su Pages
```

---
Fonte dati: MIMIT — Osservaprezzi Carburanti. Mappa: © OpenStreetMap, © CARTO.
