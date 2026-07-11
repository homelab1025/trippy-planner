.PHONY: generate build dev test clean clean-frontend clean-backend coverage-backend

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
	docker build -t trippy-backend:latest -f backend/Dockerfile .

test-backend:
	cd backend && ./mvnw test -q

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
