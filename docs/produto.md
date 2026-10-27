# Produto: requisitos e roadmap

O que o sistema precisa fazer (requisitos funcionais e não funcionais) e o que vem depois.

- [Requisitos do Kombexa](#requisitos-do-kombexa)
- [Roadmap](#roadmap)

## Requisitos do Kombexa

Estado de cada requisito na versão 0.11.0 (as novidades desta versão estão em [changelog.md](changelog.md)). **Implementado** significa funcionando e coberto por testes automatizados; **Parcial**, que existe mas com limitação descrita; **Planejado**, que ainda não existe (ver a seção Roadmap abaixo).

### Requisitos funcionais

#### Acesso e academias

| ID | Requisito | Estado |
| --- | --- | --- |
| RF01 | Entrar com e-mail e senha; sair | Implementado |
| RF02 | Perfis ACADEMY_ADMIN, PLATFORM_ADMIN e STUDENT, cada um com as próprias telas | Implementado |
| RF03 | Cada academia acessa somente os próprios dados | Implementado |
| RF04 | Trocar a própria senha | Implementado |
| RF05 | Recuperar a senha esquecida por e-mail | Implementado (envio real por SMTP ou Resend ao configurar; em desenvolvimento, o e-mail aparece no console; ver docs/instalacao.md) |
| RF06 | Criar e desativar administradores da academia | Implementado |
| RF07 | Configurar dados da academia (nome, CPF/CNPJ, contato, endereço) | Implementado |
| RF08 | Configurar as modalidades oferecidas, com valor sugerido | Implementado |
| RF09 | Guiar a configuração na primeira utilização | Implementado |
| RF10 | Criar e suspender academias pela interface da plataforma | Implementado (criar com link de acesso na v0.7; suspender e reativar na v0.8) |

#### Alunos e responsáveis

| ID | Requisito | Estado |
| --- | --- | --- |
| RF11 | Cadastrar e editar alunos, com matrícula, contato de emergência, uso de imagem e endereço | Implementado |
| RF12 | Pesquisar por nome, telefone, e-mail, CPF ou pelo nome e telefone do responsável | Implementado |
| RF13 | Filtrar por status; ativar e inativar sem perder o histórico | Implementado |
| RF14 | Exigir responsável legal principal para menores de 18 anos | Implementado |
| RF15 | Compartilhar o mesmo responsável entre irmãos | Implementado |
| RF16 | Registrar observações de saúde com consentimento | Implementado |
| RF17 | Imprimir a ficha de matrícula com os termos da academia e registrar a assinatura | Implementado |
| RF18 | Trancar a matrícula por um período (viagem, lesão) | Planejado (status `suspended` reservado) |
| RF19 | Atender pedidos de exportação e eliminação de dados (LGPD) | Implementado (exportação em JSON pelo administrador e pelo aluno; eliminação com o financeiro mantido anônimo) |

#### Convite e área do aluno

| ID | Requisito | Estado |
| --- | --- | --- |
| RF20 | Gerar código e QR Code de convite; revogar e gerar novo | Implementado |
| RF21 | Cadastro pelo convite (maiores de 18), com consentimento registrado | Implementado |
| RF22 | Aprovar, recusar ou vincular o pedido a um aluno existente | Implementado |
| RF23 | Área do aluno somente leitura: situação, próximo pagamento, mensalidades e pagamentos | Implementado |
| RF24 | Convite para responsáveis e área do responsável com os dependentes | Implementado (v0.10: a academia dá acesso ao responsável, que vê os dependentes) |

#### Mensalidades, pagamentos e financeiro

| ID | Requisito | Estado |
| --- | --- | --- |
| RF25 | Criar, editar e cancelar mensalidades (edição bloqueada após pagamento) | Implementado |
| RF26 | Gerar as mensalidades do mês para todos os ativos, sem duplicar | Implementado |
| RF27 | Identificar atraso pelo vencimento, sem alteração manual | Implementado |
| RF28 | Registrar pagamento vinculado ou avulso, inclusive parcial | Implementado |
| RF29 | Pagamento aguardando confirmação, que só entra no caixa ao ser confirmado | Implementado |
| RF30 | Cancelar pagamento com motivo, devolvendo a mensalidade para em aberto | Implementado |
| RF31 | Entrada automática no financeiro para cada pagamento, sem contagem dupla | Implementado |
| RF32 | Lançar despesas, matrículas e outros recebimentos | Implementado |
| RF33 | Totais do período (entradas, saídas, saldo) | Implementado |
| RF34 | Cobrar pelo WhatsApp com mensagem pronta (para o responsável, quando houver) | Implementado |
| RF35 | Recibo de pagamento | Implementado (impressão, PDF, valor por extenso, envio pelo WhatsApp; aluno vê os próprios) |
| RF36 | Reajuste de mensalidades em lote | Planejado |
| RF37 | Primeira mensalidade proporcional | Planejado |
| RF38 | Relatório de inadimplência e exportação em CSV | Implementado (CSV na v0.8, relatórios na v0.10) |

#### Auditoria

| ID | Requisito | Estado |
| --- | --- | --- |
| RF39 | Registrar quem fez cada ação financeira e de cadastro, quando e em qual academia | Implementado |
| RF40 | Consultar a auditoria da academia e o histórico de cada aluno | Implementado |

### Requisitos não funcionais

| ID | Categoria | Requisito | Estado |
| --- | --- | --- | --- |
| RNF01 | Segurança | Senhas com bcrypt; sessões guardadas como hash; cookie httpOnly, SameSite e Secure | Implementado |
| RNF02 | Segurança | Limite de tentativas de login e de cadastros pelo convite | Parcial (contagem por instância do servidor) |
| RNF03 | Segurança | Trocar a senha encerra as outras sessões; desativar encerra todas | Implementado |
| RNF04 | Segurança | Cabeçalhos de segurança (CSP, HSTS, proteção contra enquadramento) | Implementado (v0.9) |
| RNF05 | Segurança | Validação de todos os dados no servidor | Implementado |
| RNF06 | Privacidade | Menor privilégio: a plataforma não vê dados de alunos | Implementado |
| RNF07 | Privacidade | Saúde lida só na seção restrita; auditoria sem o conteúdo | Implementado |
| RNF08 | Privacidade | Consentimento registrado com data e texto aceito | Implementado |
| RNF09 | Privacidade | Política de privacidade e regras de retenção | Planejado |
| RNF10 | Integridade | Dinheiro em centavos inteiros, nunca em ponto flutuante | Implementado |
| RNF11 | Integridade | Operações que gravam em mais de um lugar são atômicas (transações) | Implementado |
| RNF12 | Integridade | Regras críticas garantidas também pelo banco (chaves, unicidade, CHECK) | Implementado |
| RNF13 | Concorrência | Operações simultâneas não passam do saldo, do limite do convite nem aprovam duas vezes | Implementado (provado por testes de concorrência) |
| RNF14 | Corretude | Totais das listas calculados sobre o filtro inteiro, no banco | Implementado |
| RNF15 | Desempenho | Índices nas buscas; listas paginadas (50 por página) | Implementado |
| RNF16 | Tempo | Datas de negócio no fuso da academia | Implementado (v0.9: fuso escolhido por academia) |
| RNF17 | Usabilidade | Mobile first: barra inferior, filtros recolhíveis, tabelas em cartões | Implementado |
| RNF18 | Usabilidade | Confirmações próprias com contexto; mensagens em português | Implementado |
| RNF19 | Acessibilidade | Rótulos, teclado e janelas acessíveis | Parcial (sem revisão com leitor de tela) |
| RNF20 | Confiabilidade | Migrations testadas num banco novo e num existente | Implementado |
| RNF21 | Confiabilidade | Backups automáticos e monitoramento | Implementado (v0.9: backup diário, log de erros, /api/saude) |
| RNF22 | Manutenibilidade | Camadas separadas, tipos, lint e documentação | Implementado |
| RNF23 | Testabilidade | Testes automatizados contra PostgreSQL real e testes de ponta a ponta no navegador | Implementado |
| RNF24 | Integração contínua | Tipos, lint, testes, build e ponta a ponta a cada commit | Implementado (GitHub Actions) |
| RNF25 | Implantação | Execução com Docker | Parcial (Compose com banco, app, agendador e backup; não testado em servidor real) |

## Roadmap

Itens **não implementados**, em ordem sugerida. Nada aqui existe no sistema hoje.

### Antes do uso real
- Hospedagem com HTTPS e cópia dos backups para fora do servidor (ver docs/instalacao.md).

### Próximos passos (curto prazo)
- Status HTTP 404 correto nas páginas de registro não encontrado.

### Academia
- Turmas com horário e agenda na Área do Aluno, em cima da presença que já existe. (O QR Code pessoal de presença, lido pela recepção, entrou na 0.11.)
- Leitura do QR pela câmera do aparelho da recepção (hoje: leitor USB/Bluetooth ou digitação; a política de segurança bloqueia a câmera).
- Armazenamento de objetos (S3/R2) para as logos, como alternativa ao PostgreSQL.
- Lembretes pelo WhatsApp (exige a API oficial do WhatsApp Business; hoje o lembrete automático é por e-mail).
- Modelos de acesso prontos para a equipe (ex.: "Recepção", "Professor") sobre as permissões que já existem.
- Assinatura digital do contrato (o contrato com a logo da academia existe desde a 0.11; a assinatura continua no papel).
- Planos com valores por modalidade e descontos.

### Próxima entrega (B)
- Convite para responsáveis: "Sou responsável por um aluno menor", com cadastro da conta do responsável, dos dados da criança e do consentimento.

### Academia
- Turmas: dias da semana, horários, professor e turma infantil (decidido deixar para quando houver controle de presença).

### Convites (a estrutura já existe; faltam as telas)
- Convites com validade e limite de usos definidos pelo administrador.
- Convites individuais (para uma pessoa). O envio do convite geral por e-mail já existe (v0.7).
- Convites por turma ou modalidade, já preenchendo a modalidade na aprovação.
- Histórico de convites e contagem de cadastros por convite.

### Aluno
- Novo pedido de entrada depois de uma recusa (a estrutura já permite; falta a tela).
- Confirmação de e-mail no cadastro pelo convite.

### Plataforma (SaaS)
- Planos de cobrança por academia (cadastro, suspensão e reativação já existem no painel).
- Planos, assinaturas e cobrança das academias.
- Acesso de suporte com liberação por academia e auditoria.
- Auditoria da plataforma e logs técnicos.
- Recorrência automática e integrações de pagamento (Pix, cartão).
