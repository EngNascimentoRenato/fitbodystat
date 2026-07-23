# FitBodyStat

Progressive Web App para acompanhamento de peso, medidas corporais, IMC, percentual de gordura e metas de composição corporal.

## Funcionalidades

- Registro de peso, cintura, pescoço, quadril e percentual de gordura.
- Cálculo de IMC e estimativa de gordura pelo método da Marinha dos EUA.
- Metas de perda ou ganho de peso, prazo e planejamento mensal.
- Gráficos de evolução real e planejada.
- Login por e-mail/senha ou Google.
- Perfis de acesso para usuário, profissional e administrador.
- Convites de acompanhamento com aceite do paciente.
- Dashboard do paciente acessível ao profissional vinculado.
- PWA instalável com cache offline básico.

## Perfis de acesso

- `user`: acessa e edita apenas os próprios dados, além de aceitar ou remover vínculos.
- `professional`: convida pacientes por e-mail e acessa os dados dos vínculos ativos.
- `admin`: gerencia contas, vínculos e pode abrir qualquer acompanhamento.

Novas contas são sempre criadas como `user`. A promoção para `professional` ou `admin` é feita por um administrador.

## Estrutura no Firestore

```text
users/{uid}
users/{uid}/measurements/{measurementId}
profiles/{uid}
plans/{uid}
settings/{uid}
careInvitations/{invitationId}
careLinks/{professionalId_patientId}
```

Os arquivos corporais são separados por entidade para evitar que uma atualização substitua todo o histórico do usuário.

## Executar localmente

```powershell
node dev-server.mjs
```

Abra `http://127.0.0.1:4173`.

## Publicar regras do Firestore

Copie o conteúdo de `firestore.rules` para **Firebase Console > Firestore Database > Regras** e clique em **Publicar**.

Com a Firebase CLI instalada, também é possível executar:

```powershell
firebase deploy --only firestore:rules
```

## Tecnologias

- HTML5, CSS3 e JavaScript Vanilla com ES Modules
- Firebase Authentication e Cloud Firestore
- LocalStorage como cache local por usuário
- Service Worker e Web App Manifest
