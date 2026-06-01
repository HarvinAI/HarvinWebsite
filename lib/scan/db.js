const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME   = 'harvinai';

let client = null;
let db     = null;
let mongoAvailable = null;

class InMemoryCollection {
  constructor() { this.docs = []; this._idCounter = 1; }

  find(query) {
    let results = this.docs.filter(doc => this._matchQuery(doc, query));
    const chain = {
      _results: results,
      sort(s) {
        const key = Object.keys(s)[0];
        const dir = s[key];
        this._results = [...this._results].sort((a, b) => {
          if (a[key] < b[key]) return -1 * dir;
          if (a[key] > b[key]) return 1 * dir;
          return 0;
        });
        return this;
      },
      skip(n) { this._results = this._results.slice(n); return this; },
      limit(n) { this._results = this._results.slice(0, n); return this; },
      project(p) {
        const keys = Object.keys(p).filter(k => p[k]);
        if (keys.length) {
          this._results = this._results.map(doc => {
            const out = {};
            for (const k of keys) { if (doc[k] !== undefined) out[k] = doc[k]; }
            return out;
          });
        }
        return this;
      },
      async toArray() { return this._results; },
    };
    return chain;
  }

  _matchQuery(doc, query) {
    for (const [k, v] of Object.entries(query)) {
      if (k === '$or') {
        if (!v.some(sub => this._matchQuery(doc, sub))) return false;
        continue;
      }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        // Handle operators like $in, $exists, $nin, $regex
        if ('$in' in v && !v.$in.includes(doc[k])) return false;
        if ('$nin' in v && v.$nin.includes(doc[k])) return false;
        if ('$exists' in v && v.$exists && doc[k] === undefined) return false;
        if ('$exists' in v && !v.$exists && doc[k] !== undefined) return false;
        if ('$regex' in v) {
          const re = new RegExp(v.$regex, v.$options || '');
          if (!re.test(doc[k] || '')) return false;
        }
        continue;
      }
      if (doc[k] !== v) return false;
    }
    return true;
  }

  async findOne(query) {
    return this.docs.find(doc => this._matchQuery(doc, query)) || null;
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

  async countDocuments(query = {}) {
    return this.docs.filter(doc => this._matchQuery(doc, query)).length;
  }

  async distinct(field, query = {}) {
    const matched = this.docs.filter(doc => this._matchQuery(doc, query));
    return [...new Set(matched.map(d => d[field]).filter(v => v !== undefined))];
  }

  async deleteOne(query) {
    const idx = this.docs.findIndex(d => this._matchQuery(d, query));
    if (idx >= 0) { this.docs.splice(idx, 1); return { deletedCount: 1 }; }
    return { deletedCount: 0 };
  }

  async createIndex() { return; }
}

class InMemoryDb {
  constructor() { this.collections = {}; }
  collection(name) {
    if (!this.collections[name]) this.collections[name] = new InMemoryCollection();
    return this.collections[name];
  }
}

const inMemoryDb = new InMemoryDb();

let lastRetry = 0;

async function getDb() {
  // If we have an active connection, verify it's still alive
  if (db && client) {
    try {
      // Quick ping to verify connection is still alive
      if (client.topology && client.topology.isConnected()) return db;
      // Topology lost — reset and reconnect
      db = null;
      client = null;
      mongoAvailable = null;
    } catch {
      db = null;
      client = null;
      mongoAvailable = null;
    }
  }

  if (!MONGO_URI) {
    if (mongoAvailable === null) console.log('[db] No MONGO_URI configured — using in-memory storage');
    mongoAvailable = false;
    return inMemoryDb;
  }

  // If previously failed, retry every 10s instead of giving up forever
  if (mongoAvailable === false) {
    if (Date.now() - lastRetry < 10000) return inMemoryDb;
  }

  lastRetry = Date.now();
  try {
    client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    db = client.db(DB_NAME);
    mongoAvailable = true;
    console.log(`[mongo] connected to ${DB_NAME}`);

    // Ensure indexes (fire-and-forget)
    db.collection('scan_logs').createIndex({ ts: 1 }, { expireAfterSeconds: 90 * 24 * 3600 }).catch(() => {});
    db.collection('scan_logs').createIndex({ domain: 1, ts: -1 }).catch(() => {});
    db.collection('scan_logs').createIndex({ source: 1, ts: -1 }).catch(() => {});
    // Watchlist + company_meta indexes for fast lookups
    db.collection('watchlists').createIndex({ userId: 1 }).catch(() => {});
    db.collection('company_meta').createIndex({ normalizedDomain: 1 }, { unique: true }).catch(() => {});

    // Monitor for disconnects so we can auto-reconnect
    client.on('close', () => {
      console.warn('[mongo] connection closed — will reconnect on next request');
      db = null;
      mongoAvailable = null;
    });

    return db;
  } catch (err) {
    mongoAvailable = false;
    console.warn(`[mongo] connection failed: ${err.message} — using in-memory storage`);
    return inMemoryDb;
  }
}

module.exports = { getDb };
