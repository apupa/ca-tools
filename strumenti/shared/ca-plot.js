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
    // Assi delle pulsazioni: scala logaritmica con una tacca per decade,
    // etichettata in notazione 10^n (dtick=1 in scala log = un ordine di
    // grandezza tra una tacca e la successiva).
    const assePulsazioni = {
      type: "log", title: "ω [rad/s]", gridcolor: "#e5e7eb",
      dtick: 1, exponentformat: "power", minorticks: "",
    };
    const layout = Object.assign({}, layoutBase, {
      grid: { rows: 2, columns: 1, pattern: "independent" },
      xaxis: assePulsazioni,
      yaxis: { title: "ampiezza [dB]", gridcolor: "#e5e7eb" },
      xaxis2: Object.assign({}, assePulsazioni),
      yaxis2: { title: "fase [°]", gridcolor: "#e5e7eb" },
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
