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
    // Config doesn't exist or is invalid, return empty
  }
  return {};
}

export function saveConfig(config: HiveConfig): void {
  const configDir = getConfigDir();
  const configPath = getConfigPath();

  // Ensure directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Merge with existing config
  const existing = loadConfig();
  const merged = { ...existing, ...config };

  fs.writeFileSync(configPath, JSON.stringify(merged, null, 2));
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
