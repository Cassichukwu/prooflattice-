"use client";
import { useQuery, gql } from "@apollo/client";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { parseEther, keccak256, toHex } from "viem";

const ARENA_ADDRESS = (process.env.NEXT_PUBLIC_ARENA_ADDRESS || "0x15FeE1802cE22D4d596C025Ace5af7C53e939B56") as `0x${string}`;

const ARENA_ABI = [
  {
    name: "openRound",
    type: "function",
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
    name: "submitDecision",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "decision", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "judge",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "roundId", type: "uint256" },
      { name: "judgeIdx", type: "uint256" },
      { name: "approve", type: "bool" },
    ],
    outputs: [],
  },
  {
    name: "settle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "roundId", type: "uint256" }],
    outputs: [],
  },
] as const;

const ROUNDS = gql`
  query Rounds {
    rounds {
      roundId
      taskAgentId
      taskTypeName
      taskHash
      stakeRequired
      yesVotes
      noVotes
      stateName
      trustDelta
      judges
      staker
      settlementBlock
    }
    liveRounds {
      roundId
      taskAgentId
      taskTypeName
      yesVotes
      noVotes
      judges
      stateName
    }
  }
`;

const STATES = ["All", "Open", "Judging", "Settled", "Disputed", "Cancelled"];
const TASK_TYPE_VALUES = ["DeFi Swap", "RWA Rebalance", "LP Rebalance", "Wallet Payment", "Governance Vote", "Yield Optimise"];

const STATE_COLORS: Record<string, string> = {
  Open: "bg-blue-500/20 text-blue-300",
  Judging: "bg-yellow-500/20 text-yellow-300",
  Settled: "bg-green-500/20 text-green-300",
  Disputed: "bg-red-500/20 text-red-300",
  Cancelled: "bg-white/10 text-white/40",
};

function generateTaskHash(): string {
  const random = Math.random().toString(36).substring(2);
  return keccak256(toHex(random + Date.now()));
}

export default function ArenaPage() {
  const { data, loading, refetch } = useQuery(ROUNDS, { pollInterval: 8000 });
  const { isConnected } = useAccount();
  const [stateFilter, setStateFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [selectedRound, setSelectedRound] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [taskAgentId, setTaskAgentId] = useState("1");
  const [taskType, setTaskType] = useState(0);
  const [taskHash, setTaskHash] = useState(generateTaskHash());
  const [stake, setStake] = useState("0.01");

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 1500);
  };

  const { writeContract: openRoundWrite, data: openHash, isPending: openPending } = useWriteContract();
  const { writeContract: submitWrite, data: submitHash, isPending: submitPending } = useWriteContract();
  const { writeContract: judgeWrite, data: judgeHash, isPending: judgePending } = useWriteContract();
  const { writeContract: settleWrite, data: settleHash, isPending: settlePending } = useWriteContract();

  const { isSuccess: openSuccess } = useWaitForTransactionReceipt({ hash: openHash });
  const { isSuccess: submitSuccess } = useWaitForTransactionReceipt({ hash: submitHash });
  const { isSuccess: judgeSuccess } = useWaitForTransactionReceipt({ hash: judgeHash });
  const { isSuccess: settleSuccess } = useWaitForTransactionReceipt({ hash: settleHash });

  const prevOpen = useRef(false);
  const prevSubmit = useRef(false);
  const prevJudge = useRef(false);
  const prevSettle = useRef(false);

  useEffect(() => {
    if (openSuccess && !prevOpen.current) {
      prevOpen.current = true;
      showToast("✅ Round opened! Click it and Submit Decision quickly.");
      setShowModal(false);
      setTimeout(() => refetch(), 2000);
    }
    if (!openSuccess) prevOpen.current = false;
  }, [openSuccess, showToast, refetch]);

  useEffect(() => {
    if (submitSuccess && !prevSubmit.current) {
      prevSubmit.current = true;
      showToast("✅ Decision submitted! Click Refresh to see Judging state.");
      setSelectedRound(null);
      setTimeout(() => refetch(), 2000);
    }
    if (!submitSuccess) prevSubmit.current = false;
  }, [submitSuccess, showToast, refetch]);

  useEffect(() => {
    if (judgeSuccess && !prevJudge.current) {
      prevJudge.current = true;
      showToast("✅ Vote submitted! Click Refresh.");
      setSelectedRound(null);
      setTimeout(() => refetch(), 2000);
    }
    if (!judgeSuccess) prevJudge.current = false;
  }, [judgeSuccess, showToast, refetch]);

  useEffect(() => {
    if (settleSuccess && !prevSettle.current) {
      prevSettle.current = true;
      showToast("✅ Round settled! Trust score updated.");
      setSelectedRound(null);
      setTimeout(() => refetch(), 2000);
    }
    if (!settleSuccess) prevSettle.current = false;
  }, [settleSuccess, showToast, refetch]);

  const handleOpenRound = () => {
    try {
      const stakeWei = parseEther(stake);
      openRoundWrite({
        address: ARENA_ADDRESS,
        abi: ARENA_ABI,
        functionName: "openRound",
        args: [BigInt(taskAgentId), taskType, taskHash as `0x${string}`, stakeWei],
        value: stakeWei,
      });
    } catch (e) {
      showToast("Transaction failed: " + String(e), "error");
    }
  };

  const handleSubmitDecision = (roundId: string) => {
    try {
      submitWrite({
        address: ARENA_ADDRESS,
        abi: ARENA_ABI,
        functionName: "submitDecision",
        args: [BigInt(roundId), toHex("decision") as `0x${string}`],
      });
    } catch (e) {
      showToast("Failed. You must be the task agent operator and deadline must not have passed.", "error");
    }
  };

  const handleJudge = (roundId: string, judgeIdx: number, approve: boolean) => {
    try {
      judgeWrite({
        address: ARENA_ADDRESS,
        abi: ARENA_ABI,
        functionName: "judge",
        args: [BigInt(roundId), BigInt(judgeIdx), approve],
      });
    } catch (e) {
      showToast("Vote failed. You must be an assigned judge.", "error");
    }
  };

  const handleSettle = (roundId: string) => {
    try {
      settleWrite({
        address: ARENA_ADDRESS,
        abi: ARENA_ABI,
        functionName: "settle",
        args: [BigInt(roundId)],
      });
    } catch (e) {
      showToast("Settle failed: " + String(e), "error");
    }
  };

  const rounds = data?.rounds ?? [];
  const liveRounds = data?.liveRounds ?? [];
  const filtered = rounds.filter((r: any) => stateFilter === "All" || r.stateName === stateFilter);

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-lg shadow-lg font-medium max-w-sm ${toast.type === "success" ? "bg-green-500/90 text-white" : "bg-red-500/90 text-white"}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold gradient-text mb-2">🏛️ Demosthenes Arena</h1>
          <p className="text-white/60">Where agents judge agents. Every verdict is on-chain.</p>
        </div>
        <div className="flex items-center gap-3">
          {liveRounds.length > 0 && (
            <span className="flex items-center gap-2 text-sm text-yellow-300 bg-yellow-500/10 px-3 py-1 rounded-full">
              <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
              {liveRounds.length} Live
            </span>
          )}
          <button onClick={handleRefresh} disabled={refreshing}
            className="px-4 py-2 bg-white/10 text-white/70 rounded-lg hover:bg-white/20 text-sm disabled:opacity-50">
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
          {isConnected && (
            <button onClick={() => setShowModal(true)} className="btn-primary">+ New Round</button>
          )}
        </div>
      </div>

      {/* Arena Flow Guide */}
      <div className="glass p-4 rounded-xl border border-white/5">
        <div className="text-xs text-white/40 mb-3 uppercase tracking-wider">Arena Flow</div>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full">1️⃣ Open Round</span>
          <span className="text-white/30">→</span>
          <span className="bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">2️⃣ Submit Decision</span>
          <span className="text-white/30">→</span>
          <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full">3️⃣ Judges Vote</span>
          <span className="text-white/30">→</span>
          <span className="bg-green-500/20 text-green-300 px-3 py-1 rounded-full">4️⃣ Settle → Trust Updates</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {STATES.map((s) => (
          <button key={s} onClick={() => setStateFilter(s)}
            className={`px-3 py-1 rounded-full text-sm ${stateFilter === s ? "bg-lattice/30 text-lattice border border-lattice/50" : "bg-white/5 text-white/50 hover:bg-white/10"}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Rounds */}
      {loading ? (
        <div className="text-white/40 text-center py-12">Loading rounds from blockchain...</div>
      ) : filtered.length === 0 ? (
        <div className="glass p-12 text-center text-white/40">
          <p className="text-2xl mb-2">🏛️</p>
          <p>No rounds found. {stateFilter !== "All" ? `Try "All" filter or ` : ""}Be the first to open one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <div key={r.roundId} onClick={() => setSelectedRound(r)}
              className="glass p-5 cursor-pointer hover:border-lattice/30 border border-white/5 rounded-xl transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-white/40 text-sm font-mono">#{r.roundId}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATE_COLORS[r.stateName] || "bg-white/10 text-white/40"}`}>
                    {r.stateName}
                  </span>
                  <span className="text-sm text-white/70">{r.taskTypeName}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm text-white/80">Agent #{r.taskAgentId}</div>
                  <div className="text-xs text-white/40">{r.stakeRequired}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400">✓ {r.yesVotes} YES</span>
                <span className="text-red-400">✗ {r.noVotes} NO</span>
                <span className="text-white/30 ml-auto text-xs">{r.judges?.length ?? 0} judges · click to interact</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Open Round Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Open New Round</h2>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white text-2xl">×</button>
            </div>
            <div className="text-xs text-yellow-300 bg-yellow-500/10 p-3 rounded-lg">
              ⚠️ After opening, click Submit Decision immediately (within ~2 minutes).
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">Task Agent ID</label>
              <input type="number" min="1" value={taskAgentId}
                onChange={(e) => setTaskAgentId(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">Task Type</label>
              <select value={taskType} onChange={(e) => setTaskType(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm">
                {TASK_TYPE_VALUES.map((t, i) => (<option key={i} value={i}>{t}</option>))}
              </select>
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">Task Hash</label>
              <div className="flex gap-2">
                <input value={taskHash} onChange={(e) => setTaskHash(e.target.value)}
                  className="flex-1 bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono" />
                <button onClick={() => setTaskHash(generateTaskHash())}
                  className="px-3 py-2 bg-white/10 rounded text-xs hover:bg-white/20">Generate</button>
              </div>
            </div>
            <div>
              <label className="text-sm text-white/60 block mb-1">Stake (MNT)</label>
              <input type="number" step="0.001" min="0.01" value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm" />
            </div>
            <button onClick={handleOpenRound} disabled={openPending}
              className="btn-primary w-full disabled:opacity-50">
              {openPending ? "Confirm in wallet..." : `Open Round (stake ${stake} MNT)`}
            </button>
          </div>
        </div>
      )}

      {/* Round Detail Modal */}
      {selectedRound && (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4">
          <div className="glass rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Round #{selectedRound.roundId}</h2>
              <button onClick={() => setSelectedRound(null)} className="text-white/40 hover:text-white text-2xl">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-white/40 text-xs">Status</div>
                <span className={`px-2 py-0.5 rounded-full text-xs ${STATE_COLORS[selectedRound.stateName]}`}>
                  {selectedRound.stateName}
                </span>
              </div>
              <div>
                <div className="text-white/40 text-xs">Task Type</div>
                <div>{selectedRound.taskTypeName}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">Agent</div>
                <Link href={`/agent/${selectedRound.taskAgentId}`} className="text-lattice hover:underline">
                  #{selectedRound.taskAgentId}
                </Link>
              </div>
              <div>
                <div className="text-white/40 text-xs">Staker</div>
                <div className="font-mono text-xs">
                  {selectedRound.staker && selectedRound.staker !== "0x0000000000000000000000000000000000000000"
                    ? `${selectedRound.staker.slice(0, 8)}...${selectedRound.staker.slice(-4)}`
                    : "On-chain"}
                </div>
              </div>
              <div>
                <div className="text-white/40 text-xs">YES Votes</div>
                <div className="text-green-400 font-bold">{selectedRound.yesVotes}</div>
              </div>
              <div>
                <div className="text-white/40 text-xs">NO Votes</div>
                <div className="text-red-400 font-bold">{selectedRound.noVotes}</div>
              </div>
            </div>
            <div>
              <div className="text-white/40 text-xs mb-1">Task Hash</div>
              <div className="font-mono text-xs text-white/60 break-all bg-black/20 p-2 rounded">
                {selectedRound.taskHash}
              </div>
            </div>
            <div>
              <div className="text-white/40 text-xs mb-2">Judges ({selectedRound.judges?.length ?? 0})</div>
              <div className="flex flex-wrap gap-2">
                {selectedRound.judges?.length > 0 ? selectedRound.judges.map((j: string, idx: number) => (
                  <Link key={idx} href={`/agent/${j}`}
                    className="text-xs font-mono bg-white/5 px-2 py-1 rounded hover:text-lattice">#{j}</Link>
                )) : (
                  <span className="text-xs text-white/30">No judges assigned</span>
                )}
              </div>
            </div>

            {isConnected && (
              <div className="space-y-3 pt-2 border-t border-white/5">
                {selectedRound.stateName === "Open" && (
                  <button onClick={() => handleSubmitDecision(selectedRound.roundId)}
                    disabled={submitPending}
                    className="w-full px-4 py-2 bg-blue-500/20 text-blue-300 rounded-lg hover:bg-blue-500/30 disabled:opacity-50 text-sm">
                    {submitPending ? "Submitting..." : "📋 Submit Decision → Move to Judging"}
                  </button>
                )}
                {selectedRound.stateName === "Judging" && (
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <button onClick={() => handleJudge(selectedRound.roundId, 0, true)}
                        disabled={judgePending}
                        className="flex-1 px-4 py-2 bg-green-500/20 text-green-300 rounded-lg hover:bg-green-500/30 disabled:opacity-50 text-sm">
                        {judgePending ? "..." : "✓ Vote YES"}
                      </button>
                      <button onClick={() => handleJudge(selectedRound.roundId, 0, false)}
                        disabled={judgePending}
                        className="flex-1 px-4 py-2 bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 disabled:opacity-50 text-sm">
                        {judgePending ? "..." : "✗ Vote NO"}
                      </button>
                    </div>
                    <button onClick={() => handleSettle(selectedRound.roundId)}
                      disabled={settlePending}
                      className="w-full px-4 py-2 bg-yellow-500/20 text-yellow-300 rounded-lg hover:bg-yellow-500/30 disabled:opacity-50 text-sm">
                      {settlePending ? "Settling..." : "⚖️ Settle Round"}
                    </button>
                  </div>
                )}
                {selectedRound.stateName === "Settled" && (
                  <div className="text-center text-green-400 text-sm py-2">
                    ✅ Round settled. Trust score updated on-chain.
                  </div>
                )}
              </div>
            )}
            {!isConnected && (
              <div className="text-center text-white/40 text-sm py-2">
                Connect your wallet to interact with this round.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}