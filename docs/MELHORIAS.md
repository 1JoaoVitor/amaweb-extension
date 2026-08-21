# Arquitetura e Integração

* **Comunicação Direta via Manifest V3:** A extensão utiliza o *Service Worker* (`background.js`) para realizar requisições assíncronas nativas (API Fetch). O sistema envia a árvore DOM sanitizada como *payload* diretamente ao servidor, eliminando a dependência de um servidor intermediário (BFF).
* **Tratamento Semântico de Exceções:** Implementação de resiliência na comunicação com a API. Códigos HTTP brutos, como o limite de tamanho do arquivo (Erro 413), são interceptados e mapeados para *feedbacks* descritivos e amigáveis ao usuário.
* **Mensageria Inter-processos:** Estabelecimento de um canal bidirecional entre o Painel Lateral (`popup`), o Service Worker e o *Content Script*, permitindo a orquestração segura de capturas e injeções de elementos na página ativa.

## Performance e Gerenciamento de Estado

* **Sistema de Cache em Memória:** Criação de uma estrutura de dados de armazenamento temporário no *Side Panel*, vinculando os resultados das requisições ao identificador único da aba atual (`tab.id`).
* **Otimização de Requisições:** A alternância entre abas reconstrói a interface instantaneamente a partir do cache local, poupando a API de reprocessamentos redundantes e melhorando o tempo de resposta percebido.
* **Invalidação Condicional:** O sistema destrói automaticamente o cache específico de uma aba caso detecte eventos de recarregamento completo (F5) ou navegação para novos domínios.

## Manipulação Dinâmica do DOM

* **Cálculo Espacial Cirúrgico:** Aplicação do método `getBoundingClientRect` somado ao deslocamento vetorial da janela (`window.scrollY`) para plotar coordenadas absolutas e desenhar *overlays* sem quebrar o layout da página avaliada.
* **Rolagem Geométrica Centralizada:** Implementação de rolagem automática baseada em cálculo matemático focado no eixo Y. O navegador move a tela suavemente para centralizar as marcações visuais, contornando bloqueios nativos do `scrollIntoView`.
* **Isolamento de Camadas Visual:** As caixas delimitadoras e *badges* são renderizadas dentro de um contêiner global isolado (`amaweb-overlay-layer`), permitindo rápida remoção e evitando herança indesejada de CSS.

## UX e Exportação de Dados

* **Controle de Persistência Visual:** Desenvolvimento de um *toggle switch* estilizado em CSS puro, entregando ao usuário a autonomia de gerenciar o ciclo de vida das marcações na tela durante a mudança de contexto.
* **Geração Client-Side de Relatórios:** Utilização da interface `Blob` e `URL.createObjectURL` para serializar os dados cacheados, convertendo-os em um arquivo `.json` local para download instantâneo, sem onerar o *backend*.
* **Feedback de Assincronicidade:** Proteção da interface do usuário com elementos visuais de carregamento (*Loaders*) durante o trânsito de dados de páginas massivas.
