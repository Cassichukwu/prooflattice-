/**
 * On-chain agent metadata (mirrors the Solidity struct).
 */
export interface AgentMetadata {
  agentId: number;
  operator: string;
  teeMrEnclave: `0x${string}`;
  teeMrSigner: `0x${string}`;
  zkmlCircuitHash: `0x${string}`;
  teeVerifier: `0x${string}`;
  zkmlVerifier: `0x${string}`;
  firstSeen: number;
  lastAttested: number;
  trustScore: number;
  attestationCount: number;
  bgaCertified: boolean;
  active: boolean;
}

export interface Round {
  roundId: number;
  taskAgentId: number;
  taskType: number;
  taskHash: `0x${string}`;
  stakeRequired: bigint;
  submissionDeadline: number;
  judgmentDeadline: number;
  settlementBlock: number;
  trustDelta: number;
  yesVotes: number;
  noVotes: number;
  state: number;
  staker: `0x${string}`;
}

export enum RoundState {
  OPEN = 0,
  JUDGING = 1,
  SETTLED = 2,
  DISPUTED = 3,
  CANCELLED = 4,
}

export enum TaskType {
  DEF_SWAP = 0,
  RWA_REBALANCE = 1,
  LP_REBALANCE = 2,
  WALLET_PAYMENT = 3,
  GOVERNANCE_VOTE = 4,
  YIELD_OPTIMISE = 5,
}

export const TaskTypeName: Record<number, string> = {
  [TaskType.DEF_SWAP]: "DeFi Swap",
  [TaskType.RWA_REBALANCE]: "RWA Rebalance",
  [TaskType.LP_REBALANCE]: "LP Rebalance",
  [TaskType.WALLET_PAYMENT]: "Wallet Payment",
  [TaskType.GOVERNANCE_VOTE]: "Governance Vote",
  [TaskType.YIELD_OPTIMISE]: "Yield Optimise",
};

export const RoundStateName: Record<number, string> = {
  [RoundState.OPEN]: "Open",
  [RoundState.JUDGING]: "Judging",
  [RoundState.SETTLED]: "Settled",
  [RoundState.DISPUTED]: "Disputed",
  [RoundState.CANCELLED]: "Cancelled",
};
