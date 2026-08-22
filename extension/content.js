(() => {
  const ACOES = {
    RENDER_OVERLAYS: 'RENDER_OVERLAYS',
    CLEAR_OVERLAYS: 'CLEAR_OVERLAYS',
    HIGHLIGHT_SPECIFIC: 'HIGHLIGHT_SPECIFIC',
    CAPTURE_HTML: 'CAPTURE_HTML'
  };

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
      if (request.action === ACOES.CAPTURE_HTML) {
        sendResponse(AmawebDomCapture.capturar());
        return false;
      }

      if (request.action === ACOES.RENDER_OVERLAYS) {
        AmawebOverlayManager.renderizar(Array.isArray(request.data) ? request.data : []);
        return false;
      }

      if (request.action === ACOES.HIGHLIGHT_SPECIFIC) {
        AmawebOverlayManager.destacar(
          Array.isArray(request.pointers) ? request.pointers : [],
          request.tipo,
          request.criterio,
          request.descricao
        );
        return false;
      }

      if (request.action === ACOES.CLEAR_OVERLAYS) {
        AmawebOverlayManager.limpar();
        return false;
      }
    } catch (error) {
      console.error('[Content Script] Erro ao processar mensagem:', error);
      sendResponse({ sucesso: false, erro: error.message });
    }

    return false;
  });
})();
