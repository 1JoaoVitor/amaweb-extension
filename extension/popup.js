// DICIONÁRIO DE ERROS DO SERVIDOR (AMAWeb)
const MENSAGENS_ERRO_API = {
  "INVALID_URL": "A URL capturada é inválida para avaliação.",
  "DNS_LOOKUP_FAILED": "Não foi possível encontrar o servidor da página avaliada.",
  "BLOCKED_URL": "A avaliação desta página foi bloqueada pelo sistema.",
  "PAGE_UNREACHABLE": "A página está inacessível para o avaliador.",
  "EVALUATION_TIMEOUT": "A página é muito complexa ou demorou muito para responder (Timeout).",
  "EVALUATION_FAILED": "Ocorreu uma falha interna no motor do AMAWeb ao analisar o HTML.",
  "EMPTY_HTML": "O HTML capturado estava vazio.",
  "RATE_LIMIT_EXCEEDED": "Limite de avaliações excedido. Tente novamente em alguns minutos.",
  "ACCESS_DENIED": "Acesso negado ao motor de avaliação."
};

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

    // 1. Carrega as traduções locais da extensão
    const urlTraducoes = chrome.runtime.getURL('translations.json');
    const responseTraducoes = await fetch(urlTraducoes);
    const dicionarioAMA = await responseTraducoes.json();

    // 2. Dispara a requisição para a API real via background.js
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "EVALUATE_API" }, resolve);
    });

    if (!response || !response.sucesso) {
      throw new Error(response?.erro || "Falha na comunicação com a API oficial do AMAWeb.");
    }
    
    const jsonReal = response.dados;

    // 3. Verifica os códigos de erro oficiais do backend do AMAWeb
    if (jsonReal.success === 0) {
        const codigoErro = jsonReal.message; 
        const mensagemTraduzida = MENSAGENS_ERRO_API[codigoErro] || `Erro na avaliação: ${codigoErro}`;
        throw new Error(mensagemTraduzida);
    }

    // Valida a estrutura da resposta de sucesso
    if (!jsonReal.result || !jsonReal.result.data || !jsonReal.result.data.nodes) {
        throw new Error("Formato de resposta da API inválido ou inesperado.");
    }

    const scoreGeral = jsonReal.result.data.score || "0.0";
    
    // 4. O ADAPTADOR: Converte o JSON complexo para o formato da UI
    const dadosAvaliacao = adaptarJsonAmaWeb(jsonReal.result.data.nodes, scoreGeral, dicionarioAMA);

    // Renderização e Contagem
    const listaDetalhada = document.getElementById('lista-detalhada');
    listaDetalhada.innerHTML = ""; 
    let regraAtivaIndex = null;
    let notaGeral = scoreGeral; 

    const contagem = {
      erros: { total: 0, A: 0, AA: 0, AAA: 0 },
      avisos: { total: 0, A: 0, AA: 0, AAA: 0 },
      sucessos: { total: 0, A: 0, AA: 0, AAA: 0 },
      geral: { total: 0, A: 0, AA: 0, AAA: 0 }
    };

    dadosAvaliacao.forEach((item, index) => {
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

      // Criação dos Cards (Aba Lista) - Foca apenas em Erros e Avisos
      if (ehErro || ehAviso) {
        const textoLimpo = (item.Descricao || (item.Elementos && item.Elementos.descricao) || "").replace(/\{\{value\}\}/g, item.Valor || ocorrencias);
        const card = document.createElement('div');
        card.className = 'am-card';
        card.innerHTML = `
          <div class="am-card-color ${ehErro ? 'error' : 'warning'}">
            ${ehErro ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>'}
          </div>
          <div class="am-card-body">
            <p class="am-card-title"><strong>${item.Criterio}</strong><br/><span style="font-weight: normal; font-size: 13px;">${textoLimpo}</span></p>
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

              // Passa os dados para o content.js destacar o erro
              chrome.tabs.sendMessage(tab.id, { 
                action: "HIGHLIGHT_SPECIFIC", 
                pointers: ponteirosDaRegra,
                criterio: "AMAWeb", // Opcional: ajustar texto da tag visual flutuante
                tipo: ehErro ? 'error' : 'warning',
                descricao: item.Criterio
              });
            }
          });
        }
      }
    });

    // Atualiza os contadores na UI
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

    // Exibe o painel de resultados finalizados
    resultsPanel.style.display = "flex";

    // Pede ao content.js para injetar e agrupar os overlays globais (todas as caixas)
    chrome.tabs.sendMessage(tab.id, { 
      action: "RENDER_OVERLAYS", 
      data: dadosAvaliacao 
    });

  } catch (error) {
    console.error("[Extension] Erro no fluxo de análise:", error);
    alert(error.message || "Ocorreu um erro ao processar a avaliação.");
  } finally {
    // Restaura o estado do botão
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


// LÓGICA DE RESET DA INTERFACE
function resetarPainel() {
  const resultsPanel = document.getElementById('results-panel');
  const btnDownload = document.getElementById('btn-baixar-json');
  const btnAnalisar = document.getElementById('btn-analisar');

  if (resultsPanel) resultsPanel.style.display = "none";
  if (btnDownload) btnDownload.disabled = true;
  if (btnAnalisar) btnAnalisar.innerText = "Avaliar Página";
  
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


// A FUNÇÃO ADAPTADORA E TRADUTORA DE DADOS
function adaptarJsonAmaWeb(nodes, scoreGeral, dicionarioAMA) {
    const arrayAdaptado = [];

    // Itera sobre as chaves do json (ex: "imgAltNo", "aTitleMatch", etc)
    for (const [nomeDaRegra, arrayDeResultados] of Object.entries(nodes)) {
        if (!Array.isArray(arrayDeResultados)) continue;

        // Tenta achar o nome amigável ("Imagens sem equivalente alternativo")
        // Se a regra não existir no dicionário, usa o nome original técnico
        const tituloTraduzido = dicionarioAMA.ELEMS[nomeDaRegra] || nomeDaRegra;

        arrayDeResultados.forEach(resultado => {
            let tipoDeErroFormatado = "Para ver manualmente"; 
            if (resultado.verdict === "failed") tipoDeErroFormatado = "Erro";
            else if (resultado.verdict === "warning") tipoDeErroFormatado = "Aviso";
            else if (resultado.verdict === "passed") tipoDeErroFormatado = "Sucesso";

            arrayAdaptado.push({
                "Pontuação": scoreGeral,
                "Tipo de erro": tipoDeErroFormatado,
                "Criterio": tituloTraduzido,
                "Descricao": resultado.description,
                "Numero de ocorrencias": resultado.elements ? resultado.elements.length : 1,
                "Nivel de Conformidade": "A", // Padrão se não vier da API
                "Elementos": {
                    "elementosHtml": resultado.elements || []
                }
            });
        });
    }

    return arrayAdaptado;
}