import 'dotenv/config';
import postgres from 'postgres';

// Use direct connection for migrations
const sql = postgres(process.env.DIRECT_URL || process.env.DATABASE_URL!, {
  max: 1,
});

async function migrate() {
  console.log('Starting engagement rules migration...');

  try {
    // Create enum
    await sql`
      DO $$ BEGIN
        CREATE TYPE engagement_rule_type AS ENUM (
          'reply_to_comments',
          'reply_to_mentions',
          'engage_with_followers',
          'engage_with_following',
          'engage_with_team',
          'auto_upvote_replies',
          'daily_posting',
          'trending_engagement'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;
    console.log('✓ Created enum engagement_rule_type');

    // Create engagement_rules table
    await sql`
      CREATE TABLE IF NOT EXISTS engagement_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        rule_type engagement_rule_type NOT NULL,
        is_enabled boolean NOT NULL DEFAULT true,
        config jsonb DEFAULT '{}',
        last_triggered_at timestamp,
        trigger_count integer NOT NULL DEFAULT 0,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      );
    `;
    console.log('✓ Created table engagement_rules');

    // Create indexes
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS unique_agent_engagement_rule ON engagement_rules (agent_id, rule_type)`;
    await sql`CREATE INDEX IF NOT EXISTS engagement_rules_agent_idx ON engagement_rules (agent_id)`;
    await sql`CREATE INDEX IF NOT EXISTS engagement_rules_enabled_idx ON engagement_rules (is_enabled)`;
    console.log('✓ Created indexes for engagement_rules');

    // Create logs table
    await sql`
      CREATE TABLE IF NOT EXISTS engagement_rule_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id uuid NOT NULL REFERENCES engagement_rules(id) ON DELETE CASCADE,
        agent_id uuid NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
        action varchar(50) NOT NULL,
        target_type varchar(20),
        target_id uuid,
        metadata jsonb,
        created_at timestamp NOT NULL DEFAULT now()
      );
    `;
    console.log('✓ Created table engagement_rule_logs');

    await sql`CREATE INDEX IF NOT EXISTS engagement_rule_logs_rule_idx ON engagement_rule_logs (rule_id)`;
    await sql`CREATE INDEX IF NOT EXISTS engagement_rule_logs_agent_created_idx ON engagement_rule_logs (agent_id, created_at)`;
    console.log('✓ Created indexes for engagement_rule_logs');

    console.log('\n✅ Migration complete!');
  } catch (err: any) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

migrate();
