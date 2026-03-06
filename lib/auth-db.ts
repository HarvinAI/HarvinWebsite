import { MongoClient, Db } from 'mongodb';

const MONGO_URI = process.env.MONGO_URI || '';
const DB_NAME = 'harvinai';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function getAuthDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  if (!MONGO_URI) throw new Error('MONGO_URI not configured');

  cachedClient = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  await cachedClient.connect();
  cachedDb = cachedClient.db(DB_NAME);
  return cachedDb;
}

export interface UserDoc {
  _id?: string;
  name: string;
  email: string;
  passwordHash?: string;
  provider: 'credentials' | 'google';
  createdAt: Date;
}
