# FitBodyStat

Progressive Web App para acompanhamento de peso, medidas corporais, IMC, percentual de gordura e metas de composição corporal.

## Funcionalidades

- Registro de peso, cintura, pescoço, quadril e percentual de gordura.
- Cálculo de IMC e estimativa de gordura pelo método da Marinha dos EUA.
- Metas de perda ou ganho de peso, prazo e planejamento mensal.
- Gráficos de evolução real e planejada.
- Login por e-mail/senha ou Google, com vinculação dos dois métodos.
- Nome obrigatório e confirmação de e-mail em cadastros por senha.
- Recuperação de senha e central de métodos de acesso.
- Convites profissionais confirmados pelo paciente.
- Dashboard do paciente acessível somente ao profissional vinculado.
- Agenda profissional privada com visualizações diária, semanal e mensal.
- Compromissos, indisponibilidades, filtros, pacientes vinculados e pessoas avulsas.
- Horários recorrentes de atendimento com múltiplos períodos por dia.
- Compromissos exclusivos, coletivos ou informativos e indisponibilidades recorrentes.
- Consulta resumida dos compromissos antes da edição e indicação persistente dos filtros ativos.
- Estado atualizado diretamente no resumo do compromisso.
- Cores automáticas por estado e formulário de compromisso organizado por contexto.
- Locais de atendimento reutilizáveis cadastrados no perfil profissional.
- Inclusão, edição e exclusão confirmada dos locais em um fluxo independente.
- Ambientes profissional e pessoal separados, com preferência mantida por dispositivo.
- Cancelamento com histórico preservado e bloqueio opcional ou personalizado.
- Reabertura controlada com remoção opcional do bloqueio associado.
- Administração de cadastros, níveis, situação das contas, convites e vínculos.
- Pré-cadastro de profissionais por e-mail, sem envio de convite.
- Primeiro acesso orientado conforme o tipo de conta.
- Guia de medidas, metodologia, limitações e referências.
- Modo temporário de apresentação e privacidade do Dashboard.
- Ciclos de acompanhamento com projeto ativo, encerramento e histórico preservado.
- Cadastro básico separado da criação do projeto e convites profissionais compartilháveis.
- PWA instalável com cache offline básico.

## Perfis de acesso

- `user`: acessa e edita apenas os próprios dados, além de aceitar ou remover vínculos.
- `professional`: trabalha com pacientes e agenda no ambiente profissional e pode habilitar um ambiente pessoal separado.
- `admin`: administra cadastros e relações, sem acesso a dados corporais de terceiros.

Novas contas são criadas como `user`. O administrador pode pré-autorizar um e-mail profissional. No primeiro acesso verificado, uma transação atômica associa o `uid` e solicita a promoção para `professional`. As regras do Firestore conferem o e-mail, a verificação da conta e o pré-cadastro antes de aceitar a alteração.

## Estrutura no Firestore

```text
users/{uid}
users/{uid}/measurements/{measurementId}
profiles/{uid}
plans/{uid}
settings/{uid}
contacts/{uid}
professionalProfiles/{uid}
professionalRegistrations/{emailNormalizado}
users/{uid}/activities/{activityId}
careInvitations/{invitationId}
careLinks/{professionalId_patientId}
professionalAgendas/{professionalId}/events/{eventId}
professionalAgendas/{professionalId}/settings/availability
```

Perfil, planejamento, configurações e medições possuem regras independentes. Administradores não recebem permissão sobre esses dados quando pertencem a outro usuário.

## Executar localmente

```powershell
node dev-server.mjs
```

Abra `http://127.0.0.1:4173`.

## Publicar regras do Firestore

Publique o conteúdo de `firestore.rules` em **Firebase Console > Firestore Database > Regras**.

Com a Firebase CLI instalada:

```powershell
firebase deploy --only firestore:rules
```

## Preparar uma versão

A versão funcional, a build e a data da publicação ficam centralizadas em
`js/config/app-version.js`. Atualize os três valores com:

```powershell
node scripts/set-version.mjs 0.2.0-alpha.6 29
```

Ao iniciar outra fase, a revisão da fase pode reiniciar e a build deve continuar
crescendo. Exemplo: `0.1.0-beta.1`, build `35`.

## Tecnologias

- HTML5, CSS3 e JavaScript Vanilla com ES Modules
- Firebase Authentication e Cloud Firestore
- LocalStorage como cache local por usuário
- Service Worker e Web App Manifest
