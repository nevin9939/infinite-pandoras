const initSQL = `
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    name TEXT NOT NULL,
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
    last_save DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );
  -- 兼容旧 players 表（迁移用）
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
    // 新登录系统迁移 - 创建 accounts 和 characters 表
    try {
      db.run(`CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
    } catch(e) { /* 表已存在 */ }
    try {
      db.run(`CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        name TEXT NOT NULL,
        class TEXT DEFAULT 'warrior',
        title TEXT DEFAULT '',
        x INTEGER DEFAULT 50, y INTEGER DEFAULT 50,
        level INTEGER DEFAULT 1, exp INTEGER DEFAULT 0,
        hp INTEGER DEFAULT 100, max_hp INTEGER DEFAULT 100,
        mp INTEGER DEFAULT 50, max_mp INTEGER DEFAULT 50,
        attack INTEGER DEFAULT 10, defense INTEGER DEFAULT 5,
        gold INTEGER DEFAULT 0, map_id TEXT DEFAULT 'world',
        skills TEXT DEFAULT '[]', equipment TEXT DEFAULT '{}',
        inventory TEXT DEFAULT '[]', quest_state TEXT DEFAULT '{}',
        storage TEXT DEFAULT '[]',
        last_save DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (account_id) REFERENCES accounts(id)
      )`);
    } catch(e) { /* 表已存在 */ }
    try { db.run('ALTER TABLE characters ADD COLUMN storage TEXT DEFAULT "[]"'); } catch(e) { /* 列已存在 */ }
    try { db.run('ALTER TABLE characters ADD COLUMN cultivation_realm INTEGER DEFAULT 0'); } catch(e) { /* 列已存在 */ }
    try { db.run('ALTER TABLE characters ADD COLUMN cultivation_stage INTEGER DEFAULT 1'); } catch(e) { /* 列已存在 */ }
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

// 账号管理
function createAccount(db, username, passwordHash) {
  const id = 'acc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  db.run(`INSERT INTO accounts (id, username, password) VALUES (?, ?, ?)`, [id, username, passwordHash]);
  saveDB(db);
  return { id, username };
}

function getAccount(db, username) {
  const r = db.exec(`SELECT * FROM accounts WHERE username = ?`, [username]);
  if (!r.length || !r[0].values.length) return null;
  const row = r[0].values[0];
  const cols = r[0].columns;
  const acc = {};
  cols.forEach((c, i) => acc[c] = row[i]);
  return acc;
}

// 角色管理
function getCharacters(db, accountId) {
  const r = db.exec(`SELECT id, name, class, level, exp, gold, title, equipment, inventory FROM characters WHERE account_id = ? ORDER BY level DESC`, [accountId]);
  if (!r.length || !r[0].values.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(row => {
    const ch = {};
    cols.forEach((c, i) => ch[c] = row[i]);
    // 解析 JSON 字段
    try { ch.equipment = JSON.parse(ch.equipment); } catch(e) { ch.equipment = {}; }
    try { ch.inventory = JSON.parse(ch.inventory); } catch(e) { ch.inventory = []; }
    return ch;
  });
}

function createCharacter(db, accountId, name, playerClass) {
  const id = 'chr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  const classData = {
    warrior: { max_hp: 150, max_mp: 30, attack: 15, defense: 15 },
    mage: { max_hp: 100, max_mp: 100, attack: 20, defense: 8 },
    taoist: { max_hp: 120, max_mp: 60, attack: 12, defense: 12 },
  }[playerClass] || { max_hp: 120, max_mp: 50, attack: 15, defense: 10 };

  db.run(`INSERT INTO characters (id, account_id, name, class, hp, max_hp, mp, max_mp, attack, defense)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, accountId, name, playerClass, classData.max_hp, classData.max_hp, classData.max_mp, classData.max_mp, classData.attack, classData.defense]);
  saveDB(db);

  return getCharacter(db, id);
}

function getCharacter(db, characterId) {
  const r = db.exec(`SELECT * FROM characters WHERE id = ?`, [characterId]);
  if (!r.length || !r[0].values.length) return null;
  const row = r[0].values[0];
  const cols = r[0].columns;
  const ch = {};
  cols.forEach((c, i) => ch[c] = row[i]);
  // 兼容: name → username
  ch.username = ch.name;
  // 解析 JSON 字段
  try { ch.skills = JSON.parse(ch.skills); } catch(e) { ch.skills = []; }
  try { ch.equipment = JSON.parse(ch.equipment); } catch(e) { ch.equipment = {}; }
  try { ch.inventory = JSON.parse(ch.inventory); } catch(e) { ch.inventory = []; }
  try { ch.quest_state = JSON.parse(ch.quest_state); } catch(e) { ch.quest_state = {}; }
  try { ch.storage = JSON.parse(ch.storage); } catch(e) { ch.storage = []; }
  return ch;
}

function saveCharacter(db, character) {
  const skillsJson = JSON.stringify(character.skills || []);
  const equipJson = JSON.stringify(character.equipment || {});
  const invJson = JSON.stringify(character.inventory || []);
  const questJson = JSON.stringify(character.quest_state || {});
  const storageJson = JSON.stringify(character.storage || []);
  db.run(`UPDATE characters SET
    x=?, y=?, level=?, exp=?, hp=?, max_hp=?, mp=?, max_mp=?,
    attack=?, defense=?, gold=?, map_id=?, title=?,
    skills=?, equipment=?, inventory=?, quest_state=?, storage=?,
    last_save=CURRENT_TIMESTAMP
    WHERE id=?`,
    [character.x, character.y, character.level, character.exp,
     character.hp, character.max_hp, character.mp, character.max_mp,
     character.attack, character.defense, character.gold, character.map_id, character.title,
     skillsJson, equipJson, invJson, questJson, storageJson, character.id]);
  saveDB(db);
}

function deleteCharacter(db, characterId) {
  db.run(`DELETE FROM characters WHERE id = ?`, [characterId]);
  saveDB(db);
}

module.exports = { initDB, saveDB, getDB, createAccount, getAccount, getCharacters, createCharacter, getCharacter, saveCharacter, deleteCharacter };
