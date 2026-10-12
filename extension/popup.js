import { cacheAvaliacoes } from './core/cache-store.js';
import { adaptarJsonAmaWeb } from './core/amaweb-adapter.js';
import { validateEvaluationResponse } from './core/validators.js';
import { exportarRelatorio } from './core/export-report.js';
import { atualizarListaDeResultados, limparRegraAtiva, atualizarEstatisticas} from './sidepanel/findings-renderer.js';

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

const btnAnalisar = document.getElementById('btn-analisar');
const aceitePrivacidade = document.getElementById('aceite-privacidade');
const avisoPrivacidade = document.querySelector('.privacy-notice');
const fecharAvisoPrivacidade = document.getElementById('fechar-aviso-privacidade');
const toggleSanitizacao = document.getElementById('toggle-sanitizacao');
const CHAVE_AVISO_PRIVACIDADE = 'amaweb-privacy-notice-dismissed';
const CHAVE_SANITIZACAO = 'amaweb-sanitize-html';

function registrarFalhaDeMensagem(contexto, error) {
  const mensagem = error?.message || String(error);
  const log = mensagem.includes('Receiving end does not exist') ? console.debug : console.warn;
  log(`[Extension] Falha em ${contexto}:`, error);
}

btnAnalisar.disabled = true;
aceitePrivacidade.addEventListener('change', () => {
  btnAnalisar.disabled = !aceitePrivacidade.checked;
  fecharAvisoPrivacidade.hidden = !aceitePrivacidade.checked;
  if (aceitePrivacidade.checked) {
    chrome.storage.local.set({ [CHAVE_AVISO_PRIVACIDADE]: true });
  }
});

fecharAvisoPrivacidade.addEventListener('click', async () => {
  try {
    await chrome.storage.local.set({ [CHAVE_AVISO_PRIVACIDADE]: true });
  } catch (error) {
    console.warn('[Extension] Não foi possível salvar a preferência do aviso:', error);
  }

  avisoPrivacidade.hidden = true;
  btnAnalisar.disabled = false;
});

chrome.storage.local.get(CHAVE_AVISO_PRIVACIDADE).then(preferencias => {
  if (preferencias[CHAVE_AVISO_PRIVACIDADE]) {
    avisoPrivacidade.hidden = true;
    btnAnalisar.disabled = false;
  }
}).catch(error => {
  console.warn('[Extension] Não foi possível carregar a preferência do aviso:', error);
});

chrome.storage.local.get({ [CHAVE_SANITIZACAO]: true }).then(preferencias => {
  toggleSanitizacao.checked = preferencias[CHAVE_SANITIZACAO];
}).catch(error => {
  console.warn('[Extension] Não foi possível carregar a preferência de sanitização:', error);
});

toggleSanitizacao.addEventListener('change', () => {
  chrome.storage.local.set({ [CHAVE_SANITIZACAO]: toggleSanitizacao.checked }).catch(error => {
    console.warn('[Extension] Não foi possível salvar a preferência de sanitização:', error);
  });
});

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
  const btn = document.getElementById('btn-analisar');
  const resultsPanel = document.getElementById('results-panel');
  const errorPanel = document.getElementById('error-panel');
  const errorMessage = document.getElementById('error-message');
  const loadingPanel = document.getElementById('loading-panel');

  try {
    await cachePronto;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    if (!tab.url) {
      if (errorPanel && errorMessage) {
        errorMessage.innerText = "Não é possível avaliar esta página. Navegue para um site válido (ex: https://...), reabra a extensão e tente novamente.";
        errorPanel.style.display = "block";
      }
      if (loadingPanel) loadingPanel.style.display = "none";
      if (resultsPanel) resultsPanel.style.display = "none";
      return; 
    }

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
      return; 
    }

    btn.innerText = "Processando...";
    btn.disabled = true;
    
    if (errorPanel) errorPanel.style.display = "none";
    if (resultsPanel) resultsPanel.style.display = "none";
    if (loadingPanel) loadingPanel.style.display = "block";

    const urlTraducoes = chrome.runtime.getURL('translations.json');
    const responseTraducoes = await fetch(urlTraducoes);
    const dicionarioAMA = await responseTraducoes.json();

    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: "EVALUATE_API",
        sanitizar: toggleSanitizacao.checked
      }, resolve);
    });

    if (!response || !response.sucesso) {
      throw new Error(response?.erro || "Falha na comunicação com a API oficial do AMAWeb.");
    }
    
    const jsonReal = response.dados;
    const validacao = validateEvaluationResponse(jsonReal);
    if (!validacao.valid) {
        const mensagemTraduzida = MENSAGENS_ERRO_API[validacao.code] || validacao.error;
        throw new Error(mensagemTraduzida);
    }

    const scoreGeral = String(validacao.data.score) || "0.0";
    const dadosAvaliacao = adaptarJsonAmaWeb(validacao.data.nodes, scoreGeral, dicionarioAMA);

    // Evita aplicar uma resposta antiga depois que a página mudou durante a avaliação.
    const abaAtual = await chrome.tabs.get(tab.id).catch(() => null);
    if (!abaAtual || abaAtual.url !== tab.url) return;

    const listaDetalhada = document.getElementById('lista-detalhada');
    listaDetalhada.replaceChildren();
    limparRegraAtiva();
    let notaGeral = scoreGeral; 

    // Regista no DOM a aba que estamos a avaliar atualmente
    listaDetalhada.dataset.tabId = tab.id;

    // Só re-desenha os overlays de raiz ao clicar no botão Avaliar Página!
    await chrome.tabs.sendMessage(tab.id, { 
      action: "RENDER_OVERLAYS", 
      data: dadosAvaliacao 
    }).catch(error => registrarFalhaDeMensagem('renderização dos overlays', error));

    atualizarListaDeResultados(dadosAvaliacao, tab);

    document.getElementById('score-value').innerText = notaGeral;
    const modoAtual = document.getElementById('toggle-contagem')?.checked ? 'elementos' : 'regras';
    atualizarEstatisticas(dadosAvaliacao, modoAtual);

    if (loadingPanel) loadingPanel.style.display = "none";
    const btnDownload = document.getElementById('btn-baixar-json');
    if (btnDownload) btnDownload.disabled = false;  
    resultsPanel.style.display = "flex";

    await cacheAvaliacoes.set(tab.id, {
      url: tab.url,
      dados: dadosAvaliacao,
      scoreGeral: notaGeral,
      regraAtivaIndex: null
    });

  } catch (error) {
    console.error("[Extension] Erro no fluxo de análise:", error);
    if (loadingPanel) loadingPanel.style.display = "none";
    if (resultsPanel) resultsPanel.style.display = "none";

    if (errorPanel && errorMessage) {
      let textoAmigavel = error.message || "Ocorreu um erro inesperado ao avaliar a página.";
      
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
    const btnRefresh = document.getElementById('btn-analisar');
    if (btnRefresh) {
      btnRefresh.innerText = "Avaliar Página";
      btnRefresh.disabled = false;
    }
  }
});

document.getElementById('btn-limpar').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { action: "CLEAR_OVERLAYS" })
    .catch(error => registrarFalhaDeMensagem('limpeza dos overlays', error));
});

async function resetarPainel(limparAbaId = true) {
  const resultsPanel = document.getElementById('results-panel');
  const errorPanel = document.getElementById('error-panel');
  const loadingPanel = document.getElementById('loading-panel');
  const btnAnalisar = document.getElementById('btn-analisar');

  if (resultsPanel) resultsPanel.style.display = "none";
  if (errorPanel) errorPanel.style.display = "none";
  if (loadingPanel) loadingPanel.style.display = "none";
  if (btnAnalisar) btnAnalisar.innerText = "Avaliar Página";
  
  const listaDetalhada = document.getElementById('lista-detalhada');
  if (listaDetalhada) {
    if (limparAbaId) listaDetalhada.dataset.tabId = "";
    listaDetalhada.replaceChildren();
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Clique em Avaliar Página para avaliar o contexto atual.';
    listaDetalhada.appendChild(emptyState);
  }
}

// === LÓGICA DE CACHE SUPER OTIMIZADA ===
function restaurarDoCache(tabId, tab) {
  const cache = cacheAvaliacoes.get(tabId);
  if (!cache || !tab) return;

  document.getElementById('error-panel').style.display = "none";
  document.getElementById('loading-panel').style.display = "none";
  document.getElementById('score-value').innerText = cache.scoreGeral;
  
  const modoAtual = document.getElementById('toggle-contagem')?.checked ? 'elementos' : 'regras';
  atualizarEstatisticas(cache.dados, modoAtual);

  const listaDetalhada = document.getElementById('lista-detalhada');
  
  // Apenas reconstruímos o HTML do painel se estivéssemos noutra aba
  // NÃO enviamos mais mensagens para a página! Ela já está exatamente como a deixámos.
  if (listaDetalhada.dataset.tabId !== String(tabId) || listaDetalhada.children.length === 0) {
      listaDetalhada.dataset.tabId = tabId;
      limparRegraAtiva();
      listaDetalhada.replaceChildren();
      
      // Isto vai criar os cartões. Se havia um botão ativo, ele nasce logo vermelho.
      atualizarListaDeResultados(cache.dados, tab);
  }

  document.getElementById('results-panel').style.display = "flex";
  const btnDownload = document.getElementById('btn-baixar-json');
  if (btnDownload) btnDownload.disabled = false;
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    await cachePronto;
    const tabId = activeInfo.tabId;
    const tab = await chrome.tabs.get(tabId);

    const cache = cacheAvaliacoes.get(tabId);
    if (cache && cache.url === tab.url) {
      restaurarDoCache(tabId, tab);
    } else {
      resetarPainel(true);
    }
  } catch (error) {
    console.warn('[Extension] Não foi possível restaurar a aba ativa:', error);
    resetarPainel(true);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    const cache = cacheAvaliacoes.get(tabId);
    const urlDiferente = cache && cache.url !== tab.url;

    if (changeInfo.status === 'loading' || urlDiferente) {
      cacheAvaliacoes.delete(tabId);
      const mudancaViaSPA = (changeInfo.url && changeInfo.status !== 'loading');
      
      if (mudancaViaSPA) {
        chrome.tabs.sendMessage(tabId, { action: "CLEAR_OVERLAYS" })
          .catch(error => registrarFalhaDeMensagem('limpeza dos overlays após navegação', error));
      }
      resetarPainel(true); 
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
  
  const cache = tab && cacheAvaliacoes.get(tab.id);
  if (!tab || !cache) {
    alert("Nenhum dado disponível para exportar nesta aba.");
    return;
  }

  const dadosBrutos = cache.dados;
  const nomeArquivo = `relatorio-amaweb-${new Date().getTime()}`;
  exportarRelatorio(dadosBrutos, nomeArquivo);
});

// OUVINTE PARA CLIQUE NO OVERLAY DA PÁGINA
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'SCROLL_TO_ERROR' && message.titulo) {
    
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('view-detalhes').classList.add('active');
    document.getElementById('tab-detalhes').classList.add('active');

    const filtroTipo = document.getElementById('filtro-tipo');
    if (filtroTipo && filtroTipo.value !== 'todos') {
      filtroTipo.value = 'todos';
      filtroTipo.dispatchEvent(new Event('change'));
    }

    setTimeout(() => {
      let card = null;

      if (message.index !== undefined) {
        const btn = document.querySelector(`.btn-destacar[data-index="${message.index}"]`);
        if (btn) card = btn.closest('.am-card');
      }

      if (!card) {
        const cardsTitle = Array.from(document.querySelectorAll('.am-card-title'));
        let tituloEncontrado = cardsTitle.find(t => 
          t.textContent.trim().includes(message.titulo.trim()) && 
          t.closest('.am-card').querySelector('.btn-destacar')
        );
        if (!tituloEncontrado) tituloEncontrado = cardsTitle.find(t => t.textContent.trim().includes(message.titulo.trim()));
        if (tituloEncontrado) card = tituloEncontrado.closest('.am-card');
      }

      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        card.style.transition = 'none';
        card.style.boxShadow = 'none';
        card.style.transform = 'scale(1)';
        void card.offsetWidth; 
        
        card.style.transition = 'all 0.4s ease';
        card.style.boxShadow = '0 0 0 3px #1b6345, 0 5px 15px rgba(0,0,0,0.2)';
        card.style.transform = 'scale(1.03)';
        
        setTimeout(() => {
          card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.05)';
          card.style.transform = 'scale(1)';
        }, 2000);
      }
    }, 300); 
  }
});

['filtro-tipo', 'filtro-nivel', 'ordenacao', 'filtro-visibilidade'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const cache = cacheAvaliacoes.get(tab.id);
    if (cache && cache.dados) {
      atualizarListaDeResultados(cache.dados, tab);
    }
  });
});

document.getElementById('toggle-contagem')?.addEventListener('change', async (e) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const cache = tab && cacheAvaliacoes.get(tab.id);
  
  if (cache && cache.dados) {
    const modo = e.target.checked ? 'elementos' : 'regras';
    atualizarEstatisticas(cache.dados, modo);
  }
});

document.getElementById('btn-amaweb')?.addEventListener('click', () => {
  chrome.tabs.create({ url: 'https://amaweb.unifesp.br/' }); 
});