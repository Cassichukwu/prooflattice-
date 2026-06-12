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
        vm.warp(2_000_000_000); // far future so timestamp math is safe
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
        // Layout: [mr_enclave: 32][mr_signer: 32][issuedAt-padded: 32]
        // Total 96 bytes so abi.decode(uint256) works for the timestamp.
        uint256 ts = uint256(block.timestamp);
        return abi.encode(mrEnclave, mrSigner, ts);
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

        // 11 fields: teeMrEnclave, teeMrSigner, zkmlCircuitHash, teeVerifier, zkmlVerifier,
        //           firstSeen, lastAttested, trustScore, attestationCount, bgaCertified, active
        (bytes32 _e, , , , , , , uint16 score, , , bool active) = registry.agentMeta(agentId);
        assertEq(_e, mrEnclave);
        assertEq(score, 500);
        assertTrue(active);
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
        (, , , , , , , uint16 score, , , ) = registry.agentMeta(agentId);
        assertEq(score, 750);
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
        (, , , , , , , uint16 score, , , ) = registry.agentMeta(agentId);
        assertEq(score, 100);
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
        // Proof format: [random: 32][commitment: 32], where commitment = keccak256(pih || ch)
        bytes32 commitment = keccak256(abi.encodePacked(publicInputsHash, circuitHash));
        bytes memory proof = abi.encodePacked(bytes32(uint256(0xdeadbeef)), commitment);
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
        bytes32 commitment = keccak256(abi.encodePacked(publicInputsHash, circuitHash));
        bytes memory proof = abi.encodePacked(bytes32(uint256(0xfeedface)), commitment);
        vm.startPrank(operator);
        registry.submitProof(agentId, proofHash, publicInputsHash, proof);
        vm.expectRevert("Proof already seen");
        registry.submitProof(agentId, proofHash, publicInputsHash, proof);
        vm.stopPrank();
    }
}
