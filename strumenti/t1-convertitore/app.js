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

  // ---------- Forme equivalenti della FdT ----------
  // Stessa funzione, tre scritture: polinomiale, poli-zeri (radici) e
  // costanti di tempo. Gli studenti incontrano tutte e tre, quindi le
  // mostriamo affiancate a partire dagli stessi numeri.

  // Termine "+ 0.5s" / "- s" / "+ 3": il coefficiente 1 non si scrive davanti
  // alla variabile, ma un termine noto pari a 1 si scrive.
  function terminePiu(valore, corpo) {
    const c = formattaNumero(valore);
    const segno = c >= 0 ? "+ " : "- ";
    const a = Math.abs(c);
    if (corpo === "") return segno + a;
    return segno + (a === 1 ? "" : String(a)) + corpo;
  }

  // "(s + 2)" a partire dalla radice r, cioe' il fattore (s - r).
  function fattoreRadiceTex(r) {
    const a = formattaNumero(-r);
    if (a === 0) return "s";
    return "(s " + terminePiu(a, "") + ")";
  }

  // "(s^2 + 2s + 5)" per una coppia complessa coniugata.
  function fattoreCoppiaTex(c) {
    return (
      "(s^{2} " + terminePiu(-2 * c.re, "s") + " " +
      terminePiu(c.re * c.re + c.im * c.im, "") + ")"
    );
  }

  // "(1 + 0.5s)" a partire dalla costante di tempo.
  function fattoreTauTex(tau) {
    return "(1 " + terminePiu(tau, "s") + ")";
  }

  // "(1 + 0.08s + 0.04s^2)" per una coppia complessa, cioe' la forma
  // 1 + 2*delta/omega_n*s + s^2/omega_n^2 con i numeri gia' svolti.
  function fattoreSecondoTex(c) {
    return (
      "(1 " + terminePiu((2 * c.delta) / c.omegaN, "s") + " " +
      terminePiu(1 / (c.omegaN * c.omegaN), "s^{2}") + ")"
    );
  }

  function potenzaSTex(h) {
    if (h <= 0) return "";
    return h === 1 ? "s" : "s^{" + h + "}";
  }

  // Assembla "K \dfrac{fattori sopra}{fattori sotto}", omettendo il guadagno
  // se vale 1 e mettendo 1 dove non c'e' alcun fattore.
  function frazioneTex(k, sopra, sotto) {
    const kf = formattaNumero(k);
    let testa = "";
    if (kf === -1 && (sopra.length || sotto.length)) testa = "-";
    else if (kf !== 1) testa = String(kf) + "\\,";
    const su = sopra.length ? sopra.join("") : "1";
    const giu = sotto.length ? sotto.join("") : "1";
    if (giu === "1") return testa === "" ? su : testa + su;
    return testa + "\\dfrac{" + su + "}{" + giu + "}";
  }

  function formaPoliZeriTex(pz) {
    const sopra = [];
    const sotto = [];
    if (pz.sNum > 0) sopra.push(potenzaSTex(pz.sNum));
    if (pz.sDen > 0) sotto.push(potenzaSTex(pz.sDen));
    pz.zeriReali.forEach((r) => sopra.push(fattoreRadiceTex(r)));
    pz.zeriCoppie.forEach((c) => sopra.push(fattoreCoppiaTex(c)));
    pz.poliReali.forEach((r) => sotto.push(fattoreRadiceTex(r)));
    pz.poliCoppie.forEach((c) => sotto.push(fattoreCoppiaTex(c)));
    return frazioneTex(pz.k, sopra, sotto);
  }

  function formaCostantiTempoTex(ct) {
    const sopra = [];
    const sotto = [];
    // h > 0: poli nell'origine (sotto); h < 0: zeri nell'origine (sopra).
    if (ct.h > 0) sotto.push(potenzaSTex(ct.h));
    if (ct.h < 0) sopra.push(potenzaSTex(-ct.h));
    ct.tauZeri.forEach((t) => sopra.push(fattoreTauTex(t)));
    ct.secondiZeri.forEach((c) => sopra.push(fattoreSecondoTex(c)));
    ct.tauPoli.forEach((t) => sotto.push(fattoreTauTex(t)));
    ct.secondiPoli.forEach((c) => sotto.push(fattoreSecondoTex(c)));
    return frazioneTex(ct.k, sopra, sotto);
  }

  // Tabellina di supporto: costanti di tempo, pulsazioni naturali, smorzamenti.
  function tabellaCostantiTempo(ct) {
    const righe = [];
    const elenco = (valori) => valori.map((v) => formattaNumero(v)).join(", ");
    if (ct.tauZeri.length) righe.push(["Costanti di tempo degli zeri", elenco(ct.tauZeri) + " s"]);
    if (ct.tauPoli.length) righe.push(["Costanti di tempo dei poli", elenco(ct.tauPoli) + " s"]);
    ct.secondiZeri.forEach((c) => {
      righe.push(["Coppia di zeri complessi", "ω<sub>n</sub> = " + formattaNumero(c.omegaN) + " rad/s, δ = " + formattaNumero(c.delta)]);
    });
    ct.secondiPoli.forEach((c) => {
      righe.push(["Coppia di poli complessi", "ω<sub>n</sub> = " + formattaNumero(c.omegaN) + " rad/s, δ = " + formattaNumero(c.delta)]);
    });
    const tipo = ct.h > 0 ? ct.h : 0;
    righe.push(["Tipo del sistema (poli nell'origine)", String(tipo)]);
    righe.push([
      "Guadagno di Bode K",
      formattaNumero(ct.k) + (ct.h === 0 ? " (coincide con G(0))" : ""),
    ]);
    if (!righe.length) return "";
    return (
      "<table><tbody>" +
      righe.map((r) => "<tr><th>" + r[0] + "</th><td>" + r[1] + "</td></tr>").join("") +
      "</tbody></table>"
    );
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

    const forme = CA.formeFdT(fdt.num, fdt.den);

    html += '<div class="pannello"><h2>Funzione di trasferimento</h2>';
    html += "<p><strong>Forma polinomiale</strong></p>";
    html += '<div class="blocco-formula">$$G(s) = \\dfrac{' + numTex + "}{" + denTex + "}$$</div>";
    html += "<p><strong>Forma poli-zeri</strong> (fattorizzata nelle radici, guadagno $K$)</p>";
    html += '<div class="blocco-formula">$$G(s) = ' + formaPoliZeriTex(forme.poliZeri) + "$$</div>";
    html += "<p><strong>Forma con le costanti di tempo</strong> (quella usata per i diagrammi di Bode)</p>";
    html += '<div class="blocco-formula">$$G(s) = ' + formaCostantiTempoTex(forme.costantiTempo) + "$$</div>";
    html += tabellaCostantiTempo(forme.costantiTempo);
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
