// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ProofLatticeRegistry.sol";
import "../src/DemosthenesArena.sol";
import "../src/MockERC8004Identity.sol";
import "../src/MockTEEVerifier.sol";

contract DemosthenesArenaTest is Test {
    MockERC8004Identity public identity;
    MockTEEVerifier public tee;
    ProofLatticeRegistry public registry;
    DemosthenesArena public arena;

    address public oracle = address(0xA11CE);
    address public operator = address(0xB0B);
    address public feeRecipient = address(0xFEE);

    bytes32 public mrEnclave = keccak256("e1");
    bytes32 public mrSigner  = keccak256("s1");

    function setUp() public {
        identity = new MockERC8004Identity();
        tee = new MockTEEVerifier();
        registry = new ProofLatticeRegistry(address(identity), oracle, address(tee));
        arena = new DemosthenesArena(address(registry), feeRecipient);
        registry.setBountyBoard(address(0x1234));
    }

    function _quote() internal view returns (bytes memory) {
        bytes memory q = new bytes(72);
        assembly {
            mstore(add(q, 32), sload(mrEnclave.slot))
            mstore(add(q, 64), sload(mrSigner.slot))
            mstore(add(q, 96), timestamp)
        }
        return q;
    }

    function _register(address op) internal returns (uint256) {
        vm.prank(op);
        return registry.registerWithAttestation(
            "ipfs://x",
            mrEnclave,
            mrSigner,
            address(tee),
            _quote(),
            bytes32(0),
            address(0)
        );
    }

    function testOpenAndSettleApproved() public {
        // Register 6 agents: 1 task agent, 5 jury
        uint256 taskAgent = _register(operator);
        uint256[5] memory juryIds;
        address[5] memory juryOps;
        for (uint256 i = 0; i < 5; i++) {
            juryOps[i] = address(uint160(0x1000 + i));
            juryIds[i] = _register(juryOps[i]);
            // Bump each jury's trust score above MIN_TRUST_TO_JUDGE
            vm.prank(oracle);
            registry.updateTrustScore(juryIds[i], 800);
        }

        // Open a round with stake
        bytes32 taskHash = keccak256("swap USDC->mETH on Byreal");
        vm.deal(address(this), 1 ether);
        uint256 roundId = arena.openRound{value: 0.01 ether}(
            taskAgent,
            DemosthenesArena.TaskType.DEF_SWAP,
            taskHash,
            0.01 ether
        );

        // Submit a decision
        bytes memory decision = abi.encodePacked("swap_amount=100");
        vm.prank(operator);
        arena.submitDecision(roundId, decision);

        // Jury votes 4 YES, 1 NO
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(juryOps[i]);
            arena.judge(roundId, i, true);
        }
        vm.prank(juryOps[4]);
        arena.judge(roundId, 4, false);

        // Fast-forward past judgment deadline
        vm.roll(block.number + 300);

        // Settle
        arena.settle(roundId);

        DemosthenesArena.Round memory r = arena.getRound(roundId);
        assertEq(uint256(r.state), uint256(DemosthenesArena.RoundState.SETTLED));
        assertTrue(r.trustDelta > 0);
        assertEq(r.yesVotes, 4);
        assertEq(r.noVotes, 1);
    }

    function testOpenAndSettleRejected() public {
        uint256 taskAgent = _register(operator);
        address[5] memory juryOps;
        for (uint256 i = 0; i < 5; i++) {
            juryOps[i] = address(uint160(0x2000 + i));
            uint256 id = _register(juryOps[i]);
            vm.prank(oracle);
            registry.updateTrustScore(id, 800);
        }

        bytes32 taskHash = keccak256("bad swap");
        vm.deal(address(this), 1 ether);
        uint256 roundId = arena.openRound{value: 0.01 ether}(
            taskAgent,
            DemosthenesArena.TaskType.DEF_SWAP,
            taskHash,
            0.01 ether
        );

        bytes memory decision = abi.encodePacked("terrible decision");
        vm.prank(operator);
        arena.submitDecision(roundId, decision);

        // Jury votes 1 YES, 4 NO
        for (uint256 i = 0; i < 4; i++) {
            vm.prank(juryOps[i]);
            arena.judge(roundId, i, false);
        }
        vm.prank(juryOps[4]);
        arena.judge(roundId, 4, true);

        vm.roll(block.number + 300);
        arena.settle(roundId);

        DemosthenesArena.Round memory r = arena.getRound(roundId);
        assertEq(uint256(r.state), uint256(DemosthenesArena.RoundState.SETTLED));
        assertTrue(r.trustDelta < 0);
    }

    function testOnlyTaskAgentCanSubmit() public {
        uint256 taskAgent = _register(operator);
        bytes32 taskHash = keccak256("task");
        vm.deal(address(this), 1 ether);
        uint256 roundId = arena.openRound{value: 0.01 ether}(
            taskAgent,
            DemosthenesArena.TaskType.DEF_SWAP,
            taskHash,
            0.01 ether
        );

        vm.prank(address(0xDEAD));
        vm.expectRevert("Not task agent operator");
        arena.submitDecision(roundId, hex"00");
    }
}
