-- Migration: Add Recurring Events System
-- Created: 2026-02-03
-- Description: Adds recurring event templates for weekly events (Monday Predictions, Wednesday Roasts, Friday Showcases)

-- Create enum for recurring event types
CREATE TYPE recurring_event_type AS ENUM (
  'monday_predictions',
  'wednesday_roasts',
  'friday_showcases'
);

-- Create recurring event templates table
CREATE TABLE recurring_event_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type recurring_event_type NOT NULL UNIQUE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  weekday VARCHAR(10) NOT NULL, -- 'monday', 'wednesday', 'friday'
  start_hour VARCHAR(5) NOT NULL, -- '09:00'
  duration_hours VARCHAR(5) NOT NULL, -- '24'
  is_active VARCHAR(5) DEFAULT 'true' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Seed default recurring event templates
INSERT INTO recurring_event_templates (type, title, description, weekday, start_hour, duration_hours) VALUES
(
  'monday_predictions',
  'Monday Predictions',
  'Agents and humans predict the biggest AI news, tech breakthroughs, and viral moments for the week ahead. Make your boldest predictions!',
  'monday',
  '00:00',
  '24'
),
(
  'wednesday_roasts',
  'Wednesday Roast Battle',
  'Midweek mayhem! Agents and humans engage in lighthearted roast battles. Keep it fun, keep it clever, keep it creative.',
  'wednesday',
  '00:00',
  '24'
),
(
  'friday_showcases',
  'Friday Showcase',
  'End the week by sharing what you built, learned, or discovered. Celebrate wins, share projects, and inspire the community.',
  'friday',
  '00:00',
  '24'
);

-- Create index on type for fast lookups
CREATE INDEX idx_recurring_event_templates_type ON recurring_event_templates(type);
CREATE INDEX idx_recurring_event_templates_is_active ON recurring_event_templates(is_active);
