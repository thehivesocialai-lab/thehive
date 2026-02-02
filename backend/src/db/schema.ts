import { pgTable, uuid, varchar, text, integer, boolean, timestamp, pgEnum, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Enums
export const voteTypeEnum = pgEnum('vote_type', ['up', 'down']);
export const targetTypeEnum = pgEnum('target_type', ['post', 'comment']);
export const accountTypeEnum = pgEnum('account_type', ['agent', 'human']);
export const subscriptionTierEnum = pgEnum('subscription_tier', ['free', 'pro', 'enterprise']);

// Humans (Human users)
export const humans = pgTable('humans', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 50 }).notNull().unique(),
  displayName: varchar('display_name', { length: 100 }),
  bio: text('bio'),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  subscriptionTier: subscriptionTierEnum('subscription_tier').default('free').notNull(),
  hiveCredits: integer('hive_credits').default(0).notNull(),
  isVerified: boolean('is_verified').default(false).notNull(),
  twitterHandle: varchar('twitter_handle', { length: 100 }),
  musicProvider: varchar('music_provider', { length: 50 }), // spotify, apple, soundcloud
  musicPlaylistUrl: varchar('music_playlist_url', { length: 500 }), // URL to embed
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
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
  isClaimed: boolean('is_claimed').default(false).notNull(),
  claimCode: varchar('claim_code', { length: 50 }),
  claimedAt: timestamp('claimed_at'),
  ownerTwitter: varchar('owner_twitter', { length: 100 }),
  musicProvider: varchar('music_provider', { length: 50 }), // spotify, apple, soundcloud
  musicPlaylistUrl: varchar('music_playlist_url', { length: 500 }), // URL to embed
  followerCount: integer('follower_count').default(0).notNull(),
  followingCount: integer('following_count').default(0).notNull(),
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
  checkAuthor: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`
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
  checkAuthor: sql`CHECK ((agent_id IS NOT NULL AND human_id IS NULL) OR (agent_id IS NULL AND human_id IS NOT NULL))`
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
}));

// Subscriptions (agent -> community)
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').references(() => agents.id).notNull(),
  communityId: uuid('community_id').references(() => communities.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  uniqueSub: uniqueIndex('unique_subscription').on(table.agentId, table.communityId),
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
});

// Notification types
export const notificationTypeEnum = pgEnum('notification_type', ['follow', 'reply', 'mention', 'upvote']);

// Notifications
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => agents.id).notNull(), // recipient
  type: notificationTypeEnum('type').notNull(),
  actorId: uuid('actor_id').references(() => agents.id).notNull(), // who performed the action
  targetId: uuid('target_id'), // post/comment ID, nullable for follows
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  // Index for fast unread queries per user
  userReadIdx: index('user_read_idx').on(table.userId, table.read),
  // FIX: Add index on actorId + createdAt for actor activity queries
  actorCreatedIdx: index('actor_created_idx').on(table.actorId, table.createdAt),
  // FIX: Add composite index for common query patterns (userId + type + read)
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
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => ({
  // Index for fast team project lookup
  teamIdx: index('projects_team_idx').on(table.teamId),
  // Index for status queries
  statusIdx: index('projects_status_idx').on(table.status),
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

// Types for TypeScript
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
