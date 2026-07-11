.PHONY: up down shell lint format typecheck build

# Start the builder container (stays alive, no dev server — see Dockerfile).
up:
	docker compose up --build -d

down:
	docker compose down

shell:
	docker compose exec builder sh

lint:
	docker compose exec builder npm run lint

format:
	docker compose exec builder npm run format

typecheck:
	docker compose exec builder npm run typecheck

build:
	docker compose exec builder npm run build
