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
  
  btn.innerText = "Avaliando...";
  btn.disabled = true;
  resultsPanel.style.display = "none"; 

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const response = await fetch(`http://localhost:3000/api/avaliar?url=${encodeURIComponent(tab.url)}`);
    if (!response.ok) throw new Error("Erro ao consultar o servidor BFF.");
    
    const dadosAvaliacao = await response.json();

    const listaDetalhada = document.getElementById('lista-detalhada');
    listaDetalhada.innerHTML = ""; 
    let regraAtivaIndex = null;
    let notaGeral = "0.0"; 

    const contagem = {
      erros: { total: 0, A: 0, AA: 0, AAA: 0 },
      avisos: { total: 0, A: 0, AA: 0, AAA: 0 },
      sucessos: { total: 0, A: 0, AA: 0, AAA: 0 },
      geral: { total: 0, A: 0, AA: 0, AAA: 0 }
    };

    dadosAvaliacao.forEach((item, index) => {
      if (item["Pontuação"]) notaGeral = item["Pontuação"];

      const ehErro = item["Tipo de erro"] === "Erro" || item["Tipo de erro"] === "Não aceitável";
      const ehAviso = item["Tipo de erro"] === "Aviso" || item["Tipo de erro"] === "Para ver manualmente";

      let numElementosReal = 0;
      let ponteirosDaRegra = [];
      if (item.Elementos && Array.isArray(item.Elementos.elementosHtml)) {
        ponteirosDaRegra = item.Elementos.elementosHtml.map(el => el.pointer).filter(Boolean);
        numElementosReal = ponteirosDaRegra.length;
      }

      const ocorrencias = item["Numero de ocorrencias"] || 1;
      let nivel = (item["Nivel de Conformidade"] || "A").includes("AAA") ? "AAA" : 
                  (item["Nivel de Conformidade"] || "A").includes("AA") ? "AA" : "A";

      if (ehErro) {
        contagem.erros.total += ocorrencias;
        contagem.erros[nivel] += ocorrencias;
      } else if (ehAviso) {
        contagem.avisos.total += ocorrencias;
        contagem.avisos[nivel] += ocorrencias;
      } else {
        contagem.sucessos.total += ocorrencias;
        contagem.sucessos[nivel] += ocorrencias;
      }
      contagem.geral.total += ocorrencias;
      contagem.geral[nivel] += ocorrencias;

      // Criação dos Cards (Aba Lista)
      if (ehErro || ehAviso) {
        const textoLimpo = (item.Descricao || (item.Elementos && item.Elementos.descricao) || "").replace(/\{\{value\}\}/g, item.Valor || ocorrencias);
        const card = document.createElement('div');
        card.className = 'am-card';
        card.innerHTML = `
          <div class="am-card-color ${ehErro ? 'error' : 'warning'}">
            ${ehErro ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
          </div>
          <div class="am-card-body">
            <p class="am-card-title"><strong>${item.Criterio ? 'WCAG ' + item.Criterio : 'NBR'}</strong>: ${textoLimpo}</p>
            <p style="font-size: 12px; color: #2b5c46; margin: 6px 0 0 0; font-weight: bold;">Nível: ${item["Nivel de Conformidade"] || "A"}</p>
            <div class="am-card-footer">
              ${numElementosReal > 0 ? `<span style="font-size: 16px; font-weight: bold; color: #333;">${numElementosReal} <span style="font-size:11px; font-weight:normal;">elementos</span></span><button class="btn-destacar" id="btn-destacar-${index}">Destacar</button>` : `<span style="font-size:12px; color:#666;">Erro global</span>`}
            </div>
          </div>
        `;
        
        listaDetalhada.appendChild(card);

        if (numElementosReal > 0) {
          const btnDestacar = card.querySelector(`#btn-destacar-${index}`);
          btnDestacar.addEventListener('click', () => {
            if (regraAtivaIndex === index) {
              regraAtivaIndex = null;
              btnDestacar.classList.remove('ativo');
              btnDestacar.innerText = "Destacar";
              chrome.tabs.sendMessage(tab.id, { action: "CLEAR_OVERLAYS" });
            } else {
              regraAtivaIndex = index;
              document.querySelectorAll('.btn-destacar').forEach(b => {
                b.classList.remove('ativo');
                b.innerText = "Destacar";
              });
              btnDestacar.classList.add('ativo');
              btnDestacar.innerText = "Remover Destaque";

              chrome.tabs.sendMessage(tab.id, { 
                action: "HIGHLIGHT_SPECIFIC", 
                pointers: ponteirosDaRegra,
                criterio: item.Criterio,
                tipo: ehErro ? 'error' : 'warning',
                descricao: textoLimpo,
              });
            }
          });
        }
      }
    });

    // Atualiza os textos no HTML
    document.getElementById('score-value').innerText = notaGeral;
    
    document.getElementById('count-sucesso-total').innerText = contagem.sucessos.total;
    document.getElementById('count-sucesso-a').innerText = contagem.sucessos.A;
    document.getElementById('count-sucesso-aa').innerText = contagem.sucessos.AA;
    document.getElementById('count-sucesso-aaa').innerText = contagem.sucessos.AAA;

    document.getElementById('count-aviso-total').innerText = contagem.avisos.total;
    document.getElementById('count-aviso-a').innerText = contagem.avisos.A;
    document.getElementById('count-aviso-aa').innerText = contagem.avisos.AA;
    document.getElementById('count-aviso-aaa').innerText = contagem.avisos.AAA;

    document.getElementById('count-erro-total').innerText = contagem.erros.total;
    document.getElementById('count-erro-a').innerText = contagem.erros.A;
    document.getElementById('count-erro-aa').innerText = contagem.erros.AA;
    document.getElementById('count-erro-aaa').innerText = contagem.erros.AAA;

    document.getElementById('count-geral-total').innerText = contagem.geral.total;
    document.getElementById('count-geral-a').innerText = contagem.geral.A;
    document.getElementById('count-geral-aa').innerText = contagem.geral.AA;
    document.getElementById('count-geral-aaa').innerText = contagem.geral.AAA;

    // Mostra o painel
    resultsPanel.style.display = "flex";

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

// LÓGICA DO BOTÃO LIMPAR
document.getElementById('btn-limpar').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { action: "CLEAR_OVERLAYS" });
});


function resetarPainel() {
  const resultsPanel = document.getElementById('results-panel');
  const btnDownload = document.getElementById('btn-baixar-json');
  const btnAnalisar = document.getElementById('btn-analisar');

  if (resultsPanel) resultsPanel.style.display = "none";
  if (btnDownload) btnDownload.disabled = true;
  if (btnAnalisar) btnAnalisar.innerText = "Avaliar Página";
  
  relatorioJsonAtual = null;

  const listaDetalhada = document.getElementById('lista-detalhada');
  if (listaDetalhada) {
    listaDetalhada.innerHTML = "<p style='font-size: 13px; color: #666; text-align: center; margin-top: 20px;'>Clique em <b>Avaliar Página</b> para avaliar o contexto atual.</p>";
  }
}

chrome.tabs.onActivated.addListener(resetarPainel);

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading' || changeInfo.url) {
    resetarPainel();
  }
});