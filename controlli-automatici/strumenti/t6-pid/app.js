// ===== app.js — Taratura PID =====
(function () {
  const CA = window.CA;
  const N_FILTRO_DERIVATIVO = 10; // N per il filtro Td*s/(1+(Td/N)s)
  const DT_FISSO = 0.001; // passo di integrazione, fisso e non modificabile dall'utente

  // ---------- Riferimenti DOM ----------
  const selImpianto = document.getElementById("impianto-tipo");
  const sezImpiantoMassa = document.getElementById("sezione-impianto-massa");
  const sezImpiantoGenerico = document.getElementById("sezione-impianto-generico");
  const pM = document.getElementById("p-m"), pMVal = document.getElementById("p-m-val");
  const pB = document.getElementById("p-b"), pBVal = document.getElementById("p-b-val");
  const pK = document.getElementById("p-k"), pKVal = document.getElementById("p-k-val");
  const pNum = document.getElementById("p-num");
  const pDen = document.getElementById("p-den");

  const cKp = document.getElementById("c-kp"), cKpVal = document.getElementById("c-kp-val");
  const cAzioneI = document.getElementById("c-azione-i");
  const cTi = document.getElementById("c-ti"), cTiVal = document.getElementById("c-ti-val"), cKiVal = document.getElementById("c-ki-val");
  const cAzioneD = document.getElementById("c-azione-d");
  const cTd = document.getElementById("c-td"), cTdVal = document.getElementById("c-td-val"), cKdVal = document.getElementById("c-kd-val");

  const cRAmpiezza = document.getElementById("c-r-ampiezza");
  const cTEnd = document.getElementById("c-tend");

  const duAttivo = document.getElementById("du-attivo");
  const duAmpiezza = document.getElementById("du-ampiezza");
  const duIstante = document.getElementById("du-istante");
  const dyAttivo = document.getElementById("dy-attivo");
  const dyAmpiezza = document.getElementById("dy-ampiezza");
  const dyIstante = document.getElementById("dy-istante");
  const nAttivo = document.getElementById("n-attivo");
  const nTipo = document.getElementById("n-tipo");
  const nAmpiezza = document.getElementById("n-ampiezza");
  const nIstante = document.getElementById("n-istante");
  const nOmegaCampo = document.getElementById("n-omega-campo");
  const nOmega = document.getElementById("n-omega");

  const divErrore = document.getElementById("messaggio-errore");
  const divFdtTesto = document.getElementById("fdt-testo");
  const divGeq = document.getElementById("geq-testo");
  const divParametri = document.getElementById("parametri-testo");

  // ---------- Utilità numeriche ----------
  // Legge un polinomio da un campo di testo. Accetta due formati:
  // i coefficienti separati da spazio ("1 11 10") oppure l'espressione
  // nella variabile s ("(s+1)(s+10)"). Vedi CA.parsePolinomio.
  function leggiVettoreCoeff(str) {
    try {
      return CA.parsePolinomio(str);
    } catch (e) {
      throw new Error('polinomio non valido: "' + String(str).trim() + '" [' + e.message + ']');
    }
  }
  function leggiNumero(campo, nome) {
    const v = parseFloat(campo.value);
    if (Number.isNaN(v)) throw new Error("il valore di " + nome + " deve essere un numero");
    return v;
  }
  function formattaNumero(x, decimali) {
    decimali = decimali || 4;
    if (Math.abs(x) < 1e-9) x = 0;
    const fattore = Math.pow(10, decimali);
    const r = Math.round(x * fattore) / fattore;
    return r === 0 ? 0 : r;
  }
  function typeset(el) {
    if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([el]);
  }
  // Costruisce "s^2 + 3s + 2" (variabile generica, per polinomi in s)
  function formattaPolinomioTex(coeffs, variabile) {
    const grado = coeffs.length - 1;
    const termini = [];
    coeffs.forEach((c, i) => {
      const g = grado - i;
      const cf = formattaNumero(c);
      if (cf === 0 && !(grado === 0 && termini.length === 0)) return;
      const segno = cf < 0 ? "-" : termini.length ? "+" : "";
      const abs = Math.abs(cf);
      let corpo;
      if (g === 0) corpo = String(abs);
      else {
        const coeffStr = abs === 1 ? "" : String(abs);
        corpo = coeffStr + variabile + (g === 1 ? "" : "^{" + g + "}");
      }
      termini.push(segno + corpo);
    });
    return termini.length ? termini.join(" ") : "0";
  }
  function mostraFdT(num, den) {
    const numTex = formattaPolinomioTex(num, "s");
    const denTex = formattaPolinomioTex(den, "s");
    divFdtTesto.innerHTML = "<div style=\"overflow-x:auto;\">$$G(s) = \\dfrac{" + numTex + "}{" + denTex + "}$$</div>";
    typeset(divFdtTesto);
  }
  // Somma di due FdT razionali n1/d1 + n2/d2 = (n1*d2 + n2*d1)/(d1*d2)
  function sommaRazionali(n1, d1, n2, d2) {
    return { num: CA.polyAdd(CA.polyMul(n1, d2), CA.polyMul(n2, d1)), den: CA.polyMul(d1, d2) };
  }
  // Costruisce C(s) del regolatore PID (derivativa filtrata Td*s/(1+(Td/N)s))
  function costruisciRegolatore(Kp, azioneI, Ti, azioneD, Td) {
    let num = [Kp], den = [1];
    if (azioneI && Ti > 0) {
      const r = sommaRazionali(num, den, [Kp], [Ti, 0]);
      num = r.num; den = r.den;
    }
    if (azioneD && Td > 0) {
      const a = Td / N_FILTRO_DERIVATIVO;
      const r = sommaRazionali(num, den, [Kp * Td, 0], [a, 1]);
      num = r.num; den = r.den;
    }
    return { num: CA.polyStripLeadingZeros(num), den: CA.polyStripLeadingZeros(den) };
  }
  // Mostra G_eq(s) = C(s)G(s) / (1 + C(s)G(s)) per i parametri scelti (retroazione unitaria)
  function mostraGeq(implNum, implDen, Kp, azioneI, Ti, azioneD, Td) {
    const c = costruisciRegolatore(Kp, azioneI, Ti, azioneD, Td);
    const lNum = CA.polyMul(c.num, implNum);
    const lDen = CA.polyMul(c.den, implDen);
    const geqNum = lNum;
    const geqDen = CA.polyAdd(lDen, lNum);
    const numTex = formattaPolinomioTex(geqNum, "s");
    const denTex = formattaPolinomioTex(geqDen, "s");
    divGeq.innerHTML =
      "<div style=\"overflow-x:auto;\">$$G_{eq}(s) = \\dfrac{C(s)G(s)}{1+C(s)G(s)} = \\dfrac{" + numTex + "}{" + denTex + "}$$</div>";
    typeset(divGeq);
  }
  // Genera un segnale a gradino: 0 prima di t0, ampiezza A da t0 in poi (A=0 se non attivo)
  function segnaleGradino(attivo, ampiezza, t0) {
    if (!attivo) return () => 0;
    return (t) => (t >= t0 ? ampiezza : 0);
  }

  // ---------- Selezione impianto ----------
  function aggiornaVisibilitaImpianto() {
    const massa = selImpianto.value === "massa";
    sezImpiantoMassa.classList.toggle("attiva", massa);
    sezImpiantoGenerico.classList.toggle("attiva", !massa);
  }
  selImpianto.addEventListener("change", () => {
    aggiornaVisibilitaImpianto();
    eseguiCalcolo();
  });

  function leggiImpianto() {
    if (selImpianto.value === "massa") {
      const m = parseFloat(pM.value), b = parseFloat(pB.value), k = parseFloat(pK.value);
      return { num: [1], den: [m, b, k] };
    }
    return { num: leggiVettoreCoeff(pNum.value), den: leggiVettoreCoeff(pDen.value) };
  }
  // ---------- Aggiornamento etichette m/b/k accanto agli slider dell'impianto ----------
  function aggiornaEtichetteImpianto() {
    pMVal.textContent = formattaNumero(parseFloat(pM.value));
    pBVal.textContent = formattaNumero(parseFloat(pB.value));
    pKVal.textContent = formattaNumero(parseFloat(pK.value));
  }

  // ---------- Mostra/nascondi il campo omega per il rumore a sinusoide ----------
  function aggiornaVisibilitaOmegaRumore() {
    nOmegaCampo.style.display = nTipo.value === "sinusoide" ? "inline" : "none";
  }
  nTipo.addEventListener("change", () => {
    aggiornaVisibilitaOmegaRumore();
    eseguiCalcolo();
  });

  // =====================================================================
  // SIMULAZIONE DISCRETA DELL'ANELLO PID
  // =====================================================================
  function simulaAnello(num, den, opzioni) {
    const { Kp, azioneI, Ti, azioneD, Td, rAmpiezza, tEnd, dt, du, dy, n } = opzioni;
    const { A, B, C, D } = CA.tfToSs(num, den);
    const nStati = A.length;
    let x = new Array(nStati).fill(0);
    let integrale = 0;
    let xFiltro = 0; // stato del filtro derivativo (versione passa-basso di e)
    let uPrecedente = 0;

    const f = (xVec, u) => {
      const dx = new Array(nStati).fill(0);
      for (let i = 0; i < nStati; i++) {
        for (let j = 0; j < nStati; j++) dx[i] += A[i][j] * xVec[j];
        dx[i] += B[i] * u;
      }
      return dx;
    };
    const uscitaImpianto = (xVec, u) => {
      let out = 0;
      for (let i = 0; i < nStati; i++) out += C[i] * xVec[i];
      return out + D * u;
    };

    const t = [], yArr = [], rArr = [], uArr = [];
    const nPassi = Math.round(tEnd / dt);
    for (let passo = 0; passo <= nPassi; passo++) {
      const tempo = passo * dt;
      const rVal = rAmpiezza; // riferimento a gradino, sempre attivo da t=0
      const yPulita = uscitaImpianto(x, uPrecedente) + dy(tempo);
      const misura = yPulita + n(tempo);
      const e = rVal - misura;

      integrale += e * dt;
      let der = 0;
      if (azioneD && Td > 0) {
        const a = Td / N_FILTRO_DERIVATIVO;
        xFiltro += (dt * (e - xFiltro)) / a;
        der = (e - xFiltro) / a;
      }

      let uPid = Kp * e;
      if (azioneI && Ti > 0) uPid += (Kp / Ti) * integrale;
      if (azioneD) uPid += Kp * Td * der;

      const uPlant = uPid + du(tempo);

      t.push(tempo);
      yArr.push(yPulita);
      rArr.push(rVal);
      uArr.push(uPlant);

      // avanza lo stato dell'impianto (RK4), ingresso assunto costante nel passo
      const k1 = f(x, uPlant);
      const k2 = f(x.map((xi, i) => xi + (dt / 2) * k1[i]), uPlant);
      const k3 = f(x.map((xi, i) => xi + (dt / 2) * k2[i]), uPlant);
      const k4 = f(x.map((xi, i) => xi + dt * k3[i]), uPlant);
      x = x.map((xi, i) => xi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      uPrecedente = uPlant;
    }

    return { t, y: yArr, r: rArr, u: uArr };
  }

  // ---------- Aggiornamento etichette Ki/Kd e abilitazione slider ----------
  function aggiornaEtichetteRegolatore() {
    const Kp = parseFloat(cKp.value);
    const Ti = parseFloat(cTi.value);
    const Td = parseFloat(cTd.value);
    cKpVal.textContent = formattaNumero(Kp);
    cTiVal.textContent = formattaNumero(Ti);
    cTdVal.textContent = formattaNumero(Td);
    cKiVal.textContent = cAzioneI.checked ? formattaNumero(Kp / Ti) : "0 (I disattivata)";
    cKdVal.textContent = cAzioneD.checked ? formattaNumero(Kp * Td) : "0 (D disattivata)";
    cTi.disabled = !cAzioneI.checked;
    cTd.disabled = !cAzioneD.checked;
  }

  // ---------- Calcolo principale ----------
  function eseguiCalcolo() {
    divErrore.style.display = "none";
    try {
      aggiornaEtichetteImpianto();
      const { num, den } = leggiImpianto();
      mostraFdT(num, den);

      const Kp = leggiNumero(cKp, "Kp");
      const azioneI = cAzioneI.checked;
      const Ti = leggiNumero(cTi, "Ti");
      const azioneD = cAzioneD.checked;
      const Td = leggiNumero(cTd, "Td");
      aggiornaEtichetteRegolatore();

      const rAmpiezza = leggiNumero(cRAmpiezza, "ampiezza di riferimento");
      const tEnd = leggiNumero(cTEnd, "T (finestra di simulazione)");
      if (tEnd <= 0) throw new Error("T deve essere positivo");

      const du = segnaleGradino(duAttivo.checked, leggiNumero(duAmpiezza, "ampiezza d_u"), leggiNumero(duIstante, "istante d_u"));
      const dy = segnaleGradino(dyAttivo.checked, leggiNumero(dyAmpiezza, "ampiezza d_y"), leggiNumero(dyIstante, "istante d_y"));
      let n;
      if (!nAttivo.checked) {
        n = () => 0;
      } else if (nTipo.value === "sinusoide") {
        const ampN = leggiNumero(nAmpiezza, "ampiezza n"), t0N = leggiNumero(nIstante, "istante n"), omegaN = leggiNumero(nOmega, "ω di n");
        n = (t) => (t >= t0N ? ampN * Math.sin(omegaN * t) : 0);
      } else {
        n = segnaleGradino(true, leggiNumero(nAmpiezza, "ampiezza n"), leggiNumero(nIstante, "istante n"));
      }

      mostraGeq(num, den, Kp, azioneI, Ti, azioneD, Td);

      const risultato = simulaAnello(num, den, { Kp, azioneI, Ti, azioneD, Td, rAmpiezza, tEnd, dt: DT_FISSO, du, dy, n });

      CAPlot.plotTime("grafico-risposta", risultato.t, [
        { name: "riferimento r(t)", y: risultato.r, line: { dash: "dot", color: "#9ca3af" } },
        { name: "uscita y(t)", y: risultato.y },
      ]);
      CAPlot.plotTime("grafico-controllo", risultato.t, [
        { name: "controllo u(t)", y: risultato.u, line: { color: "#f59e0b" } },
      ]);

      const errRegime = risultato.r[risultato.r.length - 1] - risultato.y[risultato.y.length - 1];
      let html = "<table><tbody>";
      html += "<tr><th>Tipo regolatore</th><td>" + "P" + (azioneI ? "I" : "") + (azioneD ? "D" : "") + "</td></tr>";
      html += "<tr><th>$K_p$</th><td>" + formattaNumero(Kp) + "</td></tr>";
      html += "<tr><th>$K_i = K_p/T_i$</th><td>" + (azioneI ? formattaNumero(Kp / Ti) : "0 (disattivata)") + "</td></tr>";
      html += "<tr><th>$K_d = K_p\\,T_d$</th><td>" + (azioneD ? formattaNumero(Kp * Td) : "0 (disattivata)") + "</td></tr>";
      html += "<tr><th>Errore a fine simulazione</th><td>" + formattaNumero(errRegime, 5) + "</td></tr>";
      html += "</tbody></table>";
      divParametri.innerHTML = html;
      typeset(divParametri);
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
      divFdtTesto.innerHTML = "";
      divGeq.innerHTML = "";
      divParametri.innerHTML = "";
    }
  }

  // ---------- Preset regolatore ----------
  function applicaPreset(i, d) {
    cAzioneI.checked = i;
    cAzioneD.checked = d;
    eseguiCalcolo();
  }
  document.getElementById("preset-p").addEventListener("click", () => applicaPreset(false, false));
  document.getElementById("preset-pi").addEventListener("click", () => applicaPreset(true, false));
  document.getElementById("preset-pd").addEventListener("click", () => applicaPreset(false, true));
  document.getElementById("preset-pid").addEventListener("click", () => applicaPreset(true, true));

  // ---------- Collegamento eventi live (slider, checkbox, campi) ----------
  [pM, pB, pK, cKp, cTi, cTd].forEach((el) => el.addEventListener("input", eseguiCalcolo));
  [cAzioneI, cAzioneD, duAttivo, dyAttivo, nAttivo].forEach((el) => el.addEventListener("change", eseguiCalcolo));
  [pNum, pDen, cRAmpiezza, cTEnd, duAmpiezza, duIstante, dyAmpiezza, dyIstante, nAmpiezza, nIstante, nOmega].forEach((el) =>
    el.addEventListener("change", eseguiCalcolo)
  );

  // ---------- Esempio precaricato: massa-molla-smorzatore m=b=k=1, PI ----------
  function caricaEsempio() {
    selImpianto.value = "massa";
    pM.value = "1"; pB.value = "1"; pK.value = "1";
    aggiornaVisibilitaImpianto();
    cKp.value = "1";
    cAzioneI.checked = true;
    cTi.value = "1";
    cAzioneD.checked = false;
    cTd.value = "0.1";
    cRAmpiezza.value = "1";
    cTEnd.value = "20";
    duAttivo.checked = false;
    dyAttivo.checked = false;
    nAttivo.checked = false;
    eseguiCalcolo();
  }
  document.getElementById("btn-esempio").addEventListener("click", caricaEsempio);

  // ---------- Stato iniziale della pagina ----------
  aggiornaVisibilitaImpianto();
  aggiornaVisibilitaOmegaRumore();
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
