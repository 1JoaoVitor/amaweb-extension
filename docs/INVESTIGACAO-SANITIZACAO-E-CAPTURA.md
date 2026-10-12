# Investigação sobre Sanitização e Captura do DOM

## Objetivo

Investigar se a sanitização aplicada pela extensão antes do envio do HTML ao AMAWeb alterava os resultados da avaliação de acessibilidade.

A preocupação inicial era proteger dados sensíveis de páginas autenticadas ou preenchidas pelo usuário sem modificar significativamente a avaliação feita pelo motor AMAWeb.

## Hipótese inicial

A extensão captura o DOM renderizado da página, cria um clone e envia esse clone ao servidor AMAWeb. Para reduzir o risco de exposição de dados, foi criada uma sanitização opcional.

A primeira versão da sanitização removia:

- valores de `input`;
- conteúdo de `textarea`;
- seleção atual de `select`;
- texto de elementos `contenteditable`.

Durante a investigação, o painel recebeu temporariamente um controle para ativar ou desativar a sanitização. Depois que os testes foram concluídos, esse controle foi removido e a proteção passou a ser obrigatória no fluxo normal da extensão.

## Fixtures de teste

Foram criadas páginas HTML locais e controladas em `docs/test-pages/`:

- `aria.html`: atributos e estados ARIA;
- `contenteditable.html`: editores com e sem nome acessível;
- `formulario.html`: campos de texto, e-mail, senha, textarea, select, checkbox e botão;
- `problemas.html`: erros conhecidos de acessibilidade;
- `limpa.html`: página de referência com estrutura básica;
- `index.html`: índice para abrir os cenários.

O uso de páginas locais tornou os testes repetíveis e evitou depender de páginas públicas que poderiam mudar durante a investigação.

## Primeiro resultado e falso indício

Na primeira comparação da página `problemas.html`, os relatórios pareciam apresentar uma diferença muito grande:

| Relatório | Total | Sucessos | Avisos | Erros |
|---|---:|---:|---:|---:|
| Primeiro | 38 | 27 | 6 | 5 |
| Segundo | 90 | 79 | 6 | 5 |

Os cinco erros e seis avisos eram iguais nos dois relatórios, mas o segundo possuía 52 sucessos adicionais.

Inicialmente, essa diferença poderia ser interpretada como um efeito da sanitização. Porém, a análise dos JSONs revelou que o segundo relatório continha elementos criados pela própria extensão, como:

- `div.amaweb-badge`;
- textos das tooltips;
- elementos internos dos cards e overlays;
- IDs e estilos usados pelas camadas visuais.

Exemplos de elementos encontrados no relatório contaminado:

```html
<div class="amaweb-badge error">X</div>
<strong>Cabeçalhos com salto(s) de nível hierárquico incorreto(s)</strong>
<span>Encontrei 1 caso em que se viola a sequência hierárquica...</span>
```

Esses elementos estavam sendo incluídos na nova captura porque os overlays permaneciam no DOM da página após a primeira avaliação.

## Correção da contaminação

O capturador foi ajustado para remover do clone todos os elementos associados à extensão antes do envio:

- IDs iniciados por `amaweb-`;
- classes iniciadas por `amaweb-`;
- wrappers de overlays;
- camadas de destaque;
- badges e tooltips.

A página original não é modificada. Apenas o clone que será enviado ao AMAWeb é limpo.

Depois da correção, a comparação de `problemas.html` apresentou:

- 38 resultados nos dois relatórios;
- 27 sucessos nos dois;
- 6 avisos nos dois;
- 5 erros nos dois;
- nenhum elemento `amaweb-*` nos JSONs;
- assinaturas de regras e ocorrências idênticas.

Esse resultado demonstrou que a diferença inicial não era causada pela sanitização, mas pela avaliação dos próprios elementos visuais da extensão.

## Investigação de `contenteditable`

A primeira versão também removia o texto de elementos `contenteditable`.

Na comparação de `contenteditable.html`, os dois relatórios apresentaram o mesmo score, `8.1`, e os mesmos erros e avisos. Entretanto, houve diferença nos sucessos:

- com conteúdo preservado: 20 sucessos;
- com conteúdo removido: 16 sucessos.

Os quatro resultados que desapareceram estavam relacionados a verificações de contraste:

- `color_02_b`;
- `textC_01`.

O relatório sanitizado continha, por exemplo:

```html
<div contenteditable="true" aria-label="Descricao do produto"></div>
```

Enquanto o relatório sem essa sanitização continha:

```html
<div contenteditable="true" aria-label="Descricao do produto">
  Descricao editavel do produto.
</div>
```

A conclusão foi que o texto editável faz parte do conteúdo acessível da página e não deve ser apagado durante a preparação do HTML.

## Investigação de `textarea`

Em `formulario.html`, o score permaneceu `9.2` nos dois relatórios e os erros e avisos também permaneceram iguais.

A diferença apareceu nas contagens de sucesso:

- relatório com conteúdo do `textarea`: 41 resultados;
- relatório com `textarea` limpo: 39 resultados.

A limpeza do campo removeu duas verificações positivas, uma de `color_02_b` e outra de `textC_01`, porque o texto do campo fazia parte do conteúdo visual avaliado.

Com base nesse resultado, o conteúdo de `textarea` também passou a ser preservado.

## Resultado dos demais cenários

As comparações de `aria.html`, `index.html` e `limpa.html` apresentaram assinaturas equivalentes entre os dois modos.

Não foram observadas diferenças relevantes em:

- score;
- erros;
- avisos;
- regras avaliadas;
- número de ocorrências.

## Estado final da sanitização

A sanitização final passou a ser seletiva:

- remove valores de `input`;
- remove a seleção atual de `select`;
- preserva `textarea`;
- preserva `contenteditable`;
- preserva a estrutura semântica e os atributos de acessibilidade;
- remove elementos gerados pela própria extensão antes da captura.

O controle de sanitização permanece disponível no painel para permitir novas comparações durante a pesquisa.

## Conclusões

A investigação produziu duas conclusões principais:

1. **A primeira grande diferença encontrada não era causada pela sanitização.** Ela era causada pela própria extensão sendo incluída na próxima avaliação. A remoção dos overlays do clone resolveu o problema.

2. **A sanitização pode alterar detalhes do relatório quando remove conteúdo que participa da avaliação.** Por isso, `contenteditable` e `textarea` passaram a ser preservados.

Assim, não é correto afirmar que a sanitização nunca produz efeitos colaterais. A conclusão mais precisa é que ela foi ajustada para reduzir a exposição de dados sensíveis sem remover conteúdo textual relevante para a avaliação de acessibilidade.

## Validação

Após as correções:

- os relatórios foram exportados em JSON;
- os pares foram comparados por score, tipo, regra e quantidade de ocorrências;
- os elementos `amaweb-*` foram procurados nos resultados;
- todos os arquivos JavaScript passaram em `node --check`;
- o Manifest V3 permaneceu válido.

Esse processo permitiu distinguir uma alteração real na avaliação de uma alteração causada pelo próprio mecanismo visual da extensão.
