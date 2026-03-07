const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = 'harvinai';

let client = null;
let db     = null;
let mongoAvailable = null;

class InMemoryCollection {
  constructor() { this.docs = []; this._idCounter = 1; }

  async find(query) {
    const results = this.docs.filter(doc => {
      for (const [k, v] of Object.entries(query)) {
        if (doc[k] !== v) return false;
      }
      return true;
    });
    return { toArray: async () => results };
  }

  async findOne(query) {
    return this.docs.find(doc => {
      for (const [k, v] of Object.entries(query)) {
        if (k === '_id') {
          if (doc._id !== v.toString()) return false;
        } else if (doc[k] !== v) return false;
      }
      return true;
    }) || null;
  }

  async insertOne(doc) {
    const _id = String(this._idCounter++);
    const newDoc = { _id, ...doc };
    this.docs.push(newDoc);
    return { insertedId: _id };
  }

  async updateOne(query, update, options = {}) {
    let doc = this.docs.find(d => {
      for (const [k, v] of Object.entries(query)) {
        if (k === '_id') {
          if (d._id !== v.toString()) return false;
        } else if (d[k] !== v) return false;
      }
      return true;
    });

    if (!doc && options.upsert) {
      doc = { _id: String(this._idCounter++), ...query };
      this.docs.push(doc);
    }
    if (!doc) return { modifiedCount: 0 };

    if (update.$set) {
      for (const [k, v] of Object.entries(update.$set)) {
        if (k.includes('.')) {
          const parts = k.split('.');
          let target = doc;
          for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]] || typeof target[parts[i]] !== 'object') target[parts[i]] = {};
            target = target[parts[i]];
          }
          target[parts[parts.length - 1]] = v;
        } else {
          doc[k] = v;
        }
      }
    }
    if (update.$setOnInsert && options.upsert) Object.assign(doc, update.$setOnInsert);
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!doc[k]) doc[k] = [];
        if (v.$each) doc[k].push(...v.$each);
        else doc[k].push(v);
      }
    }
    return { modifiedCount: 1 };
  }
}

class InMemoryDb {
  constructor() { this.collections = {}; }
  collection(name) {
    if (!this.collections[name]) this.collections[name] = new InMemoryCollection();
    return this.collections[name];
  }
}

const inMemoryDb = new InMemoryDb();

async function getDb() {
  if (db) return db;
  if (mongoAvailable === false) return inMemoryDb;

  if (!MONGO_URI) {
    mongoAvailable = false;
    console.log('[db] No MONGO_URI configured — using in-memory storage');
    return inMemoryDb;
  }

  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    db = client.db(DB_NAME);
    mongoAvailable = true;
    console.log(`[mongo] connected to ${DB_NAME}`);
    return db;
  } catch (err) {
    mongoAvailable = false;
    console.warn(`[mongo] connection failed: ${err.message} — using in-memory storage`);
    return inMemoryDb;
  }
}

module.exports = { getDb };
