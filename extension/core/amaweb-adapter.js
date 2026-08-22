import testsCatalog from './tests-catalog.js';

const STATUS_POR_VERDICT = {
  failed: 'failed',
  warning: 'warning',
  passed: 'passed'
};

function descobrirNivelWCAG(scs) {
  if (!scs) return 'A'; 
  const crit = String(scs);

  if (crit.match(/1\.2\.6|1\.2\.7|1\.2\.8|1\.2\.9|1\.3\.6|1\.4\.6|1\.4\.7|1\.4\.8|1\.4\.9|2\.1\.3|2\.2\.3|2\.2\.4|2\.2\.5|2\.2\.6|2\.3\.2|2\.3\.3|2\.4\.8|2\.4\.9|2\.4\.10|3\.1\.3|3\.1\.4|3\.1\.5|3\.1\.6|3\.2\.5|3\.3\.5|3\.3\.6/)) {
    return 'AAA';
  }

  if (crit.match(/1\.2\.4|1\.2\.5|1\.3\.4|1\.3\.5|1\.4\.3|1\.4\.4|1\.4\.5|1\.4\.10|1\.4\.11|1\.4\.12|1\.4\.13|2\.4\.5|2\.4\.6|2\.4\.7|3\.1\.2|3\.2\.3|3\.2\.4|3\.3\.3|3\.3\.4|4\.1\.3/)) {
    return 'AA';
  }

  return 'A';
}

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
        'Nivel de Conformidade': regraOficial?.[1]?.level?.toUpperCase() || 
                         resultado.level?.toUpperCase() || 
                         descobrirNivelWCAG(regraOficial?.[1]?.scs),
        'Elementos': {
          'elementosHtml': elementos
        }
      });
    });
  }

  return resultados;
}
