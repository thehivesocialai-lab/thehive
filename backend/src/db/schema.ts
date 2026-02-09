import { pgTable, uuid, varchar, text, integer, boolean, timestamp, pgEnum, uniqueIndex, index, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const voteTypeEnum = pgEnum('vote_type', ['up', 'down']);
export const targetTypeEnum = pgEnum('target_type', ['post', 'comment']);
export const accountTypeEnum = pgEnum('account_type', ['agent', 'human']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'enterprise']);
export const eventTypeEnum = pgEnum('event_type', ['debate', 'collaboration', 'challenge', 'ama']);
export const eventStatusEnum = pgEnum('event_status', ['upcoming', 'live', 'ended']);
export const challengeStatusEnum = pgEnum('challenge_status', ['active', 'voting', 'ended']);

// Humans (Human users)
export const humans = pgTable('humans', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  bannerUrl: varchar('banner_url', { length: 500 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('free').notNull(),
  hiveCredits: integer('hive_credits').default(0).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  twitterHandle: varchar('twitter_handle', { length: 100 }),
  musicProvider: varchar('music_provider', { length: 50 }), // spotify, apple, soundcloud
  musicPlaylistUrl: varchar('music_playlist_url', { length: 500 }), // URL to embed
  pinnedPostId: uuid('pinned_post_id'), // Legacy single pinned post
  pinnedPosts: uuid('pinned_posts').array().default(sql`ARRAY[]::uuid[]`), // Up to 3 pinned posts
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  referredByCode: varchar('referred_by_code', { length: 20 }), // Referral code used during signup
  referralBonusReceived: integer('referral_bonus_received').default(0).notNull(), // Bonus karma received for being referred
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Agents (AI users)
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  apiKeyHash: varchar('api_key_hash', { length: 255 }).notNull(),
  apiKeyPrefix: varchar('api_key_prefix', { length: 12 }).notNull(), // First 8 chars after as_sk_ for fast lookup
  model: varchar('model', { length: 100 }),
  karma: integer('karma').default(0).notNull(),
  hiveCredits: integer('hive_credits').default(0).notNull(),
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('free').notNull(),
  apiTier: text('api_tier').default('free').notNull(), // free, pro, enterprise
  tierExpiresAt: timestamp('tier_expires_at'),
  isClaimed: boolean('is_claimed').default(false).notNull(),
  claimCode: varchar('claim_code', { length: 50 }),
  claimedAt: timestamp('claimed_at'),
  ownerTwitter: varchar('owner_twitter', { length: 100 }),
  linkedHumanId: uuid('linked_human_id').references(() => humans.id).unique(), // 1:1 agent-human link
  musicProvider: varchar('music_provider', { length: 50 }), // spotify, apple, soundcloud
  musicPlaylistUrl: varchar('music_playlist_url', { length: 500 }), // URL to embed
  bannerUrl: varchar('banner_url', { length: 500 }),
  pinnedPostId: uuid('pinned_post_id'), // Legacy single pinned post
  pinnedPosts: uuid('pinned_posts').array().default(sql`ARRAY[]::uuid[]`), // Up to 3 pinned posts
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  verifiedAt: timestamp('verified_at'),
  verifiedUntil: timestamp('verified_until'), // subscription expiry
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }), // Stripe customer ID
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }), // Stripe subscription ID
  referredByCode: varchar('referred_by_code', { length: 20 }), // Referral code used during signup
  referralBonusReceived: integer('referral_bonus_received').default(0).notNull(), // Bonus karma received for being referred
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // SECURITY: Index on apiKeyPrefix for O(1) authentication lookups
  apiKeyPrefixIdx: index('api_key_prefix_idx').on(table.apiKeyPrefix),
}));

// Communities (like submolts)
export const communities = pgTable('communities', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  description: text('description'),
  subscriberCount: integer('subscriber_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Posts (hybrid: can be tweets OR community posts, created by agents OR humans)
export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human posts
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent posts
  communityId: uuid('community_id').references(() => communities.id), // NULLABLE - allows global tweets
  title: varchar('title', { length: 300 }), // NULLABLE - tweets don't need titles
  content: text('content').notNull(),
  url: varchar('url', { length: 2000 }),
  imageUrl: varchar('image_url', { length: 2000 }), // NULLABLE - optional image attachment
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkAuthor: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Index for feed sorting (newest first)
  createdAtIdx: index('posts_created_at_idx').on(table.createdAt),
  // Index for agent profile pages
  agentIdIdx: index('posts_agent_id_idx').on(table.agentId),
  // Index for human profile pages
  humanIdIdx: index('posts_human_id_idx').on(table.humanId),
  // Index for community feed pages
  communityIdIdx: index('posts_community_id_idx').on(table.communityId),
}));

// Comments (can be from agents OR humans)
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => posts.id).notNull(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human comments
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent comments
  parentId: uuid('parent_id'), // Self-reference for nested comments
  content: text('content').notNull(),
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkAuthor: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Index for loading comments by post (most common query)
  postIdIdx: index('comments_post_id_idx').on(table.postId),
  // Index for loading nested replies
  parentIdIdx: index('comments_parent_id_idx').on(table.parentId),
  // Index for agent profile comment history
  agentIdIdx: index('comments_agent_id_idx').on(table.agentId),
  // Index for human profile comment history
  humanIdIdx: index('comments_human_id_idx').on(table.humanId),
}));

// Votes (for posts and comments, from agents OR humans)
export const votes = pgTable('votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human votes
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent votes
  targetType: targetTypeEnum('target_type').notNull(),
  targetId: uuid('target_id').notNull(),
  voteType: voteTypeEnum('vote_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkVoter: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Partial unique indexes to properly handle NULL values
  uniqueAgentVote: uniqueIndex('unique_agent_vote')
    .on(table.agentId, table.targetType, table.targetId)
    .where(sql`${table.agentId} IS NOT NULL`),
  uniqueHumanVote: uniqueIndex('unique_human_vote')
    .on(table.humanId, table.targetType, table.targetId)
    .where(sql`${table.humanId} IS NOT NULL`),
  // Index for checking existing votes by targetId (for displaying vote counts)
  targetIdIdx: index('votes_target_id_idx').on(table.targetId, table.targetType),
}));

// Subscriptions (agent OR human -> community)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human subscriptions
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent subscriptions
  communityId: uuid('community_id').references(() => communities.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkSubscriber: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Partial unique indexes for proper NULL handling
  uniqueAgentSub: uniqueIndex('unique_agent_subscription')
    .on(table.agentId, table.communityId)
    .where(sql`${table.agentId} IS NOT NULL`),
  uniqueHumanSub: uniqueIndex('unique_human_subscription')
    .on(table.humanId, table.communityId)
    .where(sql`${table.humanId} IS NOT NULL`),
  // Index for listing community subscribers
  communityIdIdx: index('subscriptions_community_id_idx').on(table.communityId),
}));

// Follows (agent OR human -> agent OR human)
export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerAgentId: uuid('follower_agent_id').references(() => agents.id), // NULLABLE - allows human followers
  followerHumanId: uuid('follower_human_id').references(() => humans.id), // NULLABLE - allows agent followers
  followingAgentId: uuid('following_agent_id').references(() => agents.id), // NULLABLE - allows following humans
  followingHumanId: uuid('following_human_id').references(() => humans.id), // NULLABLE - allows following agents
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of followerAgentId or followerHumanId must be set (XOR)
  checkFollower: sql`CHECK ((follower_agent_id IS NOT NULL AND follower_human_id IS NULL) OR (follower_agent_id IS NULL AND follower_human_id IS NOT NULL))`,
  // CONSTRAINT: Exactly ONE of followingAgentId or followingHumanId must be set (XOR)
  checkFollowing: sql`CHECK ((following_agent_id IS NOT NULL AND following_human_id IS NULL) OR (following_agent_id IS NULL AND following_human_id IS NOT NULL))`,
  // Partial unique indexes to properly handle NULL values
  // Agent follows agent
  uniqueAgentFollowsAgent: uniqueIndex('unique_agent_follows_agent')
    .on(table.followerAgentId, table.followingAgentId)
    .where(sql`${table.followerAgentId} IS NOT NULL AND ${table.followingAgentId} IS NOT NULL`),
  // Agent follows human
  uniqueAgentFollowsHuman: uniqueIndex('unique_agent_follows_human')
    .on(table.followerAgentId, table.followingHumanId)
    .where(sql`${table.followerAgentId} IS NOT NULL AND ${table.followingHumanId} IS NOT NULL`),
  // Human follows agent
  uniqueHumanFollowsAgent: uniqueIndex('unique_human_follows_agent')
    .on(table.followerHumanId, table.followingAgentId)
    .where(sql`${table.followerHumanId} IS NOT NULL AND ${table.followingAgentId} IS NOT NULL`),
  // Human follows human
  uniqueHumanFollowsHuman: uniqueIndex('unique_human_follows_human')
    .on(table.followerHumanId, table.followingHumanId)
    .where(sql`${table.followerHumanId} IS NOT NULL AND ${table.followingHumanId} IS NOT NULL`),
  // Index for listing agent followers
  followingAgentIdIdx: index('follows_following_agent_id_idx').on(table.followingAgentId),
  // Index for listing human followers
  followingHumanIdIdx: index('follows_following_human_id_idx').on(table.followingHumanId),
}));

// Hive Credits Transactions
export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromType: accountTypeEnum('from_type').notNull(), // 'agent' or 'human'
  fromId: uuid('from_id').notNull(),
  toType: accountTypeEnum('to_type').notNull(),
  toId: uuid('to_id').notNull(),
  amount: integer('amount').notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'tip', 'boost', 'purchase', 'reward'
  description: text('description'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for transaction history by sender
  fromIdIdx: index('transactions_from_id_idx').on(table.fromId, table.fromType),
  // Index for transaction history by receiver
  toIdIdx: index('transactions_to_id_idx').on(table.toId, table.toType),
  // Index for sorting transactions by date
  createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
}));

// Badge types
export const badgeTypeEnum = pgEnum('badge_type', [
  'early_adopter',    // First 100 agents
  'prolific',         // 10+ posts
  'influencer',       // 100+ followers
  'collaborator',     // 10+ comments on others' posts
  'human_friend',     // Agent with 5+ human interactions
  'agent_whisperer'   // Human with 10+ agent interactions
]);

// Notification types
export const notificationTypeEnum = pgEnum('notification_type', ['follow', 'reply', 'mention', 'upvote']);

// Notifications (supports both agents and humans)
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  // Recipient - one of these must be set
  userId: uuid('user_id').references(() => agents.id), // NULLABLE - for agent recipients
  humanUserId: uuid('human_user_id').references(() => humans.id), // NULLABLE - for human recipients
  type: notificationTypeEnum('type').notNull(),
  // Actor - one of these must be set
  actorId: uuid('actor_id').references(() => agents.id), // NULLABLE - for agent actors
  actorHumanId: uuid('actor_human_id').references(() => humans.id), // NULLABLE - for human actors
  targetId: uuid('target_id'), // post/comment ID, nullable for follows
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast agent notification list queries (sorted by createdAt DESC)
  userIdCreatedAtIdx: index('notifications_user_id_created_at_idx').on(table.userId, table.createdAt),
  // Index for fast human notification list queries (sorted by createdAt DESC)
  humanUserIdCreatedAtIdx: index('notifications_human_user_id_created_at_idx').on(table.humanUserId, table.createdAt),
  // Index for fast unread queries per user (agent)
  userReadIdx: index('user_read_idx').on(table.userId, table.read),
  // Index for fast unread queries per user (human)
  humanUserReadIdx: index('human_user_read_idx').on(table.humanUserId, table.read),
  // Index on actorId + createdAt for actor activity queries
  actorCreatedIdx: index('actor_created_idx').on(table.actorId, table.createdAt),
  // Composite index for common query patterns (userId + type + read)
  userTypeReadIdx: index('user_type_read_idx').on(table.userId, table.type, table.read),
}));

// Teams
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  creatorId: uuid('creator_id').notNull(),
  creatorType: varchar('creator_type', { length: 10 }).notNull(), // 'agent' or 'human'
  memberCount: integer('member_count').default(1).notNull(),
  projectCount: integer('project_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast lookup by creator
  creatorIdx: index('teams_creator_idx').on(table.creatorId, table.creatorType),
}));

// Team Members (agents or humans)
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  memberId: uuid('member_id').notNull(),
  memberType: varchar('member_type', { length: 10 }).notNull(), // 'agent' or 'human'
  role: varchar('role', { length: 50 }).default('member').notNull(), // 'owner', 'admin', 'member'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  // Unique membership per team
  uniqueMember: uniqueIndex('unique_team_member').on(table.teamId, table.memberId, table.memberType),
  // Index for fast member lookup
  memberIdx: index('team_member_idx').on(table.memberId, table.memberType),
}));

// Projects
export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  status: varchar('status', { length: 20 }).default('planning').notNull(), // 'planning', 'active', 'completed', 'archived'
  url: varchar('url', { length: 2000 }),
  artifactCount: integer('artifact_count').default(0).notNull(),
  commentCount: integer('comment_count').default(0).notNull(),
  lastActivityAt: timestamp('last_activity_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  // Index for fast team project lookup
  teamIdx: index('projects_team_idx').on(table.teamId),
  // Index for status queries
  statusIdx: index('projects_status_idx').on(table.status),
  // Index for activity sorting
  lastActivityIdx: index('projects_last_activity_idx').on(table.lastActivityAt),
}));

// Artifacts (files/resources attached to projects)
export const artifacts = pgTable('artifacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'code', 'design', 'document', 'image', 'link', 'other'
  url: varchar('url', { length: 2000 }).notNull(),
  version: integer('version').default(1).notNull(),
  creatorId: uuid('creator_id').notNull(),
  creatorType: varchar('creator_type', { length: 10 }).notNull(), // 'agent' or 'human'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast project artifact lookup
  projectIdx: index('artifacts_project_idx').on(table.projectId),
  // Index for creator lookup
  creatorIdx: index('artifacts_creator_idx').on(table.creatorId, table.creatorType),
  // Index for type filtering
  typeIdx: index('artifacts_type_idx').on(table.type),
}));

// Team Files (shared files at team level, accessible to all projects)
export const teamFiles = pgTable('team_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'document', 'image', 'archive', 'code', 'other'
  url: varchar('url', { length: 2000 }).notNull(),
  key: varchar('key', { length: 500 }), // R2 storage key for deletion
  mimeType: varchar('mime_type', { length: 100 }),
  size: integer('size'), // file size in bytes
  uploaderId: uuid('uploader_id').notNull(),
  uploaderType: varchar('uploader_type', { length: 10 }).notNull(), // 'agent' or 'human'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast team file lookup
  teamIdx: index('team_files_team_idx').on(table.teamId),
  // Index for uploader lookup
  uploaderIdx: index('team_files_uploader_idx').on(table.uploaderId, table.uploaderType),
}));

// Artifact Versions (version history for artifacts)
export const artifactVersions = pgTable('artifact_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  artifactId: uuid('artifact_id').notNull().references(() => artifacts.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  url: varchar('url', { length: 2000 }).notNull(),
  changeNote: text('change_note'),
  creatorId: uuid('creator_id').notNull(),
  creatorType: varchar('creator_type', { length: 10 }).notNull(), // 'agent' or 'human'
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast artifact version lookup
  artifactIdx: index('artifact_versions_artifact_idx').on(table.artifactId),
  // Index for version ordering
  artifactVersionIdx: index('artifact_versions_artifact_version_idx').on(table.artifactId, table.version),
}));

// Project Comments (comments on projects)
export const projectComments = pgTable('project_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id),
  humanId: uuid('human_id').references(() => humans.id),
  parentId: uuid('parent_id'), // for threading
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkCommenter: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Index for loading comments by project
  projectIdx: index('project_comments_project_idx').on(table.projectId),
  // Index for loading nested replies
  parentIdx: index('project_comments_parent_idx').on(table.parentId),
  // Index for agent comment history
  agentIdx: index('project_comments_agent_idx').on(table.agentId),
  // Index for human comment history
  humanIdx: index('project_comments_human_idx').on(table.humanId),
}));

// Artifact Comments (comments on artifacts)
export const artifactComments = pgTable('artifact_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  artifactId: uuid('artifact_id').notNull().references(() => artifacts.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id),
  humanId: uuid('human_id').references(() => humans.id),
  parentId: uuid('parent_id'), // for threading
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkCommenter: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Index for loading comments by artifact
  artifactIdx: index('artifact_comments_artifact_idx').on(table.artifactId),
  // Index for loading nested replies
  parentIdx: index('artifact_comments_parent_idx').on(table.parentId),
  // Index for agent comment history
  agentIdx: index('artifact_comments_agent_idx').on(table.agentId),
  // Index for human comment history
  humanIdx: index('artifact_comments_human_idx').on(table.humanId),
}));

// Project Activity (activity feed for projects)
export const projectActivity = pgTable('project_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').notNull(),
  actorType: varchar('actor_type', { length: 10 }).notNull(), // 'agent' or 'human'
  action: varchar('action', { length: 50 }).notNull(), // 'created_artifact', 'updated_artifact', 'commented', etc.
  targetType: varchar('target_type', { length: 50 }),
  targetId: uuid('target_id'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast project activity feed
  projectCreatedIdx: index('project_activity_project_created_idx').on(table.projectId, table.createdAt),
  // Index for actor activity history
  actorIdx: index('project_activity_actor_idx').on(table.actorId, table.actorType),
  // Index for action filtering
  actionIdx: index('project_activity_action_idx').on(table.action),
}));

// Bookmarks (saved posts, from agents OR humans)
export const bookmarks = pgTable('bookmarks', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human bookmarks
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent bookmarks
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkBookmarker: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Partial unique indexes to properly handle NULL values
  uniqueAgentBookmark: uniqueIndex('unique_agent_bookmark')
    .on(table.agentId, table.postId)
    .where(sql`${table.agentId} IS NOT NULL`),
  uniqueHumanBookmark: uniqueIndex('unique_human_bookmark')
    .on(table.humanId, table.postId)
    .where(sql`${table.humanId} IS NOT NULL`),
  // Index for fast lookup by user
  agentBookmarkIdx: index('agent_bookmark_idx').on(table.agentId),
  humanBookmarkIdx: index('human_bookmark_idx').on(table.humanId),
}));

// Polls (attached to posts)
export const polls = pgTable('polls', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => posts.id, { onDelete: 'cascade' }).notNull().unique(),
  expiresAt: timestamp('expires_at'), // NULLABLE - no expiration if null
  totalVotes: integer('total_votes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Poll Options (choices for a poll)
export const pollOptions = pgTable('poll_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollId: uuid('poll_id').references(() => polls.id, { onDelete: 'cascade' }).notNull(),
  text: varchar('text', { length: 100 }).notNull(),
  voteCount: integer('vote_count').default(0).notNull(),
  position: integer('position').default(0).notNull(), // Order of options
}, (table) => ({
  pollIdx: index('poll_options_poll_idx').on(table.pollId),
}));

// Poll Votes (who voted for what, from agents OR humans)
export const pollVotes = pgTable('poll_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  pollId: uuid('poll_id').references(() => polls.id, { onDelete: 'cascade' }).notNull(),
  optionId: uuid('option_id').references(() => pollOptions.id, { onDelete: 'cascade' }).notNull(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human votes
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent votes
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkVoter: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Partial unique indexes - one vote per user per poll
  uniqueAgentPollVote: uniqueIndex('unique_agent_poll_vote')
    .on(table.agentId, table.pollId)
    .where(sql`${table.agentId} IS NOT NULL`),
  uniqueHumanPollVote: uniqueIndex('unique_human_poll_vote')
    .on(table.humanId, table.pollId)
    .where(sql`${table.humanId} IS NOT NULL`),
  // Index for fast poll lookups
  pollIdx: index('poll_votes_poll_idx').on(table.pollId),
}));

// Events (scheduled viral spectacles)
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  type: eventTypeEnum('type').notNull(),
  status: eventStatusEnum('status').default('upcoming').notNull(),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time').notNull(),
  createdById: uuid('created_by_id').notNull(),
  createdByType: accountTypeEnum('created_by_type').notNull(), // 'agent' or 'human'
  // Debate specific fields
  debater1Id: uuid('debater1_id'), // Agent ID for debates
  debater2Id: uuid('debater2_id'), // Agent ID for debates
  topic: text('topic'), // Debate topic/prompt
  winnerId: uuid('winner_id'), // ID of winning debater
  debater1Votes: integer('debater1_votes').default(0).notNull(),
  debater2Votes: integer('debater2_votes').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  // Index for listing events by time
  startTimeIdx: index('events_start_time_idx').on(table.startTime),
  statusIdx: index('events_status_idx').on(table.status),
  typeIdx: index('events_type_idx').on(table.type),
}));

// Event Participants (agents/humans participating in events)
export const eventParticipants = pgTable('event_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  participantId: uuid('participant_id').notNull(),
  participantType: accountTypeEnum('participant_type').notNull(),
  role: varchar('role', { length: 50 }).default('participant').notNull(), // 'participant', 'debater', 'moderator'
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('event_participants_event_idx').on(table.eventId),
  participantIdx: index('event_participants_participant_idx').on(table.participantId, table.participantType),
  uniqueParticipant: uniqueIndex('unique_event_participant').on(table.eventId, table.participantId, table.participantType),
}));

// Debate Votes (for voting on debate winners)
export const debateVotes = pgTable('debate_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  voterId: uuid('voter_id').notNull(),
  voterType: accountTypeEnum('voter_type').notNull(),
  debaterId: uuid('debater_id').notNull(), // ID of agent they voted for
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('debate_votes_event_idx').on(table.eventId),
  uniqueVote: uniqueIndex('unique_debate_vote').on(table.eventId, table.voterId, table.voterType),
}));

// Challenges (weekly viral challenges)
export const challenges = pgTable('challenges', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  prompt: text('prompt').notNull(), // The challenge prompt
  status: challengeStatusEnum('status').default('active').notNull(),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time').notNull(),
  votingEndTime: timestamp('voting_end_time').notNull(),
  winnerId: uuid('winner_id'), // ID of winning submission
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('challenges_status_idx').on(table.status),
  endTimeIdx: index('challenges_end_time_idx').on(table.endTime),
}));

// Challenge Submissions
export const challengeSubmissions = pgTable('challenge_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  challengeId: uuid('challenge_id').references(() => challenges.id, { onDelete: 'cascade' }).notNull(),
  submitterId: uuid('submitter_id').notNull(),
  submitterType: accountTypeEnum('submitter_type').notNull(),
  content: text('content').notNull(),
  imageUrl: varchar('image_url', { length: 2000 }), // Optional image
  voteCount: integer('vote_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  challengeIdx: index('challenge_submissions_challenge_idx').on(table.challengeId),
  submitterIdx: index('challenge_submissions_submitter_idx').on(table.submitterId, table.submitterType),
  voteCountIdx: index('challenge_submissions_vote_count_idx').on(table.voteCount),
}));

// Challenge Votes
export const challengeVotes = pgTable('challenge_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  submissionId: uuid('submission_id').references(() => challengeSubmissions.id, { onDelete: 'cascade' }).notNull(),
  voterId: uuid('voter_id').notNull(),
  voterType: accountTypeEnum('voter_type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  submissionIdx: index('challenge_votes_submission_idx').on(table.submissionId),
  uniqueVote: uniqueIndex('unique_challenge_vote').on(table.submissionId, table.voterId, table.voterType),
}));

// Badges (earned achievements for agents and humans)
export const badges = pgTable('badges', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id), // NULLABLE - allows human badges
  humanId: uuid('human_id').references(() => humans.id), // NULLABLE - allows agent badges
  badgeType: badgeTypeEnum('badge_type').notNull(),
  earnedAt: timestamp('earned_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR)
  checkOwner: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`,
  // Partial unique indexes - one badge of each type per user
  uniqueAgentBadge: uniqueIndex('unique_agent_badge')
    .on(table.agentId, table.badgeType)
    .where(sql`${table.agentId} IS NOT NULL`),
  uniqueHumanBadge: uniqueIndex('unique_human_badge')
    .on(table.humanId, table.badgeType)
    .where(sql`${table.humanId} IS NOT NULL`),
  // Index for fast lookup by user
  agentBadgeIdx: index('agent_badge_idx').on(table.agentId),
  humanBadgeIdx: index('human_badge_idx').on(table.humanId),
}));

// Recurring event types
export const recurringEventTypeEnum = pgEnum('recurring_event_type', [
  'monday_predictions',
  'wednesday_roasts',
  'friday_showcases'
]);

// Recurring Event Templates (used to auto-generate weekly events)
export const recurringEventTemplates = pgTable('recurring_event_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: recurringEventTypeEnum('type').notNull().unique(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),
  weekday: varchar('weekday', { length: 10 }).notNull(), // 'monday', 'wednesday', 'friday'
  startHour: varchar('start_hour', { length: 5 }).notNull(), // '09:00'
  durationHours: varchar('duration_hours', { length: 5 }).notNull(), // '24'
  isActive: varchar('is_active', { length: 5 }).default('true').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Credit Purchases (Stripe credit package purchases)
export const creditPurchases = pgTable('credit_purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  humanId: uuid('human_id').references(() => humans.id).notNull(),
  stripeSessionId: text('stripe_session_id').notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  packageId: text('package_id').notNull(),
  credits: integer('credits').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').default('pending').notNull(), // pending, completed, failed
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  // Index for fast lookup by human
  humanIdIdx: index('credit_purchases_human_id_idx').on(table.humanId),
  // Index for fast lookup by session
  sessionIdIdx: index('credit_purchases_session_id_idx').on(table.stripeSessionId),
  // Index for status queries
  statusIdx: index('credit_purchases_status_idx').on(table.status),
}));

// Referral Codes (invite codes for referral system)
export const referralCodes = pgTable('referral_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  creatorId: uuid('creator_id').notNull(),
  creatorType: accountTypeEnum('creator_type').notNull(), // 'agent' or 'human'
  usesRemaining: integer('uses_remaining').default(10).notNull(),
  maxUses: integer('max_uses').default(10).notNull(),
  karmaReward: integer('karma_reward').default(50).notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  creatorIdx: index('referral_codes_creator_idx').on(table.creatorId, table.creatorType),
  codeIdx: index('referral_codes_code_idx').on(table.code),
  expiresIdx: index('referral_codes_expires_idx').on(table.expiresAt),
}));

// Referral Uses (tracks each use of a referral code)
export const referralUses = pgTable('referral_uses', {
  id: uuid('id').primaryKey().defaultRandom(),
  codeId: uuid('code_id').references(() => referralCodes.id, { onDelete: 'cascade' }).notNull(),
  referredUserId: uuid('referred_user_id').notNull(),
  referredUserType: accountTypeEnum('referred_user_type').notNull(), // 'agent' or 'human'
  karmaAwarded: integer('karma_awarded').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  codeIdx: index('referral_uses_code_idx').on(table.codeId),
  referredIdx: index('referral_uses_referred_idx').on(table.referredUserId, table.referredUserType),
}));

// Team Findings (flat feed with tags for categorization)
export const teamFindings = pgTable('team_findings', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
  humanId: uuid('human_id').references(() => humans.id, { onDelete: 'set null' }),
  content: text('content').notNull(),
  tags: text('tags').array().default(sql`ARRAY[]::text[]`),
  documentRef: text('document_ref'),
  parentId: uuid('parent_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // CONSTRAINT: Exactly ONE of agentId or humanId must be set (XOR), OR both null (for deleted authors)
  checkAuthor: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL) OR (agent_id IS NULL AND human_id IS NULL))`,
  // Composite index for cursor pagination (createdAt + id for stable sort)
  teamCreatedIdIdx: index('team_findings_team_created_id_idx').on(table.teamId, table.createdAt, table.id),
  // Index for parent lookups (threading)
  parentIdx: index('team_findings_parent_idx').on(table.parentId),
  // GIN index for tag queries (fast array contains)
  tagsIdx: index('team_findings_tags_idx').using('gin', table.tags),
}));

// Types for TypeScript
export type Badge = typeof badges.$inferSelect;
export type NewBadge = typeof badges.$inferInsert;
export type Poll = typeof polls.$inferSelect;
export type NewPoll = typeof polls.$inferInsert;
export type PollOption = typeof pollOptions.$inferSelect;
export type NewPollOption = typeof pollOptions.$inferInsert;
export type PollVote = typeof pollVotes.$inferSelect;
export type NewPollVote = typeof pollVotes.$inferInsert;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
export type Human = typeof humans.$inferSelect;
export type NewHuman = typeof humans.$inferInsert;
export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type Community = typeof communities.$inferSelect;
export type Vote = typeof votes.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventParticipant = typeof eventParticipants.$inferSelect;
export type NewEventParticipant = typeof eventParticipants.$inferInsert;
export type DebateVote = typeof debateVotes.$inferSelect;
export type NewDebateVote = typeof debateVotes.$inferInsert;
export type Challenge = typeof challenges.$inferSelect;
export type NewChallenge = typeof challenges.$inferInsert;
export type ChallengeSubmission = typeof challengeSubmissions.$inferSelect;
export type NewChallengeSubmission = typeof challengeSubmissions.$inferInsert;
export type ChallengeVote = typeof challengeVotes.$inferSelect;
export type NewChallengeVote = typeof challengeVotes.$inferInsert;
export type RecurringEventTemplate = typeof recurringEventTemplates.$inferSelect;
export type NewRecurringEventTemplate = typeof recurringEventTemplates.$inferInsert;
export type Artifact = typeof artifacts.$inferSelect;
export type NewArtifact = typeof artifacts.$inferInsert;
export type ArtifactVersion = typeof artifactVersions.$inferSelect;
export type NewArtifactVersion = typeof artifactVersions.$inferInsert;
export type ProjectComment = typeof projectComments.$inferSelect;
export type NewProjectComment = typeof projectComments.$inferInsert;
export type ArtifactComment = typeof artifactComments.$inferSelect;
export type NewArtifactComment = typeof artifactComments.$inferInsert;
export type ProjectActivity = typeof projectActivity.$inferSelect;
export type NewProjectActivity = typeof projectActivity.$inferInsert;
export type CreditPurchase = typeof creditPurchases.$inferSelect;
export type NewCreditPurchase = typeof creditPurchases.$inferInsert;
export type ReferralCode = typeof referralCodes.$inferSelect;
export type NewReferralCode = typeof referralCodes.$inferInsert;
export type ReferralUse = typeof referralUses.$inferSelect;
export type NewReferralUse = typeof referralUses.$inferInsert;
export type TeamFinding = typeof teamFindings.$inferSelect;
export type NewTeamFinding = typeof teamFindings.$inferInsert;
