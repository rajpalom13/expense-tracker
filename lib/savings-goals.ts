/**
 * Savings Goals utility functions
 * Calculates progress, projections, and required contributions for savings goals.
 */

import type { SavingsGoalConfig, SavingsGoalProgress } from './types';

/**
 * Calculate the number of months between now and a target date.
 * Returns 0 if the target date is in the past.
 */
function monthsBetweenNowAndDate(targetDate: string): number {
  const now = new Date();
  const target = new Date(targetDate);
  const months =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  return Math.max(0, months);
}

/**
 * Calculate the required monthly contribution to reach a savings goal by its target date.
 * If the target date has passed (or is this month), returns the full remaining amount.
 */
export function calculateRequiredMonthly(goal: SavingsGoalConfig): number {
  const remaining = goal.targetAmount - goal.currentAmount;
  if (remaining <= 0) return 0;

  const monthsToTarget = monthsBetweenNowAndDate(goal.targetDate);
  if (monthsToTarget <= 0) return remaining;

  return remaining / monthsToTarget;
}

/**
 * Project when a savings goal will be completed given a monthly savings rate.
 * Returns an ISO date string for the projected completion, or null if already
 * complete or if the savings rate is non-positive (will never complete).
 */
export function projectGoalCompletion(
  goal: SavingsGoalConfig,
  monthlySavings: number
): string | null {
  if (goal.currentAmount >= goal.targetAmount) return null;
  if (monthlySavings <= 0) return null;

  const remaining = goal.targetAmount - goal.currentAmount;
  const monthsNeeded = Math.ceil(remaining / monthlySavings);

  const completionDate = new Date();
  completionDate.setMonth(completionDate.getMonth() + monthsNeeded);
  return completionDate.toISOString();
}

/**
 * Calculate full progress metrics for a savings goal.
 * Optionally accepts an external monthlySavings figure (e.g. derived from
 * actual transaction data) to refine the on-track calculation.
 */
export function calculateGoalProgress(
  goal: SavingsGoalConfig,
  monthlySavings?: number
): SavingsGoalProgress {
  const percentageComplete = Math.min(
    100,
    (goal.currentAmount / goal.targetAmount) * 100
  );

  const monthsRemaining = monthsBetweenNowAndDate(goal.targetDate);
  const remaining = goal.targetAmount - goal.currentAmount;
  const requiredMonthly =
    monthsRemaining > 0 ? remaining / monthsRemaining : remaining;

  // Determine on-track status
  let onTrack: boolean;
  if (goal.currentAmount >= goal.targetAmount) {
    onTrack = true;
  } else if (goal.monthlyContribution > 0) {
    onTrack = goal.monthlyContribution >= requiredMonthly;
    // If an external monthlySavings figure is provided, also check that
    if (monthlySavings !== undefined) {
      onTrack = onTrack && monthlySavings >= requiredMonthly;
    }
  } else if (monthlySavings !== undefined) {
    onTrack = monthlySavings >= requiredMonthly;
  } else {
    onTrack = false;
  }

  // Project completion date based on monthly contribution
  const projectedCompletionDate =
    goal.monthlyContribution > 0
      ? projectGoalCompletion(goal, goal.monthlyContribution)
      : null;

  return {
    ...goal,
    percentageComplete,
    onTrack,
    requiredMonthly,
    projectedCompletionDate,
    monthsRemaining,
  };
}
