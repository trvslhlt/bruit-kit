FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
# No dev server to run — this is a library, not an app. The container just
# stays alive so `make lint`/`typecheck`/`build` can exec into it, same
# Docker-only-dev convention as the sibling granular_midi/docker_collab
# projects (no Node needed on the host).
CMD ["tail", "-f", "/dev/null"]
