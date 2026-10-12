(() => {
  const memoriaHtml = new Map();

  function obterCaixaVisivel(elemento) {
    const tag = elemento.tagName.toLowerCase();

    // Elementos de estrutura que nunca são visíveis
    if (['html', 'body', 'head', 'meta', 'title', 'script', 'style', 'link'].includes(tag)) {
      return { rect: { top: 15, left: 15, width: 0, height: 0 }, oculto: false, ignorarRenderizacao: false };
    }

    const rect = elemento.getBoundingClientRect();
    const estilo = window.getComputedStyle(elemento);
    
    const absoluteLeft = rect.left + window.scrollX;
    const absoluteTop = rect.top + window.scrollY;

    // A MÁGICA: Deteta se o elemento foi atirado para fora do documento (o clássico truque dos skip links)
    const isOffDocument = (absoluteLeft < -10 || absoluteTop < -10);
    
    const isClipped = (estilo.clip && estilo.clip !== 'auto' && estilo.clip !== 'none') || 
                      (estilo.clipPath && estilo.clipPath !== 'none');

    const isHiddenVisually = (
      rect.width <= 2 || 
      rect.height <= 2 || 
      estilo.display === 'none' || 
      estilo.visibility === 'hidden' || 
      parseFloat(estilo.opacity) < 0.1 ||
      isOffDocument ||
      isClipped
    );

    // REGRA DE OURO: Se é invisível, avisa o painel (Oculto) e NUNCA renderiza a bolinha no overlay
    return { rect, oculto: isHiddenVisually, ignorarRenderizacao: isHiddenVisually };
  }

  function extrairRota(urlStr) {
    if (!urlStr) return '';
    try {
      const u = new URL(urlStr, window.location.origin);
      return decodeURIComponent(u.pathname + u.search + u.hash).replace(/\/$/, '');
    } catch(e) {
      return urlStr;
    }
  }

  function ehFixoOuSticky(elemento) {
    let curr = elemento;
    while (curr && curr !== document.body && curr !== document.documentElement) {
      const style = window.getComputedStyle(curr);
      if (style.position === 'fixed' || style.position === 'sticky') {
        return true;
      }
      curr = curr.parentElement;
    }
    return false;
  }

  function encontrarElementoRobusto(pointer, htmlCodeDica) {
    const htmlOriginal = htmlCodeDica || memoriaHtml.get(pointer);
    let tag = '', txt = '', href = '', src = '', id = '';

    if (htmlOriginal) {
      try {
        const temp = document.createElement('div');
        temp.innerHTML = htmlOriginal;
        const el = temp.firstElementChild;
        if (el) {
          tag = el.tagName.toLowerCase();
          txt = el.textContent.trim();
          href = el.getAttribute('href');
          src = el.getAttribute('src');
          id = el.id;
        }
      } catch (error) {
        console.debug('[Content Script] HTML de referência inválido:', error);
      }
    }

    try {
      const exato = document.querySelector(pointer);
      if (exato) {
        let isValido = true;
        if (tag && exato.tagName.toLowerCase() !== tag) isValido = false;
        if (txt && txt.length > 1 && exato.textContent) {
          const exatoTxt = exato.textContent.trim();
          if (!exatoTxt.includes(txt) && !txt.includes(exatoTxt)) isValido = false;
        }
        if (isValido) return exato;
      }
    } catch (error) {
      console.debug('[Content Script] Seletor de referência inválido:', error);
    }

    if (!htmlOriginal || !tag) return null;

    if (id) {
      const cand = document.getElementById(id);
      if (cand) return cand;
    }

    const rotaAlvoHref = extrairRota(href);
    const rotaAlvoSrc = extrairRota(src);
    let candidatosValidos = [];

    if (rotaAlvoHref || rotaAlvoSrc) {
      const candidatos = document.querySelectorAll(tag);
      for (const cand of candidatos) {
        let match = false;
        if (rotaAlvoHref && cand.hasAttribute('href') && extrairRota(cand.getAttribute('href')) === rotaAlvoHref) match = true;
        if (rotaAlvoSrc && cand.hasAttribute('src') && extrairRota(cand.getAttribute('src')) === rotaAlvoSrc) match = true;

        if (match) {
          if (!txt || !cand.textContent || cand.textContent.trim().includes(txt) || txt.includes(cand.textContent.trim())) {
            candidatosValidos.push(cand);
          }
        }
      }
    }

    if (candidatosValidos.length === 0 && !rotaAlvoHref && !rotaAlvoSrc && txt.length > 2) {
      const candidatos = document.querySelectorAll(tag);
      for (const cand of candidatos) {
        if (cand.textContent.trim() === txt) {
          candidatosValidos.push(cand);
        }
      }
    }

    if (candidatosValidos.length === 1) return candidatosValidos[0];

    if (candidatosValidos.length > 1) {
      const tagsDoPointer = pointer.split('>').map(p => p.trim().split(':')[0].toLowerCase());
      let melhorCand = null;
      let maiorScore = -1;

      for (const cand of candidatosValidos) {
        const tagsDoCand = [];
        let curr = cand;
        while (curr && curr.tagName) {
          tagsDoCand.unshift(curr.tagName.toLowerCase());
          curr = curr.parentElement;
        }

        let score = 0;
        let pIdx = tagsDoPointer.length - 1;
        let cIdx = tagsDoCand.length - 1;

        while (pIdx >= 0 && cIdx >= 0) {
          if (tagsDoPointer[pIdx] === tagsDoCand[cIdx]) {
            score++; pIdx--; cIdx--;
          } else if (cIdx > 0 && tagsDoPointer[pIdx] === tagsDoCand[cIdx - 1]) {
            cIdx--; 
          } else { break; }
        }

        if (score > maiorScore) {
          maiorScore = score;
          melhorCand = cand;
        }
      }
      if (melhorCand) return melhorCand;
    }

    return null;
  }

  function criarCamadas(idPrefix) {
    document.getElementById(`${idPrefix}-wrapper`)?.remove();
    
    const wrapper = document.createElement('div');
    wrapper.id = `${idPrefix}-wrapper`;
    wrapper.style.cssText = 'position: static; z-index: 2147483647; pointer-events: none;';

    const absolute = document.createElement('div');
    absolute.id = `${idPrefix}-absolute`;
    absolute.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; overflow: visible !important; z-index: 2147483646 !important; pointer-events: none !important;';

    const fixed = document.createElement('div');
    fixed.id = `${idPrefix}-fixed`;
    fixed.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 2147483647 !important; pointer-events: none !important;';

    wrapper.appendChild(absolute);
    wrapper.appendChild(fixed);
    (document.body || document.documentElement).appendChild(wrapper);

    return { absolute, fixed };
  }

  function adicionarMarcacao(camadas, rect, texto, descricao, tipo, oculto, containers, indexErro, forcarAtivo = false, seletorCss = '', htmlDica = '', alvoDOM = null) {
    const isFixed = ehFixoOuSticky(alvoDOM);
    const camadaAtiva = isFixed ? camadas.fixed : camadas.absolute;

    const targetX = isFixed ? rect.left : rect.left + window.scrollX;
    const targetY = isFixed ? rect.top : rect.top + window.scrollY;

    const caixa = document.createElement('div');
    caixa.className = `amaweb-highlight-box ${tipo}`;
    caixa.style.top = `0px`;
    caixa.style.left = `0px`;
    
    // Garante que a caixa nunca seja menor que 24x24 (para não sumir em elementos 1x1)
    caixa.style.width = `${Math.max(rect.width, 24)}px`;
    caixa.style.height = `${Math.max(rect.height, 24)}px`;
    // Trava a caixa para que nunca fuja para fora do limite superior ou esquerdo
    let boxX = targetX < 2 ? 2 : targetX;
    let boxY = targetY < 2 ? 2 : targetY;
    caixa.style.transform = `translate3d(${boxX}px, ${boxY}px, 0)`;

    // Removemos o limite de 95% para revelar a caixa de elementos estruturais gigantes!
    // Como a caixa tem pointer-events: none e position: absolute, NÃO estraga o layout.
    camadaAtiva.appendChild(caixa);

    // A bolinha deve ficar ancorada, mas NUNCA vazar pelas bordas superior e esquerda da página
    let badgeX = targetX - 12;
    let badgeY = targetY - 12;
    if (badgeX < 10) badgeX = 10;
    if (badgeY < 10) badgeY = 10;
    
    let container = containers.find(item => Math.abs(item.targetX - targetX) < 60 && Math.abs(item.targetY - targetY) < 60 && item.isFixed === isFixed);

    if (!container) {
      container = { targetX, targetY, isFixed, elemento: document.createElement('div') };
      container.elemento.className = 'amaweb-badge-container';
      container.elemento.style.top = `0px`; 
      container.elemento.style.left = `0px`;
      container.elemento.style.transform = `translate3d(${badgeX}px, ${badgeY}px, 0)`;
      camadaAtiva.appendChild(container.elemento);
      containers.push(container);
    }

    // --- NOVA DESDUPLICAÇÃO FÍSICA E INTELIGENTE ---
    // Compara os ELEMENTOS FÍSICOS REAIS em vez dos seletores de texto
    const badgeDuplicado = Array.from(container.elemento.children).find(wrapper => {
      const isMesmoAlvo = wrapper.alvoDOM === alvoDOM; // O Nó HTML é o mesmo?
      const isMesmoTitulo = wrapper.querySelector('.amaweb-tooltip-box strong')?.textContent.trim() === texto.trim();
      return isMesmoAlvo && isMesmoTitulo;
    });

    if (badgeDuplicado) {
      // Se já existe, regista este novo pointer na bolinha existente para que 
      // as setinhas de ambos os cartões do painel consigam encontrar e clicar nela.
      let pointersSalvos = badgeDuplicado.getAttribute('data-pointer') || '';
      if (!pointersSalvos.includes(seletorCss)) {
        badgeDuplicado.setAttribute('data-pointer', pointersSalvos + ',' + seletorCss);
      }
      return; // Aborta a criação da bolinha gémea
    }
    // -----------------------------------------------

    const badgeWrapper = document.createElement('div');
    badgeWrapper.style.position = 'relative';
    badgeWrapper.alvoDOM = alvoDOM; 
    badgeWrapper.isFixed = isFixed; 

    const badge = document.createElement('div');
    badge.className = `amaweb-badge ${tipo}`;
    badge.textContent = tipo === 'error' ? '✕' : '!';

    const tooltip = document.createElement('div');
    tooltip.className = 'amaweb-tooltip-box';
    const strong = document.createElement('strong');
    strong.textContent = texto;
    tooltip.appendChild(strong);
    tooltip.appendChild(document.createElement('br'));
    
    const span = document.createElement('span');
    span.style.fontSize = '12px';
    span.style.fontWeight = 'normal';
    span.textContent = descricao;
    tooltip.appendChild(span);

    // NOVO MOTOR INSTANTÂNEO DE BALÕES (Sem Timeout)
    const ajustarPosicaoTooltip = () => {
      const badgeRect = badge.getBoundingClientRect();
      
      if (badgeRect.top < 180) {
        badgeWrapper.classList.add('flip');
      } else {
        badgeWrapper.classList.remove('flip');
      }

      tooltip.classList.remove('align-left', 'align-right');
      
      void tooltip.offsetHeight; // Hack de Reflow
      
      const rectT = tooltip.getBoundingClientRect();
      if (rectT.left < 5) {
        tooltip.classList.add('align-left');
      } else if (rectT.right > window.innerWidth - 5) {
        tooltip.classList.add('align-right');
      }
    };

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault(); 
      const jaAtivo = badgeWrapper.classList.contains('ativo');
      
      document.querySelectorAll('.amaweb-badge-container').forEach(cont => cont.style.setProperty('z-index', '3', 'important'));
      document.querySelectorAll('.amaweb-badge-container > div').forEach(el => {
        el.classList.remove('ativo', 'flip');
        el.style.setProperty('z-index', '1', 'important'); 
        const boxId = el.getAttribute('data-box-id');
        const caixaDom = document.getElementById(boxId);
        if(caixaDom) {
          caixaDom.classList.remove('ativa');
          caixaDom.style.setProperty('z-index', '1', 'important');
        }
      });

      if (!jaAtivo) {
        badgeWrapper.classList.add('ativo');
        badgeWrapper.style.setProperty('z-index', '999999', 'important');
        container.elemento.style.setProperty('z-index', '999999', 'important'); 
        
        // A caixa VAI aparecer sempre que for ativada (removido o if !oculto)
        caixa.classList.add('ativa');
        caixa.style.setProperty('z-index', '999998', 'important'); 

        // A MÁGICA: Forçar o foco no elemento para que o site revele menus e skip links
        if (alvoDOM && typeof alvoDOM.focus === 'function') {
           alvoDOM.focus({ preventScroll: true });
        }

        ajustarPosicaoTooltip();
        
        // Atualiza as posições da caixa imediatamente para acompanhar o elemento que acabou de aparecer
        setTimeout(atualizarPosicoes, 50);
        setTimeout(atualizarPosicoes, 250);

        if (e.isTrusted) {
          chrome.runtime.sendMessage({ action: 'SCROLL_TO_ERROR', titulo: texto, index: indexErro })
            .catch(error => console.debug('[Content Script] Painel indisponível para rolagem:', error));
        }
      }
    });

    const boxId = 'box-' + Math.random().toString(36).substr(2, 9);
    caixa.id = boxId;
    badgeWrapper.setAttribute('data-box-id', boxId);
    badgeWrapper.setAttribute('data-pointer', seletorCss);

    // 1. FORÇA OS INATIVOS PARA O FUNDO
    badgeWrapper.style.setProperty('z-index', '1', 'important');

    if (forcarAtivo) { 
      badgeWrapper.classList.add('ativo'); 
      
      // A caixa VAI aparecer sempre que for ativada (removido o if !oculto)
      caixa.classList.add('ativa');
      caixa.style.setProperty('z-index', '999998', 'important'); 
      
      // 2. ELEVAÇÃO DUPLA
      badgeWrapper.style.setProperty('z-index', '999999', 'important');
      container.elemento.style.setProperty('z-index', '999999', 'important');

      ajustarPosicaoTooltip();
      setTimeout(ajustarPosicaoTooltip, 300); 
    }

    badgeWrapper.appendChild(badge);
    badgeWrapper.appendChild(tooltip);
    container.elemento.appendChild(badgeWrapper);
  }

  function atualizarPosicoes() {
    const containers = document.querySelectorAll('.amaweb-badge-container');
    
    for (let i = 0; i < containers.length; i++) {
      const container = containers[i];
      const badgeWrapper = container.firstElementChild;
      if (!badgeWrapper) continue;
      
      let alvo = badgeWrapper.alvoDOM;
      
      if (!alvo || !alvo.isConnected) {
        const pointer = badgeWrapper.getAttribute('data-pointer');
        const htmlDica = memoriaHtml.get(pointer) || '';
        alvo = encontrarElementoRobusto(pointer, htmlDica);
        badgeWrapper.alvoDOM = alvo; 
      }
      
      const boxId = badgeWrapper.getAttribute('data-box-id');
      const caixa = document.getElementById(boxId);

      if (alvo) {
        const { rect, oculto, ignorarRenderizacao } = obterCaixaVisivel(alvo);
        
        if (ignorarRenderizacao) {
          container.style.display = 'none';
          if (caixa) caixa.style.display = 'none';
        } else {
          container.style.display = 'flex';
          if (caixa) caixa.style.display = 'block';
          
          const isFixed = badgeWrapper.isFixed;
          const targetX = isFixed ? rect.left : rect.left + window.scrollX;
          const targetY = isFixed ? rect.top : rect.top + window.scrollY;
          
          let badgeX = targetX - 12;
          let badgeY = targetY - 12;
          if (badgeX < 10) badgeX = 10;
          if (badgeY < 10) badgeY = 10;

          container.style.transform = `translate3d(${badgeX}px, ${badgeY}px, 0)`;
          if (caixa) {
            let boxX = targetX < 2 ? 2 : targetX;
            let boxY = targetY < 2 ? 2 : targetY;
            caixa.style.transform = `translate3d(${boxX}px, ${boxY}px, 0)`;
            caixa.style.width = `${Math.max(rect.width, 24)}px`;
            caixa.style.height = `${Math.max(rect.height, 24)}px`;
          }
        }
      } else {
        container.style.display = 'none';
        if (caixa) caixa.style.display = 'none';
      }
    }
  }

  function renderizar(resultados) {
    const camadas = criarCamadas('amaweb-overlay');
    const containers = [];
    memoriaHtml.clear();

    resultados.forEach((item, indexErro) => {
      const tipo = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável' ? 'error' : 'warning';
      const deveExibir = ['Erro', 'Não aceitável', 'Aviso', 'Para ver manualmente'].includes(item['Tipo de erro']);
      if (!deveExibir || !Array.isArray(item.Elementos?.elementosHtml)) return;

      item.Elementos.elementosHtml.forEach(elemento => {
        if (!elemento.pointer) return;
        if (elemento.htmlCode) memoriaHtml.set(elemento.pointer, elemento.htmlCode);

        try {
          const cleanPointer = elemento.pointer.replace(/:[a-zA-Z-]+/g, '');
          const alvo = encontrarElementoRobusto(cleanPointer, elemento.htmlCode);
          
          if (!alvo) return;
          
          const { rect, oculto, ignorarRenderizacao } = obterCaixaVisivel(alvo);
          if (ignorarRenderizacao) return; 

          const titulo = `${item.Criterio || 'NBR 17225'}${oculto ? ' (Oculto)' : ''}`;
          
          let valorReal = item['Numero de ocorrencias'] || '1';
          if (item.Valor !== undefined && item.Valor !== null && item.Valor !== '') {
            valorReal = item.Valor;
          }
          let desc = (item.Descricao || item.Elementos.descricao || '').replace(/\{\{value\}\}/g, valorReal);
          desc = desc.replace('1 cabeçalhos', '1 cabeçalho').replace('1 elementos', '1 elemento');

          adicionarMarcacao(camadas, rect, titulo, desc, tipo, oculto, containers, indexErro, false, cleanPointer, elemento.htmlCode, alvo);
        } catch (error) {
          console.warn(`[Content Script] Erro na renderização: ${elemento.pointer}`, error);
        }
      });
    });
  }

  function destacar(pointers, tipo, criterio, descricao, dicasHtml = {}) {
    const wrapperAntigo = document.getElementById('amaweb-overlay-wrapper');
    if (wrapperAntigo) wrapperAntigo.style.setProperty('display', 'none', 'important');
    document.getElementById('amaweb-highlight-wrapper')?.remove(); 
    
    const camadas = criarCamadas('amaweb-highlight');
    const containers = [];
    let abriuPrimeiroTooltip = false;
    let elementosEncontrados = 0;

    pointers.forEach(pointer => {
      try {
        const cleanPointer = pointer.replace(/:[a-zA-Z-]+/g, '');
        const alvo = encontrarElementoRobusto(cleanPointer, dicasHtml[pointer]);
        
        if (!alvo) return;
        
        const { rect, oculto, ignorarRenderizacao } = obterCaixaVisivel(alvo);
        if (ignorarRenderizacao) return; 

        elementosEncontrados++;
        
        const deveAbrirTooltip = !abriuPrimeiroTooltip && !oculto;
        adicionarMarcacao(camadas, rect, criterio, descricao, tipo, oculto, containers, undefined, deveAbrirTooltip, cleanPointer, dicasHtml[pointer], alvo);

        if (deveAbrirTooltip) {
          abriuPrimeiroTooltip = true;
          window.setTimeout(() => {
            alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            alvo.classList.add('amaweb-piscar-foco');
            setTimeout(() => alvo.classList.remove('amaweb-piscar-foco'), 2000);
            
          }, 150);
        }
      } catch (error) {
        console.warn(`[Content Script] Erro ao destacar: ${pointer}`, error);
      }
    });

    return elementosEncontrados;
  }

  function removerDestaque() {
    // 1. Remove a camada de destaque (vermelha)
    document.getElementById('amaweb-highlight-wrapper')?.remove();
    
    const wrapperAntigo = document.getElementById('amaweb-overlay-wrapper');
    if (wrapperAntigo) {
      // 2. Devolve a visibilidade às bolinhas normais (amarelas)
      wrapperAntigo.style.removeProperty('display');
      
      // 3. LIMPEZA FORÇADA: Finge um "clique fora" para fechar qualquer balão ou borda 
      // que tenha ficado esquecido aberto nesta camada.
      wrapperAntigo.querySelectorAll('.amaweb-badge-container').forEach(cont => {
        cont.style.setProperty('z-index', '3', 'important');
      }); 

      wrapperAntigo.querySelectorAll('.amaweb-badge-container > div.ativo').forEach(el => {
        el.classList.remove('ativo', 'flip');
        el.style.setProperty('z-index', '1', 'important'); // Rebaixa bolinhas
        
        const boxAssociada = el.getAttribute('data-box-id');
        if (boxAssociada) {
          const caixaDom = document.getElementById(boxAssociada);
          if (caixaDom) {
            caixaDom.classList.remove('ativa');
            caixaDom.style.setProperty('z-index', '1', 'important'); // Remove a borda pontilhada
          }
        }
      });
    }
    
    document.querySelectorAll('.amaweb-piscar-foco').forEach(el => el.classList.remove('amaweb-piscar-foco'));
  }

  function limparTudo() {
    document.getElementById('amaweb-highlight-wrapper')?.remove();
    document.getElementById('amaweb-overlay-wrapper')?.remove();
    document.querySelectorAll('.amaweb-piscar-foco').forEach(el => el.classList.remove('amaweb-piscar-foco'));
  }

  globalThis.AmawebOverlayManager = { renderizar, destacar, removerDestaque, limparTudo, obterCaixaVisivel };

  document.addEventListener('click', (e) => {
    // PROTEÇÃO INFALÍVEL: Se clicou em qualquer parte da nossa extensão (bolinha, balão, caixa), ignora.
    // Só fecha se o clique for puramente no fundo do site (o que cobre o Alt+Tab seguro).
    if (e.target.closest('#amaweb-overlay-wrapper, #amaweb-highlight-wrapper, .amaweb-badge-container')) {
       return; 
    }

    document.querySelectorAll('.amaweb-badge-container').forEach(cont => {
      cont.style.setProperty('z-index', '3', 'important');
    }); 

    document.querySelectorAll('.amaweb-badge-container > div.ativo').forEach(el => {
      el.classList.remove('ativo', 'flip');
      el.style.setProperty('z-index', '1', 'important'); // Rebaixa bolinhas vizinhas
      const boxAssociada = el.getAttribute('data-box-id');
      const caixaDom = document.getElementById(boxAssociada);
      if(caixaDom) {
        caixaDom.classList.remove('ativa');
        caixaDom.style.setProperty('z-index', '1', 'important'); // Rebaixa borda tracejada
      }
    });
  });

  let isScrolling = false;
  window.addEventListener('scroll', () => {
    if (!isScrolling) {
      window.requestAnimationFrame(() => {
        atualizarPosicoes();
        isScrolling = false;
      });
      isScrolling = true;
    }
  }, { capture: true, passive: true });

  let debounceTimer;
  window.addEventListener('resize', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(atualizarPosicoes, 100);
  });
  
  document.addEventListener('click', () => {
    setTimeout(atualizarPosicoes, 250); 
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'HIGHLIGHT_V2') {
      const encontrados = destacar(message.pointers, message.tipo, message.criterio, message.descricao, message.dicasHtml);
      sendResponse({ status: 'ok', encontrados: encontrados });
      return true;
    }

    if (message.action === 'CLEAR_V2' || message.action === 'CLEAR_HIGHLIGHT') {
      removerDestaque();
      sendResponse({ status: 'ok' });
      return true;
    }

    if (message.action === 'FILTER_V2') {
      const validPointers = message.pointers.filter(pointer => {
        const dicaHtml = message.dicasHtml ? message.dicasHtml[pointer] : '';
        const alvo = encontrarElementoRobusto(pointer, dicaHtml);
        if (!alvo) return false; 
        return !obterCaixaVisivel(alvo).ignorarRenderizacao;
      });
      sendResponse({ validPointers });
      return true; 
    }

    if (message.action === 'FOCUS_V2') {
      try {
        const dicaHtml = message.dicasHtml ? message.dicasHtml[message.pointer] : '';
        const alvo = encontrarElementoRobusto(message.pointer, dicaHtml);
        
        if (!alvo) {
          sendResponse({ status: 'not_found' });
          return true;
        }

        const { ignorarRenderizacao } = obterCaixaVisivel(alvo);
        if (ignorarRenderizacao) {
          sendResponse({ status: 'hidden' });
          return true;
        }

        const cleanPointer = message.pointer.replace(/:[a-zA-Z-]+/g, '');
        
        const highlightWrapper = document.getElementById('amaweb-highlight-wrapper');
        const activeWrapper = highlightWrapper ? highlightWrapper : document.getElementById('amaweb-overlay-wrapper');
        
        const todasBolinhas = activeWrapper ? activeWrapper.querySelectorAll('.amaweb-badge-container > div') : [];
        let encontrou = false;
        
        todasBolinhas.forEach(badgeWrapper => {
          // Agora lê a lista de pointers separados por vírgula que gravámos
          const pointers = (badgeWrapper.getAttribute('data-pointer') || '').split(',');
          
          if (pointers.includes(cleanPointer)) {
            encontrou = true;
            const badgeIcon = badgeWrapper.querySelector('.amaweb-badge');
            
            if (badgeIcon && !badgeWrapper.classList.contains('ativo')) {
              badgeIcon.click(); 
            }
          }
        });

        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        alvo.classList.add('amaweb-piscar-foco');
        setTimeout(() => alvo.classList.remove('amaweb-piscar-foco'), 2000);

        sendResponse({ status: encontrou ? 'visible' : 'hidden' });

      } catch (e) {
        sendResponse({ status: 'error' });
      }
      return true;
    }

    if (message.action === 'RENDER_OVERLAYS') {
      renderizar(Array.isArray(message.data) ? message.data : []);
      sendResponse({ status: 'ok' });
      return true;
    }

    if (message.action === 'CLEAR_OVERLAYS') {
      limparTudo();
      sendResponse({ status: 'ok' });
      return true;
    }
  });
})();