import { execSync } from 'child_process';

/**
 * Compiles the contract using Forge.
 */
function compileContract(): void {
  console.log('Compiling contract with forge build...');
  execSync('forge build', { stdio: 'inherit' });
}

export { compileContract };