// ===== app.js — Luogo delle radici =====
(function () {
  const CA = window.CA;

  // ---------- Riferimenti DOM ----------
  const campoNum = document.getElementById("fdt-num");
  const campoDen = document.getElementById("fdt-den");
  const campoKMax = document.getElementById("k-max");
  const sliderK = document.getElementById("k-slider");
  const sliderKVal = document.getElementById("k-slider-val");
  const divErrore = document.getElementById("messaggio-errore");
  const divFdtTesto = document.getElementById("fdt-testo");
  const divPoliChiusi = document.getElementById("poli-chiusi-testo");
  const divGeq = document.getElementById("geq-testo");
  const divRegole = document.getElementById("regole-testo");

  // ---------- Utilità numeriche ----------
  function leggiVettoreCoeff(str) {
    const parti = str.trim().split(/\s+/).filter((s) => s.length > 0);
    const numeri = parti.map(Number);
    if (numeri.length === 0 || numeri.some((x) => Number.isNaN(x))) {
      throw new Error('coefficienti non validi: "' + str + '"');
    }
    return numeri;
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
  function valutaPolinomioReale(p, x) {
    let acc = 0;
    for (const c of p) acc = acc * x + c;
    return acc;
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
    divFdtTesto.innerHTML = "<div style=\"overflow-x:auto;\">$$L(s) = \\dfrac{" + numTex + "}{" + denTex + "}$$</div>";
    typeset(divFdtTesto);
  }
  function normalizzaAngolo(a) {
    while (a > 180) a -= 360;
    while (a <= -180) a += 360;
    return a;
  }
  function angoloVettore(da, a) {
    return (Math.atan2(a.im - da.im, a.re - da.re) * 180) / Math.PI;
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

  // ---------- Traccia il luogo: per ogni K, radici di den + K*num ----------
  function tracciaLuogo(num, den, kMax) {
    const kGriglia = creaGrigliaK(kMax, 400);
    const punti = []; // {re, im, K}
    kGriglia.forEach((K) => {
      const polCaratteristico = CA.polyAdd(
        den,
        num.map((c) => c * K)
      );
      const radici = CA.polyRoots(polCaratteristico);
      radici.forEach((r) => punti.push({ re: r.re, im: r.im, K }));
    });
    return punti;
  }

  // ---------- Poli ad anello chiuso per un K specifico ----------
  function poliAnelloChiuso(num, den, K) {
    const polCaratteristico = CA.polyAdd(
      den,
      num.map((c) => c * K)
    );
    return CA.polyRoots(polCaratteristico);
  }

  // ---------- Calcolo di tutte le regole ----------
  function calcolaRegole(num, den, poliAperti, zeriAperti) {
    const n = poliAperti.length;
    const m = zeriAperti.length;

    // 4) segmenti dell'asse reale che appartengono al luogo
    const singolarita = [];
    poliAperti.forEach((p) => {
      if (Math.abs(p.im) < 1e-7) singolarita.push(p.re);
    });
    zeriAperti.forEach((z) => {
      if (Math.abs(z.im) < 1e-7) singolarita.push(z.re);
    });
    singolarita.sort((a, b) => a - b);
    const segmenti = [];
    for (let i = 0; i <= singolarita.length; i++) {
      const sx = i === 0 ? -Infinity : singolarita[i - 1];
      const dx = i === singolarita.length ? Infinity : singolarita[i];
      let puntoTest;
      if (sx === -Infinity && dx === Infinity) puntoTest = 0;
      else if (sx === -Infinity) puntoTest = dx - 1;
      else if (dx === Infinity) puntoTest = sx + 1;
      else puntoTest = (sx + dx) / 2;
      const numADestra = singolarita.filter((s) => s > puntoTest).length;
      if (numADestra % 2 === 1) segmenti.push([sx, dx]);
    }

    // 5) asintoti: numero, centro stella, angoli
    const numAsintoti = n - m;
    let asintoti = null;
    if (numAsintoti > 0) {
      const sommaPoli = poliAperti.reduce((a, p) => a + p.re, 0);
      const sommaZeri = zeriAperti.reduce((a, z) => a + z.re, 0);
      const centroide = (sommaPoli - sommaZeri) / numAsintoti;
      const angoli = [];
      for (let q = 0; q < numAsintoti; q++) angoli.push(((2 * q + 1) * 180) / numAsintoti);
      asintoti = { centroide, angoli };
    }

    // 6) punti di diramazione: radici reali di num*den' - den*num' con K=-den/num >= 0
    const denD = CA.polyDeriv(den);
    const numD = CA.polyDeriv(num);
    const polyDiramazione = CA.polyAdd(CA.polyMul(num, denD), CA.polyMul(den, numD).map((c) => -c));
    const candidatiDiramazione = CA.polyRoots(polyDiramazione);
    const puntiDiramazione = [];
    candidatiDiramazione.forEach((r) => {
      if (Math.abs(r.im) > 1e-6) return;
      const denVal = valutaPolinomioReale(den, r.re);
      const numVal = valutaPolinomioReale(num, r.re);
      if (Math.abs(numVal) < 1e-9) return;
      const K = -denVal / numVal;
      if (K >= -1e-6) puntiDiramazione.push(r.re);
    });

    // 7) angoli di partenza (poli complessi) e di arrivo (zeri complessi)
    const angoliPartenza = poliAperti
      .filter((p) => p.im > 1e-7)
      .map((p) => {
        // angolo(p_j - x) = angolo del vettore "da x a p_j"
        const sommaZeri = zeriAperti.reduce((a, z) => a + angoloVettore(z, p), 0);
        const sommaAltriPoli = poliAperti.reduce((a, p2) => (p2 === p ? a : a + angoloVettore(p2, p)), 0);
        return { polo: p, angolo: normalizzaAngolo(sommaZeri - sommaAltriPoli - 180) };
      });
    const angoliArrivo = zeriAperti
      .filter((z) => z.im > 1e-7)
      .map((z) => {
        // angolo(z_j - x) = angolo del vettore "da x a z_j"
        const sommaPoli = poliAperti.reduce((a, p) => a + angoloVettore(p, z), 0);
        const sommaAltriZeri = zeriAperti.reduce((a, z2) => (z2 === z ? a : a + angoloVettore(z2, z)), 0);
        return { zero: z, angolo: normalizzaAngolo(180 + sommaPoli - sommaAltriZeri) };
      });

    return { n, m, segmenti, asintoti, puntiDiramazione, angoliPartenza, angoliArrivo };
  }

  // ---------- K critico di attraversamento dell'asse immaginario (stima dalla griglia tracciata) ----------
  function trovaKCritico(puntiLuogo) {
    let kCritico = null;
    puntiLuogo.forEach((p) => {
      if (p.re > 1e-6 && p.K > 1e-9) {
        if (kCritico === null || p.K < kCritico) kCritico = p.K;
      }
    });
    return kCritico;
  }

  // ---------- Estensione degli assi: poco più del valore massimo raggiunto dal luogo (a K massimo) ----------
  // Fissa gli assi sull'estensione effettiva dei dati (poli, zeri, punti tracciati fino a Kmax), non
  // sull'autoscale di Plotly: così il grafico non si "stringe" o "allarga" cambiando K massimo o FdT
  // in modi imprevedibili, e si vede subito quanto si estende davvero il luogo.
  function calcolaEstensioneAssi(poliAperti, zeriAperti, puntiLuogo) {
    let estremo = 1; // minimo di sicurezza
    const considera = (re, im) => {
      estremo = Math.max(estremo, Math.abs(re), Math.abs(im));
    };
    poliAperti.forEach((p) => considera(p.re, p.im));
    zeriAperti.forEach((z) => considera(z.re, z.im));
    puntiLuogo.forEach((p) => considera(p.re, p.im));
    const conMargine = estremo * 1.15;
    return { estremo: conMargine, xrange: [-conMargine, conMargine], yrange: [-conMargine, conMargine] };
  }

  // ---------- Stato corrente (per aggiornare solo l'evidenziazione al variare dello slider) ----------
  let statoCorrente = null; // { num, den, poliAperti, zeriAperti, puntiLuogo, regole, kMax, assi }

  function disegnaGrafico(K) {
    const { num, den, poliAperti, zeriAperti, puntiLuogo, regole, assi } = statoCorrente;
    const serie = [];

    serie.push({
      name: "luogo (K: 0→∞)",
      points: puntiLuogo,
      mode: "markers",
      marker: {
        size: 4,
        color: puntiLuogo.map((p) => p.K),
        colorscale: "Viridis",
        showscale: true,
        colorbar: { title: "K" },
      },
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

    if (regole.asintoti) {
      const { centroide, angoli } = regole.asintoti;
      const lunghezza = assi.estremo * 1.5; // superano il bordo del grafico, che li ritaglia
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

    CAPlot.plotComplex("grafico-luogo", serie, { title: "", xrange: assi.xrange, yrange: assi.yrange });

    divPoliChiusi.innerHTML =
      "<table><tbody><tr><th>K</th><td>" + formattaNumero(K) + "</td></tr><tr><th>Poli</th><td>" +
      poliChiusi.map(formattaComplesso).join(", ") + "</td></tr></tbody></table>";

    mostraGeq(num, den, K);
  }

  // ---------- Funzione di trasferimento del sistema chiuso in retroazione, per il K selezionato ----------
  // Geq(s) = K*L(s) / (1 + K*L(s)) = K*num(s) / (den(s) + K*num(s))
  function mostraGeq(num, den, K) {
    const numChiuso = num.map((c) => c * K);
    const denChiuso = CA.polyAdd(den, numChiuso);
    const numTex = formattaPolinomioTex(numChiuso, "s");
    const denTex = formattaPolinomioTex(denChiuso, "s");
    divGeq.innerHTML =
      "<div style=\"overflow-x:auto;\">$$G_{eq}(s) = \\dfrac{K \\cdot L(s)}{1+K \\cdot L(s)} = \\dfrac{" + numTex +
      "}{" + denTex + "} \\qquad (K=" + formattaNumero(K) + ")$$</div>";
    typeset(divGeq);
  }

  // ---------- Rendering testuale delle regole ----------
  function mostraRegole(regole, kCritico) {
    let html = "<table><tbody>";
    html += "<tr><th>1. Numero di rami</th><td>" + regole.n + " (quanti sono i poli ad anello aperto)</td></tr>";
    html +=
      "<tr><th>2. Partenza / arrivo</th><td>i " + regole.n + " rami partono (K=0) dai poli ad anello aperto; " +
      regole.m + " arrivano (K→∞) agli zeri ad anello aperto; i restanti " + (regole.n - regole.m) +
      " vanno all'infinito lungo gli asintoti.</td></tr>";
    html += "<tr><th>3. Simmetria</th><td>il luogo è simmetrico rispetto all'asse reale.</td></tr>";

    const segmentiTxt = regole.segmenti.length
      ? regole.segmenti
          .map(
            (s) =>
              "[" + (s[0] === -Infinity ? "−∞" : formattaNumero(s[0])) + ", " +
              (s[1] === Infinity ? "+∞" : formattaNumero(s[1])) + "]"
          )
          .join(", ")
      : "nessuno";
    html += "<tr><th>4. Segmenti sull'asse reale</th><td>" + segmentiTxt + "</td></tr>";

    if (regole.asintoti) {
      html +=
        "<tr><th>5. Asintoti</th><td>" + (regole.n - regole.m) + " asintoti, angoli " +
        regole.asintoti.angoli.map((a) => formattaNumero(a) + "°").join(" / ") + ", centro stella σ=" +
        formattaNumero(regole.asintoti.centroide) + "</td></tr>";
    } else {
      html += "<tr><th>5. Asintoti</th><td>nessuno (grado relativo nullo)</td></tr>";
    }

    html +=
      "<tr><th>6. Punti di diramazione</th><td>" +
      (regole.puntiDiramazione.length ? regole.puntiDiramazione.map((p) => formattaNumero(p)).join(", ") : "nessuno") +
      '<br /><span style="font-size:0.8rem; color:#6b7280;">(formula non trattata a lezione — calcolo non richiesto)</span>' +
      "</td></tr>";

    const partenzaTxt = regole.angoliPartenza.length
      ? regole.angoliPartenza.map((a) => formattaComplesso(a.polo) + " → " + formattaNumero(a.angolo) + "°").join("; ")
      : "nessun polo complesso";
    const arrivoTxt = regole.angoliArrivo.length
      ? regole.angoliArrivo.map((a) => formattaComplesso(a.zero) + " → " + formattaNumero(a.angolo) + "°").join("; ")
      : "nessuno zero complesso";
    html +=
      "<tr><th>7. Angoli di partenza/arrivo</th><td>partenza: " + partenzaTxt + "<br />arrivo: " + arrivoTxt +
      "</td></tr>";

    html +=
      "<tr><th>Stabilità</th><td>" +
      (kCritico !== null
        ? "il sistema resta stabile per K &lt; " + formattaNumero(kCritico) +
          "; oltre, almeno un polo attraversa l'asse immaginario e il sistema diventa instabile."
        : "nell'intervallo di K tracciato il sistema resta sempre asintoticamente stabile.") +
      "</td></tr>";

    html += "</tbody></table>";
    divRegole.innerHTML = html;
  }

  // ---------- Calcolo principale ----------
  function eseguiCalcolo() {
    divErrore.style.display = "none";
    try {
      const num = leggiVettoreCoeff(campoNum.value);
      const den = leggiVettoreCoeff(campoDen.value);
      const kMax = parseFloat(campoKMax.value);
      if (Number.isNaN(kMax) || kMax <= 0) throw new Error("K massimo deve essere un numero positivo");

      const poliAperti = CA.polyRoots(den);
      const zeriAperti = CA.polyRoots(num);
      if (poliAperti.length === 0) throw new Error("il denominatore deve avere almeno un polo");

      const puntiLuogo = tracciaLuogo(num, den, kMax);
      const regole = calcolaRegole(num, den, poliAperti, zeriAperti);
      const kCritico = trovaKCritico(puntiLuogo);
      const assi = calcolaEstensioneAssi(poliAperti, zeriAperti, puntiLuogo);

      statoCorrente = { num, den, poliAperti, zeriAperti, puntiLuogo, regole, kMax, assi };

      sliderK.max = String(kMax);
      if (parseFloat(sliderK.value) > kMax) sliderK.value = "0";
      sliderKVal.textContent = formattaNumero(parseFloat(sliderK.value));

      mostraFdT(num, den);
      disegnaGrafico(parseFloat(sliderK.value));
      mostraRegole(regole, kCritico);
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
      divFdtTesto.innerHTML = "";
      divPoliChiusi.innerHTML = "";
      divGeq.innerHTML = "";
      divRegole.innerHTML = "";
    }
  }

  sliderK.addEventListener("input", () => {
    sliderKVal.textContent = formattaNumero(parseFloat(sliderK.value));
    if (statoCorrente) disegnaGrafico(parseFloat(sliderK.value));
  });

  // ---------- Esempio precaricato: L(s) = 1/(s(s+1)(s+2)) ----------
  function caricaEsempio() {
    campoNum.value = "1";
    campoDen.value = "1 3 2 0";
    campoKMax.value = "50";
    sliderK.value = "0";
    eseguiCalcolo();
  }

  document.getElementById("btn-calcola").addEventListener("click", eseguiCalcolo);
  document.getElementById("btn-esempio").addEventListener("click", caricaEsempio);

  // ---------- Stato iniziale della pagina ----------
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
