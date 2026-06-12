// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/ITEEVerifier.sol";

/// @title MockTEEVerifier - demo verifier that accepts any quote with the right structure.
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

    /// @notice Quote layout: [mr_enclave: 32][mr_signer: 32][issuedAt: 32] (total 96 bytes).
    ///         Each field is ABI-encoded (32-byte aligned).
    function verifyQuote(
        bytes calldata quote,
        bytes32 expectedMrEnclave,
        bytes32 expectedMrSigner,
        uint64 minIssuedAt
    ) external view override returns (bool valid) {
        if (quote.length != 96) return false;
        if (revokedMrEnclaves[expectedMrEnclave]) return false;

        bytes32 actualMr = abi.decode(quote[:32], (bytes32));
        bytes32 actualSigner = abi.decode(quote[32:64], (bytes32));
        uint256 tsFull = abi.decode(quote[64:], (uint256));
        uint64 issuedAt = uint64(tsFull);

        if (issuedAt < minIssuedAt) return false;
        if (actualMr != expectedMrEnclave) return false;
        if (actualSigner != expectedMrSigner) return false;
        return true;
    }
}
