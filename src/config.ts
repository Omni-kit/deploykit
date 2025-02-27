import fs from 'fs';
import inquirer from 'inquirer';

interface Config {
  chains: number[];
  factoryContract: string;
  contractName: string;
  constructorArgs?: any[];
  salt: string;
  rpcUrl: string;
}

interface HubSpokeConfig {
  hubContract: string;
  spokeContract: string;
  hubConstructorArgs?: any[];
  spokeConstructorArgs?: any[];
  spokeChains: number[];
  factoryContract: string;
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
      name: 'factoryContract',
      message: 'Enter factory contract address (e.g., 0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966):',
      when: () => !config.factoryContract,
      validate: (input: string) => !!input ? true : 'Factory contract address is required.'
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
        const inputStr = String(input ?? '');
        if (!inputStr.trim()) return [];
        try {
          const parsed = JSON.parse(inputStr);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return inputStr.split(',').map((item) => item.trim());
        }
        return inputStr.split(',').map((item) => item.trim());
      },
      validate: (input: unknown): boolean | string => {
        const inputStr = String(input ?? '');
        if (!inputStr.trim()) return true;
        try {
          const parsed = JSON.parse(inputStr);
          return Array.isArray(parsed) ? true : 'Input must be a JSON array (e.g., ["arg1", 42]) or comma-separated list (e.g., arg1, 42)';
        } catch {
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

  // Final validation
  if (!config.chains || !Array.isArray(config.chains) || config.chains.length === 0) {
    throw new Error('Invalid or missing "chains"');
  }
  if (!config.factoryContract) {
    throw new Error('Missing "factoryContract"');
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

async function loadHubSpokeConfig(configPath?: string): Promise<HubSpokeConfig> {
  let config: Partial<HubSpokeConfig> = {};

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
      name: 'hubContract',
      message: 'Enter hub contract name (e.g., HubContract):',
      when: () => !config.hubContract,
      validate: (input: string) => !!input ? true : 'Hub contract name is required.'
    },
    {
      type: 'input',
      name: 'spokeContract',
      message: 'Enter spoke contract name (e.g., SpokeContract):',
      when: () => !config.spokeContract,
      validate: (input: string) => !!input ? true : 'Spoke contract name is required.'
    },
    {
      type: 'input',
      name: 'hubConstructorArgs',
      message: 'Enter hub constructor arguments as a JSON array or comma-separated list (e.g., ["arg1", 42] or arg1, 42, or press Enter for none):',
      when: () => !config.hubConstructorArgs || !Array.isArray(config.hubConstructorArgs),
      default: '',
      filter: (input: unknown): any[] => {
        const inputStr = String(input ?? '');
        if (!inputStr.trim()) return [];
        try {
          const parsed = JSON.parse(inputStr);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return inputStr.split(',').map((item) => item.trim());
        }
        return inputStr.split(',').map((item) => item.trim());
      }
    },
    {
      type: 'input',
      name: 'spokeConstructorArgs',
      message: 'Enter spoke constructor arguments as a JSON array or comma-separated list (e.g., ["arg1", 42] or arg1, 42, or press Enter for none):',
      when: () => !config.spokeConstructorArgs || !Array.isArray(config.spokeConstructorArgs),
      default: '',
      filter: (input: unknown): any[] => {
        const inputStr = String(input ?? '');
        if (!inputStr.trim()) return [];
        try {
          const parsed = JSON.parse(inputStr);
          if (Array.isArray(parsed)) return parsed;
        } catch {
          return inputStr.split(',').map((item) => item.trim());
        }
        return inputStr.split(',').map((item) => item.trim());
      }
    },
    {
      type: 'input',
      name: 'spokeChains',
      message: 'Enter spoke chain IDs (comma-separated, e.g., 100,101,102):',
      when: () => !config.spokeChains || !Array.isArray(config.spokeChains) || config.spokeChains.length === 0,
      filter: (input: string) => input.split(',').map((id) => parseInt(id.trim(), 10)),
      validate: (input: number[]) => input.length > 0 ? true : 'At least one spoke chain ID is required.'
    },
    {
      type: 'input',
      name: 'factoryContract',
      message: 'Enter factory contract address (e.g., 0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966):',
      when: () => !config.factoryContract,
      validate: (input: string) => !!input ? true : 'Factory contract address is required.'
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

  // Final validation
  if (!config.hubContract) {
    throw new Error('Missing "hubContractName"');
  }
  if (!config.spokeContract) {
    throw new Error('Missing "spokeContractName"');
  }
  if (!config.spokeChains || !Array.isArray(config.spokeChains) || config.spokeChains.length === 0) {
    throw new Error('Invalid or missing "spokeChains"');
  }
  if (!config.factoryContract) {
    throw new Error('Missing "factoryContract"');
  }
  if (!config.salt) {
    throw new Error('Missing "salt"');
  }
  if (!config.rpcUrl) {
    throw new Error('Missing "rpcUrl"');
  }

  return config as HubSpokeConfig;
}

export { loadConfig, loadHubSpokeConfig, Config, HubSpokeConfig };