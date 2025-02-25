# Deploykit User Flow

This guide walks you through how to use `omni-deployer` to deploy your smart contracts across multiple chains using the `SuperchainFactory`.

## Prerequisites

Before starting:
- Ensure **Node.js** (16.x+) and **npm** are installed.
- Install **Foundry** globally (`forge` command available). [Instructions](https://book.getfoundry.sh/getting-started/installation).
- Have a private key for the deployment account ready (set as an environment variable).

## Step-by-Step User Flow

### 1. Install Omni-Deployer

Before deploying, install the Omni-Deployer library:

```bash
npm i @omni-kit/omni-deployer
```

### 1. Run Supersim Anvil

Before deploying, start the supersim anvil to simulate the Superchain environment:

```bash
supersim fork --network=sepolia --chains=op,base,mode --interop.autorelay
```

### Option 1: Using a Config File

#### 2. Create Your Smart Contract

Write your contract in a Foundry project (e.g., `src/TestToken.sol`):

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

#### 3. Set Up Your Config File

Create `superchain.json` in your project root, add the configuration using below format:

```json
{
  "chains": [11155420, 84532, 919],
  "contractName": "TestToken",
  "constructorArgs": ["MyToken", "MTK"],
  "rpcUrl": "http://127.0.0.1:9545",
  "salt": "mysalt"
}
```

**Fields:**
- `chains`: Chain IDs to deploy to.
- `contractName`: Matches your contract file (e.g., `TestToken.sol`).
- `constructorArgs`: Arguments for your contract’s constructor.
- `rpcUrl`: RPC endpoint of the initiating chain.
- `salt`: String for deterministic deployment.

#### 4. Set Your Private Key

Export your private key securely:

```bash
export PRIVATE_KEY=0xYourPrivateKey
```

#### 5. Run Omni-Deployer

In your project directory:

```bash
omni-deployer deploy superchain.json
```

#### 6. What Happens
- Compiles your contract with `forge build`.
- Deploys to the chain at `rpcUrl` and sends cross-chain messages to other chains.
- Outputs the transaction hash and deployed addresses.

#### 7. Verify Output

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

#### 2. Create Your Smart Contract

Same as above (e.g., `src/TestToken.sol`).

#### 3. Set Your Private Key

Export your private key:

```bash
export PRIVATE_KEY=0xYourPrivateKey
```

#### 4. Run Omni-Deployer Without a Config

In your project directory:

```bash
omni-deployer deploy
```

#### 5. Follow the Prompts

Enter the Details accordingly, and then verify the output as shown above.
  
## Conclusion

By following this guide, you can efficiently deploy your smart contracts across multiple chains using `omni-deployer`. Whether you choose a configuration file or interactive mode, `omni-deployer` simplifies multi-chain deployments. 

For further assistance, refer to the official documentation or open an issue in the repository. Happy deploying! 🚀
