// ===== app.js — Convertitore ISU ↔ IU ↔ FdT =====
// NB: la conversione interna (Faddeev–LeVerrier / forma companion) resta
// nascosta: qui mostriamo solo i risultati formattati.
(function () {
  const CA = window.CA;

  // ---------- Riferimenti DOM ----------
  const selModello = document.getElementById("modello-partenza");
  const sezioni = {
    isu: document.getElementById("sezione-isu"),
    iu: document.getElementById("sezione-iu"),
    fdt: document.getElementById("sezione-fdt"),
  };
  const isuOrdine = document.getElementById("isu-ordine");
  const isuGriglie = document.getElementById("isu-griglie");
  const divRisultati = document.getElementById("risultati");
  const divErrore = document.getElementById("messaggio-errore");

  // ---------- Mostra solo la sezione del modello scelto ----------
  function mostraSezione(nome) {
    Object.keys(sezioni).forEach((k) => sezioni[k].classList.toggle("attiva", k === nome));
  }
  selModello.addEventListener("change", () => mostraSezione(selModello.value));

  // ---------- Costruzione dinamica della griglia ISU (A, B, C, D) ----------
  function costruisciGrigliaISU(n) {
    let html = '<p><strong>Matrice A</strong> (' + n + '×' + n + ")</p>";
    html += '<div class="griglia-matrice" style="--n-colonne:' + n + ';">';
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const v = i === j ? -1 : 0;
        html += '<input type="text" id="A_' + i + "_" + j + '" value="' + v + '" />';
      }
    }
    html += "</div>";

    html += '<p><strong>Vettore B</strong> (' + n + "×1)</p>";
    html += '<div class="griglia-matrice" style="--n-colonne:1;">';
    for (let i = 0; i < n; i++) {
      html += '<input type="text" id="B_' + i + '" value="' + (i === n - 1 ? 1 : 0) + '" />';
    }
    html += "</div>";

    html += '<p><strong>Vettore C</strong> (1×' + n + ")</p>";
    html += '<div class="griglia-matrice" style="--n-colonne:' + n + ';">';
    for (let j = 0; j < n; j++) {
      html += '<input type="text" id="C_' + j + '" value="' + (j === 0 ? 1 : 0) + '" />';
    }
    html += "</div>";

    html += '<p><strong>Scalare D</strong></p>';
    html += '<div class="griglia-matrice" style="--n-colonne:1;">';
    html += '<input type="text" id="D_scalare" value="0" />';
    html += "</div>";

    isuGriglie.innerHTML = html;
  }
  isuOrdine.addEventListener("change", () => costruisciGrigliaISU(parseInt(isuOrdine.value, 10)));

  // ---------- Lettura dati dai campi ----------
  function leggiVettoreCoeff(str) {
    const parti = str.trim().split(/\s+/).filter((s) => s.length > 0);
    const numeri = parti.map(Number);
    if (numeri.length === 0 || numeri.some((x) => Number.isNaN(x))) {
      throw new Error("coefficienti non validi: \"" + str + "\"");
    }
    return numeri;
  }

  function leggiISU() {
    const n = parseInt(isuOrdine.value, 10);
    const A = [], B = [], C = [];
    for (let i = 0; i < n; i++) {
      const riga = [];
      for (let j = 0; j < n; j++) {
        const el = document.getElementById("A_" + i + "_" + j);
        const v = parseFloat(el.value);
        if (Number.isNaN(v)) throw new Error("valore non valido in A[" + i + "," + j + "]");
        riga.push(v);
      }
      A.push(riga);
    }
    for (let i = 0; i < n; i++) {
      const v = parseFloat(document.getElementById("B_" + i).value);
      if (Number.isNaN(v)) throw new Error("valore non valido in B[" + i + "]");
      B.push(v);
    }
    for (let j = 0; j < n; j++) {
      const v = parseFloat(document.getElementById("C_" + j).value);
      if (Number.isNaN(v)) throw new Error("valore non valido in C[" + j + "]");
      C.push(v);
    }
    const D = parseFloat(document.getElementById("D_scalare").value);
    if (Number.isNaN(D)) throw new Error("valore non valido in D");
    return { A, B, C, D };
  }

  // ---------- Formattazione numeri e polinomi in LaTeX ----------
  function formattaNumero(x) {
    if (Math.abs(x) < 1e-9) x = 0;
    const r = Math.round(x * 10000) / 10000;
    return r === 0 ? 0 : r; // evita "-0"
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

  // Costruisce il lato di un'equazione differenziale, es. "\dot{y}(t) + y(t)"
  function formattaDerivataTex(coeffs, simbolo) {
    const grado = coeffs.length - 1;
    const termini = [];
    coeffs.forEach((c, i) => {
      const g = grado - i;
      const cf = formattaNumero(c);
      if (cf === 0) return;
      const segno = cf < 0 ? "-" : termini.length ? "+" : "";
      const abs = Math.abs(cf);
      const coeffStr = abs === 1 ? "" : String(abs) + "\\,";
      let derivata;
      if (g === 0) derivata = simbolo + "(t)";
      else if (g === 1) derivata = "\\dot{" + simbolo + "}(t)";
      else if (g === 2) derivata = "\\ddot{" + simbolo + "}(t)";
      else derivata = simbolo + "^{(" + g + ")}(t)";
      termini.push(segno + coeffStr + derivata);
    });
    return termini.length ? termini.join(" ") : "0";
  }

  function formattaMatriceTex(M) {
    // M: array di array (n righe)
    const righe = M.map((r) => r.map((v) => formattaNumero(v)).join(" & "));
    return "\\begin{bmatrix}" + righe.join(" \\\\ ") + "\\end{bmatrix}";
  }
  function formattaVettColTex(v) {
    return "\\begin{bmatrix}" + v.map((x) => formattaNumero(x)).join(" \\\\ ") + "\\end{bmatrix}";
  }
  function formattaVettRigaTex(v) {
    return "\\begin{bmatrix}" + v.map((x) => formattaNumero(x)).join(" & ") + "\\end{bmatrix}";
  }

  function formattaComplesso(c) {
    const re = formattaNumero(c.re);
    const im = formattaNumero(c.im);
    if (im === 0) return String(re);
    const segno = im > 0 ? "+" : "-";
    const absIm = Math.abs(im);
    const imStr = absIm === 1 ? "j" : absIm + "j";
    return re + " " + segno + " " + imStr;
  }

  // ---------- Guadagno statico G(0) (se definito) ----------
  function guadagnoStatico(num, den) {
    const denCost = den[den.length - 1];
    const numCost = num.length ? num[num.length - 1] : 0;
    if (Math.abs(denCost) < 1e-9) return null; // polo nell'origine: non definito
    return numCost / denCost;
  }

  // ---------- Esecuzione conversione ----------
  function eseguiConversione() {
    divErrore.style.display = "none";
    try {
      const modello = selModello.value;
      let fdt, isu, iu;

      if (modello === "isu") {
        const { A, B, C, D } = leggiISU();
        fdt = CA.ssToTf(A, B, C, D);
        isu = { A, B, C, D }; // mostriamo l'ISU così come inserita dall'utente
        iu = CA.tfToIu(fdt.num, fdt.den);
      } else if (modello === "iu") {
        const a = leggiVettoreCoeff(document.getElementById("iu-a").value);
        const b = leggiVettoreCoeff(document.getElementById("iu-b").value);
        fdt = CA.iuToTf(a, b);
        iu = { a, b }; // mostriamo la IU così come inserita dall'utente
        isu = CA.tfToSs(fdt.num, fdt.den);
      } else {
        const num = leggiVettoreCoeff(document.getElementById("fdt-num").value);
        const den = leggiVettoreCoeff(document.getElementById("fdt-den").value);
        fdt = { num, den };
        isu = CA.tfToSs(fdt.num, fdt.den);
        iu = CA.tfToIu(fdt.num, fdt.den);
      }

      const poli = CA.polyRoots(fdt.den);
      const zeri = CA.polyRoots(fdt.num);
      const guadagno = guadagnoStatico(fdt.num, fdt.den);

      // Salva la FdT per riuso negli altri strumenti (es. T2 "Usa l'ultima FdT")
      try {
        localStorage.setItem("ca_ultima_fdt", JSON.stringify({ num: fdt.num, den: fdt.den }));
      } catch (e) {
        /* localStorage non disponibile: non blocca la conversione */
      }

      mostraRisultati({ fdt, isu, iu, poli, zeri, guadagno });
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
      divRisultati.innerHTML = "";
    }
  }

  // ---------- Rendering risultati ----------
  function mostraRisultati({ fdt, isu, iu, poli, zeri, guadagno }) {
    const numTex = formattaPolinomioTex(fdt.num, "s");
    const denTex = formattaPolinomioTex(fdt.den, "s");

    const poliTxt = poli.length ? poli.map(formattaComplesso).join(", ") : "nessuno";
    const zeriTxt = zeri.length ? zeri.map(formattaComplesso).join(", ") : "nessuno";
    const guadagnoTxt = guadagno === null ? "non definito (polo nell'origine)" : String(formattaNumero(guadagno));

    let html = "";

    html += '<div class="pannello"><h2>Funzione di trasferimento</h2>';
    html += '<div class="blocco-formula">$$G(s) = \\dfrac{' + numTex + "}{" + denTex + "}$$</div>";
    html += "</div>";

    html += '<div class="pannello"><h2>Rappresentazione ISU</h2>';
    html += '<div class="blocco-formula">$$\\dot{x}(t) = A\\,x(t) + B\\,u(t), \\qquad y(t) = C\\,x(t) + D\\,u(t)$$</div>';
    html +=
      '<div class="blocco-formula">$$A = ' +
      formattaMatriceTex(isu.A) +
      ", \\quad B = " +
      formattaVettColTex(isu.B) +
      ", \\quad C = " +
      formattaVettRigaTex(isu.C) +
      ", \\quad D = " +
      formattaNumero(isu.D) +
      "$$</div>";
    html += "</div>";

    html += '<div class="pannello"><h2>Rappresentazione IU</h2>';
    html +=
      '<div class="blocco-formula">$$' +
      formattaDerivataTex(iu.a, "y") +
      " = " +
      formattaDerivataTex(iu.b, "u") +
      "$$</div>";
    html += "</div>";

    html += '<div class="pannello"><h2>Poli, zeri e guadagno</h2><table><tbody>';
    html += "<tr><th>Poli</th><td>" + poliTxt + "</td></tr>";
    html += "<tr><th>Zeri</th><td>" + zeriTxt + "</td></tr>";
    html += "<tr><th>Guadagno statico G(0)</th><td>" + guadagnoTxt + "</td></tr>";
    html += "</tbody></table></div>";

    divRisultati.innerHTML = html;

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([divRisultati]);
    }
  }

  // ---------- Esempio precaricato: Circuito RC, FdT 1/(s+1) ----------
  function caricaEsempio() {
    selModello.value = "fdt";
    mostraSezione("fdt");
    document.getElementById("fdt-num").value = "1";
    document.getElementById("fdt-den").value = "1 1";
    eseguiConversione();
  }

  document.getElementById("btn-converti").addEventListener("click", eseguiConversione);
  document.getElementById("btn-esempio").addEventListener("click", caricaEsempio);

  // ---------- Stato iniziale della pagina ----------
  costruisciGrigliaISU(parseInt(isuOrdine.value, 10));
  mostraSezione(selModello.value);
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
