# **AMAWeb Extension \- Documentação Técnica e Arquitetura**

# **1\. Visão Geral**

A extensão **AMAWeb** é uma solução para navegadores baseados na arquitetura Chromium (Manifest V3), desenvolvida com o propósito de automatizar, estruturar e simplificar o processo de auditoria de acessibilidade em aplicações web. Integrando-se via chamadas RESTful assíncronas à API do ecossistema AMAWeb, o sistema realiza a análise heurística do Modelo de Objeto do Documento (DOM), identificando desconformidades em relação às diretrizes internacionais da *Web Content Accessibility Guidelines* (WCAG).

> Para o estado final do projeto, problemas corrigidos, investigação da sanitização, testes, limitações e modo de Ordem de Foco, consulte `docs/RELATORIO-FINAL-TCC.md`. Este documento mantém a descrição técnica detalhada da arquitetura.

O diferencial arquitetural do projeto reside em seu mecanismo de **feedback visual não-intrusivo**. A extensão injeta uma camada de interface dinamicamente sobreposta (*overlay*) ao DOM da página auditada, mapeando visualmente as inconsistências encontradas diretamente nos elementos afetados, sem alterar a árvore DOM original da página host, sem quebrar os estilos CSS preexistentes ou comprometer a navegação do usuário.

# **2\. Arquitetura de Renderização: O Sistema de Duas Camadas**

## **2.1 Mitigação do *Layout Thrashing* (Refluxo Contínuo)**

A injeção direta de elementos HTML no fluxo normal de uma página web auditada apresenta um desafio crítico de engenharia: o *Layout Thrashing*. Este fenômeno ocorre quando o navegador é forçado a recalcular repetidamente as posições e geometrias dos elementos (*reflow*) e reaplicar a estilização (*repaint*), resultando em degradação severa da taxa de quadros (*flickering* ou quedas abaixo de 60 FPS) e potencial deformação da interface original.

Para anular o *Layout Thrashing*, a extensão isola completamente os sinalizadores visuais (*badges* e *highlights*) em um container dedicado. Esses elementos são posicionados fora do fluxo normal do documento (out-of-flow positioning), utilizando propriedades CSS que acionam a aceleração de hardware e impedem que a mutação do DOM da extensão afete as dimensões dos nós da aplicação auditada.

## **2.2 Divisão em Camadas de Exibição**

A renderização do overlay utiliza um sistema híbrido de duas camadas de contexto de empilhamento (*stacking contexts*), garantindo alinhamento preciso sob variadas condições de rolagem:

* **Camada `absolute` (`position: absolute`):** Destinada à ancoragem de *badges* associados a elementos que pertencem ao fluxo estático e de rolagem convencional do documento (`position: static`, `relative` ou `absolute`). A posição dos sinalizadores é calculada com base na coordenada global da página (`window.scrollX` e `window.scrollY`).  
* **Camada `fixed` (`position: fixed`):** Projetada especificamente para ancorar elementos estáticos ou "pegajosos" na janela de visualização (*viewport*), tais como cabeçalhos fixos (`position: fixed` ou `position: sticky`), muito comuns em plataformas modernas (ex: YouTube, portais de notícias). Essa camada assegura que o sinalizador acompanhe o elemento pai em tempo real sem defasagem de posicionamento.

## **2.3 Otimização via Aceleração de Hardware (`translate3d`)**

A atualização de posicionamento dos elementos visuais da extensão utiliza a propriedade CSS `transform: translate3d(x, y, 0)` em detrimento das propriedades clássicas `top` e `left`.

O uso do `translate3d` força o motor de renderização do navegador (Blink) a promover o elemento visual para sua própria camada de composição na Unidade de Processamento Gráfico (GPU). Consequentemente, as movimentações durante a rolagem ou redimensionamento da janela alteram apenas a fase de **Composição** (*Compositing*) no pipeline de renderização, ignorando completamente as etapas custosas de Layout e Pintura (Paint).

## **2.4 Algoritmo de Agrupamento por Proximidade (Raio de 60px)**

Em regiões de alta densidade de erros de acessibilidade (ex: formulários complexos ou menus sanfona), a renderização individual de múltiplos badges causa poluição visual e sobreposição de marcadores. Para solucionar este problema, foi implementado um algoritmo de agrupamento espacial (*clustering*) baseado na distância euclidiana.

\$\$d \= \\sqrt{(x\_2 \- x\_1)^2 \+ (y\_2 \- y\_1)^2}\$\$

Onde:

* \$(x\_1, y\_1)\$ representa a coordenada de centro do primeiro marcador.  
* \$(x\_2, y\_2)\$ representa a coordenada de centro do segundo marcador.

\[Início da Análise de Nós\]

          │

          ▼

   Calcular BoundingBox (x, y)

          │

          ▼

  Existe Badge no Raio \<= 60px?

     ├── SIM ──► Agrupar ao Badge Existente (Incrementar Contador)

     │

     └── NÃO ──► Criar Novo Badge na Camada Apropriada (absolute/fixed)

Se a distância \$d \\le 60\\text{px}\$, os erros são consolidados sob um único *badge* multifuncional, exibindo um contador numérico cumulativo que expande o detalhamento dos erros sob interação (*hover* ou clique).

# **3\. Motor de Busca de Elementos: Resiliência em DOM Mutável**

## **3.1 Fragilidade dos Seletores CSS Tradicionais**

A auditoria assíncrona da API do AMAWeb retorna seletores CSS como referência aos elementos com falhas. No entanto, em aplicações Web modernas desenvolvidas sobre arquiteturas SPA (*Single Page Applications*) — como React, Vue ou Angular —, o DOM é altamente dinâmico.

A alteração de estados, a injeção de classes utilitárias compiladas em tempo de execução (ex: Tailwind CSS ou Styled Components), e a presença de seletores temporários contendo pseudoclasses de estado (ex: `:hover`, `:focus`, `:active`) tornam os seletores originais obsoletos ou inválidos no momento da renderização da auditoria.

## **3.2 Lógica do Algoritmo encontrarElementoRobusto**

Para assegurar a localização exata do elemento no DOM, foi desenvolvido o mecanismo de recuperação em cascata `encontrarElementoRobusto`. O algoritmo executa até 5 níveis progressivos de *fallback*:

| Nível de Fallback | Estratégia de Busca | Mecanismo de Execução |
| :---- | :---- | :---- |
| **Nível 1** | Sanitização de Seletor | Remove pseudoclasses dinâmicas e irreais (ex: `:hover`, `:focus`, `:nth-child` inválidos) através de Expressões Regulares antes da consulta. |
| **Nível 2** | Consulta Exata | Executa `document.querySelector(seletorSanitizado)`. |
| **Nível 3** | Identificador Único (`id`) | Se o seletor contiver um `#id`, isola o identificador e executa `document.getElementById(id)`. |
| **Nível 4** | Assinatura Estrutural | Extrai atributos estáveis do fragmento retornado pela API (atributos `href`, `src`, `name`, `type`, `role` e `textContent` limpo). |
| **Nível 5** | Sistema de Pontuação por Similaridade | Percorre todas as tags idênticas no DOM e aplica uma função de pontuação (*Scoring System*) baseada em similaridade taxonômica e hierárquica. |

## **3.3 A Função de Pontuação (*Scoring System*)**

Caso ocorra ambiguidade na camada de *fallback*, a função de pontuação avalia a probabilidade de um nó \$E\$ correspondente ao fragmento original \$F\$ através do cálculo ponderado:

\$\$Score(E) \= w\_1 \\cdot S\_{\\text{attr}} \+ w\_2 \\cdot S\_{\\text{text}} \+ w\_3 \\cdot S\_{\\text{depth}}\$\$

Onde:

* \$S\_{\\text{attr}}\$: Razão de coincidência de atributos estáticos (`href`, `src`, `alt`, etc.).  
* \$S\_{\\text{text}}\$: Métrica de distância de Levenshtein entre o `textContent` de \$E\$ e de \$F\$.  
* \$S\_{\\text{depth}}\$: Graus de parentesco ou profundidade similar dentro do documento.  
* Os pesos \$w\_1, w\_2, w\_3\$ são calibrados para favorecer correspondências de atributos diretos. O elemento com maior pontuação final é selecionado para o recebimento do marcador visual.

# **4\. Gestão de Estado e Feedback Visual (O Painel Lateral)**

## **4.1 Comunicação Assíncrona e Sincronização de Estado**

A arquitetura de comunicação entre o painel lateral (*Side Panel*) e a página auditada (*Content Script*) é estruturada com base no barramento de mensagens do protocolo `chrome.runtime.sendMessage` e `chrome.tabs.sendMessage`.┌────────────────────────────────┐         Bus de Mensagens        ┌──────────────────────────────────┐

│          Side Panel            │ ══════════════════════════════► │          Content Script          │

│  (Interface de Controle UI)    │ ◄══════════════════════════════ │        (Injetado no DOM)         │

└────────────────────────────────┘   \`chrome.runtime.sendMessage\`  └──────────────────────────────────┘

A sincronização bidirecional entre a lista de erros exibida no Painel Lateral e os *badges* aplicados no DOM é mantida por um identificador estático `indexErro`. Quando o usuário seleciona um erro no Painel Lateral, uma mensagem contendo o payload `{ action: "HIGHLIGHT_ERROR", index: indexErro }` é transmitida ao *Content Script*, que aciona a rolagem suave (*smooth scroll*) até a posição do elemento correspondente e aplica uma animação de destaque (flash animation).

## **4.2 Detecção *Just-In-Time* (JIT) de Visibilidade**

Uma abordagem ingênua determinaria a visibilidade de todos os elementos auditados no momento inicial da carga. Contudo, em aplicações complexas, elementos podem ter suas propriedades alteradas dinamicamente via JS/CSS (ex: modais abertos, menus sanfona expandidos ou elementos empurrados para coordenadas como left: \-9999px para ocultação acessível).

A extensão AMAWeb adota a verificação de visibilidade **Just-In-Time (JIT)**. A visibilidade é calculada no exato milissegundo do evento de interatividade do usuário (ao clicar em um erro no Painel Lateral). A função de verificação avalia as seguintes condições do nó:

1. `element.getBoundingClientRect()`: Avalia se `width > 0` e `height > 0`.  
2. `window.getComputedStyle(element)`: Verifica se `display !== 'none'`, `visibility !== 'hidden'` e `opacity !== '0'`.  
3. Coordenadas da Viewport: Checa se o elemento está contido no espaço visível ou se possui um deslocamento absoluto fora da área de renderização (`off-screen`).

## **4.3 Tratamento do "Falso Positivo Visual"**

Caso o motor de busca identifique o elemento no DOM, mas a verificação JIT confirme que o elemento encontra-se computacionalmente invisível (ex: um erro de contrato de acessibilidade em uma janela modal que ainda não foi aberta pelo usuário), a extensão impede a tentativa de rolar a página até uma coordenada nula.

Neste cenário, a interface do Painel Lateral altera o estado do botão de ação correspondente para **"Elemento Inacessível / Oculto no DOM"**. Esta abordagem atua como feedback pedagógico ao auditor, informando que a inconsistência de acessibilidade existe na estrutura do código-fonte, porém necessita de uma ação do usuário na interface para tornar o nó visível e passível de inspeção visual sobreposta.

# **5\. Limitações Conhecidas (Trade-offs de Engenharia)**

Como em toda decisão de arquitetura de software, o projeto da extensão AMAWeb assumiu compromissos de engenharia (*trade-offs*) deliberados, visando priorizar o desempenho e a estabilidade da navegação do usuário.

## **5.1 O Efeito *Z-Index Stacking Float***

Durante a rolagem do documento contendo cabeçalhos ou barras de navegação com posicionamento fixo e contextos de empilhamento elevados (`z-index: 99999` ou superior, comum em plataformas como o YouTube), os *badges* alocados na camada `absolute` podem flutuar visualmente sobre esses menus fixos durante o deslocamento.

**Justificativa de Engenharia:** Para corrigir rigorosamente o efeito de corte visual de todos os badges sob elementos de topo, seria necessário monitorar a colisão de caixas delimitadoras (bounding boxes) entre cada badge e os elementos fixos da página em tempo real, dentro do ciclo de renderização do navegador (16.6ms por quadro a 60FPS).

A execução contínua de rotinas como `document.elementFromPoint()` durante eventos de rolagem (*scroll listeners*) causaria a invalidação do layout do navegador e engasgos graves na navegação (*jank*). Optou-se estritamente pela preservação do desempenho e fluidez da taxa de quadros da página auditada, aceitando a flutuação temporária dos marcadores como um trade-off viável.

## **5.2 Restrições de Contexto em *Iframes* de Terceiros (Cross-Origin)**

O motor de varredura do *Content Script* opera sob as restrições da Política de Mesma Origem (*Same-Origin Policy* \- SOP) e de *Cross-Origin Resource Sharing* (CORS) impostas pelos navegadores modernos.

Elementos estruturados dentro de quadros `<iframe>` cujas origens sejam distintas do domínio da página pai (ex: um formulário de pagamento externo em um iframe de terceiros) isolam seus respectivos documentos DOM em contextos de segurança inacessíveis. A extensão AMAWeb não possui autorização para injetar códigos ou ler a estrutura de nós internos de *iframes cross-origin* sem permissões explícitas e globais no manifesto, limitando a capacidade de auditoria e overlay visual exclusivamente aos quadros de mesma origem (*same-origin*) ou declaradamente expostos.