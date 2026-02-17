import type { LearnTopic, QuizQuestion } from './learn-types'

/* ─── Section definitions ─── */

export interface LearnSection {
  id: string
  title: string
  icon: string
  gradient: string
  accentBg: string
  topicIds: string[]
}

export const SECTIONS: LearnSection[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'IconSchool',
    gradient: 'from-emerald-500/80 to-cyan-500/80',
    accentBg: 'from-emerald-500/8 via-cyan-500/5 to-transparent',
    topicIds: ['what-is-investing', 'risk-vs-return', 'emergency-fund'],
  },
  {
    id: 'market-instruments',
    title: 'Market Instruments',
    icon: 'IconChartLine',
    gradient: 'from-blue-500/80 to-violet-500/80',
    accentBg: 'from-blue-500/8 via-violet-500/5 to-transparent',
    topicIds: ['stocks', 'mutual-funds', 'index-funds', 'sip', 'fixed-deposits-debt'],
  },
  {
    id: 'financial-planning',
    title: 'Financial Planning',
    icon: 'IconTarget',
    gradient: 'from-cyan-500/80 to-emerald-500/80',
    accentBg: 'from-cyan-500/8 via-emerald-500/5 to-transparent',
    topicIds: ['budgeting-methods', 'savings-rate', 'net-worth', 'fire'],
  },
  {
    id: 'tax-advanced',
    title: 'Tax & Advanced Topics',
    icon: 'IconReceipt',
    gradient: 'from-amber-500/80 to-rose-500/80',
    accentBg: 'from-amber-500/8 via-rose-500/5 to-transparent',
    topicIds: ['tax-saving', 'xirr-cagr', 'asset-allocation'],
  },
]

/* ─── All topics ─── */

export const TOPICS: LearnTopic[] = [
  // Getting Started
  {
    id: 'what-is-investing',
    title: 'What is Investing?',
    description: 'Why you should invest, the power of compounding, and why savings accounts alone won\'t cut it.',
    section: 'getting-started',
    difficulty: 'beginner',
    readTime: '4 min',
    icon: 'IconBulb',
    tags: ['investing', 'compounding', 'basics', 'savings'],
  },
  {
    id: 'risk-vs-return',
    title: 'Risk vs Return',
    description: 'Understanding how risk and returns are connected, and finding your comfort zone.',
    section: 'getting-started',
    difficulty: 'beginner',
    readTime: '4 min',
    icon: 'IconScale',
    tags: ['risk', 'return', 'diversification', 'basics'],
  },
  {
    id: 'emergency-fund',
    title: 'Emergency Fund',
    description: 'Your financial safety net. Why you absolutely need one before you start investing.',
    section: 'getting-started',
    difficulty: 'beginner',
    readTime: '3 min',
    icon: 'IconShieldCheck',
    tags: ['emergency', 'safety', 'savings', 'basics'],
  },
  // Market Instruments
  {
    id: 'stocks',
    title: 'Stocks (Equities)',
    description: 'How the stock market works, BSE/NSE basics, and key terms every investor should know.',
    section: 'market-instruments',
    difficulty: 'intermediate',
    readTime: '5 min',
    icon: 'IconChartLine',
    tags: ['stocks', 'equities', 'BSE', 'NSE', 'market'],
  },
  {
    id: 'mutual-funds',
    title: 'Mutual Funds',
    description: 'A pooled investment managed by professionals. The easiest way to start investing.',
    section: 'market-instruments',
    difficulty: 'beginner',
    readTime: '5 min',
    icon: 'IconCoins',
    tags: ['mutual funds', 'NAV', 'SIP', 'expense ratio'],
  },
  {
    id: 'index-funds',
    title: 'Index Funds',
    description: 'Why most experts recommend index funds, and what makes them special.',
    section: 'market-instruments',
    difficulty: 'beginner',
    readTime: '4 min',
    icon: 'IconTrendingUp',
    tags: ['index funds', 'Nifty 50', 'passive investing', 'ETF'],
  },
  {
    id: 'sip',
    title: 'SIP (Systematic Investment Plan)',
    description: 'Invest a fixed amount regularly and harness the power of rupee cost averaging.',
    section: 'market-instruments',
    difficulty: 'beginner',
    readTime: '4 min',
    icon: 'IconPigMoney',
    tags: ['SIP', 'rupee cost averaging', 'investing', 'automation'],
  },
  {
    id: 'fixed-deposits-debt',
    title: 'Fixed Deposits & Debt Instruments',
    description: 'Safe, predictable returns. FDs, PPF, EPF, NPS, and government bonds explained.',
    section: 'market-instruments',
    difficulty: 'beginner',
    readTime: '4 min',
    icon: 'IconBuildingBank',
    tags: ['FD', 'PPF', 'EPF', 'NPS', 'bonds', 'debt'],
  },
  // Financial Planning
  {
    id: 'budgeting-methods',
    title: 'Budgeting Methods',
    description: 'Popular frameworks to control spending: 50/30/20, NWI, zero-based, and the envelope method.',
    section: 'financial-planning',
    difficulty: 'beginner',
    readTime: '5 min',
    icon: 'IconWallet',
    tags: ['budgeting', '50/30/20', 'spending', 'planning'],
  },
  {
    id: 'savings-rate',
    title: 'Savings Rate',
    description: 'The single most important number in personal finance. Learn to calculate and improve it.',
    section: 'financial-planning',
    difficulty: 'beginner',
    readTime: '3 min',
    icon: 'IconCalculator',
    tags: ['savings', 'rate', 'income', 'expenses'],
  },
  {
    id: 'net-worth',
    title: 'Net Worth',
    description: 'Your financial scorecard. How to calculate and track the number that truly matters.',
    section: 'financial-planning',
    difficulty: 'beginner',
    readTime: '3 min',
    icon: 'IconChartDonut',
    tags: ['net worth', 'assets', 'liabilities', 'tracking'],
  },
  {
    id: 'fire',
    title: 'Financial Freedom (FIRE)',
    description: 'The movement to retire early. What is FIRE, how to calculate your number, and the different flavors.',
    section: 'financial-planning',
    difficulty: 'intermediate',
    readTime: '5 min',
    icon: 'IconFlame',
    tags: ['FIRE', 'retirement', 'financial independence', '4% rule'],
  },
  // Tax & Advanced
  {
    id: 'tax-saving',
    title: 'Tax Saving Investments',
    description: 'Section 80C, 80D, and other legal ways to reduce your tax bill significantly.',
    section: 'tax-advanced',
    difficulty: 'intermediate',
    readTime: '5 min',
    icon: 'IconReceipt',
    tags: ['tax', '80C', '80D', 'ELSS', 'NPS', 'HRA'],
  },
  {
    id: 'xirr-cagr',
    title: 'XIRR & CAGR',
    description: 'Measure your real investment returns accurately. Stop being fooled by absolute numbers.',
    section: 'tax-advanced',
    difficulty: 'advanced',
    readTime: '4 min',
    icon: 'IconCalculator',
    tags: ['XIRR', 'CAGR', 'returns', 'performance'],
  },
  {
    id: 'asset-allocation',
    title: 'Asset Allocation',
    description: 'How to divide your money across different asset classes for optimal risk-adjusted returns.',
    section: 'tax-advanced',
    difficulty: 'advanced',
    readTime: '5 min',
    icon: 'IconCash',
    tags: ['asset allocation', 'portfolio', 'rebalancing', 'diversification'],
  },
]

export const TOPICS_MAP = new Map(TOPICS.map((t) => [t.id, t]))

/* ─── Static topic content (condensed markdown) ─── */

export const TOPIC_CONTENT: Record<string, string> = {
  'what-is-investing': `## Why Should You Invest?

Investing is putting your money to work so it grows over time. Instead of letting cash sit in a savings account earning 3-4% interest, you deploy it into assets that historically deliver much higher returns.

Here is the uncomfortable truth: inflation in India averages around 6-7% per year. If your savings account pays 3.5%, your money is actually **losing purchasing power** every year.

## The Magic of Compounding

If you invest ₹10,000 at 12% annual return:
- After 10 years: ₹31,058
- After 20 years: ₹96,463
- After 30 years: ₹2,99,599

The secret is that your returns start earning returns. This snowball effect accelerates dramatically over long periods.

## Savings vs Investing

| Option | Return | Risk | Best For |
|--------|--------|------|----------|
| Savings account | 3-4% | Zero | Emergency fund |
| Fixed deposit | 6-7% | Very low | Short-term goals |
| Equity mutual funds | 12-15% | Moderate | 5+ year goals |
| Direct stocks | Variable | High | Experienced investors |

## When to Start?

The best time to start investing was 10 years ago. The second best time is today. A 25-year-old investing ₹5,000/month at 12% will have over ₹3.2 crore by age 55. Starting at 35 with the same amount? Only about ₹95 lakh.

> **Key Takeaway:** Investing is not about getting rich quick. It is about consistently putting money into growing assets and letting compounding do the heavy lifting. Start small, start early, stay consistent.

> **Pro Tip:** Even ₹500/month in an index fund SIP is a great start. The habit matters more than the amount.`,

  'risk-vs-return': `## What is Investment Risk?

Risk does not mean you will definitely lose money. It means the actual return could differ from what you expect. A savings account has almost zero risk. Stocks have higher risk because their value can swing wildly in the short term.

## The Risk-Return Spectrum

- **Savings account (3-4%):** Lowest risk, barely keeps up with inflation
- **Government bonds / PPF (7-8%):** Very low risk, guaranteed by the government
- **Corporate bonds / debt funds (7-10%):** Low to moderate risk
- **Balanced / hybrid funds (10-12%):** Moderate risk, smoother ride
- **Equity mutual funds (12-15%):** Moderate to high risk, great for long-term
- **Direct stocks (variable):** High risk, potentially high reward
- **Crypto / penny stocks:** Very high risk, could make or lose a fortune

## Risk Tolerance: Know Yourself

Your risk tolerance depends on three things:
1. **Age** — younger means more time to recover from dips
2. **Financial situation** — emergency fund first, investments second
3. **Personality** — can you sleep well if your portfolio drops 30%?

## Diversification

Spread your money across different asset types, sectors, and geographies. Think of it as a cricket team: you need batsmen, bowlers, and all-rounders to win consistently.

> **Key Takeaway:** Higher returns always come with higher risk. The goal is not to eliminate risk, but to take the right amount for your age, goals, and temperament. Diversification is your best friend.`,

  'emergency-fund': `## What is an Emergency Fund?

Money set aside specifically for unexpected expenses: medical emergencies, job loss, car breakdown, or urgent home repairs. It is NOT for vacations, gadgets, or sales.

## How Much Do You Need?

**3 to 6 months of essential expenses.** If your monthly essentials (rent, food, EMIs, utilities, insurance) add up to ₹30,000, you need ₹90,000 to ₹1,80,000. If you have dependents or unstable income, aim for 6-12 months.

## Where to Keep It

- **High-yield savings account:** Earns some interest, instantly accessible
- **Liquid mutual fund:** Slightly better returns (5-6%), redeemable within 24 hours
- **Fixed deposit with premature withdrawal:** Decent interest, penalty for early withdrawal
- **NOT in stocks or equity mutual funds:** These can lose value right when you need the money

## How to Build It

Start by saving ₹5,000-10,000 per month until you reach your target. Automate the transfer right after payday so you are not tempted to spend it. Once built, redirect that monthly amount into investments.

> **Key Takeaway:** An emergency fund is not optional. Build it first, invest second. Aim for 6 months of expenses in a liquid, safe account.

> **Pro Tip:** Open a separate bank account for your emergency fund. Out of sight, out of mind.`,

  'stocks': `## How Does the Stock Market Work?

When you buy a stock, you are buying a tiny piece of a company. India has two major exchanges: BSE (est. 1875) and NSE (est. 1992). Companies list shares through an IPO. After that, anyone with a demat account can buy and sell during market hours (9:15 AM to 3:30 PM, Mon-Fri).

## Key Terms You Must Know

- **Market Cap:** Large-cap (>₹20,000 crore) = stable, mid-cap (₹5,000-20,000 crore) = growth, small-cap (<₹5,000 crore) = high risk/reward
- **P/E Ratio:** How much investors pay per rupee of earnings. P/E of 20 = ₹20 for every ₹1 earned
- **EPS:** Company's profit divided by number of shares. Higher is better
- **Dividend:** Portion of profits paid to shareholders (ITC, Coal India are famous for this)
- **52-Week High/Low:** Highest and lowest price in the past year

## How to Buy Stocks

You need: PAN card, bank account, and demat account. Sign up with Zerodha, Groww, or Angel One, complete KYC, fund your account. Most brokers charge zero brokerage on delivery trades.

## Tax on Stocks

- **Long-term capital gains** (held >1 year): Above ₹1.25 lakh taxed at 12.5%
- **Short-term gains** (held <1 year): Taxed at 20%

> **Key Takeaway:** Stocks offer the highest long-term returns, but require patience and knowledge. Never invest money you might need within 3-5 years.`,

  'mutual-funds': `## How NAV Works

NAV (Net Asset Value) is the price of one unit. If a fund has ₹100 crore in assets and 10 crore units, NAV = ₹10. When you invest ₹5,000, you get 500 units at NAV ₹10. If NAV rises to ₹12, your 500 units are worth ₹6,000.

## Types of Mutual Funds

- **Equity Funds:** Invest in stocks. Best for 5+ year goals. Sub-types: large-cap, mid-cap, small-cap, flexi-cap
- **Debt Funds:** Invest in bonds and fixed-income. Lower risk (6-8%). Good for 1-3 year goals
- **Hybrid Funds:** Mix of equity and debt. Balanced advantage funds auto-shift between stocks and bonds
- **Index Funds:** Passively track Nifty 50 or similar index. Low expense ratio, no manager bias
- **ELSS:** Equity funds with 3-year lock-in. Tax deduction under Section 80C up to ₹1,50,000

## Expense Ratio

Annual fee deducted from NAV. Active funds: 1-2%. Index funds: 0.1-0.5%. Over 20 years, this difference compounds massively.

## Direct vs Regular Plans

- **Regular plans** include distributor commission — higher expense ratio
- **Direct plans** cut out the middleman — cheaper by 0.5-1%
- Always choose Direct if investing on your own (Zerodha Coin, Groww, Kuvera)

> **Key Takeaway:** Mutual funds are the simplest path to diversified investing. Choose Direct plans, match fund type to your goal timeline, and always check the expense ratio.`,

  'index-funds': `## What is a Market Index?

- **Nifty 50:** Top 50 companies on NSE by market cap — India's benchmark
- **Sensex (BSE 30):** Top 30 companies on BSE
- **Nifty Next 50:** 51st to 100th largest companies
- **Nifty Midcap 150:** 150 mid-sized companies
- **S&P 500:** Top 500 US companies

An index fund simply copies a market index by buying all its stocks in the same proportion.

## Why Index Funds Are Popular

Over a 10-year period, **80-90% of actively managed funds fail to beat their benchmark index** after fees. Index funds have lower expense ratios (0.1-0.2% vs 1-2%), no manager bias, and stay automatically diversified.

## How to Pick an Index Fund

1. Choose a well-known index (Nifty 50 for beginners)
2. Compare expense ratios (aim for under 0.2%)
3. Check tracking error (lower is better)
4. Prefer higher AUM funds
5. Always pick Direct Growth plan

> **Key Takeaway:** A Nifty 50 index fund with low expense ratio is arguably the single best investment for most beginners.

> **Pro Tip:** Nifty 50 has returned about 12-13% CAGR over the last 20 years. A ₹10,000/month SIP for 25 years at 12% would grow to roughly ₹1.9 crore. You invest just ₹30 lakh.`,

  'sip': `## How SIP Works

On a fixed date every month, your bank automatically transfers a set amount to your chosen mutual fund. The fund allots units based on that day's NAV.

- NAV ₹100 → ₹10,000 buys 100 units
- NAV ₹80 → ₹10,000 buys 125 units
- NAV ₹120 → ₹10,000 buys ~83 units

## Rupee Cost Averaging

You automatically buy more units when prices are low and fewer when prices are high. Over time, this averages out your purchase price — no need to time the market.

## The Power of SIP: Real Numbers

| Monthly SIP | Duration | At 12% Return | Amount Invested |
|-------------|----------|---------------|-----------------|
| ₹5,000 | 10 years | ₹11.6 lakh | ₹6 lakh |
| ₹5,000 | 20 years | ₹49.9 lakh | ₹12 lakh |
| ₹5,000 | 30 years | ₹1.76 crore | ₹18 lakh |
| ₹10,000 | 25 years | ₹1.89 crore | ₹30 lakh |
| ₹25,000 | 20 years | ₹2.49 crore | ₹60 lakh |

## SIP Best Practices

- Set up auto-debit so you never miss a payment
- Choose a date right after salary credit
- **Do not stop during market crashes** — that is when you get the best deals
- Increase SIP by 10% every year (step-up SIP)

> **Key Takeaway:** SIP removes emotion from investing. Start with any amount and increase over time. The best SIP is the one you never stop.`,

  'fixed-deposits-debt': `## Fixed Deposits (FDs)

Deposit a lump sum for a fixed period (7 days to 10 years) at a predetermined rate. Currently 6-7.5%. Deposits up to ₹5 lakh per bank are insured by DICGC.

**Downside:** Interest is fully taxable. At 30% tax bracket, a 7% FD gives only ~4.9% post-tax, barely beating inflation.

## PPF (Public Provident Fund)

- Government-backed, currently 7.1% interest
- 15-year lock-in with partial withdrawal from year 7
- Up to ₹1,50,000/year qualifies for 80C deduction
- Interest is completely **tax-free** (EEE status)

## EPF (Employee Provident Fund)

12% of basic salary goes to EPF, matched by employer. Current rate ~8.25%. Essentially forced savings with excellent returns and tax benefits. Transfer it when changing jobs — do not withdraw.

## NPS (National Pension System)

Government retirement scheme. Additional ₹50,000 tax deduction under Section 80CCD(1B). Catch: 40% must be used to buy annuity at retirement.

## Sovereign Gold Bonds (SGBs)

2.5% annual interest plus gold price appreciation. Capital gains tax-free if held till maturity (8 years).

> **Key Takeaway:** Debt instruments are the steady part of your portfolio. PPF for long-term tax-free growth, EPF as forced retirement savings, FDs for short-term needs.`,

  'budgeting-methods': `## The 50/30/20 Rule

Divide after-tax income into three buckets:
- **50% Needs:** Rent, groceries, EMIs, utilities, insurance
- **30% Wants:** Dining out, entertainment, shopping, subscriptions
- **20% Savings/Investments:** SIPs, emergency fund, debt repayment

Example: ₹60,000 take-home → ₹30,000 needs, ₹18,000 wants, ₹12,000 savings.

## NWI Framework

Used in this app. Classifies every transaction into Needs, Wants, or Investments. Target: Needs <50%, Wants <30%, Investments ≥20%.

## Zero-Based Budgeting

Every rupee gets a job. Allocate income to categories until you hit zero. Maximum control but requires more effort.

## Envelope Method

Put cash (or digital equivalents) in labeled envelopes for each category. When empty, stop spending. Works great for overspenders.

## Which Method is Right for You?

- **Just starting out?** Use 50/30/20
- **Want detailed control?** Try zero-based budgeting
- **Overspend on cards?** Try the envelope method
- **Already using this app?** The NWI framework tracks your split automatically

> **Key Takeaway:** The best budget is one you actually follow. Start simple and refine over time.

> **Pro Tip:** Automate your savings. Set up auto-debit for SIPs on payday. What you do not see, you do not spend.`,

  'savings-rate': `## How to Calculate It

**Savings Rate = (Income - Expenses) / Income x 100**

If you earn ₹80,000 and spend ₹55,000: (80,000 - 55,000) / 80,000 = **31.25%**

## Benchmarks

- **Below 10%:** Danger zone — living paycheck to paycheck
- **10-20%:** Acceptable — building wealth slowly
- **20-30%:** Good — on track for comfortable retirement
- **30-50%:** Great — building serious wealth
- **50%+:** Exceptional — fast track to financial independence

## Why It Matters More Than Returns

Someone saving ₹30,000/month at 10% returns builds more wealth than someone saving ₹10,000/month at 15% returns. Over 20 years: ₹2.28 crore vs ₹1.52 crore.

## How to Improve It

1. Track every expense for a month
2. Cut unused subscriptions
3. Cook more, eat out less
4. Increase income through skills and career moves
5. Save raises — when you get a bump, save at least half the increase

> **Key Takeaway:** Aim for at least 20%. A 5% increase today can mean years of earlier retirement.`,

  'net-worth': `## How to Calculate It

**Net Worth = Total Assets - Total Liabilities**

If you have ₹20 lakh in assets and ₹5 lakh in debt, your net worth is ₹15 lakh.

## Assets

- Bank balances (savings, FDs, RDs)
- Investment portfolio (mutual funds, stocks, bonds)
- Retirement accounts (EPF, PPF, NPS)
- Real estate at current market value
- Gold and other physical assets

## Liabilities

- Home loan, car loan, education loan balances
- Credit card debt (outstanding, not limit)
- Personal loans and money owed

## Tracking Over Time

Calculate monthly or quarterly. The absolute number matters less than the **trend**. A consistently rising net worth means you are building wealth.

## Benchmarks by Age (India)

| Age | Target Net Worth |
|-----|-----------------|
| 25 | 0.5x - 1x annual salary |
| 30 | 1x - 3x annual salary |
| 35 | 3x - 5x annual salary |
| 40 | 5x - 8x annual salary |
| 50 | 10x - 15x annual salary |

> **Key Takeaway:** Net worth is your financial GPS. Track it monthly and focus on growing it consistently.`,

  'fire': `## The 4% Rule

If you withdraw 4% of your investment portfolio per year, it should last 30+ years. This means you need **25 times your annual expenses** to be financially independent.

- Spend ₹6 lakh/year → need ₹1.5 crore
- Spend ₹12 lakh/year → need ₹3 crore

For India, many use a conservative 3-3.5% rate (28-33x expenses) to account for higher inflation.

## Types of FIRE

- **Lean FIRE:** Minimalist lifestyle, ₹25,000-35,000/month in tier-2 city
- **Fat FIRE:** Comfortable, no compromises. ₹5+ crore corpus
- **Barista FIRE:** Enough invested for basics, work part-time for extras
- **Coast FIRE:** Invested enough that compounding alone reaches full FIRE number by retirement age

## The Math

Your years to FIRE depends on **savings rate**, not income:
- 20% savings rate → ~37 years
- 50% savings rate → ~17 years
- 70% savings rate → ~8.5 years

## FIRE in India

Advantages: lower cost of living, family support, domestic help. Challenges: higher healthcare costs and inflation (plan for 7-8%). Get comprehensive health insurance.

> **Key Takeaway:** FIRE is not about deprivation. It is about intentional spending and letting compound growth buy your freedom. Even aiming for Coast FIRE is incredibly liberating.`,

  'tax-saving': `## Section 80C (up to ₹1,50,000)

- **ELSS Mutual Funds:** 3-year lock-in (shortest), 12-15% potential returns. Start SIPs early in the year
- **PPF:** 15-year lock-in, 7.1% interest, fully tax-free (EEE status)
- **EPF:** Your 12% basic salary contribution auto-counts. Check payslip for remaining room
- **Life Insurance:** Only term insurance premiums make sense. Avoid endowment plans
- **Home Loan Principal:** Principal component of EMI qualifies under 80C

## Section 80D (Health Insurance)

- ₹25,000 for self/spouse/children
- Additional ₹25,000 for parents (₹50,000 if senior citizens)
- Maximum: ₹1,00,000 if both you and parents are senior citizens

## Section 80CCD(1B) — NPS Extra

Additional ₹50,000 deduction, separate from 80C. For 30% bracket = ₹15,600 tax saved.

## Home Loan Interest (Section 24)

Up to ₹2,00,000/year for self-occupied property. No limit for rented property.

## New vs Old Tax Regime

- **Old regime:** Higher slab rates but all deductions available
- **New regime:** Lower slab rates, almost no deductions, ₹75,000 standard deduction
- Choose old if total deductions exceed ₹3.75-4 lakh

> **Key Takeaway:** Combine 80C (₹1.5L) + 80D (up to ₹1L) + NPS 80CCD(1B) (₹50K) = ₹3L+ deduction. Plan in April, not March.

> **Pro Tip:** ELSS has the shortest lock-in (3 years) among all 80C instruments. Start a monthly SIP early in the financial year.`,

  'xirr-cagr': `## Absolute Return

If you invested ₹1,00,000 and it is now ₹1,50,000, absolute return is 50%. But meaningless without knowing the time period.

## CAGR (Compound Annual Growth Rate)

Converts total return into a smooth annualized rate.

**Formula:** CAGR = (Ending / Beginning)^(1/years) - 1

₹1,00,000 → ₹3,00,000 in 10 years: CAGR = 11.6% per year.

Works perfectly for **lump-sum** investments.

## XIRR (Extended Internal Rate of Return)

The gold standard for **multiple cash flows** at different dates. Accounts for exact timing and amount of every investment and withdrawal. Use this for SIP returns and portfolios.

## When to Use Which

| Metric | Use Case |
|--------|----------|
| Absolute Return | Quick sanity check |
| CAGR | Single lump-sum investment |
| XIRR | SIPs, multiple investments over time |

## Common Pitfalls

- Do not compare CAGR of 2-year vs 10-year investments without context
- Annualized returns under 1 year can be misleading
- Always consider risk-adjusted returns

> **Key Takeaway:** Use CAGR for lump-sum, XIRR for anything with multiple cash flows. This app calculates XIRR automatically for your investments.`,

  'asset-allocation': `## The Age-Based Rule

**Equity allocation = 100 minus your age.** A 25-year-old: 75% equity, 25% debt. Some experts now suggest 110 or 120 minus age.

## Core Asset Classes

- **Equity (12-15% CAGR):** Growth engine. Best for 5+ year goals
- **Debt (6-8%):** Stabilizer. Best for 1-5 year goals and portfolio balance
- **Gold (SGBs/ETFs):** Hedge. 5-10% allocation. SGBs also pay 2.5% interest
- **Real Estate:** Most Indians are over-allocated here. Account for property when deciding other allocations
- **Cash/Liquid:** Emergency fund + short-term needs only

## Sample Allocations

| Profile | Equity | Debt | Gold |
|---------|--------|------|------|
| Aggressive (25-35) | 70-80% | 10-15% | 5-10% |
| Balanced (35-50) | 50-60% | 25-30% | 10% |
| Conservative (50+) | 30-40% | 40-50% | 10% |

## Rebalancing

When allocation drifts >5% from target, rebalance by selling the overweight asset and buying the underweight. This forces you to sell high and buy low. Do it once or twice a year.

## International Diversification

Allocate 10-20% to US/global equity through fund-of-funds. Provides currency diversification and access to Apple, Google, Amazon etc.

> **Key Takeaway:** Asset allocation explains over 90% of portfolio return variation. Start with an age-based rule, include some gold, and rebalance annually.`,
}

/* ─── Quiz questions ─── */

export const TOPIC_QUIZZES: Record<string, QuizQuestion[]> = {
  'what-is-investing': [
    {
      question: 'What is the primary reason savings accounts alone are insufficient for long-term wealth building?',
      options: [
        'Banks charge high fees on savings accounts',
        'Savings account interest (3-4%) is lower than inflation (6-7%)',
        'The government limits how much you can keep in savings',
        'Savings accounts have a maximum balance limit',
      ],
      correctIndex: 1,
      explanation: 'With inflation averaging 6-7% in India and savings accounts earning only 3-4%, your money loses purchasing power over time. You need investments that outpace inflation.',
    },
    {
      question: 'If you invest ₹10,000 at 12% annual return, approximately how much will you have after 30 years?',
      options: [
        '₹46,000',
        '₹96,463',
        '₹2,99,599',
        '₹10,00,000',
      ],
      correctIndex: 2,
      explanation: 'Compounding at 12% for 30 years turns ₹10,000 into approximately ₹2,99,599 — nearly 30x your original investment. This is the power of compound interest over long periods.',
    },
    {
      question: 'Why does starting to invest 10 years earlier make such a dramatic difference?',
      options: [
        'You earn more salary when you are younger',
        'Stock markets perform better for younger investors',
        'Compound interest has more time to multiply your returns',
        'Inflation is lower when you start early',
      ],
      correctIndex: 2,
      explanation: 'Compounding is exponential — your returns earn returns. Those extra years allow the snowball effect to dramatically accelerate. A 25-year-old investing ₹5,000/month can accumulate 3x more than someone starting at 35.',
    },
  ],

  'risk-vs-return': [
    {
      question: 'Which of the following correctly orders investments from lowest to highest risk?',
      options: [
        'Stocks → Mutual funds → Fixed deposits → Savings account',
        'Savings account → PPF → Equity mutual funds → Direct stocks',
        'PPF → Savings account → Stocks → Mutual funds',
        'Mutual funds → Stocks → Savings account → PPF',
      ],
      correctIndex: 1,
      explanation: 'Risk increases as you move from guaranteed instruments (savings account, PPF) to market-linked ones (equity mutual funds, direct stocks).',
    },
    {
      question: 'What is the primary purpose of diversification?',
      options: [
        'To guarantee positive returns every year',
        'To eliminate all investment risk',
        'To reduce the impact of any single investment performing poorly',
        'To maximize returns in the short term',
      ],
      correctIndex: 2,
      explanation: 'Diversification reduces risk by spreading investments across different assets. If one crashes, others may hold or grow, protecting your overall portfolio.',
    },
    {
      question: 'A 25-year-old can generally take more risk than a 50-year-old because:',
      options: [
        'They earn more money',
        'They have more time to recover from market downturns',
        'They understand the stock market better',
        'Stock markets favor younger investors',
      ],
      correctIndex: 1,
      explanation: 'A longer time horizon means more years for investments to recover from temporary dips. A 25-year-old has 30+ years before retirement, while a 50-year-old may need the money sooner.',
    },
  ],

  'emergency-fund': [
    {
      question: 'How many months of essential expenses should an emergency fund ideally cover?',
      options: [
        '1 month',
        '3 to 6 months',
        '12 to 24 months',
        'As much as possible — there is no limit',
      ],
      correctIndex: 1,
      explanation: '3 to 6 months is the standard recommendation. Those with dependents or unstable income should aim for 6-12 months.',
    },
    {
      question: 'Where is the WORST place to keep your emergency fund?',
      options: [
        'High-yield savings account',
        'Liquid mutual fund',
        'Equity mutual funds or stocks',
        'Fixed deposit with premature withdrawal option',
      ],
      correctIndex: 2,
      explanation: 'Equity investments can lose value right when you need the money most. Emergency funds need to be liquid and low-risk.',
    },
    {
      question: 'When should you start investing in the stock market?',
      options: [
        'Immediately, regardless of savings',
        'After building an emergency fund covering 3-6 months of expenses',
        'Only after you have ₹10 lakh in savings',
        'After retirement planning is complete',
      ],
      correctIndex: 1,
      explanation: 'An emergency fund is the foundation. Without it, unexpected expenses can force you to sell investments at the worst possible time, locking in losses.',
    },
  ],

  'mutual-funds': [
    {
      question: 'What does NAV stand for, and what does it represent?',
      options: [
        'Net Annual Value — the yearly return of a fund',
        'Net Asset Value — the price of one unit of a mutual fund',
        'National Average Value — the benchmark return',
        'Nominal Assessed Value — the taxable value of the fund',
      ],
      correctIndex: 1,
      explanation: 'NAV (Net Asset Value) is the per-unit price of a mutual fund, calculated by dividing total assets by total units. It is updated daily after market hours.',
    },
    {
      question: 'Why should you choose a Direct plan over a Regular plan?',
      options: [
        'Direct plans invest in better stocks',
        'Direct plans have lower expense ratios because they cut out distributor commissions',
        'Direct plans are guaranteed to give higher returns',
        'Direct plans have no exit load',
      ],
      correctIndex: 1,
      explanation: 'Direct plans eliminate the 0.5-1% distributor commission, resulting in a lower expense ratio. Over 20 years, this difference compounds into significantly more returns.',
    },
    {
      question: 'Which type of mutual fund offers tax deduction under Section 80C?',
      options: [
        'Liquid funds',
        'Index funds',
        'ELSS (Equity Linked Savings Scheme)',
        'Debt funds',
      ],
      correctIndex: 2,
      explanation: 'ELSS offers tax deduction up to ₹1,50,000 under Section 80C with a 3-year lock-in — the shortest among all 80C instruments.',
    },
  ],

  'sip': [
    {
      question: 'What is rupee cost averaging?',
      options: [
        'Investing a fixed rupee amount to buy more units when prices are low and fewer when prices are high',
        'Buying stocks only when the market is at its lowest point',
        'Converting foreign currency investments to rupees',
        'Averaging the cost of stocks across different brokers',
      ],
      correctIndex: 0,
      explanation: 'With a fixed SIP amount, you automatically buy more units when NAV is low and fewer when it is high. Over time, this averages your cost per unit, removing the need to time the market.',
    },
    {
      question: 'What should you do when the stock market crashes during your SIP?',
      options: [
        'Stop your SIP immediately to prevent losses',
        'Switch to a debt fund',
        'Continue your SIP — you are buying more units at lower prices',
        'Withdraw all your money',
      ],
      correctIndex: 2,
      explanation: 'Market crashes are actually the best time for SIP investors. Your fixed amount buys significantly more units at depressed prices, boosting long-term returns.',
    },
    {
      question: 'What is a step-up SIP?',
      options: [
        'A SIP that only invests in blue-chip stocks',
        'Increasing your SIP amount periodically (e.g., by 10% yearly) as income grows',
        'A SIP with daily instead of monthly investments',
        'A SIP that starts with a large amount and decreases over time',
      ],
      correctIndex: 1,
      explanation: 'A step-up SIP increases your investment amount periodically, typically by 10% each year, aligning with salary growth and dramatically boosting long-term corpus.',
    },
  ],

  'budgeting-methods': [
    {
      question: 'In the 50/30/20 rule, what does the 20% allocation cover?',
      options: [
        'Rent and utilities',
        'Entertainment and shopping',
        'Savings and investments',
        'Food and groceries',
      ],
      correctIndex: 2,
      explanation: 'The 20% is for savings and investments — SIPs, emergency fund, debt repayment beyond minimums. The 50% covers needs and 30% covers wants.',
    },
    {
      question: 'What is zero-based budgeting?',
      options: [
        'Spending nothing at all in a month',
        'Allocating every rupee of income to a specific category until the total is zero',
        'Starting each month with zero savings',
        'A budget that only includes necessary expenses',
      ],
      correctIndex: 1,
      explanation: 'Zero-based budgeting assigns every rupee a job — from rent to SIPs to entertainment. Income minus all allocations equals zero, giving you maximum control.',
    },
    {
      question: 'Which budgeting method does this finance app use to categorize transactions?',
      options: [
        'The 50/30/20 rule',
        'Zero-based budgeting',
        'NWI (Needs, Wants, Investments) framework',
        'The envelope method',
      ],
      correctIndex: 2,
      explanation: 'This app uses the NWI (Needs, Wants, Investments) framework, automatically classifying each transaction to help you track your spending split.',
    },
  ],

  'fire': [
    {
      question: 'According to the 4% rule, how much do you need invested to withdraw ₹50,000 per month indefinitely?',
      options: [
        '₹60 lakh',
        '₹1 crore',
        '₹1.5 crore',
        '₹3 crore',
      ],
      correctIndex: 2,
      explanation: '₹50,000/month = ₹6 lakh/year. The 4% rule requires 25x annual expenses = ₹6 lakh × 25 = ₹1.5 crore.',
    },
    {
      question: 'What primarily determines how quickly you can reach financial independence?',
      options: [
        'Your total income',
        'Your savings rate',
        'The stock market performance',
        'Your employer benefits',
      ],
      correctIndex: 1,
      explanation: 'Your savings rate is the dominant factor. A high earner who spends everything is no closer to FIRE than a moderate earner who saves 50%+ of their income.',
    },
    {
      question: 'What is "Coast FIRE"?',
      options: [
        'FIRE achieved by moving to a coastal city with lower costs',
        'Having enough invested that compounding alone will reach your full FIRE number by retirement age',
        'Working at a relaxed pace toward financial independence',
        'FIRE achieved through real estate near the coast',
      ],
      correctIndex: 1,
      explanation: 'Coast FIRE means you have invested enough early on that compound growth alone will grow it to your full retirement number by traditional retirement age. You only need to cover current expenses.',
    },
  ],

  'tax-saving': [
    {
      question: 'What is the maximum deduction available under Section 80C?',
      options: [
        '₹50,000',
        '₹1,00,000',
        '₹1,50,000',
        '₹2,00,000',
      ],
      correctIndex: 2,
      explanation: 'Section 80C allows up to ₹1,50,000 in deductions through instruments like ELSS, PPF, EPF, insurance premiums, and home loan principal.',
    },
    {
      question: 'Which Section 80C instrument has the shortest lock-in period?',
      options: [
        'PPF (15 years)',
        'NSC (5 years)',
        'Tax-saver FD (5 years)',
        'ELSS (3 years)',
      ],
      correctIndex: 3,
      explanation: 'ELSS has just a 3-year lock-in — the shortest among all Section 80C instruments — while also offering equity market returns of 12-15%.',
    },
    {
      question: 'What additional tax deduction does NPS offer under Section 80CCD(1B)?',
      options: [
        '₹25,000 over and above 80C',
        '₹50,000 over and above 80C',
        '₹1,00,000 over and above 80C',
        '₹1,50,000 replacing 80C',
      ],
      correctIndex: 1,
      explanation: 'NPS provides an extra ₹50,000 deduction under Section 80CCD(1B), completely separate from the ₹1.5 lakh 80C limit, saving an additional ₹15,600 for those in the 30% bracket.',
    },
  ],
}
