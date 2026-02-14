// Google Sheets integration for transaction data
import { google } from 'googleapis';
import type { GoogleAuth } from 'google-auth-library';
import type { Transaction, RawTransaction } from './types';
import { TransactionCategory, TransactionType, PaymentMethod, TransactionStatus } from './types';
import { categorizeTransaction } from './categorizer';

const SHEET_ID = process.env.GOOGLE_SHEETS_ID || '1yw-KSfgyit84gDoSUgaRsRFH4Mj2DnxXHYaF_yx3UTA';
const SHEET_NAME = 'Sheet1'; // Adjust if your sheet has a different name

// In-memory cache for transactions
let cachedTransactions: Transaction[] | null = null;
let lastSyncTime: string | null = null;

/**
 * Check if Google Sheets authentication is configured
 */
function isAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_API_KEY ||
    (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY));
}

/**
 * Get Google Sheets authentication
 */
function getGoogleAuth(): string | GoogleAuth {
  // For public sheets, we can use API key
  // For private sheets, use OAuth2 or service account
  const apiKey = process.env.GOOGLE_API_KEY;

  if (apiKey) {
    return apiKey;
  }

  // Fallback to service account if configured
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    return auth;
  }

  throw new Error('Google Sheets authentication not configured');
}

/**
 * Generate demo transactions for development/testing
 */
function generateDemoTransactions(): Transaction[] {
  const now = new Date();
  const demoData: Transaction[] = [
    {
      id: 'txn_demo_1',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
      description: 'Grocery Shopping',
      merchant: 'Whole Foods',
      category: TransactionCategory.GROCERIES,
      amount: 125.50,
      type: TransactionType.EXPENSE,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      account: 'Chase Sapphire',
      status: TransactionStatus.COMPLETED,
      tags: ['groceries', 'weekly'],
      recurring: false,
    },
    {
      id: 'txn_demo_2',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 2),
      description: 'Monthly Salary',
      merchant: 'Employer Inc',
      category: TransactionCategory.SALARY,
      amount: 5000.00,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.NET_BANKING,
      account: 'Main Checking',
      status: TransactionStatus.COMPLETED,
      tags: ['salary', 'monthly'],
      recurring: true,
    },
    {
      id: 'txn_demo_3',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 3),
      description: 'Netflix Subscription',
      merchant: 'Netflix',
      category: TransactionCategory.ENTERTAINMENT,
      amount: 15.99,
      type: TransactionType.EXPENSE,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      account: 'Chase Sapphire',
      status: TransactionStatus.COMPLETED,
      tags: ['subscription', 'streaming'],
      recurring: true,
    },
    {
      id: 'txn_demo_4',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 5),
      description: 'Electric Bill',
      merchant: 'City Power Co',
      category: TransactionCategory.UTILITIES,
      amount: 89.00,
      type: TransactionType.EXPENSE,
      paymentMethod: PaymentMethod.NET_BANKING,
      account: 'Main Checking',
      status: TransactionStatus.COMPLETED,
      tags: ['utilities', 'monthly'],
      recurring: true,
    },
    {
      id: 'txn_demo_5',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7),
      description: 'Gas Station',
      merchant: 'Shell',
      category: TransactionCategory.FUEL,
      amount: 45.00,
      type: TransactionType.EXPENSE,
      paymentMethod: PaymentMethod.DEBIT_CARD,
      account: 'Main Checking',
      status: TransactionStatus.COMPLETED,
      tags: ['gas', 'car'],
      recurring: false,
    },
    {
      id: 'txn_demo_6',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 10),
      description: 'Restaurant Dinner',
      merchant: 'Italian Bistro',
      category: TransactionCategory.DINING,
      amount: 78.50,
      type: TransactionType.EXPENSE,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      account: 'Chase Sapphire',
      status: TransactionStatus.COMPLETED,
      tags: ['dining', 'date-night'],
      recurring: false,
    },
    {
      id: 'txn_demo_7',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14),
      description: 'Freelance Payment',
      merchant: 'Client Corp',
      category: TransactionCategory.FREELANCE,
      amount: 1200.00,
      type: TransactionType.INCOME,
      paymentMethod: PaymentMethod.NET_BANKING,
      account: 'Main Checking',
      status: TransactionStatus.COMPLETED,
      tags: ['freelance', 'income'],
      recurring: false,
    },
    {
      id: 'txn_demo_8',
      date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15),
      description: 'Gym Membership',
      merchant: 'Planet Fitness',
      category: TransactionCategory.FITNESS,
      amount: 25.00,
      type: TransactionType.EXPENSE,
      paymentMethod: PaymentMethod.CREDIT_CARD,
      account: 'Chase Sapphire',
      status: TransactionStatus.COMPLETED,
      tags: ['fitness', 'monthly'],
      recurring: true,
    },
  ];

  return demoData;
}

/**
 * Parse a raw transaction row from Google Sheets
 * Actual columns: txn_id, value_date, post_date, description, reference_no, debit, credit, balance, txn_type, account_source, imported_at, hash
 */
function parseTransaction(row: string[], index: number): Transaction | null {
  try {
    const [
      txn_id,
      value_date,
      post_date,
      description,
      reference_no,
      debit,
      credit,
      balance,
      txn_type,
      account_source,
      imported_at,
      hash,
    ] = row;

    if (!txn_id || !value_date) {
      return null; // Skip incomplete rows
    }

    // Parse date (DD/MM/YYYY format from Google Sheets)
    const dateParts = value_date.split('/');
    const parsedDate = dateParts.length === 3
      ? new Date(parseInt(dateParts[2]), parseInt(dateParts[1]) - 1, parseInt(dateParts[0]))
      : new Date(value_date);

    // Determine amount and type
    const debitAmount = debit ? parseFloat(debit.replace(/[^0-9.-]/g, '')) : 0;
    const creditAmount = credit ? parseFloat(credit.replace(/[^0-9.-]/g, '')) : 0;
    const amount = creditAmount || debitAmount;
    const isCredit = txn_type === 'credit' || creditAmount > 0;

    // Extract merchant from description based on transaction format
    let merchant = '';
    const desc = description || '';

    if (desc.includes('UPI/')) {
      // UPI format: UPI/DR/ref/MERCHANT/BANK/identifier/...
      const parts = desc.split('/');
      if (parts.length > 3) {
        merchant = parts[3]?.trim() || '';
      }
    } else if (desc.includes('IMPS/')) {
      // IMPS format: DEP TFR IMPS/ref/MERCHANT/identifier/...
      // Similar to UPI - merchant is at index 2 after splitting on '/'
      const parts = desc.split('/');
      if (parts.length > 2) {
        merchant = parts[2]?.trim() || '';
      }
    } else if (desc.includes('NEFT*') || desc.includes('NEFT/')) {
      // NEFT format: DEP TFR NEFT*UCBA0001961*UCBAH26012083914*NOTATMRP INNOVA
      // Extract after last '*'
      const sep = desc.includes('NEFT*') ? '*' : '/';
      const parts = desc.split(sep);
      if (parts.length > 1) {
        merchant = parts[parts.length - 1]?.trim() || '';
      }
    } else if (desc.includes('INB')) {
      // Net Banking format: WDL TFR INB THAPAR INSTITUTE OF ENGIN
      // Extract text after "INB "
      const inbIndex = desc.indexOf('INB ');
      if (inbIndex !== -1) {
        merchant = desc.substring(inbIndex + 4).trim();
      }
    }

    // Detect payment method from description
    let paymentMethod: PaymentMethod;
    if (desc.includes('UPI/')) {
      paymentMethod = PaymentMethod.UPI;
    } else if (desc.includes('NEFT*') || desc.includes('NEFT/')) {
      paymentMethod = PaymentMethod.NEFT;
    } else if (desc.includes('IMPS/')) {
      paymentMethod = PaymentMethod.IMPS;
    } else if (desc.includes('INB') || desc.includes('INB/')) {
      paymentMethod = PaymentMethod.NET_BANKING;
    } else {
      paymentMethod = PaymentMethod.OTHER;
    }

    // Categorize transaction using merchant and description
    const category = categorizeTransaction(merchant || '', desc);

    // Parse balance amount
    const balanceAmount = balance ? parseFloat(balance.replace(/[^0-9.-]/g, '')) : undefined;
    const normalizedBalance = Number.isFinite(balanceAmount) ? balanceAmount : undefined;

    return {
      id: txn_id,
      date: parsedDate,
      description: desc,
      merchant: merchant,
      category: category,
      amount: amount,
      type: isCredit ? TransactionType.INCOME : TransactionType.EXPENSE,
      paymentMethod: paymentMethod,
      account: account_source || 'Unknown',
      status: TransactionStatus.COMPLETED,
      tags: [],
      recurring: false,
      balance: normalizedBalance,
    };
  } catch (error) {
    console.error('Error parsing transaction row:', error);
    return null;
  }
}

/**
 * Parse CSV text into rows
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Fetch from public Google Sheet via CSV export (no auth needed)
 */
async function fetchFromPublicSheet(): Promise<string[][] | null> {
  const csvUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(SHEET_NAME)}`;

  try {
    const response = await fetch(csvUrl);

    if (!response.ok) {
      console.log('Public sheet fetch failed:', response.status);
      return null;
    }

    const csvText = await response.text();

    // Check if we got an HTML error page instead of CSV
    if (csvText.includes('<!DOCTYPE') || csvText.includes('<html')) {
      console.log('Sheet is not publicly accessible');
      return null;
    }

    const rows = parseCSV(csvText);
    // Skip header row
    return rows.slice(1);
  } catch (error) {
    console.log('Error fetching public sheet:', error);
    return null;
  }
}

/**
 * Fetch transactions from Google Sheets
 */
export async function fetchTransactionsFromSheet(): Promise<{
  transactions: Transaction[];
  lastSync: string;
  isDemo?: boolean;
}> {
  // First, try to fetch from public sheet URL (works if sheet is "Anyone with link can view")
  console.log('Attempting to fetch from public Google Sheet...');
  const publicRows = await fetchFromPublicSheet();

  if (publicRows && publicRows.length > 0) {
    console.log(`Successfully fetched ${publicRows.length} rows from public sheet`);
    const transactions: Transaction[] = [];

    publicRows.forEach((row, index) => {
      const transaction = parseTransaction(row, index);
      if (transaction) {
        transactions.push(transaction);
      }
    });

    cachedTransactions = transactions;
    lastSyncTime = new Date().toISOString();

    return {
      transactions,
      lastSync: lastSyncTime,
    };
  }

  // If public fetch failed and auth is configured, try authenticated API
  if (isAuthConfigured()) {
    try {
      console.log('Using authenticated Google Sheets API...');
      const auth = getGoogleAuth();
      const sheets = google.sheets({ version: 'v4', auth });

      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: SHEET_ID,
        range: `${SHEET_NAME}!A2:O`, // Start from row 2 to skip headers, columns A to O
      });

      const rows = response.data.values || [];
      const transactions: Transaction[] = [];

      rows.forEach((row, index) => {
        const transaction = parseTransaction(row, index);
        if (transaction) {
          transactions.push(transaction);
        }
      });

      cachedTransactions = transactions;
      lastSyncTime = new Date().toISOString();

      return {
        transactions,
        lastSync: lastSyncTime,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error fetching from Google Sheets API:', message);
    }
  }

  // Fall back to demo data
  console.log('Using demo data (sheet not accessible or auth not configured)');
  const demoTransactions = generateDemoTransactions();
  cachedTransactions = demoTransactions;
  lastSyncTime = new Date().toISOString();

  return {
    transactions: demoTransactions,
    lastSync: lastSyncTime,
    isDemo: true,
  };
}

/**
 * Get cached transactions (for faster access)
 */
export function getCachedTransactions(): {
  transactions: Transaction[] | null;
  lastSync: string | null;
} {
  return {
    transactions: cachedTransactions,
    lastSync: lastSyncTime,
  };
}

/**
 * Clear the transaction cache
 */
export function clearCache(): void {
  cachedTransactions = null;
  lastSyncTime = null;
}

/**
 * Filter transactions based on query parameters
 */
export function filterTransactions(
  transactions: Transaction[],
  query: {
    category?: string;
    paymentMethod?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
  }
): Transaction[] {
  let filtered = [...transactions];

  if (query.category) {
    filtered = filtered.filter(t => t.category === query.category);
  }

  if (query.paymentMethod) {
    filtered = filtered.filter(t => t.paymentMethod === query.paymentMethod);
  }

  if (query.startDate) {
    const startDate = new Date(query.startDate);
    filtered = filtered.filter(t => new Date(t.date) >= startDate);
  }

  if (query.endDate) {
    const endDate = new Date(query.endDate);
    filtered = filtered.filter(t => new Date(t.date) <= endDate);
  }

  if (query.minAmount !== undefined) {
    filtered = filtered.filter(t => t.amount >= query.minAmount!);
  }

  if (query.maxAmount !== undefined) {
    filtered = filtered.filter(t => t.amount <= query.maxAmount!);
  }

  return filtered;
}
