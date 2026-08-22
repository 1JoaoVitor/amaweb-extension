faça a mesma coisa:

# Avaliador AMAWeb - Extensão para Google Chrome

Este documento descreve a concepção, arquitetura e implementação da extensão do Avaliador AMAWeb para Google Chrome, projeto desenvolvido como Trabalho de Conclusão de Curso (TCC).

## 1. A Ideia do Projeto e Motivação (O TCC)

### O Problema

A acessibilidade na web é um direito fundamental, garantido por diretrizes internacionais (como a WCAG) e normas brasileiras (NBR 17225). No entanto, desenvolvedores e auditores de acessibilidade enfrentam grandes desafios no processo de validação de páginas web.
Muitas ferramentas de avaliação exigem que o usuário saia do seu contexto de navegação, cole URLs em portais externos e interprete relatórios textuais densos, que muitas vezes não deixam claro *onde* exatamente o erro está ocorrendo na interface. Além disso, páginas modernas (fechadas por login ou rodando localmente) não podem ser avaliadas por avaliadores tradicionais baseados em URL.

### A Solução: A Extensão AMAWeb

A extensão AMAWeb atua como uma ponte direta entre o navegador do usuário e o poderoso motor de avaliação da Unifesp. A ideia central do projeto é **democratizar e simplificar a auditoria de acessibilidade**, trazendo a avaliação para *dentro* do ambiente de desenvolvimento e navegação.

**Os principais pilares da ideia são:**

1. **Auditoria Visual e In-Loco:** Em vez de ler um relatório abstrato, o usuário clica em "Destacar" e a extensão desenha uma caixa visual exata (overlay) em cima do elemento com problema na própria página web.
2. **Avaliação de Contextos Fechados:** Como a extensão captura o HTML que já está renderizado no navegador, ela consegue avaliar páginas protegidas por senha, intranets e sistemas em desenvolvimento (localhost).
3. **Tradução de Complexidade:** A ferramenta pega o JSON técnico gerado pelo backend e o traduz para uma interface amigável, dividindo os resultados em Sucessos, Avisos e Erros, categorizados por níveis de conformidade (A, AA, AAA).

## 2. Arquitetura e Engenharia de Software

O projeto foi construído utilizando as tecnologias mais recentes para extensões web, focando em performance, resiliência e segurança.

### 2.1. Manifest V3 e Service Workers

A extensão foi construída nativamente no padrão **Manifest V3** do Google Chrome. Toda a orquestração de chamadas de rede foi delegada ao `background.js` (Service Worker), que atua de forma assíncrona e dorme quando não está em uso, economizando memória do usuário.

### 2.2. Integração Direta (Sem Intermediários)

A arquitetura foi simplificada para eliminar a necessidade de um servidor intermediário (BFF - Backend For Frontend). O Service Worker se comunica diretamente com a API do AMAWeb via requisições `POST` (Fetch API), enviando a árvore DOM sanitizada como *payload*.

### 2.3. Sistema de Cache em Memória e SPAs

Para evitar sobrecarga no servidor e melhorar a percepção de performance (UX), foi implementado um sistema de cache (`cacheAvaliacoes`).

- **Economia de Rede:** Ao trocar de abas, o painel lateral reconstruí a interface instantaneamente a partir da memória.
- **Invalidação Inteligente (SPAs):** A extensão "ouve" eventos da *History API* do navegador (`changeInfo.url`). Se o usuário navegar dinamicamente por um site moderno (como React ou Angular) sem recarregar a página, a extensão percebe a mudança de contexto, destrói o cache antigo e limpa as marcações visuais automaticamente.

## 3. Manipulação do DOM e Feedback Visual

O maior desafio técnico da extensão era desenhar marcações visuais na página do usuário sem quebrar o CSS original do site avaliado.

- **Isolamento de Camadas:** Todos os overlays e *badges* informativos são criados em uma camada absoluta (`amaweb-overlay-layer`) injetada no final do `<body>`. Isso impede que o CSS da extensão interfira no layout da página.
- **Cálculo Espacial Cirúrgico:** Utiliza-se a API `getBoundingClientRect()` somada ao deslocamento atual da janela (`window.scrollY`) para calcular as coordenadas exatas de elementos com erro, mesmo se a página for responsiva ou estiver "rolada".
- **Scroll Matemático e Suave:** Ao pedir para destacar um erro, a ferramenta não usa o `scrollIntoView` de forma forçada, o que poderia quebrar layouts. Ela calcula o centro vertical da tela e move o `window` suavemente até a coordenada do erro, oferecendo uma experiência fluida.

## 4. Otimização, Resiliência e UX

### 4.1. Limpeza Agressiva de Payload (Mitigação do Erro 413)

O motor de acessibilidade analisa a estrutura (tags e atributos), não os pixels. Para evitar o Erro HTTP 413 (Payload Too Large), o *Content Script* faz uma sanitização profunda antes de enviar o HTML:

- Remove tags desnecessárias (`<script>`, `<style>`, `<canvas>`, `<video>`).
- **Strip de Base64:** Varrer o DOM em busca de imagens renderizadas em *Base64* (que geram megabytes de texto inútil) e esvazia seus atributos `src`, `srcset` e fundos CSS inline, reduzindo o tamanho da requisição em até 80%.

### 4.2. Tratamento de Exceções e Edge Cases

A ferramenta é blindada contra falhas:

- **Bloqueio de Segurança:** Impede a execução em páginas restritas do sistema (`chrome://`) e locais sem permissão, avisando o usuário educadamente via interface em vez de gerar falhas silenciosas.
- **Tradução de Erros de Rede:** Códigos HTTP puros (como 405 Method Not Allowed ou falhas de CORS) são interceptados pelo `catch` e transformados em mensagens úteis e amigáveis no painel visual da extensão.

### 4.3. Empoderamento do Usuário

- **Toggle Switch:** Um interruptor visual permite que o usuário decida se as marcações de erro devem permanecer na tela ao trocar de abas ou se devem ser limpas automaticamente.
- **Exportação Client-Side:** Os usuários podem baixar um relatório completo em formato `.json` com um clique. A geração do arquivo ocorre inteiramente no cliente (via interface `Blob`), sem requisições adicionais ao servidor.