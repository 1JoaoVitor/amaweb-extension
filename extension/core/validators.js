function respostaValida(resultado) {
  return resultado !== null && typeof resultado === 'object' && !Array.isArray(resultado);
}

function scoreValido(score) {
  if (typeof score === 'number') return Number.isFinite(score);
  if (typeof score !== 'string' || !score.trim()) return false;
  return Number.isFinite(Number(score));
}

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