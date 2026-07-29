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
Altura e referência corporal usadas nos cálculos também são preservadas no ciclo.
O ciclo pode ser encerrado como concluído, abandonado ou expirado. Um novo ciclo
só pode ser iniciado quando não houver outro ativo, e seus cálculos consideram
somente as medições associadas ao projeto atual.

No Perfil, projetos encerrados permanecem disponíveis para consulta detalhada.
A consulta reconstrói a linha de base do próprio ciclo, apresenta o resultado
final e filtra o histórico pelo `cycleId`, sem misturar medições de outros projetos.
O mesmo fluxo respeita as permissões do vínculo quando acessado por profissional.

A criação de projeto utiliza duas etapas temporárias: linha de base e objetivo.
Os dados não são persistidos entre as etapas; o ciclo ativo somente é criado
depois da confirmação final do planejamento.
Na linha de base, altura, peso e cintura são medições principais. A referência
corporal, o pescoço e o quadril são apresentados quando a origem da gordura
corporal utiliza estimativa por circunferências. A confirmação final permanece
depois da prévia e da tabela de planejamento mensal.

Cada ciclo tambem define as circunferencias opcionais que serao acompanhadas.
O catalogo central fica em `js/data/circumference-catalog.js`; os valores iniciais
ficam no ciclo e os posteriores em cada medicao. O formulario de registro e o
historico exibem somente as medidas selecionadas para aquele projeto, preservando
os campos legados de cintura, pescoco e quadril.
A cintura e obrigatoria em todos os projetos. As demais circunferencias sao
selecionadas conforme o objetivo e apresentadas em uma grade compacta.
Braco relaxado, braco contraido, antebraco, coxa e panturrilha possuem leituras
separadas para os lados direito e esquerdo. Valores numericos antigos continuam
sendo interpretados como leitura do lado direito.

Quando a origem da gordura corporal e adipometro, o componente
`js/components/skinfold-calculator.js` oferece o protocolo Jackson-Pollock de
tres dobras. Ele usa idade e sexo corporal, calcula a densidade e aplica a
conversao de Siri. O percentual calculado, o protocolo e as leituras em
milimetros sao armazenados com a linha de base ou medicao correspondente.
O modal calcula e apresenta a estimativa antes da confirmacao; somente a acao
`Usar valor` substitui o percentual de gordura no formulario principal.

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

A agenda profissional mantém compromissos e indisponibilidades em
`professionalAgendas/{professionalId}/events`. Séries semanais usam um documento
de origem; datas editadas ou removidas individualmente entram em
`recurrence.excludedDates`, e ocorrências alteradas são persistidas separadamente
com referência à série. Alterações futuras dividem a série sem reescrever seu
histórico anterior.
O perfil possui editores independentes para dados pessoais, linha de base,
objetivo e preferências de atividades.
No histórico de medidas, o lápis abre o formulário completo de registro com os
dados da medição selecionada. Durante essa edição, a aba de atividade permanece
bloqueada e as ações de exclusão e cancelamento ficam dentro do próprio
formulário, em paralelo ao fluxo de edição das atividades. As listagens preservam
o conteúdo completo em telas estreitas por meio de rolagem interna.

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

Na inicialização autenticada, o aplicativo mantém uma tela de carregamento até
concluir a leitura do estado necessário. O estado local é usado imediatamente
para aplicar o tema, mas o Dashboard só é exibido depois da reconciliação com o
Firestore. Leituras independentes são executadas em paralelo, atualizações
redundantes não são gravadas a cada acesso e a verificação do Service Worker é
adiada até o navegador ficar ocioso.

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
