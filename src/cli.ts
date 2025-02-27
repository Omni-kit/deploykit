#!/usr/bin/env node

import { program } from 'commander';
import { ethers, Contract } from 'ethers';
import { TransactionReceipt } from '@ethersproject/providers';
import { loadConfig } from './config';
import { compileContract } from './compile';
import { loadArtifact } from './artifact';
import { formatSalt, computeCreate2Address } from './utils';

// ABI definition for interacting with the factory contract
const factoryAbi = [
  'function deployContract(uint256[] calldata chainIds, bytes memory bytecode, bytes32 salt) external returns (address)',
  'event ContractDeployed(address indexed contractAddress, uint256 indexed chainId)',
  'event CrossChainMessageSent(uint256 indexed chainId, address indexed targetFactory)',
];

program
  .command('deploy [configPath]')
  .description('Deploy a contract across multiple chains using DeploymentFactory')
  .action(async (configPath: string | undefined) => {
    try {
      // Load deployment configuration
      const config = await loadConfig(configPath);

      // Retrieve the private key from environment variables
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error(
          'PRIVATE_KEY environment variable is not set. Set it with: export PRIVATE_KEY=0xYourPrivateKey'
        );
      }

      // Compile the contract and load its artifact
      compileContract();
      const artifact = loadArtifact(config.contractName);

      // Prepare bytecode and constructor arguments
      const iface = new ethers.utils.Interface(artifact.abi);
      const bytecode = artifact.bytecode.object;
      const encodedArgs =
        config.constructorArgs && config.constructorArgs.length > 0
          ? iface.encodeDeploy(config.constructorArgs)
          : '0x';
      const deployBytecode = ethers.utils.hexConcat([bytecode, encodedArgs]);
      const formattedSalt = formatSalt(config.salt);

      // Set up provider, wallet, and factory contract
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const factory = new Contract(config.factoryContract, factoryAbi, wallet);

      // Estimate gas for the deployment transaction
      let gasEstimate;
      try {
        gasEstimate = await provider.estimateGas({
          from: wallet.address,
          to: config.factoryContract,
          data: factory.interface.encodeFunctionData('deployContract', [
            config.chains,
            deployBytecode,
            formattedSalt,
          ]),
        });
        console.log('Estimated gas:', gasEstimate.toString());
      } catch (error) {
        console.warn('Gas estimation failed, using manual gas limit of 5,000,000');
        gasEstimate = 5000000; // Fallback gas limit
      }

      // Deploy the contract
      const tx = await factory.deployContract(config.chains, deployBytecode, formattedSalt, {
        gasLimit: gasEstimate,
      });
      const receipt: TransactionReceipt = await tx.wait();

      // Log transaction details
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Extract deployed contract address from logs
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

      const parsedEvent = factoryInterface.parseLog(event);
      const deployedAddress = ethers.utils.getAddress(parsedEvent.args.contractAddress);
      console.log('Deployed contract address on local chain:', deployedAddress);

      // Compute and verify CREATE2 address
      const computedAddress = computeCreate2Address(config.factoryContract, formattedSalt, deployBytecode);
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

program.parse(process.argv);