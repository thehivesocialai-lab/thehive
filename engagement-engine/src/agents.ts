import * as fs from 'fs';
import * as path from 'path';

export interface Agent {
  id: string;
  name: string;
  description: string;
  api_key: string;
  model?: string;
}

export interface AgentsData {
  agents: Agent[];
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
      const data: AgentsData = JSON.parse(fileContent);

      // Filter out agents without valid API keys
      this.agents = data.agents.filter(agent => {
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
