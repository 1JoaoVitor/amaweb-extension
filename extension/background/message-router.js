import { avaliarHtml } from './api-client.js';

const ACOES = {
  AVALIAR_API: 'EVALUATE_API',
  CAPTURAR_HTML: 'CAPTURE_HTML'
};

function paginaRestrita(url = '') {
  return /^(chrome|edge|about|chrome-extension):\/\//.test(url) || url.includes('chrome.google.com/webstore');
}

export function registrarRoteadorDeMensagens() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action !== ACOES.AVALIAR_API) return undefined;

    chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
      const activeTab = tabs[0];
      if (!activeTab?.id || paginaRestrita(activeTab.url)) {
        sendResponse({ sucesso: false, erro: 'Não é possível avaliar esta página.' });
        return;
      }

      try {
        const responseHtml = await chrome.tabs.sendMessage(activeTab.id, { action: ACOES.CAPTURAR_HTML });
        if (!responseHtml?.sucesso || typeof responseHtml.html !== 'string' || !responseHtml.html.trim()) {
          sendResponse({ sucesso: false, erro: 'Falha ao capturar o HTML da página.' });
          return;
        }

        const dados = await avaliarHtml(responseHtml.html);
        sendResponse({ sucesso: true, dados });
      } catch (error) {
        console.error('[Background] Erro no fluxo de avaliação:', error);
        sendResponse({ sucesso: false, erro: error.message || 'Falha na avaliação.' });
      }
    });

    return true;
  });
}
