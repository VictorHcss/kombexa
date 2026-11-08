# Guia de Docker (com o Dockerfile e o Compose do Kombexa)

## 1. Os conceitos, com analogias

| Conceito | Analogia | No Kombexa |
| --- | --- | --- |
| **Imagem** | Uma "foto" de um computador pronto, com sistema, Node e o app já compilado | Construída pelo `Dockerfile` |
| **Container** | Um computador ligado a partir daquela foto. Dá para ligar vários da mesma imagem | `app`, `db`, `scheduler`, `backup` |
| **Volume** | Um HD externo plugado no container: os dados sobrevivem quando o container é recriado | `pgdata` (o banco) e `./backups` |
| **Rede** | Um "Wi-Fi" privado entre os containers, em que cada um é chamado pelo nome | O app acessa o banco em `db:5432`, não em `localhost` |
| **Dockerfile** | A receita para montar a imagem | `projeto/Dockerfile` |
| **Compose** | O maestro que sobe vários containers juntos, na ordem certa | `projeto/docker-compose.yml` |

## 2. O Dockerfile, linha por linha

O arquivo usa **multi-stage build**: três etapas, e só a última vira a imagem final (menor e sem o código-fonte bruto).

```dockerfile
# ---------- Etapa 1: dependências ----------
FROM node:22-alpine AS deps          # parte de uma imagem oficial com Node 22 (Alpine = Linux mínimo)
WORKDIR /app                         # "cd /app" dentro da imagem
COPY package.json package-lock.json ./
RUN npm ci                           # instala as dependências

# ---------- Etapa 2: build ----------
FROM deps AS build                   # continua de onde a etapa 1 parou
WORKDIR /app
COPY . .                             # copia o código (menos o que está no .dockerignore)
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgres://fight:fight@localhost:5432/fight_manager   # (1)
RUN npm run build

# ---------- Etapa 3: imagem final ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S app && adduser -S app -G app                # (2) usuário sem privilégios
COPY --from=deps /app/node_modules ./node_modules           # (3) só o necessário de cada etapa
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/public ./public                      # (4) acrescentado na auditoria
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/db ./db
COPY --from=build /app/lib ./lib
COPY --from=build /app/services ./services
USER app                                                    # roda como "app", não como root
EXPOSE 3000
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start -p ${PORT}"]   # (5)
```

1. O build precisa de **alguma** `DATABASE_URL` para o código carregar (`db/index.ts` lança erro sem ela), mas não conecta ao banco durante o build. O valor real vem do Compose na hora de rodar.
2. **Boa prática de segurança:** se alguém invadir o app, não ganha poder de administrador no container.
3. `--from=deps` copia de outra etapa. As pastas `db`, `lib`, `services` e `scripts` vão junto porque os scripts de migration e seed rodam dentro do container.
4. **O bug encontrado:** sem esta linha, os ícones do app (`/icon-192.png` e outros, citados no manifest) respondiam 404.
5. Toda vez que o container inicia, aplica as migrations pendentes e sobe o servidor.

**`.dockerignore`**: o que **não** entra na imagem: `node_modules`, `.next`, `.git`, **`.env`** (segredos nunca vão para a imagem), `tests`, `docs`.

## 3. O Compose: quatro serviços

```yaml
services:
  db:
    image: postgres:16-alpine
    environment: { POSTGRES_USER: fight, POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fight}, POSTGRES_DB: fight_manager }
    volumes: [ "pgdata:/var/lib/postgresql/data" ]   # os dados ficam no volume, não no container
    ports: [ "5432:5432" ]                           # porta_do_seu_pc:porta_do_container
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U fight -d fight_manager"]

  app:
    build: .                                         # usa o Dockerfile desta pasta
    environment:
      DATABASE_URL: postgres://fight:${POSTGRES_PASSWORD:-fight}@db:5432/fight_manager   # "db" = nome do serviço
      COOKIE_SECURE: ${COOKIE_SECURE:-false}
      # ...
    ports: [ "3000:3000" ]
    depends_on:
      db: { condition: service_healthy }             # só sobe quando o banco responde

  scheduler:   # a cada hora: wget POST /api/tarefas/diarias com o CRON_SECRET
  backup:      # a cada 24 h: sh /backup.sh, gravando em ./backups
```

Repare em `${POSTGRES_PASSWORD:-fight}`: "use a variável do `.env`; se não existir, use `fight`". É por isso que funciona sem configurar nada, e também por isso que **não serve para produção** sem um `.env` próprio (ver `../SEGURANCA.md`, item 7.5).

```mermaid
flowchart LR
  subgraph "rede do compose"
    app[app :3000] -->|db:5432| db[(db: postgres 16)]
    scheduler -->|POST app:3000/api/tarefas/diarias| app
    backup -->|pg_dump db:5432| db
  end
  pc[Seu navegador] -->|localhost:3000| app
  db --- vol[(volume pgdata)]
  backup --- dir[./backups]
```

## 4. Comandos do dia a dia

| Quero... | Comando |
| --- | --- |
| Construir e subir tudo em segundo plano | `docker compose up -d --build` |
| Ver o que está rodando | `docker compose ps` |
| Ver os logs do app (seguindo) | `docker compose logs -f app` |
| Ver os logs dos últimos 10 minutos | `docker compose logs --since 10m app` |
| Rodar um comando dentro do app | `docker compose exec app npm run db:migrate` |
| Dados de exemplo (o container é "produção") | `docker compose exec -e ALLOW_SEED=1 app npm run db:seed` |
| Abrir o banco | `docker compose exec db psql -U fight -d fight_manager` |
| Reiniciar só o app | `docker compose restart app` |
| Parar (mantém os dados) | `docker compose down` |
| Parar e **apagar o banco** | `docker compose down -v` |
| Ver as imagens | `docker images` |
| Liberar espaço de coisas antigas | `docker system prune` (cuidado: leia o aviso) |

## 5. Depurando serviços

**O app não sobe:**

```bash
docker compose ps                 # o app está "Restarting"?
docker compose logs app           # leia a última mensagem
```

Causas comuns: migration falhou (a mensagem "Falha nas migrations:" aparece no log) ou o banco ainda não estava pronto.

**"Não conecta ao banco":** dentro do Compose o host é **`db`**, não `localhost`. `localhost` dentro de um container é o próprio container.

**Entrar no container para investigar:**

```bash
docker compose exec app sh        # Alpine usa "sh", não "bash"
ls -la                            # confira se public/, drizzle/ etc. estão lá
wget -qO- localhost:3000/api/saude
exit
```

**A porta 5432 já está em uso** (por exemplo, um PostgreSQL instalado no Windows): troque o lado esquerdo no compose, `"5433:5432"`, e use a porta 5433 no seu PC.

**Mudei o código e nada mudou:** faltou `--build`. Sem ele, o Compose reaproveita a imagem antiga.

## 6. Exercício guiado

1. Rode `docker compose up -d --build` e `docker compose ps`. Os quatro serviços estão de pé?
2. `docker compose exec app ls public`: os ícones estão lá?
3. `docker compose logs scheduler`: aparece a resposta JSON da tarefa diária depois de 1 minuto?
4. `docker compose down` e depois `up -d` de novo: os dados continuam? (sim, por causa do volume)
5. Agora `down -v` e `up -d`: e agora? Por quê?

Ao terminar, você terá validado na prática a parte que a auditoria não pôde executar. Anote o resultado em `relatorios/PENDENCIAS.md`.
