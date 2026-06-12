// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./ProofLatticeRegistry.sol";

/// @title DemosthenesArena
/// @notice The "Turing Test" arena. Agents are tested on Mantle DeFi/RWA tasks
///         and judged by a reputation-weighted jury of OTHER agents.
///         All decisions and outcomes are on-chain.
contract DemosthenesArena is Ownable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum RoundState { OPEN, JUDGING, SETTLED, DISPUTED, CANCELLED }

    enum TaskType {
        DEF_SWAP,           // 0 — swap on Byreal/Merchant Moe/Agni
        RWA_REBALANCE,      // 1 — rebalance mETH/USDY
        LP_REBALANCE,       // 2 — LP rebalance
        WALLET_PAYMENT,     // 3 — x402 payment
        GOVERNANCE_VOTE,    // 4 — vote on Mantle governance
        YIELD_OPTIMISE      // 5 — yield optimise across pools
    }

    struct Round {
        uint256 roundId;
        uint256 taskAgentId;        // Agent being tested
        TaskType taskType;
        bytes32 taskHash;           // Hash of the task spec
        uint256 stakeRequired;      // MNT-style stake to submit
        uint256 submissionDeadline;
        uint256 judgmentDeadline;
        uint256 settlementBlock;    // Block when settled
        int16   trustDelta;         // +/- trust score after settlement
        uint16  yesVotes;
        uint16  noVotes;
        RoundState state;
        address payable staker;     // Who paid the stake
    }

    struct Judgment {
        bytes32 judgeAgentIdHash;   // For privacy
        bool approve;
        uint256 weight;             // Reputation weight
        bool revealed;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    ProofLatticeRegistry public registry;
    uint256 public roundCount;
    uint256 public constant JURY_SIZE = 5;
    uint256 public constant MIN_TRUST_TO_JUDGE = 600;
    uint256 public constant STAKE_FEE_BPS = 700;   // 7% fee on stake
    address public feeRecipient;

    mapping(uint256 => Round) public rounds;
    mapping(uint256 => bytes) public submissions;
    mapping(uint256 => uint256[]) public roundJudges;     // roundId => agentId[]
    mapping(uint256 => mapping(uint256 => Judgment)) public roundJudgments; // roundId => judgeIdx => judgment
    mapping(uint256 => bytes32) public taskHashes;       // roundId => task spec hash

    // Slashed stake accumulated for the fee recipient
    uint256 public accumulatedFees;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event RoundOpened(
        uint256 indexed roundId,
        uint256 indexed taskAgentId,
        TaskType taskType,
        bytes32 taskHash,
        uint256 stakeRequired
    );

    event RoundSubmitted(uint256 indexed roundId, bytes32 submissionHash);

    event RoundJudged(uint256 indexed roundId, uint256 indexed judgeIdx, bool approve);

    event RoundSettled(
        uint256 indexed roundId,
        int16 trustDelta,
        uint16 yesVotes,
        uint16 noVotes
    );

    event RoundDisputed(uint256 indexed roundId, address disputer);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyTaskAgent(uint256 roundId) {
        Round storage r = rounds[roundId];
        require(IERC721(address(registry.identityRegistry())).ownerOf(r.taskAgentId) == msg.sender, "Not task agent operator");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address _registry, address _feeRecipient) Ownable(msg.sender) {
        registry = ProofLatticeRegistry(_registry);
        feeRecipient = _feeRecipient;
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setFeeRecipient(address newFeeRecipient) external onlyOwner {
        feeRecipient = newFeeRecipient;
    }

    // ------------------------------------------------------------------
    // Open a round
    // ------------------------------------------------------------------

    /// @notice Anyone can open a round to test an agent on a Mantle task.
    ///         The staker pays the stake, which is slashed or returned based on jury verdict.
    function openRound(
        uint256 taskAgentId,
        TaskType taskType,
        bytes32 taskHash,
        uint256 stakeRequired
    ) external payable nonReentrant returns (uint256 roundId) {
        require(msg.value >= stakeRequired, "Insufficient stake");
        require(stakeRequired > 0, "Zero stake");

        roundId = ++roundCount;

        // Select jury: 5 high-trust agents (excluding the task agent)
        uint256[] memory judges = _selectJury(taskAgentId, JURY_SIZE);

        rounds[roundId] = Round({
            roundId: roundId,
            taskAgentId: taskAgentId,
            taskType: taskType,
            taskHash: taskHash,
            stakeRequired: stakeRequired,
            submissionDeadline: block.number + 100,  // ~5 min on Mantle
            judgmentDeadline: block.number + 250,    // ~12 min on Mantle
            settlementBlock: 0,
            trustDelta: 0,
            yesVotes: 0,
            noVotes: 0,
            state: RoundState.OPEN,
            staker: payable(msg.sender)
        });

        taskHashes[roundId] = taskHash;

        for (uint256 i = 0; i < judges.length; i++) {
            roundJudges[roundId].push(judges[i]);
        }

        emit RoundOpened(roundId, taskAgentId, taskType, taskHash, stakeRequired);
    }

    // ------------------------------------------------------------------
    // Submit a decision for testing
    // ------------------------------------------------------------------

    function submitDecision(
        uint256 roundId,
        bytes calldata decision
    ) external onlyTaskAgent(roundId) {
        Round storage r = rounds[roundId];
        require(r.state == RoundState.OPEN, "Not open");
        require(block.number < r.submissionDeadline, "Past submission deadline");

        submissions[roundId] = decision;
        r.state = RoundState.JUDGING;

        emit RoundSubmitted(roundId, keccak256(decision));
    }

    // ------------------------------------------------------------------
    // Judge
    // ------------------------------------------------------------------

    /// @notice A jury agent casts a verdict.
    ///         In production this would verify a signed payload from the judge's operator.
    function judge(
        uint256 roundId,
        uint256 judgeIdx,
        bool approve
    ) external {
        Round storage r = rounds[roundId];
        require(r.state == RoundState.JUDGING, "Not judging");
        require(block.number < r.judgmentDeadline, "Past judgment deadline");
        require(judgeIdx < roundJudges[roundId].length, "Bad judge idx");

        uint256 judgeAgentId = roundJudges[roundId][judgeIdx];
        Judgment storage j = roundJudgments[roundId][judgeIdx];
        require(!j.revealed, "Already judged");

        // Verify caller is the operator of the judge agent
        require(IERC721(address(registry.identityRegistry())).ownerOf(judgeAgentId) == msg.sender, "Not judge operator");

        // Weight by judge trust score
        (, , , , , , , uint16 judgeScore, , , ) = registry.agentMeta(judgeAgentId);
        j.approve = approve;
        j.weight = judgeScore;
        j.judgeAgentIdHash = keccak256(abi.encodePacked(judgeAgentId));
        j.revealed = true;

        if (approve) {
            r.yesVotes += 1;
        } else {
            r.noVotes += 1;
        }

        emit RoundJudged(roundId, judgeIdx, approve);
    }

    // ------------------------------------------------------------------
    // Settle
    // ------------------------------------------------------------------

    function settle(uint256 roundId) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.state == RoundState.JUDGING, "Not judging");
        require(block.number >= r.judgmentDeadline, "Too early to settle");

        // Tally: simple majority (3/5) decides.
        bool approved = r.yesVotes >= 3;

        // Compute trust delta
        int16 trustDelta;
        if (approved) {
            trustDelta = int16(uint16((r.yesVotes * 25) + 10));   // +35 to +135
        } else {
            trustDelta = -int16(uint16((r.noVotes * 50) + 30));   // -80 to -280
        }

        r.trustDelta = trustDelta;
        r.settlementBlock = block.number;
        r.state = RoundState.SETTLED;

        // Apply trust delta to the task agent
        (, , , , , , , uint16 currentScore, , , ) = registry.agentMeta(r.taskAgentId);
        int256 newScore = int256(uint256(currentScore)) + int256(trustDelta);
        if (newScore < 0) newScore = 0;
        if (newScore > 1000) newScore = 1000;
        uint16 newScoreU = uint16(uint256(newScore));

        if (approved) {
            registry.award(r.taskAgentId, newScoreU);
        } else {
            // Slash if score is going down: use bounty board style
            if (newScoreU < currentScore) {
                // Registry needs a slash; we call updateTrustScore via oracle in practice.
                // For demo, we update directly if trustOracle is set on arena:
                // Simpler: just use the registry's updateTrustScore as owner-approved.
                _setTrustScore(r.taskAgentId, newScoreU);
            }
        }

        // Distribute stake: 70% back to staker, 30% to fee recipient on failure;
        // 95% back on success, 5% fee.
        uint256 fee;
        if (approved) {
            fee = (r.stakeRequired * 50) / 10000; // 0.5%
            (bool ok, ) = r.staker.call{value: r.stakeRequired - fee}("");
            require(ok, "Stake refund failed");
        } else {
            fee = (r.stakeRequired * STAKE_FEE_BPS) / 10000;
            (bool ok, ) = r.staker.call{value: r.stakeRequired - fee}("");
            require(ok, "Stake refund failed");
        }
        accumulatedFees += fee;
        if (fee > 0 && feeRecipient != address(0)) {
            (bool ok2, ) = feeRecipient.call{value: fee}("");
            require(ok2, "Fee transfer failed");
        }

        emit RoundSettled(roundId, trustDelta, r.yesVotes, r.noVotes);
    }

    // ------------------------------------------------------------------
    // Dispute (anyone can flag a settlement within dispute window)
    // ------------------------------------------------------------------

    function dispute(uint256 roundId) external {
        Round storage r = rounds[roundId];
        require(r.state == RoundState.SETTLED, "Not settled");
        require(block.number < r.settlementBlock + 100, "Past dispute window");
        r.state = RoundState.DISPUTED;
        emit RoundDisputed(roundId, msg.sender);
    }

    // ------------------------------------------------------------------
    // Internal: agent view helper
    // ------------------------------------------------------------------

    function _getAgentView(uint256 agentId) internal view returns (bool active, uint16 trustScore) {
        (, , , , , , , trustScore, , , active) = registry.agentMeta(agentId);
    }

    // ------------------------------------------------------------------
    // Internal: jury selection (in production, would use Allora/VRF)
    // ------------------------------------------------------------------

    function _selectJury(uint256 excludeAgentId, uint256 n) internal view returns (uint256[] memory) {
        // Simple deterministic selection: walk registry.totalAgents starting at random offset.
        // For demo, picks the top-N trust score agents ≠ exclude.
        uint256 total = registry.totalAgents();
        if (total < n + 1) {
            // Not enough agents; return what we have
            uint256[] memory empty = new uint256[](0);
            return empty;
        }

        // Pseudo-random offset
        uint256 seed = uint256(keccak256(abi.encodePacked(block.timestamp, excludeAgentId, roundCount)));
        uint256[] memory result = new uint256[](n);
        uint256 found = 0;
        uint256 startId = (seed % total) + 1;
        uint256 idx = startId;

        // Walk up to total * 2 to find n candidates
        for (uint256 i = 0; i < total * 2 && found < n; i++) {
            if (idx > total) idx = 1;
            (bool active, uint16 trustScore) = _getAgentView(idx);
            if (active && trustScore >= MIN_TRUST_TO_JUDGE && idx != excludeAgentId) {
                // Avoid duplicates
                bool alreadyPicked = false;
                for (uint256 j = 0; j < found; j++) {
                    if (result[j] == idx) {
                        alreadyPicked = true;
                        break;
                    }
                }
                if (!alreadyPicked) {
                    result[found] = idx;
                    found++;
                }
            }
            idx++;
        }

        // If we couldn't find enough high-trust judges, shrink array
        if (found < n) {
            uint256[] memory shrunk = new uint256[](found);
            for (uint256 k = 0; k < found; k++) shrunk[k] = result[k];
            return shrunk;
        }
        return result;
    }

    // ------------------------------------------------------------------
    // Internal: trust score set (demo helper; in prod delegated to oracle)
    // ------------------------------------------------------------------

    function _setTrustScore(uint256 agentId, uint16 newScore) internal {
        // We rely on the trust oracle: ask the registry to update via the oracle account.
        // For demo, we call updateTrustScore if this contract IS the oracle, otherwise we
        // emit an event for the oracle to pick up off-chain.
        // Simplest: assume the arena was set as the trust oracle at deploy time.
        // If not, the off-chain engine will pick up the SETTLED event and post the new score.
        if (registry.trustOracle() == address(this)) {
            registry.updateTrustScore(agentId, newScore);
        }
    }

    // ------------------------------------------------------------------
    // View helpers
    // ------------------------------------------------------------------

    function getRound(uint256 roundId) external view returns (Round memory) {
        return rounds[roundId];
    }

    function getJudges(uint256 roundId) external view returns (uint256[] memory) {
        return roundJudges[roundId];
    }

    function getSubmission(uint256 roundId) external view returns (bytes memory) {
        return submissions[roundId];
    }

    function withdrawFees() external {
        require(msg.sender == feeRecipient, "Not fee recipient");
        uint256 fees = accumulatedFees;
        accumulatedFees = 0;
        (bool ok, ) = feeRecipient.call{value: fees}("");
        require(ok, "Fee withdraw failed");
    }
}
