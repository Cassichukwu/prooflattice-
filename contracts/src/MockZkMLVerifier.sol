// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ITEEVerifier.sol";

/// @title MockZkMLVerifier - demo verifier for zkML proofs.
///         In production, this would verify an EZKL halo2/PLONK proof.
contract MockZkMLVerifier is IZkMLVerifier {
    address public owner;
    mapping(bytes32 => bool) public revokedCircuits;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function revokeCircuit(bytes32 circuitHash) external onlyOwner {
        revokedCircuits[circuitHash] = true;
    }

    function approveCircuit(bytes32 circuitHash) external onlyOwner {
        revokedCircuits[circuitHash] = false;
    }

    /// @notice Proof layout: [random: 32][commitment: 32] (total 64 bytes)
    ///         commitment = keccak256(publicInputsHash || circuitHash)
    function verifyProof(
        bytes32 circuitHash,
        bytes32 publicInputsHash,
        bytes calldata proof
    ) external view override returns (bool valid) {
        if (revokedCircuits[circuitHash]) return false;
        if (proof.length < 64) return false;
        bytes32 expected = keccak256(abi.encodePacked(publicInputsHash, circuitHash));
        // Read the last 32 bytes via calldata slicing + abi.decode
        bytes32 actual = abi.decode(proof[proof.length - 32:], (bytes32));
        return actual == expected;
    }
}
