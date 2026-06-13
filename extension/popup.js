document.getElementById('btn-analisar').addEventListener('click', async () => {
  const btn = document.getElementById('btn-analisar');
  const resultsPanel = document.getElementById('results-panel');
  
  btn.innerText = "Avaliando...";
  btn.disabled = true;
  resultsPanel.style.display = "none"; // Esconde resultados antigos durante nova busca

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    // Busca os dados no servidor local
    const response = await fetch(`http://localhost:3000/api/avaliar?url=${encodeURIComponent(tab.url)}`);
    if (!response.ok) throw new Error("Erro ao consultar o servidor BFF.");
    
    const dadosAvaliacao = await response.json();

    // VARIÁVEIS DE CONTAGEM E MÉTRICAS
    let totalErros = 0;
    let totalAvisos = 0;
    let notaGeral = "0.0";

    // Varre o JSON calculando os totais com base no tipo de erro
    dadosAvaliacao.forEach(item => {
      // Captura a pontuação contida no JSON (todas as linhas costumam trazer a mesma nota da página)
      if (item["Pontuação"]) {
        notaGeral = item["Pontuação"];
      }

      if (item["Tipo de erro"] === "Erro") {
        // Soma o número de ocorrências daquele erro específico
        totalErros += item["Numero de ocorrencias"] || 1;
      } else if (item["Tipo de erro"] === "Aviso") {
        totalAvisos += item["Numero de ocorrencias"] || 1;
      }
    });

    // ATUALIZA OS ELEMENTOS DO HTML DO PAINEL LATERAL
    document.getElementById('score-value').innerText = notaGeral;
    document.getElementById('count-errors').innerText = totalErros;
    document.getElementById('count-warnings').innerText = totalAvisos;

    // Torna o painel visível com uma transição suave
    resultsPanel.style.display = "flex";

    // Envia os dados para o content.js continuar fazendo o overlay na página
    chrome.tabs.sendMessage(tab.id, { 
      action: "RENDER_OVERLAYS", 
      data: dadosAvaliacao 
    });

  } catch (error) {
    console.error("[Extension] Erro no fluxo de análise:", error);
    alert("Não foi possível conectar ao servidor BFF. Certifique-se de que ele está ativo!");
  } finally {
    btn.innerText = "Avaliar Página";
    btn.disabled = false;
  }
});