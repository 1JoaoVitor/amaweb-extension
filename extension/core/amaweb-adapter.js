export function adaptarJsonAmaWeb(nodes, scoreGeral, dicionarioAMA) {
  const resultados = [];

  for (const [nomeDaRegra, arrayDeResultados] of Object.entries(nodes || {})) {
    if (!Array.isArray(arrayDeResultados)) continue;

    const tituloTraduzido = dicionarioAMA?.ELEMS?.[nomeDaRegra] || nomeDaRegra;

    arrayDeResultados.forEach(resultado => {
      let status = 'manual';
      if (resultado.verdict === 'failed') status = 'error';
      else if (resultado.verdict === 'warning') status = 'warning';
      else if (resultado.verdict === 'passed') status = 'success';

      resultados.push({
        'Pontuação': scoreGeral,
        'Tipo de erro': status === 'error' ? 'Erro' : status === 'warning' ? 'Aviso' : status === 'success' ? 'Sucesso' : 'Para ver manualmente',
        'Criterio': tituloTraduzido,
        'Descricao': resultado.description || '',
        'Numero de ocorrencias': Array.isArray(resultado.elements) ? resultado.elements.length : 1,
        'Nivel de Conformidade': resultado.level || resultado.conformanceLevel || 'A',
        'Elementos': {
          'elementosHtml': Array.isArray(resultado.elements) ? resultado.elements : []
        }
      });
    });
  }

  return resultados;
}
