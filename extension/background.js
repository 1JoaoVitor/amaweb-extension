chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "EVALUATE_API") {
    console.log("[Background] Iniciando requisição para API...");

    // 1. Pega a aba ativa atual do navegador
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      
      if (!activeTab || activeTab.url.startsWith("chrome://")) {
        sendResponse({ sucesso: false, erro: "Não é possível avaliar abas internas do Chrome." });
        return;
      }

      // 2. Pede o HTML limpo para o content.js
      chrome.tabs.sendMessage(activeTab.id, { action: "CAPTURE_HTML" }, (responseHtml) => {
        
        if (chrome.runtime.lastError || !responseHtml || !responseHtml.sucesso) {
          sendResponse({ sucesso: false, erro: "Falha ao injetar script ou capturar a página." });
          return;
        }

        // 3. Prepara a requisição para o AMAWeb
        // ATENÇÃO: Confirme com o backend se a base URL é localhost ou o servidor oficial da Unifesp
        const baseUrl = "https://amaweb.unifesp.br"; 
        const apiUrl = `${baseUrl}/amp/eval/html`;

        fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ html: responseHtml.html })
        })
        .then(res => {
          if (!res.ok) throw new Error(`Erro na API: ${res.status}`);
          return res.json();
        })
        .then(data => {
          console.log("[Background] Resposta recebida do AMAWeb com sucesso!");
          sendResponse({ sucesso: true, dados: data });
        })
        .catch(err => {
          console.error("[Background] Erro no Fetch:", err);
          sendResponse({ sucesso: false, erro: err.message });
        });
      });
    });

    // Retorna true para manter o canal de comunicação aberto enquanto o fetch acontece (Assíncrono)
    return true; 
  }
});