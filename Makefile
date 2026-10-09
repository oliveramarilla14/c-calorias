.PHONY: dev test lint migrate generate build
dev:
	docker compose -f docker-compose.dev.yml up -d
	trap 'kill 0' EXIT; npm --prefix backend run dev & npm --prefix frontend run dev
test:
	npm --prefix backend test
	cd frontend && npx vitest run
lint:
	npm --prefix frontend run lint
migrate:
	cd backend && npx prisma migrate deploy
generate:
	cd backend && npx prisma generate
build:
	npm run build
