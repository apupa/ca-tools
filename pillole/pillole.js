// ===== pillole.js — carica e mostra le pillole teoriche di una lezione =====
// Le pillole sono file markdown molto regolari (vedi CA0X.md): solo
// intestazioni "## Titolo", paragrafi di testo semplice e occasionali
// immagini "![alt](percorso)". Non serve un parser markdown completo: questo
// gestisce esattamente queste tre cose.
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
          return (
            '<img class="pillola-immagine" src="' + immagine[2] + '" alt="' +
            escapeHtml(immagine[1]) + '" loading="lazy" />'
          );
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

  const contenitore = document.getElementById("pillole-contenuto");
  const nomeFile = window.CA_LEZIONE_MD;
  if (!contenitore || !nomeFile) return;

  fetch(nomeFile)
    .then((risposta) => {
      if (!risposta.ok) throw new Error("file non trovato (" + risposta.status + ")");
      return risposta.text();
    })
    .then((testo) => {
      contenitore.innerHTML = renderMarkdown(testo);
      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise([contenitore]);
      }
    })
    .catch((e) => {
      contenitore.innerHTML =
        '<p class="pillole-errore">Non è stato possibile caricare le pillole (' + e.message + ").</p>";
    });
})();
