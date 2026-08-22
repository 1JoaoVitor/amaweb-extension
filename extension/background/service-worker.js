import { registrarRoteadorDeMensagens } from './message-router.js';

chrome.action.onClicked.addListener(tab => {
  if (tab.id) chrome.sidePanel.open({ tabId: tab.id });
});

registrarRoteadorDeMensagens();
