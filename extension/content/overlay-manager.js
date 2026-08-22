(() => {
  function obterCaixaVisivel(elemento) {
    const rect = elemento.getBoundingClientRect();
    const estilo = window.getComputedStyle(elemento);

    // Regras rígidas: Captura elementos com display none, opacity 0, visibility hidden, 
    // fora da tela (negativo) ou com hacks de 1px para Screen Readers.
    const isHiddenVisually = (
      rect.width < 2 || 
      rect.height < 2 || 
      rect.top < -5 || 
      rect.left < -5 || 
      estilo.display === 'none' || 
      estilo.visibility === 'hidden' || 
      estilo.opacity === '0'
    );

    // Se o elemento não é visível a olho nu, não tentamos achar um "pai" para ele.
    // Simplesmente ignoramos a renderização do ícone.
    if (isHiddenVisually) {
      return { rect, oculto: true, ignorarRenderizacao: true };
    }

    return { rect, oculto: false, ignorarRenderizacao: false };
  }

  function criarCamada() {
    document.getElementById('amaweb-overlay-layer')?.remove();
    const camada = document.createElement('div');
    camada.id = 'amaweb-overlay-layer';
    (document.body || document.documentElement).appendChild(camada);
    return camada;
  }

  // NOVA FUNÇÃO UNIFICADA: Cria a caixa e o ícone já amarrados no Modo WAVE
  function adicionarMarcacao(camada, rect, top, left, texto, descricao, tipo, oculto, containers, indexErro, forcarAtivo = false) {
    // 1. Cria a caixa tracejada (Invisível por padrão)
    const caixa = document.createElement('div');
    caixa.className = `amaweb-highlight-box ${tipo}`;
    caixa.style.top = `${top}px`;
    caixa.style.left = `${left}px`;
    caixa.style.width = `${rect.width}px`;
    caixa.style.height = `${rect.height}px`;

    // Só adiciona a caixa na tela se o elemento NÃO for fantasma/oculto
    if (!oculto) {
      camada.appendChild(caixa);
    }

    // 2. Agrupa os ícones próximos para não sobrepor
    let container = containers.find(item => Math.abs(item.top - top) < 15 && Math.abs(item.left - left) < 15);
    if (!container) {
      container = { top, left, elemento: document.createElement('div') };
      container.elemento.className = 'amaweb-badge-container';
      container.elemento.style.top = `${top - 12}px`; // Ajuste para colar no canto superior esquerdo
      container.elemento.style.left = `${left - 12}px`;
      camada.appendChild(container.elemento);
      containers.push(container);
    }

    const badgeWrapper = document.createElement('div');
    badgeWrapper.style.position = 'relative';

    const badge = document.createElement('div');
    badge.className = `amaweb-badge ${tipo}`;
    badge.textContent = tipo === 'error' ? '✖' : '❗';

    // Tooltip em HTML (WAVE Style)
    const tooltip = document.createElement('div');
    tooltip.className = 'amaweb-tooltip-box';
    tooltip.innerHTML = `<strong>${texto}</strong><br><span style="font-size:12px; font-weight:normal;">${descricao}</span>`;

    // Evento de Clique
    badge.addEventListener('click', (e) => {
      e.stopPropagation(); // Evita conflitos
      const jaAtivo = badgeWrapper.classList.contains('ativo');
      
      // Fecha todos os outros abertos e reseta estilos simultaneamente
      document.querySelectorAll('.amaweb-badge-container > div').forEach(el => {
        el.classList.remove('ativo', 'flip');
        
        const boxAssociada = el.getAttribute('data-box-id');
        if(boxAssociada) document.getElementById(boxAssociada)?.classList.remove('ativa');
        
        // Limpa estilos de correção de borda aplicados anteriormente (AGORA DENTRO DO LOOP)
        const tt = el.querySelector('.amaweb-tooltip-box');
        if (tt) {
          tt.style.left = '';
          tt.style.right = '';
        }
      });

      if (!jaAtivo) {
        badgeWrapper.classList.add('ativo');
        if (!oculto) caixa.classList.add('ativa');

        if (indexErro !== undefined) {
          chrome.runtime.sendMessage({ action: 'SCROLL_TO_ERROR', index: indexErro }).catch(() => {});
        }

        // LÓGICA DE DETECÇÃO DE BORDAS DA TELA (Prevenção de corte)
        setTimeout(() => {
          const rect = tooltip.getBoundingClientRect();
          
          // 1. Estourou o Topo? Inverte o tooltip para baixo
          if (rect.top < 10) {
            badgeWrapper.classList.add('flip');
          }
          
          // 2. Estourou a Direita? Prende o tooltip no canto direito
          if (rect.right > window.innerWidth - 10) {
            tooltip.style.left = 'auto';
            tooltip.style.right = '0px';
          }
          
          // 3. Estourou a Esquerda? Prende o tooltip no canto esquerdo
          if (rect.left < 10) {
            tooltip.style.left = '0px';
            tooltip.style.right = 'auto';
          }
        }, 10); 
      }
    });

    // Amarra IDs para ligar o clique do ícone à caixa
    const boxId = 'box-' + Math.random().toString(36).substr(2, 9);
    caixa.id = boxId;
    badgeWrapper.setAttribute('data-box-id', boxId);

    if (forcarAtivo && !oculto) {
      badgeWrapper.classList.add('ativo');
      caixa.classList.add('ativa');
    }

    badgeWrapper.appendChild(badge);
    badgeWrapper.appendChild(tooltip);
    container.elemento.appendChild(badgeWrapper);

  }

  function renderizar(resultados) {
    const camada = criarCamada();
    const containers = [];
    let total = 0;

    

    resultados.forEach((item, indexErro) => {
      const tipo = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável' ? 'error' : 'warning';
      const deveExibir = ['Erro', 'Não aceitável', 'Aviso', 'Para ver manualmente'].includes(item['Tipo de erro']);
      if (!deveExibir || !Array.isArray(item.Elementos?.elementosHtml)) return;

      item.Elementos.elementosHtml.forEach(elemento => {
        if (!elemento.pointer) return;
        try {
          const alvo = document.querySelector(elemento.pointer);
          if (!alvo) return;
          
        
          const { rect, oculto, ignorarRenderizacao } = obterCaixaVisivel(alvo);
          if (ignorarRenderizacao || rect.width > window.innerWidth * 0.9) return;

          const top = rect.top + window.scrollY;
          const left = rect.left + window.scrollX;

          const titulo = `${item.Criterio || 'NBR 17225'}${oculto ? ' (Oculto)' : ''}`;
          const desc = (item.Descricao || item.Elementos.descricao || '').replace(/\{\{value\}\}/g, item.Valor || item['Numero de ocorrencias'] || '1');

          adicionarMarcacao(camada, rect, top, left, titulo, desc, tipo, oculto, containers, indexErro);
          total++;
        } catch (error) {
          console.warn(`[Content Script] Seletor inválido: ${elemento.pointer}`, error);
        }
      });
    });

    console.log(`[Content Script] ${total} falhas renderizadas.`);
  }

function destacar(pointers, tipo, criterio, descricao) {
    // 1. Oculta os resultados gerais sem destruí-los (Resolve o problema 3)
    const camadaPrincipal = document.getElementById('amaweb-overlay-layer');
    if (camadaPrincipal) camadaPrincipal.style.display = 'none';

    // 2. Cria uma camada exclusiva para o destaque
    document.getElementById('amaweb-highlight-layer')?.remove();
    const camadaDestaque = document.createElement('div');
    camadaDestaque.id = 'amaweb-highlight-layer';
    (document.body || document.documentElement).appendChild(camadaDestaque);

    const containers = [];
    let rolouPagina = false;

    pointers.forEach(pointer => {
      try {
        const alvo = document.querySelector(pointer);
        if (!alvo) return;
        
        const { rect, oculto } = obterCaixaVisivel(alvo);
        const top = rect.top + window.scrollY;
        const left = rect.left + window.scrollX;

        // true no final para forçar a caixa e tooltip a aparecerem na hora (Resolve a UX visual)
        adicionarMarcacao(camadaDestaque, rect, top, left, criterio, descricao, tipo, oculto, containers, undefined, true);

        // Rolagem da página de volta para o erro (Resolve o problema 2)
        if (!rolouPagina && !oculto) {
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
    // 1. Remove apenas a camada exclusiva de destaque
    document.getElementById('amaweb-highlight-layer')?.remove();
    
    // 2. Restaura os resultados gerais (Resolve o problema 3)
    const camadaPrincipal = document.getElementById('amaweb-overlay-layer');
    if (camadaPrincipal) camadaPrincipal.style.display = 'block';
  }

  globalThis.AmawebOverlayManager = { renderizar, destacar, limpar };
})();

// Fecha tooltip ao clicar fora dele
  document.addEventListener('click', () => {
    document.querySelectorAll('.amaweb-badge-container > div.ativo').forEach(el => {
      el.classList.remove('ativo', 'flip');
      const boxAssociada = el.getAttribute('data-box-id');
      if(boxAssociada) document.getElementById(boxAssociada)?.classList.remove('ativa');
    });
  });