(() => {
  function capturar() {
    try {
      const documentClone = document.documentElement.cloneNode(true);
      const elementosInuteis = documentClone.querySelectorAll('script, style, link[rel="stylesheet"], svg, video, iframe, canvas, noscript');
      elementosInuteis.forEach(elemento => elemento.remove());

      documentClone.querySelectorAll('img, source').forEach(elemento => {
        if (elemento.getAttribute('src')?.startsWith('data:image')) elemento.setAttribute('src', '');
        if (elemento.getAttribute('srcset')?.includes('data:image')) elemento.setAttribute('srcset', '');
      });

      documentClone.querySelectorAll('[style]').forEach(elemento => {
        const estilo = elemento.getAttribute('style');
        if (estilo?.includes('data:image')) elemento.style.backgroundImage = 'none';
      });

      const html = documentClone.outerHTML;
      console.log(`[Content Script] HTML otimizado: ${(html.length / 1024 / 1024).toFixed(2)} MB`);
      return { sucesso: true, html };
    } catch (error) {
      console.error('[Content Script] Erro ao capturar HTML:', error);
      return { sucesso: false, erro: error.toString() };
    }
  }

  globalThis.AmawebDomCapture = { capturar };
})();
