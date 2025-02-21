import { ethers } from 'ethers';

/**
 * Formats the salt into a 32-byte hex string.
 * @param salt - User-provided salt.
 * @returns Formatted salt.
 */
function formatSalt(salt: string): string {
  return ethers.utils.hexZeroPad(ethers.utils.toUtf8Bytes(salt), 32);
}

/**
 * Computes the CREATE2 address for the deployed contract.
 * @param factoryAddress - Factory contract address.
 * @param salt - Formatted salt.
 * @param deployBytecode - Bytecode with encoded arguments.
 * @returns Computed address.
 */
function computeCreate2Address(factoryAddress: string, salt: string, deployBytecode: string): string {
  const bytecodeHash = ethers.utils.keccak256(deployBytecode);
  const hash = ethers.utils.keccak256(ethers.utils.concat(['0xff', factoryAddress, salt, bytecodeHash]));
  return ethers.utils.getAddress(ethers.utils.hexDataSlice(hash, 12));
}

export { formatSalt, computeCreate2Address };