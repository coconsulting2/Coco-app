/**
 * @module MongoFxRateCache
 * @description Adapter del puerto `FxRateCache` usando MongoDB
 * (`cocoadb.exchange_rates`). Una entrada por (source, target, date).
 */
import { MongoClient, type Db } from "mongodb";
import type { ExchangeRate } from "~/contexts/fx/domain/entities/ExchangeRate.js";
import type { FxRateCache } from "~/contexts/fx/domain/ports/FxProvider.js";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type ExchangeRateDoc = {
  source: string;
  target: string;
  date: string;
  rate: number;
  dataSource: string;
  updatedAt: Date;
};

export class MongoFxRateCache implements FxRateCache {
  private readonly client: MongoClient;
  private db: Db | null = null;

  constructor() {
    const uri = process.env.MONGO_URI ?? "mongodb://localhost:27017/test";
    this.client = new MongoClient(uri);
  }

  private async connect(): Promise<Db> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db("cocoadb");
    }
    return this.db;
  }

  async get(
    source: string,
    target: string,
    date: string | null = null,
  ): Promise<ExchangeRate | null> {
    try {
      const db = await this.connect();
      const doc = await db.collection<ExchangeRateDoc>("exchange_rates").findOne({
        source: source.toUpperCase(),
        target: target.toUpperCase(),
        date: date ?? todayIso(),
      });
      if (!doc) return null;
      return {
        source: doc.source,
        target: doc.target,
        rate: doc.rate,
        date: doc.date,
        dataSource: "cache",
        fromCache: true,
      };
    } catch (err) {
      console.error("[MongoFxRateCache.get]", (err as Error).message);
      return null;
    }
  }

  async set(rate: ExchangeRate): Promise<void> {
    try {
      const db = await this.connect();
      await db.collection<ExchangeRateDoc>("exchange_rates").updateOne(
        {
          source: rate.source.toUpperCase(),
          target: rate.target.toUpperCase(),
          date: rate.date,
        },
        {
          $set: {
            source: rate.source.toUpperCase(),
            target: rate.target.toUpperCase(),
            date: rate.date,
            rate: rate.rate,
            dataSource: rate.dataSource,
            updatedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      console.error("[MongoFxRateCache.set]", (err as Error).message);
    }
  }
}
