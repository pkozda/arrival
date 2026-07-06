import type { UpdateScheduleTier } from '../types/ingestion.js';

export type SchedulerConfig = {
  dailyCategories: string[];
  weeklyCategories: string[];
  monthlyCategories: string[];
};

export const DEFAULT_SCHEDULER_CONFIG: SchedulerConfig = {
  dailyCategories: ['municipal', 'ngo'],
  weeklyCategories: ['insurance', 'transport', 'retail'],
  monthlyCategories: ['federal', 'state', 'tax', 'financial', 'education', 'health'],
};

export function resolveScheduleTierForCategory(category: string): UpdateScheduleTier {
  if (DEFAULT_SCHEDULER_CONFIG.dailyCategories.includes(category)) {
    return 'daily';
  }
  if (DEFAULT_SCHEDULER_CONFIG.weeklyCategories.includes(category)) {
    return 'weekly';
  }
  return 'monthly';
}

export type SchedulerTick = {
  tier: UpdateScheduleTier;
  dueAt: string;
  categories: string[];
};

export function buildSchedulerPlan(now = new Date()): SchedulerTick[] {
  return [
    {
      tier: 'daily',
      dueAt: now.toISOString(),
      categories: DEFAULT_SCHEDULER_CONFIG.dailyCategories,
    },
    {
      tier: 'weekly',
      dueAt: now.toISOString(),
      categories: DEFAULT_SCHEDULER_CONFIG.weeklyCategories,
    },
    {
      tier: 'monthly',
      dueAt: now.toISOString(),
      categories: DEFAULT_SCHEDULER_CONFIG.monthlyCategories,
    },
  ];
}
