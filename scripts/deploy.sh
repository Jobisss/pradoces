#!/usr/bin/env bash
#
# Deploy da Luizinha Confeitaria na VPS. Automatiza o runbook de docs/DEPLOY.md:
#
#   git pull → backup do banco → migrations → rebuild do app → verificação
#
# Roda a partir da raiz do repo na VPS (/var/www/pradoces).
#
#   ./scripts/deploy.sh              # interativo: mostra o que vai mudar e pergunta
#   ./scripts/deploy.sh --yes        # sem perguntar (pra cron/CI)
#   ./scripts/deploy.sh --no-pull    # usa o código que já está no disco
#   ./scripts/deploy.sh --no-backup  # pula o dump (NÃO recomendado)
#
# PRODUÇÃO (ver CLAUDE.md): este script só faz operação ADITIVA. Nunca chama
# `migrate reset`, `db push --force-reset` nem `compose down -v` — se precisar
# desfazer alguma coisa, é na mão e com o dump em mãos.
#
set -euo pipefail

readonly RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly DIR_BACKUPS="$RAIZ/backups"
readonly BACKUPS_MANTIDOS=10
readonly TAG_MIGRATOR="pradoces-migrator"
readonly URL_LOCAL="http://127.0.0.1:3002"

CONFIRMAR=1
PULL=1
BACKUP=1

for arg in "$@"; do
  case "$arg" in
    --yes|-y) CONFIRMAR=0 ;;
    --no-pull) PULL=0 ;;
    --no-backup) BACKUP=0 ;;
    # Imprime o cabeçalho deste arquivo até a primeira linha que não é comentário.
    -h|--help) awk 'NR>1 && !/^#/{exit} NR>1{sub(/^# ?/,""); print}' "${BASH_SOURCE[0]}"; exit 0 ;;
    *) echo "Opção desconhecida: $arg (use --help)" >&2; exit 2 ;;
  esac
done

titulo() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
erro() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }
ok() { printf '\033[32m✓ %s\033[0m\n' "$*"; }

cd "$RAIZ"

# ---------- 0. Pré-voo ----------
titulo "Pré-voo"

for cmd in docker git curl; do
  command -v "$cmd" >/dev/null || { erro "'$cmd' não encontrado no PATH."; exit 1; }
done
docker compose version >/dev/null 2>&1 || { erro "Plugin 'docker compose' não instalado."; exit 1; }

[[ -f docker-compose.yml ]] || { erro "Rode a partir da raiz do repo (não achei docker-compose.yml)."; exit 1; }
[[ -f .env.production ]] || { erro "Falta .env.production — copia de .env.production.example e preenche os secrets."; exit 1; }

# docker-compose.yml interpola ${POSTGRES_PASSWORD} lendo o `.env` do diretório,
# que é um symlink pra .env.production (ver docs/DEPLOY.md §1). Sem ele a senha
# do Postgres vira string vazia SILENCIOSAMENTE.
if [[ ! -e .env ]]; then
  echo "  .env ausente — criando symlink pra .env.production"
  ln -sf .env.production .env
fi
ok "Ferramentas, .env.production e .env presentes"

# ---------- 1. Código ----------
if (( PULL )); then
  titulo "Atualizando código"
  ANTES="$(git rev-parse HEAD)"
  # --ff-only: se o repo da VPS divergiu (alguém editou direto no servidor), o
  # deploy PARA em vez de tentar merge automático em produção.
  if ! git pull --ff-only; then
    erro "git pull falhou. Se for 'dubious ownership': git config --global --add safe.directory $RAIZ"
    erro "Se for divergência, resolve na mão — este script não faz merge em produção."
    exit 1
  fi
  DEPOIS="$(git rev-parse HEAD)"
  if [[ "$ANTES" == "$DEPOIS" ]]; then
    ok "Já estava atualizado ($(git rev-parse --short HEAD))"
  else
    ok "Atualizado: $(git rev-parse --short "$ANTES") → $(git rev-parse --short "$DEPOIS")"
    git --no-pager log --oneline "$ANTES..$DEPOIS" | sed 's/^/    /'
  fi
else
  titulo "Pulando git pull (--no-pull) — HEAD em $(git rev-parse --short HEAD)"
fi

# ---------- 2. Sobe o banco (se ainda não estiver de pé) ----------
titulo "Banco de dados"
docker compose up -d db
# `docker compose up -d` já respeita o healthcheck do db pra dependentes, mas
# aqui ele sobe sozinho — espera explícito antes do pg_dump/migrate.
for _ in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U postgres -d doces >/dev/null 2>&1; then break; fi
  sleep 2
done
docker compose exec -T db pg_isready -U postgres -d doces >/dev/null 2>&1 || {
  erro "Postgres não ficou pronto em 60s."
  docker compose logs db --tail 30
  exit 1
}
ok "Postgres respondendo"

# ---------- 3. Backup ----------
if (( BACKUP )); then
  titulo "Backup do banco"
  mkdir -p "$DIR_BACKUPS"
  ARQUIVO="$DIR_BACKUPS/doces-$(date +%Y%m%d-%H%M%S).sql.gz"
  # -T: sem TTY, senão o docker injeta CR no stream e corrompe o dump.
  if docker compose exec -T db pg_dump -U postgres -d doces | gzip > "$ARQUIVO"; then
    ok "Dump salvo em $ARQUIVO ($(du -h "$ARQUIVO" | cut -f1))"
  else
    rm -f "$ARQUIVO"
    erro "pg_dump falhou — deploy abortado (não migra sem backup)."
    exit 1
  fi
  # Mantém só os N mais recentes.
  { ls -1t "$DIR_BACKUPS"/doces-*.sql.gz 2>/dev/null || true; } | tail -n "+$((BACKUPS_MANTIDOS + 1))" | xargs -r rm -f
else
  titulo "Backup PULADO (--no-backup)"
fi

# ---------- 4. Imagem migradora ----------
# O container `app` é o estágio `runner` do Dockerfile: minimalista de propósito,
# sem CLI do prisma, sem prisma.config.ts, sem scripts/. O estágio `builder` tem
# tudo isso — vira uma imagem descartável só pras migrations (docs/DEPLOY.md §1).
titulo "Construindo imagem migradora"
docker build --quiet --target builder -t "$TAG_MIGRATOR" . >/dev/null
ok "Imagem $TAG_MIGRATOR pronta"

# A network vem do container `db` que já está de pé — mais confiável que adivinhar
# "<nome-do-diretório>_default" (o nome muda com COMPOSE_PROJECT_NAME).
ID_DB="$(docker compose ps -q db)"
NETWORK="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$ID_DB")"
[[ -n "$NETWORK" ]] || { erro "Não consegui descobrir a network do compose."; exit 1; }
echo "  network: $NETWORK"

migrator() {
  docker run --rm --network "$NETWORK" --env-file .env.production "$TAG_MIGRATOR" "$@"
}

# ---------- 5. Migrations ----------
titulo "Migrations pendentes"
# `migrate status` sai com código != 0 quando há pendências — isso é informação,
# não erro, então não deixa o `set -e` derrubar o script aqui.
STATUS="$(migrator npx prisma migrate status 2>&1 || true)"
echo "$STATUS" | sed 's/^/    /'

if echo "$STATUS" | grep -q "Database schema is up to date"; then
  ok "Nenhuma migration pendente"
else
  if (( CONFIRMAR )); then
    echo
    read -r -p "Aplicar essas migrations em PRODUÇÃO? [s/N] " resposta
    [[ "$resposta" =~ ^[sSyY]$ ]] || { erro "Cancelado pelo usuário."; exit 1; }
  fi
  migrator npx prisma migrate deploy
  ok "Migrations aplicadas"
fi

# ---------- 6. Rebuild do app ----------
# Só agora: as migrations são aditivas, então o código antigo continua rodando
# contra o schema novo. O contrário (código novo, schema velho) quebraria.
titulo "Rebuild e restart do app"
docker compose up -d --build
ok "Container app recriado"

# ---------- 7. Verificação ----------
titulo "Verificação"
for _ in $(seq 1 30); do
  CODIGO="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$URL_LOCAL" || true)"
  if [[ "$CODIGO" == "200" ]]; then break; fi
  sleep 2
done

docker compose ps

if [[ "${CODIGO:-}" == "200" ]]; then
  ok "App respondendo 200 em $URL_LOCAL"
  # Limpa imagens órfãs das builds anteriores (nunca volumes — pgdata é sagrado).
  docker image prune -f >/dev/null 2>&1 || true
  titulo "Deploy concluído — $(git rev-parse --short HEAD)"
else
  erro "App não respondeu 200 em $URL_LOCAL (último código: ${CODIGO:-nenhum})"
  docker compose logs app --tail 60
  erro "O banco JÁ está migrado. Corrige o app e roda: docker compose up -d --build"
  exit 1
fi
