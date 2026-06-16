function obterCaixaVisivel(elemento) {
  let elAtual = elemento;
  let rect = elAtual.getBoundingClientRect();
  let subiuNiveis = 0;


  while ((rect.width === 0 || rect.height === 0) && elAtual.parentElement && subiuNiveis < 10) {
    elAtual = elAtual.parentElement;
    rect = elAtual.getBoundingClientRect();
    subiuNiveis++;
  }
  
  return { rect, oculto: subiuNiveis > 0 };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "RENDER_OVERLAYS") {
    console.log("[Content Script] Renderizando overlays inteligentes...");
    
    const camadaAntiga = document.getElementById('amaweb-overlay-layer');
    if (camadaAntiga) camadaAntiga.remove();

    const overlayLayer = document.createElement('div');
    overlayLayer.id = 'amaweb-overlay-layer';

    overlayLayer.style.position = 'absolute'; 
    overlayLayer.style.top = '0';
    overlayLayer.style.left = '0';
    overlayLayer.style.width = '100%';
    overlayLayer.style.pointerEvents = 'none';
    overlayLayer.style.zIndex = '999999';

    document.body.style.position = 'relative';
    document.body.appendChild(overlayLayer);

    let errosDestacados = 0;
    
    const conteineresDeEtiquetas = [];

    function buscarOuCriarContainer(top, left) {
      const limiteProximidade = 15;
      let existente = conteineresDeEtiquetas.find(c => 
        Math.abs(c.top - top) < limiteProximidade && 
        Math.abs(c.left - left) < limiteProximidade
      );

      if (existente) return existente.elemento;

      const novoContainer = document.createElement('div');
      novoContainer.className = 'amaweb-badge-container';
      novoContainer.style.top = `${top - 26}px`;
      novoContainer.style.left = `${left}px`;
      overlayLayer.appendChild(novoContainer);

      conteineresDeEtiquetas.push({ top, left, elemento: novoContainer });
      return novoContainer;
    }

    request.data.forEach(item => {
      const ehErro = item["Tipo de erro"] === "Erro" || item["Tipo de erro"] === "Não aceitável";
      const ehAviso = item["Tipo de erro"] === "Aviso" || item["Tipo de erro"] === "Para ver manualmente";

      if ((ehErro || ehAviso) && item.Elementos && item.Elementos.elementosHtml) {
        
        item.Elementos.elementosHtml.forEach(elHtml => {
          const seletorCss = elHtml.pointer;
          if (seletorCss) {
            try {
              const elementoAlvo = document.querySelector(seletorCss);
              if (elementoAlvo) {
        
                const { rect, oculto } = obterCaixaVisivel(elementoAlvo);
                if (rect.width === 0 || rect.height === 0 || rect.width > window.innerWidth * 0.9) return;

                const topAbsoluto = rect.top + window.scrollY;
                const leftAbsoluto = rect.left + window.scrollX;

                const highlightBox = document.createElement('div');
                highlightBox.className = `amaweb-highlight-box ${ehErro ? 'error' : 'warning'}`;
                highlightBox.setAttribute('data-amaweb-pointer', seletorCss);
                
                highlightBox.style.top = `${topAbsoluto}px`;
                highlightBox.style.left = `${leftAbsoluto}px`;
                highlightBox.style.width = `${rect.width}px`;
                highlightBox.style.height = `${rect.height}px`;
                if (oculto){
                  highlightBox.style.outlineOffset = "4px";
                  highlightBox.style.outlineStyle = "dashed"; 
                } 
                
                overlayLayer.appendChild(highlightBox);

                const containerBadge = buscarOuCriarContainer(topAbsoluto, leftAbsoluto);
                const badge = document.createElement('div');
                badge.className = `amaweb-badge ${ehErro ? 'error' : 'warning'}`;
                badge.setAttribute('data-amaweb-pointer', seletorCss);
                
                // Indica com asterisco se for elemento oculto
                badge.innerText = (item.Criterio ? `WCAG ${item.Criterio}` : 'NBR 17225') + (oculto ? '*' : '');
                
                // Tratamento do tooltip
                let textoOriginal = item.Descricao || (item.Elementos && item.Elementos.descricao) || "";
                let valorSubstituicao = item.Valor || item["Numero de ocorrencias"] || "1";
                let textoLimpo = textoOriginal.replace(/\{\{value\}\}/g, valorSubstituicao);
                
                badge.setAttribute('data-description', textoLimpo + (oculto ? " (Erro em elemento oculto)" : ""));

                containerBadge.appendChild(badge);
                errosDestacados++;
              }
            } catch (e) {
              console.warn(`[Content Script] Erro no seletor: ${seletorCss}`, e);
            }
          }
        });
      }
    });

    console.log(`[Content Script] ${errosDestacados} falhas agrupadas e renderizadas.`);
  }

  if (request.action === "CLEAR_OVERLAYS") {
    const camada = document.getElementById('amaweb-overlay-layer');
    if (camada) camada.remove();
  }


  if (request.action === "HIGHLIGHT_SPECIFIC") {
    
    const camadaAntiga = document.getElementById('amaweb-overlay-layer');
    if (camadaAntiga) camadaAntiga.remove();

    const overlayLayer = document.createElement('div');
    overlayLayer.id = 'amaweb-overlay-layer';
    document.body.appendChild(overlayLayer);

    let rolouPagina = false;

    request.pointers.forEach(seletorCss => {
      try {
        const elementoAlvo = document.querySelector(seletorCss);
        if (elementoAlvo) {

          const { rect, oculto } = obterCaixaVisivel(elementoAlvo);
          if (rect.width === 0 || rect.height === 0) return;

          const topAbsoluto = rect.top + window.scrollY;
          const leftAbsoluto = rect.left + window.scrollX;

          const highlightBox = document.createElement('div');
          highlightBox.className = `amaweb-highlight-box ${request.tipo}`;
          
          highlightBox.style.top = `${topAbsoluto}px`;
          highlightBox.style.left = `${leftAbsoluto}px`;
          highlightBox.style.width = `${rect.width}px`;
          highlightBox.style.height = `${rect.height}px`;

          // Cria a etiqueta
          const badge = document.createElement('div');
          badge.className = `amaweb-badge ${request.tipo}`;
          badge.style.backgroundColor = "#3f3b8b";
          badge.innerText = (request.criterio ? `WCAG ${request.criterio}` : 'NBR') + (oculto ? '*' : '');

          // Configura o Tooltip no modo específico
          badge.setAttribute('data-description', (request.descricao || "Erro detectado.") + (oculto ? " (Erro em elemento oculto)" : ""));

          overlayLayer.appendChild(highlightBox);
          
          const containerBadge = document.createElement('div');
          containerBadge.className = 'amaweb-badge-container';
          containerBadge.style.top = `${topAbsoluto - 26}px`;
          containerBadge.style.left = `${leftAbsoluto}px`;
          
          containerBadge.appendChild(badge);
          overlayLayer.appendChild(containerBadge);
          
          if (!rolouPagina) {
            elementoAlvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
            rolouPagina = true;
          }
        }
      } catch (e) {
        console.warn(`[Content Script] Erro no seletor cirúrgico: ${seletorCss}`, e);
      }
    });
  }
});