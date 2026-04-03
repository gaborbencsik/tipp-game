.PHONY: help install dev build test typecheck \
        db-up db-down db-logs db-migrate db-seed db-reset \
        logs ps clean

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
	@echo "    make db-seed       Seed adatok betöltése"
	@echo "    make db-reset      DB törlése és újrainicializálása"
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

db-reset:
	docker compose down -v
	docker compose up -d db
	@echo "Várakozás a DB-re..."
	@sleep 3
	npm run db:migrate --workspace=packages/backend
	npm run db:seed --workspace=packages/backend

# ─── CI / minőség ────────────────────────────────────────────────────────────

test:
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


                  id                  |      name      | is_global_default | exact_score | correct_winner_and_diff | correct_winner | correct_draw | incorrect |          created_at           |          updated_at           
--------------------------------------+----------------+-------------------+-------------+-------------------------+----------------+--------------+-----------+-------------------------------+-------------------------------
 97a5af1f-5682-48ce-895a-2f7918bf337e | Global Default | t                 |           3 |                       2 |              1 |            2 |         0 | 2026-03-28 15:09:44.479089+00 | 2026-03-28 15:09:44.479089+00
(1 row)