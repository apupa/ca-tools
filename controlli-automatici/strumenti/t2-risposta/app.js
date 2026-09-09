// ===== app.js — Risposta nel tempo e modi =====
(function () {
  const CA = window.CA;

  // ---------- Riferimenti DOM ----------
  const campoNum = document.getElementById("fdt-num");
  const campoDen = document.getElementById("fdt-den");
  const selIngresso = document.getElementById("tipo-ingresso");
  const campoOmegaDiv = document.getElementById("campo-omega");
  const campoOmega = document.getElementById("omega-sinusoide");
  const campoAmpiezza = document.getElementById("ampiezza-ingresso");
  const campoTEnd = document.getElementById("t-end");
  const divErrore = document.getElementById("messaggio-errore");
  const divTabellaModi = document.getElementById("tabella-modi");
  const divNotaIngresso = document.getElementById("nota-ingresso");
  const divFdtTesto = document.getElementById("fdt-testo");

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

  // ---------- Passo di integrazione: fisso, non modificabile dall'utente ----------
  const DT_FISSO = 0.0005;

  // ---------- Segnali di ingresso u(t), di ampiezza A ----------
  function costruisciIngresso(tipo, A, omega, dt) {
    if (tipo === "impulso") {
      const eps = dt; // impulso stretto: area A concentrata in un passo di integrazione
      return (t) => (t >= 0 && t < eps ? A / eps : 0);
    }
    if (tipo === "gradino") return (t) => (t >= 0 ? A : 0);
    if (tipo === "rampa") return (t) => (t >= 0 ? A * t : 0);
    if (tipo === "sinusoide") return (t) => (t >= 0 ? A * Math.sin(omega * t) : 0);
    return () => 0;
  }

  // ---------- Raggruppa i poli/residui in modi (accoppia le coppie complesse coniugate) ----------
  function raggruppaModi(residui) {
    const usati = new Array(residui.length).fill(false);
    const gruppi = [];
    for (let i = 0; i < residui.length; i++) {
      if (usati[i]) continue;
      const polo = residui[i].pole;
      if (Math.abs(polo.im) < 1e-7) {
        gruppi.push({ tipo: "reale", polo, residuo: residui[i].residue });
        usati[i] = true;
        continue;
      }
      let j = -1;
      for (let k = i + 1; k < residui.length; k++) {
        if (!usati[k] && Math.abs(residui[k].pole.re - polo.re) < 1e-6 && Math.abs(residui[k].pole.im + polo.im) < 1e-6) {
          j = k;
          break;
        }
      }
      if (j >= 0) {
        usati[i] = true;
        usati[j] = true;
        const rappresentante = polo.im > 0 ? residui[i] : residui[j];
        gruppi.push({ tipo: "complesso", polo: rappresentante.pole, residuo: rappresentante.residue });
      } else {
        // coniugato non trovato (caso limite numerico): trattato come singolo
        gruppi.push({ tipo: "complesso", polo, residuo: residui[i].residue });
        usati[i] = true;
      }
    }
    return gruppi;
  }

  function classificaModo(gruppo) {
    const sigma = gruppo.polo.re;
    if (gruppo.tipo === "reale") {
      let descrizione;
      if (sigma < -1e-9) descrizione = "esponenziale convergente";
      else if (sigma > 1e-9) descrizione = "esponenziale divergente";
      else descrizione = "modo costante";
      const poloTxt = String(formattaNumero(sigma));
      const formula = "e^{" + formattaNumero(sigma) + "t}";
      const residuoTxt = String(formattaNumero(gruppo.residuo.re));
      return { poloTxt, descrizione, formula, residuoTxt };
    }
    const omega = Math.abs(gruppo.polo.im);
    let descrizione;
    if (sigma < -1e-9) descrizione = "oscillazione smorzata";
    else if (sigma > 1e-9) descrizione = "oscillazione divergente";
    else descrizione = "oscillazione persistente (ampiezza costante)";
    const poloTxt = formattaNumero(sigma) + " \\pm j" + formattaNumero(omega);
    const formula = "e^{" + formattaNumero(sigma) + "t}\\cos(" + formattaNumero(omega) + "t + \\varphi)";
    const residuoTxt = formattaComplesso(gruppo.residuo);
    return { poloTxt, descrizione, formula, residuoTxt };
  }

  // ---------- Tabella dei modi + verdetto di stabilità del sistema ----------
  // Il sistema (non il singolo modo) è instabile se almeno un polo ha parte reale positiva
  // (modo divergente); altrimenti è stabile (risposta limitata, anche nel caso limite di poli
  // semplici sull'asse immaginario).
  function mostraTabellaModi(residui) {
    const gruppi = raggruppaModi(residui);
    let html = "<table><thead><tr>";
    html += "<th>Polo</th><th>Tipo di modo</th><th>Formula</th><th>Residuo</th>";
    html += "</tr></thead><tbody>";
    gruppi.forEach((g) => {
      const r = classificaModo(g);
      html +=
        "<tr><td>$" + r.poloTxt + "$</td><td>" + r.descrizione + "</td><td>$" + r.formula + "$</td><td>" +
        r.residuoTxt + "</td></tr>";
    });
    html += "</tbody></table>";

    const instabile = residui.some((r) => r.pole.re > 1e-9);
    html += instabile
      ? '<p style="color:#b91c1c; font-weight:600;">Il sistema è instabile.</p>'
      : '<p style="font-weight:600;">Il sistema è stabile.</p>';

    divTabellaModi.innerHTML = html;
    if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([divTabellaModi]);
  }

  // ---------- Mostra/nascondi il campo ω per la sinusoide ----------
  function aggiornaVisibilitaOmega() {
    campoOmegaDiv.style.display = selIngresso.value === "sinusoide" ? "block" : "none";
  }
  selIngresso.addEventListener("change", aggiornaVisibilitaOmega);

  // ---------- Calcolo principale ----------
  function eseguiCalcolo() {
    divErrore.style.display = "none";
    try {
      const num = leggiVettoreCoeff(campoNum.value);
      const den = leggiVettoreCoeff(campoDen.value);
      mostraFdT(num, den);

      const tEnd = parseFloat(campoTEnd.value);
      if (Number.isNaN(tEnd) || tEnd <= 0) {
        throw new Error("t_fin deve essere un numero positivo");
      }
      const dt = DT_FISSO;

      const tipo = selIngresso.value;
      const A = parseFloat(campoAmpiezza.value);
      if (Number.isNaN(A)) throw new Error("l'ampiezza A deve essere un numero");
      const omega = parseFloat(campoOmega.value) || 1;
      const uFunc = costruisciIngresso(tipo, A, omega, dt);

      const { t, y } = CA.simulate(num, den, uFunc, tEnd, dt);

      const etichette = {
        impulso: "impulso di area A=" + A,
        gradino: "gradino di ampiezza A=" + A,
        rampa: "rampa di pendenza A=" + A,
        sinusoide: "sinusoide A·sin(ωt), A=" + A + ", ω=" + omega + " rad/s",
      };

      // Per l'impulso l'ingresso u(t) ha ampiezza istantanea A/Δt (es. 200 per A=1, Δt=0.005):
      // sovrapposto a y(t) schiaccerebbe la scala del grafico, quindi si mostra solo la risposta.
      const serie = [{ name: "uscita y(t)", y: y }];
      if (tipo !== "impulso") {
        const uVals = t.map(uFunc);
        serie.unshift({ name: "ingresso u(t)", y: uVals, line: { dash: "dot", color: "#9ca3af" } });
        divNotaIngresso.textContent = "Ingresso: " + etichette[tipo] + ".";
      } else {
        divNotaIngresso.textContent =
          "Ingresso: " + etichette[tipo] + " (non mostrato in grafico: la sua ampiezza istantanea, A/Δt, schiaccerebbe la scala di y(t)).";
      }
      CAPlot.plotTime("grafico-risposta", t, serie);

      const residui = CA.residues(num, den);
      mostraTabellaModi(residui);
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
    }
  }

  // ---------- Esempio precaricato: Circuito RC, FdT 1/(s+1), gradino di ampiezza 1 ----------
  function caricaEsempio() {
    campoNum.value = "1";
    campoDen.value = "1 1";
    selIngresso.value = "gradino";
    campoAmpiezza.value = "1";
    campoTEnd.value = "5";
    aggiornaVisibilitaOmega();
    eseguiCalcolo();
  }

  document.getElementById("btn-calcola").addEventListener("click", eseguiCalcolo);
  document.getElementById("btn-esempio").addEventListener("click", caricaEsempio);

  // ---------- Stato iniziale della pagina ----------
  aggiornaVisibilitaOmega();
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
