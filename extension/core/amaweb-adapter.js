import testsCatalog from './tests-catalog.js';

const STATUS_POR_VERDICT = {
  failed: 'failed',
  warning: 'warning',
  passed: 'passed'
};

function limparMarcacao(texto = '') {
  return String(texto).replace(/<[^>]*>/g, '');
}

function localizarRegra(nomeDaRegra, verdict) {
  const esperado = STATUS_POR_VERDICT[verdict] || verdict;
  const candidatas = Object.entries(testsCatalog).filter(([, regra]) =>
    regra.test === nomeDaRegra && regra.result === esperado
  );
  return candidatas[0] || null;
}

function traduzirResultado(chave, ocorrencias, dicionarioAMA) {
  const mensagens = dicionarioAMA?.TESTS_RESULTS?.[chave];
  if (!mensagens) return '';
  const plural = Number(ocorrencias) === 1 ? mensagens.s : mensagens.p;
  return limparMarcacao(plural || mensagens.s || mensagens.p || '')
    .replace(/\{\{value\}\}/g, String(ocorrencias));
}

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

      const regraOficial = localizarRegra(nomeDaRegra, resultado.verdict);
      const chaveResultado = regraOficial?.[0];
      const elementos = Array.isArray(resultado.elements) ? resultado.elements : [];
      const ocorrencias = elementos.length || 1;
      const descricaoTraduzida = chaveResultado
        ? traduzirResultado(chaveResultado, ocorrencias, dicionarioAMA)
        : '';

      let descricaoLimpa = descricaoTraduzida|| "";

      // Remove textos dinâmicos em inglês comuns injetados pelo motor
      // descricaoLimpa = descricaoLimpa.replace(/This link skips a content block.*/gi, '');
      // descricaoLimpa = descricaoLimpa.replace(/Encontrei \d+ imag.*/gi, ''); 

      let tipoDeErroFormatado = "Para ver manualmente"; 
            if (resultado.verdict === "failed") tipoDeErroFormatado = "Erro";
            else if (resultado.verdict === "warning") tipoDeErroFormatado = "Aviso";
            else if (resultado.verdict === "passed") tipoDeErroFormatado = "Sucesso";

      resultados.push({
        'Pontuação': scoreGeral,
        'Tipo de erro': tipoDeErroFormatado,
        'Criterio': limparMarcacao(dicionarioAMA?.ELEMS?.[regraOficial?.[1]?.test || nomeDaRegra] || tituloTraduzido),
        'Descricao': descricaoLimpa.trim(),
        'Numero de ocorrencias': ocorrencias,
        'Valor': ocorrencias,
        'Regra': chaveResultado || nomeDaRegra,
        'Referencia': regraOficial?.[1]?.ref || '',
        'CriteriosRelacionados': regraOficial?.[1]?.scs || '',
        'Nivel de Conformidade': regraOficial?.[1]?.level?.toUpperCase() || resultado.level || resultado.conformanceLevel || 'A',
        'Elementos': {
          'elementosHtml': elementos
        }
      });
    });
  }

  return resultados;
}
