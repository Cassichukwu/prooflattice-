// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IERC8004.sol";
import "./interfaces/ITEEVerifier.sol";

/// @title ProofLatticeRegistry
/// @notice On-chain reputation + TEE-attested + zkML-bound registry for AI agents on Mantle.
///         Wraps ERC-8004 Identity Registry and adds TEE measurement + zkML circuit binding,
///         proof history, and oracle-updatable trust score.
contract ProofLatticeRegistry is Ownable, ReentrancyGuard {
    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    struct AgentMetadata {
        bytes32 teeMrEnclave;        // TEE measurement of agent runtime
        bytes32 teeMrSigner;         // TEE signer measurement
        bytes32 zkmlCircuitHash;     // Hash of zkML circuit (0 if not used)
        address teeVerifier;         // TEE attestation verifier contract
        address zkmlVerifier;        // zkML verifier contract (0 if not used)
        uint64  firstSeen;           // Block timestamp at registration
        uint64  lastAttested;        // Last block timestamp the agent re-attested
        uint16  trustScore;          // 0-1000, oracle-updated
        uint16  attestationCount;    // How many times the agent re-attested
        bool    bgaCertified;        // BGA-certified social-good flag
        bool    active;              // Active agent
    }

    // ------------------------------------------------------------------
    // State
    // ------------------------------------------------------------------

    IERC8004Identity public immutable identityRegistry;
    address public trustOracle;          // Off-chain trust engine signer
    address public bountyBoard;          // Bounty board that can slash
    address public arena;                // Demosthenes arena that can award

    mapping(uint256 => AgentMetadata) public agentMeta;   // agentId => metadata
    mapping(uint256 => bytes32[]) public proofHistory;    // agentId => ring of proof hashes
    mapping(uint256 => bytes32[]) public teeHistory;      // agentId => ring of TEE quotes
    mapping(address => uint256) public agentIdByOperator; // operator => agentId
    mapping(bytes32 => bool)    public seenProofs;        // proof hash => already seen
    mapping(bytes32 => bool)    public seenTeeQuotes;     // mr enclave + nonce => seen

    // Track # of agents and total proofs
    uint256 public totalAgents;
    uint256 public totalProofs;

    // ------------------------------------------------------------------
    // Events
    // ------------------------------------------------------------------

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed operator,
        bytes32 teeMrEnclave,
        bytes32 zkmlCircuitHash,
        address teeVerifier
    );

    event AgentReattested(
        uint256 indexed agentId,
        bytes32 indexed newMrEnclave,
        uint16 attestationCount
    );

    event ProofSubmitted(
        uint256 indexed agentId,
        bytes32 indexed proofHash,
        uint256 blockNumber
    );

    event TrustScoreUpdated(
        uint256 indexed agentId,
        uint16 oldScore,
        uint16 newScore,
        uint256 blockNumber
    );

    event BgaCertified(uint256 indexed agentId, bool certified);
    event AgentSlashed(uint256 indexed agentId, uint16 oldScore, uint16 newScore, string reason);

    // ------------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------------

    modifier onlyOperator(uint256 agentId) {
        require(identityRegistry.ownerOf(agentId) == msg.sender, "Not operator");
        _;
    }

    modifier onlyOracle() {
        require(msg.sender == trustOracle, "Not oracle");
        _;
    }

    modifier onlyBountyBoard() {
        require(msg.sender == bountyBoard, "Not bounty board");
        _;
    }

    // ------------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------------

    constructor(
        address _identityRegistry,
        address _trustOracle,
        address _teeVerifier
    ) Ownable(msg.sender) {
        require(_identityRegistry != address(0), "Zero identity registry");
        identityRegistry = IERC8004Identity(_identityRegistry);
        trustOracle = _trustOracle;
        // teeVerifier at the registry level is just a default suggestion;
        // per-agent verifier is set at registration.
    }

    // ------------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------------

    function setTrustOracle(address newOracle) external onlyOwner {
        trustOracle = newOracle;
    }

    function setBountyBoard(address newBountyBoard) external onlyOwner {
        bountyBoard = newBountyBoard;
    }

    function setArena(address newArena) external onlyOwner {
        arena = newArena;
    }

    function setBgaCertified(uint256 agentId, bool certified) external onlyOwner {
        agentMeta[agentId].bgaCertified = certified;
        emit BgaCertified(agentId, certified);
    }

    // ------------------------------------------------------------------
    // Registration
    // ------------------------------------------------------------------

    /// @notice Register a new agent with TEE attestation (and optional zkML circuit).
    /// @param agentURI The ERC-8004 registration file URI (IPFS, HTTPS, etc.)
    /// @param teeMrEnclave The expected TEE measurement register
    /// @param teeMrSigner The expected TEE signer measurement
    /// @param teeVerifier The TEE verifier contract for this agent
    /// @param teeQuote The TEE quote bytes
    /// @param zkmlCircuitHash The hash of the zkML circuit (or 0 if unused)
    /// @param zkmlVerifier The zkML verifier address (or 0 if unused)
    /// @return agentId The newly registered agent ID
    function registerWithAttestation(
        string calldata agentURI,
        bytes32 teeMrEnclave,
        bytes32 teeMrSigner,
        address teeVerifier,
        bytes calldata teeQuote,
        bytes32 zkmlCircuitHash,
        address zkmlVerifier
    ) external nonReentrant returns (uint256) {
        require(teeVerifier != address(0), "Zero TEE verifier");
        require(teeMrEnclave != bytes32(0), "Zero mr_enclave");

        // 1. Verify TEE quote
        require(
            ITEEVerifier(teeVerifier).verifyQuote(
                teeQuote, teeMrEnclave, teeMrSigner, uint64(block.timestamp - 1 days)
            ),
            "Invalid TEE quote"
        );

        // 2. Mint ERC-8004 identity
        bytes32[] memory attestations = new bytes32[](2);
        attestations[0] = teeMrEnclave;
        attestations[1] = zkmlCircuitHash;
        uint256 agentId = identityRegistry.register(msg.sender, agentURI, attestations);

        // 3. Store metadata
        agentMeta[agentId] = AgentMetadata({
            teeMrEnclave:    teeMrEnclave,
            teeMrSigner:     teeMrSigner,
            zkmlCircuitHash: zkmlCircuitHash,
            teeVerifier:     teeVerifier,
            zkmlVerifier:    zkmlVerifier,
            firstSeen:       uint64(block.timestamp),
            lastAttested:    uint64(block.timestamp),
            trustScore:      500,            // baseline
            attestationCount: 1,
            bgaCertified:    false,
            active:          true
        });

        // 4. Record TEE quote
        bytes32 quoteKey = keccak256(abi.encodePacked(teeMrEnclave, teeQuote));
        require(!seenTeeQuotes[quoteKey], "TEE quote replay");
        seenTeeQuotes[quoteKey] = true;
        teeHistory[agentId].push(keccak256(teeQuote));

        // 5. Index by operator
        require(agentIdByOperator[msg.sender] == 0, "Operator already registered");
        agentIdByOperator[msg.sender] = agentId;

        totalAgents++;

        emit AgentRegistered(agentId, msg.sender, teeMrEnclave, zkmlCircuitHash, teeVerifier);
        emit AgentReattested(agentId, teeMrEnclave, 1);
        return agentId;
    }

    /// @notice Re-attest TEE measurement (e.g., after runtime upgrade)
    function reattest(
        uint256 agentId,
        bytes32 newMrEnclave,
        bytes32 newMrSigner,
        bytes calldata teeQuote
    ) external onlyOperator(agentId) nonReentrant {
        AgentMetadata storage m = agentMeta[agentId];
        require(m.active, "Not active");
        require(
            ITEEVerifier(m.teeVerifier).verifyQuote(
                teeQuote, newMrEnclave, newMrSigner, uint64(block.timestamp - 1 days)
            ),
            "Invalid TEE quote"
        );

        bytes32 quoteKey = keccak256(abi.encodePacked(newMrEnclave, teeQuote));
        require(!seenTeeQuotes[quoteKey], "TEE quote replay");
        seenTeeQuotes[quoteKey] = true;

        m.teeMrEnclave = newMrEnclave;
        m.teeMrSigner = newMrSigner;
        m.lastAttested = uint64(block.timestamp);
        m.attestationCount += 1;

        teeHistory[agentId].push(keccak256(teeQuote));

        emit AgentReattested(agentId, newMrEnclave, m.attestationCount);
    }

    // ------------------------------------------------------------------
    // Proofs
    // ------------------------------------------------------------------

    /// @notice Submit a zkML proof hash for a decision the agent made.
    /// @param agentId The agent ID
    /// @param proofHash The hash of the zkML proof (off-chain prover posts this)
    /// @param publicInputsHash The hash of the public inputs (decision context)
    /// @param proof Optional: the proof bytes (for verifier-integrated mode)
    function submitProof(
        uint256 agentId,
        bytes32 proofHash,
        bytes32 publicInputsHash,
        bytes calldata proof
    ) external onlyOperator(agentId) {
        require(agentMeta[agentId].active, "Not active");
        require(!seenProofs[proofHash], "Proof already seen");
        seenProofs[proofHash] = true;

        // If zkML verifier is configured, verify the proof on-chain
        if (agentMeta[agentId].zkmlVerifier != address(0) && proof.length > 0) {
            require(
                IZkMLVerifier(agentMeta[agentId].zkmlVerifier).verifyProof(
                    agentMeta[agentId].zkmlCircuitHash, publicInputsHash, proof
                ),
                "Invalid zkML proof"
            );
        }

        proofHistory[agentId].push(proofHash);
        totalProofs++;

        emit ProofSubmitted(agentId, proofHash, block.number);
    }

    // ------------------------------------------------------------------
    // Trust Score Updates
    // ------------------------------------------------------------------

    /// @notice Update the trust score (called by the trust oracle / engine)
    function updateTrustScore(uint256 agentId, uint16 newScore) external onlyOracle {
        require(newScore <= 1000, "Score > 1000");
        uint16 old = agentMeta[agentId].trustScore;
        agentMeta[agentId].trustScore = newScore;
        emit TrustScoreUpdated(agentId, old, newScore, block.number);
    }

    /// @notice Bounty board slashes an agent (called only by the bounty board)
    function slash(uint256 agentId, uint16 newScore, string calldata reason) external onlyBountyBoard {
        require(newScore < agentMeta[agentId].trustScore, "Score not lower");
        uint16 old = agentMeta[agentId].trustScore;
        agentMeta[agentId].trustScore = newScore;
        emit AgentSlashed(agentId, old, newScore, reason);
        emit TrustScoreUpdated(agentId, old, newScore, block.number);
    }

    /// @notice Arena awards an agent (called only by the arena contract)
    function award(uint256 agentId, uint16 newScore) external {
        require(msg.sender == arena, "Not arena");
        require(newScore > agentMeta[agentId].trustScore, "Score not higher");
        uint16 old = agentMeta[agentId].trustScore;
        agentMeta[agentId].trustScore = newScore;
        emit TrustScoreUpdated(agentId, old, newScore, block.number);
    }

    /// @notice Deactivate an agent (operator resignation)
    function deactivate(uint256 agentId) external onlyOperator(agentId) {
        agentMeta[agentId].active = false;
    }

    // ------------------------------------------------------------------
    // View helpers
    // ------------------------------------------------------------------

    function getAgent(uint256 agentId) external view returns (AgentMetadata memory) {
        return agentMeta[agentId];
    }

    function getProofHistoryLength(uint256 agentId) external view returns (uint256) {
        return proofHistory[agentId].length;
    }

    function getTeeHistoryLength(uint256 agentId) external view returns (uint256) {
        return teeHistory[agentId].length;
    }
}
