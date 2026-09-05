# Plano Técnico: Extensão de Avaliação de Acessibilidade AMAWeb

Registro da arquitetura atual, melhorias implementadas, correções prioritárias e roadmap da extensão de navegador para avaliação de práticas de acessibilidade WCAG 2.1.

---

## Estado Atual (agosto 2026)

### ✅ Implementado

**Arquitetura modular e funcional:**

- `background/service-worker.js`: gerencia o ciclo de vida, abre o Side Panel e roteia mensagens
- `background/api-client.js`: faz requisições para o backend da API AMAWeb
- `background/message-router.js`: centraliza a comunicação entre contextos
- `content.js`: injeta overlays e gerencia destaque de elementos na página
- `sidepanel/findings-renderer.js`: renderiza cards de erros, filtros e ordenação
- `popup.html` e `popup.js`: interface do painel lateral com abas (Geral e Detalhes)
- `core/amaweb-adapter.js`: converte respostas da API com tradução plural, nível WCAG e referências
- `core/cache-store.js`: mantém cache em memória e persiste em `chrome.storage.session`
- `core/tests-catalog.js` e `core/tests-colors.js`: catálogos de metadados derivados do pacote oficial
- `translations.json`: dicionário de traduções em português com `ELEMS` e `TESTS_RESULTS`

**Funcionalidades operacionais:**

- Avaliação de página via API AMAWeb oficial
- Cache automático por aba com invalidação em recarga/mudança de URL
- Cálculo de contadores por tipo (erro, aviso, sucesso) e nível (A, AA, AAA)
- Filtros por tipo de erro e nível de conformidade
- Ordenação por padrão, ocorrências crescente/decrescente
- Overlays visuais na página com destacar/desdestacar
- Exportação de resultados em JSON
- Tratamento de erros de rede, timeout, HTML vazio e rate limit
- Bloqueio de segurança para páginas internas do navegador

O principal ponto de manutenção é o excesso de responsabilidades em `popup.js` e a mistura de CSS do Side Panel, CSS dos overlays, estilos inline e estilos aplicados por JavaScript.

---

## Arquitetura Atual

```
extension/
  background/
    service-worker.js          # gerenciamento e roteamento principal
    api-client.js              # cliente HTTP para AMAWeb
    message-router.js          # despachante de mensagens entre contextos
  content.js                   # injeção de overlays e gestão do DOM
  sidepanel/
    findings-renderer.js       # renderização de resultados, filtros, ordenação
  popup.html                   # interface do painel lateral
  popup.js                     # lógica da interface, eventos e integração
  popup.css                    # estilos do painel (misturado com overlay?)
  styles.css                   # estilos globais
  core/
    amaweb-adapter.js          # conversão e tradução de resultados
    cache-store.js             # cache em memória + session storage
    tests-catalog.js           # catálogo de testes (derivado do oficial)
    tests-colors.js            # mapeamento de cores por status
  manifest.json                # configuração da extensão
  translations.json            # traduções em português
```

---

## Melhorias Já Implementadas

### ✅ Tradução e Normalização (concluso)

- Integração dos catálogos oficiais (`tests.ts`, `testsColors.ts`)
- Mapeamento automático de `teste técnico + verdict` → chave traduzível (ex: `imgAltNo + failed` → `img_01b`)
- Plural/singular automático na mensagem de resultado
- Fallback para descrição original da API se a chave não existir no catálogo
- Incorporação de nível WCAG, referência oficial e critérios relacionados no resultado

### ✅ Estrutura de Cache

- Persistência em `chrome.storage.session` (perdida ao fechar o navegador)
- Invalidação automática em mudança de URL ou recarregamento (F5)
- Restauração visual ao trocar de aba se a URL continuar igual
- Limpeza em abas fechadas

### ✅ Tratamento de Erros

- Mapeamento de códigos de erro da API para mensagens amigáveis
- Bloqueio de segurança para URLs internas (chrome://, edge://, etc.)
- Tratamento de timeouts, HTTP 413, 405 e indisponibilidade
- Mensagens informativas no painel de erro

### ✅ Filtros e Ordenação

- Filtro por tipo (erro, aviso, sucesso)
- Filtro por nível (A, AA, AAA)
- Ordenação por padrão, ocorrências crescente/decrescente
- Atualização dinâmica da lista ao mudar filtros

---

## ⚠️ Problemas Conhecidos e Melhorias Necessárias

### P0: Segurança e Correções Críticas

**Interpolação de dados em HTML:**
- `popup.js` insere contadores e nomes via `innerText` ✅ (seguro)
- `findings-renderer.js` cria strings HTML inline sem sanitização ❌ (risco se houver injeção de dados da API)
- **Ação:** Validar se `item.Criterio`, `item.Descricao` são inseridos com `.textContent` ou `.innerHTML`

**Uso de `innerHTML` e XSS:**
- Procurar por `.innerHTML +=` ou `.innerHTML =` em `popup.js` e `findings-renderer.js`
- **Ação:** Converter para `.textContent` ou uso seguro de DOM APIs

**Mutação permanente de estilos:**
- `content.js` pode estar alterando `document.body.style.position` sem restaurar
- **Ação:** Confirmar se há limpeza de estilos globais ao remover overlays (função `CLEAR_OVERLAYS`)

**Promises não tratadas:**
- `chrome.tabs.sendMessage()` pode rejeitar silenciosamente
- **Ação:** Adicionar `.catch()` em todos os `sendMessage()` em `popup.js`

### P1: Estrutura e Manutenção

**CSS misturado:**
- `popup.css` contém estilos do Side Panel e overlays? (deve estar separado)
- `styles.css` contém o quê exatamente?
- **Ação:** Separar em `sidepanel.css` (interface) e `overlay.css` (elementos injetados)

**Responsabilidade de `popup.js`:**
- Arquivo faz UI, cache, API, tradução, renderização, filtros, exportação e lógica de eventos (~300 linhas)
- **Ação:** Extrair `export-report.js` e considerar separação futura de lógica em módulos menores

**Validação de resposta da API:**
- Confirmar se há validação do schema: `result.data.nodes`, `result.data.score`
- **Ação:** Adicionar função `validateEvaluationResponse()` em `core/validators.js`

**Nível WCAG em `descobrirNivelWCAG()`:**
- Função em `amaweb-adapter.js` que deduz nível a partir de critérios WCAG
- ✅ Funciona, mas seria melhor se o catálogo já tivesse o nível em `tests.ts`
- **Ação:** Considerar usar `regraOficial[1]?.level` se disponível

**Sem documentação de componentes:**
- `findings-renderer.js`: assinatura de funções, contrato de dados esperados
- `amaweb-adapter.js`: formato de entrada e saída
- **Ação:** Adicionar JSDoc nos exports

### P2: Funcionalidades Faltando

**Testes unitários:**
- 0 testes encontrados no repositório
- **Prioridade:** Testes para adaptador, cache e validação de API
- **Tecnologia:** Vitest, Jest ou Node.js nativo

**Navegação entre ocorrências:**
- Não há "anterior" / "próximo" elemento para uma regra
- Implementação dependeria de armazenar `pointers` dos elementos

**Painel de detalhes:**
- Não há exibição de seletor CSS, atributos HTML ou sugestão de correção
- Dependeria de um segundo painel ou expansão do card

**Suporte a Shadow DOM:**
- `content.js` não sabe atravessar Shadow DOM aberto
- Iframes também são problema (impossível via content script)
- **Documentação necessária:** Quais limitações o usuário tem

**Exportação avançada:**
- Atualmente: JSON apenas
- Faltam: CSV, HTML, PDF, EARL-XML

**Histórico e Comparação:**
- Sem histórico local de avaliações
- Sem dashboard de regressões

---

## Regras de Organização (Consolidadas)

1. O Side Panel deve renderizar a partir de dados, nunca armazenar HTML pronto no cache.
2. Dados vindos da API devem ser inseridos com `textContent` ou APIs DOM seguras, nunca por interpolação em `innerHTML`.
3. `popup.css` deve conter apenas a interface da extensão; `overlay.css` deve conter apenas os elementos injetados na página.
4. O content script não deve alterar estilos do site avaliado sem guardar e restaurar o valor original.
5. Mensagens entre contextos devem usar nomes constantes e payloads validados.
6. A URL da API, timeout e ambiente devem ser configuração, não valores espalhados pelo código.

---

## Checklist de Valida��o

Antes de considerar a extens�o "pronta para p�blico", verificar:

- [ ] Nenhum `console.error` n�o tratado
- [ ] Nenhum `.innerHTML +=` ou interpola��o direta em HTML
- [ ] Estilos do body/html restaurados ap�s limpar overlays
- [ ] Cache funciona em trocar de aba e recarga
- [ ] Mensagens de erro cobrem: timeout, 413, 405, DNS, rate limit, indisponibilidade
- [ ] Filtros e ordena��o n�o quebram renderiza��o
- [ ] Overlays n�o ficam presos em Shadow DOM
- [ ] Exporta��o JSON est� v�lida e cont�m todos os campos
- [ ] Tradu��es n�o t�m placeholders `{{value}}` quebrados
- [ ] URLs internas s�o bloqueadas
- [ ] Funciona em Chrome, Edge e Chromium

---

## Roadmap

### Curto Prazo (pr�ximas 2-4 semanas)

1. **Testes unit�rios** para adaptador e cache (Vitest)
2. **Separa��o de CSS** (sidepanel.css vs overlay.css)
3. **Valida��o de schema** da resposta da API
4. **Documenta��o JSDoc** nos exports principais
5. **Auditoria de seguran�a** (XSS, innerHTML, estilos globais)

### M�dio Prazo (1-2 meses)

6. Navega��o entre ocorr�ncias (anterior/pr�ximo)
7. Painel de detalhes expans�vel com seletor e sugest�es
8. Exporta��o em CSV e HTML
9. P�gina de op��es (servidor customizado, timeout, idioma)
10. Hist�rico local com `chrome.storage.local`

### Longo Prazo (3+ meses)

11. Compara��o entre avalia��es e regress�es
12. Suporte a documenta��o de Shadow DOM e limita��es
13. Melhorias de acessibilidade pr�pria (teclado, contraste, ARIA)
14. Modo offline com dados em cache
15. Integra��o com CI/CD (relat�rios autom�ticos)

---

## Arquivos de Refer�ncia

Armazenados em `docs/referencia-amaweb/` para consulta t�cnica:

- `mapping.ts`: l�gica oficial de mapeamento de regras e elementos
- `tests.ts`: cat�logo completo de regras com metadados
- `testsColors.ts`: cores e status por regra
- `scs.ts`: crit�rios de sucesso e URLs
- `translate.ts`: implementa��o oficial de tradu��o

Esses arquivos foram copiados para refer�ncia mas n�o s�o utilizados diretamente em produ��o (j� foram incorporados em `tests-catalog.js`).

---

## Notas para Desenvolvedores

### Localidades de Risco

1. **popup.js, linhas 80+**: Loop de renderiza��o e atualiza��o de contadores. Risco de performance se houver muitos resultados (>1000).
2. **findings-renderer.js, linhas 40+**: Renderiza��o de cards. Se `item.Descricao` vier da API com HTML, h� risco de XSS.
3. **content.js, linhas com `style`**: Mudar estilos globais sem salvar estado anterior.

### Como Estender

**Adicionar novo filtro:**
- Adicionar `<select id="filtro-novo">` em `popup.html`
- Adicionar l�gica em `findings-renderer.js` no m�todo `atualizarListaDeResultados()`

**Adicionar novo campo ao resultado:**
- Adicionar em `amaweb-adapter.js` dentro do loop de resultados
- Adicionar tradu��o em `translations.json` se necess�rio
- Atualizar export em `popup.js` se mudar o schema

**Testar localmente:**
```bash
# No Chrome: chrome://extensions ? "Carregar extens�o sem empacotamento" ? selecionar pasta extension/
# Verificar console: F12 no painel lateral, Developer tools
# Limpar cache: Settings ? Clear all ? refresh
```

---

## �ltimo Status

- **Data:** 22 de agosto de 2026
- **Branch:** develop
- **Testes:** nenhum (prioridade: implementar em curto prazo)
- **Funcionalidade:** core completo, filtros e ordena��o operacionais, cache est�vel
- **Pr�ximo:** Auditoria de seguran�a (XSS, interpola��o de dados)
