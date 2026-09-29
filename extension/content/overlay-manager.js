(() => {
  const memoriaHtml = new Map();

  function obterCaixaVisivel(elemento) {
    const tag = elemento.tagName.toLowerCase();

    // 1. TRATAMENTO DE CAIXA FANTASMA (Tags globais ou de cabeçalho)
    if (['html', 'body', 'head', 'meta', 'title', 'script', 'style', 'link'].includes(tag)) {
      // Retorna uma coordenada fixa no canto da tela com tamanho 0x0
      return { 
        rect: { top: 15, left: 15, width: 0, height: 0 }, 
        oculto: false, 
        ignorarRenderizacao: false 
      };
    }

    // 2. Elementos normais
    const rect = elemento.getBoundingClientRect();
    const estilo = window.getComputedStyle(elemento);

    const isHiddenVisually = (
      rect.width < 2 || 
      rect.height < 2 || 
      estilo.display === 'none' || 
      estilo.visibility === 'hidden' || 
      estilo.opacity === '0'
    );

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

  // Descobre se o elemento é estático ou preso na tela (fixed/sticky)
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
      } catch(e){}
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
    } catch(e) {}

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

  // =======================================================================
  // ARQUITETURA DE DUAS CAMADAS: O Fim do Delay e das Bolinhas Voadoras
  // =======================================================================
  function criarCamadas(idPrefix) {
    document.getElementById(`${idPrefix}-wrapper`)?.remove();
    
    const wrapper = document.createElement('div');
    wrapper.id = `${idPrefix}-wrapper`;
    wrapper.style.cssText = 'position: static; z-index: 2147483647; pointer-events: none;';

    // Camada que rola com o documento (zero delay nativo)
    const absolute = document.createElement('div');
    absolute.id = `${idPrefix}-absolute`;
    absolute.style.cssText = 'position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; height: 0 !important; overflow: visible !important; z-index: 2147483646 !important; pointer-events: none !important;';

    // Camada que gruda na tela (zero delay para menus fixos/sticky)
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
    caixa.style.width = `${rect.width}px`;
    caixa.style.height = `${rect.height}px`;
    caixa.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;

    if (!oculto) camadaAtiva.appendChild(caixa);

    // RAIO AUMENTADO PARA 60 PIXELS: "Engole" todos os botões próximos em um grupo só
    let container = containers.find(item => Math.abs(item.targetX - targetX) < 60 && Math.abs(item.targetY - targetY) < 60 && item.isFixed === isFixed);
    
    if (!container) {
      container = { targetX, targetY, isFixed, elemento: document.createElement('div') };
      container.elemento.className = 'amaweb-badge-container';
      container.elemento.style.top = `0px`; 
      container.elemento.style.left = `0px`;
      container.elemento.style.transform = `translate3d(${targetX - 12}px, ${targetY - 12}px, 0)`;
      camadaAtiva.appendChild(container.elemento);
      containers.push(container);
    }

    // BLOQUEIO TOTAL DE REPETIÇÃO: Se este grupo já tem um erro com esse nome, cancela a nova bolinha
    const titulosNoContainer = Array.from(container.elemento.querySelectorAll('.amaweb-tooltip-box strong')).map(el => el.textContent.trim());
    if (titulosNoContainer.includes(texto.trim())) {
      return; 
    }

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

    // === NOVA FUNÇÃO: Calcula a posição do balão ===
    const ajustarPosicaoTooltip = () => {
      const badgeRect = badge.getBoundingClientRect();
      
      // Se a bolinha estiver muito perto do teto do ecrã, inverte para baixo
      if (badgeRect.top < 180) {
        badgeWrapper.classList.add('flip');
      } else {
        badgeWrapper.classList.remove('flip');
      }

      // Evita cortes nas laterais do ecrã
      setTimeout(() => {
        // Zera os estilos inline primeiro para poder recalcular
        tooltip.style.left = ''; 
        tooltip.style.right = ''; 
        tooltip.style.transform = ''; 
        
        const rectT = tooltip.getBoundingClientRect();
        if (rectT.right > window.innerWidth) { 
          tooltip.style.left = 'auto'; 
          tooltip.style.right = '0px'; 
          tooltip.style.transform = 'none'; 
        } else if (rectT.left < 0) { 
          tooltip.style.left = '0px'; 
          tooltip.style.right = 'auto'; 
          tooltip.style.transform = 'none'; 
        }
      }, 10);
    };
    // ===============================================

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault(); 
      const jaAtivo = badgeWrapper.classList.contains('ativo');
      
      document.querySelectorAll('.amaweb-badge-container').forEach(cont => cont.style.setProperty('z-index', '3', 'important'));
      document.querySelectorAll('.amaweb-badge-container > div').forEach(el => {
        el.classList.remove('ativo', 'flip');
        el.style.removeProperty('z-index');
        const box = el.getAttribute('data-box-id');
        if(box) document.getElementById(box)?.classList.remove('ativa');
        const tt = el.querySelector('.amaweb-tooltip-box');
        if (tt) { tt.style.left = ''; tt.style.right = ''; tt.style.transform = ''; }
      });

      if (!jaAtivo) {
        badgeWrapper.classList.add('ativo');
        badgeWrapper.style.setProperty('z-index', '999999', 'important');
        container.elemento.style.setProperty('z-index', '999999', 'important'); 
        if (!oculto) caixa.classList.add('ativa');

        ajustarPosicaoTooltip(); // 1. Executa no Clique Manual

        // Envia o Título e o Index Único do erro para evitar saltar para um card homônimo
        chrome.runtime.sendMessage({ action: 'SCROLL_TO_ERROR', titulo: texto, index: indexErro }).catch(() => {});
      }
    });

    const boxId = 'box-' + Math.random().toString(36).substr(2, 9);
    caixa.id = boxId;
    badgeWrapper.setAttribute('data-box-id', boxId);
    badgeWrapper.setAttribute('data-pointer', seletorCss);

    if (forcarAtivo && !oculto) { 
      badgeWrapper.classList.add('ativo'); 
      caixa.classList.add('ativa'); 
      
      ajustarPosicaoTooltip(); // 2. Executa imediatamente no Destacar do painel
      
      // 3. Executa novamente após meio segundo para corrigir a posição 
      // caso o scroll suave (smooth scroll) mova o elemento de sítio
      setTimeout(ajustarPosicaoTooltip, 500);
    }

    badgeWrapper.appendChild(badge);
    badgeWrapper.appendChild(tooltip);
    container.elemento.appendChild(badgeWrapper);
  }

  // Motor Unificado: Atualiza apenas as modificações dinâmicas sem pesar a rolagem natural
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
          
          container.style.transform = `translate3d(${targetX - 12}px, ${targetY - 12}px, 0)`;
          if (caixa) {
            caixa.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
            caixa.style.width = `${rect.width}px`;
            caixa.style.height = `${rect.height}px`;
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
          // CORREÇÃO AQUI: Limpa o pointer na renderização inicial também!
          const cleanPointer = elemento.pointer.replace(/:[a-zA-Z-]+/g, '');
          const alvo = encontrarElementoRobusto(cleanPointer, elemento.htmlCode);
          
          if (!alvo) return;
          
          const { rect, oculto, ignorarRenderizacao } = obterCaixaVisivel(alvo);
          if (ignorarRenderizacao || rect.width > window.innerWidth * 0.9) return;

          const titulo = `${item.Criterio || 'NBR 17225'}${oculto ? ' (Oculto)' : ''}`;
          const desc = (item.Descricao || item.Elementos.descricao || '').replace(/\{\{value\}\}/g, item.Valor || item['Numero de ocorrencias'] || '1');

          adicionarMarcacao(camadas, rect, titulo, desc, tipo, oculto, containers, indexErro, false, cleanPointer, elemento.htmlCode, alvo);
        } catch (error) {
          console.warn(`[Content Script] Erro na renderização: ${elemento.pointer}`, error);
        }
      });
    });
  }

  function destacar(pointers, tipo, criterio, descricao, dicasHtml = {}) {
    document.getElementById('amaweb-overlay-wrapper')?.setAttribute('style', 'display: none !important');
    document.getElementById('amaweb-highlight-wrapper')?.remove(); 
    
    const camadas = criarCamadas('amaweb-highlight');
    const containers = [];
    let abriuPrimeiroTooltip = false;
    let elementosEncontrados = 0;

    pointers.forEach(pointer => {
      try {
        // Limpa pseudoclasses que quebram o querySelector (ex: :hover, :focus, :active)
        const cleanPointer = pointer.replace(/:[a-zA-Z-]+/g, '');
        const alvo = encontrarElementoRobusto(cleanPointer, dicasHtml[pointer]);
        
        if (!alvo) return;
        elementosEncontrados++;
        
        const { rect, oculto, ignorarRenderizacao } = obterCaixaVisivel(alvo);
        if (ignorarRenderizacao) return; 

        const deveAbrirTooltip = !abriuPrimeiroTooltip && !oculto;
        adicionarMarcacao(camadas, rect, criterio, descricao, tipo, oculto, containers, undefined, deveAbrirTooltip, cleanPointer, dicasHtml[pointer], alvo);

        if (deveAbrirTooltip) {
          abriuPrimeiroTooltip = true;
          window.setTimeout(() => {
            alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Dá um "piscar" na borda do elemento na página para saberes onde ele está!
            const outlineOriginal = alvo.style.outline;
            alvo.style.outline = '4px solid #FF5722'; 
            alvo.style.outlineOffset = '2px';
            setTimeout(() => { alvo.style.outline = outlineOriginal; }, 2000);
            
          }, 150);
        }
      } catch (error) {
        console.warn(`[Content Script] Erro ao destacar: ${pointer}`, error);
      }
    });

    return elementosEncontrados;
  }

  function removerDestaque() {
    // Apaga apenas o destaque e restaura as bolinhas globais
    document.getElementById('amaweb-highlight-wrapper')?.remove();
    document.getElementById('amaweb-overlay-wrapper')?.removeAttribute('style');
  }

  function limparTudo() {
    // Apaga absolutamente tudo (usado pelo botão "Limpar Ecrã")
    document.getElementById('amaweb-highlight-wrapper')?.remove();
    document.getElementById('amaweb-overlay-wrapper')?.remove();
  }

  globalThis.AmawebOverlayManager = { renderizar, destacar, removerDestaque, limparTudo, obterCaixaVisivel };

  // =======================================================================
  // EVENT LISTENERS 
  // =======================================================================
  document.addEventListener('click', () => {
    document.querySelectorAll('.amaweb-badge-container').forEach(cont => {
      cont.style.setProperty('z-index', '3', 'important');
    });

    document.querySelectorAll('.amaweb-badge-container > div.ativo').forEach(el => {
      el.classList.remove('ativo', 'flip');
      el.style.removeProperty('z-index');
      const boxAssociada = el.getAttribute('data-box-id');
      if(boxAssociada) document.getElementById(boxAssociada)?.classList.remove('ativa');
    });
  });

  // O browser faz todo o trabalho nativamente agora! 
  // Esse loop só ajusta mutações dinâmicas sutis de layout.
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
        document.querySelectorAll('.amaweb-badge-container > div.ativo').forEach(el => {
          el.classList.remove('ativo', 'flip');
        });

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

        const todasBolinhas = document.querySelectorAll('.amaweb-badge-container > div');
        todasBolinhas.forEach(bolinha => {
          if (bolinha.getAttribute('data-pointer') === message.pointer) {
            bolinha.classList.add('ativo');
            bolinha.parentElement.style.setProperty('z-index', '999999', 'important');
          }
        });

        alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        const outlineOriginal = alvo.style.outline;
        const transitionOriginal = alvo.style.transition;
        
        alvo.style.transition = 'outline 0.3s ease-in-out';
        alvo.style.outline = '4px solid #FF5722'; 
        alvo.style.outlineOffset = '2px';

        setTimeout(() => {
          alvo.style.outline = outlineOriginal;
          alvo.style.transition = transitionOriginal;
          if (!outlineOriginal) alvo.style.removeProperty('outline');
          if (!transitionOriginal) alvo.style.removeProperty('transition');
        }, 2000);

        sendResponse({ status: 'visible' });

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