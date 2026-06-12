# ProofLattice zkML Prover

This is a stub for the zkML prover. In production, replace `generateProof()` with
a real EZKL/Modulus Labs prover.

## Quick start

```bash
cd prover
npm install
npm run prove -- --circuit circuits/swap-decision.json --inputs '{"amount": 100, "slippage_bps": 30}'
```

## Output format

```json
{
  "circuitHash": "0x...",
  "publicInputsHash": "0x...",
  "proof": "0x...",         // bytes sent to ProofLatticeRegistry.submitProof
  "proofHash": "0x..."      // hash of the proof bytes
}
```

## Wiring with ProofLatticeRegistry

The proof's last 32 bytes must equal `keccak256(publicInputsHash || circuitHash)` for the
mock verifier to accept. The prover enforces this.

## Real EZKL integration

```python
import ezkl

ezkl.gen_settings()
ezkl.compile_circuit()         # .py -> .ezkl
ezkl.setup_test()              # generates srs
ezkl.prove()                   # returns proof + public inputs
ezkl.verify()                  # local verification
```

See https://github.com/zkonduit/ezkl for full docs.
