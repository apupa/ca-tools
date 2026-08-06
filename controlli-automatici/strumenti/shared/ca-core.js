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

  window.CA = {
    Cx, polyStripLeadingZeros, polyMul, polyAdd, polyDeriv, polyEvalC, polyRoots,
    matMul, matTrace, matIdent, matAddDiag,
    ssToTf, tfToSs, iuToTf, tfToIu, residues, simulate, freqResp,
    polyFromRoots, semplificaFdT,
  };
})();
