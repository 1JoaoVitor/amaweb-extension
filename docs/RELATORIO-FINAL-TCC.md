# Relatório Final de Desenvolvimento do TCC

## Extensão AMAWeb: Avaliação Visual de Acessibilidade

## 1. Objetivo do Projeto

A extensão AMAWeb aproxima a avaliação de acessibilidade do contexto real de navegação do usuário. Em vez de exigir que uma URL seja copiada para um portal externo, a extensão captura o DOM renderizado da aba atual, envia o conteúdo ao motor AMAWeb e apresenta os resultados no Side Panel.

A solução foi pensada para páginas públicas, páginas autenticadas, ambientes locais e sistemas em desenvolvimento, sempre considerando que o HTML capturado pode conter dados sensíveis.

## 2. Arquitetura Atual

A extensão utiliza Manifest V3 e é dividida em contextos:

- **Side Panel:** `popup.html`, `popup.js` e `sidepanel/findings-renderer.js` exibem resultados, filtros, estatísticas, exportação, ordem de foco e estados da interface.
- **Service worker:** `background/service-worker.js`, `message-router.js` e `api-client.js` coordenam mensagens e comunicação com a API AMAWeb.
- **Content scripts:** `dom-capture.js` captura o DOM, `overlay-manager.js` desenha os destaques e `focus-order-manager.js` inspeciona a ordem de foco.
- **Core:** `amaweb-adapter.js` normaliza e traduz os resultados, `validators.js` valida respostas, `cache-store.js` persiste avaliações e `export-report.js` gera relatórios JSON.
- **Testes:** `tests/core.test.mjs` utiliza `node:test` para validar os módulos principais.

O estado de avaliação é associado ao `tabId`, mantido em memória e persistido em `chrome.storage.session`. A URL também é armazenada para evitar que uma avaliação antiga seja aplicada depois de uma navegação.

## 3. Funcionalidades Entregues

- Avaliação do HTML renderizado pela API oficial do AMAWeb.
- Tradução e normalização dos resultados.
- Classificação por sucesso, aviso e erro.
- Níveis WCAG A, AA e AAA.
- Filtros por tipo, nível e visibilidade.
- Ordenação por ocorrências.
- Destaque visual dos elementos avaliados.
- Scroll, foco e navegação entre ocorrências.
- Identificação de elementos ocultos ou removidos do DOM.
- Cache por aba com invalidação em recarga, navegação e fechamento.
- Exportação JSON.
- Aviso de privacidade persistente antes do envio do HTML.
- Sanitização obrigatória e seletiva de dados de formulário.
- Modo independente de Ordem de Foco com marcadores e lista numerada.
- Testes automatizados dos módulos principais.

## 4. Problemas Encontrados e Correções

### 4.1. XSS em tooltips

**Problema:** dados derivados da API eram inseridos em tooltip com HTML interpolado. Um conteúdo malicioso poderia ser interpretado como marcação.

**Correção:** a criação dos elementos foi feita com APIs DOM e `textContent`, evitando que dados externos fossem executados como HTML.

### 4.2. Promises de mensagens sem tratamento

**Problema:** chamadas a `chrome.tabs.sendMessage()` podiam rejeitar quando a aba era fechada, recarregada ou não possuía content script.

**Correção:** os fluxos passaram a tratar falhas com contexto. Indisponibilidades esperadas são registradas em `console.debug`; falhas inesperadas são registradas em `console.warn`.

### 4.3. Respostas de API sem validação centralizada

**Problema:** o fluxo dependia diretamente de campos como `result.data.nodes` e `score`, sem um contrato centralizado.

**Correção:** `validators.js` verifica estrutura, tipos, pontuação e códigos de erro antes da adaptação dos dados.

### 4.4. Timeout excessivo

**Problema:** o timeout estava configurado em aproximadamente 50 minutos (`3.000.000 ms`), podendo deixar a interface presa por tempo excessivo.

**Correção:** o limite foi ajustado para 300 segundos.

### 4.5. Resultado aplicado depois da mudança de página

**Problema:** uma avaliação remota poderia terminar depois de a aba navegar para outra URL. O resultado antigo poderia ser desenhado na página errada.

**Correção:** antes de renderizar e salvar o resultado, a extensão consulta novamente a aba e confirma que a URL continua igual.

### 4.6. Falhas na restauração de abas

**Problema:** o listener de troca de aba podia rejeitar quando a aba era fechada durante `chrome.tabs.get()`.

**Correção:** o listener passou a usar `try/catch` e restaura o painel para um estado seguro.

### 4.7. Mistura de responsabilidades no CSS

**Problema:** estilos do Side Panel e dos overlays estavam misturados, dificultando manutenção e aumentando o risco de conflito com a página avaliada.

**Correção:** os estilos foram separados em `sidepanel.css` e `overlay.css`. O antigo `popup.css`, que não era utilizado, foi removido.

### 4.8. Exportação acoplada ao painel

**Problema:** geração de JSON, Blob, link temporário e download estavam dentro de `popup.js`.

**Correção:** a lógica foi extraída para `core/export-report.js`, com funções próprias para gerar, baixar e exportar relatórios.

### 4.9. Documentação e contratos ausentes

**Problema:** os módulos principais não documentavam claramente entradas, saídas e responsabilidades.

**Correção:** foram adicionados JSDoc aos módulos centrais e criados documentos específicos para arquitetura, investigação e desenvolvimento.

## 5. Desafios Técnicos do Desenvolvimento

### Desafio A: Sincronização de estado e condições de corrida

A troca de abas pode reconstruir o contexto do painel enquanto os overlays continuam na página avaliada. Redesenhar tudo automaticamente causava piscadas, perda de estado e condições de corrida.

A solução foi restaurar o painel pelo `tabId` e pela URL armazenada no cache. Quando a URL continua igual, o painel reconstrói os cartões sem redesenhar os overlays. Quando há navegação, o cache e o estado antigo são invalidados.

Esse desafio demonstra o uso de persistência de estado em uma aplicação orientada a eventos.

### Desafio B: Elementos ocultos e experiência do usuário

Elementos como skip links e menus recolhidos podem existir no DOM, mas não estar visíveis. Destacá-los sem pré-verificação gerava confusão.

A mensagem `FILTER_V2` consulta visibilidade, `getBoundingClientRect()`, estilo computado, opacidade e conexão com o DOM. A interface diferencia elementos visíveis, ocultos e situações mistas.

Esse desafio demonstra preocupação com HCI e antecipação de estados de erro.

### Desafio C: Artefatos injetados e contaminação da própria avaliação

Os overlays utilizam camadas absolutas, tooltips e `z-index` elevado. Além de resíduos visuais, descobriu-se que uma segunda avaliação podia capturar elementos da própria extensão.

Em um teste de `problemas.html`, os relatórios apresentaram inicialmente:

| Relatório | Total | Sucessos | Avisos | Erros |
|---|---:|---:|---:|---:|
| Primeiro | 38 | 27 | 6 | 5 |
| Segundo | 90 | 79 | 6 | 5 |

Os erros e avisos eram iguais. A diferença de 52 sucessos veio de elementos como `div.amaweb-badge`, textos de tooltip e elementos internos dos cards.

O capturador passou a remover todos os elementos com IDs ou classes iniciados por `amaweb-` antes do envio. Após a correção, os relatórios ficaram com as mesmas regras, ocorrências e quantidade de resultados, sem elementos `amaweb-*`.

### Desafio D: Responsividade restrita do Side Panel

A largura limitada do Side Panel provocava quebras de texto, sobreposição de botões e perda de legibilidade nos cartões.

A solução separou contadores, navegação, detalhes e ações em wrappers próprios. O Flexbox utiliza `flex-shrink`, `white-space`, `overflow` e `text-overflow` para manter a estrutura estável.

## 6. Investigação da Sanitização

### 6.1. Objetivo

A sanitização foi criada para reduzir a exposição de dados sensíveis de formulários sem modificar os resultados de acessibilidade.

Durante a investigação, o painel permitia alternar a sanitização. Depois que os testes terminaram, o toggle foi removido e a proteção passou a ser obrigatória no fluxo normal.

### 6.2. Fixtures utilizadas

Foram criadas páginas locais em `docs/test-pages/`:

- `aria.html`;
- `contenteditable.html`;
- `formulario.html`;
- `index.html`;
- `limpa.html`;
- `problemas.html`.

### 6.3. Falso efeito causado pelos overlays

A primeira diferença grande não era causada pela sanitização. Ela vinha da captura dos próprios overlays da extensão. A remoção dos elementos `amaweb-*` tornou as comparações confiáveis.

### 6.4. Teste de contenteditable

Na primeira versão, o texto de `contenteditable` era removido. Os erros e o score permaneceram iguais, mas quatro sucessos de contraste desapareceram.

Conclusão: conteúdo editável participa da avaliação e deve ser preservado.

### 6.5. Teste de textarea

A limpeza de `textarea` também removeu sucessos de contraste, embora o score e os erros permanecessem iguais.

Conclusão: `textarea` também deve ser preservado.

### 6.6. Política final

A versão final:

- remove valores de `input`;
- remove a seleção atual de `select`;
- preserva `textarea`;
- preserva `contenteditable`;
- remove artefatos da própria extensão;
- mantém a sanitização obrigatória no fluxo de produção.

Seis pares de relatórios foram comparados após as correções: ARIA, contenteditable, formulário, índice, página limpa e problemas conhecidos. Todos mantiveram scores, regras e ocorrências equivalentes.

## 7. Ordem de Foco

Foi criado um modo independente para inspeção da ordem de navegação por teclado.

O modo identifica elementos focáveis visíveis, ordena `tabIndex` positivo antes da ordem normal do DOM, desenha marcadores numerados e disponibiliza uma lista de atalhos no painel. O usuário pode clicar no número 33, por exemplo, para focar diretamente o trigésimo terceiro elemento.

A funcionalidade foi colocada em uma aba própria e não depende da avaliação da API nem do botão “Limpar Tela”.

A versão atual é um protótipo. Shadow DOM, iframes cross-origin, roving tabindex e armadilhas de foco permanecem fora do escopo.

## 8. Testes Automatizados

A suíte `node:test` possui 9 testes aprovados e cobre:

- validação da resposta da API;
- códigos de erro;
- adaptação e pluralização;
- cache;
- exportação JSON;
- sanitização de campos;
- preservação de conteúdo textual;
- remoção de overlays do clone DOM.

Execução:

```bash
npm test
```

Além dos testes automatizados, foram comparados relatórios JSON produzidos pelas fixtures locais, verificando score, regras, ocorrências e presença de elementos da extensão.

## 9. Limitações Conhecidas

- Shadow Roots fechados não podem ser inspecionados livremente.
- Shadow DOM não é percorrido completamente.
- Iframes cross-origin são protegidos pela política de mesma origem.
- Páginas `chrome://`, `edge://`, lojas e páginas de extensões são bloqueadas pelo navegador.
- A avaliação representa o DOM no momento da captura.
- Conteúdo carregado ou alterado depois da captura exige nova avaliação.
- A Ordem de Foco ainda não reproduz todos os comportamentos avançados do navegador e da WAVE.

## 10. Sequência Recomendada para a Apresentação

1. Apresentar o problema da auditoria tradicional.
2. Explicar a arquitetura Manifest V3.
3. Demonstrar o fluxo de captura, API e renderização.
4. Apresentar o Desafio A: sincronização e cache.
5. Apresentar o Desafio B: elementos ocultos e UX.
6. Apresentar o Desafio C: overlays contaminando a própria avaliação.
7. Apresentar o Desafio D: responsividade do Side Panel.
8. Mostrar a investigação da sanitização e os relatórios JSON.
9. Demonstrar a Ordem de Foco.
10. Encerrar com testes, limitações e próximos passos.

Os Desafios A e B merecem destaque porque demonstram domínio do ciclo de vida de aplicações orientadas a eventos e preocupação com interação humano-computador.
