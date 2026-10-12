# Relatório de Revisão e Melhorias

## Objetivo

Este documento registra o estado atual da extensão AMAWeb, os problemas encontrados durante a revisão geral, as melhorias implementadas e os pontos que permanecem para etapas futuras.

## Estado Atual

A extensão é uma aplicação Chrome Manifest V3 composta por:

- Service worker para abrir o Side Panel e encaminhar avaliações.
- Content scripts para capturar o DOM e desenhar overlays.
- Cliente HTTP para enviar o HTML ao servidor AMAWeb.
- Adaptador para normalizar, traduzir e categorizar os resultados.
- Cache por aba usando memória e `chrome.storage.session`.
- Interface lateral com resumo, filtros, ordenação, detalhes e exportação JSON.

Os arquivos principais estão organizados em `background/`, `content/`, `core/` e `sidepanel/`.

## Melhorias Implementadas

### Segurança e robustez

- Corrigida a criação insegura de tooltip que utilizava HTML interpolado.
- Dados exibidos no painel passaram a usar `textContent` e APIs DOM.
- Promises de comunicação com content scripts passaram a ter tratamento de rejeição.
- URLs internas do navegador são bloqueadas antes da avaliação.
- Respostas da API passam por validação de estrutura, tipos e pontuação.
- O timeout da API foi ajustado para 300 segundos.
- O resultado é descartado quando a URL da aba muda durante a avaliação.
- O listener de troca de aba passou a tratar falhas ao consultar uma aba que foi fechada.
- Foi adicionado um aviso explícito antes da avaliação informando que o HTML será enviado ao servidor AMAWeb.
- O botão de avaliação permanece bloqueado até o usuário confirmar que entendeu o aviso.

### Arquitetura e manutenção

- CSS do Side Panel foi separado dos estilos dos overlays.
- O antigo `popup.css`, que não era carregado por nenhum arquivo ativo, foi removido.
- A lógica de exportação foi extraída para `core/export-report.js`.
- Foram adicionados JSDoc e exemplos aos módulos principais.
- O cache foi separado em uma classe própria e passou a usar persistência de sessão.
- A invalidação do cache ocorre em recarga, mudança de URL e fechamento da aba.
- O roteamento de mensagens foi separado do service worker.
- A validação da resposta da API foi centralizada em `core/validators.js`.

### Interface e funcionalidades

- Interface dividida entre Visão Geral e Lista de Erros.
- Contadores por tipo de resultado e nível WCAG.
- Filtros por tipo, nível e visibilidade.
- Ordenação por número de ocorrências.
- Navegação entre múltiplas ocorrências da mesma regra.
- Painel expansível com critérios, referência e seletores afetados.
- Destaque visual de elementos na página avaliada.
- Exportação de resultados em JSON.
- Mensagens amigáveis para erros de rede, HTTP, timeout e página restrita.

## Segurança do envio do HTML

### O que o AMAWeb oficial já faz

O fluxo oficial do AMAWeb já trabalha com avaliação baseada em conteúdo HTML ou URL, dependendo da modalidade utilizada. Portanto, o envio de uma página para um servidor de avaliação não foi criado pela extensão.

O risco geral já existente no serviço oficial é que o conteúdo enviado pode conter informações privadas, especialmente quando a página inclui dados de usuário, áreas autenticadas ou conteúdo interno.

### O que a extensão introduziu

A extensão adicionou uma forma local e conveniente de capturar o HTML da aba atual e enviá-lo ao endpoint de avaliação. Isso amplia a facilidade de uso para páginas que o portal não conseguiria acessar diretamente, como:

- páginas atrás de login;
- ambientes locais;
- intranets;
- páginas em desenvolvimento.

Essa capacidade não cria o conceito de envio de HTML, mas aumenta a probabilidade de o usuário enviar conteúdo privado sem perceber. A extensão também pode capturar conteúdo que não seria enviado pelo usuário ao portal manualmente.

### Mitigação aplicada

A interface agora mostra o aviso:

> O HTML da página atual será enviado ao servidor AMAWeb para análise. Evite avaliar páginas com informações sensíveis.

A avaliação só começa depois que o usuário marca a confirmação.

A fase simples de sanitização também foi implementada no capturador. Antes do envio, apenas o clone do DOM é alterado para:

- remover valores de `input`;
- preservar o conteúdo de `textarea`, pois ele pode participar da avaliação de conteúdo e contraste;
- remover opções selecionadas de `select`;
- preservar o texto de elementos `contenteditable`, pois ele faz parte do conteúdo acessível avaliado.

A página original não é modificada. Essa proteção ainda precisa ser comparada com respostas do AMAWeb em páginas de referência para confirmar que não prejudica regras de acessibilidade.

Para facilitar essa comparação, a interface possui o controle `Sanitizar dados sensíveis`. Ele fica ativado por padrão, pode ser desativado temporariamente para testes comparativos e sua preferência é persistida localmente. A opção é enviada pelo painel ao service worker e ao content script junto de cada avaliação. O conteúdo de elementos `contenteditable` é preservado para não alterar resultados de conteúdo e contraste.

### Próxima melhoria recomendada

Antes do envio, o capturador pode sanitizar dados sensíveis mantendo a estrutura necessária à avaliação. A ordem recomendada é:

1. Remover valores de `input`, `textarea` e `select`.
2. Remover conteúdo de elementos `contenteditable`.
3. Remover tokens, campos ocultos e atributos `data-*` quando não forem necessários.
4. Preservar estrutura semântica, `role`, `aria-*`, nomes de elementos e atributos necessários para regras de acessibilidade.
5. Documentar claramente a política de retenção e processamento do servidor AMAWeb.

Essa sanitização precisa ser validada contra o motor AMAWeb, pois remover texto ou atributos demais pode alterar o resultado da avaliação.

## Problemas Encontrados Durante a Revisão

### Resolvidos

- Timeout excessivamente alto, configurado em aproximadamente 50 minutos.
- Possibilidade de aplicar resposta antiga após mudança de URL.
- Falha não tratada ao restaurar uma aba fechada.
- Uso inseguro de HTML em tooltip.
- Validação de resposta da API espalhada no fluxo da interface.
- CSS misturado e arquivo `popup.css` sem uso.
- Exportação acoplada ao controlador do painel.
- Documentação de funções principais ausente.

### Ainda pendentes

- Não existem testes automatizados para adaptador, cache, validadores e exportação.
- Ainda há uso de `innerHTML` em um contêiner temporário para analisar HTML salvo nos resultados.
- Ainda há `innerHTML` para ícones SVG estáticos no painel.
- Alguns erros de comunicação são ignorados com `.catch(() => {})`, sem diferenciação entre causas.
- A sanitização implementada é inicial e ainda não cobre todos os dados pessoais possíveis.
- A URL da API e outras configurações ainda estão definidas diretamente no código.
- O suporte a Shadow DOM e iframes permanece limitado.
- O formato de exportação disponível ainda é apenas JSON.
- O arquivo ZIP precisa ser recriado depois que a versão final for concluída.

## Validações Executadas

- Sintaxe JavaScript validada com `node --check`.
- Manifest validado como JSON.
- Referências atuais confirmadas para `sidepanel.css`, `overlay.css` e os content scripts em `content/`.
- Diff revisado após as alterações.

## Recomendações para a Próxima Etapa

1. Criar testes unitários para `validators.js`, `amaweb-adapter.js`, `cache-store.js` e `export-report.js`.
2. Definir e testar uma política de sanitização do HTML antes do envio.
3. Confirmar com a documentação do AMAWeb quais atributos são indispensáveis para cada regra.
4. Atualizar o README e demais documentos antigos para apontarem para este relatório.
5. Gerar novamente o ZIP somente após a aprovação da versão final.

## Limitações Técnicas Conhecidas

### Shadow DOM

Elementos dentro de Shadow Roots não são totalmente encontrados por consultas comuns ao `document`. Assim, componentes Web que encapsulam sua estrutura podem não ser capturados ou destacados corretamente.

O suporte futuro dependeria de percorrer Shadow Roots abertos de forma recursiva. Shadow Roots fechados permanecem protegidos pelo navegador e não podem ser inspecionados livremente pela extensão.

### Iframes cross-origin

Iframes de mesma origem podem ser acessíveis dependendo das permissões e do contexto da página. Iframes carregados de outros domínios são isolados pela política de mesma origem do navegador.

Consequentemente, a extensão não garante a avaliação do conteúdo interno de iframes cross-origin, como widgets de pagamento, anúncios ou componentes hospedados por terceiros.

### Páginas restritas

O navegador impede a execução normal da extensão em páginas como `chrome://`, `edge://`, páginas de extensões e lojas do navegador. Esses endereços são bloqueados pelo próprio navegador e não representam falha do motor AMAWeb.

### URLs locais e páginas autenticadas

Páginas locais podem ser avaliadas quando o usuário permite acesso a URLs de arquivos nas configurações da extensão. Páginas autenticadas também podem ser capturadas porque o HTML é obtido do contexto já aberto no navegador, mas o conteúdo continua sujeito ao aviso de privacidade e à sanitização configurável.

### Escopo da avaliação

A extensão avalia o DOM capturado no momento da solicitação. Alterações posteriores feitas por JavaScript, conteúdo carregado depois da captura ou estados que exigem interação podem não estar representados no relatório. Para esses casos, o usuário deve deixar a página no estado que deseja avaliar antes de iniciar a análise.

### Ordem de foco

Foi adicionado um protótipo independente que identifica elementos focáveis visíveis, numera-os conforme a ordem de `tabIndex` e do DOM e permite mover o foco ao clicar nos marcadores. A implementação inicial não pretende reproduzir toda a lógica do navegador ou da WAVE: Shadow DOM, iframes e widgets com gerenciamento avançado de foco permanecem fora do escopo atual.

## Fixtures Locais de Teste

Foram criadas páginas controladas em `docs/test-pages/` para comparar a avaliação com a sanitização ativada e desativada:

- `formulario.html`: valores de `input`, `textarea`, `select`, checkbox e botão.
- `contenteditable.html`: editores com e sem nome acessível.
- `aria.html`: tabs, dialog, `aria-label`, `aria-labelledby` e estados.
- `problemas.html`: imagem sem `alt`, campo sem label, botão vazio, link vazio, contraste e heading fora da sequência.
- `limpa.html`: página de referência com estrutura básica e elementos nomeados.

O índice está em `docs/test-pages/index.html`. Ao abrir os arquivos diretamente no navegador, é necessário permitir acesso a URLs de arquivos nas configurações da extensão.

### Observação da primeira rodada de comparação

Na comparação manual registrada em PDF, a nota de conformidade permaneceu igual na maioria dos cenários com e sem sanitização. As principais diferenças observadas foram nas quantidades de práticas aceitáveis, avisos e erros exibidas nas tabelas.

As tabelas também foram visualizadas nos modos de contagem por regras e por elementos. Portanto, totais diferentes entre esses modos são esperados e não representam necessariamente uma mudança na avaliação.

Somente o último caso apresentou mudança visível de nota nessa rodada. Esse caso deve ser repetido de forma isolada antes de atribuir a alteração à sanitização. A evidência atual não permite concluir que `contenteditable` esteja alterando o score.

Na comparação dos relatórios JSON da página `problemas.html`, os cinco erros e seis avisos permaneceram iguais. O segundo relatório, porém, apresentou 52 sucessos adicionais, principalmente em `id_01` e `color_02_b`. A causa mais provável era a segunda captura incluir os próprios overlays da extensão deixados no DOM após a primeira avaliação. O capturador agora remove wrappers e camadas AMAWeb do clone antes do envio, tornando a repetição do teste comparável.

## Conclusão

As melhorias de segurança, organização e usabilidade planejadas para a primeira etapa foram aplicadas. O principal risco restante é a privacidade do conteúdo capturado: ele já faz parte do modelo de avaliação do AMAWeb, mas a extensão torna esse envio mais fácil para páginas privadas. O aviso de confirmação reduz o risco de uso inconsciente; a próxima proteção técnica deve ser a sanitização seletiva do HTML.
