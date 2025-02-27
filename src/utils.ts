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

/**
 * Computes the CREATE3 address according to Solady's CREATE3 implementation
 * @param factoryAddress - Factory contract address (the deployer)
 * @param salt - Formatted salt as bytes32
 * @returns Computed CREATE3 address
 */
function computeCreate3Address(factoryAddress: string, salt: string): string {
  // The proxy bytecode hash from the Solady implementation
  const proxyBytecodeHash = '0x21c35dbe1b344a2488cf3321d6ce542f8e9f305544ff09e4993a62319a497c1f';
  
  // First calculate the proxy address using CREATE2
  // Equivalent to create2(0, 0x10, 0x10, salt) in the Solady contract
  const proxyAddressBytes = ethers.utils.keccak256(
    ethers.utils.concat([
      '0xff',
      factoryAddress,
      salt,
      proxyBytecodeHash
    ])
  );
  
  // Get the proxy address (last 20 bytes of the hash)
  const proxyAddress = ethers.utils.getAddress('0x' + proxyAddressBytes.slice(26));
  
  // Now calculate the CREATE3 address using the RLP encoding pattern from Solady
  // RLP encoding of: [proxy_address, 1]
  // 0xd6 = 0xc0 (short RLP prefix) + 0x16 (length of: 0x94 ++ proxy ++ 0x01)
  // 0x94 = 0x80 + 0x14 (0x14 = length of address, 20 bytes)
  
  // We'll construct this manually like in the Solady code
  const rlpEncodedData = ethers.utils.concat([
    '0xd694',
    proxyAddress,
    '0x01'
  ]);
  
  // Calculate keccak256 hash of the RLP encoded data
  const create3AddressBytes = ethers.utils.keccak256(rlpEncodedData);
  
  // Return the last 20 bytes as the address
  return ethers.utils.getAddress('0x' + create3AddressBytes.slice(26));
}

export { formatSalt, computeCreate2Address, computeCreate3Address };