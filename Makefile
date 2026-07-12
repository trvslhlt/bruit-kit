.PHONY: up down shell lint format typecheck build demo test

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

# --host so the dev server is reachable from the host browser at
# localhost:5173 (see docker-compose.yml's port mapping) rather than only
# from inside the container.
demo:
	docker compose exec builder npm run demo -- --host 0.0.0.0

# Playwright's own webServer config starts/stops the demo dev server
# around the test run -- no need for `make demo` to already be running.
test:
	docker compose exec builder npm run test:e2e
