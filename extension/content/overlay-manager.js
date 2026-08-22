(() => {
  function obterCaixaVisivel(elemento) {
    let elementoAtual = elemento;
    let rect = elementoAtual.getBoundingClientRect();
    let niveisSubidos = 0;

    while ((rect.width === 0 || rect.height === 0) && elementoAtual.parentElement && niveisSubidos < 10) {
      elementoAtual = elementoAtual.parentElement;
      rect = elementoAtual.getBoundingClientRect();
      niveisSubidos++;
    }

    return { rect, oculto: niveisSubidos > 0 };
  }

  function criarCamada() {
    document.getElementById('amaweb-overlay-layer')?.remove();
    const camada = document.createElement('div');
    camada.id = 'amaweb-overlay-layer';
    (document.body || document.documentElement).appendChild(camada);
    return camada;
  }

  function adicionarCaixa(camada, rect, tipo, oculto = false) {
    const caixa = document.createElement('div');
    caixa.className = `amaweb-highlight-box ${tipo}`;
    caixa.style.top = `${rect.top + window.scrollY}px`;
    caixa.style.left = `${rect.left + window.scrollX}px`;
    caixa.style.width = `${rect.width}px`;
    caixa.style.height = `${rect.height}px`;
    if (oculto) {
      caixa.style.outlineOffset = '4px';
      caixa.style.outlineStyle = 'dashed';
    }
    camada.appendChild(caixa);
    return caixa;
  }

  function adicionarBadge(camada, top, left, texto, descricao, tipo) {
    const container = document.createElement('div');
    container.className = 'amaweb-badge-container';
    container.style.top = `${top - 26}px`;
    container.style.left = `${left}px`;

    const badge = document.createElement('div');
    badge.className = `amaweb-badge ${tipo}`;
    badge.textContent = texto;
    badge.setAttribute('data-description', descricao);
    container.appendChild(badge);
    camada.appendChild(container);
  }

  function renderizar(resultados) {
    const camada = criarCamada();
    const containers = [];
    let total = 0;

    resultados.forEach(item => {
      const tipo = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável' ? 'error' : 'warning';
      const deveExibir = ['Erro', 'Não aceitável', 'Aviso', 'Para ver manualmente'].includes(item['Tipo de erro']);
      if (!deveExibir || !Array.isArray(item.Elementos?.elementosHtml)) return;

      item.Elementos.elementosHtml.forEach(elemento => {
        if (!elemento.pointer) return;
        try {
          const alvo = document.querySelector(elemento.pointer);
          if (!alvo) return;
          const { rect, oculto } = obterCaixaVisivel(alvo);
          if (rect.width === 0 || rect.height === 0 || rect.width > window.innerWidth * 0.9) return;

          const top = rect.top + window.scrollY;
          const left = rect.left + window.scrollX;
          adicionarCaixa(camada, rect, tipo, oculto);
          let container = containers.find(item => Math.abs(item.top - top) < 15 && Math.abs(item.left - left) < 15);
          if (!container) {
            container = { top, left, elemento: document.createElement('div') };
            container.elemento.className = 'amaweb-badge-container';
            container.elemento.style.top = `${top - 26}px`;
            container.elemento.style.left = `${left}px`;
            camada.appendChild(container.elemento);
            containers.push(container);
          }

          const badge = document.createElement('div');
          badge.className = `amaweb-badge ${tipo}`;
          badge.textContent = `${item.Criterio || 'NBR 17225'}${oculto ? '*' : ''}`;
          const descricao = (item.Descricao || item.Elementos.descricao || '').replace(/\{\{value\}\}/g, item.Valor || item['Numero de ocorrencias'] || '1');
          badge.setAttribute('data-description', descricao + (oculto ? ' (Erro em elemento oculto)' : ''));
          container.elemento.appendChild(badge);
          total++;
        } catch (error) {
          console.warn(`[Content Script] Seletor inválido: ${elemento.pointer}`, error);
        }
      });
    });

    console.log(`[Content Script] ${total} falhas renderizadas.`);
  }

  function destacar(pointers, tipo, criterio, descricao) {
    const camada = criarCamada();
    let rolouPagina = false;

    pointers.forEach(pointer => {
      try {
        const alvo = document.querySelector(pointer);
        if (!alvo) return;
        const { rect, oculto } = obterCaixaVisivel(alvo);
        if (rect.width === 0 || rect.height === 0) return;
        const top = rect.top + window.scrollY;
        const left = rect.left + window.scrollX;
        adicionarCaixa(camada, rect, tipo, oculto);
        adicionarBadge(camada, top, left, `${criterio || 'NBR'}${oculto ? '*' : ''}`, `${descricao || 'Erro detectado.'}${oculto ? ' (Erro em elemento oculto)' : ''}`, tipo);

        if (!rolouPagina) {
          rolouPagina = true;
          const centroDaTelaY = top - (window.innerHeight / 2) + (rect.height / 2);
          window.setTimeout(() => window.scrollTo({ top: centroDaTelaY, behavior: 'smooth' }), 100);
        }
      } catch (error) {
        console.warn(`[Content Script] Seletor inválido: ${pointer}`, error);
      }
    });
  }

  function limpar() {
    document.getElementById('amaweb-overlay-layer')?.remove();
  }

  globalThis.AmawebOverlayManager = { renderizar, destacar, limpar };
})();
