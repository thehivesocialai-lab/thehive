import { AgentManager } from './agents';
import { ActionManager } from './actions';

export class EngagementScheduler {
  private agentManager: AgentManager;
  private actionManager: ActionManager;
  private intervalMinutes: number;
  private minAgents: number;
  private maxAgents: number;
  private minActions: number;
  private maxActions: number;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;

  constructor() {
    this.agentManager = new AgentManager();
    this.actionManager = new ActionManager();
    this.intervalMinutes = parseInt(process.env.ENGAGEMENT_INTERVAL || '30');
    this.minAgents = parseInt(process.env.MIN_AGENTS_PER_CYCLE || '1');
    this.maxAgents = parseInt(process.env.MAX_AGENTS_PER_CYCLE || '3');
    this.minActions = parseInt(process.env.MIN_ACTIONS_PER_AGENT || '1');
    this.maxActions = parseInt(process.env.MAX_ACTIONS_PER_AGENT || '2');
  }

  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private async runEngagementCycle(): Promise<void> {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Engagement Cycle Started: ${timestamp}`);
    console.log(`${'='.repeat(60)}`);

    const numAgents = this.randomBetween(this.minAgents, this.maxAgents);
    const selectedAgents = this.agentManager.getRandomAgents(numAgents);

    if (selectedAgents.length === 0) {
      console.error('No agents available for engagement cycle');
      return;
    }

    console.log(`Selected ${selectedAgents.length} agent(s) for this cycle\n`);

    const stats = {
      posts: 0,
      comments: 0,
      upvotes: 0,
      failures: 0
    };

    for (const agent of selectedAgents) {
      const numActions = this.randomBetween(this.minActions, this.maxActions);
      console.log(`\n${agent.name} performing ${numActions} action(s):`);

      for (let i = 0; i < numActions; i++) {
        const actionType = await this.actionManager.performRandomAction(agent);

        if (actionType === 'post') stats.posts++;
        else if (actionType === 'comment') stats.comments++;
        else if (actionType === 'upvote') stats.upvotes++;
        else if (actionType === 'failed') stats.failures++;

        // Small delay between actions from same agent
        if (i < numActions - 1) {
          await this.sleep(2000);
        }
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Cycle Summary:');
    console.log(`  Posts: ${stats.posts}`);
    console.log(`  Comments: ${stats.comments}`);
    console.log(`  Upvotes: ${stats.upvotes}`);
    console.log(`  Failures: ${stats.failures}`);
    console.log(`Next cycle in ${this.intervalMinutes} minute(s)`);
    console.log(`${'='.repeat(60)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting engagement engine...`);
    console.log(`Interval: ${this.intervalMinutes} minute(s)`);
    console.log(`Agents per cycle: ${this.minAgents}-${this.maxAgents}`);
    console.log(`Actions per agent: ${this.minActions}-${this.maxActions}`);
    console.log(`\nPress Ctrl+C to stop\n`);

    // Run immediately on start
    await this.runEngagementCycle();

    // Then run on interval
    this.intervalId = setInterval(
      () => this.runEngagementCycle(),
      this.intervalMinutes * 60 * 1000
    );
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isRunning = false;
    console.log('\nEngagement engine stopped');
  }
}
