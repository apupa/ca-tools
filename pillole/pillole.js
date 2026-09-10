// ===== pillole.js — carica e mostra le pillole teoriche di una lezione =====
// Le pillole sono file markdown molto regolari (vedi CA0X.md): solo
// intestazioni "## Titolo", paragrafi di testo semplice, formule isolate
// "$$...$$" e occasionali immagini "![alt](percorso)". Non serve un parser
// markdown completo: questo gestisce esattamente queste quattro cose.
(function () {
  function escapeHtml(testo) {
    return testo
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function renderBlocco(testo) {
    const righe = testo.split("\n");
    const titolo = righe[0].replace(/^##\s*/, "").trim();
    const corpo = righe.slice(1).join("\n").trim();

    const html = corpo
      .split(/\n\s*\n/)
      .map((paragrafo) => {
        const p = paragrafo.trim();
        const immagine = p.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        if (immagine) {
          // Gli schemi ridisegnati per il sito sono SVG e vengono messi in
          // linea (vedi inserisciSvg): dentro un <img> sarebbero un documento
          // a se', senza i caratteri e i colori della pagina.
          if (/\.svg$/i.test(immagine[2])) {
            return (
              '<div class="pillola-figura" role="img" data-svg="' + immagine[2] +
              '" aria-label="' + escapeHtml(immagine[1]) + '"></div>'
            );
          }
          return (
            '<img class="pillola-immagine" src="' + immagine[2] + '" alt="' +
            escapeHtml(immagine[1]) + '" loading="lazy" />'
          );
        }
        // Formula isolata: resta un blocco a se', cosi' puo' avere la sua
        // spaziatura e scorrere da sola quando e' piu' larga della colonna.
        if (/^\$\$[\s\S]*\$\$$/.test(p)) {
          return '<div class="pillola-formula">' + escapeHtml(p) + "</div>";
        }
        return "<p>" + escapeHtml(p).replace(/\n/g, " ") + "</p>";
      })
      .join("\n");

    return '<article class="pillola"><h2>' + escapeHtml(titolo) + "</h2>" + html + "</article>";
  }

  function renderMarkdown(testo) {
    return testo
      .trim()
      .split(/\n(?=## )/)
      .filter((blocco) => blocco.trim().length > 0)
      .map(renderBlocco)
      .join("\n");
  }

  // Marca di versione condivisa: markdown e figure sono scaricati a parte,
  // quindi senza di essa il browser continuerebbe a servire i vecchi anche
  // dopo una pubblicazione. La imposta la pagina (window.CA_VERSIONE).
  function conVersione(percorso) {
    return window.CA_VERSIONE ? percorso + "?v=" + window.CA_VERSIONE : percorso;
  }

  function inserisciSvg(radice) {
    radice.querySelectorAll("[data-svg]").forEach(function (posto) {
      fetch(conVersione(posto.getAttribute("data-svg")))
        .then(function (r) { return r.ok ? r.text() : Promise.reject(r.status); })
        .then(function (svg) { posto.innerHTML = svg; })
        .catch(function () {
          // Se la richiesta non va a buon fine il disegno resta comunque:
          // dentro un <img> perde i caratteri della pagina, ma e' sempre
          // meglio di una figura sparita senza dire niente.
          posto.innerHTML =
            '<img src="' + posto.getAttribute("data-svg") + '" alt="' +
            (posto.getAttribute("aria-label") || "") + '" />';
        });
    });
  }

  const contenitore = document.getElementById("pillole-contenuto");
  const nomeFile = window.CA_LEZIONE_MD;
  if (!contenitore || !nomeFile) return;

  fetch(conVersione(nomeFile))
    .then((risposta) => {
      if (!risposta.ok) throw new Error("file non trovato (" + risposta.status + ")");
      return risposta.text();
    })
    .then((testo) => {
      contenitore.innerHTML = renderMarkdown(testo);
      inserisciSvg(contenitore);
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([contenitore]);
      }
    })
    .catch((e) => {
      contenitore.innerHTML =
        '<p class="pillole-errore">Non è stato possibile caricare le pillole (' + e.message + ").</p>";
    });
})();
