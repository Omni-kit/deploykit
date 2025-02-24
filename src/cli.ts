#!/usr/bin/env node

import { program } from 'commander';
import { ethers, Contract } from 'ethers';
import { TransactionReceipt } from '@ethersproject/providers';
import { loadConfig } from './config';
import { compileContract } from './compile';
import { loadArtifact } from './artifact';
import { formatSalt, computeCreate2Address } from './utils';
import { deployContract } from './deploy';

const FACTORY_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; //CHANGE THE FACTORY CONTRACT ADDRESS

// ABI definition for interacting with the factory contract
const factoryAbi = [
  'function deployContract(uint256[] calldata chainIds, bytes memory bytecode, bytes32 salt) external returns (address)',
  'event ContractDeployed(address indexed contractAddress, uint256 indexed chainId)',
  'event CrossChainMessageSent(uint256 indexed chainId, address indexed targetFactory)'
];

program
  .command('deploy [configPath]')
  .description('Deploy a contract across multiple chains using DeploymentFactory')
  .action(async (configPath: string | undefined) => {
    try {
      // Load deployment configuration from a given file path
      const config = await loadConfig(configPath);

      // Retrieve the private key from environment variables
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('PRIVATE_KEY environment variable is not set. Set it with: export PRIVATE_KEY=0xYourPrivateKey');
      }

      // Compile the contract before attempting deployment
      compileContract();
      const artifact = loadArtifact(config.contractName);

      // Prepare the contract bytecode and constructor arguments for deployment
      const iface = new ethers.utils.Interface(artifact.abi);
      const bytecode = artifact.bytecode.object;
      const encodedArgs = config.constructorArgs && config.constructorArgs.length > 0
        ? iface.encodeDeploy(config.constructorArgs)
        : '0x';
      const deployBytecode = ethers.utils.hexConcat([bytecode, encodedArgs]);
      const formattedSalt = formatSalt(config.salt);

      // Set up provider and wallet to interact with the blockchain
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const factory = new Contract(FACTORY_ADDRESS, factoryAbi, wallet);

      // Initiate contract deployment via the factory contract
      const tx = await factory.deployContract(config.chains, deployBytecode, formattedSalt);
      const receipt: TransactionReceipt = await tx.wait();

      // Parse the transaction receipt logs to extract the deployed contract address
      const factoryInterface = new ethers.utils.Interface(factoryAbi);
      const event = receipt.logs.find((log: ethers.providers.Log) => {
        try {
          const parsed = factoryInterface.parseLog(log);
          return parsed.name === 'ContractDeployed';
        } catch {
          return false;
        }
      });

      if (!event) {
        throw new Error('ContractDeployed event not found in receipt');
      }

      // Retrieve and display the deployed contract address from the event logs
      const parsedEvent = factoryInterface.parseLog(event);
      const deployedAddress = ethers.utils.getAddress(parsedEvent.args.contractAddress);
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Deployed contract address on local chain:', deployedAddress);

      // Compute the expected CREATE2 deployment address for verification
      const computedAddress = computeCreate2Address(FACTORY_ADDRESS, formattedSalt, deployBytecode);
      console.log('Computed CREATE2 address (for all chains):', computedAddress);
      if (deployedAddress.toLowerCase() !== computedAddress.toLowerCase()) {
        console.warn('Warning: Local deployed address does not match computed CREATE2 address');
      }

      console.log('Contract deployment initiated across specified chains.');
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

// Parse command-line arguments and execute the specified command
program.parse(process.argv);
