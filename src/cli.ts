#!/usr/bin/env node

import { program } from 'commander';
import { ethers, Contract } from 'ethers';
import { TransactionReceipt } from '@ethersproject/providers';
import { loadConfig, loadHubSpokeConfig } from './config';
import { compileContract } from './compile';
import { loadArtifact } from './artifact';
import { formatSalt, computeCreate2Address, computeCreate3Address } from './utils';

// ABI definition for interacting with the factory contract
const factoryAbi = [
  'function deployContract(uint256[] calldata chainIds, bytes memory bytecode, bytes32 salt) external returns (address)',
  'function deployHubAndSpokes(bytes memory hubBytecode, bytes memory spokeBytecode, bytes32 salt, uint256[] calldata spokeChainIds) external returns (address)',
  'event ContractDeployed(address indexed contractAddress, uint256 indexed chainId)',
  'event CrossChainMessageSent(uint256 indexed chainId, address indexed targetFactory)',
];

program
  .command('deploy [configPath]')
  .alias('d')
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

program
  .command('deploy-hs [configPath]')
  .alias('hs')
  .description('Deploy hub and spoke contracts across multiple chains using the same address')
  .action(async (configPath: string | undefined) => {
    try {
      // Load hub-spoke deployment configuration
      const config = await loadHubSpokeConfig(configPath);

      // Retrieve the private key from environment variables
      const privateKey = process.env.PRIVATE_KEY;
      if (!privateKey) {
        throw new Error(
          'PRIVATE_KEY environment variable is not set. Set it with: export PRIVATE_KEY=0xYourPrivateKey'
        );
      }

      // Compile the contracts and load artifacts
      compileContract();
      const hubArtifact = loadArtifact(config.hubContract);
      const spokeArtifact = loadArtifact(config.spokeContract);

      // Prepare hub bytecode and constructor arguments
      const hubIface = new ethers.utils.Interface(hubArtifact.abi);
      const hubBytecode = hubArtifact.bytecode.object;
      const hubEncodedArgs =
        config.hubConstructorArgs && config.hubConstructorArgs.length > 0
          ? hubIface.encodeDeploy(config.hubConstructorArgs)
          : '0x';
      const hubDeployBytecode = ethers.utils.hexConcat([hubBytecode, hubEncodedArgs]);

      // Prepare spoke bytecode and constructor arguments
      const spokeIface = new ethers.utils.Interface(spokeArtifact.abi);
      const spokeBytecode = spokeArtifact.bytecode.object;
      const spokeEncodedArgs =
        config.spokeConstructorArgs && config.spokeConstructorArgs.length > 0
          ? spokeIface.encodeDeploy(config.spokeConstructorArgs)
          : '0x';
      const spokeDeployBytecode = ethers.utils.hexConcat([spokeBytecode, spokeEncodedArgs]);

      // Format the salt
      const formattedSalt = formatSalt(config.salt);

      // Set up provider, wallet, and factory contract
      const provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const factory = new Contract(config.factoryContract, factoryAbi, wallet);

      // Estimate gas for the hub-spoke deployment
      let gasEstimate;
      try {
        gasEstimate = await provider.estimateGas({
          from: wallet.address,
          to: config.factoryContract,
          data: factory.interface.encodeFunctionData('deployHubAndSpokes', [
            hubDeployBytecode,
            spokeDeployBytecode,
            formattedSalt,
            config.spokeChains,
          ]),
        });
        console.log('Estimated gas:', gasEstimate.toString());
      } catch (error) {
        console.warn('Gas estimation failed, using manual gas limit of 6,000,000');
        gasEstimate = 8000000; // Fallback gas limit for hub-spoke deployment
      }

      // Deploy the hub and spoke contracts
      const tx = await factory.deployHubAndSpokes(
        hubDeployBytecode,
        spokeDeployBytecode,
        formattedSalt,
        config.spokeChains,
        {
          gasLimit: gasEstimate,
        }
      );
      const receipt: TransactionReceipt = await tx.wait();

      // Log transaction details
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Extract deployed hub contract address from logs
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
      const hubAddress = ethers.utils.getAddress(parsedEvent.args.contractAddress);
      console.log('Deployed hub contract address on local chain:', hubAddress);

      // Compute and verify CREATE3 address
      const computedAddress = computeCreate3Address(config.factoryContract, formattedSalt);
      console.log('Computed CREATE3 address (used for all chains):', computedAddress);
      if (hubAddress.toLowerCase() !== computedAddress.toLowerCase()) {
        console.warn('Warning: Local deployed address does not match computed CREATE3 address');
      }

      // Log deployment information
      console.log(`Hub contract (${config.hubContract}) deployed on chain ID ${await provider.getNetwork().then(n => n.chainId)}`);
      console.log(`Spoke contract (${config.spokeContract}) deployment initiated on chains:`, config.spokeChains);
      console.log('All contracts will be deployed to the same address:', computedAddress);
    } catch (error) {
      console.error('Error:', (error as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);