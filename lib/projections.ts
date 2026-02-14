/**
 * Growth Projections & FIRE Calculator Engine
 *
 * Provides financial projection functions for SIP future value,
 * emergency fund progress, net worth growth, FIRE calculations,
 * and investment growth projections.
 */

import { FIRECalculation } from './types';

/**
 * Project the future value of a Systematic Investment Plan (SIP).
 *
 * Uses the standard SIP formula:
 *   FV = P * [((1+r)^n - 1) / r] * (1+r)
 * where r = monthlyRate, n = totalMonths, P = monthlyAmount.
 *
 * @param monthlyAmount - Monthly SIP contribution
 * @param expectedAnnualReturn - Expected annual return as a percentage (e.g., 12 for 12%)
 * @param years - Investment horizon in years
 * @returns Future value of the SIP
 */
export function projectSIPFutureValue(
  monthlyAmount: number,
  expectedAnnualReturn: number,
  years: number
): number {
  const n = years * 12;
  const r = expectedAnnualReturn / 100 / 12;

  if (r === 0) {
    return monthlyAmount * n;
  }

  const fv = monthlyAmount * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
  return Math.round(fv * 100) / 100;
}

/**
 * Project progress toward an emergency fund goal.
 *
 * @param currentBalance - Current savings/emergency fund balance
 * @param monthlySavings - Monthly amount being saved toward the fund
 * @param targetMonths - Number of months of expenses to cover (e.g., 6)
 * @param monthlyExpense - Average monthly expense amount
 * @returns Object with current coverage, target, and months to reach target
 */
export function projectEmergencyFundProgress(
  currentBalance: number,
  monthlySavings: number,
  targetMonths: number,
  monthlyExpense: number
): { currentMonths: number; targetMonths: number; monthsToTarget: number } {
  const currentMonths = monthlyExpense > 0
    ? Math.round((currentBalance / monthlyExpense) * 100) / 100
    : 0;

  const targetAmount = targetMonths * monthlyExpense;
  const gap = targetAmount - currentBalance;

  let monthsToTarget: number;
  if (gap <= 0) {
    // Already at or above target
    monthsToTarget = 0;
  } else if (monthlySavings <= 0) {
    // Cannot reach target without savings
    monthsToTarget = -1;
  } else {
    monthsToTarget = Math.ceil(gap / monthlySavings);
  }

  return {
    currentMonths,
    targetMonths,
    monthsToTarget,
  };
}

/**
 * Project net worth growth over a number of years.
 *
 * For each year, calculates both the total invested amount (linear growth)
 * and the projected compounded value (including investment returns).
 *
 * @param currentNetWorth - Starting net worth
 * @param monthlySavings - Monthly savings amount
 * @param investmentReturnPercent - Expected annual investment return as a percentage
 * @param years - Number of years to project
 * @returns Array of yearly projections with invested and projected values
 */
export function projectNetWorthGrowth(
  currentNetWorth: number,
  monthlySavings: number,
  investmentReturnPercent: number,
  years: number
): { year: number; invested: number; projected: number }[] {
  const annualReturn = investmentReturnPercent / 100;
  const annualSavings = monthlySavings * 12;
  const results: { year: number; invested: number; projected: number }[] = [];

  let compoundedValue = currentNetWorth;

  for (let y = 1; y <= years; y++) {
    // Invested is simply linear accumulation
    const invested = currentNetWorth + annualSavings * y;

    // Projected: compound existing value, then add this year's savings
    compoundedValue = (compoundedValue + annualSavings) * (1 + annualReturn);

    results.push({
      year: y,
      invested: Math.round(invested * 100) / 100,
      projected: Math.round(compoundedValue * 100) / 100,
    });
  }

  return results;
}

/**
 * Calculate Financial Independence / Retire Early (FIRE) metrics.
 *
 * Uses the 4% rule: fireNumber = 25 * annualExpenses.
 * Simulates year-by-year growth to determine years to FIRE.
 * Also calculates the monthly savings required to reach FIRE in 30 years.
 *
 * @param annualExpenses - Current annual expenses
 * @param currentNetWorth - Current total net worth
 * @param monthlySavings - Current monthly savings
 * @param expectedReturnPercent - Expected annual investment return as a percentage
 * @returns Complete FIRE calculation with projection data
 */
export function calculateFIRE(
  annualExpenses: number,
  currentNetWorth: number,
  monthlySavings: number,
  expectedReturnPercent: number
): FIRECalculation {
  const fireNumber = 25 * annualExpenses;
  const progressPercent = fireNumber > 0
    ? Math.round((currentNetWorth / fireNumber) * 10000) / 100
    : 0;

  const annualReturn = expectedReturnPercent / 100;
  const annualSavings = monthlySavings * 12;

  // Simulate year-by-year to find yearsToFIRE
  let yearsToFIRE = 0;
  let netWorth = currentNetWorth;

  if (currentNetWorth < fireNumber) {
    const maxYears = 100;
    for (let y = 1; y <= maxYears; y++) {
      netWorth = netWorth * (1 + annualReturn) + annualSavings;
      if (netWorth >= fireNumber) {
        yearsToFIRE = y;
        break;
      }
    }
    // If we never reach it within 100 years
    if (netWorth < fireNumber) {
      yearsToFIRE = 100;
    }
  }

  // Calculate monthlyRequired to reach FIRE in 30 years
  const monthlyRequired = calculateRequiredMonthlySavings(
    fireNumber,
    currentNetWorth,
    expectedReturnPercent,
    30
  );

  // Build projection data: year 0 through min(yearsToFIRE + 5, 50)
  const projectionEnd = Math.min(yearsToFIRE + 5, 50);
  const projectionData: { year: number; netWorth: number; fireTarget: number }[] = [];

  let projectedNW = currentNetWorth;
  projectionData.push({
    year: 0,
    netWorth: Math.round(projectedNW * 100) / 100,
    fireTarget: fireNumber,
  });

  for (let y = 1; y <= projectionEnd; y++) {
    projectedNW = projectedNW * (1 + annualReturn) + annualSavings;
    projectionData.push({
      year: y,
      netWorth: Math.round(projectedNW * 100) / 100,
      fireTarget: fireNumber,
    });
  }

  return {
    fireNumber: Math.round(fireNumber * 100) / 100,
    annualExpenses,
    currentNetWorth,
    progressPercent,
    yearsToFIRE,
    monthlyRequired: Math.round(monthlyRequired * 100) / 100,
    projectionData,
  };
}

/**
 * Calculate the required monthly savings to reach a target amount in a given
 * number of years, starting from a current net worth with compound growth.
 *
 * Solves for PMT in the future value formula using the annuity approach:
 *   FV = PV * (1+r)^n + PMT * [((1+r)^n - 1) / r]
 *   PMT = (FV - PV * (1+r)^n) * r / ((1+r)^n - 1)
 *
 * @param targetAmount - Amount to reach
 * @param currentAmount - Starting amount
 * @param annualReturnPercent - Annual return as percentage
 * @param years - Years to reach target
 * @returns Required monthly savings amount
 */
function calculateRequiredMonthlySavings(
  targetAmount: number,
  currentAmount: number,
  annualReturnPercent: number,
  years: number
): number {
  const r = annualReturnPercent / 100 / 12;
  const n = years * 12;

  if (r === 0) {
    const gap = targetAmount - currentAmount;
    return n > 0 ? Math.max(0, gap / n) : 0;
  }

  const compoundFactor = Math.pow(1 + r, n);
  const futureCurrentValue = currentAmount * compoundFactor;
  const gap = targetAmount - futureCurrentValue;

  if (gap <= 0) {
    // Current savings will grow to exceed the target without additional contributions
    return 0;
  }

  const annuityFactor = (compoundFactor - 1) / r;
  return gap / annuityFactor;
}

/**
 * Project investment growth for a portfolio of investments.
 *
 * For each investment, projects future value using:
 * - SIP formula if monthlyAmount > 0 (ongoing contributions)
 * - Compound growth if lump sum only (monthlyAmount = 0)
 *
 * @param investments - Array of investments with current value, monthly amount, and expected return
 * @param years - Maximum projection horizon (used for reference; returns 3y, 5y, 10y marks)
 * @returns Array of investment projections at 3, 5, and 10 year marks
 */
export function projectInvestmentGrowth(
  investments: {
    name: string;
    currentValue: number;
    monthlyAmount: number;
    expectedReturn: number;
  }[],
  years: number
): {
  name: string;
  current: number;
  projected3y: number;
  projected5y: number;
  projected10y: number;
}[] {
  return investments.map((inv) => {
    const projected3y = projectValue(inv.currentValue, inv.monthlyAmount, inv.expectedReturn, 3);
    const projected5y = projectValue(inv.currentValue, inv.monthlyAmount, inv.expectedReturn, 5);
    const projected10y = projectValue(inv.currentValue, inv.monthlyAmount, inv.expectedReturn, 10);

    return {
      name: inv.name,
      current: inv.currentValue,
      projected3y: Math.round(projected3y * 100) / 100,
      projected5y: Math.round(projected5y * 100) / 100,
      projected10y: Math.round(projected10y * 100) / 100,
    };
  });
}

/**
 * Project the future value of an investment with optional monthly contributions.
 *
 * Combines lump sum compound growth with SIP future value.
 *
 * @param currentValue - Current investment value (lump sum)
 * @param monthlyAmount - Monthly contribution (0 for lump sum only)
 * @param annualReturnPercent - Expected annual return as percentage
 * @param years - Projection horizon in years
 * @returns Projected future value
 */
function projectValue(
  currentValue: number,
  monthlyAmount: number,
  annualReturnPercent: number,
  years: number
): number {
  const annualReturn = annualReturnPercent / 100;

  // Compound growth on existing value
  const lumpSumFV = currentValue * Math.pow(1 + annualReturn, years);

  // SIP future value for monthly contributions
  let sipFV = 0;
  if (monthlyAmount > 0) {
    sipFV = projectSIPFutureValue(monthlyAmount, annualReturnPercent, years);
  }

  return lumpSumFV + sipFV;
}
