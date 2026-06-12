// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "./interfaces/IERC8004.sol";

/// @title MockERC8004Identity - minimal in-repo mock of the ERC-8004 Identity Registry.
///         Lets us test ProofLatticeRegistry end-to-end without depending on the
///         mainnet-deployed ERC-8004. The interface is identical.
contract MockERC8004Identity is ERC721, IERC8004Identity {
    uint256 public nextAgentId;
    mapping(uint256 => string) private _agentURIs;
    mapping(bytes32 => bool) public usedAttestations;

    constructor() ERC721("ProofLattice Agent", "PLAGENT") {}

    function register(
        address agent,
        string calldata agentURI,
        bytes32[] calldata attestations
    ) external override returns (uint256 agentId) {
        agentId = ++nextAgentId;
        _mint(agent, agentId);
        _agentURIs[agentId] = agentURI;
        for (uint256 i = 0; i < attestations.length; i++) {
            usedAttestations[attestations[i]] = true;
        }
    }

    function tokenURI(uint256 agentId) public view override(ERC721, IERC8004Identity) returns (string memory) {
        return _agentURIs[agentId];
    }
}
