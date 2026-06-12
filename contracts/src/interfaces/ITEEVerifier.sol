// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ITEEVerifier - Phala/Automata-style TEE quote verifier
/// @notice Implementations validate SGX/TDX quotes and return the measurement register
interface ITEEVerifier {
    /// @notice Verify a TEE quote and return whether the mr_enclave matches
    /// @param quote The TEE quote bytes (SGX quote v3, TDX report, etc.)
    /// @param expectedMrEnclave The expected enclave measurement register
    /// @param expectedMrSigner The expected signer measurement register
    /// @param minIssuedAt Minimum acceptable quote issuance timestamp
    /// @return valid Whether the quote is valid and matches expected measurements
    function verifyQuote(
        bytes calldata quote,
        bytes32 expectedMrEnclave,
        bytes32 expectedMrSigner,
        uint64 minIssuedAt
    ) external view returns (bool valid);
}

/// @title IZkMLVerifier - Verifier for zkML proofs (EZKL/Modulus-compatible)
interface IZkMLVerifier {
    /// @notice Verify a zkML proof for a given circuit and public inputs
    /// @param circuitHash The hash of the circuit used
    /// @param publicInputsHash Hash of the public inputs (decision context)
    /// @param proof The zk-SNARK proof bytes
    /// @return valid Whether the proof is valid
    function verifyProof(
        bytes32 circuitHash,
        bytes32 publicInputsHash,
        bytes calldata proof
    ) external view returns (bool valid);
}
