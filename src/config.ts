import fs from 'fs';
import inquirer from 'inquirer';

interface Config {
  chains: number[];
  contractName: string;
  constructorArgs?: any[];
  salt: string;
  rpcUrl: string;
}

async function loadConfig(configPath?: string): Promise<Config> {
  let config: Partial<Config> = {};

  if (configPath) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error(`Failed to read or parse config file at ${configPath}: ${(error as Error).message}`);
    }
  }

  const questions = [
    {
      type: 'input',
      name: 'chains',
      message: 'Enter chain IDs (comma-separated, e.g., 100,101,102):',
      when: () => !config.chains || !Array.isArray(config.chains) || config.chains.length === 0,
      filter: (input: string) => input.split(',').map((id) => parseInt(id.trim(), 10)),
      validate: (input: number[]) => input.length > 0 ? true : 'At least one chain ID is required.'
    },
    {
      type: 'input',
      name: 'contractName',
      message: 'Enter contract name (e.g., MyContract):',
      when: () => !config.contractName,
      validate: (input: string) => !!input ? true : 'Contract name is required.'
    },
    {
      type: 'input',
      name: 'constructorArgs',
      message: 'Enter constructor arguments as a JSON array or comma-separated list (e.g., ["arg1", 42] or arg1, 42, or press Enter for none):',
      when: () => !config.constructorArgs || !Array.isArray(config.constructorArgs),
      default: '',
      filter: (input: unknown): any[] => {
        // Coerce input to string, default to empty string if undefined
        const inputStr = String(input ?? '');
        if (!inputStr.trim()) return []; // Empty input returns empty array

        // Try parsing as JSON array first
        try {
          const parsed = JSON.parse(inputStr);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          // Fallback to comma-separated list if JSON parsing fails
          return inputStr.split(',').map((item) => item.trim());
        }
        // If not a valid JSON array, treat as comma-separated
        return inputStr.split(',').map((item) => item.trim());
      },
      validate: (input: unknown): boolean | string => {
        // Coerce input to string, default to empty string if undefined
        const inputStr = String(input ?? '');
        if (!inputStr.trim()) return true; // Allow empty input

        // Try JSON array validation first
        try {
          const parsed = JSON.parse(inputStr);
          return Array.isArray(parsed) ? true : 'Input must be a JSON array (e.g., ["arg1", 42]) or comma-separated list (e.g., arg1, 42)';
        } catch {
          // Validate as comma-separated list
          return inputStr.includes(',') || !inputStr.includes(' ')
            ? true
            : 'Input must be a comma-separated list (e.g., arg1, 42) or JSON array (e.g., ["arg1", 42])';
        }
      }
    },
    {
      type: 'input',
      name: 'salt',
      message: 'Enter salt (e.g., mysalt):',
      when: () => !config.salt,
      validate: (input: string) => !!input ? true : 'Salt is required.'
    },
    {
      type: 'input',
      name: 'rpcUrl',
      message: 'Enter RPC URL (e.g., https://rpc.chain100.example.com):',
      when: () => !config.rpcUrl,
      validate: (input: string) => !!input ? true : 'RPC URL is required.'
    }
  ];

  const answers = await inquirer.prompt(questions);
  config = { ...config, ...answers };

  if (!config.chains || !Array.isArray(config.chains) || config.chains.length === 0) {
    throw new Error('Invalid or missing "chains"');
  }
  if (!config.contractName) {
    throw new Error('Missing "contractName"');
  }
  if (!config.salt) {
    throw new Error('Missing "salt"');
  }
  if (!config.rpcUrl) {
    throw new Error('Missing "rpcUrl"');
  }

  return config as Config;
}

export { loadConfig };