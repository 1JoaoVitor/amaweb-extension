# Avaliador AMAWeb - Extensão para Google Chrome

A extensão **AMAWeb** é uma ferramenta de auditoria de acessibilidade in-loco para navegadores baseados em Chromium (Manifest V3). Desenvolvida como Trabalho de Conclusão de Curso (TCC), ela atua como uma ponte direta entre o navegador do usuário e o motor de avaliação da Unifesp, permitindo identificar e visualizar problemas de acessibilidade diretamente na interface da página.

## Como Instalar e Testar (Modo do Desenvolvedor)

Para instalar a versão final em formato `.zip` no seu navegador Google Chrome, siga estes passos:

1. **Extrair o arquivo:** Clique com o botão direito do mouse sobre o arquivo `.zip` da extensão e selecione **"Extrair tudo..."** (ou "Extrair aqui"), salvando os arquivos em uma pasta no seu computador.
2. **Abrir a página de Extensões:** No Google Chrome, digite `chrome://extensions/` na barra de endereços e aperte `Enter`, ou clique no ícone de quebra-cabeça no canto superior direito e selecione **"Gerenciar extensões"**.
3. **Ativar o Modo do Desenvolvedor:** No canto superior direito da página de extensões, ative a chave **"Modo do desenvolvedor"** (Developer mode).
4. **Carregar a extensão:** Aparecerão novos botões no canto superior esquerdo. Clique no botão **"Carregar sem compactação"** (ou "Load unpacked").
5. **Selecionar a pasta:** Na janela que abrir, navegue até a pasta extraída no Passo 1, selecione a pasta raiz (a que contém o arquivo `manifest.json`) e clique em **"Selecionar pasta"**.
6. **Fixar a extensão (Opcional):** Para facilitar o uso, clique no ícone de quebra-cabeça na barra do navegador, procure a extensão "AMAWeb" e clique no ícone de alfinete para deixá-la sempre visível.

---

## A Ideia do Projeto e Motivação

Muitas ferramentas de avaliação exigem que o usuário saia do seu contexto de navegação, cole URLs em portais externos e interprete relatórios textuais densos. Além disso, páginas modernas (fechadas por login, intranets ou rodando localmente) não podem ser avaliadas por avaliadores tradicionais baseados em URL.

A extensão AMAWeb democratiza e simplifica a auditoria ao trazer a avaliação para *dentro* do ambiente de desenvolvimento:
* **Auditoria Visual:** O usuário clica em "Destacar" e a extensão desenha marcações visuais exatas (overlays) em cima do elemento na própria página.
* **Contextos Fechados:** Captura o HTML já renderizado no navegador, superando barreiras de autenticação.
* **Tradução de Complexidade:** Transforma o JSON técnico gerado pelo backend em uma interface amigável, categorizada por Sucessos, Avisos e Erros (Níveis A, AA, AAA).

---

## Principais Funcionalidades

* **Avaliação Integrada:** Análise do HTML renderizado utilizando a API oficial do AMAWeb.
* **Sistema Avançado de Filtros:** Filtragem em tempo real por tipo, nível de conformidade WCAG e **estado de visibilidade** (itens ocultos vs visíveis).
* **Feedback Visual Inteligente:** Destaque de elementos na página com scroll automático suave e navegação paginada entre múltiplas ocorrências da mesma regra.
* **Detecção JIT de Elementos Ocultos:** Pré-verificação de elementos invisíveis no DOM (ex: *skip links* ou menus recolhidos) para bloqueio preventivo de destaques inacessíveis.
* **Ordem de Foco (Modo Independente):** Protótipo de inspeção de navegação por teclado, que numera elementos focáveis visíveis e permite mover o foco clicando nos marcadores.
* **Exportação:** Geração de relatórios completos em formato `.json` diretamente no lado do cliente (Client-side).

---

## Arquitetura e Inovações Técnicas

O projeto foi construído seguindo as melhores práticas de Engenharia de Software e design modular, mitigando problemas clássicos de injeção de DOM.

### 1. Sistema de Renderização em Duas Camadas (Mitigação de Layout Thrashing)
A injeção de elementos visuais diretamente no fluxo da página auditada pode causar degradação de performance (*Layout Thrashing*). A extensão resolve isso utilizando:
* **Camadas Isoladas:** Uma camada `absolute` (para elementos estáticos) e uma `fixed` (para elementos *sticky*).
* **Aceleração de Hardware:** Uso de `transform: translate3d(x, y, 0)` para forçar a GPU a processar a movimentação dos *badges*, ignorando as etapas custosas de Paint/Layout do navegador.
* **Clustering Euclidiano:** Agrupamento espacial de *badges* em um raio de 60px para evitar poluição visual em áreas de alta densidade de erros.

### 2. Motor de Busca de Elementos Resiliente
Em Single Page Applications (SPAs), os seletores CSS retornados pela API podem se tornar obsoletos devido à mutação do DOM. O algoritmo `encontrarElementoRobusto` implementa 5 níveis de fallback:
1. Sanitização do seletor (remoção de pseudoclasses como `:hover`).
2. Busca exata (`querySelector`).
3. Busca por identificador único (`getElementById`).
4. Assinatura estrutural (verificação cruzada de atributos `href`, `src`, etc.).
5. **Scoring System:** Um sistema de pontuação baseado na distância de Levenshtein entre o `textContent` e a taxonomia hierárquica do DOM.

### 3. Sincronização de Estado (Prevenção de Race Conditions)
A arquitetura do Chrome destrói o Painel Lateral ao trocar de abas. A extensão utiliza um Cache Manager associado ao `tabId`. Ao retornar para uma aba, o painel é reconstruído silenciosamente a partir da memória (`chrome.storage.session`), sincronizando os botões da interface com o DOM da página auditada sem causar repinturas (flickering).

### 4. Sanitização e Segurança (Prevenção de Payload Excessivo e Privacidade)
* **Prevenção do Erro 413:** O script captura o DOM e aplica um *strip* em imagens Base64 (esvaziando atributos `src` e fundos CSS), reduzindo o payload em até 80%.
* **Privacidade Seletiva:** Formulários têm seus valores (`input`, seleção de `select`) sanitizados antes do envio à API. No entanto, elementos `textarea` e `contenteditable` são preservados de forma cirúrgica para não quebrar a avaliação heurística de contraste e conteúdo.
* **Prevenção de Contaminação:** Varredura que remove artefatos visuais da própria extensão (`amaweb-*`) antes da captura, impedindo que a ferramenta se auto-avalie em execuções subsequentes.

---

## Desenvolvimento e Testes

A arquitetura modular permitiu a implementação de testes unitários robustos cobrindo a adaptação de dados, cache, exportação JSON, validadores e higienização de DOM.

Para rodar a suíte de testes localmente:
```bash
npm install
npm test
```

---

## ⚠️ Limitações Conhecidas

Como *trade-off* das restrições de segurança dos navegadores modernos:
* **Shadow DOM:** Componentes web fechados em *Shadow Roots* não são inspecionados completamente.
* **Iframes Cross-Origin:** O conteúdo interno de iframes de domínios terceiros (ex: widgets de pagamento externos) não é avaliado devido à Política de Mesma Origem (SOP / CORS).
* **Páginas do Navegador:** Endereços restritos como `chrome://`, `edge://` e lojas de extensões bloqueiam nativamente a execução de *Content Scripts*.
* **Dom Dinâmico:** A análise representa uma "fotografia" do DOM no instante da captura. Mutações posteriores exigem uma nova requisição.

---

## Documentação Complementar

Para aprofundamento nos processos de engenharia, consulte o diretório `docs/`:
* `RELATORIO-FINAL-TCC.md`: Histórico completo de desenvolvimento, desafios solucionados e limitações da versão final.
* `RESUMO-DESENVOLVIMENTO-TCC.md`: Guia focado na arquitetura e resolução de problemas estruturais.
* `INVESTIGACAO-SANITIZACAO-E-CAPTURA.md`: Estudo aprofundado sobre o impacto da sanitização nos resultados do motor de avaliação.
* `MELHORIAS.md` / `RELATORIO-REVISAO-E-MELHORIAS.md`: Roadmap histórico de correções aplicadas.