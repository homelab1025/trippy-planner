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
	cd frontend && npm ci && docker build -t trippy-frontend:latest .

test-frontend: generate-frontend
test-frontend:
	cd frontend && npm ci && npx vitest run

e2e-test: generate-frontend
e2e-test:
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d --build --wait backend; \
	up_status=$$?; \
	if [ $$up_status -ne 0 ]; then \
		docker compose -f docker-compose.yml -f docker-compose.e2e.yml down; \
		exit $$up_status; \
	fi; \
	(cd frontend && npm ci && PLAYWRIGHT_HTML_OPEN=never npx playwright test); \
	status=$$?; \
	docker compose -f docker-compose.yml -f docker-compose.e2e.yml down; \
	exit $$status

coverage-frontend: generate-frontend
coverage-frontend:
	cd frontend && npm ci && npx vitest run --coverage --coverage.provider=v8

# Backend targets
generate-backend:
	cd backend && ./mvnw -B dependency:resolve generate-sources -q

build-backend: generate-backend
build-backend:
	cd backend && ./mvnw -B dependency:resolve && docker build -t trippy-backend:latest -f Dockerfile ..

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
