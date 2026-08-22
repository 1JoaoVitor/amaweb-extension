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
  colorBar.textContent = ehErro ? 'x' : '-';

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
  if (ponteiros.length > 0) {
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
    button.addEventListener('click', () => {
      if (regraAtivaIndex === index) {
        regraAtivaIndex = null;
        button.classList.remove('ativo');
        button.textContent = 'Destacar';
        chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_OVERLAYS' });
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
        criterio: 'AMAWeb',
        tipo: ehErro ? 'error' : 'warning',
        descricao: item.Criterio || 'Erro detectado.'
      });
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
