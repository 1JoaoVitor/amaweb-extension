chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "RENDER_OVERLAYS") {
    console.log("[Content Script] Renderizando overlays inteligentes...");
    
    const camadaAntiga = document.getElementById('amaweb-overlay-layer');
    if (camadaAntiga) camadaAntiga.remove();

    const overlayLayer = document.createElement('div');
    overlayLayer.id = 'amaweb-overlay-layer';
    document.body.appendChild(overlayLayer);

    let errosDestacados = 0;
    
    // Matriz para guardar os contêineres de etiquetas já criados na tela
    const conteineresDeEtiquetas = [];

    // Função que verifica se já existe um agrupamento por perto (raio de 15px)
    function buscarOuCriarContainer(top, left) {
      const limiteProximidade = 15;
      let existente = conteineresDeEtiquetas.find(c => 
        Math.abs(c.top - top) < limiteProximidade && 
        Math.abs(c.left - left) < limiteProximidade
      );

      if (existente) return existente.elemento;

      // Se não existir, cria um novo contêiner flexível
      const novoContainer = document.createElement('div');
      novoContainer.className = 'amaweb-badge-container';
      novoContainer.style.top = `${top - 26}px`; // Sobe 26px para não cobrir o contorno
      novoContainer.style.left = `${left}px`;
      overlayLayer.appendChild(novoContainer);

      conteineresDeEtiquetas.push({ top, left, elemento: novoContainer });
      return novoContainer;
    }

    request.data.forEach(item => {
      if (item["Tipo de erro"] === "Erro" && item.Elementos && item.Elementos.elementosHtml) {
        
        item.Elementos.elementosHtml.forEach(elHtml => {
          const seletorCss = elHtml.pointer;
          
          if (seletorCss) {
            try {
              const elementoAlvo = document.querySelector(seletorCss);
              
              if (elementoAlvo) {
                const rect = elementoAlvo.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;

                const topAbsoluto = rect.top + window.scrollY;
                const leftAbsoluto = rect.left + window.scrollX;

                // 1. Desenha a borda vermelha
                const highlightBox = document.createElement('div');
                highlightBox.className = 'amaweb-highlight-box';
                highlightBox.style.top = `${topAbsoluto}px`;
                highlightBox.style.left = `${leftAbsoluto}px`;
                highlightBox.style.width = `${rect.width}px`;
                highlightBox.style.height = `${rect.height}px`;
                overlayLayer.appendChild(highlightBox);

                // 2. Busca ou cria o grupo de etiquetas para essa coordenada
                const containerBadge = buscarOuCriarContainer(topAbsoluto, leftAbsoluto);

                // 3. Cria a etiqueta e joga dentro do grupo
                const badge = document.createElement('div');
                badge.className = 'amaweb-badge';
                badge.innerText = item.Criterio ? `WCAG ${item.Criterio}` : 'NBR 17225';
                
                let textoOriginal = item.Descricao || item.Elementos.descricao || "";
                let textoLimpo = textoOriginal.replace(/\{\{value\}\}/g, item["Numero de ocorrencias"] || "1");
                badge.setAttribute('data-description', textoLimpo);

                containerBadge.appendChild(badge);
                
                errosDestacados++;
              }
            } catch (e) {
              console.warn(`[Content Script] Falha ao ler o seletor: ${seletorCss}`, e);
            }
          }
        });
      }
    });

    console.log(`[Content Script] ${errosDestacados} falhas agrupadas e renderizadas.`);
  }
});