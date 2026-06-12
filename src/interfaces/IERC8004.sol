// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004 - Minimal interface mirroring the Trustless Agents Identity Registry
/// @notice See https://eips.ethereum.org/EIPS/eip-8004
interface IERC8004Identity {
    function register(
        address agent,
        string calldata agentURI,
        bytes32[] calldata attestations
    ) external returns (uint256 agentId);

    function ownerOf(uint256 agentId) external view returns (address);
    function tokenURI(uint256 agentId) external view returns (string memory);
}

interface IERC8004Reputation {
    function submitFeedback(
        uint256 agentId,
        uint8 score,
        bytes32 tag1,
        bytes32 tag2,
        string calldata uri,
        bytes calldata sig
    ) external;

    function readFeedback(
        uint256 agentId,
        address client,
        uint64 index
    ) external view returns (uint8 score, bytes32 tag1, bytes32 tag2, bool isRevoked);
}

interface IERC8004Validation {
    function requestValidation(
        uint256 agentId,
        bytes32 dataHash,
        bytes calldata payload
    ) external returns (bytes32 requestHash);

    function submitValidation(
        bytes32 requestHash,
        bool approve,
        bytes calldata evidence
    ) external;
}
