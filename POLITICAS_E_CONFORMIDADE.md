# FitBodyStat - Políticas e Conformidade

## Finalidade

Este documento é um registro vivo de decisões, requisitos e pendências sobre
privacidade, proteção de dados, segurança e conformidade do FitBodyStat.

Ele orienta o desenvolvimento, mas não substitui parecer jurídico. Antes da
abertura pública ou comercialização, os documentos destinados aos usuários e os
processos internos deverão ser revisados por profissional qualificado, considerando
a LGPD, normas consumeristas e regras aplicáveis às categorias profissionais.

## Princípios adotados

- Privacidade e proteção de dados desde a concepção e por padrão.
- Coleta limitada ao necessário para cada finalidade informada.
- Transparência sobre uso, compartilhamento, retenção e eliminação.
- Acesso conforme função, vínculo, necessidade e autorização.
- Consentimentos específicos quando aplicáveis, sem autorizações genéricas.
- Separação entre dados pessoais, dados compartilhados e anotações profissionais.
- Segurança compatível com o tratamento de dados pessoais sensíveis.
- Revisão contínua sempre que o produto ou sua finalidade mudar.

## Classificação inicial dos dados

O FitBodyStat poderá tratar:

- dados cadastrais e de autenticação;
- dados de contato;
- peso, circunferencias corporais, dobras cutaneas, percentual de gordura e
  objetivos;
- atividades físicas e informações de evolução;
- ciclos de acompanhamento, suas linhas de base, objetivos, estados e encerramentos;
- vínculos entre usuários e profissionais;
- dados de agenda e atendimento;
- anotações e documentos profissionais futuros;
- dados técnicos de segurança, auditoria e uso.

Peso, medidas, evolução corporal e outras informações relacionadas à saúde devem
ser tratadas como dados pessoais sensíveis. Novas categorias deverão ser incluídas
neste inventário antes de sua implementação.

As leituras brutas de adipometro, o protocolo de calculo, a idade usada na
equacao e as circunferencias opcionais tambem sao dados pessoais sensiveis.
Devem seguir as mesmas regras de acesso, exportacao, retencao e eliminacao das
demais medicoes corporais.
Quando aplicavel, o inventario preserva separadamente as leituras dos lados
direito e esquerdo para permitir a avaliacao de assimetrias.

## Matriz de acesso

- Usuário: acessa e administra seus próprios dados.
- Profissional: acessa somente dados autorizados de pacientes com vínculo válido.
- Administrador: administra cadastros, funções, vínculos e operação, sem acesso
  rotineiro ao conteúdo pessoal ou de saúde.
- Sistema: executa apenas os processamentos necessários e documentados.

Cada novo recurso deverá indicar proprietário do dado, pessoas autorizadas,
finalidade do acesso e eventos que encerram a autorização.

Um usuário pode manter vários vínculos profissionais simultâneos. Cada vínculo
possui permissões e eventual benefício de acesso independentes. O profissional
que originou o cadastro pode ser registrado para atribuição, mas não se torna
proprietário da conta nem recebe exclusividade sobre os dados ou sobre o acesso.
O encerramento de um vínculo deve revogar somente suas permissões e concessões.

A criação da conta não implica consentimento para compartilhar dados de saúde.
Convites permanecem pendentes até uma ação afirmativa do usuário, com descrição
das permissões solicitadas. Telefone e demais dados de contato exigem escolha
separada, e a posse de um link de convite não substitui a correspondência com o
e-mail autenticado.

Os ciclos pertencem ao usuário. Profissionais vinculados somente poderão
consultá-los ou editá-los conforme as permissões vigentes do vínculo. Encerrar um
ciclo não implica eliminar suas medições; retenção, exportação e exclusão devem
preservar a relação entre o registro e seu ciclo.

O motivo de encerramento de um ciclo é opcional e pode conter informação pessoal.
Ele deve seguir as mesmas permissões, exportação, retenção e eliminação aplicadas
ao restante do acompanhamento, sem ser exposto em indicadores administrativos.

## Exclusão de registros

Registros relevantes, como medidas, atividades, metas e compromissos, deverão usar
exclusão recuperável antes da eliminação definitiva.

Modelo planejado:

```text
status: active | deleted
deletedAt: data e hora da exclusão
deletedBy: identificador de quem excluiu
restoreUntil: prazo máximo para restauração
```

Regras iniciais:

- consultas comuns exibem somente registros ativos;
- o titular pode restaurar registros durante o prazo informado;
- o prazo inicial sugerido de recuperação é de 30 dias;
- o administrador visualiza somente metadados necessários;
- ações excepcionais de suporte são auditadas;
- terminado o prazo, ocorre eliminação definitiva, salvo fundamento legal
  documentado para conservação.

Logs de auditoria não devem duplicar peso, medidas, observações ou outros dados
sensíveis.

## Encerramento da conta

O encerramento da conta será independente da exclusão comum de registros e deverá:

1. exigir autenticação recente;
2. apresentar consequências e solicitar confirmação explícita;
3. oferecer exportação prévia;
4. interromper acessos e revogar vínculos e consentimentos;
5. eliminar dados do Authentication, Firestore, subcoleções, Storage e referências;
6. registrar o processamento sem preservar conteúdo sensível desnecessário;
7. informar a conclusão ao titular;
8. identificar separadamente qualquer dado conservado por obrigação legal.

A exclusão deverá ser executada em backend confiável e contemplar cópias derivadas,
arquivos, índices, integrações e o ciclo de retenção de backups.

## Documentos públicos futuros

Antes da entrada de usuários externos em escala ou da venda de acesso, preparar e
validar:

- Aviso ou Política de Privacidade;
- Termos de Uso;
- Política de Cookies e tecnologias semelhantes, se aplicável;
- política de retenção e eliminação;
- informações sobre compartilhamentos e operadores;
- procedimento para exercício dos direitos do titular;
- regras de assinatura, cancelamento, reembolso e encerramento;
- termos específicos para profissionais e pacientes;
- consentimentos e avisos contextuais dentro do produto.

Os textos públicos deverão refletir o funcionamento real da versão publicada.

## Controles internos necessários

- Inventário de dados, finalidades e locais de armazenamento.
- Definição da hipótese legal de cada tratamento.
- Tabela de retenção por categoria de dado.
- Matriz de permissões e revisão periódica dos acessos.
- Trilhas de auditoria proporcionais e com prazo de retenção.
- Processo de resposta a solicitações de titulares.
- Processo de gestão e comunicação de incidentes.
- Gestão de fornecedores, operadores e integrações.
- Rotina de backup, restauração e eliminação.
- Registro de versões das políticas e dos consentimentos aceitos.
- Avaliação de impacto para tratamentos de maior risco, quando aplicável.

## Gatilhos de revisão

Este documento deverá ser revisado quando houver:

- nova categoria de dado;
- nova profissão ou tipo de usuário;
- novo compartilhamento ou integração;
- alteração de permissões;
- agenda compartilhada ou prontuário;
- pagamentos ou assinaturas;
- notificações, analytics ou publicidade;
- exportação, importação ou migração;
- mudança de hospedagem, domínio ou fornecedor;
- alteração nos processos de retenção e exclusão;
- incidente de segurança;
- mudança legal ou regulatória relevante.

## Pendências antes da operação comercial

- Designar responsáveis pelos papéis de controlador e operadores.
- Definir canal de privacidade e atendimento ao titular.
- Validar bases legais, consentimentos e prazos de retenção.
- Verificar regras dos conselhos e profissões atendidas.
- Avaliar obrigações consumeristas e contratuais.
- Revisar segurança do Firebase, backups, logs e integrações.
- Realizar revisão jurídica dos documentos públicos e fluxos reais do produto.

## Histórico de revisões

| Data | Versão | Alteração |
| --- | --- | --- |
| 26/07/2026 | 0.1 | Estrutura inicial, soft delete, encerramento de conta e governança contínua. |
