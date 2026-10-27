# Changelog

## 0.11.0: Kombexa

- **Nova marca: Kombexa.** "Fight Manager" saiu da interface, dos e-mails, dos metadados, do PWA, da documentação e dos dados de exemplo. Nomes técnicos (banco `fight_manager`, cookie `fm_session`) foram mantidos para não quebrar instalações existentes. Logo provisória (monograma), com pasta `public/brand/` pronta para os arquivos oficiais.
- **Paleta e temas.** Tokens centralizados com a paleta Kombexa e cerca de 90 cores fixas trocadas por tokens. Tema **Claro / Escuro / Sistema** com preferência salva por aparelho e aplicada antes da pintura. Contraste AA: texto carvão sobre o laranja (5,6:1), laranja escurecido quando usado como texto.
- **Identidade visual por academia.** Upload, prévia, substituição e remoção da logo (Configurações → Identidade visual), com validação real no servidor (PNG, JPEG ou WebP pelo conteúdo; SVG recusado; até 1 MB). A logo vai para o PostgreSQL, com auditoria sem o conteúdo. Novos campos: razão social e responsável.
- **Documentos com a logo da academia:** ficha de matrícula / contrato e recibo, com o nome e as iniciais como alternativa quando não há logo. O Kombexa aparece só no rodapé, como sistema emissor.
- **Área do Aluno ampliada:** Frequência (com graduações), Comunicados, Documentos (a própria ficha e os recibos) e Carteirinha com QR Code. O início ganhou atalhos e comunicados recentes.
- **Comunicados** para os alunos, com nova permissão "Comunicados".
- **Graduações** no perfil do aluno (histórico de faixas/cordas/graus).
- **Presença pelo QR Code** do aluno (leitor ou digitação), sem duplicar e só para o dia.
- **Segurança:** a ficha aceitava `?saude=1` com a permissão "Alunos"; agora exige "Dados de saúde". A logo vazia é recusada no banco (restrição `academy_logos_not_empty`).
- **Migração 0011**, só aditiva; testada sobre um banco da 0.10.2 com dados.
- **Testes:** 43 novos (312 no total), incluindo guardas da Área do Aluno, isolamento de logo, documentos, comunicados, graduações e QR. Os de isolamento foram conferidos por mutação.
- **Seed:** senha das contas de exemplo agora é `kombexa123`; plataforma em `plataforma@kombexa.dev`.

## 0.10.2

- **Teste instável corrigido.** O de recuperação de senha preenchia o formulário de login quando o servidor estava lento (as duas telas têm `#email`); agora espera a página nova.
- **Testes por assunto.** Os arquivos `v08` a `v10b` viraram `lib`, `equipe`, `area-do-aluno` e `automacao-e-presenca`, e os antigos ganharam nomes em português. Saíram dois testes fracos de fuso que só rodavam perto da meia-noite (o fuso continua testado em `lib.test.ts`).
- **Permissões testadas.** `tests/guardas.test.ts` lê o código e confere a guarda de toda tela, action e rota da academia (uma rota nova sem guarda quebra o teste). `tests/e2e/permissoes.spec.ts` confere no navegador o menu, os endereços bloqueados, a aba de saúde, a exportação e a mudança de acesso valendo na hora.
- **CSS organizado.** O `globals.css` de 950 linhas virou 9 arquivos por área em `app/styles/`, e 42 regras repetidas foram unidas. Comparação pixel a pixel de 104 prints (claro e escuro, celular e computador) antes e depois.
- **Layout no celular.** Tabelas viram cartões em duas colunas (metade da altura), a ação principal do cabeçalho ocupa a linha toda e as outras dividem a de baixo. Referências aparecem como "set/2026" em vez de "2026-09", e mensalidade paga mostra "–" em aberto.
- Depois de salvar o acesso de alguém da equipe, o formulário fecha sozinho.

## 0.10.0

- **Tarefa diária** (`POST /api/tarefas/diarias` com `CRON_SECRET`, ou `npm run jobs:daily`): gera as mensalidades do mês sozinha (mensalidade cancelada não volta) e manda por e-mail o lembrete X dias antes do vencimento e o aviso no dia seguinte, com Pix copia e cola. Cada aviso sai uma vez só (`fee_reminders`). Configurável por academia em Configurações › Academia › Automação. No Docker Compose, o serviço `scheduler` chama a tarefa de hora em hora.
- **Presença:** a equipe marca quem treinou (um toque por aluno), navega pelos dias e vê a lista de "sumidos há 14 dias" com atalho para o WhatsApp. Frequência dos últimos 30 dias no perfil do aluno e na área do aluno. Nova permissão "Presença".
- **Área do responsável:** no perfil do aluno, "Dar acesso" ao responsável com e-mail cria a conta e envia o link para criar a senha. O responsável vê situação, Pix, histórico e recibos de cada dependente. A academia pode remover o acesso.
- **Relatórios:** recebido × esperado por mês (gráfico e tabela), taxa de recebimento, atraso, alunos novos, recebimentos por modalidade e por forma de pagamento, em 3, 6 ou 12 meses (permissão Financeiro).
- **PWA:** manifesto, ícones e atalhos; dá para instalar o sistema na tela inicial do celular.
- Teste de ponta a ponta do pagamento parcial não depende mais do dia do mês.
- Contas de teste: `responsavel@academia.dev`. 15 testes novos.

## 0.9.0

- **Equipe com permissões:** quem tem acesso total adiciona pessoas à equipe e escolhe, área por área, o que cada uma pode fazer (alunos, saúde, mensalidades, pagamentos, financeiro, solicitações, configurações, auditoria). O menu, a barra do celular e os botões se ajustam; páginas e ações conferem a permissão no servidor. Toda mudança de acesso vai para a auditoria.
- **Pix copia e cola:** a academia cadastra a chave Pix e o aluno vê o QR Code e o código com o valor da próxima mensalidade (padrão BR Code do Banco Central, sem integração).
- **Fuso horário por academia** (RNF16): Brasília, Amazonas, Acre ou Noronha; decide quando uma mensalidade fica atrasada.
- **Confirmação de e-mail** nas contas criadas pelo aluno: link de 48 horas, aviso com reenvio na área do aluno e selo "confirmado / não confirmado" nas solicitações.
- **Segurança e operação:** cabeçalhos de segurança (CSP, X-Frame-Options, HSTS em produção, Referrer-Policy, Permissions-Policy), exportações CSV registradas na auditoria, log de erros em JSON com aviso opcional por webhook, `GET /api/saude` para monitor de disponibilidade e backup diário do banco (serviço `backup` no Docker Compose, ver docs/instalacao.md).
- Conta de teste nova: `recepcao@academia.dev` (acesso personalizado).
- 13 testes novos (Pix, chave Pix, permissões, fuso, confirmação de e-mail).

## 0.8.0

- Plataforma: suspender e reativar academias pela tela (com confirmação, auditoria e encerramento das sessões), pesquisa, filtro por situação e indicador de academias sem administrador.
- Academia: exportação em CSV das mensalidades e do financeiro, respeitando os filtros; menu da conta no avatar do celular; botões "Receber" nas listas; "Caixa do mês" no Início; avisos lado a lado no celular.
- Aluno: situação e próximo pagamento num bloco só, contato da academia (WhatsApp e telefone), histórico unificado com recibos e a página "Minha conta" (telefone e troca de senha).
- Visual: tema escuro automático (ficha e recibo continuam claros), cores fixas trocadas por tokens e menos estilos inline.
- 6 testes novos (CSV, suspensão, telefone do aluno, contato da academia).

## 0.7.0 (contas, e-mail e novo visual)

### Adicionado
- **Criar conta de aluno sem convite** (`/criar-conta`): a conta nasce sem academia, com telefone, nascimento e consentimento guardados na conta. A área do aluno mostra o e-mail da conta e explica como ser adicionado. Quem tem o código do convite pode digitá-lo ou colar o link.
- **Academia adiciona aluno que já tem conta** (Solicitações → "Adicionar aluno que já tem conta"), só pelo e-mail exato. Vira um pedido na mesma fila do convite: aprovar completando modalidade e mensalidade, ou vincular a um cadastro existente (sugerido quando o e-mail bate).
- **Plataforma cria academias** pela interface: nome da academia, nome e e-mail do responsável. O responsável recebe um link de acesso (72 horas, uso único) para criar a senha; a tela mostra o link para copiar se o e-mail não estiver configurado. Botão "Novo link de acesso" por academia. Cadastro público de academias não existe.
- **Convite por e-mail** em "Convidar alunos".
- **Envio por SMTP** (Gmail, Outlook, Hostinger, Locaweb, Brevo, SES...), além do Resend. E-mails em texto e HTML. `EMAIL_PROVIDER` escolhe a forma de envio. Comando `npm run email:test -- destino@email.com`. Guia completo em `docs/instalacao.md`.
- **Contas de teste para todos os tipos de usuário** no seed (plataforma, academia, aluno aprovado, aluno aguardando aprovação e aluno sem academia), mostradas na tela de login em desenvolvimento ou com `SHOW_TEST_ACCOUNTS=true`, com preenchimento em um clique. Rodar o seed num banco antigo só acrescenta as contas que faltam.
- **Início:** barra de arrecadação das mensalidades do mês (recebido de quanto era esperado).
- Campo de senha com "Mostrar/Ocultar".
- Migration `0007_conta_sem_academia` (telefone, nascimento e consentimento na conta).
- 10 testes automatizados (92 no total) e 3 de ponta a ponta (13 no total).

### Alterado
- **Novo visual:** telas de entrada com o painel das cordas do ringue; títulos e números em Barlow Condensed (auto-hospedada); menu lateral com ícones, grupos e avatar; cabeçalho próprio na área do aluno e na plataforma; foco, campos, tabelas e alertas revisados.
- Link "Criar conta" no login, no esqueci a senha, na nova senha e no convite; "Esqueci minha senha" ao lado do campo de senha.
- Início mais rápido: as consultas do painel rodam em paralelo.
- A exportação de dados do aluno inclui os dados e o consentimento da conta; a eliminação também apaga telefone e nascimento da conta.

### Corrigido
- `npm run db:migrate`, `db:seed` e `db:create-admin` fora do Docker não liam o `.env` ("DATABASE_URL não configurada"), então o passo a passo do README não funcionava sem Docker.
- Teste de "menor de 18 anos" falhava nos dias 28 a 31 de cada mês (conta de data errada no próprio teste).
- O README dizia que não havia recuperação de senha por e-mail.

## 0.6.0 (recuperação de senha, recibo e LGPD)

### Adicionado
- Recuperação de senha por e-mail: link de uso único, válido por 30 minutos, guardado como hash; resposta igual exista ou não a conta; limite de pedidos; sessões encerradas ao redefinir.
- Envio de e-mails atrás de uma interface: Resend (real, por HTTP, ativado pela chave), desenvolvimento (console e arquivos) e memória (testes).
- Recibo de pagamento para imprimir ou salvar em PDF, com valor por extenso, responsável como pagador para menores, envio do resumo pelo WhatsApp e marca de cancelado. O aluno vê os próprios recibos.
- Exportação dos dados do aluno em JSON (pelo administrador e pelo próprio aluno).
- Eliminação dos dados pessoais a pedido do titular, com o financeiro mantido de forma anônima, inclusive na auditoria.
- 9 testes automatizados (82 no total) e 3 de ponta a ponta (10 no total).

## 0.5.0 (revisão de requisitos)

### Corrigido
- **Totais das listas:** "N pagamentos, R$ X recebidos" e o saldo em aberto das mensalidades somavam só as linhas exibidas (até 200). Agora são calculados no banco sobre o filtro inteiro.
- **Consentimento do convite:** passa a ser registrado com data e o texto exato aceito. Entrar em outra academia com a mesma conta também exige consentimento.
- **Sessões:** trocar a senha encerra as sessões em outros aparelhos; desativar um administrador o desconecta na hora.
- **E-mail repetido em cadastros simultâneos:** mensagem "já existe uma conta" em vez de um erro genérico.
- **Lint:** quatro atualizações de estado dentro de efeitos do React reescritas no padrão recomendado.
- **Valor sugerido no registro de pagamento:** ao trocar de aluno com a tela aberta, o campo de valor podia não mostrar o novo saldo.
- **Dados de exemplo determinísticos:** o seed escolhia quem ficava em dia pela ordem dos IDs (aleatórios); agora a ordem é pelo nome, e o exemplo sai sempre igual.

### Adicionado
- Paginação (50 por página) em alunos, mensalidades, pagamentos, financeiro e auditoria.
- Testes de concorrência provando os locks (9 testes novos, 73 no total).
- Testes de ponta a ponta com Playwright no projeto (7).
- Lint (ESLint com as regras do Next.js) e integração contínua no GitHub Actions.
- `docs/produto.md`: requisitos funcionais e não funcionais numerados, com o estado de cada um.

### Alterado
- TypeScript fixado na 6.0 (o 7 ainda não é suportado pelo lint do Next.js).

## 0.4.0 (cadastro completo e configuração da academia)

### Adicionado
- Configurações em abas: dados da academia (com CPF/CNPJ validado), modalidades com valor sugerido (criar, editar, desativar), termos da ficha de matrícula e acesso.
- Primeira utilização: o Início mostra o que falta configurar e some quando está completo.
- Cadastro do aluno em seções, com CPF (dígitos conferidos), endereço, contato de emergência e autorização de uso de imagem.
- Responsáveis legais: obrigatórios para menores de 18 anos, compartilháveis entre irmãos, com responsável principal (contato de cobrança e assinatura da ficha).
- Ficha de matrícula para imprimir ou salvar em PDF, com os termos da academia, e registro de ficha assinada.
- Seção restrita de saúde, com consentimento.
- Busca de alunos também pelo CPF e pelo nome ou telefone do responsável.
- 11 testes novos (64 no total).

### Alterado
- Modalidade do aluno passa a ser escolhida entre as modalidades da academia (as sugestões fixas no código foram removidas). Migração automática dos dados existentes.
- Data de nascimento obrigatória no cadastro. O Início avisa quantos alunos ativos estão sem ela.
- Perfil do aluno: ações secundárias no menu "Mais ações"; nova aba Saúde.
- Cobrança pelo WhatsApp vai para o responsável principal, quando houver.

### Corrigido
- Depois de um erro de validação, os campos de seleção voltavam ao valor inicial. No registro de pagamento, "Aguardando confirmação" podia virar "Pago" sem aviso. Corrigido em todos os formulários e filtros.

## 0.3.0 (usabilidade)

### Alterado
- Escolha do aluno por busca (nome, telefone ou e-mail) no registro de pagamento e na nova mensalidade, com modalidade, contato e atrasos para diferenciar homônimos. Substitui a lista com todos os alunos.
- Confirmações em janela própria (com contexto: valor, aluno, consequência) no lugar das confirmações do navegador.
- Situação das mensalidades padronizada: A vencer, Atrasada, Paga, Cancelada. Pagamento pendente passa a se chamar "Aguardando confirmação". "Registrar pagamento" é o único nome da ação.
- Início reorganizado: atrasadas, solicitações e a vencer em destaque; resumo do mês depois.
- Campo de valor com "R$" fixo, teclado numérico e formatação ao sair do campo (a conversão para centavos continua no servidor).
- Área do aluno reorganizada: "Estou em dia?" e "Próximo pagamento" no topo; dados pessoais recolhidos no fim.
- Identidade: fonte Manrope, símbolo próprio, login e convite com a marca; carregamento no formato de cada tela.

### Adicionado
- Barra de navegação inferior no celular (Início, Alunos, Registrar pagamento, Mensalidades, Mais).
- Filtros recolhíveis no celular, com contador de filtros ativos.
- Link "Cobrar pelo WhatsApp" (wa.me) no perfil e nas pendências, com mensagem pronta.

### Corrigido
- A nova mensalidade sugeria o vencimento do mês atual mesmo depois do dia já ter passado, e a mensalidade nascia atrasada. Agora sugere o próximo vencimento (teste novo, 53 no total).

## 0.2.0 (entrada de alunos por convite)

### Adicionado
- Convite da academia com código aleatório e QR Code (copiar link, enviar pelo WhatsApp, imprimir cartaz, gerar novo código revogando o anterior).
- Página pública `/convite/{token}` com cadastro da conta do aluno (maiores de 18 anos) e pedido de entrada.
- Separação entre conta (`users`) e vínculo com a academia (`students.user_id`); status `pending`, `rejected` e `suspended` (reservado).
- Solicitações de entrada: aprovar completando os dados da academia, vincular a um aluno já cadastrado (sugerido por e-mail ou telefone) ou recusar com motivo.
- Área do aluno (`/aluno`), somente leitura: cadastro, mensalidades e pagamentos próprios; avisos de pedido em análise ou recusado.
- Estrutura para convites com validade, limite de usos e rótulo, ainda sem tela.
- 12 testes novos (51 no total).

### Ajustado
- Pedido recusado passa a ser marcado como vínculo encerrado (`closed_at`) e deixa de bloquear um novo pedido da mesma pessoa no futuro, preservando o histórico (migration `0002_vinculo_encerrado`). Teste novo (52 no total).

## 0.1.0 (MVP)

### Adicionado
- Login de administradores com senha bcrypt, sessões no banco e limite de tentativas.
- Estrutura multi-academia com isolamento por `academy_id` em todos os serviços.
- Perfis `ACADEMY_ADMIN` (completo), `PLATFORM_ADMIN` (lista agregada de academias) e `STUDENT` (apenas no modelo).
- Dashboard com indicadores do mês, pendências e atalhos.
- Alunos: cadastro, edição, pesquisa por nome, telefone ou e-mail, filtro, ativação e inativação, valor mensal e dia de vencimento.
- Perfil do aluno com situação financeira e abas de informações, mensalidades, pagamentos e histórico.
- Mensalidades: criação, edição e cancelamento (bloqueados após pagamento), geração do mês para alunos ativos, atraso calculado no fuso de Brasília.
- Pagamentos: vinculados ou avulsos, parciais, pendentes com confirmação, cancelamento com motivo.
- Financeiro: entradas automáticas por pagamento, lançamentos manuais, totais e saldo do período.
- Auditoria das ações importantes, consultável no menu e no perfil do aluno.
- Configurações: troca de senha e gestão de administradores da academia.
- Documentação dentro da aplicação e em `/docs`.
- 39 testes automatizados contra PostgreSQL real.
- Dockerfile e docker-compose.

### Corrigido durante o desenvolvimento
- Subconsultas de totais (saldo em aberto do aluno, atrasos na lista, dashboard e contagens da plataforma) que contavam errado por referência ambígua de coluna. Coberto por teste de regressão.
- Fim do mês fixo no dia 31, que quebrava a consulta em meses de 30 dias.
- E-mail apagado do formulário de login após uma senha errada.
