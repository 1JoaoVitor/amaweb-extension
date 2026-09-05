/**
 * @fileoverview Gerenciador de exportação de relatórios de acessibilidade
 * 
 * Responsável por converter dados de avaliação em diferentes formatos
 * e disparar downloads para o navegador.
 * 
 * Exports: generateJsonReport, downloadJsonReport
 */

/**
 * Gera um conteúdo JSON formatado para exportação
 * 
 * @param {Array} dadosBrutos - Array de resultados da avaliação
 *   Cada item: { Criterio, Descricao, Tipo de erro, Nivel de Conformidade, ... }
 * @returns {string} Conteúdo JSON formatado com 2 espaços de indentação
 * 
 * @example
 *   const json = generateJsonReport([{ Criterio: "1.1.1", ... }]);
 *   // Retorna: "[\n  { ... },\n  ...\n]"
 */
export function generateJsonReport(dadosBrutos) {
  if (!Array.isArray(dadosBrutos) || dadosBrutos.length === 0) {
    return JSON.stringify([], null, 2);
  }
  
  return JSON.stringify(dadosBrutos, null, 2);
}

/**
 * Dispara o download de um arquivo JSON com os resultados
 * 
 * Cria um Blob em memória, gera uma URL temporária, cria um elemento <a>
 * invisível para triggar o download do navegador e limpa os recursos.
 * 
 * @param {string} conteudoJson - Conteúdo JSON (já formatado)
 * @param {string} nomeArquivo - Nome do arquivo (sem extensão, será adicionado .json)
 *   Se não fornecido, usa timestamp: relatorio-amaweb-{timestamp}.json
 * @returns {void}
 * 
 * @example
 *   const json = generateJsonReport(dados);
 *   downloadJsonReport(json, 'relatorio-site-exemplo');
 *   // Download: relatorio-site-exemplo.json
 */
export function downloadJsonReport(conteudoJson, nomeArquivo) {
  // Validação básica
  if (!conteudoJson || typeof conteudoJson !== 'string') {
    console.error('[ExportReport] Conteúdo JSON inválido');
    return;
  }

  // Define nome padrão se não fornecido
  const nome = nomeArquivo || `relatorio-amaweb-${new Date().getTime()}`;

  try {
    // 1. Cria um Blob a partir do string JSON
    const blob = new Blob([conteudoJson], { type: 'application/json; charset=utf-8' });
    
    // 2. Gera uma URL temporária para o Blob
    const urlVirtual = URL.createObjectURL(blob);
    
    // 3. Cria um elemento <a> invisível para simular click de download
    const linkInvisivel = document.createElement('a');
    linkInvisivel.href = urlVirtual;
    linkInvisivel.download = `${nome}.json`;
    linkInvisivel.style.display = 'none';
    
    // 4. Adiciona o link ao DOM, clica e remove
    document.body.appendChild(linkInvisivel);
    linkInvisivel.click();
    document.body.removeChild(linkInvisivel);
    
    // 5. Limpa a URL temporária da memória
    URL.revokeObjectURL(urlVirtual);
    
    console.log(`[ExportReport] Download iniciado: ${nome}.json`);
  } catch (error) {
    console.error('[ExportReport] Erro ao fazer download:', error);
  }
}

/**
 * Função utilitária para exportar dados completos em uma única chamada
 * 
 * Combina generateJsonReport + downloadJsonReport em um único passo.
 * 
 * @param {Array} dadosBrutos - Array de resultados da avaliação
 * @param {string} nomeArquivo - Nome do arquivo (opcional)
 * @returns {void}
 * 
 * @example
 *   exportarRelatorio(dados, 'avaliacao-site');
 */
export function exportarRelatorio(dadosBrutos, nomeArquivo) {
  const json = generateJsonReport(dadosBrutos);
  downloadJsonReport(json, nomeArquivo);
}
