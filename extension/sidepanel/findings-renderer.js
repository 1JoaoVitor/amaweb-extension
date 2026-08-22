let regraAtivaIndex = null;

export function limparRegraAtiva() {
  regraAtivaIndex = null;
}

export function renderizarCardResultado(item, index, tab) {
  const ehErro = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável';
  const ehAviso = item['Tipo de erro'] === 'Aviso' || item['Tipo de erro'] === 'Para ver manualmente';
  if (!ehErro && !ehAviso) return;

  const ponteiros = Array.isArray(item.Elementos?.elementosHtml)
    ? item.Elementos.elementosHtml.map(elemento => elemento.pointer).filter(Boolean)
    : [];
  const ocorrencias = item['Numero de ocorrencias'] || 1;
  const descricao = (item.Descricao || item.Elementos?.descricao || '').replace(/\{\{value\}\}/g, item.Valor || ocorrencias);
  
  const card = document.createElement('div');
  card.className = 'am-card';

  const colorBar = document.createElement('div');
  colorBar.className = `am-card-color ${ehErro ? 'error' : 'warning'}`;
  
  // 1. Ícones SVG inseridos diretamente (seguro, pois é string estática)
  colorBar.innerHTML = ehErro 
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' 
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>';

  const body = document.createElement('div');
  body.className = 'am-card-body';
  
  const title = document.createElement('p');
  title.className = 'am-card-title';
  
  const criterion = document.createElement('strong');
  criterion.textContent = item.Criterio || 'Regra sem nome';
  
  const description = document.createElement('span');
  description.className = 'am-card-description';
  description.textContent = descricao;
  
  title.append(criterion, document.createElement('br'), description);

  const level = document.createElement('p');
  level.className = 'am-card-level';
  level.textContent = `Nível: ${item['Nivel de Conformidade'] || 'A'}`;

  const footer = document.createElement('div');
  footer.className = 'am-card-footer';

  // 2. Trava para Erros de Estrutura (head, meta, html)
  const TAGS_ESTRUTURAIS = ['html', 'head', 'meta', 'title', 'script', 'style', 'link', 'noscript'];
  const erroEstrutural = ponteiros.length > 0 && ponteiros.every(p => {
    try {
      const partes = p.split('>');
      const alvo = partes[partes.length - 1].trim().toLowerCase();
      // O regex /^[a-z]+/ captura apenas letras no início da string (ex: extrai "img" de "img:nth-child(2)")
      const match = alvo.match(/^[a-z]+/); 
      return match && TAGS_ESTRUTURAIS.includes(match[0]);
    } catch (e) { return false; }
  });

  if (erroEstrutural) {
    const globalError = document.createElement('span');
    globalError.className = 'am-card-global';
    globalError.textContent = 'Erro de código (Sem representação visual)';
    footer.appendChild(globalError);
  } else if (ponteiros.length > 0) {
    const count = document.createElement('span');
    count.className = 'am-card-count';
    count.textContent = ponteiros.length;
    
    const countLabel = document.createElement('span');
    countLabel.className = 'am-card-count-label';
    countLabel.textContent = ' elementos';
    count.appendChild(countLabel);

    const button = document.createElement('button');
    button.className = 'btn-destacar';
    button.type = 'button';
    button.textContent = 'Destacar';
    button.dataset.index = index;
    button.addEventListener('click', () => {
      if (regraAtivaIndex === index) {
        regraAtivaIndex = null;
        button.classList.remove('ativo');
        button.textContent = 'Destacar';
        chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_OVERLAYS' }).catch(()=>{});
        return;
      }

      regraAtivaIndex = index;
      document.querySelectorAll('.btn-destacar').forEach(otherButton => {
        otherButton.classList.remove('ativo');
        otherButton.textContent = 'Destacar';
      });
      button.classList.add('ativo');
      button.textContent = 'Remover Destaque';
      
      chrome.tabs.sendMessage(tab.id, {
        action: 'HIGHLIGHT_SPECIFIC',
        pointers: ponteiros,
        criterio: item.Criterio || 'AMAWeb',
        tipo: ehErro ? 'error' : 'warning',
        // 3. Passando a variável de descrição real para o Tooltip da página
        descricao: descricao 
      }).catch(()=>{});
    });
    footer.append(count, button);
  } else {
    const globalError = document.createElement('span');
    globalError.className = 'am-card-global';
    globalError.textContent = 'Erro global';
    footer.appendChild(globalError);
  }

  body.append(title, level, footer);
  card.append(colorBar, body);
  document.getElementById('lista-detalhada').appendChild(card);
}