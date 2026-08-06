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
  const configBase = { responsive: true, displaylogo: false };

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
    Plotly.newPlot(divId, tracce, layout, configBase);
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
    const assePulsazioni = Object.assign({}, assiStileQuaderno, {
      type: "log", title: "ω [rad/s]",
      tickmode: "array", tickvals, ticktext,
      gridcolor: "#d1d5db", gridwidth: 1,
      minor: { showgrid: true, dtick: "D1", gridcolor: "#eef0f2", gridwidth: 1, ticks: "" },
    });
    const assiVerticali = Object.assign({}, assiStileQuaderno, {
      gridcolor: "#d1d5db", gridwidth: 1,
      minor: { showgrid: true, gridcolor: "#eef0f2", gridwidth: 1, ticks: "" },
    });
    const layout = Object.assign({}, layoutBase, {
      grid: { rows: 2, columns: 1, pattern: "independent" },
      xaxis: assePulsazioni,
      yaxis: Object.assign({ title: "ampiezza [dB]" }, assiVerticali),
      xaxis2: Object.assign({}, assePulsazioni),
      yaxis2: Object.assign({ title: "fase [°]" }, assiVerticali),
    });
    Plotly.newPlot(divId, tracce, layout, configBase);
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
    Plotly.newPlot(divId, tracce, layout, configBase);
  }

  window.CAPlot = { plotTime, plotBode, plotComplex };
})();
