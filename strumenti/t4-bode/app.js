// ===== app.js — Diagrammi di Bode con decomposizione nei termini elementari =====
(function () {
  const CA = window.CA;

  // ---------- Riferimenti DOM ----------
  const campoNum = document.getElementById("fdt-num");
  const campoDen = document.getElementById("fdt-den");
  const campoOmegaMin = document.getElementById("omega-min");
  const campoOmegaMax = document.getElementById("omega-max");
  const divErrore = document.getElementById("messaggio-errore");
  const divFdtTesto = document.getElementById("fdt-testo");
  const divListaTermini = document.getElementById("lista-termini");
  const divTabellaSomma = document.getElementById("tabella-somma");

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
  // c·s^p con il coefficiente davanti, come si scrive nella forma di Bode
  // (0.1 s, 0.25 s^2); con coefficiente 1 resta solo s^p.
  function termineSTex(c, p) {
    const sp = "s" + (p === 1 ? "" : "^{" + p + "}");
    const k = formattaNumero(c);
    return k === 1 ? sp : k + "\\," + sp;
  }

  // Fattore elementare in forma di Bode, senza l'esponente ±1:
  // (1 ± τ s) per il reale, (1 ± 2δ/ω_n s + 1/ω_n^2 s^2) per il complesso,
  // con i coefficienti gia' calcolati.
  function fattoreBodeTex(t) {
    if (t.tipo === "reale") {
      return "\\left(1 " + (t.T > 0 ? "+" : "-") + " " + termineSTex(Math.abs(t.T), 1) + "\\right)";
    }
    const medio = formattaNumero((2 * t.zeta) / t.omegan);
    const parteMedia = medio === 0 ? "" : (medio > 0 ? " + " : " - ") + termineSTex(Math.abs(medio), 1);
    return "\\left(1" + parteMedia + " + " + termineSTex(1 / (t.omegan * t.omegan), 2) + "\\right)";
  }

  // Prodotto dei fattori, con quelli ripetuti raccolti in una potenza.
  function prodottoFattoriTex(termini) {
    const conteggio = [];
    termini.forEach(function (t) {
      const tex = fattoreBodeTex(t);
      const gia = conteggio.find(function (c) { return c.tex === tex; });
      if (gia) gia.n++;
      else conteggio.push({ tex: tex, n: 1 });
    });
    return conteggio.map(function (c) { return c.tex + (c.n > 1 ? "^{" + c.n + "}" : ""); }).join("");
  }

  // G(s) scomposta nei termini elementari di Bode: K, s^h, zeri e poli
  // reali e complessi.
  function formaFattorizzataTex(K, h, termini) {
    // I termini arrivano gia' ordinati da decomponiBode.
    const zeri = termini.filter(function (t) { return t.esponente > 0; });
    const poli = termini.filter(function (t) { return t.esponente < 0; });
    const potenzaS = function (p) { return p === 0 ? "" : "s" + (p === 1 ? "" : "^{" + p + "}"); };
    const sopra = potenzaS(Math.max(h, 0)) + prodottoFattoriTex(zeri);
    const sotto = potenzaS(Math.max(-h, 0)) + prodottoFattoriTex(poli);
    const k = formattaNumero(K);
    let fattorizzata = k === 1 ? "" : k === -1 ? "-" : k + "\\,";
    if (sotto) fattorizzata += "\\dfrac{" + (sopra || "1") + "}{" + sotto + "}";
    else fattorizzata += sopra || (k === 1 || k === -1 ? "1" : "");
    return fattorizzata;
  }

  // G(s) come rapporto di polinomi e, accanto, in forma fattorizzata.
  function mostraFdT(num, den, K, h, termini) {
    const numTex = formattaPolinomioTex(num, "s");
    const denTex = formattaPolinomioTex(den, "s");
    const fattorizzata = formaFattorizzataTex(K, h, termini);
    // Le due forme sono due blocchi affiancati: stanno sulla stessa riga
    // finche' c'e' spazio e vanno a capo solo su schermi stretti.
    const blocco = function (tex) { return "<div>\\(\\displaystyle " + tex + "\\)</div>"; };
    divFdtTesto.innerHTML = '<div class="formula-a-capo">' +
      blocco("G(s) = \\dfrac{" + numTex + "}{" + denTex + "}") +
      blocco("= " + fattorizzata) + "</div>";
    typeset(divFdtTesto);
  }
  function sommaArray(arrs) {
    const n = arrs[0].length;
    const r = new Array(n).fill(0);
    arrs.forEach((a) => {
      for (let i = 0; i < n; i++) r[i] += a[i];
    });
    return r;
  }
  // Rende continua (senza salti di 360°) una sequenza di fasi in gradi, ancorando il primo
  // campione al valore atteso (calcolato analiticamente dalla somma dei termini).
  function sfasaContinuo(faseGradi, faseAttesaIniziale) {
    const out = faseGradi.slice();
    if (faseAttesaIniziale !== undefined) {
      while (out[0] - faseAttesaIniziale > 180) out[0] -= 360;
      while (out[0] - faseAttesaIniziale < -180) out[0] += 360;
    }
    for (let i = 1; i < out.length; i++) {
      while (out[i] - out[i - 1] > 180) out[i] -= 360;
      while (out[i] - out[i - 1] < -180) out[i] += 360;
    }
    return out;
  }

  // ---------- Griglia di pulsazioni logaritmica ----------
  function creaGrigliaOmega(omegaMin, omegaMax, punti) {
    const logMin = Math.log10(omegaMin);
    const logMax = Math.log10(omegaMax);
    const w = [];
    for (let i = 0; i < punti; i++) {
      w.push(Math.pow(10, logMin + ((logMax - logMin) * i) / (punti - 1)));
    }
    return w;
  }

  // Le pulsazioni su cui vale la pena tabulare la somma: gli estremi
  // dell'intervallo, le decadi intere che ci stanno dentro, i punti di
  // rottura di ogni termine (spigoli dell'ampiezza) e gli estremi delle
  // rampe di fase (spigoli della fase). Sono le stesse che si userebbero
  // per tracciare il diagramma a mano.
  function pulsazioniNotevoli(omegaMin, omegaMax, termini, h) {
    const punti = [omegaMin, omegaMax];
    for (let e = Math.ceil(Math.log10(omegaMin)); e <= Math.floor(Math.log10(omegaMax)); e++) {
      punti.push(Math.pow(10, e));
    }
    // Il termine nell'origine non ha punto di rottura: la sua retta passa
    // per 0 dB in omega = 1, che e' gia' fra le decadi.
    termini.forEach(function (t) {
      const rottura = t.tipo === "reale" ? 1 / Math.abs(t.T) : t.omegan;
      const banda = t.tipo === "reale" ? 10 : Math.pow(4.81, Math.abs(t.zeta));
      [rottura / banda, rottura, rottura * banda].forEach(function (om) {
        if (om >= omegaMin && om <= omegaMax) punti.push(om);
      });
    });
    punti.sort(function (a, b) { return a - b; });
    // Due punti a meno di un millesimo di decade l'uno dall'altro sono lo
    // stesso punto (es. un polo esattamente su una decade).
    return punti.filter(function (om, i) {
      return i === 0 || Math.abs(Math.log10(om / punti[i - 1])) > 1e-3;
    });
  }

  // =====================================================================
  // DECOMPOSIZIONE NEI TERMINI ELEMENTARI DI BODE
  // =====================================================================
  // G(s) = K * s^h * prod (1+T_i s)^{±1} * prod (1+2ζ_i/ωni s + s²/ωni²)^{±1}
  // h>0: zeri nell'origine; h<0: poli nell'origine.
  function decomponiBode(num, den) {
    const n = CA.polyStripLeadingZeros(num.slice());
    const d = CA.polyStripLeadingZeros(den.slice());

    function contaZeriFinali(p) {
      let c = 0;
      for (let i = p.length - 1; i >= 0 && Math.abs(p[i]) < 1e-9; i--) c++;
      return c;
    }
    const z0 = contaZeriFinali(n);
    const g = contaZeriFinali(d);
    const nR = z0 > 0 ? n.slice(0, n.length - z0) : n.slice();
    const dR = g > 0 ? d.slice(0, d.length - g) : d.slice();
    const h = z0 - g;

    // Guadagno di Bode: rapporto dei termini costanti dei polinomi ridotti (radici nell'origine escluse)
    const K = nR[nR.length - 1] / dR[dR.length - 1];

    function raggruppaRadici(radici, esponente) {
      const usati = new Array(radici.length).fill(false);
      const termini = [];
      for (let i = 0; i < radici.length; i++) {
        if (usati[i]) continue;
        const r = radici[i];
        if (Math.abs(r.im) < 1e-7) {
          termini.push({ tipo: "reale", esponente, T: -1 / r.re, radiceRe: r.re });
          usati[i] = true;
          continue;
        }
        let j = -1;
        for (let k = i + 1; k < radici.length; k++) {
          if (!usati[k] && Math.abs(radici[k].re - r.re) < 1e-6 && Math.abs(radici[k].im + r.im) < 1e-6) {
            j = k;
            break;
          }
        }
        const rappresentante = j >= 0 && r.im < 0 ? radici[j] : r;
        const omegan = Math.hypot(rappresentante.re, rappresentante.im);
        const zeta = -rappresentante.re / omegan;
        termini.push({ tipo: "complesso", esponente, omegan, zeta });
        usati[i] = true;
        if (j >= 0) usati[j] = true;
      }
      return termini;
    }

    const terminiZeri = raggruppaRadici(CA.polyRoots(nR), 1);
    const terminiPoli = raggruppaRadici(CA.polyRoots(dR), -1);

    // Prima gli zeri e poi i poli, ciascuno in ordine di pulsazione di
    // rottura: e' l'ordine in cui si legge la forma fattorizzata di G(s), e
    // le schede dei termini e le colonne della tabella lo seguono.
    const rottura = function (t) { return t.tipo === "reale" ? 1 / Math.abs(t.T) : t.omegan; };
    const perRottura = function (a, b) { return rottura(a) - rottura(b); };
    return { K, h, termini: terminiZeri.sort(perRottura).concat(terminiPoli.sort(perRottura)) };
  }

  // ---------- Contributo (ampiezza dB, fase gradi, reale e asintotico) di ciascun tipo di termine ----------
  function contributoGuadagno(K, w) {
    const magVal = 20 * Math.log10(Math.abs(K));
    const faseVal = K >= 0 ? 0 : 180;
    return {
      magDb: w.map(() => magVal),
      phaseDeg: w.map(() => faseVal),
      magAsintDb: w.map(() => magVal),
      phaseAsintDeg: w.map(() => faseVal),
    };
  }

  function contributoOrigine(h, w) {
    return {
      magDb: w.map((om) => 20 * h * Math.log10(om)),
      phaseDeg: w.map(() => h * 90),
      magAsintDb: w.map((om) => 20 * h * Math.log10(om)),
      phaseAsintDeg: w.map(() => h * 90),
    };
  }

  function contributoReale(termine, w) {
    const { esponente: e, T } = termine;
    const omega0 = 1 / Math.abs(T);
    const s = e * (T < 0 ? -1 : 1);
    const magDb = w.map((om) => e * 10 * Math.log10(1 + om * om * T * T));
    const phaseDeg = w.map((om) => (e * Math.atan2(om * T, 1) * 180) / Math.PI);
    const magAsintDb = w.map((om) => (om <= omega0 ? 0 : e * 20 * Math.log10(om / omega0)));
    const phaseAsintDeg = w.map((om) => {
      if (om <= omega0 / 10) return 0;
      if (om >= omega0 * 10) return s * 90;
      return s * 45 * (1 + Math.log10(om / omega0));
    });
    return { magDb, phaseDeg, magAsintDb, phaseAsintDeg };
  }

  function contributoComplesso(termine, w) {
    const { esponente: e, omegan, zeta } = termine;
    const magDb = w.map((om) => {
      const x = 1 - (om * om) / (omegan * omegan);
      const y = (2 * zeta * om) / omegan;
      return e * 20 * Math.log10(Math.hypot(x, y));
    });
    const phaseDeg = w.map((om) => {
      const x = 1 - (om * om) / (omegan * omegan);
      const y = (2 * zeta * om) / omegan;
      return (e * Math.atan2(y, x) * 180) / Math.PI;
    });
    const magAsintDb = w.map((om) => (om <= omegan ? 0 : e * 40 * Math.log10(om / omegan)));
    const larghezza = Math.pow(4.81, Math.abs(zeta));
    const omegaA = omegan / larghezza;
    const omegaB = omegan * larghezza;
    const s = e * (zeta < 0 ? -1 : 1);
    const phaseAsintDeg = w.map((om) => {
      if (om <= omegaA) return 0;
      if (om >= omegaB) return s * 180;
      return (s * 180 * (Math.log10(om) - Math.log10(omegaA))) / (Math.log10(omegaB) - Math.log10(omegaA));
    });
    return { magDb, phaseDeg, magAsintDb, phaseAsintDeg };
  }

  function contributoTermine(termine, w) {
    return termine.tipo === "reale" ? contributoReale(termine, w) : contributoComplesso(termine, w);
  }

  // ---------- Descrizione testuale sintetica di ciascun termine ----------
  function descriviTermine(t) {
    const tipoTxt = t.esponente > 0 ? "Zero" : "Polo";
    if (t.tipo === "reale") {
      const tau = Math.abs(t.T);
      const omega0 = 1 / tau;
      const log0 = Math.log10(omega0);
      const omegaA = omega0 / 10; // una decade prima del punto di rottura
      const omegaB = omega0 * 10; // una decade dopo
      const pendenza = t.esponente * 20;
      const segnoFase = t.esponente * (t.T < 0 ? -1 : 1);
      const direzioneFase = segnoFase > 0 ? "0° a +90°" : "0° a −90°";
      return (
        tipoTxt + " reale in $\\omega_0 = 1/\\tau = " + formattaNumero(omega0) + "$ rad/s ($\\tau = " +
        formattaNumero(t.T) + "$ s): ampiezza costante fino al punto di rottura, poi pendenza " +
        (pendenza > 0 ? "+" : "") + pendenza + " dB/dec. " +
        "Sull'asse logaritmico il punto di rottura cade in $\\log_{10}\\omega_0 = -\\log_{10}|\\tau| = " +
        formattaNumero(log0) + "$. " +
        "Fase da " + direzioneFase + ": l'approssimazione asintotica la fa variare linearmente fra gli " +
        "estremi che si ottengono sommando e sottraendo 1, perché una decade vale esattamente $\\pm1$ " +
        "in $\\log_{10}\\omega$: $\\log_{10}\\omega_a = \\log_{10}\\omega_0 - 1 = " +
        formattaNumero(log0 - 1) + "$ e $\\log_{10}\\omega_b = \\log_{10}\\omega_0 + 1 = " +
        formattaNumero(log0 + 1) + "$, passando per $\\pm45$° in $\\omega_0$. " +
        "In pulsazioni: $\\omega_a = " + formattaNumero(omegaA) + "$ rad/s e $\\omega_b = " +
        formattaNumero(omegaB) + "$ rad/s."
      );
    }
    const omegaN = t.omegan;
    const logN = Math.log10(omegaN);
    // Nel termine reale la spezzata di fase è larga ±1 decade; qui la semi-larghezza non è
    // fissa ma vale |δ|·log10(4.81) ≈ 0.682·|δ| decadi (per δ=0 si annulla: la fase salta di
    // colpo, coerentemente con i poli sull'asse immaginario).
    const semiLarghezza = Math.abs(t.zeta) * Math.log10(4.81);
    const omegaA = omegaN / Math.pow(4.81, Math.abs(t.zeta));
    const omegaB = omegaN * Math.pow(4.81, Math.abs(t.zeta));
    const pendenza = t.esponente * 40;
    const segnoFase = t.esponente * (t.zeta < 0 ? -1 : 1);
    const direzioneFase = segnoFase > 0 ? "0° a +180°" : "0° a −180°";
    return (
      tipoTxt + " complesso coniugato, $\\omega_n = " + formattaNumero(omegaN) + "$ rad/s, $\\delta = " +
      formattaNumero(t.zeta) + "$: ampiezza costante fino a $\\omega_n$, poi pendenza " +
      (pendenza > 0 ? "+" : "") + pendenza + " dB/dec. " +
      "Sull'asse logaritmico il centro cade in $\\log_{10}\\omega_n = " + formattaNumero(logN) + "$. " +
      "Fase da " + direzioneFase + ": qui la spezzata non è larga una decade fissa, quindi invece di " +
      "$\\pm1$ si somma e si sottrae il logaritmo della larghezza di banda, " +
      "$\\log_{10}4.81^{|\\delta|} = |\\delta|\\log_{10}4.81 = " + formattaNumero(semiLarghezza) + "$: " +
      "$\\log_{10}\\omega_a = \\log_{10}\\omega_n - |\\delta|\\log_{10}4.81 = " +
      formattaNumero(logN - semiLarghezza) + "$ e $\\log_{10}\\omega_b = \\log_{10}\\omega_n + " +
      "|\\delta|\\log_{10}4.81 = " + formattaNumero(logN + semiLarghezza) + "$, passando per " +
      (segnoFase > 0 ? "+90°" : "−90°") + " in $\\omega_n$. " +
      "La spezzata è larga $2|\\delta|\\log_{10}4.81 = " + formattaNumero(2 * semiLarghezza) +
      "$ decadi centrate su $\\omega_n$ (nel termine reale erano 2 decadi fisse). " +
      "In pulsazioni: $\\omega_a = " + formattaNumero(omegaA) + "$ rad/s e $\\omega_b = " +
      formattaNumero(omegaB) + "$ rad/s." +
      (semiLarghezza < 1e-9
        ? " Con $\\delta = 0$ la larghezza si annulla: l'approssimazione asintotica fa saltare la fase di colpo in $\\omega_n$."
        : "")
    );
  }

  // ---------- Punti notevoli da segnare sui grafici ----------
  // Ognuno appartiene a UN riquadro: omega_a e omega_b sono gli estremi
  // della spezzata di FASE e non hanno significato sull'ampiezza, dove
  // conta solo il punto di rottura. La quota e' quella della spezzata
  // asintotica, che e' la costruzione che questi punti definiscono.
  function etichettaLog(simbolo, omega) {
    return "log<sub>10</sub>ω" + simbolo + " = " + formattaNumero(Math.log10(omega), 2);
  }

  function riferimentiTermine(t) {
    if (t.tipo === "reale") {
      const omega0 = 1 / Math.abs(t.T);
      const s = t.esponente * (t.T < 0 ? -1 : 1);
      return [
        // ampiezza: solo lo spigolo della spezzata, a 0 dB
        { omega: omega0, riquadro: "ampiezza", y: 0, etichetta: etichettaLog("<sub>0</sub>", omega0) },
        // fase: inizio, meta' e fine della rampa
        { omega: omega0 / 10, riquadro: "fase", y: 0, etichetta: etichettaLog("<sub>a</sub>", omega0 / 10) },
        { omega: omega0, riquadro: "fase", y: s * 45, etichetta: etichettaLog("<sub>0</sub>", omega0) },
        { omega: omega0 * 10, riquadro: "fase", y: s * 90, etichetta: etichettaLog("<sub>b</sub>", omega0 * 10) },
      ];
    }
    if (t.tipo === "complesso") {
      const banda = Math.pow(4.81, Math.abs(t.zeta));
      const s = t.esponente * (t.zeta < 0 ? -1 : 1);
      const rif = [
        { omega: t.omegan, riquadro: "ampiezza", y: 0, etichetta: etichettaLog("<sub>n</sub>", t.omegan) },
        { omega: t.omegan, riquadro: "fase", y: s * 90, etichetta: etichettaLog("<sub>n</sub>", t.omegan) },
      ];
      // Con δ = 0 gli estremi collassano su ω_n: la fase salta di colpo e
      // segnarli sarebbe tre volte lo stesso punto.
      if (banda > 1.001) {
        rif.push({ omega: t.omegan / banda, riquadro: "fase", y: 0, etichetta: etichettaLog("<sub>a</sub>", t.omegan / banda) });
        rif.push({ omega: t.omegan * banda, riquadro: "fase", y: s * 180, etichetta: etichettaLog("<sub>b</sub>", t.omegan * banda) });
      }
      return rif;
    }
    if (t.tipo === "origine") {
      // La retta passa per 0 dB dove il logaritmo si annulla; la fase e'
      // costante e non ha punti notevoli.
      return [{ omega: 1, riquadro: "ampiezza", y: 0, etichetta: "log<sub>10</sub>ω = 0" }];
    }
    return [];
  }

  // Stessa scrittura della forma fattorizzata di G(s): lo zero e' il
  // fattore, il polo e' uno fratto il fattore.
  function formulaTermineTex(t) {
    const base = fattoreBodeTex(t);
    return t.esponente > 0 ? base : "\\dfrac{1}{" + base + "}";
  }

  // ---------- Calcolo principale ----------
  // L'ultimo calcolo riuscito, da cui "Salva come PDF" genera il documento.
  let ultimoCalcolo = null;

  function eseguiCalcolo() {
    divErrore.style.display = "none";
    ultimoCalcolo = null;
    try {
      const num = leggiVettoreCoeff(campoNum.value);
      const den = leggiVettoreCoeff(campoDen.value);
      const omegaMin = parseFloat(campoOmegaMin.value);
      const omegaMax = parseFloat(campoOmegaMax.value);
      if (Number.isNaN(omegaMin) || Number.isNaN(omegaMax) || omegaMin <= 0 || omegaMax <= omegaMin) {
        throw new Error("intervallo di pulsazioni non valido (servono 0 < ω_min < ω_max)");
      }

      const { K, h, termini } = decomponiBode(num, den);
      mostraFdT(num, den, K, h, termini);
      // Le pulsazioni notevoli entrano nella griglia invece di essere
      // valutate a parte: cosi' la tabella legge esattamente gli stessi
      // numeri dei grafici, e gli spigoli delle spezzate asintotiche
      // cadono su punti campionati davvero.
      const notevoli = pulsazioniNotevoli(omegaMin, omegaMax, termini, h);
      const w = creaGrigliaOmega(omegaMin, omegaMax, 300)
        .concat(notevoli)
        .sort(function (a, b) { return a - b; })
        .filter(function (om, i, arr) { return i === 0 || om > arr[i - 1]; });

      // Contributi di ciascun termine (guadagno e origine sempre inclusi nel totale, mostrati come
      // termini solo se non banali: K va sempre mostrato, h solo se diverso da zero)
      const contributi = [contributoGuadagno(K, w)];
      const elencoTermini = [{ tipo: "guadagno", K }];
      // Stesso ordine della forma fattorizzata: K, poi il numeratore (s^h se
      // h > 0, zeri), poi il denominatore (s^|h| se h < 0, poli).
      const aggiungiOrigine = () => {
        contributi.push(contributoOrigine(h, w));
        elencoTermini.push({ tipo: "origine", h });
      };
      if (h > 0) aggiungiOrigine();
      termini.forEach((t, i) => {
        if (h < 0 && t.esponente < 0 && (i === 0 || termini[i - 1].esponente > 0)) aggiungiOrigine();
        contributi.push(contributoTermine(t, w));
        elencoTermini.push(t);
      });
      if (h < 0 && !termini.some((t) => t.esponente < 0)) aggiungiOrigine();

      const magTotEsatto = sommaArray(contributi.map((c) => c.magDb));
      const faseTotEsatta = sommaArray(contributi.map((c) => c.phaseDeg));
      const magTotAsint = sommaArray(contributi.map((c) => c.magAsintDb));
      const faseTotAsint = sommaArray(contributi.map((c) => c.phaseAsintDeg));

      // Verifica diretta: valutazione di G(jω) con CA.freqResp, indipendente dalla decomposizione
      const rispostaDiretta = w.map((om) => CA.freqResp(num, den, om));
      const magDiretta = rispostaDiretta.map((c) => 20 * Math.log10(CA.Cx.abs(c)));
      let faseDiretta = rispostaDiretta.map((c) => (CA.Cx.arg(c) * 180) / Math.PI);
      faseDiretta = sfasaContinuo(faseDiretta, faseTotEsatta[0]);

      mostraTermini(elencoTermini, w, contributi);
      mostraTotale(w, magTotEsatto, faseTotEsatta, magTotAsint, faseTotAsint, magDiretta, faseDiretta, elencoTermini);
      mostraTabellaSomma(w, notevoli, elencoTermini, contributi);
      ultimoCalcolo = { num, den, K, h, termini, elencoTermini, omegaMin, omegaMax, notevoli, w, contributi };
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
      divFdtTesto.innerHTML = "";
      divListaTermini.innerHTML = "";
      divTabellaSomma.innerHTML = "";
    }
  }

  // ---------- Titolo, formula e descrizione di ogni scheda ----------
  // Servono sia alla pagina sia al PDF: la formula e' TeX puro (senza $),
  // la descrizione e' testo con la matematica fra $...$.
  function titoloTermine(t) {
    if (t.tipo === "guadagno") return "Guadagno costante";
    if (t.tipo === "origine") return t.h > 0 ? "Zero nell'origine" : "Polo nell'origine";
    return (t.esponente > 0 ? "Zero" : "Polo") + (t.tipo === "reale" ? " reale" : " complesso coniugato");
  }

  function formulaSchedaTex(t) {
    if (t.tipo === "guadagno") return "K = " + formattaNumero(t.K);
    if (t.tipo === "origine") {
      const sh = "s" + (Math.abs(t.h) === 1 ? "" : "^{" + Math.abs(t.h) + "}");
      return t.h > 0 ? sh : "\\dfrac{1}{" + sh + "}";
    }
    return formulaTermineTex(t);
  }

  function descrizioneScheda(t) {
    if (t.tipo === "guadagno") {
      return "Contributo costante: ampiezza 20·log₁₀|K| = " + formattaNumero(20 * Math.log10(Math.abs(t.K))) +
        " dB su tutte le pulsazioni; fase " + (t.K >= 0 ? "0°" : "180°") + ".";
    }
    if (t.tipo === "origine") {
      return "Retta di pendenza " + 20 * t.h + " dB/dec passante per 0 dB a ω=1 rad/s; fase costante " + t.h * 90 + "°. " +
        "In scala logaritmica $|G|_{dB} = " + 20 * t.h + "\\log_{10}\\omega$: è una retta esatta (non " +
        "un'approssimazione asintotica), che " + (t.h > 0 ? "sale" : "scende") + " di " +
        Math.abs(20 * t.h) + " dB ogni volta che $\\log_{10}\\omega$ aumenta di 1, e vale 0 dB in " +
        "$\\log_{10}\\omega = 0$, cioè in $\\omega = 1$ rad/s.";
    }
    return descriviTermine(t);
  }

  // ---------- Rendering elenco termini ----------
  function mostraTermini(elenco, w, contributi) {
    let html = "";
    elenco.forEach((t, i) => {
      const divId = "termine-" + i + "-plot";
      html +=
        '<div class="pannello scheda-termine"><h3>' + (i + 1) + ". " + titoloTermine(t) + "</h3>" +
        '<p class="descrizione">$' + formulaSchedaTex(t) + "$" +
        "<br />" + descrizioneScheda(t) + "</p>" +
        '<div id="' + divId + '" style="width:100%; height:400px;"></div></div>';
    });
    divListaTermini.innerHTML = html;
    typeset(divListaTermini);

    elenco.forEach((t, i) => {
      const c = contributi[i];
      CAPlot.plotBode(
        "termine-" + i + "-plot", w, c.magDb, c.phaseDeg,
        [{ name: "asintotico", magDb: c.magAsintDb, phaseDeg: c.phaseAsintDeg }],
        riferimentiTermine(t)
      );
    });
  }

  // ---------- Rendering diagramma totale ----------
  function mostraTotale(w, magEsatto, faseEsatta, magAsint, faseAsint, magDiretta, faseDiretta, elenco) {
    const rotture = [];
    (elenco || []).forEach(function (t) {
      let omega = null, simbolo = "";
      if (t.tipo === "reale") { omega = 1 / Math.abs(t.T); simbolo = "<sub>0</sub>"; }
      else if (t.tipo === "complesso") { omega = t.omegan; simbolo = "<sub>n</sub>"; }
      if (omega === null || omega < w[0] || omega > w[w.length - 1]) return;
      const idx = indiceVicino(w, omega);
      rotture.push({ omega: omega, riquadro: "ampiezza", y: magAsint[idx], etichetta: etichettaLog(simbolo, omega) });
      rotture.push({ omega: omega, riquadro: "fase", y: faseAsint[idx], etichetta: etichettaLog(simbolo, omega) });
    });
    rotture.sort(function (a, b) { return a.omega - b.omega; });

    CAPlot.plotBode("grafico-totale", w, magEsatto, faseEsatta, [
      { name: "asintotico", magDb: magAsint, phaseDeg: faseAsint },
      { name: "G(jω) diretto", magDb: magDiretta, phaseDeg: faseDiretta },
    ], rotture);
  }


  // Indice del campione piu' vicino a una pulsazione (le pulsazioni
  // notevoli sono nella griglia, quindi lo scarto e' nullo).
  function indiceVicino(w, omega) {
    let migliore = 0, scarto = Infinity;
    for (let i = 0; i < w.length; i++) {
      const d = Math.abs(Math.log10(w[i] / omega));
      if (d < scarto) { scarto = d; migliore = i; }
    }
    return migliore;
  }

  // ---------- Tabella: la somma dei termini, pulsazione per pulsazione ----------
  // E' il conto che si fa a mano per tracciare il diagramma: incolonnare i
  // contributi ASINTOTICI dei termini e sommarli.
  function nomeBreveTermine(t, i) {
    const n = (i + 1) + ". ";
    if (t.tipo === "guadagno") return n + "K";
    if (t.tipo === "origine") {
      const sh = "s" + (Math.abs(t.h) === 1 ? "" : "<sup>" + Math.abs(t.h) + "</sup>");
      return n + (t.h > 0 ? sh : "1/" + sh);
    }
    const tipo = t.esponente > 0 ? "zero" : "polo";
    if (t.tipo === "reale") return n + tipo + " ω<sub>0</sub>=" + formattaNumero(1 / Math.abs(t.T), 3);
    return n + tipo + " ω<sub>n</sub>=" + formattaNumero(t.omegan, 3);
  }

  // Somma asintotica (ampiezza o fase) valutata su pulsazioni qualsiasi.
  function totaleAsintotico(elenco, ws, chiave) {
    return sommaArray(elenco.map(function (t) {
      if (t.tipo === "guadagno") return contributoGuadagno(t.K, ws)[chiave];
      if (t.tipo === "origine") return contributoOrigine(t.h, ws)[chiave];
      return contributoTermine(t, ws)[chiave];
    }));
  }

  // Vero se la spezzata totale cambia pendenza in omega: confronta la
  // pendenza un millesimo di decade prima e dopo. Cosi' uno zero e un polo
  // nello stesso punto, che si compensano, non vengono evidenziati.
  function cambiaPendenza(elenco, omega, chiave) {
    const q = Math.pow(10, 1e-3);
    const v = totaleAsintotico(elenco, [omega / q, omega, omega * q], chiave);
    return Math.abs((v[2] - v[1]) - (v[1] - v[0])) / 1e-3 > 0.5;
  }

  // I numeri delle due tabelle (ampiezza e fase), gia' arrotondati: la
  // pagina e il PDF li impaginano ciascuno a modo suo.
  function datiTabelle(w, notevoli, elenco, contributi) {
    // Ogni pulsazione notevole e' stata inserita nella griglia: qui se ne
    // ritrova l'indice esatto, senza interpolare.
    const indici = notevoli.map(function (om) { return indiceVicino(w, om); });

    function tabella(titolo, chiave, decimali) {
      const righe = indici.map(function (idx) {
        // Per disegnare la spezzata bastano gli estremi e i punti dove
        // cambia pendenza: quelle righe vengono evidenziate.
        const necessaria = idx === indici[0] || idx === indici[indici.length - 1] ||
          cambiaPendenza(elenco, w[idx], chiave);
        const valori = contributi.map(function (c) { return formattaNumero(c[chiave][idx], decimali); });
        // La somma e' fatta sui valori gia' arrotondati, cosi' la riga
        // torna anche rifacendo il conto a mano su quello che si legge.
        const somma = formattaNumero(valori.reduce(function (a, v) { return a + v; }, 0), decimali);
        return {
          omega: formattaNumero(w[idx], 3), log: formattaNumero(Math.log10(w[idx]), 2),
          valori: valori, somma: somma, necessaria: necessaria,
        };
      });
      return { titolo: titolo, righe: righe };
    }

    return [tabella("Ampiezza [dB]", "magAsintDb", 2), tabella("Fase [°]", "phaseAsintDeg", 1)];
  }

  function mostraTabellaSomma(w, notevoli, elenco, contributi) {
    function costruisci(tab) {
      let html = "<h3>" + tab.titolo + "</h3><div style=\"overflow-x:auto;\"><table><thead><tr>" +
        "<th>ω [rad/s]</th><th>log<sub>10</sub>ω</th>";
      elenco.forEach(function (t, i) {
        html += "<th>" + nomeBreveTermine(t, i) + "</th>";
      });
      html += "<th>Somma</th></tr></thead><tbody>";
      // Davanti ai numeri non negativi un segno invisibile, largo quanto
      // il meno: nelle colonne centrate le cifre restano allineate con
      // quelle dei numeri negativi.
      // (il "-" visibile diventa "−" con segno-meno.js: il segno invisibile e' lo stesso carattere)
      const num = function (v) { return (v >= 0 ? '<span class="segno-fantasma">\u2212</span>' : "") + v; };
      tab.righe.forEach(function (r) {
        html += (r.necessaria ? '<tr class="necessaria">' : "<tr>") +
          "<td>" + num(r.omega) + "</td><td>" + num(r.log) + "</td>";
        r.valori.forEach(function (v) { html += "<td>" + num(v) + "</td>"; });
        html += "<td><strong>" + num(r.somma) + "</strong></td></tr>";
      });
      return html + "</tbody></table></div>";
    }

    divTabellaSomma.innerHTML =
      '<p class="nota">Le colonne dei termini sono i contributi <em>asintotici</em> di quelli elencati ' +
      "sopra, nello stesso ordine: sommandole riga per riga si ottiene la spezzata asintotica.</p>" +
      datiTabelle(w, notevoli, elenco, contributi).map(costruisci).join("") +
      '<p class="nota">Le righe evidenziate sono gli estremi e i punti dove la spezzata cambia ' +
      "pendenza: sono le sole necessarie per disegnare il totale, unendole con segmenti.</p>";
    typeset(divTabellaSomma);
  }

  // =====================================================================
  // SALVATAGGIO IN PDF (LaTeX)
  // =====================================================================
  // Il sito e' statico, quindi il documento non si compila qui: si genera
  // il sorgente LaTeX e lo si manda a texlive.net (il servizio di
  // compilazione usato da learnlatex.org), che risponde con il PDF in una
  // nuova scheda. I grafici sono disegnati da pgfplots con gli stessi
  // numeri e lo stesso stile di quelli della pagina (vedi plotBode in
  // ca-plot.js), ma su fondo bianco.

  // Testo con la matematica fra $...$ (come le descrizioni delle schede)
  // reso sicuro per LaTeX: i caratteri speciali fuori dalla matematica
  // vengono protetti e i simboli Unicode diventano comandi.
  const SIMBOLI_LATEX = [
    ["log₁₀", "\\log_{10}"], ["₁₀", "_{10}"], ["₀", "_0"], ["ω", "\\omega"], ["δ", "\\delta"],
    ["τ", "\\tau"], ["ζ", "\\zeta"], ["°", "^\\circ"], ["−", "-"], ["±", "\\pm"], ["·", "\\cdot"],
    ["≈", "\\approx"], ["→", "\\to"], ["≤", "\\le"], ["≥", "\\ge"],
  ];
  function testoLatex(str) {
    return String(str).split("$").map(function (pezzo, i) {
      const inMatematica = i % 2 === 1;
      if (!inMatematica) {
        pezzo = pezzo.replace(/[\\{}]/g, "").replace(/([%&#_])/g, "\\$1")
          // trattino che fa da segno davanti a un numero: meno matematico
          .replace(/(^|[\s(\[,;:=<>\/])-(?=[0-9.])/g, "$1\\ensuremath{-}");
      }
      SIMBOLI_LATEX.forEach(function (c) {
        pezzo = pezzo.split(c[0]).join(inMatematica ? c[1] + " " : "\\ensuremath{" + c[1] + "}");
      });
      return pezzo;
    }).join("$");
  }

  // Etichetta HTML di un punto notevole ("log<sub>10</sub>ω<sub>0</sub> = 1")
  // riscritta in LaTeX: monospaziata come nel sito, solo ω in matematica.
  function etichettaLatex(html) {
    return html.replace(/<sub>(.*?)<\/sub>/g, "\\textsubscript{$1}").replace("ω", "$\\omega$");
  }

  // Numero per le coordinate di pgfplots ("nan" interrompe la curva, per
  // esempio l'ampiezza infinita di una coppia complessa con δ = 0).
  function coordLatex(x) {
    return Number.isFinite(x) ? String(Math.round(x * 1e4) / 1e4) : "nan";
  }

  // Colori del sito: le curve seguono la sequenza di Plotly, nello stesso
  // ordine in cui plotBode aggiunge le tracce (ampiezza, fase, poi per
  // ogni curva in piu' una per l'ampiezza e una per la fase).
  const PREAMBOLO_COLORI =
    "\\definecolor{inchiostro}{HTML}{45443D}\n\\definecolor{grigliaA}{HTML}{D9D3C6}\n" +
    "\\definecolor{grigliaB}{HTML}{ECE7DD}\n\\definecolor{rosso}{HTML}{B3261E}\n" +
    "\\definecolor{plotlyA}{HTML}{1F77B4}\n\\definecolor{plotlyB}{HTML}{FF7F0E}\n" +
    "\\definecolor{plotlyC}{HTML}{2CA02C}\n\\definecolor{plotlyD}{HTML}{D62728}\n" +
    "\\definecolor{plotlyE}{HTML}{9467BD}\n\\definecolor{plotlyF}{HTML}{8C564B}\n" +
    "\\definecolor{evidenziata}{RGB}{221,229,250}\n";
  const COLORI_PLOTLY = ["plotlyA", "plotlyB", "plotlyC", "plotlyD", "plotlyE", "plotlyF"];

  // Stile comune dei due assi, come nel sito: assi a "L", griglia a due
  // livelli (decadi e suddivisioni), etichette in IBM Plex Mono.
  const STILE_ASSI =
    // la larghezza e' quella del solo riquadro: numeri ed etichetta verticale a
    // sinistra e l'ultima tacca a destra occupano ~2 cm, cosi' il grafico sta nei margini
    "width=\\linewidth-2cm, scale only axis, axis lines*=left, axis line style={inchiostro, line width=0.6pt}, " +
    "tick style={inchiostro}, tick align=outside, major tick length=3pt, minor tick length=0pt, " +
    "grid=both, major grid style={grigliaA, line width=0.5pt}, minor grid style={grigliaB, line width=0.4pt}, " +
    "minor y tick num=4, enlarge y limits=0.06, unbounded coords=jump, " +
    // si tagliano solo le curve: le etichette dei punti notevoli stanno
    // fuori dal riquadro
    "clip mode=individual, " +
    "ticklabel style={font=\\ttfamily\\scriptsize, text=inchiostro}, " +
    "label style={font=\\ttfamily\\footnotesize, text=inchiostro}, " +
    "xticklabel={\\pgfmathprintnumber[assume math mode=true]{\\tick}}, " +
    "yticklabel={\\pgfmathprintnumber[assume math mode=true]{\\tick}}, " +
    "every axis plot/.append style={line width=1pt, line join=round}";

  // Tacche principali sulle decadi intere, suddivisioni in 2..9 di ogni
  // decade (in log10 ω, l'asse e' lineare).
  function tacchePulsazioni(xmin, xmax) {
    const principali = [], secondarie = [];
    for (let e = Math.floor(xmin); e <= Math.ceil(xmax); e++) {
      if (e >= xmin - 1e-9 && e <= xmax + 1e-9) principali.push(e);
      for (let k = 2; k <= 9; k++) {
        const v = e + Math.log10(k);
        if (v > xmin && v < xmax) secondarie.push(coordLatex(v));
      }
    }
    return "xtick={" + principali.join(",") + "}, minor xtick={" + secondarie.join(",") + "}";
  }

  // Riga di ogni etichetta dei punti notevoli sotto l'asse: di norma tutte
  // sulla stessa, si scende solo se la precedente e' troppo vicina (stessa
  // regola di plotBode). Restituisce i riferimenti ordinati con la riga.
  function righeEtichette(rif, xmin, xmax) {
    const ultimoAllaRiga = [];
    return rif.slice().sort(function (a, b) { return a.omega - b.omega; }).map(function (r) {
      const frazione = (Math.log10(r.omega) - xmin) / (xmax - xmin);
      let riga = 0;
      while (ultimoAllaRiga[riga] !== undefined && frazione - ultimoAllaRiga[riga] < 0.12) riga++;
      ultimoAllaRiga[riga] = frazione;
      return { r: r, riga: riga, frazione: frazione };
    });
  }
  function numeroRighe(rif, xmin, xmax) {
    return righeEtichette(rif, xmin, xmax).reduce(function (m, e) { return Math.max(m, e.riga + 1); }, 0);
  }

  // Un riquadro (ampiezza o fase) con le sue curve e i punti notevoli: un
  // pallino rosso sulla spezzata, il richiamo tratteggiato fino all'asse e
  // l'etichetta sotto le tacche.
  function riquadroLatex(nome, ws, curve, rif, opzioni) {
    const xmin = Math.log10(ws[0]), xmax = Math.log10(ws[ws.length - 1]);
    let tex = "\\begin{axis}[" + STILE_ASSI + ", name=" + nome + ", " + opzioni +
      ", xmin=" + coordLatex(xmin) + ", xmax=" + coordLatex(xmax) + ", " + tacchePulsazioni(xmin, xmax) + "]\n";
    curve.forEach(function (c) {
      let punti = "";
      ws.forEach(function (om, i) { punti += "(" + coordLatex(Math.log10(om)) + "," + coordLatex(c.valori[i]) + ") "; });
      tex += "\\addplot[" + c.colore + (c.tratteggio ? ", dash pattern=on 4pt off 3pt" : "") +
        "] coordinates {" + punti + "};\n";
    });
    righeEtichette(rif, xmin, xmax).forEach(function (e) {
      const r = e.r, frazione = e.frazione, livello = e.riga;
      const x = coordLatex(Math.log10(r.omega));
      const ancora = frazione > 0.85 ? "north east" : frazione < 0.15 ? "north west" : "north";
      // Il piede del richiamo e' sull'asse: in coordinate relative la x e'
      // proprio la frazione della larghezza.
      const piede = "rel axis cs:" + coordLatex(frazione) + ",0";
      tex += "\\draw[rosso, line width=0.5pt, dash pattern=on 1pt off 1.5pt] (" + piede + ") -- (axis cs:" + x + "," + coordLatex(r.y) + ");\n" +
        "\\fill[rosso] (axis cs:" + x + "," + coordLatex(r.y) + ") circle[radius=1.6pt];\n" +
        "\\node[anchor=" + ancora + ", text=rosso, font=\\ttfamily\\tiny, inner sep=0pt] at ([yshift=-" +
        (14 + 9 * livello) + "pt]" + piede + ") {" + etichettaLatex(r.etichetta) + "};\n";
    });
    return tex + "\\end{axis}\n";
  }

  // Grafico di Bode come nel sito: ampiezza sopra, fase sotto, legenda
  // orizzontale in alto, nome dell'asse delle pulsazioni solo in basso.
  // serie: [{nome, mag, fase}]; la prima e' continua, le altre tratteggiate.
  function graficoBodeLatex(ws, serie, riferimenti, altezza) {
    const colore = function (i) { return COLORI_PLOTLY[i % COLORI_PLOTLY.length]; };
    // Ordine delle tracce di plotBode: ampiezza, fase, poi le curve extra
    // (ampiezza e fase di ciascuna).
    const curveAmp = [{ valori: serie[0].mag, colore: colore(0) }];
    const curveFase = [{ valori: serie[0].fase, colore: colore(1) }];
    const legenda = [{ colore: colore(0), nome: "ampiezza" }, { colore: colore(1), nome: "fase" }];
    serie.slice(1).forEach(function (c, k) {
      curveAmp.push({ valori: c.mag, colore: colore(2 + 2 * k), tratteggio: true });
      curveFase.push({ valori: c.fase, colore: colore(3 + 2 * k), tratteggio: true });
      legenda.push({ colore: colore(2 + 2 * k), nome: c.nome, tratteggio: true });
    });
    // Due termini con lo stesso punto di rottura (es. un polo doppio)
    // darebbero la stessa etichetta due volte: se ne tiene una.
    const visti = {};
    riferimenti = riferimenti.filter(function (r) {
      const chiave = r.riquadro + "|" + r.etichetta + "|" + coordLatex(r.y);
      if (visti[chiave]) return false;
      visti[chiave] = true;
      return true;
    });
    const perRiquadro = function (q) { return riferimenti.filter(function (r) { return r.riquadro === q; }); };
    const xmin = Math.log10(ws[0]), xmax = Math.log10(ws[ws.length - 1]);
    // Le etichette dei punti notevoli occupano la fascia sotto le tacche:
    // il riquadro della fase scende e il nome dell'asse si allontana di
    // conseguenza.
    const righeAmp = numeroRighe(perRiquadro("ampiezza"), xmin, xmax);
    const righeFase = numeroRighe(perRiquadro("fase"), xmin, xmax);
    const amp = riquadroLatex("ampiezza", ws, curveAmp, perRiquadro("ampiezza"),
      "height=" + altezza + ", ylabel={ampiezza [dB]}");
    const fase = riquadroLatex("fase", ws, curveFase, perRiquadro("fase"),
      "height=" + altezza + ", ylabel={fase [$^\\circ$]}, " +
      "xlabel={log\\textsubscript{10}($\\omega$)\\enspace[decadi]}, " +
      "xlabel style={yshift=-" + (righeFase ? 6 + 9 * righeFase : 0) + "pt}, " +
      "at={($(ampiezza.south west)+(0,-" + (righeAmp ? 30 + 9 * righeAmp : 22) + "pt)$)}, anchor=north west");
    // La legenda e' un nodo sopra il primo riquadro: le voci sono le
    // stesse dei grafici del sito, con il campione di linea davanti.
    let voci = "";
    legenda.forEach(function (v) {
      const tratto = "\\rule[0.55ex]{" + (v.tratteggio ? "2.4mm" : "6mm") + "}{1pt}";
      voci += "\\textcolor{" + v.colore + "}{" + tratto + (v.tratteggio ? "\\hspace{1.2mm}" + tratto : "") + "}~" +
        v.nome.replace("ω", "$\\omega$") + "\\qquad ";
    });
    return "\\begin{tikzpicture}\n" + amp + fase +
      "\\node[anchor=south west, font=\\ttfamily\\scriptsize, text=inchiostro, inner sep=0pt] at ([yshift=6pt]ampiezza.north west) {" +
      voci + "};\n\\end{tikzpicture}\n";
  }

  function nomeBreveLatex(t, i) {
    const n = (i + 1) + ".~";
    if (t.tipo === "guadagno") return n + "$K$";
    if (t.tipo === "origine") {
      const sh = "s" + (Math.abs(t.h) === 1 ? "" : "^{" + Math.abs(t.h) + "}");
      return n + "$" + (t.h > 0 ? sh : "1/" + sh) + "$";
    }
    const tipo = t.esponente > 0 ? "zero" : "polo";
    if (t.tipo === "reale") return n + tipo + " $\\omega_0=" + formattaNumero(1 / Math.abs(t.T), 3) + "$";
    return n + tipo + " $\\omega_n=" + formattaNumero(t.omegan, 3) + "$";
  }

  function tabellaLatex(tab, elenco) {
    const titolo = tab.titolo.replace("°", "$^\\circ$");
    // Come nel sito: tabella a tutta larghezza, colonne uguali e righe
    // alte con il contenuto centrato (il puntello invisibile \\puntello da' a
    // ogni riga la stessa altezza sopra e sotto le cifre).
    let tex = "\\subsection*{" + titolo + "}\n{\\small\n" +
      "\\begin{tabularx}{\\textwidth}{*{" + (elenco.length + 3) + "}{>{\\centering\\arraybackslash}X}}\n\\toprule\n" +
      "\\puntello $\\omega$ [rad/s] & $\\log_{10}\\omega$ & " +
      elenco.map(nomeBreveLatex).join(" & ") + " & \\textbf{Somma} \\\\\n\\midrule\n";
    // \\phantom{+} davanti ai numeri non negativi: occupa quanto il segno
    // meno, cosi' nelle colonne centrate le cifre restano allineate.
    const segno = function (v) { return (v >= 0 ? "\\phantom{+}" : "") + v; };
    tab.righe.forEach(function (r) {
      const num = function (v) { return "$" + segno(v) + "$"; };
      tex += (r.necessaria ? "\\rowcolor{evidenziata} " : "") + "\\puntello " + num(r.omega) + " & " + num(r.log) + " & " +
        r.valori.map(num).join(" & ") + " & $\\mathbf{" + segno(r.somma) + "}$ \\\\\n";
    });
    return tex + "\\bottomrule\n\\end{tabularx}\n}\n";
  }

  function documentoLatex(c) {
    // Griglia propria, piu' rada di quella della pagina (a pgfplots non
    // serve), con dentro le pulsazioni notevoli perche' gli spigoli delle
    // spezzate cadano su punti veri.
    const ws = creaGrigliaOmega(c.omegaMin, c.omegaMax, 160)
      .concat(c.notevoli)
      .sort(function (a, b) { return a - b; })
      .filter(function (om, i, arr) { return i === 0 || om > arr[i - 1]; });
    const contributo = function (t) {
      if (t.tipo === "guadagno") return contributoGuadagno(t.K, ws);
      if (t.tipo === "origine") return contributoOrigine(t.h, ws);
      return contributoTermine(t, ws);
    };
    const contributi = c.elencoTermini.map(contributo);
    const dentro = function (r) { return r.omega >= c.omegaMin && r.omega <= c.omegaMax; };

    let tex =
      "\\documentclass[11pt,a4paper]{article}\n" +
      "\\usepackage[T1]{fontenc}\n\\usepackage[utf8]{inputenc}\n\\usepackage[italian]{babel}\n" +
      "\\usepackage{lmodern}\n\\usepackage[scale=0.95]{plex-mono}\n\\usepackage[margin=2cm]{geometry}\n" +
      "\\usepackage{amsmath}\n\\usepackage{booktabs}\n\\usepackage[table]{xcolor}\n\\usepackage{tabularx}\n" +
      "\\newcommand{\\puntello}{\\rule[-6pt]{0pt}{17pt}}\n" +
      "\\renewcommand{\\tabularxcolumn}[1]{m{#1}}\n" + // celle centrate anche in verticale
      "\\usepackage{pgfplots}\n\\pgfplotsset{compat=1.18}\n\\usetikzlibrary{calc}\n" +
      PREAMBOLO_COLORI +
      "\\setlength{\\parindent}{0pt}\n\\setlength{\\parskip}{0.5em}\n" +
      "\\title{Diagrammi di Bode}\n\\author{Controlli Automatici}\n\\date{\\today}\n" +
      "\\begin{document}\n\\maketitle\n\n";

    tex += "\\section*{Funzione di trasferimento}\n\\[ G(s) = \\dfrac{" + formattaPolinomioTex(c.num, "s") + "}{" +
      formattaPolinomioTex(c.den, "s") + "} = " + formaFattorizzataTex(c.K, c.h, c.termini) + " \\]\n" +
      "Pulsazioni da $" + formattaNumero(c.omegaMin) + "$ a $" + formattaNumero(c.omegaMax) + "$~rad/s.\n\n";

    tex += "\\section*{Termini elementari}\n";
    c.elencoTermini.forEach(function (t, i) {
      const k = contributi[i];
      // Ogni termine e' un blocco unico: titolo, descrizione e grafico non
      // si separano mai fra due pagine.
      tex += "\\noindent\\begin{minipage}{\\linewidth}\n\\setlength{\\parskip}{0.5em}\n" +
        "\\subsection*{" + (i + 1) + ". " + titoloTermine(t) + "}\n" +
        "\\[ " + formulaSchedaTex(t) + " \\]\n" + testoLatex(descrizioneScheda(t)) + "\n\n" +
        "\\begin{center}\n" +
        graficoBodeLatex(ws, [
          { mag: k.magDb, fase: k.phaseDeg },
          { nome: "asintotico", mag: k.magAsintDb, fase: k.phaseAsintDeg },
        ], riferimentiTermine(t).filter(dentro), "3.6cm") +
        "\\end{center}\n\\end{minipage}\n\n\\bigskip\n\n";
    });

    // Nel totale si segnano i punti di rottura di tutti i termini, sulla
    // spezzata asintotica totale (come mostraTotale).
    const magAsint = sommaArray(contributi.map(function (k) { return k.magAsintDb; }));
    const faseAsint = sommaArray(contributi.map(function (k) { return k.phaseAsintDeg; }));
    const rotture = [];
    c.elencoTermini.forEach(function (t) {
      let omega = null, simbolo = "";
      if (t.tipo === "reale") { omega = 1 / Math.abs(t.T); simbolo = "<sub>0</sub>"; }
      else if (t.tipo === "complesso") { omega = t.omegan; simbolo = "<sub>n</sub>"; }
      if (omega === null || omega < c.omegaMin || omega > c.omegaMax) return;
      const idx = indiceVicino(ws, omega);
      rotture.push({ omega: omega, riquadro: "ampiezza", y: magAsint[idx], etichetta: etichettaLog(simbolo, omega) });
      rotture.push({ omega: omega, riquadro: "fase", y: faseAsint[idx], etichetta: etichettaLog(simbolo, omega) });
    });
    const diretta = ws.map(function (om) { return CA.freqResp(c.num, c.den, om); });
    const faseEsatta = sommaArray(contributi.map(function (k) { return k.phaseDeg; }));
    tex += "\\clearpage\n\\section*{Diagramma di Bode totale}\n\\begin{center}\n" +
      graficoBodeLatex(ws, [
        { mag: sommaArray(contributi.map(function (k) { return k.magDb; })), fase: faseEsatta },
        { nome: "asintotico", mag: magAsint, fase: faseAsint },
        { nome: "G(jω) diretto",
          mag: diretta.map(function (z) { return 20 * Math.log10(CA.Cx.abs(z)); }),
          fase: sfasaContinuo(diretta.map(function (z) { return (CA.Cx.arg(z) * 180) / Math.PI; }), faseEsatta[0]) },
      ], rotture, "5cm") +
      "\\end{center}\n\n";

    tex += "\\clearpage\n\\section*{Somma pulsazione per pulsazione}\n" +
      "Le colonne dei termini sono i contributi \\emph{asintotici} di quelli elencati sopra, nello stesso " +
      "ordine: sommandole riga per riga si ottiene la spezzata asintotica.\n" +
      datiTabelle(c.w, c.notevoli, c.elencoTermini, c.contributi)
        .map(function (tab) { return tabellaLatex(tab, c.elencoTermini); }).join("\n") +
      "\nLe righe evidenziate sono gli estremi e i punti dove la spezzata cambia pendenza: sono le sole " +
      "necessarie per disegnare il totale, unendole con segmenti.\n";

    return tex + "\\end{document}\n";
  }

  // Invia il sorgente a texlive.net con un form in una nuova scheda: il
  // servizio compila con pdflatex e reindirizza al PDF.
  function salvaPdf() {
    eseguiCalcolo(); // il PDF riflette sempre i campi come sono ora
    if (!ultimoCalcolo) return;
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://texlive.net/cgi-bin/latexcgi";
    form.enctype = "multipart/form-data";
    form.target = "_blank";
    const campi = {
      "filecontents[]": documentoLatex(ultimoCalcolo),
      "filename[]": "document.tex",
      engine: "pdflatex",
      return: "pdf",
    };
    Object.keys(campi).forEach(function (nome) {
      const campo = document.createElement("textarea");
      campo.name = nome;
      campo.value = campi[nome];
      form.appendChild(campo);
    });
    form.style.display = "none";
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }

  // ---------- Esempio precaricato: 10/((s+1)(s+10)) ----------
  function caricaEsempio() {
    campoNum.value = "10";
    campoDen.value = "1 11 10";
    campoOmegaMin.value = "0.01";
    campoOmegaMax.value = "100";
    eseguiCalcolo();
  }

  document.getElementById("btn-calcola").addEventListener("click", eseguiCalcolo);
  document.getElementById("btn-esempio").addEventListener("click", caricaEsempio);
  document.getElementById("btn-pdf").addEventListener("click", salvaPdf);

  // ---------- Stato iniziale della pagina ----------
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
