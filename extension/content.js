chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "RENDER_OVERLAYS") {
    console.log("[Content Script] Dados recebidos para renderização visual:", request.data);
    
    // Remove overlays anteriores se o usuário clicar para avaliar novamente
    const overlaysAntigos = document.querySelectorAll('.amaweb-overlay-container');
    overlaysAntigos.forEach(el => el.remove());

    let errosDestacados = 0;

    // Varre o array de resultados trazidos do servidor
    request.data.forEach(item => {
      // Filtra apenas o que for do tipo "Erro" e contiver elementosHtml válidos
      if (item["Tipo de erro"] === "Erro" && item.Elementos && item.Elementos.elementosHtml) {
        
        item.Elementos.elementosHtml.forEach(elHtml => {
          const seletorCss = elHtml.pointer;
          
          if (seletorCss) {
            try {
              // Procura o elemento exato na página usando o ponteiro do AMAWeb
              const elementoAlvo = document.querySelector(seletorCss);
              
              if (elementoAlvo) {
                // Aplica o destaque visual (Overlay) diretamente nas bordas do elemento
                elementoAlvo.style.outline = "3px solid #ff4d4d";
                elementoAlvo.style.outlineOffset = "3px";
                elementoAlvo.style.position = "relative";

                // Opcional: Adiciona um atributo para sabermos o critério WCAG violado
                elementoAlvo.setAttribute('data-amaweb-criterio', item.Criterio);
                
                errosDestacados++;
              }
            } catch (e) {
              console.warn(`[Content Script] Não foi possível selecionar o ponteiro: ${seletorCss}`, e);
            }
          }
        });
      }
    });

    alert(`Varredura concluída! ${errosDestacados} falhas críticas foram sinalizadas visualmente na interface.`);
  }
});