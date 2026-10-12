/**
 * @fileoverview Validadores de schema para respostas da API
 * 
 * Garante integridade dos dados antes de passar para o adaptador.
 * Valida estrutura, tipos, valores e presença de campos obrigatórios.
 * 
 * Exports: validateEvaluationResponse(resposta)
 */

function respostaValida(resultado) {
  return resultado !== null && typeof resultado === 'object' && !Array.isArray(resultado);
}

function scoreValido(score) {
  if (typeof score === 'number') return Number.isFinite(score);
  if (typeof score !== 'string' || !score.trim()) return false;
  return Number.isFinite(Number(score));
}

/**
 * Valida a estrutura da resposta da API AMAWeb
 * 
 * Verifica presença de campos obrigatórios (result.data.nodes, score),
 * tipos de dados, ranges de valores e formato de arrays vs objetos.
 * 
 * @param {Object} resposta - Resposta completa do background.js / API
 * @returns {Object} Resultado da validação
 *   - { valid: true, data: { nodes, score, isEmpty?, count? } }
 *   - { valid: false, error: string, code?: string }
 * 
 * @example
 *   // Sucesso com dados
 *   validateEvaluationResponse({ success: 1, result: { data: { nodes: {...}, score: "85" } } })
 *   // → { valid: true, data: { nodes: {...}, score: "85", isEmpty: false } }
 *   
 *   // Sucesso sem dados
 *   validateEvaluationResponse({ success: 1, result: { data: { nodes: {}, score: "100" } } })
 *   // → { valid: true, data: { nodes: {}, score: "100", isEmpty: true, message: "..." } }
 *   
 *   // Erro de validação
 *   validateEvaluationResponse({ success: 0, message: "RATE_LIMIT_EXCEEDED", result: null })
 *   // → { valid: false, error: "...", code: "RATE_LIMIT_EXCEEDED" }
 */
export function validateEvaluationResponse(resposta) {
  if (!respostaValida(resposta)) {
    return { valid: false, error: 'A API retornou uma resposta vazia ou inválida.' };
  }

  if (resposta.success === 0) {
    return { valid: false, error: 'A API retornou um erro de avaliação.', code: resposta.message };
  }

  const data = resposta.result?.data;
  if (!respostaValida(data)) {
    return { valid: false, error: 'A resposta da API não contém os dados da avaliação.' };
  }

  if (!respostaValida(data.nodes)) {
    return { valid: false, error: 'A resposta da API não contém nós de avaliação válidos.' };
  }

  if (!scoreValido(data.score)) {
    return { valid: false, error: 'A resposta da API contém uma pontuação inválida.' };
  }

  return { valid: true, data };
}