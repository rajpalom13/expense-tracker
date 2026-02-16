import { inngest } from '@/lib/inngest';
import { getMongoDb } from '@/lib/mongodb';
import { fetchTransactionsFromSheet, clearCache } from '@/lib/sheets';
import type { Transaction } from '@/lib/types';

const CRON_COLLECTION = 'cron_runs';

async function persistTransactions(userId: string, transactions: Transaction[]) {
  if (!transactions.length) return 0;

  const db = await getMongoDb();
  const col = db.collection('transactions');

  const rules = await db
    .collection('categorization_rules')
    .find({ userId, enabled: true })
    .toArray();

  const overrideDocs = await col
    .find({ userId, categoryOverride: true }, { projection: { txnId: 1 } })
    .toArray();
  const overrides = new Set(overrideDocs.map((d) => d.txnId as string));

  const ops = transactions.map((txn) => {
    let category = txn.category;

    if (!overrides.has(txn.id)) {
      for (const rule of rules) {
        const pattern = rule.pattern as string;
        const matchField = rule.matchField as string;
        const caseSensitive = rule.caseSensitive === true;

        let text = '';
        if (matchField === 'merchant') text = txn.merchant || '';
        else if (matchField === 'description') text = txn.description || '';
        else text = `${txn.merchant || ''} ${txn.description || ''}`;

        const haystack = caseSensitive ? text : text.toLowerCase();
        const needle = caseSensitive ? pattern : pattern.toLowerCase();

        if (haystack.includes(needle)) {
          category = rule.category as typeof category;
          break;
        }
      }
    }

    const dateStr = txn.date instanceof Date ? txn.date.toISOString() : String(txn.date);

    if (overrides.has(txn.id)) {
      return {
        updateOne: {
          filter: { userId, txnId: txn.id },
          update: {
            $set: {
              date: dateStr,
              description: txn.description,
              merchant: txn.merchant,
              amount: txn.amount,
              type: txn.type,
              paymentMethod: txn.paymentMethod,
              account: txn.account,
              status: txn.status,
              balance: txn.balance,
              updatedAt: new Date().toISOString(),
            },
          },
          upsert: false,
        },
      };
    }

    return {
      updateOne: {
        filter: { userId, txnId: txn.id },
        update: {
          $set: {
            userId,
            txnId: txn.id,
            date: dateStr,
            description: txn.description,
            merchant: txn.merchant,
            category,
            amount: txn.amount,
            type: txn.type,
            paymentMethod: txn.paymentMethod,
            account: txn.account,
            status: txn.status,
            balance: txn.balance,
            updatedAt: new Date().toISOString(),
          },
          $setOnInsert: { createdAt: new Date().toISOString() },
        },
        upsert: true,
      },
    };
  });

  const result = await col.bulkWrite(ops, { ordered: false });
  return result.upsertedCount + result.modifiedCount;
}

export const syncTransactions = inngest.createFunction(
  { id: 'sync-transactions', name: 'Sync Google Sheets Transactions' },
  { cron: '0 6 * * *' }, // Daily at 6:00 AM UTC
  async ({ step }) => {
    const startedAt = new Date();

    const result = await step.run('sync-sheets-to-mongo', async () => {
      const db = await getMongoDb();
      clearCache();

      const { transactions, isDemo } = await fetchTransactionsFromSheet();

      if (isDemo) {
        await db.collection(CRON_COLLECTION).insertOne({
          job: 'sync',
          status: 'skipped',
          reason: 'Demo mode - no sheet configured',
          startedAt: startedAt.toISOString(),
          finishedAt: new Date().toISOString(),
        });
        return { skipped: true, count: 0 };
      }

      const users = await db.collection('users').find({}).project({ _id: 1 }).toArray();
      const userIds = users.map((u) => u._id.toString());
      if (userIds.length === 0) userIds.push('default');

      let totalPersisted = 0;
      for (const userId of userIds) {
        const persisted = await persistTransactions(userId, transactions);
        totalPersisted += persisted;
      }

      const finishedAt = new Date();
      await db.collection(CRON_COLLECTION).insertOne({
        job: 'sync',
        status: 'success',
        results: {
          transactionCount: transactions.length,
          persisted: totalPersisted,
          userCount: userIds.length,
        },
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });

      return { skipped: false, count: transactions.length, persisted: totalPersisted };
    });

    return result;
  }
);
