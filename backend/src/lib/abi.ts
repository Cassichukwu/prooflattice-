/**
 * ABIs extracted from the Solidity contracts.
 * In production, run `forge build` and consume the JSON ABIs from `out/`.
 */
export const ProofLatticeRegistryAbi = [
  {
    type: "function",
    name: "registerWithAttestation",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentURI", type: "string" },
      { name: "teeMrEnclave", type: "bytes32" },
      { name: "teeMrSigner", type: "bytes32" },
      { name: "teeVerifier", type: "address" },
      { name: "teeQuote", type: "bytes" },
      { name: "zkmlCircuitHash", type: "bytes32" },
      { name: "zkmlVerifier", type: "address" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitProof",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "proofHash", type: "bytes32" },
      { name: "publicInputsHash", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateTrustScore",
    stateMutability: "nonpayable",
    inputs: [
      { name: "agentId", type: "uint256" },
      { name: "newScore", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "agentMeta",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "teeMrEnclave", type: "bytes32" },
          { name: "teeMrSigner", type: "bytes32" },
          { name: "zkmlCircuitHash", type: "bytes32" },
          { name: "teeVerifier", type: "address" },
          { name: "zkmlVerifier", type: "address" },
          { name: "firstSeen", type: "uint64" },
          { name: "lastAttested", type: "uint64" },
          { name: "trustScore", type: "uint16" },
          { name: "attestationCount", type: "uint16" },
          { name: "bgaCertified", type: "bool" },
          { name: "active", type: "bool" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getProofHistoryLength",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalAgents",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "totalProofs",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "operator", type: "address" },
      { indexed: false, name: "teeMrEnclave", type: "bytes32" },
      { indexed: false, name: "zkmlCircuitHash", type: "bytes32" },
      { indexed: false, name: "teeVerifier", type: "address" },
    ],
  },
  {
    type: "event",
    name: "TrustScoreUpdated",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "oldScore", type: "uint16" },
      { indexed: false, name: "newScore", type: "uint16" },
      { indexed: false, name: "blockNumber", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "ProofSubmitted",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: true, name: "proofHash", type: "bytes32" },
      { indexed: false, name: "blockNumber", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "AgentSlashed",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "oldScore", type: "uint16" },
      { indexed: false, name: "newScore", type: "uint16" },
      { indexed: false, name: "reason", type: "string" },
    ],
  },
  {
    type: "event",
    name: "BgaCertified",
    inputs: [
      { indexed: true, name: "agentId", type: "uint256" },
      { indexed: false, name: "certified", type: "bool" },
    ],
  },
] as const;

export const DemosthenesArenaAbi = [
  {
    type: "function",
    name: "openRound",
    stateMutability: "payable",
    inputs: [
      { name: "taskAgentId", type: "uint256" },
      { name: "taskType", type: "uint8" },
      { name: "taskHash", type: "bytes32" },
      { name: "stakeRequired", type: "uint256" },
    ],
    outputs: [{ name: "roundId", type: "uint256" }],
  },
  {
    type: "function",
    name: "submitDecision",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "decision", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "judge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "judgeIdx", type: "uint256" },
      { name: "approve", type: "bool" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "roundCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getRound",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "roundId", type: "uint256" },
          { name: "taskAgentId", type: "uint256" },
          { name: "taskType", type: "uint8" },
          { name: "taskHash", type: "bytes32" },
          { name: "stakeRequired", type: "uint256" },
          { name: "submissionDeadline", type: "uint256" },
          { name: "judgmentDeadline", type: "uint256" },
          { name: "settlementBlock", type: "uint256" },
          { name: "trustDelta", type: "int16" },
          { name: "yesVotes", type: "uint16" },
          { name: "noVotes", type: "uint16" },
          { name: "state", type: "uint8" },
          { name: "staker", type: "address" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getJudges",
    stateMutability: "view",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
  {
    type: "event",
    name: "RoundOpened",
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: true, name: "taskAgentId", type: "uint256" },
      { indexed: false, name: "taskType", type: "uint8" },
      { indexed: false, name: "taskHash", type: "bytes32" },
      { indexed: false, name: "stakeRequired", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "RoundSettled",
    inputs: [
      { indexed: true, name: "roundId", type: "uint256" },
      { indexed: false, name: "trustDelta", type: "int16" },
      { indexed: false, name: "yesVotes", type: "uint16" },
      { indexed: false, name: "noVotes", type: "uint16" },
    ],
  },
] as const;

export const XBountyBoardAbi = [
  {
    type: "function",
    name: "fileBounty",
    stateMutability: "payable",
    inputs: [
      { name: "accusedAgentId", type: "uint256" },
      { name: "claimURI", type: "string" },
      { name: "claimHash", type: "bytes32" },
    ],
    outputs: [{ name: "bountyId", type: "uint256" }],
  },
  {
    type: "function",
    name: "resolveGuilty",
    stateMutability: "nonpayable",
    inputs: [
      { name: "bountyId", type: "uint256" },
      { name: "newAgentScore", type: "uint16" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "bountyCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBounty",
    stateMutability: "view",
    inputs: [{ name: "bountyId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "bountyId", type: "uint256" },
          { name: "accusedAgentId", type: "uint256" },
          { name: "accuser", type: "address" },
          { name: "claimURI", type: "string" },
          { name: "claimHash", type: "bytes32" },
          { name: "stake", type: "uint256" },
          { name: "challengedRoundId", type: "uint256" },
          { name: "state", type: "uint8" },
          { name: "createdAt", type: "uint64" },
          { name: "resolvedAt", type: "uint64" },
        ],
      },
    ],
  },
  {
    type: "event",
    name: "BountyFiled",
    inputs: [
      { indexed: true, name: "bountyId", type: "uint256" },
      { indexed: true, name: "accusedAgentId", type: "uint256" },
      { indexed: true, name: "accuser", type: "address" },
      { indexed: false, name: "stake", type: "uint256" },
      { indexed: false, name: "claimURI", type: "string" },
    ],
  },
  {
    type: "event",
    name: "BountyResolvedGuilty",
    inputs: [
      { indexed: true, name: "bountyId", type: "uint256" },
      { indexed: false, name: "payout", type: "uint256" },
    ],
  },
] as const;

export const TEEVerifierAbi = [
  {
    type: "function",
    name: "verifyQuote",
    stateMutability: "view",
    inputs: [
      { name: "quote", type: "bytes" },
      { name: "expectedMrEnclave", type: "bytes32" },
      { name: "expectedMrSigner", type: "bytes32" },
      { name: "minIssuedAt", type: "uint64" },
    ],
    outputs: [{ name: "valid", type: "bool" }],
  },
  {
    type: "function",
    name: "revokeMrEnclave",
    stateMutability: "nonpayable",
    inputs: [{ name: "mr", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "approveMrEnclave",
    stateMutability: "nonpayable",
    inputs: [{ name: "mr", type: "bytes32" }],
    outputs: [],
  },
] as const;

export const IdentityRegistryAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "agentId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
