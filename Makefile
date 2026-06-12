.PHONY: help install build test deploy seed dev up down clean demo mock-api

# Default: full local demo stack
help:
	@echo "ProofLattice build commands:"
	@echo "  make install     - install all deps (contracts, backend, frontend)"
	@echo "  make build       - compile contracts + build frontend"
	@echo "  make test        - run foundry tests"
	@echo "  make up          - start anvil + deployer + backend + frontend (docker compose)"
	@echo "  make down        - stop all containers"
	@echo "  make deploy      - deploy contracts to local anvil"
	@echo "  make seed        - register 50 demo agents"
	@echo "  make dev         - run backend + frontend in dev mode (no docker)"
	@echo "  make mock-api    - run GraphQL API with mock data (no chain needed)"
	@echo "  make demo        - run full mock-mode demo (no chain, no docker)"

install:
	@echo "→ Installing contracts (forge)..."
	cd contracts && forge install foundry-rs/forge-std --no-commit
	cd contracts && forge install OpenZeppelin/openzeppelin-contracts@v5.0.2 --no-commit
	@echo "→ Installing backend (npm)..."
	cd backend && npm install
	@echo "→ Installing frontend (npm)..."
	cd frontend && npm install

build:
	@echo "→ Compiling contracts..."
	cd contracts && forge build
	@echo "→ Building frontend..."
	cd frontend && npm run build

test:
	@echo "→ Running forge tests..."
	cd contracts && forge test -vvv

deploy:
	@echo "→ Starting anvil in background..."
	@anvil --port 8545 --chain-id 5003 --block-time 2 &> /tmp/anvil.log &
	@sleep 3
	@echo "→ Deploying contracts..."
	cd contracts && forge script script/Deploy.s.sol:Deploy \
		--rpc-url http://127.0.0.1:8545 \
		--broadcast \
		--private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
	@echo "→ Done. Addresses in deploy/deployment.json"

seed:
	@echo "→ Seeding 50 demo agents..."
	cd backend && ORACLE_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
		npm run seed

dev:
	@echo "→ Starting backend in mock mode..."
	cd backend && npm run api:mock &
	@echo "→ Starting frontend..."
	cd frontend && npm run dev

up:
	docker compose up --build

down:
	docker compose down -v

clean:
	rm -rf contracts/{out,cache,lib} backend/{node_modules,dist} frontend/{node_modules,.next}

mock-api:
	cd backend && npm run api:mock

demo:
	@echo "Starting mock-mode demo (no chain, no docker)..."
	@echo "  Frontend: http://localhost:3000"
	@echo "  GraphQL:  http://localhost:4000/graphql"
	@trap 'kill 0' INT; \
	(cd backend && npm run api:mock) & \
	(cd frontend && npm run dev) & \
	wait
