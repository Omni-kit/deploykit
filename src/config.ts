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
  chains: number[];
  factoryContract: string;
  hubContract: string;
  spokeContract: string;
  hubConstructorArgs?: any[];
  spokeConstructorArgs?: any[];
  salt: string;
  rpcUrl: string;
}

/**
 * Parses and validates chain IDs from a comma-separated string
 * @returns An array of valid chain IDs or an error message
 */
const validateAndParseChainIds = (input: string): number[] | string => {
  if (!input || !input.trim()) {
    return 'At least one chain ID is required.';
  }
  
  const ids = input.split(',');
  const result: number[] = [];
  
  for (const idStr of ids) {
    const trimmed = idStr.trim();
    if (!trimmed) continue;
    
    // Check if the input contains only digits
    if (!/^\d+$/.test(trimmed)) {
      return `"${trimmed}" is not a valid chain ID. All chain IDs must be positive integers.`;
    }
    
    const id = parseInt(trimmed, 10);
    if (id <= 0) {
      return `"${id}" is not valid. Chain IDs must be positive integers.`;
    }
    
    result.push(id);
  }
  
  if (result.length === 0) {
    return 'At least one valid chain ID is required.';
  }
  
  return result;
};

const validateEVMAddress = (input: string): boolean | string => {
  if (!input || !input.trim()) {
    return 'Address is required.';
  }
  
  // EVM addresses should be 42 characters long (0x + 40 hex chars)
  if (!/^0x[0-9a-fA-F]{40}$/.test(input)) {
    return 'Invalid EVM address format. Address should be in format: 0x followed by 40 hexadecimal characters.';
  }
  return true;
};

const validateUrl = (input: string): boolean | string => {
  if (!input || !input.trim()) {
    return 'URL is required.';
  }
  
  try {
    new URL(input);
    return true;
  } catch (e) {
    return 'Invalid URL format. Please enter a valid URL (e.g., https://rpc.example.com).';
  }
};

const parseConstructorArgs = (input: string): any[] | string => {
  if (!input || !input.trim()) return [];
  
  try {
    const parsed = JSON.parse(input);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // If not valid JSON, try comma-separated list
    return input.split(',').map((item) => item.trim());
  }
  return input.split(',').map((item) => item.trim());
};

const validateConstructorArgs = (input: string): boolean | string => {
  if (!input || !input.trim()) return true;
  
  try {
    const parsed = JSON.parse(input);
    return Array.isArray(parsed) 
      ? true 
      : 'Input must be a JSON array (e.g., ["arg1", 42]) or comma-separated list (e.g., arg1, 42)';
  } catch {
    return input.includes(',') || !input.includes(' ')
      ? true
      : 'Input must be a comma-separated list (e.g., arg1, 42) or JSON array (e.g., ["arg1", 42])';
  }
};

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
      name: 'chainsInput', // Use a different name to store raw input
      message: 'Enter chain IDs (comma-separated, e.g., 1,137,42161):',
      when: () => !config.chains || !Array.isArray(config.chains) || config.chains.length === 0,
      validate: (input: string) => {
        const result = validateAndParseChainIds(input);
        return typeof result === 'string' ? result : true;
      }
    },
    {
      type: 'input',
      name: 'factoryContract',
      message: 'Enter factory contract address (e.g., 0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966):',
      when: () => !config.factoryContract,
      validate: validateEVMAddress
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
      name: 'constructorArgsInput', // Use a different name to store raw input
      message: 'Enter constructor arguments as a JSON array or comma-separated list (e.g., ["arg1", 42] or arg1, 42, or press Enter for none):',
      when: () => !config.constructorArgs || !Array.isArray(config.constructorArgs),
      default: '',
      validate: validateConstructorArgs
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
      message: 'Enter RPC URL (e.g., https://rpc.ethereum.example.com):',
      when: () => !config.rpcUrl,
      validate: validateUrl
    }
  ];

  const answers = await inquirer.prompt(questions);
  
  // Process the raw inputs after validation
  if (answers.chainsInput) {
    const parsedChains = validateAndParseChainIds(answers.chainsInput);
    if (typeof parsedChains === 'string') {
      throw new Error(`Chain ID validation failed: ${parsedChains}`);
    }
    answers.chains = parsedChains;
    delete answers.chainsInput; // Remove the temporary input property
  }
  
  if (answers.constructorArgsInput !== undefined) {
    answers.constructorArgs = parseConstructorArgs(answers.constructorArgsInput);
    delete answers.constructorArgsInput; // Remove the temporary input property
  }
  
  config = { ...config, ...answers };

  // Final validation of all fields
  const errors: string[] = [];

  if (!config.chains || !Array.isArray(config.chains) || config.chains.length === 0) {
    errors.push('Invalid or missing "chains"');
  }
  if (!config.factoryContract || !/^0x[0-9a-fA-F]{40}$/.test(config.factoryContract)) {
    errors.push('Invalid or missing "factoryContract". Must be a valid EVM address');
  }
  if (!config.contractName) {
    errors.push('Missing "contractName"');
  }
  if (!config.salt) {
    errors.push('Missing "salt"');
  }
  if (!config.rpcUrl) {
    errors.push('Missing "rpcUrl"');
  } else {
    try {
      new URL(config.rpcUrl);
    } catch (e) {
      errors.push('Invalid "rpcUrl". Must be a valid URL');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
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
      name: 'chainsInput', // Use a different name to store raw input
      message: 'Enter chain IDs for spoke deployments (comma-separated, e.g., 1,137,42161):',
      when: () => !config.chains || !Array.isArray(config.chains) || config.chains.length === 0,
      validate: (input: string) => {
        const result = validateAndParseChainIds(input);
        return typeof result === 'string' ? result : true;
      }
    },
    {
      type: 'input',
      name: 'factoryContract',
      message: 'Enter factory contract address (e.g., 0x538DB2dF0f1CCF9fBA392A0248D41292f01D3966):',
      when: () => !config.factoryContract,
      validate: validateEVMAddress
    },
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
      name: 'hubConstructorArgsInput', // Use a different name to store raw input
      message: 'Enter hub constructor arguments as a JSON array or comma-separated list (e.g., ["arg1", 42] or arg1, 42, or press Enter for none):',
      when: () => !config.hubConstructorArgs || !Array.isArray(config.hubConstructorArgs),
      default: '',
      validate: validateConstructorArgs
    },
    {
      type: 'input',
      name: 'spokeConstructorArgsInput', // Use a different name to store raw input
      message: 'Enter spoke constructor arguments as a JSON array or comma-separated list (e.g., ["arg1", 42] or arg1, 42, or press Enter for none):',
      when: () => !config.spokeConstructorArgs || !Array.isArray(config.spokeConstructorArgs),
      default: '',
      validate: validateConstructorArgs
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
      message: 'Enter RPC URL (e.g., https://rpc.ethereum.example.com):',
      when: () => !config.rpcUrl,
      validate: validateUrl
    }
  ];

  const answers = await inquirer.prompt(questions);
  
  // Process the raw inputs after validation
  if (answers.chainsInput) {
    const parsedChains = validateAndParseChainIds(answers.chainsInput);
    if (typeof parsedChains === 'string') {
      throw new Error(`Chain ID validation failed: ${parsedChains}`);
    }
    answers.chains = parsedChains;
    delete answers.chainsInput; // Remove the temporary input property
  }
  
  if (answers.hubConstructorArgsInput !== undefined) {
    answers.hubConstructorArgs = parseConstructorArgs(answers.hubConstructorArgsInput);
    delete answers.hubConstructorArgsInput; // Remove the temporary input property
  }
  
  if (answers.spokeConstructorArgsInput !== undefined) {
    answers.spokeConstructorArgs = parseConstructorArgs(answers.spokeConstructorArgsInput);
    delete answers.spokeConstructorArgsInput; // Remove the temporary input property
  }
  
  config = { ...config, ...answers };

  // Final validation
  const errors: string[] = [];

  if (!config.chains || !Array.isArray(config.chains) || config.chains.length === 0) {
    errors.push('Invalid or missing "chains"');
  }
  if (!config.factoryContract || !/^0x[0-9a-fA-F]{40}$/.test(config.factoryContract)) {
    errors.push('Invalid or missing "factoryContract". Must be a valid EVM address');
  }
  if (!config.hubContract) {
    errors.push('Missing "hubContract"');
  }
  if (!config.spokeContract) {
    errors.push('Missing "spokeContract"');
  }
  if (!config.salt) {
    errors.push('Missing "salt"');
  }
  if (!config.rpcUrl) {
    errors.push('Missing "rpcUrl"');
  } else {
    try {
      new URL(config.rpcUrl);
    } catch (e) {
      errors.push('Invalid "rpcUrl". Must be a valid URL');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }

  return config as HubSpokeConfig;
}

export { loadConfig, loadHubSpokeConfig, Config, HubSpokeConfig };