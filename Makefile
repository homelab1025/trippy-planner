.PHONY: generate build dev test

# Full stack targets
generate: generate-frontend generate-backend

build: build-frontend build-backend

dev:
	docker compose up --build

test: test-frontend test-backend

# Frontend targets
generate-frontend:
	cd frontend && npm run generate:api

build-frontend:
	docker build -t trippy-frontend:latest frontend/

test-frontend:
	cd frontend && npx vitest run

# Backend targets
generate-backend:
	cd backend && ./mvnw generate-sources -q

build-backend:
	docker build -t trippy-backend:latest backend/

test-backend:
	cd backend && ./mvnw test -q
