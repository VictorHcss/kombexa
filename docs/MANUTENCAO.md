# Manutenção

## 1. Rotina antes de qualquer entrega

É exatamente o que o CI (`.github/workflows/ci.yml`) roda a cada push. Rode localmente na mesma ordem:

```bash
npm run typecheck   # erros de tipo
npm run lint        # padrões de código
npm test            # 317 testes com banco real (apaga e recria TEST_DATABASE_URL)
npm run build       # build de produção
npm run test:e2e    # navegador (exige o build; apaga e recria E2E_DATABASE_URL)
```

Na auditoria, os quatro primeiros passaram sem nenhum erro. O E2E teve 19 de 21 testes passando diretamente; os 2 restantes foram verificados em versão sequencial (detalhes em `relatorios/RESULTADO_DOS_TESTES.md`).

## 2. Atualização de dependências

### Rotina segura (mensal)

```bash
npm outdated          # o que tem versão nova
npm audit             # falhas de segurança conhecidas
npm audit fix         # corrige DENTRO das faixas do package.json (seguro)
npm run typecheck && npm run lint && npm test && npm run build
```

**Nunca use `npm audit fix --force` sem ler o que ele vai fazer.** Na auditoria ele propunha "corrigir" o `eslint` voltando para a versão 4 e o `drizzle-kit` para a 0.18, o que quebraria o projeto.

### Atualizações maiores (planejar com calma)

| Pacote | Situação em 03/11/2026 | Observação |
| --- | --- | --- |
| `eslint` 9 → 10 | 9.39.5 marcado como "no longer supported" | Esperar o `eslint-config-next` suportar o 10 |
| `typescript` 6 → 7 | 7.0 disponível | Testar `typecheck` numa branch |
| `postgres` 3 → 4 | 4.0 disponível | Versão maior do driver: ler as notas de mudança |
| `drizzle-kit` | Puxa `@esbuild-kit` (obsoleto, com alertas moderados) | Atualizar quando sair versão sem essa dependência; só afeta desenvolvimento |

Procedimento: crie uma branch, atualize **um pacote por vez** (`npm install pacote@versao`), rode a rotina completa e faça commit separado. Se quebrar, `git checkout package.json package-lock.json && npm ci` volta ao estado anterior.

## 3. Migrações

```bash
# 1. edite db/schema.ts
npm run db:generate     # 2. gera drizzle/00NN_nome.sql
# 3. LEIA o SQL gerado (renomear coluna pode virar DROP + ADD = perda de dados)
npm test                # 4. os testes recriam o banco a partir das migrations
npm run db:migrate      # 5. aplica no seu banco
```

Em produção com Docker, o container aplica as migrations sozinho ao iniciar (`CMD` do `Dockerfile`). Sem Docker, rode `npm run db:migrate` antes de `npm start`.

**Faça backup antes de aplicar migrations em produção.**

## 4. Logs

| Origem | Onde ver |
| --- | --- |
| Erros do servidor | Uma linha JSON por erro no stdout: `{"level":"error","message":...,"digest":...,"path":...}` (`instrumentation.ts`) |
| Tarefa diária | Uma linha JSON `{"level":"info","job":"daily",...}` |
| Docker | `docker compose logs -f app`, `docker compose logs scheduler`, `docker compose logs backup` |
| Aviso imediato | Configure `ERROR_WEBHOOK_URL` (Discord, Slack, ntfy) |

O `digest` aparece também na tela de erro para o usuário. Se alguém reclamar de um erro, peça esse código e procure no log:

```bash
docker compose logs app | grep '"digest":"2929961920'
```

A **trilha de auditoria** (quem fez o quê) fica no banco, em `audit_logs`, e aparece na tela `/auditoria`.

## 5. Backups

### Automático (Docker Compose)

O serviço `backup` roda `scripts/backup.sh` a cada 24 h, grava em `./backups/kombexa-AAAA-MM-DD_HHMM.dump` e apaga os mais velhos que `BACKUP_KEEP_DAYS` (padrão 14).

### Manual (testado na auditoria)

```bash
DATABASE_URL=postgres://fight:fight@localhost:5432/fight_manager BACKUP_DIR=./backups KEEP_DAYS=14 sh scripts/backup.sh
```

No Windows, o `backup.sh` não roda diretamente no PowerShell. Use o `pg_dump` equivalente:

```powershell
pg_dump --format=custom --no-owner --dbname="postgres://fight:fight@localhost:5432/fight_manager" --file="backups\kombexa-manual.dump"
```

**Regra 3-2-1:** guarde cópias fora do servidor (o `./backups` fica no mesmo disco do banco). Os arquivos contêm dados pessoais e de saúde.

## 6. Restauração (testada na auditoria)

```bash
# 1. banco vazio de destino
createdb -U fight kombexa_restaurado
# 2. restaurar
pg_restore --no-owner --dbname=postgres://fight:fight@localhost:5432/kombexa_restaurado backups/kombexa-2026-11-03_1559.dump
# 3. conferir
psql -U fight -d kombexa_restaurado -c "select count(*) from students;"
```

Para substituir o banco principal: pare a aplicação, renomeie ou apague o banco atual, crie-o vazio, restaure e suba a aplicação. **Teste a restauração de vez em quando**: um backup nunca restaurado é uma esperança, não um backup.

## 7. Recriar o banco de desenvolvimento do zero

```bash
dropdb -U fight fight_manager && createdb -U fight fight_manager
npm run db:migrate && npm run db:seed
```

Docker: `docker compose down -v && docker compose up -d --build`. **O `-v` apaga o volume do banco.**

## 8. Procedimento de atualização em produção

1. Backup (seção 5).
2. `git pull` da versão nova.
3. Leia `docs/changelog.md` e confira se há migrations novas em `drizzle/`.
4. Docker: `docker compose up -d --build` (as migrations rodam ao iniciar). Sem Docker: `npm ci && npm run build && npm run db:migrate`, depois reinicie o `npm start`.
5. Verifique `GET /api/saude` e faça login.
6. Se algo der errado: volte ao commit anterior e, se a migration nova tiver alterado dados, restaure o backup.

## 9. Troubleshooting

| Sintoma | Investigação | Solução |
| --- | --- | --- |
| Tela "Algo deu errado" | Procure o `digest` no log | Depende do erro |
| `/api/saude` responde 503 | O banco não responde | `docker compose ps`, `docker compose logs db` |
| Mensalidades do mês não foram geradas | Rode `npm run jobs:daily` e leia a saída; confira se a academia tem "gerar automaticamente" ligado | Agendador parado ou `CRON_SECRET` diferente entre `app` e `scheduler` |
| Lembretes não chegam | `npm run email:test -- voce@email.com` | Configurar `EMAIL_*`/`SMTP_*` |
| Link do e-mail aponta para o lugar errado | `APP_URL` | Corrigir `APP_URL` e reiniciar |
| Usuário reclama de "Muitas tentativas" | Limite em memória | Esperar 15 min ou reiniciar |
| Testes apagaram dados | `TEST_DATABASE_URL` apontava para o banco real | Restaurar backup; separar os bancos |
| `npm test` falha com `permission denied for schema public` | Dono do banco de teste | `ALTER DATABASE fight_manager_test OWNER TO fight;` |
| Ícones do app quebrados na imagem Docker | Imagem construída antes da correção da auditoria | Reconstruir (`--build`); o `Dockerfile` agora copia `public/` |

## 10. Dívida técnica conhecida

- **Testes duplicados:** 6 pares de arquivos Vitest são idênticos byte a byte, e `v08`, `v09`, `v10` e `v10b` repetem testes que já estão nos arquivos novos; no E2E, `titular.spec.ts` é uma versão antiga de `senha-e-recibo.spec.ts`. Medido na auditoria: são **118 dos 317 testes (37%)**, que respondem por **cerca de metade do tempo** da suíte. Removê-los não perde cobertura. A lista exata está em `relatorios/PENDENCIAS.md`. Não foram removidos na auditoria por regra ("não excluir arquivos originais").
- `docs/arquitetura.md` (original) tem trechos desatualizados (ver `HISTORICO_AUDITORIA.md`).
- O status `suspended` do aluno existe no banco, mas não é usado.
- `LOGO_STORAGE` só aceita `database`; S3/R2/GCS estão anunciados como "ainda não implementados".
