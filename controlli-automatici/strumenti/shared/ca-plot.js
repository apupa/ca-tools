// ===== ca-plot.js — helper di plotting su Plotly (grafici statici) =====
// NB: le pagine degli strumenti caricano questo file con un suffisso di versione
// (?v=...). GitHub Pages lo tiene in cache 10 minuti, quindi dopo averlo
// modificato bisogna aggiornare quel suffisso in strumenti/*/index.html,
// altrimenti il browser puo' mescolare una versione vecchia di questo file
// con una nuova di app.js.
(function () {
  // Layout comune: font di sistema, margini contenuti, sfondo bianco
  // (i grafici restano leggibili anche col tema scuro del sito).
  const layoutBase = {
    font: { family: "-apple-system, Segoe UI, Roboto, Arial, sans-serif", size: 12, color: "#1f2937" },
    margin: { l: 55, r: 20, t: 30, b: 45 },
    paper_bgcolor: "#ffffff",
    plot_bgcolor: "#ffffff",
    legend: { orientation: "h", x: 0, y: 1.15 },
  };

  // ---------- Adattamento a schermi piccoli / touch ----------
  // Su telefono i gesti di Plotly (pan/zoom con un dito) rubano lo scorrimento
  // della pagina: si resta "incastrati" nel grafico mentre si scorre. Quindi
  // sui dispositivi touch il grafico nasce non trascinabile (la pagina scorre
  // normalmente) e l'interazione vera si ottiene aprendolo a schermo intero.
  function schermoStretto() {
    return window.matchMedia("(max-width: 700px)").matches;
  }
  function dispositivoTouch() {
    return window.matchMedia("(hover: none), (pointer: coarse)").matches;
  }

  // Su touch la barra dei comandi di Plotly non compare mai: i suoi tasti sono
  // troppo piccoli per il dito e occuperebbero l'angolo dove sta il tasto
  // "ingrandisci". A schermo intero bastano trascinamento e pizzico.
  function configPer() {
    return {
      responsive: true,
      displaylogo: false,
      displayModeBar: dispositivoTouch() ? false : "hover",
      scrollZoom: false,
      modeBarButtonsToRemove: [
        "select2d", "lasso2d", "toggleSpikelines",
        "hoverClosestCartesian", "hoverCompareCartesian",
      ],
    };
  }

  // Restituisce il layout adattato al contesto.
  // Sul touch il trascinamento di Plotly resta sempre disattivato: fuori dallo
  // schermo intero perche' rubava lo scorrimento della pagina, dentro perche'
  // spostamento e zoom li gestiamo noi (vedi abilitaGestiTouch) e i due
  // meccanismi in parallelo si disturbavano a vicenda.
  function adattaLayout(layout, espanso) {
    const out = Object.assign({}, layout);
    if (espanso) {
      out.dragmode = dispositivoTouch() ? false : "pan";
      return out;
    }
    if (dispositivoTouch()) out.dragmode = false;
    if (schermoStretto()) {
      out.margin = Object.assign({}, layout.margin, { l: 48, r: 12, t: 26, b: 42 });
      out.font = Object.assign({}, layout.font, { size: 11 });
    }
    return out;
  }

  // Disegna e ricorda tracce/layout "base" sul nodo, cosi' il passaggio a
  // schermo intero puo' ridisegnare con la configurazione giusta.
  function disegna(divId, tracce, layout) {
    const div = typeof divId === "string" ? document.getElementById(divId) : divId;
    if (!div) return;
    div._caTracce = tracce;
    div._caLayout = layout;
    const espanso = !!div.closest(".grafico-box.a-schermo-intero");
    Plotly.newPlot(div, tracce, adattaLayout(layout, espanso), configPer());
    aggiungiComandi(div);
  }

  function ridisegna(div, espanso) {
    if (!div._caTracce) return;
    Plotly.react(div, div._caTracce, adattaLayout(div._caLayout, espanso), configPer());
    Plotly.Plots.resize(div);
  }

  // ---------- Gesti touch: spostamento e zoom ----------
  // Plotly, sui grafici cartesiani, non fa pinch-to-zoom: sul touch riconosce
  // solo il trascinamento a un dito. Non basta pero' aggiungere il pizzico
  // sopra Plotly: al primo dito Plotly avvia gia' il proprio trascinamento e
  // registra i listener sul *document*, quindi continua a spostare il grafico
  // mentre noi proviamo a zoomare, e ogni relayout ricostruisce il livello di
  // trascinamento interrompendo la sequenza di tocchi. Percio' a schermo
  // intero disattiviamo del tutto i gesti di Plotly e gestiamo qui sia lo
  // spostamento (un dito) sia lo zoom (due dita), agendo sui range degli assi.
  //
  // Nota: per gli assi logaritmici il range e' gia' espresso in decadi
  // (log10), quindi l'aritmetica lineare qui sotto e' lo zoom corretto anche
  // in scala logaritmica.
  function nomiAssi(gd) {
    const fl = gd._fullLayout || {};
    return Object.keys(fl).filter(function (k) {
      return /^[xy]axis[0-9]*$/.test(k) && Array.isArray(fl[k].range);
    });
  }

  // Stato di partenza del gesto: range e geometria in pixel di ogni asse.
  // _offset/_length sono l'origine e la lunghezza dell'asse in pixel dentro
  // il grafico; servono per convertire i pixel del dito in unita' di range.
  function fotografaAssi(gd) {
    return nomiAssi(gd).map(function (k) {
      const ax = gd._fullLayout[k];
      return {
        nome: k,
        r0: ax.range[0],
        r1: ax.range[1],
        offset: ax._offset,
        lunghezza: ax._length,
        orizzontale: k.charAt(0) === "x",
      };
    });
  }

  // fattore > 1 = ci si avvicina (intervallo piu' stretto).
  // ancora: {x, y} in pixel relativi al grafico; se assente si zooma sul centro.
  function calcolaZoom(assi, fattore, ancora) {
    const agg = {};
    assi.forEach(function (a) {
      const ampiezza = a.r1 - a.r0;
      let v = (a.r0 + a.r1) / 2;
      if (ancora && a.lunghezza > 0) {
        const p = a.orizzontale ? ancora.x : ancora.y;
        let f = (p - a.offset) / a.lunghezza;
        f = Math.max(0, Math.min(1, f));
        // Sull'asse verticale i pixel crescono verso il basso, i valori no.
        v = a.orizzontale ? a.r0 + f * ampiezza : a.r1 - f * ampiezza;
      }
      agg[a.nome + ".range"] = [v - (v - a.r0) / fattore, v + (a.r1 - v) / fattore];
    });
    return agg;
  }

  function calcolaSpostamento(assi, dx, dy) {
    const agg = {};
    assi.forEach(function (a) {
      if (!(a.lunghezza > 0)) return;
      const perPixel = (a.r1 - a.r0) / a.lunghezza;
      // Il dito "trascina" i dati: la finestra si muove nel verso opposto.
      const d = a.orizzontale ? -dx * perPixel : dy * perPixel;
      agg[a.nome + ".range"] = [a.r0 + d, a.r1 + d];
    });
    return agg;
  }

  function distanzaDita(tocchi) {
    const dx = tocchi[0].clientX - tocchi[1].clientX;
    const dy = tocchi[0].clientY - tocchi[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Spostamento (un dito) e zoom (due dita) sul grafico a schermo intero.
  function abilitaGestiTouch(box, div) {
    let assi = null;
    let distIniziale = 0;
    let ancora = null;
    let partenza = null;
    let aggiornamento = null;
    let inAttesa = false;

    function attivo() {
      return box.classList.contains("a-schermo-intero");
    }

    // Il tasto chiudi e i comandi di zoom devono restare toccabili.
    function suiComandi(e) {
      return !!(e.target && e.target.closest && e.target.closest("button"));
    }

    function programma() {
      if (inAttesa) return;
      inAttesa = true;
      // Un ridisegno per fotogramma: un relayout a ogni touchmove va a scatti.
      window.requestAnimationFrame(function () {
        inAttesa = false;
        if (aggiornamento) Plotly.relayout(div, aggiornamento);
      });
    }

    function coordinate(t) {
      const r = div.getBoundingClientRect();
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }

    function inizio(e) {
      if (!attivo() || suiComandi(e)) return;
      e.preventDefault();
      assi = fotografaAssi(div);
      aggiornamento = null;
      if (e.touches.length === 1) {
        distIniziale = 0;
        partenza = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        partenza = null;
        distIniziale = distanzaDita(e.touches);
        const a = coordinate(e.touches[0]);
        const b = coordinate(e.touches[1]);
        ancora = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    }

    function movimento(e) {
      if (!attivo() || !assi || suiComandi(e)) return;
      e.preventDefault();
      if (e.touches.length === 1 && partenza) {
        aggiornamento = calcolaSpostamento(
          assi,
          e.touches[0].clientX - partenza.x,
          e.touches[0].clientY - partenza.y
        );
        programma();
      } else if (e.touches.length === 2 && distIniziale > 0) {
        aggiornamento = calcolaZoom(assi, distanzaDita(e.touches) / distIniziale, ancora);
        programma();
      }
    }

    function fine(e) {
      if (!attivo()) return;
      // Se resta un dito, si riparte da capo con lo stato aggiornato:
      // altrimenti il grafico "salterebbe" al sollevare del secondo dito.
      if (e.touches && e.touches.length > 0) {
        inizio(e);
        return;
      }
      assi = null;
      partenza = null;
      distIniziale = 0;
      aggiornamento = null;
    }

    box.addEventListener("touchstart", inizio, { passive: false, capture: true });
    box.addEventListener("touchmove", movimento, { passive: false, capture: true });
    box.addEventListener("touchend", fine, { passive: false, capture: true });
    box.addEventListener("touchcancel", fine, { passive: false, capture: true });

    // Safari su iOS ha i propri eventi di pizzico per ingrandire la pagina:
    // vanno bloccati o si zooma tutta la pagina invece del grafico.
    ["gesturestart", "gesturechange", "gestureend"].forEach(function (nome) {
      box.addEventListener(nome, function (e) {
        if (attivo()) e.preventDefault();
      }, { passive: false });
    });
  }

  // Avvolge il grafico in un contenitore con il tasto "ingrandisci" e, a
  // schermo intero, con i comandi di zoom.
  // Idempotente: i grafici vengono ridisegnati a ogni ricalcolo.
  function aggiungiComandi(div) {
    if (div.closest(".grafico-box")) return;

    const box = document.createElement("div");
    box.className = "grafico-box";
    div.parentNode.insertBefore(box, div);
    box.appendChild(div);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "grafico-espandi";
    btn.setAttribute("aria-label", "Apri il grafico a schermo intero");
    btn.innerHTML = '<span class="icona">&#8599;</span><span class="etichetta">Ingrandisci</span>';
    box.appendChild(btn);

    // Comandi di zoom: il pizzico non e' sempre comodo (dita grosse, schermo
    // piccolo), questi tasti danno un modo sicuro di zoomare e di tornare
    // alla vista iniziale.
    const comandi = document.createElement("div");
    comandi.className = "grafico-comandi";
    comandi.innerHTML =
      '<button type="button" data-azione="meno" aria-label="Riduci lo zoom">&minus;</button>' +
      '<button type="button" data-azione="piu" aria-label="Aumenta lo zoom">+</button>' +
      '<button type="button" data-azione="reset" aria-label="Torna alla vista iniziale">&#8634;</button>';
    box.appendChild(comandi);

    comandi.addEventListener("click", function (e) {
      const tasto = e.target.closest("button");
      if (!tasto) return;
      const azione = tasto.dataset.azione;
      if (azione === "reset") {
        // Ridisegno dal layout di partenza: alcuni grafici (piano complesso)
        // hanno range fissati apposta, che un semplice autorange perderebbe.
        ridisegna(div, box.classList.contains("a-schermo-intero"));
      } else {
        Plotly.relayout(div, calcolaZoom(fotografaAssi(div), azione === "piu" ? 1.4 : 1 / 1.4, null));
      }
    });

    const suggerimento = document.createElement("p");
    suggerimento.className = "grafico-suggerimento";
    suggerimento.textContent =
      "Da telefono usa ↗ per aprire il grafico a schermo intero: lì puoi zoomare con due dita o con i tasti + e −, e spostarti trascinando con un dito.";
    box.parentNode.insertBefore(suggerimento, box.nextSibling);

    function imposta(espanso) {
      box.classList.toggle("a-schermo-intero", espanso);
      document.body.classList.toggle("grafico-aperto", espanso);
      btn.innerHTML = espanso
        ? '<span class="icona">&#10005;</span><span class="etichetta">Chiudi</span>'
        : '<span class="icona">&#8599;</span><span class="etichetta">Ingrandisci</span>';
      btn.setAttribute("aria-label", espanso ? "Chiudi il grafico a schermo intero" : "Apri il grafico a schermo intero");
      ridisegna(div, espanso);
    }

    btn.addEventListener("click", function () {
      imposta(!box.classList.contains("a-schermo-intero"));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && box.classList.contains("a-schermo-intero")) imposta(false);
    });

    abilitaGestiTouch(box, div);
  }

  // ---------- Risposta nel tempo: y(t) per una o più serie ----------
  // series: [{name, y}]  — condivide lo stesso asse t
  function plotTime(divId, t, series) {
    const tracce = series.map((s) => ({
      x: t,
      y: s.y,
      mode: "lines",
      name: s.name,
      line: s.line || {},
    }));
    const layout = Object.assign({}, layoutBase, {
      xaxis: { title: "tempo [s]", zeroline: true, gridcolor: "#e5e7eb" },
      yaxis: { title: "ampiezza", zeroline: true, gridcolor: "#e5e7eb" },
    });
    disegna(divId, tracce, layout);
  }

  // ---------- Diagrammi di Bode: ampiezza [dB] + fase [deg] ----------
  // w: pulsazioni (rad/s); magDb, phaseDeg: curva "reale".
  // extra (opzionale): [{name, magDb, phaseDeg}] curve aggiuntive (es. asintotiche),
  // disegnate tratteggiate.
  function plotBode(divId, w, magDb, phaseDeg, extra) {
    extra = extra || [];
    const tracce = [
      { x: w, y: magDb, mode: "lines", name: "ampiezza", xaxis: "x", yaxis: "y" },
      { x: w, y: phaseDeg, mode: "lines", name: "fase", xaxis: "x2", yaxis: "y2" },
    ];
    extra.forEach((e) => {
      tracce.push({
        x: w, y: e.magDb, mode: "lines", name: e.name,
        line: { dash: "dash" }, xaxis: "x", yaxis: "y",
      });
      tracce.push({
        x: w, y: e.phaseDeg, mode: "lines", name: e.name,
        line: { dash: "dash" }, xaxis: "x2", yaxis: "y2", showlegend: false,
      });
    });
    // Assi delle pulsazioni: scala logaritmica, SOLO potenze di dieci come
    // tacche/etichette (niente 2, 5, ecc. intermedi). Tacche calcolate a mano
    // invece di affidarsi al tick automatico di Plotly, che altrimenti
    // inserisce anche le cifre intermedie all'interno di ogni decade.
    function tacchePotenzeDiDieci(valori) {
      const minV = Math.min.apply(null, valori);
      const maxV = Math.max.apply(null, valori);
      const eMin = Math.floor(Math.log10(minV));
      const eMax = Math.ceil(Math.log10(maxV));
      const tickvals = [], ticktext = [];
      for (let e = eMin; e <= eMax; e++) {
        tickvals.push(Math.pow(10, e));
        ticktext.push("10<sup>" + e + "</sup>");
      }
      return { tickvals, ticktext };
    }
    const { tickvals, ticktext } = tacchePotenzeDiDieci(w);
    // Stile "carta millimetrata da libro di testo": griglia a due livelli
    // (fitta e chiara per le suddivisioni intermedie, più marcata sulle
    // tacche principali) e assi a "L" (solo sinistra/basso, senza riquadro).
    const assiStileQuaderno = {
      showline: true, linecolor: "#374151", linewidth: 1, mirror: false, zeroline: false,
    };
    const assePulsazioniBase = Object.assign({}, assiStileQuaderno, {
      type: "log",
      tickmode: "array", tickvals, ticktext,
      gridcolor: "#d1d5db", gridwidth: 1,
      minor: { showgrid: true, dtick: "D1", gridcolor: "#eef0f2", gridwidth: 1, ticks: "" },
    });
    // Asse ω condiviso da ampiezza e fase (sono impilati, stessa scala):
    // l'etichetta si mette solo sul grafico in basso (fase), non ripetuta su quello in alto.
    const assePulsazioniSenzaEtichetta = Object.assign({}, assePulsazioniBase, { title: "" });
    const assePulsazioniConEtichetta = Object.assign({}, assePulsazioniBase, {
      title: "log₁₀(ω)  [decadi]",
    });
    const assiVerticali = Object.assign({}, assiStileQuaderno, {
      gridcolor: "#d1d5db", gridwidth: 1,
      minor: { showgrid: true, gridcolor: "#eef0f2", gridwidth: 1, ticks: "" },
    });
    const layout = Object.assign({}, layoutBase, {
      grid: { rows: 2, columns: 1, pattern: "independent" },
      xaxis: assePulsazioniSenzaEtichetta,
      yaxis: Object.assign({ title: "ampiezza [dB]" }, assiVerticali),
      xaxis2: assePulsazioniConEtichetta,
      yaxis2: Object.assign({ title: "fase [°]" }, assiVerticali),
    });
    disegna(divId, tracce, layout);
  }

  // ---------- Piano complesso (Re/Im) ----------
  // points può essere:
  //  - un array piatto di {re, im}                → un'unica serie di punti
  //  - un array di serie {name, points:[{re,im}], mode, marker, line}
  // opts (opzionale): {title, xrange:[min,max], yrange:[min,max]}
  // xrange/yrange fissano gli assi (utile per confrontare posizioni che si spostano,
  // es. i poli lungo un arco al variare di un parametro, senza che il grafico si riadatti).
  function plotComplex(divId, points, opts) {
    opts = opts || {};
    let serie;
    if (Array.isArray(points) && points.length > 0 && points[0].points) {
      serie = points;
    } else {
      serie = [{ name: opts.name || "punti", points: points, mode: "markers" }];
    }
    const tracce = serie.map((s) => ({
      x: s.points.map((p) => p.re),
      y: s.points.map((p) => p.im),
      mode: s.mode || "markers",
      name: s.name,
      marker: s.marker || { size: 9 },
      line: s.line || {},
      showlegend: s.showlegend,
      fill: s.fill,
      fillcolor: s.fillcolor,
    }));
    const layout = Object.assign({}, layoutBase, {
      title: opts.title,
      xaxis: {
        title: "Re", zeroline: true, zerolinewidth: 1.5, zerolinecolor: "#9ca3af",
        gridcolor: "#e5e7eb", range: opts.xrange, autorange: opts.xrange ? false : true,
      },
      yaxis: {
        title: "Im", zeroline: true, zerolinewidth: 1.5, zerolinecolor: "#9ca3af",
        gridcolor: "#e5e7eb", scaleanchor: "x", scaleratio: 1,
        range: opts.yrange, autorange: opts.yrange ? false : true,
      },
    });
    disegna(divId, tracce, layout);
  }

  window.CAPlot = { plotTime, plotBode, plotComplex };
})();
