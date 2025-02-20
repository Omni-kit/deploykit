#!/usr/bin/env node

const { program } = require('commander');
const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

// Hardcoded factory address (same across all chains)
const FACTORY_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // Replace with the actual fixed address

program
  .command('deploy <config>')
  .description('Deploy a contract across multiple chains using SuperchainFactory')
  .action(async (configPath) => {
    try {
      // Read and parse the config file
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const { chains, contractName, constructorArgs, salt, rpcUrl, privateKey } = config;

      // Validate required config fields
      if (!chains || !Array.isArray(chains) || chains.length === 0) {
        throw new Error('Invalid or missing "chains" in config');
      }
      if (!contractName) {
        throw new Error('Missing "contractName" in config');
      }
      if (!salt) {
        throw new Error('Missing "salt" in config');
      }
      if (!rpcUrl) {
        throw new Error('Missing "rpcUrl" in config');
      }
      if (!privateKey) {
        throw new Error('Missing "privateKey" in config');
      }

      // Compile the contract using Forge
      console.log('Compiling contract with forge build...');
      execSync('forge build', { stdio: 'inherit' });

      // Load the compiled artifact
      const artifactPath = `./out/${contractName}.sol/${contractName}.json`;
      if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found at ${artifactPath}`);
      }
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const bytecode = artifact.bytecode.object;

      // Encode constructor arguments (if provided)
      const iface = new ethers.utils.Interface(artifact.abi);
      const encodedArgs = constructorArgs && constructorArgs.length > 0
        ? iface.encodeDeploy(constructorArgs)
        : '0x';

      // Combine bytecode with encoded constructor arguments
      const deployBytecode = ethers.utils.hexConcat([bytecode, encodedArgs]);

      // Format salt as a 32-byte hex string
      const formattedSalt = ethers.utils.hexZeroPad(ethers.utils.toUtf8Bytes(salt), 32);

      // Initialize provider and signer
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // Define the SuperchainFactory ABI with updated return value
      const factoryAbi = [
        'function deployEverywhere(uint256[] calldata chainIds, bytes memory bytecode, bytes memory constructorArgs, bytes32 salt) external returns (address)'
      ];
      const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi, wallet);

      // Deploy the contract across all specified chains
      console.log('Deploying contract across chains:', chains);
      const tx = await factory.deployEverywhere(chains, bytecode, encodedArgs, formattedSalt);
      const receipt = await tx.wait();

      // Extract the deployed address from the transaction return value
      const deployedAddress = tx.value; // For ethers v5, directly accessible from tx after await
      console.log('Transaction hash:', receipt.transactionHash);
      console.log('Deployed contract address on local chain:', deployedAddress);

      // Compute the expected deployment address using CREATE2 (for cross-chain consistency)
      const bytecodeHash = ethers.utils.keccak256(deployBytecode);
      const hash = ethers.utils.keccak256(
        ethers.utils.concat(['0xff', FACTORY_ADDRESS, formattedSalt, bytecodeHash])
      );
      const computedAddress = ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12));
      console.log('Computed CREATE2 address (for all chains):', computedAddress);

      console.log('Contract has been deployed across all specified chains.');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);