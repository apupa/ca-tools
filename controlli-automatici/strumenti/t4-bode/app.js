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
  function mostraFdT(num, den) {
    const numTex = formattaPolinomioTex(num, "s");
    const denTex = formattaPolinomioTex(den, "s");
    divFdtTesto.innerHTML = "<div style=\"overflow-x:auto;\">$$G(s) = \\dfrac{" + numTex + "}{" + denTex + "}$$</div>";
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
  // dell'intervallo, le decadi intere che ci stanno dentro e i punti di
  // rottura di ogni termine. Sono le stesse che si userebbero per
  // tracciare il diagramma a mano.
  function pulsazioniNotevoli(omegaMin, omegaMax, termini, h) {
    const punti = [omegaMin, omegaMax];
    for (let e = Math.ceil(Math.log10(omegaMin)); e <= Math.floor(Math.log10(omegaMax)); e++) {
      punti.push(Math.pow(10, e));
    }
    // Il termine nell'origine non ha punto di rottura: la sua retta passa
    // per 0 dB in omega = 1, che e' gia' fra le decadi.
    termini.forEach(function (t) {
      const rottura = t.tipo === "reale" ? 1 / Math.abs(t.T) : t.omegan;
      if (rottura >= omegaMin && rottura <= omegaMax) punti.push(rottura);
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

    return { K, h, termini: terminiZeri.concat(terminiPoli) };
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

  function formulaTermineTex(t) {
    if (t.tipo === "reale") {
      const base = "\\left(1 + " + formattaNumero(t.T) + "\\,s\\right)";
      return t.esponente > 0 ? base : base + "^{-1}";
    }
    const base =
      "\\left(1 + " + formattaNumero((2 * t.zeta) / t.omegan) + "\\,s + " +
      formattaNumero(1 / (t.omegan * t.omegan)) + "\\,s^2\\right)";
    return t.esponente > 0 ? base : base + "^{-1}";
  }

  // ---------- Calcolo principale ----------
  function eseguiCalcolo() {
    divErrore.style.display = "none";
    try {
      const num = leggiVettoreCoeff(campoNum.value);
      const den = leggiVettoreCoeff(campoDen.value);
      const omegaMin = parseFloat(campoOmegaMin.value);
      const omegaMax = parseFloat(campoOmegaMax.value);
      if (Number.isNaN(omegaMin) || Number.isNaN(omegaMax) || omegaMin <= 0 || omegaMax <= omegaMin) {
        throw new Error("intervallo di pulsazioni non valido (servono 0 < ω_min < ω_max)");
      }

      mostraFdT(num, den);

      const { K, h, termini } = decomponiBode(num, den);
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
      if (h !== 0) {
        contributi.push(contributoOrigine(h, w));
        elencoTermini.push({ tipo: "origine", h });
      }
      termini.forEach((t) => {
        contributi.push(contributoTermine(t, w));
        elencoTermini.push(t);
      });

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
      mostraTabellaSomma(w, notevoli, elencoTermini, contributi, magTotEsatto, faseTotEsatta, magDiretta, faseDiretta);
    } catch (e) {
      divErrore.textContent = "Errore nei dati inseriti: " + e.message;
      divErrore.style.display = "block";
      divFdtTesto.innerHTML = "";
      divListaTermini.innerHTML = "";
      divTabellaSomma.innerHTML = "";
    }
  }

  // ---------- Rendering elenco termini ----------
  function mostraTermini(elenco, w, contributi) {
    let html = "";
    elenco.forEach((t, i) => {
      const divId = "termine-" + i + "-plot";
      let titolo, formula, descrizione;
      if (t.tipo === "guadagno") {
        titolo = "Guadagno costante";
        formula = "K = " + formattaNumero(t.K);
        descrizione =
          "Contributo costante: ampiezza 20·log₁₀|K| = " + formattaNumero(20 * Math.log10(Math.abs(t.K))) +
          " dB su tutte le pulsazioni; fase " + (t.K >= 0 ? "0°" : "180°") + ".";
      } else if (t.tipo === "origine") {
        titolo = t.h > 0 ? "Zero nell'origine" : "Polo nell'origine";
        formula = "(j\\omega)^{" + t.h + "}";
        descrizione =
          "Retta di pendenza " + 20 * t.h + " dB/dec passante per 0 dB a ω=1 rad/s; fase costante " + t.h * 90 + "°. " +
          "In scala logaritmica $|G|_{dB} = " + 20 * t.h + "\\log_{10}\\omega$: è una retta esatta (non " +
          "un'approssimazione asintotica), che " + (t.h > 0 ? "sale" : "scende") + " di " +
          Math.abs(20 * t.h) + " dB ogni volta che $\\log_{10}\\omega$ aumenta di 1, e vale 0 dB in " +
          "$\\log_{10}\\omega = 0$, cioè in $\\omega = 1$ rad/s.";
      } else {
        titolo = (t.esponente > 0 ? "Zero" : "Polo") + (t.tipo === "reale" ? " reale" : " complesso coniugato");
        formula = "$" + formulaTermineTex(t) + "$";
        descrizione = descriviTermine(t);
      }
      html +=
        '<div class="pannello scheda-termine"><h3>' + (i + 1) + ". " + titolo + "</h3>" +
        '<p class="descrizione">' + (t.tipo === "guadagno" || t.tipo === "origine" ? "$" + formula + "$" : formula) +
        "<br />" + descrizione + "</p>" +
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
  // contributi dei termini e sommarli. L'ultima colonna valuta G(jw)
  // direttamente, quindi la verifica sta nella tabella invece che in una
  // nota a parte.
  function nomeBreveTermine(t, i) {
    const n = (i + 1) + ". ";
    if (t.tipo === "guadagno") return n + "K";
    if (t.tipo === "origine") return n + "(jω)<sup>" + t.h + "</sup>";
    return n + (t.esponente > 0 ? "zero" : "polo");
  }

  function mostraTabellaSomma(w, notevoli, elenco, contributi, magTot, faseTot, magDiretta, faseDiretta) {
    // Ogni pulsazione notevole e' stata inserita nella griglia: qui se ne
    // ritrova l'indice esatto, senza interpolare.
    const indici = notevoli.map(function (om) { return indiceVicino(w, om); });

    function costruisci(titolo, perTermine, totale, diretta, decimali) {
      let html = "<h3>" + titolo + "</h3><table><thead><tr>" +
        "<th>ω [rad/s]</th><th>log<sub>10</sub>ω</th>";
      elenco.forEach(function (t, i) {
        html += "<th>" + nomeBreveTermine(t, i) + "</th>";
      });
      html += "<th>Somma</th><th>G(jω)</th></tr></thead><tbody>";
      indici.forEach(function (idx) {
        html += "<tr><td>" + formattaNumero(w[idx], 3) + "</td><td>" +
          formattaNumero(Math.log10(w[idx]), 2) + "</td>";
        perTermine.forEach(function (serie) {
          html += "<td>" + formattaNumero(serie[idx], decimali) + "</td>";
        });
        html += "<td><strong>" + formattaNumero(totale[idx], decimali) + "</strong></td>" +
          "<td>" + formattaNumero(diretta[idx], decimali) + "</td></tr>";
      });
      return html + "</tbody></table>";
    }

    divTabellaSomma.innerHTML =
      '<p class="nota">Le colonne dei termini sono quelle elencate sopra, nello stesso ordine: ' +
      "sommandole riga per riga si ottiene il totale. L'ultima colonna è la valutazione diretta " +
      "di $G(j\\omega)$, che coincide con la somma a meno degli arrotondamenti mostrati.</p>" +
      costruisci("Ampiezza [dB]", contributi.map(function (c) { return c.magDb; }), magTot, magDiretta, 2) +
      costruisci("Fase [°]", contributi.map(function (c) { return c.phaseDeg; }), faseTot, faseDiretta, 1);
    typeset(divTabellaSomma);
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

  // ---------- Stato iniziale della pagina ----------
  caricaEsempio(); // la pagina non è mai vuota all'apertura
})();
