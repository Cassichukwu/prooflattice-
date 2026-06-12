# Deployment Guide

## Option 1: Demo mode (no blockchain, runs in 30 seconds)

```bash
cd build
make demo
```

This starts:
- Mock-mode GraphQL API on :4000 (uses `data/mock-*.json`)
- Next.js frontend on :3000

Open <http://localhost:3000>.

## Option 2: Local Mantle fork via Anvil

```bash
# Terminal 1
anvil --port 8545 --chain-id 5003 --block-time 2

# Terminal 2: deploy contracts
cd build/contracts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
USE_MOCK_IDENTITY=true \
TRUST_ORACLE=0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266 \
FEE_RECIPIENT=0xf39Fd6e51aad88F6F4ce6aB8827279cfFFb92266 \
DEPLOY_OUT=../deploy \
ERC8004_IDENTITY_REGISTRY=0x0000000000000000000000000000000000000000 \
forge script script/Deploy.s.sol:Deploy \
  --rpc-url http://127.0.0.1:8545 \
  --broadcast

# Terminal 3: backend (use deployed addresses from deploy/deployment.json)
cd build/backend
cp .env.example .env
# Edit .env with the deployed contract addresses
npm install
npm run start

# Terminal 4: frontend
cd build/frontend
cp .env.example .env.local
# Edit with NEXT_PUBLIC_REGISTRY_ADDRESS etc.
npm install
npm run dev
```

## Option 3: Mantle Sepolia Testnet

1. Get testnet MNT from <https://faucet.sepolia.mantle.xyz>
2. Set env vars in `contracts/.env`:
   ```
   PRIVATE_KEY=0x...                    # your testnet key
   MANTLE_SEPOLIA_RPC_URL=https://rpc.sepolia.mantle.xyz
   USE_MOCK_IDENTITY=true
   TRUST_ORACLE=0x...                   # your address or a dedicated oracle
   FEE_RECIPIENT=0x...                  # where bounty fees go
   DEPLOY_OUT=../deploy
   ```
3. Deploy:
   ```bash
   cd build/contracts
   source .env
   forge script script/Deploy.s.sol:Deploy \
     --rpc-url $MANTLE_SEPOLIA_RPC_URL \
     --broadcast \
     --private-key $PRIVATE_KEY
   ```
4. Take the addresses from `deploy/deployment.json` and put them in:
   - `backend/.env` (PROOF_LATTICE_REGISTRY, DEMOSTHENES_ARENA, etc.)
   - `frontend/.env.local` (NEXT_PUBLIC_REGISTRY_ADDRESS, etc.)
5. Run backend + frontend as in Option 2

## Option 4: Mantle Mainnet (production)

Same as Option 3 but with mainnet RPC and your real private key. Replace the mock verifiers with:
- **TEEVerifier:** Phala Network's on-chain SGX verifier
  - Repo: <https://github.com/Phala-Network/phala-onchain-verifier>
  - Address on Mantle mainnet: TBD
- **ZkMLVerifier:** EZKL/Modulus Labs verifier
  - Repo: <https://github.com/zkonduit/ezkl>
  - Use a pre-deployed EZKL verifier, or deploy your own Groth16/PLONK verifier

Update `contracts/.env`:
```
USE_MOCK_IDENTITY=false
ERC8004_IDENTITY_REGISTRY=0x...   # the real ERC-8004 on Mantle
TEE_VERIFIER=0x...                # Phala's verifier
ZKML_VERIFIER=0x...               # EZKL's verifier
```

## Verifying the deployment

After deploy, check:
```bash
cast call $PROOF_LATTICE_REGISTRY "totalAgents()" --rpc-url $RPC
# Should return 0 (or whatever was set)
```

## Troubleshooting

**`vm.writeFile: path not allowed`**
Add `fs_permissions` to `contracts/foundry.toml`:
```toml
fs_permissions = [{ access = "read-write", path = "../deploy" }]
```

**"Invalid TEE quote" on registration**
The mock verifier expects quotes in the format `[mr_enclave: 32][mr_signer: 32][issuedAt: 32]` (96 bytes). Make sure the prover generates the right format.

**"Not arena" / "Not oracle" errors**
Set the cross-references in setUp:
```solidity
registry.setArena(address(arena));
registry.setTrustOracle(oracle);
```

**Frontend can't connect to wallet**
- Make sure NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set in frontend/.env.local
- Get a free one at <https://cloud.walletconnect.com>

**GraphQL 404**
- Make sure backend is running on :4000
- Check NEXT_PUBLIC_API_URL points to it
