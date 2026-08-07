// ===== ca-core.js — motore matematico condiviso (SISO) =====
(function () {
  // ---------- Numeri complessi {re, im} ----------
  const Cx = {
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
    mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
    div: (a, b) => {
      const d = b.re * b.re + b.im * b.im;
      return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
    },
    abs: (a) => Math.hypot(a.re, a.im),
    arg: (a) => Math.atan2(a.im, a.re),
    real: (x) => ({ re: x, im: 0 }),
  };

  // ---------- Polinomi: array coeff dal grado ALTO al BASSO ----------
  function polyStripLeadingZeros(p) {
    let i = 0;
    while (i < p.length - 1 && Math.abs(p[i]) < 1e-12) i++;
    return p.slice(i);
  }
  function polyMul(a, b) {
    const r = new Array(a.length + b.length - 1).fill(0);
    for (let i = 0; i < a.length; i++)
      for (let j = 0; j < b.length; j++) r[i + j] += a[i] * b[j];
    return r;
  }
  function polyAdd(a, b) {
    const n = Math.max(a.length, b.length);
    const r = new Array(n).fill(0);
    for (let i = 0; i < a.length; i++) r[n - a.length + i] += a[i];
    for (let i = 0; i < b.length; i++) r[n - b.length + i] += b[i];
    return r;
  }
  function polyDeriv(p) {
    const n = p.length - 1; // grado
    if (n <= 0) return [0];
    const r = [];
    for (let i = 0; i < n; i++) r.push(p[i] * (n - i));
    return r;
  }
  function polyEvalC(p, s) { // valuta in s complesso (Horner)
    let acc = { re: 0, im: 0 };
    for (const c of p) acc = Cx.add(Cx.mul(acc, s), { re: c, im: 0 });
    return acc;
  }
  // Radici di un polinomio (metodo Durand–Kerner / Weierstrass)
  function polyRoots(pin) {
    let p = polyStripLeadingZeros(pin.slice());
    const n = p.length - 1;
    if (n <= 0) return [];
    // normalizza monico
    const lead = p[0];
    p = p.map((c) => c / lead);
    // stime iniziali su una spirale
    let roots = [];
    for (let k = 0; k < n; k++) {
      const ang = (2 * Math.PI * k) / n + 0.4;
      roots.push({ re: 0.6 * Math.cos(ang), im: 0.6 * Math.sin(ang) });
    }
    for (let iter = 0; iter < 200; iter++) {
      let maxDelta = 0;
      const next = roots.map((ri, i) => {
        let denom = { re: 1, im: 0 };
        for (let j = 0; j < n; j++) if (j !== i) denom = Cx.mul(denom, Cx.sub(ri, roots[j]));
        const delta = Cx.div(polyEvalC(p, ri), denom);
        maxDelta = Math.max(maxDelta, Cx.abs(delta));
        return Cx.sub(ri, delta);
      });
      roots = next;
      if (maxDelta < 1e-12) break;
    }
    // pulizia parte immaginaria trascurabile
    return roots.map((r) => (Math.abs(r.im) < 1e-9 ? { re: r.re, im: 0 } : r));
  }

  // ---------- Matrici (array di array) ----------
  function matMul(A, B) {
    const n = A.length, m = B[0].length, K = B.length;
    const R = Array.from({ length: n }, () => new Array(m).fill(0));
    for (let i = 0; i < n; i++)
      for (let j = 0; j < m; j++)
        for (let k = 0; k < K; k++) R[i][j] += A[i][k] * B[k][j];
    return R;
  }
  function matTrace(A) { let t = 0; for (let i = 0; i < A.length; i++) t += A[i][i]; return t; }
  function matIdent(n) { return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))); }
  function matAddDiag(A, s) { const R = A.map((r) => r.slice()); for (let i = 0; i < R.length; i++) R[i][i] += s; return R; }

  // ---------- ISU -> FdT  (Faddeev–LeVerrier, uso INTERNO) ----------
  // Ritorna {num, den}. NB: l'algoritmo NON va mostrato all'utente.
  function ssToTf(A, B, C, D) {
    const n = A.length;
    let Bk = matIdent(n);          // B_0 = I
    const p = [1];                 // coeff denominatore (monico), grado alto->basso
    // numeratore: coeff di s^(n-1-k) è C*Bk*B ; poi somma D*den
    const numFromC = new Array(n).fill(0); // grado n-1 .. 0
    // colonna B come matrice n×1, riga C come 1×n
    const Bcol = B.map((v) => [v]);
    const Crow = [C.slice()];
    for (let k = 0; k < n; k++) {
      // contributo numeratore: C * Bk * B (scalare)
      const cbk = matMul(Crow, matMul(Bk, Bcol))[0][0];
      numFromC[k] = cbk; // coeff di s^(n-1-k)
      const ABk = matMul(A, Bk);
      const pk1 = -matTrace(ABk) / (k + 1);
      p.push(pk1);
      Bk = matAddDiag(ABk, pk1); // B_{k+1} = A*Bk + pk1*I
    }
    // den = p (lunghezza n+1). Numeratore = numFromC (grado n-1) + D*den
    let num = new Array(n + 1).fill(0);
    for (let i = 0; i < n; i++) num[i + 1] = numFromC[i]; // shift: grado max n-1
    for (let i = 0; i <= n; i++) num[i] += D * p[i];
    return { num: polyStripLeadingZeros(num), den: p };
  }

  // ---------- FdT -> ISU (forma canonica di controllo) ----------
  // Gestisce anche FdT proprie (grado num = grado den) estraendo D.
  function tfToSs(num, den) {
    let a = polyStripLeadingZeros(den.slice());
    let b = polyStripLeadingZeros(num.slice());
    const lead = a[0];
    a = a.map((c) => c / lead);
    b = b.map((c) => c / lead);
    const n = a.length - 1; // ordine
    // porta b alla stessa lunghezza di a (grado n) allineando a destra
    let bFull = new Array(a.length).fill(0);
    for (let i = 0; i < b.length; i++) bFull[a.length - b.length + i] = b[i];
    // D = coeff s^n del numeratore (bFull[0]); poi togli D*a
    const D = bFull[0];
    const bStrict = bFull.map((c, i) => c - D * a[i]); // grado <= n-1, bStrict[0]=0
    // A companion, B, C
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n - 1; i++) A[i][i + 1] = 1;
    for (let j = 0; j < n; j++) A[n - 1][j] = -a[a.length - 1 - j]; // -a0..-a(n-1)
    const B = new Array(n).fill(0); B[n - 1] = 1;
    const C = new Array(n).fill(0);
    for (let j = 0; j < n; j++) C[j] = bStrict[bStrict.length - 1 - j]; // b0..b(n-1)
    return { A, B, C, D };
  }

  // ---------- IU <-> FdT ----------
  // IU: a[] coeff di y (grado alto->basso), b[] coeff di u. FdT = b/a.
  function iuToTf(a, b) { return { num: b.slice(), den: a.slice() }; }
  function tfToIu(num, den) { return { a: den.slice(), b: num.slice() }; }

  // ---------- Residui (poli semplici distinti) ----------
  // Ritorna [{pole, residue}] per num/den. Utile per la scomposizione in modi.
  function residues(num, den) {
    const poles = polyRoots(den);
    const dden = polyDeriv(den);
    return poles.map((p) => {
      const r = Cx.div(polyEvalC(num, p), polyEvalC(dden, p));
      return { pole: p, residue: r };
    });
  }

  // ---------- Simulazione risposta (RK4 su realizzazione di stato) ----------
  // Robusta (gestisce poli multipli). u(t) funzione del tempo. Ritorna {t, y}.
  function simulate(num, den, uFunc, tEnd, dt) {
    const { A, B, C, D } = tfToSs(num, den);
    const n = A.length;
    let x = new Array(n).fill(0);
    const t = [], y = [];
    const f = (x, u) => {
      const dx = new Array(n).fill(0);
      for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) dx[i] += A[i][j] * x[j]; dx[i] += B[i] * u; }
      return dx;
    };
    for (let time = 0; time <= tEnd + 1e-9; time += dt) {
      let out = 0; for (let i = 0; i < n; i++) out += C[i] * x[i];
      out += D * uFunc(time);
      t.push(time); y.push(out);
      // RK4
      const u1 = uFunc(time), u2 = uFunc(time + dt / 2), u3 = uFunc(time + dt);
      const k1 = f(x, u1);
      const k2 = f(x.map((xi, i) => xi + (dt / 2) * k1[i]), u2);
      const k3 = f(x.map((xi, i) => xi + (dt / 2) * k2[i]), u2);
      const k4 = f(x.map((xi, i) => xi + dt * k3[i]), u3);
      x = x.map((xi, i) => xi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
    }
    return { t, y };
  }

  // ---------- Valutazione FdT su jω (per Bode) ----------
  function freqResp(num, den, w) {
    const s = { re: 0, im: w };
    return Cx.div(polyEvalC(num, s), polyEvalC(den, s));
  }

  // ---------- Ricostruzione di un polinomio (coeff. reali) dalle sue radici ----------
  // k * prod(s - r_i). Le radici complesse devono comparire in coppie coniugate
  // (tipico di polinomi a coefficienti reali): la coppia viene ricomposta come
  // fattore quadratico reale (s^2 - 2*Re(r)*s + |r|^2).
  function polyFromRoots(roots, k) {
    let poly = [k];
    const usati = new Array(roots.length).fill(false);
    for (let i = 0; i < roots.length; i++) {
      if (usati[i]) continue;
      const r = roots[i];
      if (Math.abs(r.im) < 1e-9) {
        poly = polyMul(poly, [1, -r.re]);
        usati[i] = true;
        continue;
      }
      let j = -1;
      for (let k2 = i + 1; k2 < roots.length; k2++) {
        if (usati[k2]) continue;
        const scala = 1 + Cx.abs(r);
        if (Math.abs(roots[k2].re - r.re) < 1e-6 * scala && Math.abs(roots[k2].im + r.im) < 1e-6 * scala) {
          j = k2;
          break;
        }
      }
      if (j >= 0) {
        const b = -2 * r.re;
        const c = r.re * r.re + r.im * r.im;
        poly = polyMul(poly, [1, b, c]);
        usati[i] = true;
        usati[j] = true;
      } else {
        // coniugato non trovato (caso limite numerico): usa solo la parte reale
        poly = polyMul(poly, [1, -r.re]);
        usati[i] = true;
      }
    }
    return poly;
  }

  // ---------- Semplificazione di coppie polo/zero coincidenti in una FdT ----------
  // Come accade quando un compensatore cancella (a meno di tolleranza numerica)
  // un polo dell'impianto: la coppia si annulla algebricamente nella FdT, quindi
  // va rimossa anche dal luogo delle radici (altrimenti resterebbe un "modo"
  // fisso, non controllabile/osservabile, immobile in quel punto per ogni K).
  // Ritorna {num, den} ridotti; se non c'e' nulla da semplificare, num/den
  // originali (stessi riferimenti).
  function semplificaFdT(num, den, tol) {
    tol = tol || 1e-6;
    const denS = polyStripLeadingZeros(den);
    const numS = polyStripLeadingZeros(num);
    const poli = polyRoots(denS);
    const zeri = polyRoots(numS);

    const poliRes = poli.slice();
    const zeriRes = [];
    let rimossi = 0;
    zeri.forEach((z) => {
      const scala = 1 + Cx.abs(z);
      const i = poliRes.findIndex((p) => Cx.abs(Cx.sub(p, z)) < tol * scala);
      if (i >= 0) {
        poliRes.splice(i, 1);
        rimossi++;
      } else {
        zeriRes.push(z);
      }
    });

    if (rimossi === 0) return { num, den };

    const denRid = poliRes.length > 0 ? polyFromRoots(poliRes, denS[0]) : [denS[0]];
    const numRid = zeriRes.length > 0 ? polyFromRoots(zeriRes, numS[0]) : [numS[0]];
    return { num: numRid, den: denRid };
  }

  // ---------- Lettura di polinomi e FdT scritti in forma naturale ----------
  // Accetta due formati, cosi' lo stesso campo va bene per entrambi:
  //   - coefficienti separati da spazi o virgole:  "1 11 10"
  //   - espressione nella variabile s:             "(s+1)(s+10)", "10/(s^2+11s+10)"
  // Il prodotto implicito e' ammesso: "2s", "3(s+1)", "s(s+1)(s+10)".

  // Ripulisce il rumore numerico introdotto dai prodotti fra polinomi.
  function polyPulisci(p) {
    return p.map((c) => {
      if (!isFinite(c)) throw new Error("coefficiente non finito");
      if (c === 0) return 0;
      const r = Number(c.toPrecision(12));
      return Object.is(r, -0) ? 0 : r;
    });
  }

  // Funzioni razionali {num, den} usate durante l'analisi dell'espressione.
  const Rz = {
    cost: (x) => ({ num: [x], den: [1] }),
    esse: () => ({ num: [1, 0], den: [1] }),
    mul: (a, b) => ({ num: polyMul(a.num, b.num), den: polyMul(a.den, b.den) }),
    add: (a, b) => ({
      num: polyAdd(polyMul(a.num, b.den), polyMul(b.num, a.den)),
      den: polyMul(a.den, b.den),
    }),
    div: (a, b) => {
      const bn = polyStripLeadingZeros(b.num);
      if (bn.length === 1 && bn[0] === 0) throw new Error("divisione per zero");
      return { num: polyMul(a.num, b.den), den: polyMul(a.den, b.num) };
    },
    neg: (a) => ({ num: a.num.map((c) => -c), den: a.den }),
    pow: (a, n) => {
      const base = n < 0 ? Rz.div(Rz.cost(1), a) : a;
      let r = Rz.cost(1);
      for (let i = 0; i < Math.abs(n); i++) r = Rz.mul(r, base);
      return r;
    },
  };

  // Analizzatore a discesa ricorsiva:
  //   espressione := termine (('+' | '-') termine)*
  //   termine     := potenza (('*' | '/' | implicito) potenza)*
  //   potenza     := base ('^' intero)?
  //   base        := numero | 's' | '(' espressione ')' | ('+' | '-') base
  function analizzaEspressione(testo) {
    const s = String(testo);
    let i = 0;

    const saltaSpazi = () => { while (i < s.length && /\s/.test(s[i])) i++; };
    const prossimo = () => { saltaSpazi(); return i < s.length ? s[i] : ""; };
    const errore = (msg) => { throw new Error(msg + " (posizione " + (i + 1) + ")"); };

    function base() {
      const c = prossimo();
      if (c === "+") { i++; return base(); }
      if (c === "-") { i++; return Rz.neg(base()); }
      if (c === "(") {
        i++;
        const dentro = espressione();
        if (prossimo() !== ")") errore("manca una parentesi chiusa");
        i++;
        return dentro;
      }
      if (c === "s" || c === "S") { i++; return Rz.esse(); }
      const numero = /^\d+(\.\d*)?([eE][+-]?\d+)?|^\.\d+([eE][+-]?\d+)?/.exec(s.slice(i));
      if (numero) {
        i += numero[0].length;
        return Rz.cost(parseFloat(numero[0]));
      }
      if (c === "") errore("espressione incompleta");
      errore('carattere non riconosciuto: "' + c + '"');
    }

    function potenza() {
      const b = base();
      if (prossimo() !== "^") return b;
      i++;
      saltaSpazi();
      const esp = /^[+-]?\d+/.exec(s.slice(i));
      if (!esp) errore("dopo ^ serve un esponente intero");
      i += esp[0].length;
      const n = parseInt(esp[0], 10);
      if (Math.abs(n) > 20) errore("esponente troppo grande");
      return Rz.pow(b, n);
    }

    function termine() {
      let acc = potenza();
      for (;;) {
        const c = prossimo();
        if (c === "*") { i++; acc = Rz.mul(acc, potenza()); continue; }
        if (c === "/") { i++; acc = Rz.div(acc, potenza()); continue; }
        // Prodotto implicito: "2s", "(s+1)(s+2)", "3(s+1)".
        if (c === "(" || c === "s" || c === "S" || /[\d.]/.test(c)) {
          acc = Rz.mul(acc, potenza());
          continue;
        }
        return acc;
      }
    }

    function espressione() {
      let acc = termine();
      for (;;) {
        const c = prossimo();
        if (c === "+") { i++; acc = Rz.add(acc, termine()); continue; }
        if (c === "-") { i++; acc = Rz.add(acc, Rz.neg(termine())); continue; }
        return acc;
      }
    }

    const r = espressione();
    if (prossimo() !== "") errore('testo di troppo dopo l\'espressione: "' + s.slice(i).trim() + '"');
    return {
      num: polyPulisci(polyStripLeadingZeros(r.num)),
      den: polyPulisci(polyStripLeadingZeros(r.den)),
    };
  }

  // Elenco di coefficienti: "1 11 10" oppure "1, 11, 10".
  function analizzaCoefficienti(testo) {
    const parti = String(testo).trim().split(/[\s,]+/).filter((x) => x.length > 0);
    if (parti.length === 0) return null;
    const numeri = parti.map(Number);
    if (numeri.some((x) => !isFinite(x))) return null;
    return numeri;
  }

  // Legge una FdT completa: ritorna {num, den}.
  function parseFdT(testo) {
    const t = String(testo == null ? "" : testo).trim();
    if (t === "") throw new Error("campo vuoto");
    // Senza variabile s ne' operatori, e' un elenco di coefficienti.
    if (!/[sS()^*/]/.test(t)) {
      const coeff = analizzaCoefficienti(t);
      if (coeff) return { num: polyStripLeadingZeros(coeff), den: [1] };
    }
    const r = analizzaEspressione(t);
    if (r.den.length === 1 && r.den[0] === 0) throw new Error("denominatore nullo");
    return r;
  }

  // Legge un polinomio: come parseFdT, ma il risultato deve essere un polinomio
  // (denominatore costante), altrimenti la frazione non avrebbe senso nel campo.
  function parsePolinomio(testo) {
    const { num, den } = parseFdT(testo);
    if (den.length > 1) {
      throw new Error("qui serve un polinomio, non una frazione (trovato un denominatore in s)");
    }
    const d = den[0];
    if (d === 0) throw new Error("divisione per zero");
    return polyPulisci(num.map((c) => c / d));
  }

  // ---------- Forma poli-zeri e forma con le costanti di tempo ----------
  // Scompone p(s) = guida * s^potenzaS * (fattori con radici non nulle),
  // separando le radici reali dalle coppie complesse coniugate.
  // "costante" e' il valore in s=0 di p(s)/s^potenzaS, cioe' quello che
  // determina il guadagno nella forma con le costanti di tempo.
  function fattorizzaPolinomio(p) {
    const c = polyStripLeadingZeros(p).slice();
    const scala = Math.max(1, Math.abs(c[0]));
    let potenzaS = 0;
    while (c.length > 1 && Math.abs(c[c.length - 1]) < 1e-12 * scala) {
      c.pop();
      potenzaS++;
    }
    const radici = c.length > 1 ? polyRoots(c) : [];
    const reali = [];
    const coppie = [];
    const usata = new Array(radici.length).fill(false);
    for (let i = 0; i < radici.length; i++) {
      if (usata[i]) continue;
      const r = radici[i];
      usata[i] = true;
      if (Math.abs(r.im) < 1e-9 * (1 + Cx.abs(r))) {
        reali.push(r.re);
        continue;
      }
      let j = -1;
      for (let k = i + 1; k < radici.length; k++) {
        if (usata[k]) continue;
        const sc = 1 + Cx.abs(r);
        if (Math.abs(radici[k].re - r.re) < 1e-6 * sc && Math.abs(radici[k].im + r.im) < 1e-6 * sc) {
          j = k;
          break;
        }
      }
      if (j < 0) { reali.push(r.re); continue; }
      usata[j] = true;
      const omegaN = Cx.abs(r);
      coppie.push({ re: r.re, im: Math.abs(r.im), omegaN, delta: -r.re / omegaN });
    }
    // Ordinate per modulo crescente: e' l'ordine in cui si incontrano le
    // pulsazioni di rottura leggendo un diagramma di Bode da sinistra.
    reali.sort((a, b) => Math.abs(a) - Math.abs(b));
    coppie.sort((a, b) => a.omegaN - b.omegaN);
    return { potenzaS, guida: c[0], costante: c[c.length - 1], radici, reali, coppie };
  }

  // Ritorna le due scritture equivalenti della stessa FdT:
  //   poliZeri:       k * s^sNum * prod(s - z) / ( s^sDen * prod(s - p) )
  //   costantiTempo:  k / s^h * prod(1 + tau*s) / prod(1 + tau*s), con i termini
  //                   del secondo ordine espressi tramite omegaN e delta.
  // Nella seconda, k e' il guadagno di Bode: coincide con G(0) quando h = 0.
  function formeFdT(num, den) {
    const fn = fattorizzaPolinomio(num);
    const fd = fattorizzaPolinomio(den);
    return {
      poliZeri: {
        k: fn.guida / fd.guida,
        sNum: fn.potenzaS,
        sDen: fd.potenzaS,
        zeriReali: fn.reali,
        zeriCoppie: fn.coppie,
        poliReali: fd.reali,
        poliCoppie: fd.coppie,
      },
      costantiTempo: {
        k: fn.costante / fd.costante,
        h: fd.potenzaS - fn.potenzaS,
        tauZeri: fn.reali.map((r) => -1 / r),
        tauPoli: fd.reali.map((r) => -1 / r),
        secondiZeri: fn.coppie,
        secondiPoli: fd.coppie,
      },
    };
  }

  window.CA = {
    Cx, polyStripLeadingZeros, polyMul, polyAdd, polyDeriv, polyEvalC, polyRoots,
    matMul, matTrace, matIdent, matAddDiag,
    ssToTf, tfToSs, iuToTf, tfToIu, residues, simulate, freqResp,
    polyFromRoots, semplificaFdT,
    parseFdT, parsePolinomio, fattorizzaPolinomio, formeFdT,
  };
})();
