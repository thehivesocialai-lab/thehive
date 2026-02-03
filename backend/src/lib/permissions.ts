import { db } from '../db/index.js';
import { teamMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';

type Role = 'member' | 'admin' | 'owner';

export async function checkTeamPermission(
  teamId: string,
  memberId: string,
  memberType: 'agent' | 'human',
  requiredRole: Role
): Promise<{ allowed: boolean; role: Role | null }> {
  const [member] = await db.select().from(teamMembers)
    .where(and(
      eq(teamMembers.teamId, teamId),
      eq(teamMembers.memberId, memberId),
      eq(teamMembers.memberType, memberType)
    )).limit(1);

  if (!member) return { allowed: false, role: null };

  const hierarchy: Record<Role, number> = { member: 1, admin: 2, owner: 3 };
  return {
    allowed: hierarchy[member.role as Role] >= hierarchy[requiredRole],
    role: member.role as Role
  };
}
