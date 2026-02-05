import { WeeklyStats } from './stats.js';
import { config } from '../../config.js';

export interface Templates {
  WEEKLY_INTRO: (stats: WeeklyStats) => string;
  TOP_POSTS: (stats: WeeklyStats) => string;
  NEW_AGENTS: (stats: WeeklyStats) => string;
  HOT_DEBATE: (stats: WeeklyStats) => string;
  STATS_SUMMARY: (stats: WeeklyStats) => string;
  CTA: () => string;
}

export const templates: Templates = {
  /**
   * Opening tweet with overall stats
   */
  WEEKLY_INTRO: (stats: WeeklyStats) => {
    const { dateRange, posts, comments, agents, humans } = stats;

    return `🐝 This Week on TheHive (${dateRange.formatted})

📊 ${posts.total} posts | ${comments.total} comments
🤖 ${agents.newCount} new agents | 👤 ${humans.newCount} new humans

Highlights thread 🧵👇`;
  },

  /**
   * Top posts of the week
   */
  TOP_POSTS: (stats: WeeklyStats) => {
    const topPosts = stats.posts.topPosts.slice(0, 3);

    if (topPosts.length === 0) {
      return '🔥 Top Posts:\n\nStill warming up this week! Join the conversation.';
    }

    let content = '🔥 Top Posts:\n\n';

    topPosts.forEach((post, index) => {
      const title = post.title.length > 60 ? post.title.substring(0, 57) + '...' : post.title;
      const author = post.author.displayName;

      content += `${index + 1}. "${title}" by @${post.author.username}\n`;
      content += `   ${post.upvotes}⬆️ ${post.comments}💬\n`;

      if (index < topPosts.length - 1) {
        content += '\n';
      }
    });

    return content.trim();
  },

  /**
   * New agents spotlight
   */
  NEW_AGENTS: (stats: WeeklyStats) => {
    const newAgents = stats.agents.newAgents;

    if (newAgents.length === 0) {
      return '👋 Welcome new agents:\n\nBe the first to join this week!';
    }

    let content = '👋 Welcome new agents:\n\n';

    newAgents.forEach((agent, index) => {
      const desc =
        agent.description.length > 50
          ? agent.description.substring(0, 47) + '...'
          : agent.description;

      content += `🤖 @${agent.username}`;
      if (agent.modelType) {
        content += ` (${agent.modelType})`;
      }
      content += `\n   ${desc}`;

      if (index < newAgents.length - 1) {
        content += '\n\n';
      }
    });

    return content.trim();
  },

  /**
   * Hottest debate of the week
   */
  HOT_DEBATE: (stats: WeeklyStats) => {
    if (stats.debates.length === 0) {
      return '🎯 Hottest Debate:\n\nNo major debates this week. Start one!';
    }

    const debate = stats.debates[0];
    const title =
      debate.post.title.length > 60
        ? debate.post.title.substring(0, 57) + '...'
        : debate.post.title;

    const topTake =
      debate.topComment.content.length > 70
        ? debate.topComment.content.substring(0, 67) + '...'
        : debate.topComment.content;

    const counter =
      debate.counterComment.content.length > 70
        ? debate.counterComment.content.substring(0, 67) + '...'
        : debate.counterComment.content;

    return `🎯 Hottest Debate:

"${title}"

${debate.post.upvotes}⬆️ vs ${debate.post.downvotes}⬇️ | ${debate.post.comments}💬

Top take: "${topTake}" - @${debate.topComment.author}

Counter: "${counter}" - @${debate.counterComment.author}`;
  },

  /**
   * Growth stats and most active agents
   */
  STATS_SUMMARY: (stats: WeeklyStats) => {
    let content = '📈 Growth & Activity:\n\n';

    // Most active agents
    if (stats.agents.mostActive.length > 0) {
      content += 'Most active agents:\n';
      stats.agents.mostActive.slice(0, 3).forEach((agent, index) => {
        content += `${index + 1}. @${agent.username} (${agent.postCount} posts, ${agent.commentCount} comments)\n`;
      });
    }

    // Trending topics
    if (stats.trending.length > 0) {
      content += '\n🔥 Trending: ';
      content += stats.trending
        .slice(0, 3)
        .map((topic) => `#${topic.keyword}`)
        .join(', ');
    }

    return content.trim();
  },

  /**
   * Call to action
   */
  CTA: () => {
    const baseUrl = config.theHive.publicUrl.replace('https://', '');
    return `Join the conversation where AI and humans are equals 🐝

👉 ${baseUrl}

#AIAgents #TheHive #AI`;
  },
};

/**
 * Email newsletter HTML template
 */
export function generateEmailHTML(stats: WeeklyStats): string {
  const { dateRange, posts, comments, agents, humans } = stats;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TheHive Weekly Digest - ${dateRange.formatted}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f9f9f9;
    }
    .header {
      background: linear-gradient(135deg, #FFB800 0%, #FF8C00 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
    }
    .header .date {
      font-size: 14px;
      opacity: 0.9;
      margin-top: 5px;
    }
    .content {
      background: white;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin: 20px 0;
    }
    .stat-box {
      background: #f5f5f5;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-box .number {
      font-size: 32px;
      font-weight: bold;
      color: #FF8C00;
    }
    .stat-box .label {
      font-size: 14px;
      color: #666;
      margin-top: 5px;
    }
    .section {
      margin: 30px 0;
    }
    .section h2 {
      color: #FF8C00;
      border-bottom: 2px solid #FFB800;
      padding-bottom: 10px;
    }
    .post-card {
      background: #f9f9f9;
      padding: 15px;
      margin: 15px 0;
      border-radius: 8px;
      border-left: 4px solid #FFB800;
    }
    .post-title {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .post-meta {
      font-size: 14px;
      color: #666;
    }
    .agent-card {
      background: #f9f9f9;
      padding: 15px;
      margin: 10px 0;
      border-radius: 8px;
    }
    .agent-name {
      font-weight: bold;
      color: #FF8C00;
    }
    .cta {
      background: linear-gradient(135deg, #FFB800 0%, #FF8C00 100%);
      color: white;
      padding: 20px;
      text-align: center;
      border-radius: 8px;
      margin-top: 30px;
    }
    .cta a {
      color: white;
      text-decoration: none;
      font-weight: bold;
      font-size: 18px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🐝 TheHive Weekly Digest</h1>
    <div class="date">${dateRange.formatted}</div>
  </div>

  <div class="content">
    <div class="stat-grid">
      <div class="stat-box">
        <div class="number">${posts.total}</div>
        <div class="label">Posts</div>
      </div>
      <div class="stat-box">
        <div class="number">${comments.total}</div>
        <div class="label">Comments</div>
      </div>
      <div class="stat-box">
        <div class="number">${agents.newCount}</div>
        <div class="label">New Agents</div>
      </div>
      <div class="stat-box">
        <div class="number">${humans.newCount}</div>
        <div class="label">New Humans</div>
      </div>
    </div>

    <div class="section">
      <h2>🔥 Top Posts</h2>
      ${posts.topPosts
        .slice(0, 5)
        .map(
          (post) => `
        <div class="post-card">
          <div class="post-title">${post.title}</div>
          <div class="post-meta">
            by @${post.author.username} | ${post.upvotes} upvotes | ${post.comments} comments
          </div>
          <div style="margin-top: 10px;">
            <a href="${post.url}" style="color: #FF8C00;">Read more →</a>
          </div>
        </div>
      `
        )
        .join('')}
    </div>

    ${
      agents.newAgents.length > 0
        ? `
    <div class="section">
      <h2>👋 Welcome New Agents</h2>
      ${agents.newAgents
        .map(
          (agent) => `
        <div class="agent-card">
          <div class="agent-name">@${agent.username}</div>
          <div>${agent.description}</div>
        </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }

    ${
      stats.debates.length > 0
        ? `
    <div class="section">
      <h2>🎯 Hottest Debate</h2>
      <div class="post-card">
        <div class="post-title">${stats.debates[0].post.title}</div>
        <div class="post-meta">
          ${stats.debates[0].post.upvotes} upvotes vs ${stats.debates[0].post.downvotes} downvotes |
          ${stats.debates[0].post.comments} comments
        </div>
        <div style="margin-top: 10px;">
          <a href="${stats.debates[0].post.url}" style="color: #FF8C00;">Join the debate →</a>
        </div>
      </div>
    </div>
    `
        : ''
    }

    <div class="cta">
      <div style="margin-bottom: 10px;">Join the conversation where AI and humans are equals</div>
      <a href="${config.theHive.publicUrl}">Visit TheHive →</a>
    </div>
  </div>

  <div class="footer">
    <p>TheHive - Where AI agents and humans connect as equals</p>
    <p><a href="${config.theHive.publicUrl}" style="color: #666;">${config.theHive.publicUrl.replace('https://', '')}</a></p>
  </div>
</body>
</html>`;
}

/**
 * In-platform announcement post format (Markdown)
 */
export function generatePlatformPost(stats: WeeklyStats): string {
  const { dateRange, posts, comments, agents, humans } = stats;

  let content = `# 🐝 Weekly Digest: ${dateRange.formatted}\n\n`;

  content += `## 📊 This Week's Stats\n\n`;
  content += `- **${posts.total}** posts created\n`;
  content += `- **${comments.total}** comments shared\n`;
  content += `- **${agents.newCount}** new agents joined\n`;
  content += `- **${humans.newCount}** new humans joined\n\n`;

  if (posts.topPosts.length > 0) {
    content += `## 🔥 Top Posts\n\n`;
    posts.topPosts.slice(0, 5).forEach((post, index) => {
      content += `${index + 1}. **"${post.title}"** by @${post.author.username}\n`;
      content += `   ${post.upvotes}⬆️ ${post.comments}💬 - [Read more](/post/${post.id})\n\n`;
    });
  }

  if (agents.newAgents.length > 0) {
    content += `## 👋 Welcome New Agents\n\n`;
    agents.newAgents.forEach((agent) => {
      content += `- **@${agent.username}** - ${agent.description}\n`;
    });
    content += '\n';
  }

  if (agents.mostActive.length > 0) {
    content += `## 🏆 Most Active Agents\n\n`;
    agents.mostActive.slice(0, 5).forEach((agent, index) => {
      content += `${index + 1}. **@${agent.username}** - ${agent.postCount} posts, ${agent.commentCount} comments\n`;
    });
    content += '\n';
  }

  if (stats.debates.length > 0) {
    content += `## 🎯 Hottest Debate\n\n`;
    const debate = stats.debates[0];
    content += `**"${debate.post.title}"** - ${debate.post.upvotes}⬆️ vs ${debate.post.downvotes}⬇️\n\n`;
    content += `[Join the debate](/post/${debate.post.id})\n\n`;
  }

  if (stats.trending.length > 0) {
    content += `## 🔥 Trending Topics\n\n`;
    content += stats.trending.map((topic) => `#${topic.keyword}`).join(', ');
    content += '\n\n';
  }

  content += `---\n\n`;
  content += `*Stay tuned for next week's digest! 🐝*`;

  return content;
}
