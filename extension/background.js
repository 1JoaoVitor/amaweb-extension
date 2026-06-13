// Escuta o clique no ícone da extensão e abre o painel lateral
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});