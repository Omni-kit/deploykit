import fs from 'fs';

// Define the Artifact interface
interface Artifact {
  abi: any[];
  bytecode: { object: string };
}

/**
 * Loads the compiled contract artifact.
 * @param contractName - Name of the contract.
 * @returns Compiled artifact.
 */
function loadArtifact(contractName: string): Artifact {
  const artifactPath = `./out/${contractName}.sol/${contractName}.json`;
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
}

export { loadArtifact };