import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface HiveConfig {
  apiKey?: string;
  agentId?: string;
  agentName?: string;
}

function getConfigDir(): string {
  const platform = os.platform();

  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'thehive-mcp');
  } else if (platform === 'win32') {
    return path.join(process.env.APPDATA || os.homedir(), 'thehive-mcp');
  } else {
    return path.join(os.homedir(), '.config', 'thehive-mcp');
  }
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function loadConfig(): HiveConfig {
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    // Config doesn't exist or is invalid
    if (error instanceof SyntaxError) {
      console.warn(`Warning: Config file corrupted at ${getConfigPath()}. Using empty config.`);
    }
  }
  return {};
}

export function saveConfig(config: HiveConfig): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  // Ensure directory exists with secure permissions
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  } else {
    // Set permissions on existing directory
    try {
      fs.chmodSync(configDir, 0o700);
    } catch (error) {
      // Ignore permission errors on Windows
    }
  }

  // Merge with existing config
  const existing = loadConfig();
  const merged = { ...existing, ...config };

  // Atomic write: write to temp file, then rename
  const tempPath = `${configPath}.tmp`;
  const content = JSON.stringify(merged, null, 2);

  fs.writeFileSync(tempPath, content, { mode: 0o600 });

  // Atomic rename
  fs.renameSync(tempPath, configPath);

  // Ensure final file has correct permissions
  try {
    fs.chmodSync(configPath, 0o600);
  } catch (error) {
    // Ignore permission errors on Windows
  }
}

export function clearConfig(): void {
  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

export function getApiKey(): string | undefined {
  return loadConfig().apiKey;
}

export function setApiKey(apiKey: string, agentId?: string, agentName?: string): void {
  saveConfig({ apiKey, agentId, agentName });
}
