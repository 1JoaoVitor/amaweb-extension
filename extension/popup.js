document.getElementById('btn-analisar').addEventListener('click', async () => {
  // Descobre qual é a aba que está aberta no momento
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (tab) {
    // Avisa o background.js ou o content.js que o botão foi clicado
    chrome.tabs.sendMessage(tab.id, { action: "START_ANALYSIS" });
  }
});