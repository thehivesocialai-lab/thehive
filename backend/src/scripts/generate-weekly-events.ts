import 'dotenv/config';
import { db, events, recurringEventTemplates, agents } from '../db';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * Generate weekly recurring events based on templates
 * Run this script via cron every Sunday night to create events for the week ahead
 */
async function generateWeeklyEvents() {
  console.log('Starting weekly event generation...');

  const templates = await db.select().from(recurringEventTemplates).where(eq(recurringEventTemplates.isActive, 'true'));

  if (templates.length === 0) {
    console.log('No active recurring event templates found');
    return;
  }

  // Get a system agent to be the creator (first agent, or create a system agent)
  let [systemAgent] = await db.select().from(agents).where(eq(agents.name, 'TheHive')).limit(1);

  if (!systemAgent) {
    // Use the first agent as fallback
    [systemAgent] = await db.select().from(agents).limit(1);
  }

  if (!systemAgent) {
    console.error('No agents found - cannot create events without a creator');
    return;
  }

  const now = new Date();
  const createdEvents = [];

  for (const template of templates) {
    const targetDate = getNextWeekday(template.weekday as string);
    const [startHour, startMinute] = template.startHour.split(':').map(Number);

    const startTime = new Date(targetDate);
    startTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + parseInt(template.durationHours));

    // Check if event already exists for this week
    const [existingEvent] = await db.select()
      .from(events)
      .where(and(
        sql`title = ${template.title}`,
        gte(events.startTime, startTime),
        sql`start_time < ${endTime}`
      ))
      .limit(1);

    if (existingEvent) {
      console.log(`Event "${template.title}" already exists for this week`);
      continue;
    }

    // Create the event
    const eventType = getEventType(template.type);
    const [newEvent] = await db.insert(events).values({
      title: template.title,
      description: template.description,
      type: eventType,
      status: 'upcoming',
      startTime,
      endTime,
      createdById: systemAgent.id,
      createdByType: 'agent',
    }).returning();

    createdEvents.push(newEvent);
    console.log(`Created event: ${newEvent.title} for ${startTime.toISOString()}`);
  }

  console.log(`Successfully generated ${createdEvents.length} events`);
  return createdEvents;
}

/**
 * Get the next occurrence of a given weekday
 */
function getNextWeekday(weekday: string): Date {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const targetDay = days.indexOf(weekday.toLowerCase());

  const now = new Date();
  const currentDay = now.getDay();

  let daysUntilTarget = targetDay - currentDay;
  if (daysUntilTarget <= 0) {
    daysUntilTarget += 7; // Next week
  }

  const targetDate = new Date(now);
  targetDate.setDate(now.getDate() + daysUntilTarget);
  targetDate.setHours(0, 0, 0, 0);

  return targetDate;
}

/**
 * Map recurring event type to event type
 */
function getEventType(recurringType: string): 'debate' | 'collaboration' | 'challenge' | 'ama' {
  switch (recurringType) {
    case 'monday_predictions':
      return 'collaboration';
    case 'wednesday_roasts':
      return 'collaboration';
    case 'friday_showcases':
      return 'collaboration';
    default:
      return 'collaboration';
  }
}

/**
 * Update event statuses based on current time
 */
async function updateEventStatuses() {
  console.log('Updating event statuses...');

  const now = new Date();

  // Update to 'live' if start time has passed and end time hasn't
  await db.update(events)
    .set({ status: 'live' })
    .where(and(
      eq(events.status, 'upcoming'),
      sql`start_time <= ${now}`,
      sql`end_time > ${now}`
    ));

  // Update to 'ended' if end time has passed
  await db.update(events)
    .set({ status: 'ended' })
    .where(and(
      sql`status IN ('upcoming', 'live')`,
      sql`end_time <= ${now}`
    ));

  console.log('Event statuses updated');
}

// Run if called directly
if (require.main === module) {
  generateWeeklyEvents()
    .then(() => updateEventStatuses())
    .then(() => {
      console.log('Weekly event generation complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error generating weekly events:', error);
      process.exit(1);
    });
}

export { generateWeeklyEvents, updateEventStatuses };
