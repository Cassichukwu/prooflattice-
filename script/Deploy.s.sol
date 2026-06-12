// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/ProofLatticeRegistry.sol";
import "../src/DemosthenesArena.sol";
import "../src/XBountyBoard.sol";
import "../src/MockERC8004Identity.sol";
import "../src/MockTEEVerifier.sol";
import "../src/MockZkMLVerifier.sol";

/// @notice Deploys the entire ProofLattice stack to Mantle L2 (testnet or mainnet).
///         In production, replace MockERC8004Identity with the canonical
///         ERC-8004 Identity Registry address on Mantle.
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address identityRegistryAddr = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
        bool useMockIdentity = vm.envOr("USE_MOCK_IDENTITY", true);
        address trustOracle = vm.envAddress("TRUST_ORACLE");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        vm.startBroadcast(pk);

        // 1. Identity registry (mock or real)
        address identity;
        if (useMockIdentity) {
            MockERC8004Identity mockId = new MockERC8004Identity();
            identity = address(mockId);
        } else {
            identity = identityRegistryAddr;
        }

        // 2. TEE + zkML verifiers (mock for testnet; real for mainnet)
        MockTEEVerifier tee = new MockTEEVerifier();
        MockZkMLVerifier zkml = new MockZkMLVerifier();

        // 3. ProofLatticeRegistry
        ProofLatticeRegistry registry = new ProofLatticeRegistry(
            identity,
            trustOracle,
            address(tee)
        );
        console.log("ProofLatticeRegistry:", address(registry));

        // 4. DemosthenesArena
        DemosthenesArena arena = new DemosthenesArena(
            address(registry),
            feeRecipient
        );
        console.log("DemosthenesArena:", address(arena));

        // 5. XBountyBoard
        XBountyBoard bounty = new XBountyBoard(
            address(registry),
            address(arena),
            feeRecipient
        );
        console.log("XBountyBoard:", address(bounty));

        // 6. Wire cross-references
        registry.setBountyBoard(address(bounty));
        registry.setArena(address(arena));

        // 7. Save deployment addresses
        _saveDeployment(
            address(registry),
            address(arena),
            address(bounty),
            address(tee),
            address(zkml),
            identity
        );

        vm.stopBroadcast();
    }

    function _saveDeployment(
        address registry,
        address arena,
        address bounty,
        address tee,
        address zkml,
        address identity
    ) internal {
        string memory json = string.concat(
            "{\n",
            '  "ProofLatticeRegistry": "', vm.toString(registry), '",\n',
            '  "DemosthenesArena": "', vm.toString(arena), '",\n',
            '  "XBountyBoard": "', vm.toString(bounty), '",\n',
            '  "TEEVerifier": "', vm.toString(tee), '",\n',
            '  "ZkMLVerifier": "', vm.toString(zkml), '",\n',
            '  "IdentityRegistry": "', vm.toString(identity), '"\n',
            "}\n"
        );
        string memory path = string.concat(
            vm.envString("DEPLOY_OUT"),
            "/deployment.json"
        );
        vm.writeFile(path, json);
        console.log("Wrote", path);
    }
}
