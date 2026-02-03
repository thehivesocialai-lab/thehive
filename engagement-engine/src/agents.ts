import * as fs from 'fs';
import * as path from 'path';

export interface Agent {
  id: string;
  name: string;
  description: string;
  api_key: string;
  model?: string;
}

// Support both formats: array of agents or wrapped in { agents: [] }
export type AgentsData = Agent[] | { agents: Agent[] };

// Raw agent format from seeded-agents.json
interface RawAgent {
  id?: string;
  username?: string;
  name?: string;
  bio?: string;
  description?: string;
  apiKey?: string;
  api_key?: string;
  model?: string;
}

export class AgentManager {
  private agents: Agent[] = [];
  private agentsFilePath: string;

  constructor(agentsFilePath?: string) {
    this.agentsFilePath = agentsFilePath || process.env.AGENTS_FILE || '';
    this.loadAgents();
  }

  private loadAgents(): void {
    try {
      if (!this.agentsFilePath || !fs.existsSync(this.agentsFilePath)) {
        console.error(`Agents file not found: ${this.agentsFilePath}`);
        return;
      }

      const fileContent = fs.readFileSync(this.agentsFilePath, 'utf-8');
      const rawData = JSON.parse(fileContent);

      // Handle both formats: raw array or { agents: [] }
      const rawAgents: RawAgent[] = Array.isArray(rawData) ? rawData : (rawData.agents || []);

      // Normalize and filter agents
      this.agents = rawAgents
        .map((raw: RawAgent) => ({
          id: raw.id || raw.username || '',
          name: raw.username || raw.name || '',
          description: raw.bio || raw.description || '',
          api_key: raw.apiKey || raw.api_key || '',
          model: raw.model
        }))
        .filter(agent => {
          if (!agent.api_key || agent.api_key === 'EXISTING_AGENT_NO_KEY') {
            console.log(`Skipping agent ${agent.name}: No valid API key`);
            return false;
          }
          return true;
        });

      console.log(`Loaded ${this.agents.length} agents with valid API keys`);
    } catch (error) {
      console.error('Error loading agents:', error);
      this.agents = [];
    }
  }

  public getRandomAgents(count: number): Agent[] {
    if (this.agents.length === 0) {
      console.warn('No agents available');
      return [];
    }

    const shuffled = [...this.agents].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, this.agents.length));
  }

  public getAllAgents(): Agent[] {
    return this.agents;
  }

  public getAgentById(id: string): Agent | undefined {
    return this.agents.find(agent => agent.id === id);
  }
}
