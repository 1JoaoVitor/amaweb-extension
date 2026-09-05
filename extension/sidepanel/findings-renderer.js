/**
 * @fileoverview Renderizador de resultados de avaliação no side panel
 * 
 * Responsável por filtrar, ordenar e renderizar os cards de erros/avisos.
 * Gerencia estado de expansão dos cards e comunicação com content script para overlays.
 * 
 * Exports: atualizarListaDeResultados, limparRegraAtiva
 */

let regraAtivaIndex = null;

/**
 * Limpa a regra ativa (remove destaque de sobreposição anterior)
 * @returns {void}
 */
export function limparRegraAtiva() {
  regraAtivaIndex = null;
}

/**
 * Atualiza a lista de resultados com filtros e ordenação aplicados.
 * 
 * Lê os valores dos selects (#filtro-tipo, #filtro-nivel, #ordenacao),
 * filtra e ordena os dados, renderiza os cards individuais.
 * Comunica com content script para renderizar/limpar overlays.
 * 
 * @param {Array} dadosOriginais - Array de resultados do adaptador
 *   Cada item: { Criterio, Descricao, Tipo de erro, Nivel de Conformidade, ... }
 * @param {Object} tab - Objeto chrome.tabs.Tab com { id, url, ... }
 * @returns {void}
 * 
 * @example
 *   const dados = [
 *     { Criterio: "1.1.1", Descricao: "Alt text missing", Tipo de erro: "Erro", Nivel de Conformidade: "A" },
 *     ...
 *   ];
 *   atualizarListaDeResultados(dados, { id: 123, url: "https://..." });
 */
export function atualizarListaDeResultados(dadosOriginais, tab) {
  const listaDetalhada = document.getElementById('lista-detalhada');
  listaDetalhada.replaceChildren();
  limparRegraAtiva();

  // 1. Captura os valores dos filtros
  const filtroTipo = document.getElementById('filtro-tipo')?.value || 'todos';
  const filtroNivel = document.getElementById('filtro-nivel')?.value || 'todos';
  const ordenacao = document.getElementById('ordenacao')?.value || 'padrao';

  // 2. Aplica os Filtros
  let dadosFiltrados = dadosOriginais.filter(item => {
    const ehErro = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável';
    const ehAviso = item['Tipo de erro'] === 'Aviso' || item['Tipo de erro'] === 'Para ver manualmente';
    
    if (!ehErro && !ehAviso) return false;

    // Filtro de Tipo
    if (filtroTipo === 'error' && !ehErro) return false;
    if (filtroTipo === 'warning' && !ehAviso) return false;

    // Filtro de Nível
    if (filtroNivel !== 'todos' && !item['Nivel de Conformidade']?.includes(filtroNivel)) return false;

    return true;
  });

  // 3. Aplica a Ordenação
  if (ordenacao === 'ocorrencias-desc') {
    dadosFiltrados.sort((a, b) => (b['Numero de ocorrencias'] || 0) - (a['Numero de ocorrencias'] || 0));
  } else if (ordenacao === 'ocorrencias-asc') {
    dadosFiltrados.sort((a, b) => (a['Numero de ocorrencias'] || 0) - (b['Numero de ocorrencias'] || 0));
  }

  // 4. Renderiza estado vazio ou os cards
  if (dadosFiltrados.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Nenhum problema corresponde aos filtros aplicados.';
    listaDetalhada.appendChild(emptyState);
    return;
  }

  // Usa o index original para não quebrar a lógica do overlay
  dadosFiltrados.forEach((item) => {
    const indexOriginal = dadosOriginais.indexOf(item);
    renderizarCardResultado(item, indexOriginal, tab);
  });
}

function renderizarCardResultado(item, index, tab) {
  const ehErro = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável';
  const ponteiros = Array.isArray(item.Elementos?.elementosHtml)
    ? item.Elementos.elementosHtml.map(elemento => elemento.pointer).filter(Boolean)
    : [];
  const ocorrencias = item['Numero de ocorrencias'] || 1;
  const descricao = (item.Descricao || item.Elementos?.descricao || '').replace(/\{\{value\}\}/g, item.Valor || ocorrencias);
  
  const card = document.createElement('div');
  card.className = 'am-card';

  const colorBar = document.createElement('div');
  colorBar.className = `am-card-color ${ehErro ? 'error' : 'warning'}`;
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

  // Botão e Painel de Detalhes Expandido
  const btnExpandir = document.createElement('button');
  btnExpandir.className = 'btn-expandir';
  btnExpandir.textContent = 'Ver Detalhes ▼';
  
  const painelDetalhes = document.createElement('div');
  painelDetalhes.className = 'am-card-details';
  
  const criteriosText = document.createElement('p');
  criteriosText.style.margin = '0 0 6px 0';
  criteriosText.textContent = `Critérios: ${item.CriteriosRelacionados || 'N/A'} (Nível ${item['Nivel de Conformidade'] || 'A'})`;
  painelDetalhes.appendChild(criteriosText);

  if (item.Referencia && typeof item.Referencia === 'string' && item.Referencia.startsWith('http')) {
    const linkRef = document.createElement('a');
    linkRef.href = item.Referencia;
    linkRef.target = '_blank';
    linkRef.rel = 'noopener noreferrer';
    linkRef.style.cssText = 'color: var(--color-primary); display: inline-block; margin-bottom: 8px; text-decoration: underline;';
    linkRef.textContent = 'Ler documentação oficial';
    painelDetalhes.appendChild(linkRef);
  }

  if (ponteiros.length > 0) {
    const tituloSeletores = document.createElement('p');
    tituloSeletores.style.margin = '4px 0 2px 0';
    tituloSeletores.textContent = 'Seletores afetados:';
    painelDetalhes.appendChild(tituloSeletores);

    const listaSeletores = document.createElement('ul');
    listaSeletores.className = 'am-details-list';
    ponteiros.forEach(p => {
      const li = document.createElement('li');
      li.textContent = p;
      listaSeletores.appendChild(li);
    });
    painelDetalhes.appendChild(listaSeletores);
  }

  btnExpandir.addEventListener('click', () => {
    card.classList.toggle('expandido');
    btnExpandir.textContent = card.classList.contains('expandido') ? 'Ocultar Detalhes ▲' : 'Ver Detalhes ▼';
  });

  // VALIDAÇÃO POSITIVA: Libera o botão "Destacar" apenas se houver elementos visíveis reais na tela
  const TAGS_VISIVEIS_PERMITIDAS = ['a', 'button', 'input', 'img', 'select', 'textarea', 'video', 'audio', 'canvas', 'table', 'form', 'label'];
  
  const temElementoVisual = ponteiros.length > 0 && ponteiros.some(p => {
    try {
      const partes = p.split('>');
      const alvo = partes[partes.length - 1].trim().toLowerCase();
      const match = alvo.match(/^[a-z0-9]+/);
      return match && TAGS_VISIVEIS_PERMITIDAS.includes(match[0]);
    } catch (e) { 
      return false; 
    }
  });

  if (!temElementoVisual || ponteiros.length === 0) {
    const globalError = document.createElement('span');
    globalError.className = 'am-card-global';
    globalError.textContent = ponteiros.length > 0 ? 'Erro de código (invisível)' : 'Erro global';
    
    const botoesAcao = document.createElement('div');
    botoesAcao.style.display = 'flex';
    botoesAcao.style.gap = '8px';
    botoesAcao.style.marginLeft = 'auto';
    botoesAcao.append(btnExpandir);
    
    footer.append(globalError, botoesAcao);
  } else {
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
        descricao: descricao 
      }).catch(()=>{});
    });

    const botoesAcao = document.createElement('div');
    botoesAcao.style.display = 'flex';
    botoesAcao.style.gap = '8px';
    botoesAcao.style.marginLeft = 'auto';
    botoesAcao.append(button, btnExpandir);
    
    footer.append(count, botoesAcao);
  }

  body.append(title, level, footer, painelDetalhes);
  card.append(colorBar, body);
  document.getElementById('lista-detalhada').appendChild(card);
}