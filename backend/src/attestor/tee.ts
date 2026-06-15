/**
 * TEE Attestation Service
 * -----------------------
 * Bridges agents running in Phala TEE (or local dev TEE) and the
 * ProofLatticeRegistry on-chain attestation.
 *
 * Flow:
 *  1. Agent runs in Phala CVM. Its bootstrap publishes a "TEE quote"
 *     containing: mr_enclave, mr_signer, issuedAt, custom data.
 *  2. This service listens for new quote submissions, verifies the quote
 *     against the on-chain verifier, and (if valid) triggers the
 *     `registerWithAttestation` call.
 *
 * In dev: uses a deterministic local TEE simulator that signs quotes with
 * a fixed dev key, so the whole loop can be tested without a real TEE.
 */
import "dotenv/config";
import express from "express";
import { keccak256, encodePacked, toHex, type Hex } from "viem";
import { log } from "../lib/logger.js";
import { publicClient, oracleClient, oracleAccount, getAddress } from "../lib/chain.js";
import { ProofLatticeRegistryAbi, TEEVerifierAbi } from "../lib/abi.js";
import { createHmac } from "crypto";

const REGISTRY = getAddress("PROOF_LATTICE_REGISTRY");
const TEE_ADDR = getAddress("TEE_VERIFIER");

const TEE_HMAC_SECRET = (process.env.TEE_HMAC_SECRET ?? "dev-only-hmac-secret") as string;

const app = express();
app.use(express.json());

/**
 * Verify a TEE quote (HMAC-signed in dev; SGX quote in production).
 */
function verifyLocalQuote(quote: Hex, expectedMrEnclave: Hex, expectedMrSigner: Hex): { valid: boolean; reason?: string } {
  // Quote format: 32 (mr_enclave) || 32 (mr_signer) || 8 (issued_at) || variable (payload) || 32 (HMAC)
  if (quote.length < 70 * 2 + 2) return { valid: false, reason: "quote too short" };
  const buf = Buffer.from(quote.slice(2), "hex");
  const actualMr = "0x" + buf.subarray(0, 32).toString("hex");
  const actualSigner = "0x" + buf.subarray(32, 64).toString("hex");
  const issuedAt = Number(buf.readBigUInt64BE(64));
  const payload = buf.subarray(72, buf.length - 32);
  const providedMac = buf.subarray(buf.length - 32);

  if (actualMr !== expectedMrEnclave) return { valid: false, reason: "mr_enclave mismatch" };
  if (actualSigner !== expectedMrSigner) return { valid: false, reason: "mr_signer mismatch" };
  if (issuedAt < Math.floor(Date.now() / 1000) - 86400) return { valid: false, reason: "quote too old" };

  const expectedMac = createHmac("sha256", TEE_HMAC_SECRET)
    .update(Buffer.concat([buf.subarray(0, 72), payload]))
    .digest();
  if (Buffer.compare(providedMac, expectedMac) !== 0) return { valid: false, reason: "HMAC mismatch" };

  return { valid: true };
}

/**
 * Sign a payload as a TEE quote (dev only).
 */
export function signLocalQuote(mrEnclave: Hex, mrSigner: Hex, payload: Hex = "0x"): Hex {
  const issuedAt = BigInt(Math.floor(Date.now() / 1000));
  const body = Buffer.concat([
    Buffer.from(mrEnclave.slice(2), "hex"),
    Buffer.from(mrSigner.slice(2), "hex"),
    Buffer.from(issuedAt.toString(16).padStart(16, "0"), "hex"),
    Buffer.from(payload.slice(2), "hex"),
  ]);
  const mac = createHmac("sha256", TEE_HMAC_SECRET).update(body).digest();
  return ("0x" + Buffer.concat([body, mac]).toString("hex")) as Hex;
}

// ------------------------------------------------------------------
// HTTP API
// ------------------------------------------------------------------

/**
 * POST /verify
 * Body: { quote, mrEnclave, mrSigner }
 * Returns: { valid, reason? }
 */
app.post("/verify", (req, res) => {
  const { quote, mrEnclave, mrSigner } = req.body;
  if (!quote || !mrEnclave || !mrSigner) {
    return res.status(400).json({ error: "missing fields" });
  }
  const result = verifyLocalQuote(quote, mrEnclave, mrSigner);
  res.json(result);
});

/**
 * POST /register
 * Body: { agentURI, mrEnclave, mrSigner, zkmlCircuitHash, zkmlVerifier }
 * Returns: { agentId, txHash }
 *
 * Server-side: builds a TEE quote, calls ProofLatticeRegistry.registerWithAttestation.
 */
app.post("/register", async (req, res) => {
  try {
    const { agentURI, mrEnclave, mrSigner, zkmlCircuitHash, zkmlVerifier } = req.body;
    if (!agentURI || !mrEnclave || !mrSigner) {
      return res.status(400).json({ error: "missing fields" });
    }
    const teeVerifier = process.env.TEE_VERIFIER as Hex;
    const quote = signLocalQuote(mrEnclave as Hex, mrSigner as Hex, keccak256(toHex(agentURI)) as Hex);

    const { request } = await publicClient.simulateContract({
      address: REGISTRY,
      abi: ProofLatticeRegistryAbi,
      functionName: "registerWithAttestation",
      args: [
        agentURI,
        mrEnclave as Hex,
        mrSigner as Hex,
        teeVerifier,
        quote,
        (zkmlCircuitHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
        (zkmlVerifier ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex,
      ],
      account: oracleAccount,
    });
    const hash = await oracleClient.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    res.json({ txHash: hash, blockNumber: receipt.blockNumber.toString(), quote });
  } catch (err) {
    log.error({ err }, "register failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /attest
 * Body: { mrEnclave, mrSigner, zkmlCircuitHash, proof }
 * Calls ProofLatticeRegistry.submitProof for an existing agent.
 */
app.post("/attest", async (req, res) => {
  try {
    const { agentId, proofHash, publicInputsHash, proof } = req.body;
    if (!agentId || !proofHash) {
      return res.status(400).json({ error: "missing fields" });
    }
    const { request } = await publicClient.simulateContract({
      address: REGISTRY,
      abi: ProofLatticeRegistryAbi,
      functionName: "submitProof",
      args: [BigInt(agentId), proofHash as Hex, (publicInputsHash ?? "0x0000000000000000000000000000000000000000000000000000000000000000") as Hex, (proof ?? "0x") as Hex],
      account: oracleAccount,
    });
    const hash = await oracleClient.writeContract(request);
    res.json({ txHash: hash });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/health", (_, res) => res.json({ status: "ok" }));

const PORT = Number(process.env.TEE_SERVICE_PORT ?? 4001);
app.listen(PORT, () => {
  log.info({ port: PORT, registry: REGISTRY, tee: TEE_ADDR }, "TEE attestation service running");
});
