const initSQL = `
  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    class TEXT DEFAULT 'warrior',
    title TEXT DEFAULT '',
    x INTEGER DEFAULT 50,
    y INTEGER DEFAULT 50,
    level INTEGER DEFAULT 1,
    exp INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 100,
    max_hp INTEGER DEFAULT 100,
    mp INTEGER DEFAULT 50,
    max_mp INTEGER DEFAULT 50,
    attack INTEGER DEFAULT 10,
    defense INTEGER DEFAULT 5,
    gold INTEGER DEFAULT 0,
    map_id TEXT DEFAULT 'world',
    skills TEXT DEFAULT '[]',
    equipment TEXT DEFAULT '{}',
    inventory TEXT DEFAULT '[]',
    quest_state TEXT DEFAULT '{}',
    storage TEXT DEFAULT '[]',
    last_save DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name TEXT,
    class TEXT,
    level_req INTEGER,
    mp_cost INTEGER,
    damage_mult REAL DEFAULT 1.0,
    description TEXT
  );
  CREATE TABLE IF NOT EXISTS equipment_templates (
    id TEXT PRIMARY KEY,
    name TEXT,
    slot TEXT,
    quality TEXT,
    level_req INTEGER,
    attack INTEGER DEFAULT 0,
    defense INTEGER DEFAULT 0,
    hp INTEGER DEFAULT 0,
    mp INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS player_inventory (
    player_id TEXT,
    item_id TEXT,
    quantity INTEGER DEFAULT 1,
    FOREIGN KEY (player_id) REFERENCES players(id)
  );
`;

async function initDB() {
  const initSqlJs = require('sql.js');
  const fs = require('fs');
  const path = require('path');

  const dbPath = path.join(__dirname, '..', 'data', 'game.db');
  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  let db;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    const SQL = await initSqlJs();
    db = new SQL.Database(buffer);
    // 迁移：添加 storage 列（如果不存在）
    try { db.run('ALTER TABLE players ADD COLUMN storage TEXT DEFAULT "[]"'); } catch(e) { /* 列已存在 */ }
    try { db.run('ALTER TABLE players ADD COLUMN cultivation_realm INTEGER DEFAULT 0'); } catch(e) { /* 列已存在 */ }
    try { db.run('ALTER TABLE players ADD COLUMN cultivation_stage INTEGER DEFAULT 1'); } catch(e) { /* 列已存在 */ }
  } else {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run(initSQL);
  }

  db._path = dbPath;
  if (!fs.existsSync(dbPath)) {
    saveDB(db);
  }
  return db;
}

function saveDB(db) {
  const fs = require('fs');
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(db._path, buffer);
}

function getDB(db) {
  return db;
}

module.exports = { initDB, saveDB, getDB };
