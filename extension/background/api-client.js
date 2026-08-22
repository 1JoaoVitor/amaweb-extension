const API_URL = 'https://amaweb.unifesp.br/server/amp/eval/html';
const REQUEST_TIMEOUT_MS = 3000000;

export async function avaliarHtml(html) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html }),
      signal: controller.signal
    });

    const responseText = await response.text();
    let data;
    try {
      data = responseText ? JSON.parse(responseText) : null;
    } catch {
      throw new Error(`Resposta inválida da API (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`A avaliação excedeu o tempo limite de ${REQUEST_TIMEOUT_MS / 1000} segundos.`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
