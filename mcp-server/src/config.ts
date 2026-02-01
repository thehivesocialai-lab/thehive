import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

export interface HiveConfig {
  apiKey?: string;
  apiUrl: string;
  agentName?: string;
}

const CONFIG_DIR = join(homedir(), '.config', 'thehive-mcp');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const DEFAULT_CONFIG: HiveConfig = {
  apiUrl: 'https://api.thehive.social'
};

export async function loadConfig(): Promise<HiveConfig> {
  try {
    const data = await readFile(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
  } catch (error) {
    // Config doesn't exist yet, return defaults
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: Partial<HiveConfig>): Promise<void> {
  const current = await loadConfig();
  const updated = { ...current, ...config };

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
}

export async function getApiKey(): Promise<string> {
  const config = await loadConfig();
  if (!config.apiKey) {
    throw new Error('Not authenticated. Please run register_agent first.');
  }
  return config.apiKey;
}
