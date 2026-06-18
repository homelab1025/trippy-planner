.PHONY: generate build dev test

generate:
	cd frontend && npm run generate:api
	cd backend && ./mvnw generate-sources -q

build:
	docker build -t trippy-frontend:latest frontend/
	docker build -t trippy-backend:latest backend/

dev:
	docker compose up --build

test:
	cd frontend && npx vitest run
	cd backend && ./mvnw test -q
