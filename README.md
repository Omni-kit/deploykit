# Deploykit User Flow

This guide walks you through how to use `omni-deployer` to deploy your smart contracts across multiple chains using the `SuperchainFactory`.

## Prerequisites

> **Note:** If you are using Windows OS, you must run these commands inside **WSL (Windows Subsystem for Linux)** to ensure compatibility with Foundry and other tools.

Before starting:
- Ensure **Node.js** (16.x+) and **npm** are installed.
- Install **Foundry** globally (`forge` command available). [Instructions](https://book.getfoundry.sh/getting-started/installation).
- Install **Supersim** by following [Instructions](https://github.com/ethereum-optimism/supersim). (optional if you're deploying on Superchain Devnets)
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

> **Note:** If you are deploying contracts Superchain Devnets on as per the [the Optimism Console](https://console.optimism.io/getting-started), then you don't have to follow Step:3 or installing the  supersim

Start the Supersim Anvil to simulate the Superchain environment. You can specify the chains you want the contracts to deploy on:

```bash
supersim fork --network=sepolia --chains=op,base,mode --interop.autorelay
```

---

### Option 1: Using a Config File

#### 4. Create Your Smart Contract

Write your contract in your Foundry project (e.g., `src/TestToken.sol`):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {
        _mint(msg.sender, 1_000_000 * 10 ** decimals());
    }
}
```

#### 5. Set Up Your Config File

Create a file named `superchain.json` in your project root with the following structure:

```json
{
  "chains": [420120000, 420120001],
  "factoryContract": "0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966",
  "contractName": "TestToken",
  "constructorArgs": ["MyToken", "MTK"],
  "rpcUrl": "https://interop-alpha-0.optimism.io",
  "salt": "mysalt"
}
```

**Fields:**
- **chains:** Chain IDs to deploy to.
- **factoryContract:** Address of the SuperchainFactory contract.
  - For deployments on Superchain Devnets 0 and 1 (as per [the Optimism Console](https://console.optimism.io/getting-started)), use:
    ```
    "factoryContract": "0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966"
    ```
  - For deployments on forked OP Sepolia, Base Sepolia, and Mode Sepolia chains, use:
    ```
    "factoryContract": "0x6Aac2c1414489A8362AC2feac5EE448Bf7199A14"
    ```
- **contractName:** Matches your contract file (e.g., `TestToken.sol`).
- **constructorArgs:** Arguments for your contract’s constructor.
- **rpcUrl:** RPC endpoint of the initiating chain.
- **salt:** String for deterministic deployment.

#### 6. Set Your Private Key

Export your private key securely:

```bash
export PRIVATE_KEY=0xYourPrivateKey
```

#### 7. Run Omni-Deployer

In your project directory, deploy using the config file:

```bash
npx omni-deployer deploy superchain.json
```

#### 8. What Happens

- Compiles your contract with `forge build`.
- Deploys to the chain at `rpcUrl` and sends cross-chain messages to other chains.
- Outputs the transaction hash and deployed addresses.

#### 9. Verify Output

Example output:

```
Compiling contract with forge build...
Deploying contract across chains: [901, 902]
Transaction hash: 0x...
Deployed contract address on local chain: 0x...
Computed CREATE2 address (for all chains): 0x...
Contract has been deployed across all specified chains.
```

---

### Option 2: Interactive Mode

#### 4. Create Your Smart Contract

Write your contract as shown above (e.g., `src/TestToken.sol`).

#### 5. Set Your Private Key

Export your private key:

```bash
export PRIVATE_KEY=0xYourPrivateKey
```

#### 6. Run Omni-Deployer Without a Config

In your project directory, run:

```bash
npx omni-deployer deploy
```

#### 7. Follow the Prompts

You will be asked to enter the following details:
- **Chain IDs:** Enter as a comma-separated list (e.g., `901, 902`).
- **Factory Contract Address:** 
  - For Superchain Devnets 0 and 1: `0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966`
  - For forked OP Sepolia, Base Sepolia, and Mode Sepolia chains: `0x6Aac2c1414489A8362AC2feac5EE448Bf7199A14`
- **Contract Name:** Enter your contract name (e.g., `TestToken`).
- **Constructor Arguments:** Enter as a JSON array (e.g., `["MyToken", "MTK"]`) or as a comma-separated list (e.g., `MyToken, MTK`).
- **Salt:** Enter a salt string (e.g., `mysalt`).
- **RPC URL:** Enter the RPC endpoint (e.g., `http://127.0.0.1:9545`).

Verify the output as shown in the config file option above.

## Conclusion

By following this guide, you can efficiently deploy your smart contracts across multiple chains using `omni-deployer`. Whether you choose a configuration file or interactive mode, `omni-deployer` simplifies multi-chain deployments.

For further assistance, refer to the official documentation or open an issue in the repository. Happy deploying! 🚀
