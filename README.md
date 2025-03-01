# OmniKit User Flow

This guide walks you through how to use `omni-deployer` to deploy your smart contracts across multiple chains using the `SuperchainFactory`. The package supports two main commands:

- **`deploy`**: Deploys the same contract on multiple chains at the same address.
- **`deploy-hs`**: Deploys hub-and-spoke contracts (with potentially different bytecodes) on the same address across multiple chains.

## What is the Hub and Spoke Contract Architecture

<p align="center">
  <img src="https://github.com/user-attachments/assets/c8510a07-9f55-4780-86bd-b770ed9713ba" width="500" height="600">
</p>

- **Central Hub:** One main contract on Chain-A that stores all data and handles all write operations.
- **Multiple Spokes:** Contracts on separate chains (B, C, D) that only make cross-chain calls to the Hub Contract.
- **Data Management:** All storage variables and state changes happen only in the Hub, creating a single source of truth.
- **Frontend Access:** Frontend reads data from the Hub only but can interact with either Hub or Spoke depending on which chain the user is connected to.

## Prerequisites

> **Note:** If you are using Windows OS, you must run these commands inside **WSL (Windows Subsystem for Linux)** to ensure compatibility with Foundry and other tools.

Before starting:
- Ensure **Node.js** (16.x+) and **npm** are installed.
- Install **Foundry** globally (`forge` command available). [Instructions](https://book.getfoundry.sh/getting-started/installation).
- Install **Supersim** by following [Instructions](https://github.com/ethereum-optimism/supersim). (Optional if you're deploying on Superchain Devnets)
- Have a private key for the deployment account ready (set as an environment variable).

## Step-by-Step User Flow

### 1. Initialize Foundry Project

Before deploying, initialize a Foundry project:

```bash
forge init my-foundry-project
cd my-foundry-project
```

### 2. Install Omni-Deployer

Install the Omni-Deployer library:

```bash
npm i @omni-kit/omni-deployer
```

### 3. Run Supersim Anvil (Optional For Superchain Devnet Users)

> Note: If you are deploying contracts on Superchain Devnets as per the Optimism Console, you don’t need to follow this step or install Supersim.

Start the Supersim Anvil to simulate the Superchain environment. You can specify the chains you want the contracts to deploy on:

```bash
supersim fork --network=sepolia --chains=op,base,mode --interop.autorelay
```

### 4. Create Your Smart Contracts

#### Example for `deploy` (Single Contract)

```solidity
// src/TestToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
```

#### Example for `deploy-hs` (Hub-and-Spoke Contracts)

```solidity
// src/HubContract.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HubContract {
    address public admin;

    constructor(address _admin) {
        admin = _admin;
    }

    function doHubAction() external {
        // Hub-specific logic
    }
}
```

```solidity
// src/SpokeContract.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SpokeContract {
    address public adminAddress;

    constructor(address _adminAddress) {
        adminAddress = _adminAddress;
    }

    function doSpokeAction() external {
        // Spoke-specific logic
    }
}
```

### 5. Set Up Your Config File (Optional)

#### For `deploy` (Single Contract)

Create a file named `superchain.json` in your project root:

```json
{
  "chains": [420120000, 420120001],
  "factoryContract": "0x5a0632d24ddae5B4CB511aBB134561b9396473b4",
  "contractName": "TestToken",
  "constructorArgs": ["MyToken", "MTK"],
  "rpcUrl": "https://interop-alpha-0.optimism.io",
  "salt": "mysalt"
}
```

#### For `deploy-hs` (Hub-and-Spoke Contracts)

Create a file named `hubAndSpokeConfig.json` in your project root:

```json
{
  "chains": [420120000, 420120001],
  "factoryContract": "0x5a0632d24ddae5B4CB511aBB134561b9396473b4",
  "hubContract": "HubContract",
  "spokeContract": "SpokeContract",
  "hubConstructorArgs": ["0xYourAdminAddress"],
  "spokeConstructorArgs": ["0xYourAdminAddress"],
  "salt": "deployHS",
  "rpcUrl": "https://interop-alpha-0.optimism.io"
}
```

### 6. Set Your Private Key

Export your private key securely:

```bash
export PRIVATE_KEY=0xYourPrivateKey
```

### 7. Run Omni-Deployer

#### With a Config File

For `deploy` (Single Contract):

```bash
npx omni-deployer deploy superchain.json
```

For `deploy-hs` (Hub-and-Spoke Contracts):

```bash
npx omni-deployer deploy-hs hubAndSpokeConfig.json
```

#### Without a Config File (Interactive Mode)

For `deploy`:

```bash
npx omni-deployer deploy
```

For `deploy-hs`:

```bash
npx omni-deployer deploy-hs
```

You’ll be asked to provide:
- **Chain IDs:** Comma-separated list (e.g., `420120000,420120001`).
- **Factory Contract Address:** use **`0x5a0632d24ddae5B4CB511aBB134561b9396473b4`** address (currently deployed on OP-BASE-MODE sepolia, Superchain Devnets 0 & 1).
- **Contract Name(s):** For `deploy`, enter the contract name; for `deploy-hs`, enter hub and spoke contract names.
- **Constructor Arguments:** Enter as a JSON array (e.g., `{"0xYourAdminAddress"}`) or comma-separated list.
- **Salt:** Enter a salt string (e.g., `deployHS`).
- **RPC URL:** Enter the RPC endpoint (e.g., `https://interop-alpha-0.optimism.io`).

### 8. What Happens

- Compiles your contracts with `forge build`.
- For `deploy`: Deploys the contract to the chain at `rpcUrl` and sends cross-chain messages to deploy it on other chains at the same address.
- For `deploy-hs`: Deploys the hub contract on the chain at `rpcUrl` and sends cross-chain messages to deploy spoke contracts on the chains listed in `chains` at the same address.
- Outputs the transaction hash and deployed addresses.
- checkout [Omnikit](https://github.com/Omni-kit/omnikit/blob/main/src/CrossChainDeploymentFactory.sol) to working of the Contract underhood.

### 9. Verify Output

#### Example for `deploy`

```
Compiling contract with forge build...
Deploying contract across chains: [420120000, 420120001]
Transaction hash: 0x...
Deployed contract address on local chain: 0x...
Computed CREATE2 address (for all chains): 0x...
Contract has been deployed across all specified chains.
```

#### Example for `deploy-hs`

```
Compiling contracts with forge build...
Deploying hub and spoke contracts...
Transaction hash: 0x...
Deployed hub contract address on local chain: 0x...
Computed CREATE3 address (for all chains): 0x...
Hub and spoke contracts have been deployed across specified chains.
```

## Conclusion

With `omni-deployer`, you can easily deploy contracts across multiple chains using either a configuration file or interactive prompts. The `deploy` command is ideal for deploying identical contracts, while `deploy-hs` supports hub-and-spoke architectures with different bytecodes at the same address.

For further assistance, refer to the official documentation or open an issue in the repository. Happy deploying! 🚀
