// ===== ca-plot.js — helper di plotting su Plotly (grafici statici) =====
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

  // Restituisce il layout adattato al contesto: compatto e non trascinabile
  // sul telefono, pieno quando il grafico e' aperto a schermo intero.
  function adattaLayout(layout, espanso) {
    const out = Object.assign({}, layout);
    if (espanso) {
      out.dragmode = "pan";
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

  // Avvolge il grafico in un contenitore con il tasto "ingrandisci".
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

    const suggerimento = document.createElement("p");
    suggerimento.className = "grafico-suggerimento";
    suggerimento.textContent = "Da telefono usa ↗ per aprire il grafico a schermo intero e potervi zoomare e scorrere.";
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
