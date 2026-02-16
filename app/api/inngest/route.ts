import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest';
import { syncTransactions } from '@/inngest/sync';
import { refreshPrices } from '@/inngest/prices';
import { weeklyAnalysis } from '@/inngest/analyze';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [syncTransactions, refreshPrices, weeklyAnalysis],
});
