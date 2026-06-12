// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ProofLatticeRegistry.sol";
import "../src/MockERC8004Identity.sol";
import "../src/MockTEEVerifier.sol";
import "../src/MockZkMLVerifier.sol";

contract ProofLatticeRegistryTest is Test {
    MockERC8004Identity public identity;
    MockTEEVerifier public tee;
    MockZkMLVerifier public zkml;
    ProofLatticeRegistry public registry;

    address public oracle = address(0xA11CE);
    address public operator = address(0xB0B);
    address public bountyBoard = address(0xB0B2);
    address public arena = address(0xA23E2A);

    bytes32 public mrEnclave = keccak256("test-enclave");
    bytes32 public mrSigner  = keccak256("test-signer");
    bytes32 public circuitHash = keccak256("test-circuit");

    function setUp() public {
        identity = new MockERC8004Identity();
        tee = new MockTEEVerifier();
        zkml = new MockZkMLVerifier();
        registry = new ProofLatticeRegistry(
            address(identity),
            oracle,
            address(tee)
        );
        registry.setBountyBoard(bountyBoard);
        registry.setArena(arena);
    }

    function _makeQuote() internal view returns (bytes memory) {
        // First 32 bytes = mr_enclave, next 32 = mr_signer, last 8 = issuedAt
        bytes memory q = new bytes(72);
        assembly {
            mstore(add(q, 32), sload(mrEnclave.slot))
            mstore(add(q, 64), sload(mrSigner.slot))
            mstore(add(q, 96), timestamp)
        }
        return q;
    }

    function testRegisterWithAttestation() public {
        vm.prank(operator);
        uint256 agentId = registry.registerWithAttestation(
            "ipfs://agent1",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            circuitHash,
            address(zkml)
        );
        assertEq(agentId, 1);

        ProofLatticeRegistry.AgentMetadata memory m = registry.agentMeta(agentId);
        assertEq(m.teeMrEnclave, mrEnclave);
        assertEq(m.trustScore, 500);
        assertTrue(m.active);
    }

    function testRevertOnInvalidTEE() public {
        bytes memory badQuote = new bytes(8);
        vm.prank(operator);
        vm.expectRevert("Invalid TEE quote");
        registry.registerWithAttestation(
            "ipfs://agent2",
            mrEnclave,
            mrSigner,
            address(tee),
            badQuote,
            bytes32(0),
            address(0)
        );
    }

    function testCannotDoubleRegisterAsOperator() public {
        vm.startPrank(operator);
        registry.registerWithAttestation(
            "ipfs://agent3",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            bytes32(0),
            address(0)
        );
        vm.expectRevert("Operator already registered");
        registry.registerWithAttestation(
            "ipfs://agent4",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            bytes32(0),
            address(0)
        );
        vm.stopPrank();
    }

    function testTrustScoreUpdateByOracle() public {
        vm.prank(operator);
        uint256 agentId = registry.registerWithAttestation(
            "ipfs://agent5",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            bytes32(0),
            address(0)
        );
        vm.prank(oracle);
        registry.updateTrustScore(agentId, 750);
        assertEq(registry.agentMeta(agentId).trustScore, 750);
    }

    function testTrustScoreUpdateByOtherFails() public {
        vm.prank(operator);
        uint256 agentId = registry.registerWithAttestation(
            "ipfs://agent6",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            bytes32(0),
            address(0)
        );
        vm.prank(address(0xDEAD));
        vm.expectRevert("Not oracle");
        registry.updateTrustScore(agentId, 100);
    }

    function testBountyBoardSlash() public {
        vm.prank(operator);
        uint256 agentId = registry.registerWithAttestation(
            "ipfs://agent7",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            bytes32(0),
            address(0)
        );
        vm.prank(bountyBoard);
        registry.slash(agentId, 100, "caught faking");
        assertEq(registry.agentMeta(agentId).trustScore, 100);
    }

    function testProofSubmission() public {
        vm.prank(operator);
        uint256 agentId = registry.registerWithAttestation(
            "ipfs://agent8",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            circuitHash,
            address(zkml)
        );
        bytes32 proofHash = keccak256("proof1");
        bytes32 publicInputsHash = keccak256("inputs1");
        bytes memory proof = abi.encodePacked(publicInputsHash, circuitHash);
        vm.prank(operator);
        registry.submitProof(agentId, proofHash, publicInputsHash, proof);
        assertEq(registry.getProofHistoryLength(agentId), 1);
    }

    function testReplayProofReverts() public {
        vm.prank(operator);
        uint256 agentId = registry.registerWithAttestation(
            "ipfs://agent9",
            mrEnclave,
            mrSigner,
            address(tee),
            _makeQuote(),
            circuitHash,
            address(zkml)
        );
        bytes32 proofHash = keccak256("proof2");
        bytes32 publicInputsHash = keccak256("inputs2");
        bytes memory proof = abi.encodePacked(publicInputsHash, circuitHash);
        vm.startPrank(operator);
        registry.submitProof(agentId, proofHash, publicInputsHash, proof);
        vm.expectRevert("Proof already seen");
        registry.submitProof(agentId, proofHash, publicInputsHash, proof);
        vm.stopPrank();
    }
}
