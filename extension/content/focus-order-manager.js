(() => {
  let itensFocaveis = [];
  let wrapper = null;
  let atualizarAgendado = false;

  function elementoVisivel(elemento) {
    const estilo = window.getComputedStyle(elemento);
    const rect = elemento.getBoundingClientRect();
    return estilo.display !== 'none' &&
      estilo.visibility !== 'hidden' &&
      parseFloat(estilo.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      elemento.getAttribute('aria-hidden') !== 'true';
  }

  function elementoFocavel(elemento) {
    if (elemento.disabled || elemento.closest('[disabled], [inert]')) return false;
    if (elemento.tabIndex < 0 || !elementoVisivel(elemento)) return false;
    if (elemento.closest('[id^="amaweb-"], [class^="amaweb-"], [class*=" amaweb-"]')) return false;
    return true;
  }

  function coletarElementos() {
    const seletor = 'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable="true"]';
    const candidatos = Array.from(document.querySelectorAll(seletor));
    const focaveis = candidatos.filter(elementoFocavel);

    return focaveis
      .map((elemento, ordemDom) => ({ elemento, ordemDom, tabIndex: elemento.tabIndex }))
      .sort((a, b) => {
        const aPositivo = a.tabIndex > 0;
        const bPositivo = b.tabIndex > 0;
        if (aPositivo !== bPositivo) return aPositivo ? -1 : 1;
        if (aPositivo && a.tabIndex !== b.tabIndex) return a.tabIndex - b.tabIndex;
        return a.ordemDom - b.ordemDom;
      })
      .map(item => item.elemento);
  }

  function atualizarPosicoes() {
    if (!wrapper) return;
    wrapper.querySelectorAll('.amaweb-focus-order-marker').forEach((marcador, index) => {
      const elemento = itensFocaveis[index];
      if (!elemento || !elemento.isConnected || !elementoVisivel(elemento)) {
        marcador.style.display = 'none';
        return;
      }

      const rect = elemento.getBoundingClientRect();
      marcador.style.display = 'flex';
      marcador.style.transform = `translate3d(${Math.max(0, rect.left + window.scrollX - 8)}px, ${Math.max(0, rect.top + window.scrollY - 8)}px, 0)`;
    });
  }

  function agendarAtualizacao() {
    if (atualizarAgendado) return;
    atualizarAgendado = true;
    window.requestAnimationFrame(() => {
      atualizarAgendado = false;
      atualizarPosicoes();
    });
  }

  function limpar() {
    wrapper?.remove();
    wrapper = null;
    itensFocaveis = [];
  }

  function renderizar() {
    limpar();
    itensFocaveis = coletarElementos();
    wrapper = document.createElement('div');
    wrapper.id = 'amaweb-focus-order-wrapper';

    itensFocaveis.forEach((elemento, index) => {
      const marcador = document.createElement('button');
      marcador.type = 'button';
      marcador.className = 'amaweb-focus-order-marker';
      marcador.textContent = String(index + 1);
      marcador.title = `Focar no elemento ${index + 1}`;
      marcador.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        elemento.focus({ preventScroll: true });
        elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      wrapper.appendChild(marcador);
    });

    (document.body || document.documentElement).appendChild(wrapper);
    atualizarPosicoes();
  }

  window.addEventListener('scroll', agendarAtualizacao, { capture: true, passive: true });
  window.addEventListener('resize', agendarAtualizacao, { passive: true });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'RENDER_FOCUS_ORDER') {
      renderizar();
      sendResponse({ status: 'ok', count: itensFocaveis.length });
      return true;
    }

    if (message.action === 'CLEAR_FOCUS_ORDER') {
      limpar();
      sendResponse({ status: 'ok' });
      return true;
    }

    if (message.action === 'FOCUS_ORDER_ITEM') {
      const elemento = itensFocaveis[message.index];
      if (!elemento || !elemento.isConnected || !elementoFocavel(elemento)) {
        sendResponse({ status: 'not_found' });
        return true;
      }

      elemento.focus({ preventScroll: true });
      elemento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      sendResponse({ status: 'ok' });
      return true;
    }
  });
})();
