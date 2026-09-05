import { cacheAvaliacoes } from './core/cache-store.js';
import { adaptarJsonAmaWeb } from './core/amaweb-adapter.js';
import { validateEvaluationResponse } from './core/validators.js';
import { atualizarListaDeResultados, limparRegraAtiva } from './sidepanel/findings-renderer.js';

// DICIONÁRIO DE ERROS DO SERVIDOR (AMAWeb)
const MENSAGENS_ERRO_API = {
  "INVALID_URL": "A URL capturada é inválida para avaliação.",
  "DNS_LOOKUP_FAILED": "Não foi possível encontrar o servidor da página avaliada.",
  "BLOCKED_URL": "A avaliação desta página foi bloqueada pelo sistema.",
  "PAGE_UNREACHABLE": "A página está inacessível para o avaliador.",
  "EVALUATION_TIMEOUT": "A página é muito complexa ou demorou muito para responder (Timeout).",
  "EVALUATION_FAILED": "Ocorreu uma falha interna no motor do AMAWeb ao analisar o HTML.",
  "EMPTY_HTML": "O HTML capturado estava vazio.",
  "RATE_LIMIT_EXCEEDED": "Limite de avaliações excedido. Tente novamente em alguns minutos.",
  "ACCESS_DENIED": "Acesso negado ao motor de avaliação."
};

const cachePronto = cacheAvaliacoes.hydrate();

// LÓGICA DAS ABAS
document.getElementById('tab-geral').addEventListener('click', () => {
  document.getElementById('tab-geral').classList.add('active');
  document.getElementById('tab-detalhes').classList.remove('active');
  document.getElementById('view-geral').classList.add('active');
  document.getElementById('view-detalhes').classList.remove('active');
});

document.getElementById('tab-detalhes').addEventListener('click', () => {
  document.getElementById('tab-detalhes').classList.add('active');
  document.getElementById('tab-geral').classList.remove('active');
  document.getElementById('view-detalhes').classList.add('active');
  document.getElementById('view-geral').classList.remove('active');
});


// LÓGICA PRINCIPAL DE AVALIAÇÃO
document.getElementById('btn-analisar').addEventListener('click', async () => {
  // 1. Declara as variáveis de interface UMA ÚNICA VEZ
  const btn = document.getElementById('btn-analisar');
  const resultsPanel = document.getElementById('results-panel');
  const errorPanel = document.getElementById('error-panel');
  const errorMessage = document.getElementById('error-message');
  const loadingPanel = document.getElementById('loading-panel');

  try {
    await cachePronto;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // --- BLOQUEIO DE SEGURANÇA (EDGE CASES) ---
    // Impede a execução em páginas protegidas do navegador e arquivos locais
    const urlRestrita = tab.url.startsWith("chrome://") || 
                        tab.url.startsWith("edge://") || 
                        tab.url.startsWith("about:") ||
                        tab.url.startsWith("chrome-extension://") ||
                        tab.url.includes("chrome.google.com/webstore");
    
    if (urlRestrita) {
      if (errorPanel && errorMessage) {
        errorMessage.innerText = "Página restrita: O navegador bloqueia a avaliação de páginas internas, configurações ou lojas de extensões por motivos de segurança.";
        errorPanel.style.display = "block";
      }
      if (loadingPanel) loadingPanel.style.display = "none";
      if (resultsPanel) resultsPanel.style.display = "none";
      return; // Interrompe a função aqui
    }
    // ------------------------------------------

    // Prepara a tela para o carregamento
    btn.innerText = "Processando...";
    btn.disabled = true;
    
    if (errorPanel) errorPanel.style.display = "none";
    if (resultsPanel) resultsPanel.style.display = "none";
    if (loadingPanel) loadingPanel.style.display = "block";

    // 1. Carrega as traduções locais da extensão
    const urlTraducoes = chrome.runtime.getURL('translations.json');
    const responseTraducoes = await fetch(urlTraducoes);
    const dicionarioAMA = await responseTraducoes.json();

    // 2. Dispara a requisição para a API real via background.js
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "EVALUATE_API" }, resolve);
    });

    if (!response || !response.sucesso) {
      throw new Error(response?.erro || "Falha na comunicação com a API oficial do AMAWeb.");
    }
    
    const jsonReal = response.dados;

    // 3. Valida os códigos de erro e estructura da resposta
    const validacao = validateEvaluationResponse(jsonReal);
    if (!validacao.valid) {
        const mensagemTraduzida = MENSAGENS_ERRO_API[validacao.code] || validacao.error;
        throw new Error(mensagemTraduzida);
    }

    const scoreGeral = String(validacao.data.score) || "0.0";
    
    // 4. O ADAPTADOR: Converte o JSON complexo para o formato da UI
    const dadosAvaliacao = adaptarJsonAmaWeb(validacao.data.nodes, scoreGeral, dicionarioAMA);

    // Renderização e Contagem
    const listaDetalhada = document.getElementById('lista-detalhada');
    listaDetalhada.replaceChildren();
    limparRegraAtiva();
    let notaGeral = scoreGeral; 

    const contagem = {
      erros: { total: 0, A: 0, AA: 0, AAA: 0 },
      avisos: { total: 0, A: 0, AA: 0, AAA: 0 },
      sucessos: { total: 0, A: 0, AA: 0, AAA: 0 },
      geral: { total: 0, A: 0, AA: 0, AAA: 0 }
    };

    atualizarListaDeResultados(dadosAvaliacao, tab);

    // Atualiza os contadores na UI
    document.getElementById('score-value').innerText = notaGeral;
    
    document.getElementById('count-sucesso-total').innerText = contagem.sucessos.total;
    document.getElementById('count-sucesso-a').innerText = contagem.sucessos.A;
    document.getElementById('count-sucesso-aa').innerText = contagem.sucessos.AA;
    document.getElementById('count-sucesso-aaa').innerText = contagem.sucessos.AAA;

    document.getElementById('count-aviso-total').innerText = contagem.avisos.total;
    document.getElementById('count-aviso-a').innerText = contagem.avisos.A;
    document.getElementById('count-aviso-aa').innerText = contagem.avisos.AA;
    document.getElementById('count-aviso-aaa').innerText = contagem.avisos.AAA;

    document.getElementById('count-erro-total').innerText = contagem.erros.total;
    document.getElementById('count-erro-a').innerText = contagem.erros.A;
    document.getElementById('count-erro-aa').innerText = contagem.erros.AA;
    document.getElementById('count-erro-aaa').innerText = contagem.erros.AAA;

    document.getElementById('count-geral-total').innerText = contagem.geral.total;
    document.getElementById('count-geral-a').innerText = contagem.geral.A;
    document.getElementById('count-geral-aa').innerText = contagem.geral.AA;
    document.getElementById('count-geral-aaa').innerText = contagem.geral.AAA;

    // Exibe o painel de resultados finalizados
    if (loadingPanel) loadingPanel.style.display = "none";
    const btnDownload = document.getElementById('btn-baixar-json');
    if (btnDownload) btnDownload.disabled = false;  
    resultsPanel.style.display = "flex";

    // Pede ao content.js para injetar e agrupar os overlays globais (todas as caixas)
    chrome.tabs.sendMessage(tab.id, { 
      action: "RENDER_OVERLAYS", 
      data: dadosAvaliacao 
    }).catch(() => {});

    // ======== NOVO: SALVANDO NO CACHE ========
    await cacheAvaliacoes.set(tab.id, {
      url: tab.url,
      dados: dadosAvaliacao, // Dados brutos para poder re-injetar os overlays
      scoreGeral: notaGeral,
      contagem: contagem
    });

  } catch (error) {
    console.error("[Extension] Erro no fluxo de análise:", error);
    
    // Esconde o loading e resultados
    if (loadingPanel) loadingPanel.style.display = "none";
    if (resultsPanel) resultsPanel.style.display = "none";

    // Mostra o painel de erro amigável na tela
    if (errorPanel && errorMessage) {
      let textoAmigavel = error.message || "Ocorreu um erro inesperado ao avaliar a página.";

      // MAPEAMENTO DE ERROS AMIGÁVEIS
      
      if (textoAmigavel.includes("Receiving end does not exist")) {
        textoAmigavel = "A conexão com a página foi perdida. Por favor, atualize a aba (F5) e tente novamente."; }
        else if (textoAmigavel.includes("413")) {
        textoAmigavel = "Esta página é muito grande ou possui muitos elementos visuais pesados. O servidor recusou o tamanho do arquivo (Erro 413).";
      } else if (textoAmigavel.includes("405")) {
        textoAmigavel = "Erro de comunicação com o servidor. Método não permitido (Erro 405).";
      } else if (textoAmigavel.includes("Failed to fetch") || textoAmigavel.includes("NetworkError")) {
        textoAmigavel = "Não foi possível conectar ao servidor do AMAWeb. Verifique sua conexão ou se a API está online.";
      }

      errorMessage.innerText = textoAmigavel;
      errorPanel.style.display = "block";
    }
  } finally {
    // Restaura o estado do botão (garantindo que btn existe no finally)
    const btnRefresh = document.getElementById('btn-analisar');
    if (btnRefresh) {
      btnRefresh.innerText = "Avaliar Página";
      btnRefresh.disabled = false;
    }
  }
});


// LÓGICA DO BOTÃO LIMPAR
document.getElementById('btn-limpar').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { action: "CLEAR_OVERLAYS" }).catch(() => {});
});

// ======== LÓGICA DE CACHE, RESET E EVENTOS ========

async function resetarPainel(trocaDeAba = false) {
  const resultsPanel = document.getElementById('results-panel');
  const errorPanel = document.getElementById('error-panel');
  const loadingPanel = document.getElementById('loading-panel');
  const btnAnalisar = document.getElementById('btn-analisar');

  // Volta a interface para o estado inicial
  if (resultsPanel) resultsPanel.style.display = "none";
  if (errorPanel) errorPanel.style.display = "none";
  if (loadingPanel) loadingPanel.style.display = "none";
  if (btnAnalisar) btnAnalisar.innerText = "Avaliar Página";
  
  const listaDetalhada = document.getElementById('lista-detalhada');
  if (listaDetalhada) {
    listaDetalhada.replaceChildren();
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Clique em Avaliar Página para avaliar o contexto atual.';
    listaDetalhada.appendChild(emptyState);
  }

  // Verifica o Toggle do usuário antes de limpar as marcações na tela
  const toggleLimpeza = document.getElementById('toggle-limpeza');
  const deveLimpar = toggleLimpeza && toggleLimpeza.checked;

  if (deveLimpar && trocaDeAba) {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && !tab.url.startsWith("chrome://")) {
        chrome.tabs.sendMessage(tab.id, { action: "CLEAR_OVERLAYS" }).catch(() => {});
      }
    } catch(e) {}
  }
}

// Função para recriar a interface usando o Cache
function restaurarDoCache(tabId, tab) {
  const cache = cacheAvaliacoes.get(tabId);
  if (!cache || !tab) return;

  document.getElementById('error-panel').style.display = "none";
  document.getElementById('loading-panel').style.display = "none";
  
  // Restaura a nota e os contadores
  document.getElementById('score-value').innerText = cache.scoreGeral;
  document.getElementById('count-sucesso-total').innerText = cache.contagem.sucessos.total;
  document.getElementById('count-sucesso-a').innerText = cache.contagem.sucessos.A;
  document.getElementById('count-sucesso-aa').innerText = cache.contagem.sucessos.AA;
  document.getElementById('count-sucesso-aaa').innerText = cache.contagem.sucessos.AAA;
  document.getElementById('count-aviso-total').innerText = cache.contagem.avisos.total;
  document.getElementById('count-aviso-a').innerText = cache.contagem.avisos.A;
  document.getElementById('count-aviso-aa').innerText = cache.contagem.avisos.AA;
  document.getElementById('count-aviso-aaa').innerText = cache.contagem.avisos.AAA;
  document.getElementById('count-erro-total').innerText = cache.contagem.erros.total;
  document.getElementById('count-erro-a').innerText = cache.contagem.erros.A;
  document.getElementById('count-erro-aa').innerText = cache.contagem.erros.AA;
  document.getElementById('count-erro-aaa').innerText = cache.contagem.erros.AAA;
  document.getElementById('count-geral-total').innerText = cache.contagem.geral.total;
  document.getElementById('count-geral-a').innerText = cache.contagem.geral.A;
  document.getElementById('count-geral-aa').innerText = cache.contagem.geral.AA;
  document.getElementById('count-geral-aaa').innerText = cache.contagem.geral.AAA;

    limparRegraAtiva();
    const listaDetalhada = document.getElementById('lista-detalhada');
    listaDetalhada.replaceChildren();
    atualizarListaDeResultados(cache.dados, tab);

  document.getElementById('results-panel').style.display = "flex";
  
  // Habilita o botão de baixar JSON quando restaurar do cache
  const btnDownload = document.getElementById('btn-baixar-json');
  if (btnDownload) btnDownload.disabled = false;
}

// Quando o usuário troca de aba
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await cachePronto;
  const tabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(tabId);
  
  // Se essa aba já foi avaliada e a URL continua a mesma, puxa do Cache!
  const cache = cacheAvaliacoes.get(tabId);
  if (cache && cache.url === tab.url) {
    restaurarDoCache(tabId, tab);
  } else {
    // Caso contrário, mostra a tela limpa indicando para avaliar
    resetarPainel(true);
  }
});

// Quando a página recarrega (F5) ou muda de URL dinamicamente (SPAs como React/Angular)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // changeInfo.status === 'loading' -> Captura F5 e links tradicionais
  // changeInfo.url -> Captura navegação dinâmica de SPAs (History API) sem reload
  if (changeInfo.status === 'loading' || changeInfo.url) {
    
    // Verifica se realmente houve uma mudança de contexto justificável
    const cache = cacheAvaliacoes.get(tabId);
    const urlDiferente = cache && cache.url !== tab.url;

    if (changeInfo.status === 'loading' || urlDiferente) {
      // Apaga a memória dessa aba pois o conteúdo raiz ou a URL mudou
      cacheAvaliacoes.delete(tabId);
      
      // Se for apenas uma mudança de URL via SPA, o HTML antigo não foi destruído pelo navegador.
      // Precisamos mandar um comando explícito para limpar as caixas antigas.
      const mudancaViaSPA = (changeInfo.url && changeInfo.status !== 'loading');
      
      if (mudancaViaSPA) {
        chrome.tabs.sendMessage(tabId, { action: "CLEAR_OVERLAYS" }).catch(() => {});
      }
      
      resetarPainel(false); 
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  cacheAvaliacoes.delete(tabId);
});


// LÓGICA DE EXPORTAÇÃO (DOWNLOAD)
document.getElementById('btn-baixar-json').addEventListener('click', async () => {
  await cachePronto;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Verifica se temos os dados na memória para esta aba
  const cache = tab && cacheAvaliacoes.get(tab.id);
  if (!tab || !cache) {
    alert("Nenhum dado disponível para exportar nesta aba.");
    return;
  }

  const dadosBrutos = cache.dados;
  
  // Formata o JSON para ficar bonitinho e legível no arquivo (com 2 espaços de indentação)
  const conteudoJson = JSON.stringify(dadosBrutos, null, 2);
  
  // Cria um arquivo virtual em memória (Blob)
  const blob = new Blob([conteudoJson], { type: "application/json" });
  const urlVirtual = URL.createObjectURL(blob);
  
  // Cria um link <a> invisível, clica nele para baixar e depois o destrói
  const linkInvisivel = document.createElement('a');
  linkInvisivel.href = urlVirtual;
  linkInvisivel.download = `relatorio-amaweb-${new Date().getTime()}.json`;
  
  document.body.appendChild(linkInvisivel);
  linkInvisivel.click();
  
  // Limpa a memória
  document.body.removeChild(linkInvisivel);
  URL.revokeObjectURL(urlVirtual);
});

// OUVINTE PARA CLIQUE NO OVERLAY DA PÁGINA
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'SCROLL_TO_ERROR') {
    
    // 1. Mudar para a Aba "Lista de Erros" automaticamente
    const tabDetalhes = document.getElementById('view-detalhes');
    const tabGeral = document.getElementById('view-geral'); // Corrigido para view-geral
    const botoesAba = document.querySelectorAll('.tab-btn');
    
    if (tabDetalhes && tabGeral) {
      tabGeral.classList.remove('active');
      tabDetalhes.classList.add('active');
      
      botoesAba.forEach(btn => btn.classList.remove('active'));
      // Seleciona o botão da aba de detalhes (geralmente o segundo botão, índice 1)
      if (botoesAba.length > 1) botoesAba[1].classList.add('active'); 
    }

    // 2. Encontrar o Card, Rolar até ele e Dar o Efeito Visual
    setTimeout(() => {
      const btn = document.querySelector(`.btn-destacar[data-index="${message.index}"]`);
      if (btn) {
        const card = btn.closest('.am-card');
        if (card) {
          // Desce até o card no painel
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Efeito visual dinâmico
          const estiloOriginalTransform = card.style.transform;
          const estiloOriginalBoxShadow = card.style.boxShadow;
          
          card.style.transition = 'all 0.3s ease-in-out';
          card.style.transform = 'scale(1.02)';
          card.style.boxShadow = '0 0 15px 2px rgba(43, 92, 70, 0.6)';
          
          // Remove o efeito após 2 segundos
          setTimeout(() => {
            card.style.transform = estiloOriginalTransform;
            card.style.boxShadow = estiloOriginalBoxShadow;
          }, 2000);
        }
      }
    }, 150); 
  }
});

// Ativa os filtros ao trocar as opções
['filtro-tipo', 'filtro-nivel', 'ordenacao'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cache = cacheAvaliacoes.get(tab.id);
    if (cache && cache.dados) {
      atualizarListaDeResultados(cache.dados, tab);
    }
  });
});