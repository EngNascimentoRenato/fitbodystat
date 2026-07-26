# Estrutura do FitBodyStat

Este documento registra a organizacao tecnica atual do projeto e separa os
arquivos publicados dos recursos usados apenas no desenvolvimento.

## Aplicacao publicada

```text
index.html                 Aplicacao principal apos a autenticacao
login.html                 Entrada, cadastro e recuperacao de acesso
404.html                   Pagina usada quando uma rota nao e encontrada
manifest.webmanifest       Metadados de instalacao do PWA
service-worker.js          Cache offline e atualizacao do PWA
assets/                    Icones e demais arquivos visuais
css/                       Estilos globais e estilos de cada area
js/                        Codigo da aplicacao
```

Somente esses arquivos e diretorios fazem parte do site publicado. O arquivo
`js/config/firebase-config.js` tambem e enviado ao navegador por ser a
configuracao publica do aplicativo web Firebase. A seguranca dos dados depende
das regras do Firestore, da autenticacao e das restricoes da chave no Google
Cloud, nao do sigilo desse arquivo.

## Organizacao do JavaScript

```text
js/app.js                  Inicializacao da aplicacao autenticada
js/login.js                Fluxos da pagina de acesso
js/router.js               Navegacao entre as telas
js/menu.js                 Menu lateral e troca de ambiente
js/config/                 Firebase, versao e configuracoes globais
js/services/               Auth, Firestore e operacoes de cada dominio
js/data/                   Armazenamento, catalogos e dados auxiliares
js/models/                 Calculos e regras de negocio
js/views/                  Telas e fluxos completos
js/components/             Componentes visuais reutilizaveis
js/utils/                  Funcoes utilitarias compartilhadas
```

O estado pessoal também mantém ciclos de acompanhamento. A coleção
`users/{userId}/cycles` armazena linha de base, objetivo e planejamento de cada
projeto. Durante a transição, o ciclo ativo continua projetado no perfil para
compatibilidade com as telas existentes, e cada medição recebe um `cycleId`.
O ciclo pode ser encerrado como concluído, abandonado ou expirado. Um novo ciclo
só pode ser iniciado quando não houver outro ativo, e seus cálculos consideram
somente as medições associadas ao projeto atual.

Convites e vínculos permanecem entidades separadas. `originInvitationId` registra
a origem do relacionamento, enquanto `accessBenefit` pertence a cada documento
de vínculo. O direito de acesso futuro deverá considerar o conjunto de vínculos
ativos e assinaturas, sem depender de um único profissional.

O primeiro acesso do usuário cria apenas o perfil básico. A ausência de ciclo
ativo é um estado válido: o Dashboard apresenta próximos passos, e o projeto pode
ser criado posteriormente pelo usuário ou por profissional vinculado e autorizado.
Nesse estado, a apresentação considera o contexto: o usuário vê a quantidade de
profissionais vinculados e suas ações pessoais; o profissional que abriu um
paciente vê somente ações operacionais relacionadas à criação do projeto.
Atividades físicas podem ser registradas sem projeto; peso e medidas corporais
exigem um ciclo ativo para preservar a linha de base e o contexto histórico.
O perfil possui editores independentes para dados pessoais, linha de base,
objetivo e preferências de atividades.

Links de convite usam apenas o identificador aleatório do documento. Antes da
autenticação, a página informa genericamente que existe um convite profissional,
sem revelar dados do profissional ou do destinatário. O vínculo somente é criado
após autenticação, verificação do e-mail e aceite expresso do paciente.

## Estilos

```text
css/theme.css              Cores, tipografia e variaveis visuais
css/base.css               Normalizacao e estilos fundamentais
css/layout.css             Estrutura responsiva e navegacao
css/components.css         Componentes compartilhados
css/forms.css              Formularios e controles
css/charts.css             Graficos e indicadores
css/dashboard.css          Dashboard
css/activities.css         Atividades fisicas
css/agenda.css             Agenda profissional
```

## Desenvolvimento e infraestrutura

```text
firebase.json              Firestore e configuracao do Firebase Hosting
.firebaserc                Projeto Firebase selecionado
firestore.rules            Regras de acesso ao banco
dev-server.mjs             Servidor local de desenvolvimento
scripts/                   Ferramentas de manutencao e versionamento
tests/                     Testes automatizados
README.md                  Visao geral e instrucoes do projeto
direcionamentos.txt        Planejamento privado, ignorado pelo Git
functions/                 Reservado para futuras Cloud Functions
```

O diretorio `functions/node_modules/` contem dependencias instaladas localmente.
Ele nao faz parte do codigo do site, nao deve entrar em backup do projeto nem ser
enviado ao Git ou ao Hosting. O diretorio `.firebase/` e apenas cache local das
ferramentas de publicacao e tambem pode ser recriado.

## Publicacao

O Firebase Hosting usa a raiz como diretorio publico para manter os mesmos
caminhos usados pelo GitHub Pages. A lista `hosting.ignore` de `firebase.json`
impede a publicacao de testes, scripts, documentos internos, regras e
dependencias.

```powershell
firebase deploy --only hosting --project fitbodystats
```

As regras do banco sao publicadas separadamente:

```powershell
firebase deploy --only firestore:rules --project fitbodystats
```

Antes de cada versao, atualize `js/config/app-version.js` pelo script de
versionamento e valide o funcionamento local, a instalacao do PWA e a troca
automatica de versao.
