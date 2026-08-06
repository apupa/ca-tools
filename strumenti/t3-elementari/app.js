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
  const CANVAS_W = canvas.width;
  const CANVAS_H = canvas.height;
  const PARETE_X0 = 10;
  const PARETE_W = 20;
  const RIPOSO_X = 260; // posizione (px) del centro del blocco quando x=0
  const BLOCK_SIZE_MAX = 40 + 5 * 8; // dimensione blocco al valore massimo di m (per un margine sicuro)

  // Finestra fisica FISSA dell'animazione, in metri: non dipende da F, m, b, k, quindi il
  // blocco si sposta sempre in proporzione reale allo spostamento fisico. Forze o rigidezze
  // che producono uno spostamento fuori da questa finestra fanno semplicemente uscire il
  // blocco dal disegno (il canvas la ritaglia automaticamente): è il compromesso accettato
  // per avere una scala realistica nel caso tipico, invece di una che si "auto-normalizza"
  // sempre alla stessa corsa visiva qualunque siano i parametri.
  const X_ANIMAZIONE_MIN = -2; // m, verso la parete
  const X_ANIMAZIONE_MAX = 10; // m, verso destra
  const PX_DISPONIBILI_SINISTRA = RIPOSO_X - (PARETE_X0 + PARETE_W) - BLOCK_SIZE_MAX / 2 - 10;
  const PX_DISPONIBILI_DESTRA = CANVAS_W - RIPOSO_X - BLOCK_SIZE_MAX / 2 - 20;
  const SCALA_FISSA = Math.min(
    PX_DISPONIBILI_SINISTRA / Math.abs(X_ANIMAZIONE_MIN),
    PX_DISPONIBILI_DESTRA / X_ANIMAZIONE_MAX
  );

  // Dati della simulazione corrente e stato di riproduzione dell'animazione
  let datiSimulazione = { t: [0], x: [0] };
  let statoMassa = { m: 1 };
  let animazione = { attiva: false, tempo: 0, ultimoTimestamp: null };

  function disegnaZigzag(x0, y0, x1, y1, segmenti, ampiezza) {
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    const dx = (x1 - x0) / segmenti;
    for (let i = 1; i < segmenti; i++) {
      const xx = x0 + dx * i;
      const yy = y0 + (i % 2 === 0 ? ampiezza : -ampiezza);
      ctx.lineTo(xx, yy);
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }

  function disegnaSmorzatore(x0, y0, x1, y1) {
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 2;
    const l = x1 - x0;
    const cx0 = x0 + l * 0.3;
    const cx1 = x0 + l * 0.65;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(cx0, y0);
    ctx.stroke();
    ctx.strokeRect(cx0, y0 - 9, cx1 - cx0, 18);
    ctx.beginPath();
    ctx.moveTo(cx1, y0);
    ctx.lineTo(x1, y1);
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

  // Disegna un fotogramma dell'animazione per lo spostamento fisico xValore [m]
  function disegnaFrame(xValore) {
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const centroY = CANVAS_H / 2;
    const blockSize = 40 + Math.min(statoMassa.m, 5) * 8;
    // Scala fissa: uno spostamento fisico oltre [X_ANIMAZIONE_MIN, X_ANIMAZIONE_MAX] fa
    // semplicemente uscire il blocco dal canvas (che lo ritaglia automaticamente).
    const blockCenterX = RIPOSO_X + SCALA_FISSA * xValore;
    const blockLeft = blockCenterX - blockSize / 2;

    // parete (tratteggiata)
    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(PARETE_X0, 15, PARETE_W, CANVAS_H - 30);
    ctx.strokeStyle = "#6b7280";
    ctx.lineWidth = 1;
    for (let yy = 15; yy < CANVAS_H - 15; yy += 10) {
      ctx.beginPath();
      ctx.moveTo(PARETE_X0, yy);
      ctx.lineTo(PARETE_X0 + PARETE_W + 8, yy + 10);
      ctx.stroke();
    }

    const paretebordo = PARETE_X0 + PARETE_W;
    const yMolla = centroY - 24;
    const ySmorzatore = centroY + 24;

    disegnaZigzag(paretebordo, yMolla, blockLeft, yMolla, 10, 9);
    disegnaSmorzatore(paretebordo, ySmorzatore, blockLeft, ySmorzatore);

    // linea di riferimento x=0
    ctx.strokeStyle = "#d1d5db";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(RIPOSO_X, 15);
    ctx.lineTo(RIPOSO_X, CANVAS_H - 15);
    ctx.stroke();
    ctx.setLineDash([]);

    // blocco (massa)
    ctx.fillStyle = "#2563eb";
    ctx.strokeStyle = "#1d4ed8";
    ctx.lineWidth = 2;
    disegnaRettangoloArrotondato(blockLeft, centroY - blockSize / 2, blockSize, blockSize, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("m", blockCenterX, centroY);
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

    CAPlot.plotTime("c-grafico-risposta", t, [{ name: "x(t)", y: y }]);

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

  // ---------- Stato iniziale della pagina (mai vuota all'apertura) ----------
  aggiornaPrimoOrdine();
  aggiornaSecondoOrdine();
  aggiornaMassaMolla();
})();
