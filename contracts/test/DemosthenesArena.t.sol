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
        vm.warp(2_000_000_000);
        identity = new MockERC8004Identity();
        tee = new MockTEEVerifier();
        registry = new ProofLatticeRegistry(address(identity), oracle, address(tee));
        arena = new DemosthenesArena(address(registry), feeRecipient);
        registry.setBountyBoard(address(0x1234));
        // Wire up cross-references
        registry.setArena(address(arena));
        // For the rejected path, the arena needs to be the trust oracle.
        // We do this lazily during the test by toggling.
    }

    function _quote(bytes32 mrEnclaveForAgent) internal view returns (bytes memory) {
        uint256 ts = uint256(block.timestamp);
        return abi.encode(mrEnclaveForAgent, mrSigner, ts);
    }

    function _register(address op, bytes32 mrEnclaveForAgent) internal returns (uint256) {
        vm.prank(op);
        return registry.registerWithAttestation(
            "ipfs://x",
            mrEnclaveForAgent,
            mrSigner,
            address(tee),
            _quote(mrEnclaveForAgent),
            bytes32(0),
            address(0)
        );
    }

    function testOpenAndSettleApproved() public {
        // Register 6 agents: 1 task agent, 5 jury (each with unique mr_enclave)
        uint256 taskAgent = _register(operator, keccak256("agent-task"));
        uint256[5] memory juryIds;
        address[5] memory juryOps;
        for (uint256 i = 0; i < 5; i++) {
            juryOps[i] = address(uint160(0x1000 + i));
            juryIds[i] = _register(juryOps[i], keccak256(abi.encodePacked(i + 1)));
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

        // Read the actual jury assigned to this round and have each operator vote
        uint256[] memory jury = arena.getJudges(roundId);
        require(jury.length == 5, "Jury must have 5 members");
        // Map each jury agent ID back to its operator
        // We have juryIds[0..4] = registered jury agents, in registration order.
        // The contract picks them in a random order, so we map: for each idx in jury[],
        // find which juryIds[i] == jury[idx], then use juryOps[i].
        for (uint256 idx = 0; idx < 5; idx++) {
            address op = _findOperator(jury[idx], juryIds, juryOps);
            vm.prank(op);
            arena.judge(roundId, idx, true);
        }

        // Fast-forward past judgment deadline
        vm.roll(block.number + 300);

        // Settle
        arena.settle(roundId);

        DemosthenesArena.Round memory r = arena.getRound(roundId);
        assertEq(uint256(r.state), uint256(DemosthenesArena.RoundState.SETTLED));
        assertTrue(r.trustDelta > 0);
        assertEq(r.yesVotes, 5);
        assertEq(r.noVotes, 0);
    }

    function _findOperator(uint256 agentId, uint256[5] memory juryIds, address[5] memory juryOps) internal pure returns (address) {
        for (uint256 i = 0; i < 5; i++) {
            if (juryIds[i] == agentId) return juryOps[i];
        }
        revert("Unknown jury agent");
    }

    function testOpenAndSettleRejected() public {
        uint256 taskAgent = _register(operator, keccak256("agent-task2"));
        uint256[5] memory juryIds;
        address[5] memory juryOps;
        for (uint256 i = 0; i < 5; i++) {
            juryOps[i] = address(uint160(0x2000 + i));
            juryIds[i] = _register(juryOps[i], keccak256(abi.encodePacked(0x100 + i)));
            vm.prank(oracle);
            registry.updateTrustScore(juryIds[i], 800);
        }
        // Now make the arena the trust oracle for the rejected path
        registry.setTrustOracle(address(arena));

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

        // 4 NO, 1 YES
        uint256[] memory jury = arena.getJudges(roundId);
        require(jury.length == 5, "Jury must have 5 members");
        for (uint256 idx = 0; idx < 5; idx++) {
            address op = _findOperator(jury[idx], juryIds, juryOps);
            vm.prank(op);
            arena.judge(roundId, idx, idx < 4 ? false : true);
        }

        vm.roll(block.number + 300);
        arena.settle(roundId);

        DemosthenesArena.Round memory r = arena.getRound(roundId);
        assertEq(uint256(r.state), uint256(DemosthenesArena.RoundState.SETTLED));
        assertTrue(r.trustDelta < 0);
    }

    receive() external payable {}

    function testOnlyTaskAgentCanSubmit() public {
        uint256 taskAgent = _register(operator, keccak256("agent-task3"));
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
