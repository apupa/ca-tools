// ===== app.js — Sistemi elementari 1°/2° ordine + massa-molla-smorzatore =====
(function () {
  const CA = window.CA;

  // ---------- Cambio scheda (tab) ----------
  const bottoniScheda = document.querySelectorAll(".scheda-bottone");
  const contenutiScheda = document.querySelectorAll(".scheda-contenuto");
  bottoniScheda.forEach((btn) => {
    btn.addEventListener("click", () => {
      bottoniScheda.forEach((b) => b.classList.remove("attiva"));
      contenutiScheda.forEach((c) => c.classList.remove("attiva"));
      btn.classList.add("attiva");
      document.getElementById("scheda-" + btn.dataset.scheda).classList.add("attiva");
      if (btn.dataset.scheda === "massa") {
        misuraCanvas();
        disegnaFrame(interpolaX(animazione.tempo));
      }
    });
  });

  // ---------- Utilità numeriche ----------
  function formattaNumero(x, decimali) {
    decimali = decimali || 3;
    if (Math.abs(x) < 1e-9) x = 0;
    const fattore = Math.pow(10, decimali);
    const r = Math.round(x * fattore) / fattore;
    return r === 0 ? 0 : r;
  }
  function formattaComplesso(c) {
    const re = formattaNumero(c.re);
    const im = formattaNumero(c.im);
    if (im === 0) return String(re);
    const segno = im > 0 ? "+" : "-";
    const absIm = Math.abs(im);
    return re + " " + segno + " " + (absIm === 1 ? "j" : absIm + "j");
  }
  function typeset(el) {
    if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([el]);
  }

  // ===================================================================
  // SCHEDA A — PRIMO ORDINE:  G(s) = mu / (tau*s + 1)
  // ===================================================================
  const aMu = document.getElementById("a-mu");
  const aMuVal = document.getElementById("a-mu-val");
  const aTau = document.getElementById("a-tau");
  const aTauVal = document.getElementById("a-tau-val");
  const aTEnd = document.getElementById("a-tend");
  const aFdtTesto = document.getElementById("a-fdt-testo");

  // La finestra T è fissa e scelta dall'utente (non ricalcolata da tau): così, a parità di T,
  // si vede direttamente se il sistema è diventato più lento o più veloce.
  function aggiornaPrimoOrdine() {
    const mu = parseFloat(aMu.value);
    const tau = parseFloat(aTau.value);
    aMuVal.textContent = formattaNumero(mu);
    aTauVal.textContent = formattaNumero(tau);

    const num = [mu];
    const den = [tau, 1];
    const tEnd = Math.max(parseFloat(aTEnd.value) || 20, 0.1);
    const dt = tEnd / 300;
    const { t, y } = CA.simulate(num, den, (tt) => (tt >= 0 ? 1 : 0), tEnd, dt);
    CAPlot.plotTime("a-grafico-risposta", t, [{ name: "y(t)", y: y }]);

    const polo = -1 / tau;
    // Assi fissi (indipendenti da tau): con tau in [0.1,5] il polo -1/tau varia in [-10,-0.2].
    CAPlot.plotComplex("a-grafico-polo", [{ re: polo, im: 0 }], { xrange: [-11, 1], yrange: [-6, 6] });

    aFdtTesto.innerHTML = "$G(s) = \\dfrac{" + formattaNumero(mu) + "}{" + formattaNumero(tau) + "s+1}$";
    document.getElementById("a-polo-testo").textContent = formattaNumero(polo);
    document.getElementById("a-regime-testo").textContent = formattaNumero(mu);
    document.getElementById("a-ta-testo").textContent = formattaNumero(3 * tau) + " s";
    typeset(aFdtTesto);
  }
  aMu.addEventListener("input", aggiornaPrimoOrdine);
  aTau.addEventListener("input", aggiornaPrimoOrdine);
  aTEnd.addEventListener("input", aggiornaPrimoOrdine);
  document.getElementById("a-btn-esempio").addEventListener("click", () => {
    aMu.value = "2";
    aTau.value = "1";
    aTEnd.value = "20";
    aggiornaPrimoOrdine();
  });

  // ===================================================================
  // SCHEDA B — SECONDO ORDINE:  G(s) = mu*omegan^2 / (s^2 + 2*zeta*omegan*s + omegan^2)
  // ===================================================================
  const bMu = document.getElementById("b-mu");
  const bMuVal = document.getElementById("b-mu-val");
  const bOmegan = document.getElementById("b-omegan");
  const bOmeganVal = document.getElementById("b-omegan-val");
  const bZeta = document.getElementById("b-zeta");
  const bZetaVal = document.getElementById("b-zeta-val");
  const bFdtTesto = document.getElementById("b-fdt-testo");
  const bTEnd = document.getElementById("b-tend");

  // La finestra T è fissa e scelta dall'utente (non ricalcolata da omegan/zeta): così, a parità
  // di T, si vede direttamente se il sistema è diventato più lento o più veloce.
  function aggiornaSecondoOrdine() {
    const mu = parseFloat(bMu.value);
    const omegan = parseFloat(bOmegan.value);
    const zeta = parseFloat(bZeta.value);
    bMuVal.textContent = formattaNumero(mu);
    bOmeganVal.textContent = formattaNumero(omegan);
    bZetaVal.textContent = formattaNumero(zeta);

    const num = [mu * omegan * omegan];
    const den = [1, 2 * zeta * omegan, omegan * omegan];

    const tEnd = Math.max(parseFloat(bTEnd.value) || 20, 0.1);
    const dt = tEnd / 400;
    const { t, y } = CA.simulate(num, den, (tt) => (tt >= 0 ? 1 : 0), tEnd, dt);
    CAPlot.plotTime("b-grafico-risposta", t, [{ name: "y(t)", y: y }]);

    const poli = CA.polyRoots(den);
    // Assi fissi (indipendenti da omegan/zeta), dimensionati sui valori estremi degli slider
    // (omegan in [0.1,5], zeta in [0,2]): il polo più a sinistra raggiunge circa -18.7,
    // la parte immaginaria massima circa 5.
    CAPlot.plotComplex(
      "b-grafico-poli",
      poli.map((p) => ({ re: p.re, im: p.im })),
      { xrange: [-19, 1], yrange: [-6, 6] }
    );

    bFdtTesto.innerHTML =
      "$G(s) = \\dfrac{" + formattaNumero(mu * omegan * omegan) + "}{s^2+" + formattaNumero(2 * zeta * omegan) +
      "s+" + formattaNumero(omegan * omegan) + "}$";
    document.getElementById("b-poli-testo").textContent = poli.map(formattaComplesso).join(", ");

    if (zeta < 1) {
      const S = 100 * Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta));
      const Tp = Math.PI / (omegan * Math.sqrt(1 - zeta * zeta));
      document.getElementById("b-s-testo").textContent = formattaNumero(S) + " %";
      document.getElementById("b-tp-testo").textContent = formattaNumero(Tp) + " s";
    } else {
      document.getElementById("b-s-testo").textContent = "assente (sistema non sottosmorzato, δ ≥ 1)";
      document.getElementById("b-tp-testo").textContent = "n/d (nessun sorpasso, δ ≥ 1)";
    }
    const sigma = zeta * omegan;
    document.getElementById("b-ta-testo").textContent =
      sigma > 1e-6 ? formattaNumero(3 / sigma) + " s" : "n/d (δ=0, oscillazione persistente)";

    // Con zeta >= 1 i poli sono reali (non una coppia complessa coniugata): omegan e zeta restano
    // i parametri usati per costruire la FdT, ma perdono il significato di pulsazione naturale e
    // smorzamento di un moto oscillatorio, dato che non c'è alcuna oscillazione da smorzare.
    document.getElementById("b-nota-poli").textContent =
      zeta >= 1
        ? "Nota: con δ ≥ 1 i poli sono reali, non una coppia complessa coniugata. ωₙ e δ restano i " +
          "parametri con cui è stata costruita la FdT, ma non hanno più il significato di pulsazione " +
          "naturale e smorzamento di un moto oscillatorio (non c'è oscillazione)."
        : "";
    typeset(bFdtTesto);
  }
  [bMu, bOmegan, bZeta, bTEnd].forEach((el) => el.addEventListener("input", aggiornaSecondoOrdine));
  document.getElementById("b-btn-esempio").addEventListener("click", () => {
    bMu.value = "1";
    bOmegan.value = "2";
    bZeta.value = "1";
    bTEnd.value = "20";
    aggiornaSecondoOrdine();
  });

  // ===================================================================
  // SCHEDA C — MASSA-MOLLA-SMORZATORE:  m*x'' + b*x' + k*x = F
  // ===================================================================
  const cM = document.getElementById("c-m");
  const cMVal = document.getElementById("c-m-val");
  const cB = document.getElementById("c-b");
  const cBVal = document.getElementById("c-b-val");
  const cK = document.getElementById("c-k");
  const cKVal = document.getElementById("c-k-val");
  const cForzaTipo = document.getElementById("c-forza-tipo");
  const cForzaAmpiezza = document.getElementById("c-forza-ampiezza");
  const cTEnd = document.getElementById("c-tend");
  const cFdtTesto = document.getElementById("c-fdt-testo");

  const canvas = document.getElementById("massa-canvas");
  const ctx = canvas.getContext("2d");
  const PARETE_X0 = 12;
  const PARETE_W = 14;
  const BLOCK_SIZE_MAX = 40 + 5 * 8; // dimensione blocco al valore massimo di m (per un margine sicuro)

  // Colori della scena: gli stessi del sito (carta e inchiostro).
  const C_CARTA = "#fbf9f5";
  const C_INCHIOSTRO = "#45443d";
  const C_FILETTO = "#c9c3b4";
  const C_BLU = "#1d4ed8";
  const C_ROSSO = "#b3261e";
  const FONT_MONO = '11px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';

  // Il canvas veniva disegnato in uno spazio fisso 800x180 e poi stirato
  // dal CSS fino alla larghezza della colonna: il blocco quadrato usciva
  // rettangolare e tutto era sfocato sugli schermi ad alta densita'. Ora
  // il sistema di coordinate coincide con i pixel CSS effettivi e il
  // fondo e' moltiplicato per devicePixelRatio.
  let CANVAS_W = 800;
  let CANVAS_H = 180;
  let RIPOSO_X = 260; // posizione (px) del centro del blocco quando x=0
  let SCALA_FISSA = 1;

  // Finestra fisica FISSA dell'animazione, in metri: non dipende da F, m, b, k, quindi il
  // blocco si sposta sempre in proporzione reale allo spostamento fisico. Forze o rigidezze
  // che producono uno spostamento fuori da questa finestra fanno semplicemente uscire il
  // blocco dal disegno (il canvas la ritaglia automaticamente): è il compromesso accettato
  // per avere una scala realistica nel caso tipico, invece di una che si "auto-normalizza"
  // sempre alla stessa corsa visiva qualunque siano i parametri.
  const X_ANIMAZIONE_MIN = -2; // m, verso la parete
  const X_ANIMAZIONE_MAX = 10; // m, verso destra
  function misuraCanvas() {
    const dpr = window.devicePixelRatio || 1;
    CANVAS_W = Math.max(Math.round(canvas.clientWidth) || 800, 320);
    CANVAS_H = 156;
    canvas.width = Math.round(CANVAS_W * dpr);
    canvas.height = Math.round(CANVAS_H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    RIPOSO_X = Math.round(PARETE_X0 + PARETE_W + Math.min(210, CANVAS_W * 0.28));
    const dispSinistra = RIPOSO_X - (PARETE_X0 + PARETE_W) - BLOCK_SIZE_MAX / 2 - 12;
    const dispDestra = CANVAS_W - RIPOSO_X - BLOCK_SIZE_MAX / 2 - 24;
    SCALA_FISSA = Math.min(
      dispSinistra / Math.abs(X_ANIMAZIONE_MIN),
      dispDestra / X_ANIMAZIONE_MAX
    );
  }

  // Dati della simulazione corrente e stato di riproduzione dell'animazione
  let datiSimulazione = { t: [0], x: [0] };
  let statoMassa = { m: 1 };
  // Posizione di equilibrio finale, in metri; null se il sistema non e'
  // asintoticamente stabile e quindi un valore di regime non esiste.
  let xRegime = null;
  let animazione = { attiva: false, tempo: 0, ultimoTimestamp: null };

  // Molla elicoidale: due tratti dritti alle estremita' e le spire in mezzo,
  // cosi' resta leggibile anche quando il blocco e' molto vicino alla parete.
  function disegnaMolla(x0, y0, x1, spire, ampiezza) {
    const luce = x1 - x0;
    const cappello = Math.min(14, Math.max(6, luce * 0.12));
    const inizio = x0 + cappello;
    const fine = x1 - cappello;
    const passo = (fine - inizio) / spire;
    ctx.strokeStyle = C_INCHIOSTRO;
    ctx.lineWidth = 1.8;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(inizio, y0);
    for (let i = 0; i < spire; i++) {
      ctx.lineTo(inizio + passo * (i + 0.25), y0 - ampiezza);
      ctx.lineTo(inizio + passo * (i + 0.75), y0 + ampiezza);
      ctx.lineTo(inizio + passo * (i + 1), y0);
    }
    ctx.lineTo(x1, y0);
    ctx.stroke();
  }

  // Smorzatore: cilindro fisso ancorato alla parete e stelo con pistone
  // solidale al blocco. Il pistone scorre davvero dentro il cilindro.
  function disegnaSmorzatore(x0, y0, x1) {
    const luce = x1 - x0;
    const cilindroL = Math.min(46, Math.max(26, luce * 0.42));
    const cilindroX0 = x0 + Math.min(16, luce * 0.14);
    const cilindroX1 = cilindroX0 + cilindroL;
    const h = 9;

    ctx.strokeStyle = C_INCHIOSTRO;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";

    // stelo dalla parete al cilindro
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(cilindroX0, y0);
    ctx.stroke();

    // cilindro: aperto sul lato del blocco (tre lati, non un rettangolo)
    ctx.beginPath();
    ctx.moveTo(cilindroX1, y0 - h);
    ctx.lineTo(cilindroX0, y0 - h);
    ctx.lineTo(cilindroX0, y0 + h);
    ctx.lineTo(cilindroX1, y0 + h);
    ctx.stroke();

    // pistone: resta dentro il cilindro qualunque sia la corsa
    const pistone = Math.min(Math.max(x1 - 20, cilindroX0 + 5), cilindroX1 - 3);
    ctx.beginPath();
    ctx.moveTo(pistone, y0 - h + 2);
    ctx.lineTo(pistone, y0 + h - 2);
    ctx.stroke();

    // stelo dal pistone al blocco
    ctx.beginPath();
    ctx.moveTo(pistone, y0);
    ctx.lineTo(x1, y0);
    ctx.stroke();
  }

  // Tratteggio a 45 gradi: e' il segno con cui nei disegni tecnici si
  // indica un vincolo fisso (parete e pavimento).
  function disegnaCampitura(x0, y0, x1, y1, verso) {
    ctx.strokeStyle = C_FILETTO;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let d = 0; d < (x1 - x0) + (y1 - y0); d += 7) {
      if (verso === "verticale") {
        ctx.moveTo(x0, y0 + d);
        ctx.lineTo(x0 - 7, y0 + d + 7);
      } else {
        ctx.moveTo(x0 + d, y1);
        ctx.lineTo(x0 + d - 7, y1 + 7);
      }
    }
    ctx.stroke();
  }

  function disegnaRettangoloArrotondato(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Riga verticale tratteggiata con etichetta in cima. In basso l'etichetta
  // finirebbe sopra il pavimento e la sua campitura.
  function disegnaRiferimento(x, colore, etichetta) {
    ctx.strokeStyle = colore;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, etichetta ? 22 : 14);
    ctx.lineTo(x, CANVAS_H - 30);
    ctx.stroke();
    ctx.setLineDash([]);
    if (etichetta) {
      ctx.fillStyle = colore;
      ctx.font = FONT_MONO;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(etichetta, x, 6);
    }
  }

  function disegnaFrame(xValore) {
    const suolo = CANVAS_H - 30;
    const blockSize = 40 + Math.min(statoMassa.m, 5) * 8;
    // Il blocco scorre APPOGGIATO al pavimento: prima galleggiava a mezza
    // altezza e il pavimento sotto sembrava scollegato dalla scena. Cosi'
    // una massa piu' grande e' anche piu' alta, e molla e smorzatore si
    // attaccano a un quarto e tre quarti della sua faccia.
    const centroY = suolo - blockSize / 2;
    // Scala fissa: uno spostamento fisico oltre [X_ANIMAZIONE_MIN, X_ANIMAZIONE_MAX] fa
    // semplicemente uscire il blocco dal canvas (che lo ritaglia automaticamente).
    const blockCenterX = RIPOSO_X + SCALA_FISSA * xValore;
    const blockLeft = blockCenterX - blockSize / 2;

    ctx.fillStyle = C_CARTA;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // pavimento e parete: vincoli fissi, campiti a 45 gradi
    ctx.strokeStyle = C_INCHIOSTRO;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(PARETE_X0, suolo);
    ctx.lineTo(CANVAS_W - 6, suolo);
    ctx.stroke();
    disegnaCampitura(PARETE_X0, suolo, CANVAS_W - 6, suolo, "orizzontale");

    ctx.beginPath();
    ctx.moveTo(PARETE_X0 + PARETE_W, 16);
    ctx.lineTo(PARETE_X0 + PARETE_W, suolo);
    ctx.stroke();
    disegnaCampitura(PARETE_X0 + PARETE_W, 16, PARETE_X0 + PARETE_W, suolo - 7, "verticale");

    const bordoParete = PARETE_X0 + PARETE_W;
    // Molla e smorzatore si attaccano vicino agli spigoli del blocco: piu'
    // sono distanti fra loro, piu' c'e' spazio per le etichette senza che
    // finiscano sul pavimento.
    const yMolla = centroY - blockSize / 2 + 8;
    const ySmorzatore = centroY + blockSize / 2 - 8;

    disegnaMolla(bordoParete, yMolla, blockLeft, 7, 8);
    disegnaSmorzatore(bordoParete, ySmorzatore, blockLeft);

    // etichette dei due elementi
    ctx.fillStyle = C_INCHIOSTRO;
    ctx.font = FONT_MONO;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.fillText("k", bordoParete + 6, yMolla - 7);
    ctx.fillText("b", bordoParete + 6, ySmorzatore - 7);

    // riferimenti: x = 0 e, se il sistema e' stabile, il valore di regime
    const xR = xRegime !== null && Number.isFinite(xRegime)
      ? RIPOSO_X + SCALA_FISSA * xRegime
      : null;
    // Con un regime molto vicino a zero le due etichette si sovrappongono:
    // in quel caso resta solo la riga rossa, senza scritta.
    const vicine = xR !== null && Math.abs(xR - RIPOSO_X) < 26;
    disegnaRiferimento(RIPOSO_X, C_FILETTO, vicine ? "" : "0");
    if (xR !== null && xR > 10 && xR < CANVAS_W - 10) {
      disegnaRiferimento(xR, C_ROSSO, vicine ? "" : "x(∞)");
    }

    // blocco (massa)
    ctx.fillStyle = C_BLU;
    ctx.strokeStyle = C_BLU;
    ctx.lineWidth = 1.5;
    disegnaRettangoloArrotondato(blockLeft, centroY - blockSize / 2, blockSize, blockSize, 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = C_CARTA;
    ctx.font = '13px "IBM Plex Mono", ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("m", blockCenterX, centroY);

    // lettura numerica dello spostamento corrente
    ctx.fillStyle = C_INCHIOSTRO;
    ctx.font = FONT_MONO;
    ctx.textAlign = "right";
    ctx.textBaseline = "top";
    ctx.fillText("x = " + xValore.toFixed(2) + " m", CANVAS_W - 8, 8);
  }

  // Interpola x(t) linearmente sui campioni della simulazione corrente
  function interpolaX(tempo) {
    const { t, x } = datiSimulazione;
    if (tempo <= t[0]) return x[0];
    if (tempo >= t[t.length - 1]) return x[x.length - 1];
    for (let i = 1; i < t.length; i++) {
      if (t[i] >= tempo) {
        const frac = (tempo - t[i - 1]) / (t[i] - t[i - 1]);
        return x[i - 1] + frac * (x[i] - x[i - 1]);
      }
    }
    return x[x.length - 1];
  }

  function passoAnimazione(timestamp) {
    if (!animazione.attiva) return;
    if (animazione.ultimoTimestamp === null) animazione.ultimoTimestamp = timestamp;
    const dtReale = (timestamp - animazione.ultimoTimestamp) / 1000;
    animazione.ultimoTimestamp = timestamp;
    animazione.tempo += dtReale;
    const tMax = datiSimulazione.t[datiSimulazione.t.length - 1] || 1;
    if (animazione.tempo > tMax) animazione.tempo = 0; // ricomincia in loop
    disegnaFrame(interpolaX(animazione.tempo));
    requestAnimationFrame(passoAnimazione);
  }

  function aggiornaMassaMolla() {
    const m = parseFloat(cM.value);
    const b = parseFloat(cB.value);
    const k = parseFloat(cK.value);
    cMVal.textContent = formattaNumero(m);
    cBVal.textContent = formattaNumero(b);
    cKVal.textContent = formattaNumero(k);

    const omegan = Math.sqrt(k / m);
    const zeta = b / (2 * Math.sqrt(k * m));

    const num = [1];
    const den = [m, b, k];
    // Finestra T fissa e scelta dall'utente: a parità di T si vede se il sistema è più lento/veloce.
    const tEnd = Math.max(parseFloat(cTEnd.value) || 20, 0.1);
    const dt = tEnd / 400;

    const tipo = cForzaTipo.value;
    const F = parseFloat(cForzaAmpiezza.value);
    const forzaValida = !Number.isNaN(F);
    const uFunc =
      tipo === "impulso"
        ? (tt) => (tt >= 0 && tt < dt ? (forzaValida ? F : 0) / dt : 0)
        : (tt) => (tt >= 0 ? (forzaValida ? F : 0) : 0);

    // CA.simulate ritorna {t, y}; qui y rappresenta la posizione x(t)
    const { t, y } = CA.simulate(num, den, uFunc, tEnd, dt);
    datiSimulazione = { t: t, x: y };

    // Valore di regime. Il sistema e' asintoticamente stabile solo con
    // m, b, k tutti positivi: con b = 0 oscilla per sempre e con k = 0 il
    // blocco deriva, quindi in quei casi non c'e' nulla da tracciare.
    // Col gradino x(∞) = G(0)·F = F/k (teorema del valore finale);
    // con l'impulso il blocco torna nell'origine.
    const stabile = m > 0 && b > 0 && k > 0;
    xRegime = stabile && forzaValida ? (tipo === "gradino" ? F / k : 0) : null;

    const serie = [{ name: "x(t)", y: y, line: { color: "#1d4ed8", width: 2 } }];
    if (xRegime !== null) {
      serie.push({
        name: "regime x(∞) = " + formattaNumero(xRegime) + " m",
        y: t.map(function () { return xRegime; }),
        line: { color: "#b3261e", width: 1.5, dash: "dash" },
      });
    }
    CAPlot.plotTime("c-grafico-risposta", t, serie);

    // statoMassa.m serve solo per dimensionare il blocco; la scala è la costante SCALA_FISSA.
    statoMassa = { m: m };

    cFdtTesto.innerHTML =
      "$G(s) = \\dfrac{1}{" + formattaNumero(m) + "s^2+" + formattaNumero(b) + "s+" + formattaNumero(k) + "}$";
    document.getElementById("c-omegan-testo").textContent = formattaNumero(omegan) + " rad/s";
    document.getElementById("c-zeta-testo").textContent = formattaNumero(zeta);
    let classificazione;
    if (zeta < 1) classificazione = "sottosmorzato (oscillante)";
    else if (Math.abs(zeta - 1) < 1e-6) classificazione = "criticamente smorzato";
    else classificazione = "sovrasmorzato (nessuna oscillazione)";
    document.getElementById("c-tipo-testo").textContent = classificazione;
    typeset(cFdtTesto);

    // ferma l'animazione e mostra il fotogramma iniziale con i nuovi dati
    animazione.attiva = false;
    animazione.tempo = 0;
    animazione.ultimoTimestamp = null;
    disegnaFrame(interpolaX(0));
  }

  [cM, cB, cK, cTEnd].forEach((el) => el.addEventListener("input", aggiornaMassaMolla));
  cForzaTipo.addEventListener("change", aggiornaMassaMolla);
  cForzaAmpiezza.addEventListener("change", aggiornaMassaMolla);

  document.getElementById("c-btn-play").addEventListener("click", () => {
    if (!animazione.attiva) {
      animazione.attiva = true;
      animazione.ultimoTimestamp = null;
      requestAnimationFrame(passoAnimazione);
    }
  });
  document.getElementById("c-btn-pausa").addEventListener("click", () => {
    animazione.attiva = false;
  });
  document.getElementById("c-btn-reset").addEventListener("click", () => {
    animazione.attiva = false;
    animazione.tempo = 0;
    disegnaFrame(interpolaX(0));
  });

  document.getElementById("c-btn-esempio").addEventListener("click", () => {
    cM.value = "1";
    cB.value = "1";
    cK.value = "1";
    cForzaTipo.value = "gradino";
    cForzaAmpiezza.value = "1";
    cTEnd.value = "20";
    aggiornaMassaMolla();
  });

  if (typeof ResizeObserver === "function") {
    let larghezzaNota = 0;
    new ResizeObserver(function () {
      // Ridisegnare a ogni pixel di variazione fa sfarfallare durante il
      // trascinamento del bordo: basta reagire ai cambi veri.
      const larghezza = Math.round(canvas.clientWidth);
      if (larghezza > 0 && Math.abs(larghezza - larghezzaNota) >= 2) {
        larghezzaNota = larghezza;
        misuraCanvas();
        disegnaFrame(interpolaX(animazione.tempo));
      }
    }).observe(canvas);
  }

  // ---------- Stato iniziale della pagina (mai vuota all'apertura) ----------
  aggiornaPrimoOrdine();
  aggiornaSecondoOrdine();
  misuraCanvas();
  aggiornaMassaMolla();
})();
