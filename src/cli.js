#!/usr/bin/env node

const { program } = require('commander');
const { ethers } = require('ethers');
const fs = require('fs');
const { execSync } = require('child_process');

program
  .command('deploy <config>')
  .description('Deploy a contract across multiple chains using SuperchainFactory')
  .action(async (config) => {
    try {
      // Read and parse the config file
      const configData = JSON.parse(fs.readFileSync(config, 'utf8'));
      const { chains, factoryAddress, contractName, constructorArgs, salt, rpcUrl, privateKey } = configData;

      // Ensure the contract is compiled
      console.log('Compiling contract with forge build...');
      execSync('forge build', { stdio: 'inherit' });

      // Read the compiled artifact
      const artifactPath = `./out/${contractName}.sol/${contractName}.json`;
      if (!fs.existsSync(artifactPath)) throw new Error(`Artifact not found at ${artifactPath}`);
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      const bytecode = artifact.bytecode.object;

      // Encode constructor arguments
      const iface = new ethers.utils.Interface(artifact.abi);
      const encodedArgs = constructorArgs.length > 0 ? iface.encodeDeploy(constructorArgs) : '0x';

      // Prepare deployment bytecode
      const deployBytecode = ethers.utils.hexConcat([bytecode, encodedArgs]);

      // Format salt as 32-byte hex string
      const formattedSalt = ethers.utils.hexZeroPad(ethers.utils.toUtf8Bytes(salt), 32);

      // Set up provider and signer
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      // Connect to SuperchainFactory
      const factoryAbi = [
        'function deployEverywhere(uint256[] calldata chainIds, bytes memory bytecode, bytes memory constructorArgs, bytes32 salt) external'
      ];
      const factory = new ethers.Contract(factoryAddress, factoryAbi, wallet);

      // Send the deployment transaction
      console.log('Deploying contract across chains:', chains);
      const tx = await factory.deployEverywhere(chains, bytecode, encodedArgs, formattedSalt);
      const receipt = await tx.wait();
      console.log('Transaction hash:', receipt.transactionHash);

      // Compute the expected deployment address
      const bytecodeHash = ethers.utils.keccak256(deployBytecode);
      const hash = ethers.utils.keccak256(
        ethers.utils.concat(['0xff', factoryAddress, formattedSalt, bytecodeHash])
      );
      const computedAddress = ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12));
      console.log('Computed contract address:', computedAddress);
      console.log('Contract will be deployed at this address on all specified chains once cross-chain messages are processed.');
    } catch (error) {
      console.error('Error:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);