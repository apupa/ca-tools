// ===== segno-meno.js — segno meno tipografico nel testo =====
// I numeri scritti nel testo (tabelle, descrizioni, elenchi di poli...)
// escono da JavaScript con il trattino "-", che e' piu' corto e piu' alto
// del segno meno vero "−" usato nelle formule e nei grafici. Questo script
// sostituisce il trattino quando fa da segno davanti a un numero ("-20",
// "[-1, 0]", "σ=-1"), lasciando stare le parole composte
// ("massa-molla-smorzatore") e le formule, che MathJax compone gia' con il
// meno giusto. Lavora su tutta la pagina e su tutto quello che viene
// aggiunto dopo (risultati dei calcoli, pillole caricate, formule composte).
// NB: le pagine lo caricano con un suffisso di versione (?v=...): dopo una
// modifica va aggiornato in strumenti/*/index.html e pillole/*.html.
(function () {
  // Trattino preceduto da inizio, spazio o segno di interpunzione/relazione
  // e seguito da una cifra, da un punto decimale o da ∞.
  const SEGNO = /(^|[\s(\[{,;:=<>≤≥\/±])-(?=[0-9.∞])/g;
  const DA_SALTARE = ["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "INPUT", "SELECT", "OPTION",
    "MJX-CONTAINER", "MJX-ASSISTIVE-MML", "MATH"];
  const SVG = "http://www.w3.org/2000/svg";

  function elementoDaSaltare(el) {
    return el.namespaceURI === SVG || DA_SALTARE.indexOf(el.nodeName.toUpperCase()) >= 0;
  }

  function dentroDaSaltare(nodo) {
    for (let el = nodo.parentNode; el && el.nodeType === 1; el = el.parentNode) {
      if (elementoDaSaltare(el)) return true;
    }
    return false;
  }

  function correggiTesto(nodo) {
    const testo = nodo.nodeValue;
    if (!testo || testo.indexOf("-") < 0) return;
    // Formula non ancora composta da MathJax: il sorgente TeX resta com'e'
    // (quando MathJax la compone, il testo intorno torna qui da solo).
    if (/\$|\\\(|\\\[/.test(testo)) return;
    if (dentroDaSaltare(nodo)) return;
    const nuovo = testo.replace(SEGNO, "$1−");
    if (nuovo !== testo) nodo.nodeValue = nuovo;
  }

  function correggi(radice) {
    if (radice.nodeType === 3) {
      correggiTesto(radice);
      return;
    }
    if (radice.nodeType !== 1 || elementoDaSaltare(radice)) return;
    const giro = document.createTreeWalker(radice, NodeFilter.SHOW_TEXT);
    let nodo;
    while ((nodo = giro.nextNode())) correggiTesto(nodo);
  }

  correggi(document.body);
  new MutationObserver(function (cambi) {
    cambi.forEach(function (c) {
      if (c.type === "characterData") correggiTesto(c.target);
      else c.addedNodes.forEach(correggi);
    });
  }).observe(document.body, { childList: true, characterData: true, subtree: true });
})();
