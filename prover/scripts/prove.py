#!/usr/bin/env python3
"""
ProofLattice zkML Prover (Stub)

In production, this is replaced by EZKL/Modulus Labs.
For demo, we generate a fake proof that satisfies the MockZkMLVerifier's
verification check (last 32 bytes == keccak256(publicInputsHash || circuitHash)).
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path


def keccak256(data: bytes) -> str:
    """Use SHA3-256 as a stand-in for keccak256 in the stub."""
    return "0x" + hashlib.sha3_256(data).hexdigest()


def generate_proof(circuit_path: str, inputs: dict) -> dict:
    circuit = json.loads(Path(circuit_path).read_text())
    circuit_hash = keccak256(circuit_path.encode())

    # Serialize public inputs in a deterministic way
    inputs_str = json.dumps(inputs, sort_keys=True)
    inputs_bytes = inputs_str.encode()
    public_inputs_hash = keccak256(inputs_bytes)

    # The "proof" is just: random padding + keccak256(publicInputsHash || circuitHash)
    # (This matches the MockZkMLVerifier's check.)
    pih = public_inputs_hash[2:] if public_inputs_hash.startswith("0x") else public_inputs_hash
    ch = circuit_hash[2:] if circuit_hash.startswith("0x") else circuit_hash
    inner_bytes = bytes.fromhex(pih + ch)
    proof_tail = keccak256(inner_bytes)
    # Add 32 bytes of fake padding before
    proof = "0x" + ("00" * 32) + proof_tail[2:]

    proof_hash = keccak256(bytes.fromhex(proof[2:]))

    return {
        "circuitHash": circuit_hash,
        "publicInputsHash": public_inputs_hash,
        "proof": proof,
        "proofHash": proof_hash,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--circuit", required=True)
    parser.add_argument("--inputs", required=True, help="JSON string of inputs")
    args = parser.parse_args()

    try:
        inputs = json.loads(args.inputs)
    except json.JSONDecodeError:
        print(f"Invalid JSON: {args.inputs}", file=sys.stderr)
        sys.exit(1)

    result = generate_proof(args.circuit, inputs)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
