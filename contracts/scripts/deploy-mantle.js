// Hardhat deploy script for ProofLattice to Mantle Sepolia
// Mirrors the structure of script/Deploy.s.sol but uses ethers.js
// Usage: npx hardhat run scripts/deploy-mantle.js --network mantleSepolia

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const chainId = (await hre.ethers.provider.getNetwork()).chainId;

  console.log("===================================================");
  console.log("ProofLattice deployment");
  console.log("===================================================");
  console.log("Network:  ", network);
  console.log("Chain ID: ", chainId.toString());
  console.log("Deployer: ", deployer.address);
  console.log("Balance:  ", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "MNT");
  console.log("");

  // Read deployer env (TRUST_ORACLE, FEE_RECIPIENT, USE_MOCK_IDENTITY)
  const trustOracle = process.env.TRUST_ORACLE || deployer.address;
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;
  const useMockIdentity = (process.env.USE_MOCK_IDENTITY || "true").toLowerCase() === "true";

  // 1. Identity registry (mock for testnet)
  console.log("[1/6] Deploying MockERC8004Identity...");
  const MockIdentity = await hre.ethers.getContractFactory("MockERC8004Identity");
  const identity = await MockIdentity.deploy();
  await identity.waitForDeployment();
  const identityAddr = await identity.getAddress();
  console.log("       -> Identity:", identityAddr);

  // 2. TEE verifier (mock for testnet)
  console.log("[2/6] Deploying MockTEEVerifier...");
  const TEE = await hre.ethers.getContractFactory("MockTEEVerifier");
  const tee = await TEE.deploy();
  await tee.waitForDeployment();
  const teeAddr = await tee.getAddress();
  console.log("       -> TEE:     ", teeAddr);

  // 3. zkML verifier (mock for testnet)
  console.log("[3/6] Deploying MockZkMLVerifier...");
  const ZkML = await hre.ethers.getContractFactory("MockZkMLVerifier");
  const zkml = await ZkML.deploy();
  await zkml.waitForDeployment();
  const zkmlAddr = await zkml.getAddress();
  console.log("       -> zkML:    ", zkmlAddr);

  // 4. ProofLatticeRegistry
  console.log("[4/6] Deploying ProofLatticeRegistry...");
  const Registry = await hre.ethers.getContractFactory("ProofLatticeRegistry");
  const registry = await Registry.deploy(identityAddr, trustOracle, teeAddr);
  await registry.waitForDeployment();
  const registryAddr = await registry.getAddress();
  console.log("       -> Registry:", registryAddr);

  // 5. DemosthenesArena
  console.log("[5/6] Deploying DemosthenesArena...");
  const Arena = await hre.ethers.getContractFactory("DemosthenesArena");
  const arena = await Arena.deploy(registryAddr, feeRecipient);
  await arena.waitForDeployment();
  const arenaAddr = await arena.getAddress();
  console.log("       -> Arena:   ", arenaAddr);

  // 6. XBountyBoard
  console.log("[6/6] Deploying XBountyBoard...");
  const Bounty = await hre.ethers.getContractFactory("XBountyBoard");
  const bounty = await Bounty.deploy(registryAddr, arenaAddr, feeRecipient);
  await bounty.waitForDeployment();
  const bountyAddr = await bounty.getAddress();
  console.log("       -> Bounty:  ", bountyAddr);

  // 7. Wire cross-references
  console.log("");
  console.log("[*] Wiring cross-references...");
  let tx1 = await registry.setBountyBoard(bountyAddr);
  await tx1.wait();
  console.log("       -> registry.setBountyBoard(", bountyAddr, ")");
  let tx2 = await registry.setArena(arenaAddr);
  await tx2.wait();
  console.log("       -> registry.setArena(", arenaAddr, ")");

  // 8. Save deployment
  const deployment = {
    network,
    chainId: chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      ProofLatticeRegistry: registryAddr,
      DemosthenesArena: arenaAddr,
      XBountyBoard: bountyAddr,
      TEEVerifier: teeAddr,
      ZkMLVerifier: zkmlAddr,
      IdentityRegistry: identityAddr,
    },
    explorer: "https://sepolia.mantlescan.xyz",
  };

  const outDir = process.env.DEPLOY_OUT || "../deploy";
  const outFile = path.join(outDir, "deployment-mantle.json");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log("");
  console.log("===================================================");
  console.log("DEPLOYED SUCCESSFULLY");
  console.log("===================================================");
  console.log("");
  console.log("Contract addresses:");
  console.log("  ProofLatticeRegistry :", registryAddr);
  console.log("  DemosthenesArena      :", arenaAddr);
  console.log("  XBountyBoard          :", bountyAddr);
  console.log("  TEEVerifier           :", teeAddr);
  console.log("  ZkMLVerifier          :", zkmlAddr);
  console.log("  IdentityRegistry      :", identityAddr);
  console.log("");
  console.log("Mantlescan:");
  console.log("  Registry:  https://sepolia.mantlescan.xyz/address/" + registryAddr);
  console.log("  Arena:     https://sepolia.mantlescan.xyz/address/" + arenaAddr);
  console.log("  Bounty:    https://sepolia.mantlescan.xyz/address/" + bountyAddr);
  console.log("");
  console.log("Saved to:", outFile);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
