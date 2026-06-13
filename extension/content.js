chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_ANALYSIS") {
    console.log("Iniciando varredura de acessibilidade visual...");
    
    // Teste temporário: Seleciona todos os botões da página atual
    const botoes = document.querySelectorAll('button');
    
    if(botoes.length === 0) {
      alert("Nenhum botão encontrado nesta página para simular o destaque!");
      return;
    }

    // Aplica o estilo visual diretamente neles (Overlay)
    botoes.forEach(botao => {
      botao.style.outline = "3px dashed red";
      botao.style.outlineOffset = "2px";
      botao.title = "Elemento destacado pela extensão AMAWeb";
    });

    alert(`Simulação: ${botoes.length} botões destacados na interface!`);
  }
});