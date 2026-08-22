# Plano técnico do Avaliador AMAWeb

Este documento registra a arquitetura desejada, as correções prioritárias e o roadmap da extensão. A implementação será incremental: primeiro estabilizamos o código existente; depois adicionamos funcionalidades apoiadas por testes.

## Estado atual

O protótipo usa Manifest V3 e possui três contextos principais:

* `background.js`: abre o Side Panel, captura a página por mensagem e chama a API.
* `content.js`: sanitiza o DOM e desenha overlays na página avaliada.
* `popup.js` e `popup.html`: controlam a interface, calculam contadores e exportam o relatório.
* `core/cache-store.js`: mantém cache rápido em memória e persiste os resultados na sessão do navegador.
* `core/amaweb-adapter.js`: converte a resposta do backend para o modelo usado pela interface.
* `sidepanel/findings-renderer.js`: cria os cards de erros e gerencia o destaque dos elementos.

O principal ponto de manutenção é o excesso de responsabilidades em `popup.js` e a mistura de CSS do Side Panel, CSS dos overlays, estilos inline e estilos aplicados por JavaScript.

## Arquitetura alvo

```text
extension/
  background/
    service-worker.js
    api-client.js
    message-router.js
  content/
    content.js
    dom-capture.js
    overlay-manager.js
    overlay.css
  sidepanel/
    index.html
    sidepanel.js
    popup.css
    ui/
      tabs.js
      summary-renderer.js
      findings-renderer.js
  core/
    amaweb-adapter.js
    errors.js
    validators.js
    cache-store.js
    export-report.js
    message-types.js
  data/
    translations.json
    rules.json
```

A migração pode começar sem framework e sem build. A adoção de TypeScript ou Vite só deve ocorrer quando o número de módulos e testes justificar a complexidade adicional.

## Regras de organização

1. O Side Panel deve renderizar a partir de dados, nunca armazenar HTML pronto no cache.
2. Dados vindos da API devem ser inseridos com `textContent` ou APIs DOM seguras, nunca por interpolação em `innerHTML`.
3. `popup.css` deve conter apenas a interface da extensão; `overlay.css` deve conter apenas os elementos injetados na página.
4. O content script não deve alterar estilos do site avaliado sem guardar e restaurar o valor original.
5. Mensagens entre contextos devem usar nomes constantes e payloads validados.
6. A URL da API, timeout e ambiente devem ser configuração, não valores espalhados pelo código.

## Correções prioritárias

### P0: correção e segurança

* Corrigir o uso de `topAbsoluto` antes da declaração no destaque específico.
* Remover interpolação de descrição, critério e contadores em `innerHTML`.
* Validar a estrutura da resposta do backend e tratar respostas incompletas.
* Adicionar timeout e mensagens consistentes para falhas de rede, HTTP 413, 405 e indisponibilidade.
* Evitar `catch` vazio e validar URL, seletor CSS e existência de elementos.
* Remover a mutação permanente de `document.body.style.position`.

### P1: estrutura e manutenção

* Extrair o adaptador da API, o cliente HTTP, o cache e os renderizadores para módulos.
* Substituir o cache de `htmlDetalhes` por um cache de dados normalizados.
* Usar `Map` ou `chrome.storage.session`, com invalidação em recarga, mudança de URL e fechamento da aba.
* Extrair todo CSS inline para classes semânticas e centralizar cores em variáveis CSS.
* Separar o dicionário de traduções realmente usado pela extensão dos dados herdados do portal.
* Definir o nível A, AA ou AAA a partir da API ou de uma tabela de regras, sem assumir sempre A.

## Modelo interno de resultado

Cada resultado adaptado deve seguir um formato estável:

```js
{
  id: "imgAltNo",
  title: "Imagens sem texto alternativo",
  description: "...",
  status: "error",
  level: "A",
  occurrenceCount: 3,
  pointers: ["main img:nth-of-type(2)"]
}
```

Esse modelo desacopla o backend da interface e facilita filtros, testes, exportação e troca do fornecedor da API.

## Testes

### Testes unitários

* Sanitização do DOM e remoção de Base64.
* Adaptação da resposta AMAWeb.
* Contagem por status e nível de conformidade.
* Tradução e classificação de erros HTTP.
* Validação do contrato da API.
* Geração do relatório exportado.

### Testes de integração

* Avaliação de uma página simples.
* Renderização e limpeza dos overlays.
* Destaque de uma regra com múltiplos elementos.
* Troca de abas e invalidação do cache.
* Recarregamento e navegação de SPA.

## Próximas funcionalidades

### Curto prazo

* Filtros por erro, aviso, sucesso e nível A/AA/AAA.
* Ordenação por regra ou quantidade de ocorrências.
* Navegação entre ocorrências com “anterior” e “próximo”.
* Painel de detalhes contendo seletor, HTML, atributos e sugestão de correção.
* Reavaliação manual após alterações no DOM.

### Médio prazo

* Exportação em HTML, CSV e relatório para impressão.
* Página de opções para servidor oficial, servidor local, idioma e timeout.
* Histórico local de avaliações com pontuação e data.
* Suporte a Shadow DOM aberto e documentação das limitações de iframes e Shadow DOM fechado.
* Melhorias de teclado, foco, contraste e anúncios de carregamento para leitores de tela.

### Longo prazo

* Comparação entre avaliações e histórico de regressões.
* Integração com CI/CD e formatos como SARIF.
* Sugestões de correção baseadas na regra e no elemento encontrado.
* Instrumentação opcional de desempenho e tamanho do payload.

## Ordem de execução

1. Corrigir destaque, segurança de renderização e tratamento de erros.
2. Separar CSS do Side Panel e dos overlays.
3. Extrair módulos de adaptação, estado, comunicação e renderização.
4. Criar testes para sanitização, adaptação e contadores.
5. Implementar filtros, detalhes de elementos e exportações adicionais.
6. Avaliar persistência, histórico e integração com CI/CD.
