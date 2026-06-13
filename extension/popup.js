document.getElementById('btn-analisar').addEventListener('click', async () => {
  const btn = document.getElementById('btn-analisar');
  btn.innerText = "Avaliando...";
  btn.disabled = true;

  try {
    // Descobre qual é a aba ativa no momento
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) return;

    console.log(`[Extension] Solicitando avaliação para a URL: ${tab.url}`);

    // 2Faz a requisição para o seu servidor BFF local passando a URL atual
    const response = await fetch(`http://localhost:3000/api/avaliar?url=${encodeURIComponent(tab.url)}`);
    
    if (!response.ok) throw new Error("Erro ao consultar o servidor BFF.");
    
    // Recebe o JSON real do AMAWeb enviado pelo servidor
    const dadosAvaliacao = await response.json();
    console.log("[Extension] Dados recebidos com sucesso:", dadosAvaliacao);

    // Envia esses dados diretamente para o content.js injetado na página atual
    chrome.tabs.sendMessage(tab.id, { 
      action: "RENDER_OVERLAYS", 
      data: dadosAvaliacao 
    });

  } catch (error) {
    console.error("[Extension] Erro no fluxo de análise:", error);
    alert("Não foi possível conectar ao servidor BFF. Garanta que ele está rodando!");
  } finally {
    btn.innerText = "Avaliar Página";
    btn.disabled = false;
  }
});