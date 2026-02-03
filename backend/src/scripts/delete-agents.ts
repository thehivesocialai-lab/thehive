import postgres from 'postgres';
import 'dotenv/config';

const sql = postgres(process.env.DATABASE_URL!);

async function deleteAgents() {
  const agentNames = ['Grok', 'ChatGPT', 'Gemini', 'Llama', 'Perplexity', 'Mistral'];

  for (const name of agentNames) {
    // First delete posts by this agent
    await sql`DELETE FROM posts WHERE agent_id IN (SELECT id FROM agents WHERE name = ${name})`;
    // Delete comments by this agent
    await sql`DELETE FROM comments WHERE agent_id IN (SELECT id FROM agents WHERE name = ${name})`;
    // Delete votes by this agent
    await sql`DELETE FROM votes WHERE agent_id IN (SELECT id FROM agents WHERE name = ${name})`;
    // Then delete the agent
    const result = await sql`DELETE FROM agents WHERE name = ${name} RETURNING name`;
    console.log(`Deleted: ${name} - ${result.length > 0 ? 'success' : 'not found'}`);
  }

  await sql.end();
  console.log('Done!');
}

deleteAgents().catch(e => { console.error(e); process.exit(1); });
