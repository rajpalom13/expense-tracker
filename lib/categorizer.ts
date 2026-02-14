/**
 * Auto-categorization engine for transactions
 * Uses merchant names and keywords to classify transactions automatically
 * Includes fuzzy matching to handle bank-mangled merchant names
 */

import { TransactionCategory } from './types';

/**
 * Normalize text by removing all whitespace for fuzzy comparison.
 * Banks often mangle merchant names by inserting spaces or truncating,
 * e.g. "ZEPTONO W" -> "zeptonow", "HungerBo x" -> "hungerbox"
 */
function stripSpaces(text: string): string {
  return text.replace(/\s+/g, '');
}

/**
 * Fuzzy match: checks if the pattern appears as a substring
 * after stripping all spaces from both the text and the pattern.
 */
function fuzzyMatch(text: string, pattern: string): boolean {
  const normalizedText = stripSpaces(text.toLowerCase());
  const normalizedPattern = stripSpaces(pattern.toLowerCase());
  return normalizedText.includes(normalizedPattern);
}

/**
 * Merchant patterns for category matching
 * Each category has an array of keywords/patterns to match against
 */
const CATEGORY_PATTERNS: Record<TransactionCategory, string[]> = {
  // Income patterns
  [TransactionCategory.SALARY]: [
    'salary',
    'payroll',
    'wage',
    'monthly income',
    'compensation',
  ],
  [TransactionCategory.FREELANCE]: [
    'freelance',
    'upwork',
    'fiverr',
    'consulting',
    'contract payment',
  ],
  [TransactionCategory.BUSINESS]: [
    'business income',
    'revenue',
    'sales',
    'client payment',
  ],
  [TransactionCategory.INVESTMENT_INCOME]: [
    'dividend',
    'interest',
    'capital gains',
    'mutual fund',
    'stock sale',
  ],
  [TransactionCategory.OTHER_INCOME]: [
    'bonus',
    'gift received',
    'cashback',
    'refund',
    'poonam',
    'jasvin',
    'mohit',
    'chhavi',
    'aaryan',
    'google',
    'transfer received',
  ],

  // Essential expenses
  [TransactionCategory.RENT]: [
    'rent',
    'lease',
    'housing',
    'apartment',
    'landlord',
  ],
  [TransactionCategory.UTILITIES]: [
    'electricity',
    'water',
    'gas',
    'internet',
    'broadband',
    'phone bill',
    'mobile recharge',
    'airtel',
    'jio',
    'vodafone',
    'bsnl',
  ],
  [TransactionCategory.GROCERIES]: [
    'grocery',
    'supermarket',
    'big bazaar',
    'dmart',
    'reliance fresh',
    'more',
    'spencers',
    'fresh',
    'vegetables',
    'fruits',
    'kirana',
    'zepto',
    'blinkit',
    'instamart',
    'dunzo',
  ],
  [TransactionCategory.HEALTHCARE]: [
    'hospital',
    'doctor',
    'pharmacy',
    'medical',
    'clinic',
    'apollo',
    'fortis',
    'max',
    'medicine',
    'health',
  ],
  [TransactionCategory.INSURANCE]: [
    'insurance',
    'premium',
    'lic',
    'hdfc life',
    'icici prudential',
    'policy',
  ],
  [TransactionCategory.TRANSPORT]: [
    'uber',
    'ola',
    'rapido',
    'taxi',
    'metro',
    'bus',
    'auto',
    'rickshaw',
    'parking',
  ],
  [TransactionCategory.FUEL]: [
    'petrol',
    'diesel',
    'fuel',
    'gas station',
    'bharat petroleum',
    'indian oil',
    'hp',
    'shell',
  ],

  // Lifestyle
  [TransactionCategory.DINING]: [
    'restaurant',
    'cafe',
    'swiggy',
    'zomato',
    'food',
    'dining',
    'pizza',
    'burger',
    'mcdonald',
    'kfc',
    'dominos',
    'starbucks',
    'cafe coffee day',
    'hungerbox',
    'hunger box',
    'food delivery',
    'wrap chip',
  ],
  [TransactionCategory.ENTERTAINMENT]: [
    'movie',
    'cinema',
    'pvr',
    'inox',
    'netflix',
    'amazon prime',
    'hotstar',
    'spotify',
    'concert',
    'event',
    'bookmyshow',
    'apple',
    'apple me',
  ],
  [TransactionCategory.SHOPPING]: [
    'amazon',
    'flipkart',
    'myntra',
    'ajio',
    'shopping',
    'retail',
    'mall',
    'store',
    'clothing',
    'electronics',
    'zudio',
    'rebel',
  ],
  [TransactionCategory.TRAVEL]: [
    'flight',
    'hotel',
    'makemytrip',
    'goibibo',
    'cleartrip',
    'irctc',
    'train',
    'travel',
    'vacation',
    'booking',
  ],
  [TransactionCategory.EDUCATION]: [
    'school',
    'college',
    'university',
    'course',
    'tuition',
    'books',
    'udemy',
    'coursera',
    'education',
    'thapar',
    'institute',
    'college fees',
  ],
  [TransactionCategory.FITNESS]: [
    'gym',
    'fitness',
    'yoga',
    'sports',
    'cult.fit',
    'healthify',
    'trainer',
  ],
  [TransactionCategory.PERSONAL_CARE]: [
    'salon',
    'spa',
    'barber',
    'beauty',
    'cosmetics',
    'grooming',
  ],

  // Financial
  [TransactionCategory.SAVINGS]: [
    'savings account',
    'deposit',
    'fd',
    'fixed deposit',
    'recurring deposit',
  ],
  [TransactionCategory.INVESTMENT]: [
    'investment',
    'mutual fund',
    'sip',
    'stocks',
    'shares',
    'zerodha',
    'groww',
    'growsy',
    'upstox',
  ],
  [TransactionCategory.LOAN_PAYMENT]: [
    'loan',
    'emi',
    'mortgage',
    'home loan',
    'car loan',
    'personal loan',
  ],
  [TransactionCategory.CREDIT_CARD]: [
    'credit card',
    'cc payment',
    'card bill',
  ],
  [TransactionCategory.TAX]: [
    'tax',
    'income tax',
    'gst',
    'tds',
  ],

  // Other
  [TransactionCategory.SUBSCRIPTION]: [
    'subscription',
    'membership',
    'annual fee',
    'monthly plan',
  ],
  [TransactionCategory.GIFTS]: [
    'gift',
    'present',
    'flowers',
  ],
  [TransactionCategory.CHARITY]: [
    'donation',
    'charity',
    'ngo',
    'temple',
    'church',
    'mosque',
  ],
  [TransactionCategory.MISCELLANEOUS]: [
    'miscellaneous',
    'misc',
    'other',
    'monu',
    'ramesh',
    'binder',
    'ishan',
    'punit',
    'amit ku',
    'jatinder',
    'shashwa',
  ],
  [TransactionCategory.UNCATEGORIZED]: [],
};

/**
 * Categorizes a transaction based on merchant name and description
 * Uses fuzzy matching to handle bank-mangled merchant names
 * @param merchant - Merchant name from transaction
 * @param description - Transaction description
 * @returns Detected category or UNCATEGORIZED
 */
export function categorizeTransaction(
  merchant: string,
  description: string
): TransactionCategory {
  const searchText = `${merchant} ${description}`;

  // Try to match against category patterns using fuzzy matching
  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    for (const pattern of patterns) {
      if (fuzzyMatch(searchText, pattern)) {
        return category as TransactionCategory;
      }
    }
  }

  // Default to uncategorized if no match found
  return TransactionCategory.UNCATEGORIZED;
}

/**
 * Bulk categorize multiple transactions
 * @param transactions - Array of transaction data
 * @returns Array of categories matching input order
 */
export function bulkCategorize(
  transactions: Array<{ merchant: string; description: string }>
): TransactionCategory[] {
  return transactions.map(({ merchant, description }) =>
    categorizeTransaction(merchant, description)
  );
}

/**
 * Get suggested categories for a merchant/description
 * Returns top 3 most likely categories with confidence scores
 * @param merchant - Merchant name
 * @param description - Transaction description
 * @returns Array of category suggestions with scores
 */
export function getSuggestedCategories(
  merchant: string,
  description: string
): Array<{ category: TransactionCategory; confidence: number }> {
  const searchText = `${merchant} ${description}`;
  const suggestions: Array<{ category: TransactionCategory; confidence: number }> = [];

  for (const [category, patterns] of Object.entries(CATEGORY_PATTERNS)) {
    let matchCount = 0;
    const totalMatches = patterns.length;

    if (totalMatches === 0) continue;

    for (const pattern of patterns) {
      if (fuzzyMatch(searchText, pattern)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      const confidence = matchCount / totalMatches;
      suggestions.push({
        category: category as TransactionCategory,
        confidence: Math.min(confidence * 100, 100),
      });
    }
  }

  // Sort by confidence and return top 3
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

/**
 * Add custom pattern for a category
 * Useful for user-specific merchant patterns
 * @param category - Category to add pattern to
 * @param pattern - Pattern to add
 */
export function addCustomPattern(
  category: TransactionCategory,
  pattern: string
): void {
  if (!CATEGORY_PATTERNS[category].includes(pattern)) {
    CATEGORY_PATTERNS[category].push(pattern);
  }
}

/**
 * Get all patterns for a category
 * @param category - Category to get patterns for
 * @returns Array of patterns
 */
export function getCategoryPatterns(
  category: TransactionCategory
): string[] {
  return [...CATEGORY_PATTERNS[category]];
}

/**
 * Check if a merchant matches a specific category
 * @param merchant - Merchant name
 * @param category - Category to check
 * @returns True if merchant matches category patterns
 */
export function merchantMatchesCategory(
  merchant: string,
  category: TransactionCategory
): boolean {
  const patterns = CATEGORY_PATTERNS[category];

  return patterns.some(pattern => fuzzyMatch(merchant, pattern));
}
