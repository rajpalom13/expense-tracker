import { inngest } from '@/lib/inngest';
import { getMongoDb } from '@/lib/mongodb';
import { fetchLatestNAV } from '@/lib/mfapi';

const CRON_COLLECTION = 'cron_runs';

async function fetchStockPrice(
  symbol: string,
  exchange: string
): Promise<{ current: number; change: number; changePercent: number } | null> {
  try {
    const ex = exchange?.toUpperCase() || 'NSE';
    let yahooSymbol = symbol;
    if (ex === 'NSE') yahooSymbol = `${symbol}.NS`;
    else if (ex === 'BSE') yahooSymbol = `${symbol}.BO`;

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const current = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose || meta.previousClose || 0;
    const change = prevClose > 0 ? current - prevClose : 0;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      current: Math.round(current * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round(changePercent * 100) / 100,
    };
  } catch {
    return null;
  }
}

export const refreshPrices = inngest.createFunction(
  { id: 'refresh-prices', name: 'Refresh Stock & MF Prices' },
  { cron: '0 10 * * 1-5' }, // Weekdays at 10:00 AM UTC
  async ({ step }) => {
    const startedAt = new Date();
    const results = { stocksUpdated: 0, stocksFailed: 0, fundsUpdated: 0, fundsFailed: 0 };

    await step.run('update-stock-prices', async () => {
      const db = await getMongoDb();
      const allStocks = await db.collection('stocks').find({}).toArray();

      const symbolSet = new Map<string, string>();
      for (const s of allStocks) {
        if (s.symbol) symbolSet.set(s.symbol as string, (s.exchange as string) || 'NSE');
      }

      const stockQuotes = new Map<string, { current: number; change: number; changePercent: number }>();
      const quotePromises = Array.from(symbolSet.entries()).map(async ([symbol, exchange]) => {
        const quote = await fetchStockPrice(symbol, exchange);
        if (quote) stockQuotes.set(symbol, quote);
      });
      await Promise.all(quotePromises);

      for (const stock of allStocks) {
        const sym = stock.symbol as string;
        const quote = stockQuotes.get(sym);
        if (!quote) {
          results.stocksFailed++;
          continue;
        }
        const quantity = (stock.shares as number) || 0;
        const avgPrice = (stock.averageCost as number) || 0;
        const totalInvested = quantity * avgPrice;
        const currentValue = quantity * quote.current;

        await db.collection('stocks').updateOne(
          { _id: stock._id },
          {
            $set: {
              currentPrice: quote.current,
              dayChange: quote.change,
              dayChangePercentage: quote.changePercent,
              currentValue,
              totalReturns: currentValue - totalInvested,
              returnsPercentage: totalInvested > 0 ? ((currentValue - totalInvested) / totalInvested) * 100 : 0,
              updatedAt: new Date().toISOString(),
            },
          }
        );
        results.stocksUpdated++;
      }
    });

    await step.run('update-mf-navs', async () => {
      const db = await getMongoDb();
      const allFunds = await db.collection('mutual_funds').find({}).toArray();

      const schemeSet = new Set<number>();
      for (const f of allFunds) {
        if (typeof f.schemeCode === 'number') schemeSet.add(f.schemeCode);
      }

      const navMap = new Map<number, number>();
      const navPromises = Array.from(schemeSet).map(async (code) => {
        const result = await fetchLatestNAV(code);
        if (result) navMap.set(code, result.latestNAV);
      });
      await Promise.all(navPromises);

      for (const fund of allFunds) {
        const code = fund.schemeCode as number;
        const nav = navMap.get(code);
        if (!nav) {
          results.fundsFailed++;
          continue;
        }
        const units = (fund.units as number) || 0;
        const investedValue = (fund.investedValue as number) || 0;
        const currentValue = Math.round(nav * units * 100) / 100;

        await db.collection('mutual_funds').updateOne(
          { _id: fund._id },
          {
            $set: {
              currentNAV: nav,
              currentValue,
              returns: currentValue - investedValue,
              updatedAt: new Date().toISOString(),
            },
          }
        );
        results.fundsUpdated++;
      }
    });

    await step.run('log-cron-run', async () => {
      const db = await getMongoDb();
      const finishedAt = new Date();
      await db.collection(CRON_COLLECTION).insertOne({
        job: 'prices',
        status: 'success',
        results,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
      });
    });

    return results;
  }
);
