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

  const filtroTipo = document.getElementById('filtro-tipo')?.value || 'todos';
  const filtroNivel = document.getElementById('filtro-nivel')?.value || 'todos';
  const ordenacao = document.getElementById('ordenacao')?.value || 'padrao';

  let dadosFiltrados = dadosOriginais.filter(item => {
    const ehErro = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável';
    const ehAviso = item['Tipo de erro'] === 'Aviso' || item['Tipo de erro'] === 'Para ver manualmente';
    
    if (!ehErro && !ehAviso) return false;
    if (filtroTipo === 'error' && !ehErro) return false;
    if (filtroTipo === 'warning' && !ehAviso) return false;
    if (filtroNivel !== 'todos' && !item['Nivel de Conformidade']?.includes(filtroNivel)) return false;

    return true;
  });

  if (ordenacao === 'ocorrencias-desc') {
    dadosFiltrados.sort((a, b) => (b['Numero de ocorrencias'] || 0) - (a['Numero de ocorrencias'] || 0));
  } else if (ordenacao === 'ocorrencias-asc') {
    dadosFiltrados.sort((a, b) => (a['Numero de ocorrencias'] || 0) - (b['Numero de ocorrencias'] || 0));
  }

  if (dadosFiltrados.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Nenhum problema corresponde aos filtros aplicados.';
    listaDetalhada.appendChild(emptyState);
    return;
  }

  dadosFiltrados.forEach((item) => {
    const indexOriginal = dadosOriginais.indexOf(item);
    renderizarCardResultado(item, indexOriginal, tab);
  });
}

function renderizarCardResultado(item, index, tab) {
  const ehErro = item['Tipo de erro'] === 'Erro' || item['Tipo de erro'] === 'Não aceitável';
  
  const mapaElementos = new Map();
  if (Array.isArray(item.Elementos?.elementosHtml)) {
    item.Elementos.elementosHtml.forEach(el => {
      if (el.pointer && !mapaElementos.has(el.pointer)) {
        mapaElementos.set(el.pointer, el.htmlCode || '');
      }
    });
  }
  
  const ponteiros = Array.from(mapaElementos.keys());
  const dicasHtml = Object.fromEntries(mapaElementos); 

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

  const btnExpandir = document.createElement('button');
  btnExpandir.className = 'btn-expandir';
  btnExpandir.textContent = 'Ver Detalhes ▼';
  
  const painelDetalhes = document.createElement('div');
  painelDetalhes.className = 'am-card-details';
  
  const criteriosText = document.createElement('p');
  criteriosText.className = 'am-details-criteria';
  criteriosText.textContent = `Critérios: ${item.CriteriosRelacionados || 'N/A'} (Nível ${item['Nivel de Conformidade'] || 'A'})`;
  painelDetalhes.appendChild(criteriosText);

  if (item.Referencia && typeof item.Referencia === 'string' && item.Referencia.startsWith('http')) {
    const linkRef = document.createElement('a');
    linkRef.href = item.Referencia;
    linkRef.target = '_blank';
    linkRef.rel = 'noopener noreferrer';
    linkRef.className = 'am-details-link';
    linkRef.textContent = 'Ler documentação oficial';
    painelDetalhes.appendChild(linkRef);
  }

  if (ponteiros.length > 0) {
    const tituloSeletores = document.createElement('p');
    tituloSeletores.className = 'am-details-selectors-title';
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

  // CORREÇÃO DO CARD INVISÍVEL: Ignora a validação restrita e cria sempre o botão Destacar se houver ponteiros.
  if (ponteiros.length === 0) {
    const globalError = document.createElement('span');
    globalError.className = 'am-card-global';
    globalError.textContent = 'Erro global';
    
    const botoesAcao = document.createElement('div');
    botoesAcao.className = 'am-card-actions'; 
    botoesAcao.append(btnExpandir);
    
    footer.append(globalError, botoesAcao);
  } else {
    const count = document.createElement('span');
    count.className = 'am-card-count';
    count.textContent = ponteiros.length;
    
    const countLabel = document.createElement('span');
    countLabel.className = 'am-card-count-label';
    countLabel.textContent = ponteiros.length === 1 ? ' elemento' : ' elementos';
    count.appendChild(countLabel);

    const button = document.createElement('button');
    button.className = 'btn-destacar';
    button.type = 'button';
    button.textContent = 'Destacar';
    button.dataset.index = index;

    // ======== NAVEGAÇÃO ========
    const navContainer = document.createElement('div');
    navContainer.className = 'am-nav-destaque';
    let currentIndex = 0;
    
    // Deixamos TODOS os ponteiros, não apagamos os que estão ocultos
    let ponteirosAtivos = [...ponteiros];
    
    if (ponteiros.length > 1) {
      const btnPrev = document.createElement('button');
      btnPrev.className = 'am-nav-btn';
      btnPrev.textContent = '◄';
      
      const txtCount = document.createElement('span');
      txtCount.className = 'am-nav-txt';
      txtCount.textContent = `1 de ${ponteiros.length}`;
      
      const btnNext = document.createElement('button');
      btnNext.className = 'am-nav-btn';
      btnNext.textContent = '►';

      const focarAtual = async () => {
        txtCount.textContent = `...`; 
        try {
          // Uso das actions _V2
          const response = await chrome.tabs.sendMessage(tab.id, { 
            action: 'FOCUS_V2', 
            pointer: ponteirosAtivos[currentIndex],
            dicasHtml: dicasHtml 
          });

          if (response?.status === 'not_found') {
            txtCount.textContent = `${currentIndex + 1}/${ponteirosAtivos.length} (Ñ enc.)`;
            txtCount.title = "O elemento foi removido ou alterado pela página.";
          } else if (response?.status === 'hidden') {
            txtCount.textContent = `${currentIndex + 1}/${ponteirosAtivos.length} (Oculto)`;
            txtCount.title = "O elemento está invisível na tela no momento.";
          } else {
            txtCount.textContent = `${currentIndex + 1} de ${ponteirosAtivos.length}`;
            txtCount.title = "";
          }
        } catch (e) {
          txtCount.textContent = `${currentIndex + 1} de ${ponteirosAtivos.length}`;
        }
      };

      btnPrev.addEventListener('click', () => {
        if (currentIndex > 0) { currentIndex--; focarAtual(); }
      });

      btnNext.addEventListener('click', () => {
        if (currentIndex < ponteirosAtivos.length - 1) { currentIndex++; focarAtual(); }
      });

      navContainer.append(btnPrev, txtCount, btnNext);
    }
    
    button.addEventListener('click', async () => {
      document.querySelectorAll('.am-nav-destaque').forEach(el => el.classList.remove('show'));

      if (regraAtivaIndex === index) {
        regraAtivaIndex = null;
        button.classList.remove('ativo');
        button.textContent = 'Destacar';
        count.textContent = ponteiros.length;
        countLabel.textContent = ponteiros.length === 1 ? ' elemento' : ' elementos';
        
        // Uso das actions _V2 para apenas REMOVER o destaque (não apaga os originais)
        chrome.tabs.sendMessage(tab.id, { action: 'CLEAR_HIGHLIGHT' }).catch(()=>{});
        return;
      }
      
      regraAtivaIndex = index;
      document.querySelectorAll('.btn-destacar').forEach(otherButton => {
        otherButton.classList.remove('ativo');
        otherButton.textContent = 'Destacar';
      });
      button.classList.add('ativo');
      button.textContent = 'Buscando...'; 

      let qtdVisiveis = ponteiros.length;
      try {
        // Uso das actions _V2
        const response = await chrome.tabs.sendMessage(tab.id, {
          action: 'FILTER_V2',
          pointers: ponteiros,
          dicasHtml: dicasHtml
        });
        if (response && response.validPointers) {
          qtdVisiveis = response.validPointers.length;
        }
      } catch (e) {}

      button.textContent = 'Remover Destaque';
      count.textContent = ponteiros.length;
      
      if (qtdVisiveis === ponteiros.length) {
        countLabel.textContent = ponteiros.length === 1 ? ' elemento' : ' elementos';
      } else {
        const ocultos = ponteiros.length - qtdVisiveis;
        countLabel.textContent = ` elementos (${ocultos} oculto/quebrado)`;
      }

      if (ponteiros.length > 1) {
        navContainer.classList.add('show');
        currentIndex = 0;
        const txtC = navContainer.querySelector('.am-nav-txt');
        txtC.textContent = `1 de ${ponteiros.length}`;
        
        // Foca o primeiro automaticamente via _V2
        chrome.tabs.sendMessage(tab.id, { 
           action: 'FOCUS_V2', 
           pointer: ponteiros[0], 
           dicasHtml: dicasHtml 
        }).then(res => {
           if (res?.status === 'not_found') txtC.textContent = `1/${ponteiros.length} (Ñ enc.)`;
           else if (res?.status === 'hidden') txtC.textContent = `1/${ponteiros.length} (Oculto)`;
        }).catch(()=>{});
      }

      // Uso das actions _V2 com verificação de sucesso
      try {
        const hRes = await chrome.tabs.sendMessage(tab.id, {
          action: 'HIGHLIGHT_V2',
          pointers: ponteiros,
          dicasHtml: dicasHtml,
          criterio: item.Criterio || 'AMAWeb',
          tipo: ehErro ? 'error' : 'warning',
          descricao: descricao 
        });

        // Se a página responder que encontrou 0 elementos
        if (hRes && hRes.encontrados === 0) {
          button.textContent = 'Erro: Inacessível';
          button.style.backgroundColor = '#64748b';
          button.style.borderColor = '#64748b';
          countLabel.textContent = ` elementos (Ocultos no DOM)`;
        }
      } catch (e) {
        // Ignora erro se a página demorar a responder
      }
    });
      

    const botoesAcao = document.createElement('div');
    botoesAcao.className = 'am-card-actions'; 
    if (ponteiros.length > 1) botoesAcao.classList.add('has-nav');
    
    botoesAcao.append(navContainer, button, btnExpandir);
    
    footer.append(count, botoesAcao);
  }

  body.append(title, level, footer, painelDetalhes);
  card.append(colorBar, body);
  document.getElementById('lista-detalhada').appendChild(card);
} 

/**
 * Atualiza a tabela de estatísticas com base no modo escolhido (Elementos vs Regras)
 */
export function atualizarEstatisticas(dados, modo = 'elementos') {
  const stats = {
    sucesso: { total: 0, A: 0, AA: 0, AAA: 0, regrasUnicas: new Set(), regrasA: new Set(), regrasAA: new Set(), regrasAAA: new Set() },
    aviso: { total: 0, A: 0, AA: 0, AAA: 0, regrasUnicas: new Set(), regrasA: new Set(), regrasAA: new Set(), regrasAAA: new Set() },
    erro: { total: 0, A: 0, AA: 0, AAA: 0, regrasUnicas: new Set(), regrasA: new Set(), regrasAA: new Set(), regrasAAA: new Set() },
    geral: { total: 0, A: 0, AA: 0, AAA: 0, regrasUnicas: new Set(), regrasA: new Set(), regrasAA: new Set(), regrasAAA: new Set() }
  };

  dados.forEach(item => {
    let cat = null;
    const tipo = item['Tipo de erro'];
    
    if (tipo === 'Sucesso') cat = 'sucesso';
    else if (tipo === 'Aviso' || tipo === 'Para ver manualmente') cat = 'aviso';
    else if (tipo === 'Erro' || tipo === 'Não aceitável') cat = 'erro';

    if (cat) {
      const nivel = (item['Nivel de Conformidade'] || 'A').trim().toUpperCase();
      const nomeRegra = item.Criterio || item.Regra || 'Regra Desconhecida';
      
      if (modo === 'elementos') {
        // Soma a quantidade de vezes que o erro ocorreu no site
        const ocorrencias = parseInt(item['Numero de ocorrencias']) || 1;
        stats[cat].total += ocorrencias;
        stats.geral.total += ocorrencias;
        
        if (stats[cat][nivel] !== undefined) {
          stats[cat][nivel] += ocorrencias;
          stats.geral[nivel] += ocorrencias;
        }
      } else {
        // MODO REGRAS: Guarda o nome da regra no Conjunto (Set). Ele ignora repetidas automaticamente.
        stats[cat].regrasUnicas.add(nomeRegra);
        stats.geral.regrasUnicas.add(nomeRegra);
        
        if (nivel === 'A') { stats[cat].regrasA.add(nomeRegra); stats.geral.regrasA.add(nomeRegra); }
        else if (nivel === 'AA') { stats[cat].regrasAA.add(nomeRegra); stats.geral.regrasAA.add(nomeRegra); }
        else if (nivel === 'AAA') { stats[cat].regrasAAA.add(nomeRegra); stats.geral.regrasAAA.add(nomeRegra); }
      }
    }
  });

  // Se for o Modo Regras, nós trocamos os totais pelo tamanho (size) dos Conjuntos Únicos
  if (modo === 'regras') {
    ['sucesso', 'aviso', 'erro', 'geral'].forEach(cat => {
      stats[cat].total = stats[cat].regrasUnicas.size;
      stats[cat].A = stats[cat].regrasA.size;
      stats[cat].AA = stats[cat].regrasAA.size;
      stats[cat].AAA = stats[cat].regrasAAA.size;
    });
  }

  const atualizarDOM = (id, valor) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  };

  atualizarDOM('count-sucesso-total', stats.sucesso.total);
  atualizarDOM('count-sucesso-a', stats.sucesso.A);
  atualizarDOM('count-sucesso-aa', stats.sucesso.AA);
  atualizarDOM('count-sucesso-aaa', stats.sucesso.AAA);

  atualizarDOM('count-aviso-total', stats.aviso.total);
  atualizarDOM('count-aviso-a', stats.aviso.A);
  atualizarDOM('count-aviso-aa', stats.aviso.AA);
  atualizarDOM('count-aviso-aaa', stats.aviso.AAA);

  atualizarDOM('count-erro-total', stats.erro.total);
  atualizarDOM('count-erro-a', stats.erro.A);
  atualizarDOM('count-erro-aa', stats.erro.AA);
  atualizarDOM('count-erro-aaa', stats.erro.AAA);

  atualizarDOM('count-geral-total', stats.geral.total);
  atualizarDOM('count-geral-a', stats.geral.A);
  atualizarDOM('count-geral-aa', stats.geral.AA);
  atualizarDOM('count-geral-aaa', stats.geral.AAA);
}