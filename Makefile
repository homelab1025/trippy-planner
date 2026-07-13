.PHONY: generate build dev test clean e2e-test coverage-frontend clean-frontend clean-backend coverage-backend

# Full stack targets
generate: generate-frontend generate-backend

build: generate
build: build-frontend build-backend

dev:
	docker compose up --build

test: generate
test: test-frontend test-backend

# Frontend targets
generate-frontend:
	cd frontend && npm ci && npm run generate:api

build-frontend: generate-frontend
build-frontend:
	cd frontend && npm ci && docker build -t trippy-frontend:latest frontend/

test-frontend: generate-frontend
test-frontend:
	cd frontend && npm ci && npx vitest run

e2e-test: generate-frontend
e2e-test:
	cd frontend && npm ci && npx playwright test

coverage-frontend: generate-frontend
coverage-frontend:
	cd frontend && npm ci && npx vitest run --coverage --coverage.provider=v8

# Backend targets
generate-backend:
	cd backend && ./mvnw -B dependency:resolve generate-sources -q

build-backend: generate-backend
build-backend:
	cd backend && ./mvnw -B dependency:resolve && docker build -t trippy-backend:latest -f backend/Dockerfile ..

test-backend: generate-backend
test-backend:
	cd backend && ./mvnw -B dependency:resolve test -q

coverage-backend:
	cd backend && ./mvnw test jacoco:report -q

# Clean targets
clean-frontend:
	rm -rf frontend/dist
	rm -f frontend/node_modules/.tmp/tsconfig.app.tsbuildinfo
	rm -f frontend/node_modules/.tmp/tsconfig.node.tsbuildinfo
	rm -rf frontend/src/api
	echo "cleaned frontend"

clean-backend:
	rm -rf backend/target
	echo "cleaned backend"

clean: clean-frontend clean-backend
	echo "cleaned everything"
