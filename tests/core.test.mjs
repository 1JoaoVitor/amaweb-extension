import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

import { adaptarJsonAmaWeb } from '../extension/core/amaweb-adapter.js';
import { CacheStore } from '../extension/core/cache-store.js';
import { exportarRelatorio, generateJsonReport } from '../extension/core/export-report.js';
import { validateEvaluationResponse } from '../extension/core/validators.js';

const translations = {
  ELEMS: { imgAltNo: 'Imagens sem texto alternativo' },
  TESTS_RESULTS: {
    img_01b: {
      s: 'Encontrei {{value}} imagem sem texto alternativo.',
      p: 'Encontrei {{value}} imagens sem texto alternativo.'
    }
  }
};

function validApiResponse(overrides = {}) {
  return {
    success: 1,
    result: {
      data: {
        nodes: {
          imgAltNo: [{
            verdict: 'failed',
            elements: [{ pointer: 'img:nth-child(1)', htmlCode: '<img>' }, { pointer: 'img:nth-child(2)', htmlCode: '<img>' }]
          }]
        },
        score: '85',
        ...overrides
      }
    }
  };
}

test('valida uma resposta completa da API', () => {
  const result = validateEvaluationResponse(validApiResponse());

  assert.equal(result.valid, true);
  assert.equal(result.data.score, '85');
  assert.ok(result.data.nodes.imgAltNo);
});

test('rejeita resposta sem score válido', () => {
  const result = validateEvaluationResponse(validApiResponse({ score: 'not-a-score' }));

  assert.equal(result.valid, false);
  assert.match(result.error, /pontuação inválida/i);
});

test('preserva código de erro retornado pela API', () => {
  const result = validateEvaluationResponse({ success: 0, message: 'RATE_LIMIT_EXCEEDED' });

  assert.equal(result.valid, false);
  assert.equal(result.code, 'RATE_LIMIT_EXCEEDED');
});

test('adapta resultados e aplica pluralização', () => {
  const [item] = adaptarJsonAmaWeb(validApiResponse().result.data.nodes, '85', translations);

  assert.equal(item['Tipo de erro'], 'Erro');
  assert.equal(item['Numero de ocorrencias'], 2);
  assert.equal(item.Descricao, 'Encontrei 2 imagens sem texto alternativo.');
  assert.equal(item['Nivel de Conformidade'], 'A');
});

test('gera JSON formatado e válido', () => {
  const json = generateJsonReport([{ Criterio: '1.1.1', Valor: 1 }]);

  assert.deepEqual(JSON.parse(json), [{ Criterio: '1.1.1', Valor: 1 }]);
  assert.match(json, /\n  /);
});

test('retorna lista vazia para dados de exportação inválidos', () => {
  assert.equal(generateJsonReport(null), '[]');
});

test('exporta relatório sem lançar erro para dados válidos', () => {
  const documentOriginal = globalThis.document;
  globalThis.document = {
    body: {
      appendChild() {},
      removeChild() {}
    },
    createElement() {
      return { style: {}, click() {} };
    }
  };

  try {
    assert.doesNotThrow(() => exportarRelatorio([{ Regra: 'img_01b' }], 'teste'));
  } finally {
    globalThis.document = documentOriginal;
  }
});

test('mantém dados no cache em memória e sessão', async () => {
  const storage = {};
  globalThis.chrome = {
    storage: {
      session: {
        async get() { return { 'amaweb-cache-v1': storage.value || {} }; },
        async set(value) { storage.value = value['amaweb-cache-v1']; }
      }
    }
  };

  const cache = new CacheStore();
  await cache.set(7, { url: 'https://example.com', dados: [], scoreGeral: '100' });

  assert.equal(cache.get(7).url, 'https://example.com');
  assert.equal(storage.value['7'].scoreGeral, '100');
});

test('sanitiza campos sensíveis sem remover conteúdo textual ou overlays', () => {
  const source = readFileSync(new URL('../extension/content/dom-capture.js', import.meta.url), 'utf8');

  function executarCaptura(sanitizar) {
    const input = { value: 'segredo', removeAttribute() { this.value = ''; } };
    const option = { removeAttribute() { this.selected = false; } };
    const select = { selectedIndex: 0, querySelectorAll() { return [option]; } };
    const textarea = { textContent: 'mensagem preservada' };
    const overlay = { removido: false, remove() { this.removido = true; } };
    const clone = {
      querySelectorAll(selector) {
        if (selector.includes('[id^="amaweb-"]')) return [overlay];
        if (selector === 'input') return [input];
        if (selector === 'select') return [select];
        return [];
      },
      get outerHTML() {
        return JSON.stringify({
          input: input.value,
          textarea: textarea.textContent,
          selectedIndex: select.selectedIndex,
          overlay: overlay.removido
        });
      }
    };
    const context = {
      document: { documentElement: { cloneNode: () => clone } },
      chrome: { runtime: { onMessage: { addListener() {} } } },
      console: { log() {}, error() {} }
    };

    vm.runInNewContext(source, context);
    return JSON.parse(context.AmawebDomCapture.capturar(sanitizar).html);
  }

  assert.deepEqual(executarCaptura(true), {
    input: '',
    textarea: 'mensagem preservada',
    selectedIndex: -1,
    overlay: true
  });
  assert.deepEqual(executarCaptura(false), {
    input: 'segredo',
    textarea: 'mensagem preservada',
    selectedIndex: 0,
    overlay: true
  });
});
