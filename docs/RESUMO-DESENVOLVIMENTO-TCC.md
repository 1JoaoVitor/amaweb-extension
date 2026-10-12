# Resumo de Desenvolvimento: Extensão AMAWeb

## 1. Visão Geral da Arquitetura

A extensão foi desenvolvida sobre a arquitetura Manifest V3 do Chrome e organiza suas responsabilidades em contextos especializados.

### Painel lateral

O Side Panel concentra a interface de avaliação. O `popup.js` coordena eventos, comunicação com o service worker, cache e estados da interface. O `sidepanel/findings-renderer.js` transforma os resultados normalizados em cartões, filtros, contadores, navegação entre ocorrências e estados de visibilidade.

### Service worker e comunicação

O service worker abre o Side Panel e encaminha as mensagens entre a interface, a aba ativa e a API AMAWeb. O módulo `background/message-router.js` centraliza esse fluxo, enquanto `background/api-client.js` realiza a requisição HTTP com timeout controlado.

### Gestão de estado

O `core/cache-store.js` mantém os resultados associados ao ID da aba. O estado é mantido em memória para acesso rápido e persistido em `chrome.storage.session` para permitir a restauração durante a sessão do navegador.

O cache é invalidado quando a aba recarrega, muda de URL ou é fechada. Antes de aplicar um resultado, a extensão confirma que a URL da aba continua sendo a mesma usada no início da avaliação.

### Content scripts

A página avaliada recebe três responsabilidades separadas:

- `content/dom-capture.js`: clona o DOM, remove elementos desnecessários e sanitiza valores sensíveis antes do envio;
- `content/overlay-manager.js`: desenha bordas, badges, tooltips e destaques sobre os elementos avaliados;
- `content/focus-order-manager.js`: fornece o modo independente de inspeção da ordem de foco.

Essa separação evita que a lógica de captura, visualização e navegação por teclado fique misturada.

## 2. Principais Funcionalidades Implementadas

- Avaliação do HTML renderizado pela API oficial do AMAWeb.
- Tradução e normalização dos resultados para português.
- Classificação por sucesso, aviso e erro.
- Classificação por níveis WCAG A, AA e AAA.
- Filtros por tipo, nível e visibilidade.
- Ordenação por número de ocorrências.
- Destaque visual de elementos na página avaliada.
- Scroll automático, foco e navegação entre múltiplas ocorrências.
- Identificação de elementos ocultos ou removidos do DOM.
- Cache por aba com persistência de sessão.
- Exportação de relatórios JSON.
- Aviso de privacidade antes do envio do HTML.
- Sanitização obrigatória e seletiva de dados de formulário.
- Modo independente de Ordem de Foco, com marcadores numerados e lista de atalhos no painel.
- Testes automatizados para os módulos principais.

## 3. Desafios Técnicos e Soluções

### Desafio A: Sincronização de estado e condições de corrida

#### Problema

A extensão possui dois contextos visuais que precisam permanecer sincronizados: o painel lateral e a página avaliada. Ao trocar de aba ou navegar por uma aplicação SPA, o painel pode ser reconstruído enquanto os overlays continuam ativos na página anterior.

Tentativas de redesenhar os overlays sempre que o painel era restaurado causavam intermitências visuais, perda de destaque e possíveis condições de corrida entre mensagens.

#### Solução

Foi adotado um modelo de restauração baseado no `tabId` e na URL armazenada no cache:

1. o resultado é salvo associado à aba avaliada;
2. ao trocar de aba, o painel consulta o cache correspondente;
3. se a URL ainda for a mesma, os cartões são reconstruídos sem reenviar o comando de renderização dos overlays;
4. se houver recarga ou mudança de URL, o cache é invalidado e os resultados antigos são descartados;
5. antes de aplicar uma resposta remota, a extensão confirma novamente a URL atual da aba.

Essa abordagem mantém a interface sincronizada sem destruir e recriar desnecessariamente o estado visual da página.

### Desafio B: Elementos ocultos e experiência do usuário

#### Problema

Muitos problemas de acessibilidade estão em elementos presentes no DOM, mas invisíveis na tela, como skip links, menus recolhidos, controles modais ou itens deslocados para fora da área visível.

Tentar destacar esses elementos sem verificar sua visibilidade produzia uma experiência confusa: o usuário clicava em “Destacar”, mas não via nenhum elemento na página.

#### Solução

Foi criada uma pré-verificação assíncrona usando a mensagem `FILTER_V2`. O content script avalia o elemento com:

- `getBoundingClientRect()`;
- `display`;
- `visibility`;
- `opacity`;
- posição fora da área útil;
- conexão atual com o DOM.

A interface então apresenta estados diferentes:

- todos os elementos visíveis: o destaque é liberado;
- todos os elementos ocultos: o botão é bloqueado com “Oculto no DOM”;
- situação mista: o cartão informa a quantidade de itens ocultos.

Essa solução antecipa um estado de erro e o transforma em informação útil para o auditor.

### Desafio C: Limpeza de artefatos injetados e contaminação da captura

#### Problema

Os overlays utilizam camadas absolutas, tooltips, badges e `z-index` elevados. Em alguns fluxos, elementos antigos permaneciam na página depois que o destaque era removido.

Durante a investigação da sanitização, foi descoberto um problema adicional: uma nova avaliação podia capturar os próprios elementos da extensão. Isso produzia resultados falsos, como sucessos extras de contraste e IDs.

Em uma comparação, um relatório apresentou 38 resultados e outro 90. Os cinco erros e seis avisos eram iguais, mas o segundo relatório continha 52 sucessos adicionais. A análise dos JSONs encontrou `div.amaweb-badge`, textos de tooltip e elementos internos dos cards.

#### Solução

A limpeza dos overlays foi reforçada para remover classes ativas, rebaixar camadas e destruir wrappers antigos.

Além disso, antes de enviar o HTML, `dom-capture.js` remove do clone qualquer elemento associado à extensão, incluindo IDs e classes iniciados por `amaweb-`.

Após a correção, os relatórios comparativos passaram a apresentar:

- mesma quantidade de resultados;
- mesmas regras;
- mesmas ocorrências;
- nenhum elemento `amaweb-*` capturado.

Esse caso foi importante porque mostrou que uma diferença no resultado não era causada pela sanitização, mas pela própria ferramenta sendo avaliada.

### Desafio D: Responsividade restrita do Side Panel

#### Problema

O Side Panel do Chrome possui largura limitada. Textos longos, contadores, botões e controles de navegação disputavam espaço no rodapé dos cartões. Isso causava quebras indesejadas, sobreposição e perda de legibilidade.

#### Solução

A estrutura dos cartões foi dividida em blocos com responsabilidades claras:

- contador e descrição da ocorrência;
- navegação entre elementos;
- ações do cartão;
- detalhes expansíveis.

O CSS passou a controlar o comportamento responsivo com Flexbox e propriedades como:

- `flex-shrink: 0` para controles que não podem ser esmagados;
- `white-space: nowrap` para contadores e navegação;
- `overflow: hidden` e `text-overflow: ellipsis` para textos longos;
- largura estável para botões e marcadores.

A solução mantém a hierarquia visual mesmo em painéis estreitos.

## 4. Investigação da Sanitização

A sanitização foi inicialmente criada como opção de teste para remover dados potencialmente sensíveis antes do envio do HTML. Foram criadas páginas locais com formulários, ARIA, `contenteditable`, problemas conhecidos e estrutura limpa.

Os testes revelaram dois pontos importantes:

1. limpar `contenteditable` alterava contagens de resultados de contraste;
2. limpar `textarea` também removia verificações positivas de conteúdo e contraste.

Por isso, a política final ficou seletiva:

- valores de `input` são removidos;
- estado selecionado de `select` é removido;
- `textarea` é preservado;
- `contenteditable` é preservado;
- elementos da própria extensão são removidos do clone.

Depois dos ajustes, seis pares de relatórios foram comparados. ARIA, contenteditable, formulário, índice, página limpa e problemas conhecidos mantiveram scores, regras e ocorrências equivalentes nos modos comparados.

A sanitização passou a ser obrigatória no fluxo de produção. O controle temporário usado durante a pesquisa foi removido para evitar que usuários desativem essa proteção por engano.

## 5. Modo de Ordem de Foco

Como extensão do trabalho de auditoria visual, foi criado um modo independente de inspeção da navegação por teclado.

O modo:

- identifica elementos focáveis visíveis;
- ordena elementos com `tabIndex` positivo antes da ordem normal do DOM;
- cria marcadores numerados na página;
- exibe uma lista de atalhos no painel;
- permite selecionar diretamente o elemento 1, 2, 3 ou qualquer outro número;
- aplica foco e rolagem até o elemento selecionado.

A funcionalidade foi mantida em uma aba própria para não se misturar com os overlays dos resultados do AMAWeb. O botão “Limpar Tela” limpa apenas os overlays da avaliação, enquanto a Ordem de Foco possui seu próprio controle.

A versão atual é um protótipo. Shadow DOM, iframes cross-origin, widgets com roving tabindex e armadilhas de foco permanecem fora do escopo.

## 6. Processo de Validação

A validação combinou três estratégias:

### Testes automatizados

A suíte `node:test` cobre:

- validação do schema da API;
- códigos de erro;
- adaptação e pluralização;
- cache;
- exportação JSON;
- sanitização do DOM;
- remoção de overlays.

Resultado final: 9 testes aprovados.

### Testes com fixtures locais

As páginas em `docs/test-pages/` permitiram repetir as avaliações com o mesmo DOM e comparar relatórios JSON.

### Inspeção dos relatórios

Os relatórios foram comparados por:

- score;
- tipo de resultado;
- nome da regra;
- número de ocorrências;
- HTML dos elementos encontrados;
- presença indevida de elementos `amaweb-*`.

Esse processo permitiu separar efeitos reais da sanitização de efeitos causados por artefatos da própria extensão.

## 7. Sugestão de Organização para o TCC

A apresentação pode seguir esta sequência:

1. problema da auditoria tradicional e motivação da extensão;
2. arquitetura Manifest V3 e comunicação entre contextos;
3. fluxo de avaliação e normalização dos resultados;
4. Desafio A: sincronização de estado e condições de corrida;
5. Desafio B: elementos ocultos e experiência do usuário;
6. Desafio C: limpeza de overlays e descoberta da contaminação;
7. Desafio D: responsividade do Side Panel;
8. investigação da sanitização e comparação dos JSONs;
9. modo de Ordem de Foco;
10. testes automatizados, limitações e próximos passos.

Os Desafios A e B merecem destaque porque demonstram, respectivamente, domínio do ciclo de vida de aplicações orientadas a eventos e preocupação com usabilidade e interação humano-computador.
