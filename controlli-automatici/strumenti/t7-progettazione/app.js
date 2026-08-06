// ===== app.js — Progettazione del controllore (specifiche + confronto luogo delle radici) =====
(function () {
  const CA = window.CA;

  // ---------- Riferimenti DOM (comuni) ----------
  const campoGNum = document.getElementById("g-num");
  const campoGDen = document.getElementById("g-den");
  const campoCNum = document.getElementById("c-num");
  const campoCDen = document.getElementById("c-den");
  const campoKMax = document.getElementById("k-max");
  const campoTResp = document.getElementById("t-risposta");
  const selSpecStatica = document.getElementById("spec-statica");
  const taAttivo = document.getElementById("ta-attivo");
  const taValore = document.getElementById("ta-valore");
  const sAttivo = document.getElementById("s-attivo");
  const sValore = document.getElementById("s-valore");
  const divErrore = document.getElementById("messaggio-errore");

  // ---------- Utilità numeriche ----------
  function leggiVettoreCoeff(str) {
    const parti = str.trim().split(/\s+/).filter((s) => s.length > 0);
    const numeri = parti.map(Number);
    if (numeri.length === 0 || numeri.some((x) => Number.isNaN(x))) {
      throw new Error('coefficienti non validi: "' + str + '"');
    }
    return numeri;
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

  // ---------- Griglia di K: densa vicino a 0 (lineare), poi logaritmica fino a Kmax ----------
  function creaGrigliaK(kMax, punti) {
    const nLin = Math.floor(punti * 0.35);
    const nLog = punti - nLin;
    const kGinocchio = Math.max(kMax / 20, 1e-3);
    const griglia = [0];
    for (let i = 1; i < nLin; i++) griglia.push((kGinocchio * i) / (nLin - 1));
    const logMin = Math.log10(kGinocchio);
    const logMax = Math.log10(kMax);
    for (let i = 1; i < nLog; i++) {
      griglia.push(Math.pow(10, logMin + ((logMax - logMin) * i) / (nLog - 1)));
    }
    return griglia;
  }

  function tracciaLuogo(num, den, kMax) {
    const kGriglia = creaGrigliaK(kMax, 400);
    const punti = []; // {re, im, K}
    kGriglia.forEach((K) => {
      const polCaratteristico = CA.polyAdd(den, num.map((c) => c * K));
      const radici = CA.polyRoots(polCaratteristico);
      radici.forEach((r) => punti.push({ re: r.re, im: r.im, K }));
    });
    return punti;
  }

  function poliAnelloChiuso(num, den, K) {
    const polCaratteristico = CA.polyAdd(den, num.map((c) => c * K));
    return CA.polyRoots(polCaratteristico);
  }

  // ---------- Asintoti (servono solo per disegnarli nel grafico) ----------
  function calcolaAsintoti(poliAperti, zeriAperti) {
    const numAsintoti = poliAperti.length - zeriAperti.length;
    if (numAsintoti <= 0) return null;
    const sommaPoli = poliAperti.reduce((a, p) => a + p.re, 0);
    const sommaZeri = zeriAperti.reduce((a, z) => a + z.re, 0);
    const centroide = (sommaPoli - sommaZeri) / numAsintoti;
    const angoli = [];
    for (let q = 0; q < numAsintoti; q++) angoli.push(((2 * q + 1) * 180) / numAsintoti);
    return { centroide, angoli };
  }

  function calcolaEstensioneAssi(poliAperti, zeriAperti, puntiLuogo) {
    let estremo = 1;
    const considera = (re, im) => { estremo = Math.max(estremo, Math.abs(re), Math.abs(im)); };
    poliAperti.forEach((p) => considera(p.re, p.im));
    zeriAperti.forEach((z) => considera(z.re, z.im));
    puntiLuogo.forEach((p) => considera(p.re, p.im));
    const conMargine = estremo * 1.15;
    return { estremo: conMargine, xrange: [-conMargine, conMargine], yrange: [-conMargine, conMargine] };
  }

  // ---------- Specifiche statiche: tipo del sistema (numero di poli in s=0 di L(s)) ----------
  function contaPoliOrigine(den) {
    let k = 0;
    for (let i = den.length - 1; i >= 0 && Math.abs(den[i]) < 1e-9; i--) k++;
    return k;
  }
  const TIPO_RICHIESTO = { nessuna: 0, posizione: 1, velocita: 2, accelerazione: 3 };
  const ETICHETTA_SPEC_STATICA = {
    nessuna: "nessuna specifica di errore a regime",
    posizione: "errore di posizione nullo (riferimento a gradino)",
    velocita: "errore di velocità nullo (riferimento a rampa)",
    accelerazione: "errore di accelerazione nullo (riferimento a parabola)",
  };

  // ---------- Specifiche dinamiche: da S% a zeta_min (forma chiusa) ----------
  function zetaDaSovraelongazione(sPercento) {
    if (sPercento <= 0) return 1;
    if (sPercento >= 100) return 0;
    const L = Math.log(sPercento / 100);
    return Math.abs(L) / Math.sqrt(Math.PI * Math.PI + L * L);
  }

  function leggiVincoliDinamici() {
    const vincoli = { sigmaMin: null, thetaMaxDeg: null };
    if (taAttivo.checked) {
      const Ta = leggiNumero(taValore, "T_a massimo");
      if (Ta <= 0) throw new Error("T_a massimo deve essere positivo");
      vincoli.sigmaMin = 3 / Ta;
    }
    if (sAttivo.checked) {
      const S = leggiNumero(sValore, "sovraelongazione massima");
      if (S < 0) throw new Error("la sovraelongazione massima non può essere negativa");
      const zetaMin = zetaDaSovraelongazione(S);
      vincoli.thetaMaxDeg = (Math.acos(zetaMin) * 180) / Math.PI;
    }
    return vincoli;
  }

  // ---------- Geometria della regione ammessa: intersezione di semipiani (a*x+b*y<=c) ----------
  function valSemipiano(pt, hp) { return hp.a * pt.re + hp.b * pt.im - hp.c; }
  function clipPoligono(poligono, hp) {
    if (poligono.length === 0) return poligono;
    const ris = [];
    const n = poligono.length;
    for (let i = 0; i < n; i++) {
      const cur = poligono[i];
      const prev = poligono[(i - 1 + n) % n];
      const fCur = valSemipiano(cur, hp);
      const fPrev = valSemipiano(prev, hp);
      const curDentro = fCur <= 1e-9;
      const prevDentro = fPrev <= 1e-9;
      if (curDentro) {
        if (!prevDentro) {
          const t = fPrev / (fPrev - fCur);
          ris.push({ re: prev.re + t * (cur.re - prev.re), im: prev.im + t * (cur.im - prev.im) });
        }
        ris.push(cur);
      } else if (prevDentro) {
        const t = fPrev / (fPrev - fCur);
        ris.push({ re: prev.re + t * (cur.re - prev.re), im: prev.im + t * (cur.im - prev.im) });
      }
    }
    return ris;
  }
  // Vincoli come semipiani: sigma (x <= -sigmaMin) e cono di smorzamento (due rette per l'origine)
  function semipianiVincoli(vincoli) {
    const hp = [];
    if (vincoli.sigmaMin !== null) hp.push({ a: 1, b: 0, c: -vincoli.sigmaMin });
    if (vincoli.thetaMaxDeg !== null) {
      const tanTheta = Math.tan((vincoli.thetaMaxDeg * Math.PI) / 180);
      hp.push({ a: tanTheta, b: 1, c: 0 }); // y <= -tanTheta * x
      hp.push({ a: tanTheta, b: -1, c: 0 }); // y >= tanTheta * x
    }
    return hp;
  }
  function calcolaRegioneAmmessa(vincoli, estremo) {
    let poligono = [
      { re: -estremo, im: -estremo }, { re: estremo, im: -estremo },
      { re: estremo, im: estremo }, { re: -estremo, im: estremo },
    ];
    semipianiVincoli(vincoli).forEach((hp) => { poligono = clipPoligono(poligono, hp); });
    return poligono;
  }
  function poloDentroVincoli(polo, vincoli) {
    return semipianiVincoli(vincoli).every((hp) => valSemipiano(polo, hp) <= 1e-6);
  }

  // ---------- Factory: una colonna di confronto (proporzionale / con controllore) ----------
  function creaColonna(suffisso, simboloL) {
    const sliderK = document.getElementById("k-slider-" + suffisso);
    const sliderKVal = document.getElementById("k-slider-val-" + suffisso);
    const divFdtTesto = document.getElementById("fdt-testo-" + suffisso);
    const divPoliChiusi = document.getElementById("poli-chiusi-testo-" + suffisso);
    const divGeq = document.getElementById("geq-testo-" + suffisso);
    const divSpecifiche = document.getElementById("specifiche-testo-" + suffisso);
    const divSpecificheDinamiche = document.getElementById("specifiche-dinamiche-testo-" + suffisso);
    const idGrafico = "grafico-luogo-" + suffisso;
    const idGraficoRisposta = "grafico-risposta-" + suffisso;
    let stato = null; // { num, den, poliAperti, zeriAperti, puntiLuogo, asintoti, kMax, assi, vincoli, tResp }

    function mostraFdT(num, den) {
      const numTex = formattaPolinomioTex(num, "s");
      const denTex = formattaPolinomioTex(den, "s");
      divFdtTesto.innerHTML =
        "<div style=\"overflow-x:auto;\">$$" + simboloL + "(s) = \\dfrac{" + numTex + "}{" + denTex + "}$$</div>";
      typeset(divFdtTesto);
    }

    function mostraGeq(numChiuso, denChiuso, K) {
      const numTex = formattaPolinomioTex(numChiuso, "s");
      const denTex = formattaPolinomioTex(denChiuso, "s");
      divGeq.innerHTML =
        "<div style=\"overflow-x:auto;\">$$G_{eq}(s) = \\dfrac{K \\cdot " + simboloL + "(s)}{1+K \\cdot " + simboloL +
        "(s)} = \\dfrac{" + numTex + "}{" + denTex + "} \\qquad (K=" + formattaNumero(K) + ")$$</div>";
      typeset(divGeq);
    }

    function mostraSpecifiche(den, specStaticaVal) {
      const tipo = contaPoliOrigine(den);
      const richiesto = TIPO_RICHIESTO[specStaticaVal];
      const soddisfatta = tipo >= richiesto;
      let html = "Tipo del sistema (poli in $s=0$ di " + simboloL + "(s)): <strong>" + tipo + "</strong>.";
      if (richiesto > 0) {
        html +=
          " Specifica statica (" + ETICHETTA_SPEC_STATICA[specStaticaVal] + "): " +
          '<span class="' + (soddisfatta ? "verdetto-ok" : "verdetto-no") + '">' +
          (soddisfatta ? "SODDISFATTA" : "NON SODDISFATTA — serve almeno tipo " + richiesto) + "</span>.";
      } else {
        html += " Nessuna specifica statica richiesta.";
      }
      divSpecifiche.innerHTML = html;
      typeset(divSpecifiche);
    }

    function mostraVerdettoDinamico(poliChiusi, vincoli) {
      if (vincoli.sigmaMin === null && vincoli.thetaMaxDeg === null) {
        divSpecificheDinamiche.innerHTML = "Nessuna specifica dinamica attiva.";
        return;
      }
      const tutteDentro = poliChiusi.every((p) => poloDentroVincoli(p, vincoli));
      divSpecificheDinamiche.innerHTML =
        "Specifiche dinamiche per questo $K$: " +
        '<span class="' + (tutteDentro ? "verdetto-ok" : "verdetto-no") + '">' +
        (tutteDentro ? "SODDISFATTE" : "NON SODDISFATTE") +
        "</span> — criterio: tutti i poli ad anello chiuso devono cadere nella regione gialla.";
      typeset(divSpecificheDinamiche);
    }

    function mostraRisposta(numChiuso, denChiuso, K, tResp) {
      const passi = 1000;
      const dt = tResp / passi;
      const { t, y } = CA.simulate(numChiuso, denChiuso, () => 1, tResp, dt);
      CAPlot.plotTime(idGraficoRisposta, t, [
        { name: "riferimento", y: t.map(() => 1), line: { dash: "dot", color: "#9ca3af" } },
        { name: "y(t), K=" + formattaNumero(K), y, line: { color: "#2563eb" } },
      ]);
    }

    function disegnaGrafico(K) {
      const { num, den, poliAperti, zeriAperti, puntiLuogo, asintoti, assi, vincoli, tResp } = stato;
      const serie = [];

      // regione ammessa dalle specifiche dinamiche (disegnata per prima, sotto a tutto il resto)
      if (vincoli.sigmaMin !== null || vincoli.thetaMaxDeg !== null) {
        const poligono = calcolaRegioneAmmessa(vincoli, assi.estremo);
        if (poligono.length >= 3) {
          serie.push({
            name: "regione ammessa",
            showlegend: true,
            points: poligono.concat([poligono[0]]),
            mode: "lines",
            line: { width: 0 },
            fill: "toself",
            fillcolor: "rgba(234,179,8,0.2)",
          });
        }
      }
      // linea del vincolo su T_a (blu tratteggiata) e cono del vincolo su S% (rosso tratteggiato)
      if (vincoli.sigmaMin !== null) {
        serie.push({
          name: "vincolo Ta",
          showlegend: true,
          points: [
            { re: -vincoli.sigmaMin, im: -assi.estremo },
            { re: -vincoli.sigmaMin, im: assi.estremo },
          ],
          mode: "lines",
          line: { dash: "dash", color: "#2563eb", width: 2 },
        });
      }
      if (vincoli.thetaMaxDeg !== null) {
        const raggio = assi.estremo * 1.5;
        [180 - vincoli.thetaMaxDeg, 180 + vincoli.thetaMaxDeg].forEach((ang, i) => {
          const rad = (ang * Math.PI) / 180;
          serie.push({
            name: "vincolo S%",
            showlegend: i === 0,
            points: [
              { re: 0, im: 0 },
              { re: raggio * Math.cos(rad), im: raggio * Math.sin(rad) },
            ],
            mode: "lines",
            line: { dash: "dash", color: "#dc2626", width: 2 },
          });
        });
      }

      serie.push({
        name: "luogo (K: 0→∞)",
        points: puntiLuogo,
        mode: "markers",
        marker: { size: 4, color: puntiLuogo.map((p) => p.K), colorscale: "Viridis", showscale: true, colorbar: { title: "K" } },
      });
      serie.push({
        name: "poli ad anello aperto",
        points: poliAperti,
        mode: "markers",
        marker: { symbol: "x", size: 12, color: "#111827" },
      });
      serie.push({
        name: "zeri ad anello aperto",
        points: zeriAperti,
        mode: "markers",
        marker: { symbol: "circle-open", size: 12, color: "#111827", line: { width: 2 } },
      });

      if (asintoti) {
        const { centroide, angoli } = asintoti;
        const lunghezza = assi.estremo * 1.5;
        angoli.forEach((ang, i) => {
          const rad = (ang * Math.PI) / 180;
          serie.push({
            name: "asintoti",
            showlegend: i === 0,
            points: [
              { re: centroide, im: 0 },
              { re: centroide + lunghezza * Math.cos(rad), im: lunghezza * Math.sin(rad) },
            ],
            mode: "lines",
            line: { dash: "dash", color: "#9ca3af" },
          });
        });
      }

      const poliChiusi = poliAnelloChiuso(num, den, K);
      serie.push({
        name: "poli ad anello chiuso (K=" + formattaNumero(K) + ")",
        points: poliChiusi,
        mode: "markers",
        marker: { symbol: "star", size: 14, color: "#dc2626" },
      });

      CAPlot.plotComplex(idGrafico, serie, { title: "", xrange: assi.xrange, yrange: assi.yrange });

      divPoliChiusi.innerHTML =
        "<table><tbody><tr><th>K</th><td>" + formattaNumero(K) + "</td></tr><tr><th>Poli</th><td>" +
        poliChiusi.map(formattaComplesso).join(", ") + "</td></tr></tbody></table>";

      const numChiuso = num.map((c) => c * K);
      const denChiuso = CA.polyAdd(den, numChiuso);
      mostraGeq(numChiuso, denChiuso, K);
      mostraVerdettoDinamico(poliChiusi, vincoli);
      mostraRisposta(numChiuso, denChiuso, K, tResp);
    }

    function calcola(num, den, kMax, specStaticaVal, vincoli, tResp) {
      const poliAperti = CA.polyRoots(den);
      const zeriAperti = CA.polyRoots(num);
      if (poliAperti.length === 0) throw new Error(simboloL + "(s) deve avere almeno un polo");

      const puntiLuogo = tracciaLuogo(num, den, kMax);
      const asintoti = calcolaAsintoti(poliAperti, zeriAperti);
      const assi = calcolaEstensioneAssi(poliAperti, zeriAperti, puntiLuogo);

      stato = { num, den, poliAperti, zeriAperti, puntiLuogo, asintoti, kMax, assi, vincoli, tResp };

      sliderK.max = String(kMax);
      if (parseFloat(sliderK.value) > kMax) sliderK.value = "0";
      sliderKVal.textContent = formattaNumero(parseFloat(sliderK.value));

      mostraFdT(num, den);
      mostraSpecifiche(den, specStaticaVal);
      disegnaGrafico(parseFloat(sliderK.value));
    }

    function pulisci() {
      divFdtTesto.innerHTML = "";
      divPoliChiusi.innerHTML = "";
      divGeq.innerHTML = "";
      divSpecifiche.innerHTML = "";
      divSpecificheDinamiche.innerHTML = "";
    }

    sliderK.addEventListener("input", () => {
      sliderKVal.textContent = formattaNumero(parseFloat(sliderK.value));
      if (stato) disegnaGrafico(parseFloat(sliderK.value));
    });

    return { calcola, pulisci };
  }

  const colonnaProporzionale = creaColonna("prima", "L");
  const colonnaConControllore = creaColonna("dopo", "L");

  // ---------- Calcolo principale ----------
  function eseguiCalcolo() {
    divErrore.style.display = "none";
    try {
      const gNum = leggiVettoreCoeff(campoGNum.value);
      const gDen = leggiVettoreCoeff(campoGDen.value);
      const cNum = leggiVettoreCoeff(campoCNum.value);
      const cDen = leggiVettoreCoeff(campoCDen.value);
      const kMax = parseFloat(campoKMax.value);
      if (Number.isNaN(kMax) || kMax <= 0) throw new Error("K massimo deve essere un numero positivo");
      const tResp = parseFloat(campoTResp.value);
      if (Number.isNaN(tResp) || tResp <= 0) throw new Error("la finestra di risposta T deve essere un numero positivo");

      const vincoli = leggiVincoliDinamici();
      const specStaticaVal = selSpecStatica.value;

      colonnaProporzionale.calcola(gNum, gDen, kMax, specStaticaVal, vincoli, tResp);

      const lNum = CA.polyMul(cNum, gNum);
      const lDen = CA.polyMul(cDen, gDen);
      colonnaConControllore.calcola(lNum, lDen, kMax, specStaticaVal, vincoli, tResp);
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
      colonnaProporzionale.pulisci();
      colonnaConControllore.pulisci();
    }
  }

  document.getElementById("btn-calcola").addEventListener("click", eseguiCalcolo);

  // ---------- Esempio precaricato: G(s) = 1/(s(s+1)(s+2)), C'(s) = rete anticipatrice (s+2)/(s+10) ----------
  function caricaEsempio() {
    campoGNum.value = "1";
    campoGDen.value = "1 3 2 0";
    campoCNum.value = "1 2";
    campoCDen.value = "1 10";
    campoKMax.value = "50";
    campoTResp.value = "10";
    selSpecStatica.value = "posizione";
    taAttivo.checked = true;
    taValore.value = "5";
    sAttivo.checked = true;
    sValore.value = "20";
    eseguiCalcolo();
  }
  document.getElementById("btn-esempio").addEventListener("click", caricaEsempio);

  // ---------- Stato iniziale della pagina ----------
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
