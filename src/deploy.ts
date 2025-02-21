import { Contract } from 'ethers';
import { TransactionReceipt } from '@ethersproject/providers';

/**
 * Deploys the contract across multiple chains using the factory.
 * @param factory - SuperchainFactory contract instance.
 * @param chains - Array of chain IDs.
 * @param bytecode - Contract bytecode.
 * @param encodedArgs - Encoded constructor arguments.
 * @param formattedSalt - Formatted salt.
 * @returns Transaction receipt.
 */
async function deployContract(
  factory: Contract,
  chains: number[],
  bytecode: string,
  encodedArgs: string,
  formattedSalt: string
): Promise<TransactionReceipt> {
  console.log('Deploying contract across chains:', chains);
  const tx = await factory.deployEverywhere(chains, bytecode, encodedArgs, formattedSalt, {
    gasLimit: 5000000, // Optional: Adjust if needed
  });
  const receipt = await tx.wait();
  return receipt;
}

export { deployContract };