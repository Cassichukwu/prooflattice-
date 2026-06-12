// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ProofLatticeRegistry.sol";

/// @title XBountyBoard
/// @notice Permissionless bounty board: anyone can stake MNT to challenge an
///         agent's reputation claim. If a Demosthenes round invalidates the
///         agent's proofs, the accuser wins (most of) the slashed stake.
contract XBountyBoard is Ownable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    enum BountyState { OPEN, CHALLENGED, RESOLVED_GUILTY, RESOLVED_INNOCENT, EXPIRED }

    struct Bounty {
        uint256 bountyId;
        uint256 accusedAgentId;
        address accuser;
        string  claimURI;             // IPFS hash with evidence
        bytes32 claimHash;            // Hash of the claim
        uint256 stake;                // MNT staked by accuser
        uint256 challengedRoundId;    // Demosthenes round that resolves it
        BountyState state;
        uint64  createdAt;
        uint64  resolvedAt;
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    ProofLatticeRegistry public registry;
    address public arena;                 // DemosthenesArena
    address public feeRecipient;
    uint256 public bountyCount;
    uint256 public constant ACCUSER_REWARD_BPS = 7000;   // 70% to accuser on guilty
    uint256 public constant AGENT_REWARD_BPS   = 2000;   // 20% back to agent
    uint256 public constant FEE_BPS            = 1000;   // 10% to fee recipient

    mapping(uint256 => Bounty) public bounties;
    mapping(uint256 => uint256[]) public agentBounties;   // agentId => bountyIds[]

    uint256 public totalStake;
    uint256 public totalSlashed;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event BountyFiled(
        uint256 indexed bountyId,
        uint256 indexed accusedAgentId,
        address indexed accuser,
        uint256 stake,
        string claimURI
    );

    event BountyChallenged(uint256 indexed bountyId, uint256 indexed roundId);
    event BountyResolvedGuilty(uint256 indexed bountyId, uint256 payout);
    event BountyResolvedInnocent(uint256 indexed bountyId, uint256 refund);
    event BountyExpired(uint256 indexed bountyId);

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(address _registry, address _arena, address _feeRecipient) Ownable(msg.sender) {
        registry = ProofLatticeRegistry(_registry);
        arena = _arena;
        feeRecipient = _feeRecipient;
    }

    // ------------------------------------------------------------------
    // File a bounty
    // ------------------------------------------------------------------

    /// @notice File a bounty accusing an agent of faking reputation.
    ///         The accuser must stake MNT; if guilty, 70% is paid back as reward.
    function fileBounty(
        uint256 accusedAgentId,
        string calldata claimURI,
        bytes32 claimHash
    ) external payable nonReentrant returns (uint256 bountyId) {
        require(msg.value > 0, "Zero stake");
        (, , , , , , , , , , bool active) = registry.agentMeta(accusedAgentId);
        require(active, "Agent not active");

        bountyId = ++bountyCount;
        bounties[bountyId] = Bounty({
            bountyId: bountyId,
            accusedAgentId: accusedAgentId,
            accuser: msg.sender,
            claimURI: claimURI,
            claimHash: claimHash,
            stake: msg.value,
            challengedRoundId: 0,
            state: BountyState.OPEN,
            createdAt: uint64(block.timestamp),
            resolvedAt: 0
        });

        agentBounties[accusedAgentId].push(bountyId);
        totalStake += msg.value;

        emit BountyFiled(bountyId, accusedAgentId, msg.sender, msg.value, claimURI);
    }

    // ------------------------------------------------------------------
    // Trigger a Demosthenes round to resolve the bounty
    // ------------------------------------------------------------------

    /// @notice Link this bounty to a Demosthenes round; the round's verdict resolves it.
    function linkToRound(uint256 bountyId, uint256 roundId) external {
        require(msg.sender == arena, "Not arena");
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.OPEN, "Not open");
        b.challengedRoundId = roundId;
        b.state = BountyState.CHALLENGED;
        emit BountyChallenged(bountyId, roundId);
    }

    // ------------------------------------------------------------------
    // Resolve
    // ------------------------------------------------------------------

    function resolveGuilty(uint256 bountyId, uint16 newAgentScore) external {
        require(msg.sender == arena, "Not arena");
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.CHALLENGED, "Not challenged");

        b.state = BountyState.RESOLVED_GUILTY;
        b.resolvedAt = uint64(block.timestamp);

        // Slash the agent
        (, , , , , , , uint16 currentScore, , , ) = registry.agentMeta(b.accusedAgentId);
        if (newAgentScore < currentScore) {
            registry.slash(b.accusedAgentId, newAgentScore, "Bounty resolved guilty");
        }

        // Distribute stake
        uint256 accuserPayout = (b.stake * ACCUSER_REWARD_BPS) / 10000;
        uint256 feePayout     = (b.stake * FEE_BPS) / 10000;
        uint256 totalPayout   = accuserPayout + feePayout;
        totalSlashed += b.stake;

        (bool ok1, ) = b.accuser.call{value: accuserPayout}("");
        require(ok1, "Accuser payout failed");
        if (feePayout > 0 && feeRecipient != address(0)) {
            (bool ok2, ) = feeRecipient.call{value: feePayout}("");
            require(ok2, "Fee payout failed");
        }

        emit BountyResolvedGuilty(bountyId, totalPayout);
    }

    function resolveInnocent(uint256 bountyId) external {
        require(msg.sender == arena, "Not arena");
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.CHALLENGED, "Not challenged");

        b.state = BountyState.RESOLVED_INNOCENT;
        b.resolvedAt = uint64(block.timestamp);

        // Refund accuser (with small slash to deter spam)
        uint256 refund = (b.stake * 80) / 100;  // 80% refund
        uint256 fee    = b.stake - refund;
        totalSlashed += fee;

        (bool ok1, ) = b.accuser.call{value: refund}("");
        require(ok1, "Refund failed");
        if (fee > 0 && feeRecipient != address(0)) {
            (bool ok2, ) = feeRecipient.call{value: fee}("");
            require(ok2, "Fee payout failed");
        }

        emit BountyResolvedInnocent(bountyId, refund);
    }

    // ------------------------------------------------------------------
    // Expiry
    // ------------------------------------------------------------------

    function expireBounty(uint256 bountyId) external {
        Bounty storage b = bounties[bountyId];
        require(b.state == BountyState.OPEN, "Not open");
        require(block.timestamp > b.createdAt + 30 days, "Too early");

        b.state = BountyState.EXPIRED;
        b.resolvedAt = uint64(block.timestamp);

        (bool ok, ) = b.accuser.call{value: b.stake}("");
        require(ok, "Refund failed");

        emit BountyExpired(bountyId);
    }

    // ------------------------------------------------------------------
    // View helpers
    // ------------------------------------------------------------------

    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    function getBountiesForAgent(uint256 agentId) external view returns (uint256[] memory) {
        return agentBounties[agentId];
    }
}
