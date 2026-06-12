// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ITEEVerifier.sol";

/// @title MockTEEVerifier - demo verifier that accepts any quote with non-zero length
///         and returns true if the expected measurements match.
///         In production, this would be Phala's on-chain SGX verifier or Automata.
contract MockTEEVerifier is ITEEVerifier {
    mapping(bytes32 => bool) public revokedMrEnclaves;
    address public owner;

    event MrEnclaveRevoked(bytes32 mrEnclave);
    event MrEnclaveApproved(bytes32 mrEnclave);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    function revokeMrEnclave(bytes32 mr) external onlyOwner {
        revokedMrEnclaves[mr] = true;
        emit MrEnclaveRevoked(mr);
    }

    function approveMrEnclave(bytes32 mr) external onlyOwner {
        revokedMrEnclaves[mr] = false;
        emit MrEnclaveApproved(mr);
    }

    function verifyQuote(
        bytes calldata quote,
        bytes32 expectedMrEnclave,
        bytes32 expectedMrSigner,
        uint64 minIssuedAt
    ) external view override returns (bool valid) {
        if (quote.length < 32) return false;
        if (revokedMrEnclaves[expectedMrEnclave]) return false;
        // The last 8 bytes of the quote encode an issuance timestamp
        uint64 issuedAt;
        assembly {
            issuedAt := calldataload(sub(add(quote.offset, quote.length), 8))
        }
        if (issuedAt < minIssuedAt) return false;
        // First 32 bytes encode mr_enclave; next 32 encode mr_signer
        bytes32 actualMr;
        bytes32 actualSigner;
        assembly {
            actualMr := calldataload(quote.offset)
            actualSigner := calldataload(add(quote.offset, 32))
        }
        return actualMr == expectedMrEnclave && actualSigner == expectedMrSigner;
    }
}
