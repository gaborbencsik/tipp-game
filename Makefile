.PHONY: help install dev build test typecheck \
        db-up db-down db-logs db-migrate db-seed db-reset \
        logs ps clean sh-backend sh-frontend sh-db

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
	@echo ""
	@echo "    make clean         node_modules + Docker volume törlése"

# ─── Fejlesztés ──────────────────────────────────────────────────────────────

install:
	npm install

up:
	docker compose up --build

down:
	docker compose down

restart: down up

logs:
	docker compose logs -f

# ─── Adatbázis ───────────────────────────────────────────────────────────────

db-up:
	docker compose up -d db

db-down:
	docker compose down

db-migrate:
	npm run db:generate --workspace=packages/backend
	npm run db:migrate --workspace=packages/backend

db-shell:
	docker compose exec db psql -U tipp_user -d tipp_game

db-seed:
	npm run db:seed --workspace=packages/backend

db-seed-local:
	npm run db:seed-local --workspace=packages/backend

db-reset:
	docker compose down -v
	docker compose up -d db
	@echo "Várakozás a DB-re..."
	@sleep 3
	npm run db:migrate --workspace=packages/backend
	npm run db:seed --workspace=packages/backend
	npm run db:seed-local --workspace=packages/backend

# ─── CI / minőség ────────────────────────────────────────────────────────────

# ─── Shell ───────────────────────────────────────────────────────────────────

sh:
	docker compose exec backend sh

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
	docker compose down -v
	rm -rf node_modules packages/*/node_modules
