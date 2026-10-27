# Kombexa: imagem de produção (Next.js + scripts de migration e seed)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgres://fight:fight@localhost:5432/fight_manager

RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -S app && adduser -S app -G app
# node_modules completo: inclui o tsx, usado pelo seed (npm run db:seed)
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.ts /app/tsconfig.json ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/db ./db
COPY --from=build /app/lib ./lib
COPY --from=build /app/services ./services
USER app
EXPOSE 3000
# aplica as migrations pendentes e sobe a aplicação
CMD ["sh", "-c", "node scripts/migrate.mjs && npx next start -p ${PORT}"]
