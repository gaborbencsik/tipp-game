.PHONY: help install dev build test typecheck \
        db-up db-down db-logs db-migrate db-seed db-reset \
        logs ps clean sh-backend sh-frontend sh-db \
        e2e e2e-ui e2e-down sbx sbx-run sbx-rm

# Default target
help:
	@echo "Elérhető parancsok:"
	@echo ""
	@echo "  Fejlesztés"
	@echo "    make install       npm install (minden workspace)"
	@echo "    make dev           Teljes stack indítása Docker Compose-zal"
	@echo "    make logs          Docker Compose logok (follow)"
	@echo "    make ps            Futó containerek"
	@echo ""
	@echo "  Adatbázis"
	@echo "    make db-up         Csak a PG container indítása"
	@echo "    make db-down       Összes container leállítása (volume megmarad)"
	@echo "    make db-shell      psql shell a local DB-ben"
	@echo "    make db-migrate    Drizzle migrációk futtatása"
	@echo "    make db-seed       Seed adatok betöltése (base: teams, venues)"
	@echo "    make db-seed-local Dummy dev adatok betöltése (users, matches, groups)"
	@echo "    make db-reset      DB törlése és újrainicializálása"
	@echo ""
	@echo "  Shell"
	@echo "    make sh-backend    Shell a backend containerben"
	@echo "    make sh-frontend   Shell a frontend containerben"
	@echo "    make sh-db         Shell a DB containerben"
	@echo ""
	@echo "  CI / minőség"
	@echo "    make test          Tesztek futtatása (minden workspace)"
	@echo "    make typecheck     TypeScript ellenőrzés (minden workspace)"
	@echo "    make build         Produkciós build (minden workspace)"
	@echo "    make e2e           Playwright E2E tesztek (docker up → test → down)"
	@echo "    make e2e-ui        Playwright E2E tesztek UI módban"
	@echo ""
	@echo "    make clean         node_modules + Docker volume törlése"
	@echo "  Sandbox"
	@echo "    make sbx           Sandbox létrehozása"
	@echo "    make sbx-run       Sandbox futtatása"
	@echo "    make sbx-rm        Sandbox törlése"

# ─── Fejlesztés ──────────────────────────────────────────────────────────────

install:
	npm install

up:
	docker compose --profile dev up --build

down:
	docker compose --profile dev down

restart: down up

logs:
	docker compose --profile dev logs -f

# ─── Adatbázis ───────────────────────────────────────────────────────────────

db-up:
	docker compose --profile dev up -d db

db-down:
	docker compose --profile dev down

db-migrate:
	npm run db:generate --workspace=packages/backend
	npm run db:migrate --workspace=packages/backend

db-shell:
	docker compose --profile dev exec db psql -U tipp_user -d tipp_game

db-seed:
	npm run db:seed --workspace=packages/backend

db-seed-local:
	npm run db:seed-local --workspace=packages/backend

db-reset:
	docker compose --profile dev down -v
	docker compose --profile dev up -d db
	@echo "Várakozás a DB-re..."
	@sleep 3
	npm run db:migrate --workspace=packages/backend
	npm run db:seed --workspace=packages/backend
	npm run db:seed-local --workspace=packages/backend

# ─── CI / minőség ────────────────────────────────────────────────────────────

# ─── Shell ───────────────────────────────────────────────────────────────────

sh:
	docker compose --profile dev exec backend sh

# ─── CI / minőség ────────────────────────────────────────────────────────────

test:
	npm run typecheck --workspaces --if-present
	npm test

test-coverage:
	npm run test:coverage

typecheck:
	npm run typecheck

build:
	npm run build

# ─── Takarítás ───────────────────────────────────────────────────────────────

clean:
	docker compose --profile dev --profile e2e down -v
	rm -rf node_modules packages/*/node_modules

# ─── E2E tesztek ─────────────────────────────────────────────────────────────

e2e:
	docker compose --profile e2e up -d --build
	@echo "Várakozás az E2E stack-re..."
	@until docker compose --profile e2e exec backend-e2e curl -sf http://localhost:3000/api/health > /dev/null 2>&1; do sleep 1; done
	@echo "DB schema push az E2E DB-re..."
	docker compose --profile e2e exec -T backend-e2e sh -c 'echo "" | npx drizzle-kit push --force'
	@echo "Playwright tesztek indulnak..."
	docker compose --profile e2e run --rm playwright npx playwright test
	docker compose --profile e2e down

e2e-down:
	docker compose --profile e2e down

e2e-ui:
	docker compose --profile dev up -d --build
	@echo "Várakozás a backend-re..."
	@until curl -sf http://localhost:3000/api/health > /dev/null 2>&1; do sleep 1; done
	@echo "Várakozás a frontend-re..."
	@until curl -sf http://localhost:5173 > /dev/null 2>&1; do sleep 1; done
	npx playwright install chromium --with-deps 2>/dev/null || npx playwright install chromium
	npx playwright test --ui

# ─── Sandbox ────────────────────────────────────────────────────────────────

SBX_NAME := tipp-game

# Source of truth for the kit spec: pulled fresh from the repo on each build.
REPO     := gaborbencsik/ai
SPEC     := sbx-spec.yaml
# Local, gitignored kit dir the create command points at. Holds the built
# spec WITH the API key injected -- never commit it.
KIT_DIR  := .kit
# Build script that downloads the spec + injects the API key. Auto-fetched
# from the repo if missing (see sbx-create).
SCRIPT   := scripts/kit-build-claude.sh

# Always download the latest build script from the repo so every run uses a
# fresh copy, then run it (downloads the spec + injects the API key) and create
# the sandbox from the built kit dir.
sbx-create:
	@echo "Downloading latest $(SCRIPT) from $(REPO)..."
	@mkdir -p $(dir $(SCRIPT))
	@gh api "repos/$(REPO)/contents/$(SCRIPT)" -H "Accept: application/vnd.github.raw" > $(SCRIPT)
	@chmod +x $(SCRIPT)
	@REPO=$(REPO) SPEC=$(SPEC) KIT_DIR=$(KIT_DIR) ./$(SCRIPT)
	sbx create --name $(SBX_NAME) --kit $(KIT_DIR) claude .

# Build from the local working tree (no download): uses this repo's own
# scripts/kit-build-claude.sh and sbx-spec.yaml so you can test uncommitted
# changes before pushing. LOCAL_SPEC tells the script to copy the local spec
# instead of fetching it.
sbx-create-local:
	@LOCAL_SPEC=$(SPEC) KIT_DIR=$(KIT_DIR) ./$(SCRIPT)
	sbx create --name $(SBX_NAME) --kit $(KIT_DIR) claude .

sbx-run:
	sbx run --name $(SBX_NAME)

sbx-rm:
	sbx rm $(SBX_NAME)

