const { saveDB } = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// ===== 副本定义 =====
const DUNGEONS = {
  cave: {
    id: 'cave', name: '矿洞', levelReq: 5,
    boss: { name: '矿洞僵尸王', level: 10, hp: 1500, attack: 30, defense: 15, exp: 500 },
    monsters: [
      { name: '小僵尸', level: 5, hp: 200, attack: 12, defense: 5, exp: 40, count: 5 },
      { name: '骷髅矿工', level: 7, hp: 350, attack: 18, defense: 8, exp: 60, count: 3 },
    ],
    rewards: [{ id: 'iron_sword', chance: 0.3 }, { id: 'iron_armor', chance: 0.2 }],
  },
  woma: {
    id: 'woma', name: '沃玛寺庙', levelReq: 15,
    boss: { name: '沃玛教主', level: 20, hp: 5000, attack: 80, defense: 35, exp: 2000 },
    monsters: [
      { name: '沃玛信徒', level: 15, hp: 500, attack: 25, defense: 12, exp: 100, count: 5 },
      { name: '沃玛卫士', level: 18, hp: 800, attack: 40, defense: 20, exp: 150, count: 3 },
    ],
    rewards: [{ id: 'fire_sword_e', chance: 0.3 }, { id: 'dragon_armor', chance: 0.2 }, { id: 'soul_neck', chance: 0.3 }],
  },
  zumma: {
    id: 'zumma', name: '祖玛寺庙', levelReq: 25,
    boss: { name: '祖玛教主', level: 30, hp: 10000, attack: 130, defense: 55, exp: 5000 },
    monsters: [
      { name: '祖玛雕像', level: 22, hp: 800, attack: 45, defense: 25, exp: 200, count: 5 },
      { name: '祖玛卫士', level: 25, hp: 1200, attack: 65, defense: 35, exp: 300, count: 3 },
    ],
    rewards: [{ id: 'dragon_blade', chance: 0.2 }, { id: 'holy_armor', chance: 0.2 }, { id: 'legend_ring', chance: 0.1 }],
  },
};

// ===== PK 区域 =====
const PK_ZONES = {
  safe: { x1: 40, y1: 40, x2: 60, y2: 60, name: '比奇城安全区', pkAllowed: false },
  wild: { x1: 0, y1: 0, x2: 100, y2: 80, name: '野外', pkAllowed: true },
};

function isInSafeZone(x, y) {
  return x >= PK_ZONES.safe.x1 && x <= PK_ZONES.safe.x2 && y >= PK_ZONES.safe.y1 && y <= PK_ZONES.safe.y2;
}

// ===== 装备定义 =====
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'helmet', 'necklace', 'bracelet1', 'bracelet2', 'ring1', 'ring2', 'belt', 'shoes',
  'zodiac_鼠','zodiac_牛','zodiac_虎','zodiac_兔','zodiac_龙','zodiac_蛇','zodiac_马','zodiac_羊','zodiac_猴','zodiac_鸡','zodiac_狗','zodiac_猪',
  'wuxing_金锐_神锋','wuxing_金锐_神铠','wuxing_金锐_神链','wuxing_金锐_神戒',
  'wuxing_木灵_神锋','wuxing_木灵_神铠','wuxing_木灵_神链','wuxing_木灵_神戒',
  'wuxing_水渊_神锋','wuxing_水渊_神铠','wuxing_水渊_神链','wuxing_水渊_神戒',
  'wuxing_火狱_神锋','wuxing_火狱_神铠','wuxing_火狱_神链','wuxing_火狱_神戒',
  'wuxing_土岳_神锋','wuxing_土岳_神铠','wuxing_土岳_神链','wuxing_土岳_神戒'];
const QUALITY_NAMES = { common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说', mythic: '神话', divine: '仙器' };
const QUALITY_COLORS = { common: '#aaaaaa', uncommon: '#44cc44', rare: '#4488ff', epic: '#cc44ff', legendary: '#ff8800', mythic: '#ff44ff', divine: '#ff2222' };
const QUALITY_MULT = { common: 1.0, uncommon: 1.3, rare: 1.6, epic: 2.0, legendary: 2.5, mythic: 3.0, divine: 3.5 };

// ===== 强化系统 =====
const ENHANCE_RATES = { 0:1.0, 1:1.0, 2:1.0, 3:1.0, 4:0.8, 5:0.8, 6:0.8, 7:0.6, 8:0.6, 9:0.6, 10:0.4, 11:0.4, 12:0.4 };
const ENHANCE_COST = (level) => Math.floor(100 * Math.pow(2, level));
const ENHANCE_BONUS_PCT = (level) => level <= 3 ? 0.15 : level <= 6 ? 0.20 : level <= 9 ? 0.25 : 0.30;
const MAX_ENHANCE = 12;

// ===== 动态内容生成（无限模式） =====
const MONSTER_PREFIXES = ['狂暴的','远古的','变异的','堕落的','混沌的','天界的','神圣的','黑暗的','燃烧的','冰封的','狂暴的','远古的','变异的','堕落的','混沌的'];
const MONSTER_SUFFIXES = ['·改','·真','·极','·终','·灭','·皇','·帝','·神','·圣','·尊'];
const DYN_SLOT_NAMES = { weapon:'剑', armor:'甲', helmet:'冠', necklace:'坠', bracelet:'镯', ring:'戒', belt:'带', shoes:'靴' };
const DYN_EQUIP_PREFIXES = { mythic: '神话', divine: '仙器' };
const DYN_EQUIP_SUFFIXES = ['之怒','之怒Ⅱ','·觉醒','·破晓','·混沌','·天罚','·神罚','·至尊'];

// ===== 宝石系统 =====
const SOCKET_LIMIT = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3, mythic: 4, divine: 4 };
const SOCKET_COST = (levelReq) => 200 * (levelReq || 1);
const REMOVE_GEM_COST = 500;

const GEM_DB = [
  { id: 'gem_attack', name: '攻击宝石', type: 'gem', attack: 5, price: 500, quality: 'rare' },
  { id: 'gem_defense', name: '防御宝石', type: 'gem', defense: 5, price: 500, quality: 'rare' },
  { id: 'gem_hp', name: '生命宝石', type: 'gem', hp: 50, price: 500, quality: 'rare' },
  { id: 'gem_mp', name: '魔法宝石', type: 'gem', mp: 30, price: 500, quality: 'rare' },
];

// ===== 装备鉴定系统 =====
const APPRAISE_SCROLLS = {
  normal: { id: 'appraise_normal', name: '鉴定符(普通)', type: 'scroll', price: 200, quality: 1 },
  high: { id: 'appraise_high', name: '鉴定符(高级)', type: 'scroll', price: 800, quality: 2 },
  supreme: { id: 'appraise_supreme', name: '鉴定符(至尊)', type: 'scroll', price: 2000, quality: 3 },
};
const APPRAISE_ATTRS = ['attack', 'defense', 'hp', 'mp', 'lucky'];
const APPRAISE_RANGES = {
  1: { attack: [1, 5], defense: [1, 5], hp: [10, 30], mp: [5, 15], lucky: [1, 2] },
  2: { attack: [3, 10], defense: [3, 10], hp: [20, 60], mp: [10, 30], lucky: [1, 3] },
  3: { attack: [5, 20], defense: [5, 15], hp: [30, 100], mp: [15, 50], lucky: [1, 4] },
};
const APPRAISE_COUNTS = { 1: 1, 2: 2, 3: 3 };

// ===== 幸运值系统 =====
const LUCKY_MAX = 7; // 单件装备幸运上限
const LUCKY_TARGET = 9; // 运9套目标值

// ===== 挖矿系统 =====
const ORE_DB = [
  { id: 'ore_copper', name: '铜矿石', type: 'ore', price: 50, quality: 1 },
  { id: 'ore_iron', name: '铁矿石', type: 'ore', price: 100, quality: 2 },
  { id: 'ore_silver', name: '银矿石', type: 'ore', price: 200, quality: 3 },
  { id: 'ore_gold', name: '金矿石', type: 'ore', price: 400, quality: 4 },
  { id: 'ore_meteor', name: '陨铁矿石', type: 'ore', price: 800, quality: 5 },
];
const MINE_SPOTS = [
  { x: 15, y: 20 }, { x: 25, y: 35 }, { x: 40, y: 15 },
  { x: 55, y: 45 }, { x: 70, y: 30 }, { x: 30, y: 50 },
  { x: 60, y: 55 }, { x: 45, y: 25 },
];
const MINE_DURATION = 3000; // 挖矿3秒
const MINE_COOLDOWN = 5000; // 冷却5秒
const MINE_SUCCESS_RATE = 0.85;

// ===== 生肖套装（10级，每阶集齐12件触发，高阶覆盖低阶） =====
const ZODIAC_SETS = {};
const ZODIAC_NAMES = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const ZODIAC_LEVEL_REQ = [5,10,15,20,25,30,35,40,45,50];
const SLOTS = ['weapon','armor','necklace','ring'];
for (let tier = 0; tier < 10; tier++) {
  const base = 10 + tier * 10;
  const mult = 1 + tier * 0.5;
  ZODIAC_SETS[`zodiac_tier_${tier}`] = {
    name: `${tier+1}阶生肖套装`,
    pieces: ZODIAC_NAMES.map(n => `zodiac_${n}_${tier}`),
    bonus: { attack: Math.floor(base * mult * 0.5), defense: Math.floor(base * mult * 0.4), hp: Math.floor(base * mult * 2), mp: Math.floor(base * mult) },
  };
}

// ===== 五行神装 =====
const WUXING_SETS = {};
const WUXING_NAMES = ['金锐','木灵','水渊','火狱','土岳'];
const WUXING_BASE = {
  metal:   { weapon: {attack:80,defense:0,hp:0,mp:0}, armor:{attack:0,defense:50,hp:100,mp:0}, necklace:{attack:20,defense:15,hp:50,mp:20}, ring:{attack:30,defense:10,hp:40,mp:10} },
  wood:    { weapon: {attack:30,defense:10,hp:150,mp:0}, armor:{attack:0,defense:40,hp:200,mp:0}, necklace:{attack:10,defense:20,hp:100,mp:30}, ring:{attack:10,defense:15,hp:80,mp:20} },
  water:   { weapon: {attack:50,defense:20,hp:0,mp:50}, armor:{attack:0,defense:60,hp:80,mp:40}, necklace:{attack:15,defense:25,hp:60,mp:60}, ring:{attack:20,defense:20,hp:50,mp:40} },
  fire:    { weapon: {attack:90,defense:0,hp:80,mp:0}, armor:{attack:20,defense:30,hp:120,mp:0}, necklace:{attack:30,defense:10,hp:60,mp:10}, ring:{attack:40,defense:5,hp:50,mp:0} },
  earth:   { weapon: {attack:40,defense:30,hp:100,mp:0}, armor:{attack:0,defense:70,hp:150,mp:0}, necklace:{attack:10,defense:35,hp:80,mp:10}, ring:{attack:15,defense:30,hp:70,mp:10} },
};
const WUXING_ELEMENTS = ['metal','wood','water','fire','earth'];
WUXING_NAMES.forEach((name, i) => {
  const el = WUXING_ELEMENTS[i];
  WUXING_SETS[`wuxing_${i}`] = { name: `${name}神装`, pieces: [`wuxing_${el}_weapon`,`wuxing_${el}_armor`,`wuxing_${el}_necklace`,`wuxing_${el}_ring`], bonus: { attack: 200, defense: 160, hp: 800, mp: 400 } };
});

// ===== 修仙系统 =====
const REALM_NAMES = ['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','真仙','金仙','太乙','大罗','混元','道祖','圣人','天道','混沌','无极'];
const REALM_MULT = (realm) => 1 + (realm + 1) * 0.15; // 每境界+15%
const REALM_COST = (realm, stage) => 1000 * Math.pow(2, realm) * (stage + 1);
const BREAKTHROUGH_LEVEL_REQ = 50;

// ===== 声望系统 =====
const REPUTATION_TIERS = [
  { name: '平民', req: 0 },
  { name: '勇士', req: 100 },
  { name: '英雄', req: 500 },
  { name: '传奇', req: 2000 },
  { name: '战神', req: 5000 },
];

// ===== 红名系统 =====
const PK_MAX = 100;
const PK_REDUCE_INTERVAL = 300; // 每5分钟在线减1点PK值
const RED_NAME_DROP_RATE = 0.3; // 红名被击杀掉落装备概率

// ===== 无尽副本 =====
const ENDLESS_DUNGEON = {
  baseLevel: 50,         // 起始怪物等级
  levelScale: 1.10,      // 每层怪物等级增长10%
  hpScale: 1.18,         // 每层怪物血量增长18%
  atkScale: 1.15,        // 每层攻击力增长15%
  defScale: 1.14,        // 每层防御增长14%
  rewardScale: 1.08,     // 每层奖励增长8%
  bossEvery: 10,         // 每10层一个BOSS
  monsterCount: 25,      // 每层怪物数量
  maxLayer: 9999,        // 最大层数
};

// ===== 装备合成 =====
const SYNTH_COST = (quality) => ({ common: 500, uncommon: 1000, rare: 2000, epic: 5000, legendary: 10000, mythic: 50000, divine: 200000 }[quality] || 1000);
const SYNTH_RATES = { common: 1.0, uncommon: 0.9, rare: 0.75, epic: 0.6, legendary: 0.4, mythic: 0.25, divine: 0.15 };

// ===== 装备突破 =====
const EQUIP_BREAKTHROUGH_MULT = 1.5; // 每次突破属性倍率
const EQUIP_BREAKTHROUGH_RATE_DECAY = 0.85; // 每次突破成功率衰减
const EQUIP_BREAKTHROUGH_COST_MULT = 3; // 每次突破金币消耗倍率
const EQUIP_BREAKTHROUGH_MAT_BASE = 5; // 基础材料数量
const EQUIP_BREAKTHROUGH_MAT_MULT = 2; // 材料数量倍率
const EQUIP_BREAKTHROUGH_BONUS_CHANCE = 0.3; // 获得额外词条概率

// 突破材料定义
const BREAKTHROUGH_MATERIALS = {
  divine: { name: '仙器碎片', baseCost: 1 },
  mythic: { name: '神话碎片', baseCost: 1 },
  legendary: { name: '传说碎片', baseCost: 1 },
};

// 额外词条池
const BONUS_ATTRS = [
  { name: '暴击', key: 'critRate', min: 5, max: 15, suffix: '%' },
  { name: '吸血', key: 'lifesteal', min: 3, max: 10, suffix: '%' },
  { name: '全属性', key: 'allStats', min: 5, max: 20, suffix: '%' },
  { name: '对BOSS伤害', key: 'bossDmg', min: 10, max: 30, suffix: '%' },
  { name: '技能冷却', key: 'cdr', min: 5, max: 15, suffix: '%' },
  { name: '闪避', key: 'dodge', min: 3, max: 10, suffix: '%' },
  { name: '命中', key: 'hitRate', min: 5, max: 15, suffix: '%' },
];

// ===== 排行榜 =====
const LEADERBOARD_TOP = 10;

// ===== 经脉系统 =====
const MERIDIANS = {
  ren: { name: '任脉', points: 10, attr: 'hp', valuePer: 20 },
  du: { name: '督脉', points: 10, attr: 'attack', valuePer: 5 },
  chong: { name: '冲脉', points: 10, attr: 'defense', valuePer: 3 },
  dai: { name: '带脉', points: 10, attr: 'mp', valuePer: 15 },
  yinqiao: { name: '阴跷脉', points: 10, attr: 'hp', valuePer: 15 },
  yangqiao: { name: '阳跷脉', points: 10, attr: 'attack', valuePer: 4 },
  yinwei: { name: '阴维脉', points: 10, attr: 'defense', valuePer: 4 },
  yangwei: { name: '阳维脉', points: 10, attr: 'mp', valuePer: 10 },
};
const MERIDIAN_POINT_COST = (tier) => 100 + tier * 50;

// ===== 坐骑系统 =====
const MOUNTS_DB = [
  { id: 'mount_horse', name: '黄骠马', price: 2000, speed: 1.2, hp: 20, attack: 2, defense: 1 },
  { id: 'mount_black', name: '乌云踏雪', price: 5000, speed: 1.3, hp: 50, attack: 5, defense: 3 },
  { id: 'mount_red', name: '赤兔马', price: 10000, speed: 1.5, hp: 100, attack: 10, defense: 5 },
  { id: 'mount_dragon', name: '神龙坐骑', price: 20000, speed: 1.8, hp: 200, attack: 20, defense: 10 },
];
const MOUNT_UPGRADE_COST = (level) => 500 * Math.pow(2, level);

// ===== 翅膀系统 =====
const WINGS_DB = [
  { id: 'wings_small', name: '初翼', price: 3000, hp: 30, attack: 3, defense: 2 },
  { id: 'wings_fire', name: '烈焰之翼', price: 8000, hp: 80, attack: 8, defense: 5 },
  { id: 'wings_ice', name: '冰霜之翼', price: 15000, hp: 150, attack: 15, defense: 10 },
  { id: 'wings_demon', name: '魔神之翼', price: 30000, hp: 300, attack: 30, defense: 20 },
];
const WING_UPGRADE_COST = (level) => 1000 * Math.pow(2, level);

// ===== 英雄/元神系统 =====
const HERO_CLASSES = {
  warrior: { name: '战神护卫', hp: 500, attack: 30, defense: 15, skill: '烈火护卫' },
  mage: { name: '灵法侍从', hp: 300, attack: 45, defense: 8, skill: '雷击术' },
  taoist: { name: '道灵童子', hp: 400, attack: 25, defense: 12, skill: '治愈灵光' },
};
const HERO_UNLOCK_LEVEL = 30;
const HERO_UNLOCK_COST = 10000;

// ===== 沙巴克攻城战 =====
const SABAK_EVENT = {
  active: false,
  startTime: 0,
  duration: 7200,
  attackers: [],
  defenders: [],
  gates: { main: { hp: 5000, maxHp: 5000 }, side: { hp: 3000, maxHp: 3000 } },
  palace: { controller: null },
  winner: null,
};

// ===== 师徒系统 =====
const APPRENTICE_REQ = { masterMinLevel: 30, apprenticeMaxLevel: 15, rewardExp: 2000, rewardGold: 1000 };
const mentorMap = new Map(); // apprenticeId -> masterId
const apprenticeMap = new Map(); // masterId -> Set<apprenticeId>

// ===== 每日活动 =====
const DAILY_ACTIVITIES = {
  login: { id: 'login', name: '每日签到', desc: '登录游戏', reward: { gold: 1000, exp: 500 } },
  kill_10: { id: 'kill_10', name: '清理野怪', desc: '击杀10只怪物', reward: { gold: 2000, exp: 1000 } },
  mine_5: { id: 'mine_5', name: '勤劳矿工', desc: '挖矿5次', reward: { gold: 3000, exp: 1500 } },
  boss_kill: { id: 'boss_kill', name: 'BOSS猎人', desc: '击杀1只BOSS', reward: { gold: 5000, exp: 3000 } },
  synth_1: { id: 'synth_1', name: '炼金术士', desc: '合成1次装备', reward: { gold: 2000, exp: 1000 } },
};

// ===== 结婚系统 =====
const MARRIAGE_REQ = { minLevel: 20, ringId: 'wedding_ring', ringPrice: 5000 };
const marriedPairs = new Map(); // playerId -> { partnerId, partnerName, marriedAt }

// ===== 成就系统 =====
const ACHIEVEMENTS = {
  kill_100: { id: 'kill_100', name: '百斩', desc: '累计击杀100只怪物', reward: { gold: 5000, reputation: 50 } },
  kill_1000: { id: 'kill_1000', name: '千斩', desc: '累计击杀1000只怪物', reward: { gold: 20000, reputation: 200 } },
  level_50: { id: 'level_50', name: '初露锋芒', desc: '达到50级', reward: { gold: 10000, reputation: 100 } },
  level_100: { id: 'level_100', name: '一代宗师', desc: '达到100级', reward: { gold: 50000, reputation: 500 } },
  rebirth_1: { id: 'rebirth_1', name: '轮回者', desc: '完成1次转生', reward: { gold: 20000, reputation: 200 } },
  equip_legendary: { id: 'equip_legendary', name: '神装加身', desc: '装备一件传说装备', reward: { gold: 30000, reputation: 300 } },
  rich_100k: { id: 'rich_100k', name: '富甲一方', desc: '累计获得10万金币', reward: { gold: 10000, reputation: 100 } },
};

// ===== 摆摊系统 =====
const playerStalls = new Map(); // playerId -> { name, items: [{item, price, sellerId}], ownerName }

// ===== 世界BOSS =====
const WORLDBOSS_DB = [
  { id: 'hongmo_boss', name: '虹魔教主', map: 'fengmo', x: 150, y: 150, interval: 30 * 60 * 1000, hp: 50000, attack: 300, defense: 150, exp: 5000, goldMin: 1000, goldMax: 3000, qualityPool: ['epic','legendary'] },
  { id: 'redmoon_devil', name: '赤月恶魔', map: 'redmoon', x: 60, y: 40, interval: 60 * 60 * 1000, hp: 100000, attack: 500, defense: 250, exp: 10000, goldMin: 2000, goldMax: 5000, qualityPool: ['legendary'] },
  { id: 'shaba_lord', name: '沙巴克城主', map: 'shaba', x: 40, y: 40, interval: 120 * 60 * 1000, hp: 200000, attack: 800, defense: 400, exp: 20000, goldMin: 5000, goldMax: 10000, qualityPool: ['legendary'] },
];

const worldBossState = {
  timers: {},
  active: {},
  nextSpawn: {},
};

const EQUIPMENT_DB = [
  // 武器
  { id: 'wood_sword', name: '木剑', slot: 'weapon', quality: 'common', levelReq: 1, attack: 2 },
  { id: 'iron_sword', name: '铁剑', slot: 'weapon', quality: 'common', levelReq: 3, attack: 5 },
  { id: 'steel_sword', name: '钢剑', slot: 'weapon', quality: 'uncommon', levelReq: 5, attack: 8 },
  { id: 'fire_sword_e', name: '炼狱战斧', slot: 'weapon', quality: 'rare', levelReq: 10, attack: 15 },
  { id: 'dragon_blade', name: '屠龙刀', slot: 'weapon', quality: 'epic', levelReq: 20, attack: 30 },
  { id: 'heaven_blade', name: '开天斧', slot: 'weapon', quality: 'legendary', levelReq: 35, attack: 50 },
  // 衣服
  { id: 'cloth_armor', name: '布甲', slot: 'armor', quality: 'common', levelReq: 1, defense: 2 },
  { id: 'iron_armor', name: '重盔甲', slot: 'armor', quality: 'uncommon', levelReq: 5, defense: 6 },
  { id: 'dragon_armor', name: '天魔神甲', slot: 'armor', quality: 'rare', levelReq: 12, defense: 12 },
  { id: 'holy_armor', name: '圣战宝甲', slot: 'armor', quality: 'epic', levelReq: 22, defense: 20 },
  // 头盔
  { id: 'leather_helm', name: '皮盔', slot: 'helmet', quality: 'common', levelReq: 1, defense: 1 },
  { id: 'iron_helm', name: '铁头盔', slot: 'helmet', quality: 'uncommon', levelReq: 4, defense: 3 },
  { id: 'dragon_helm', name: '黑铁头盔', slot: 'helmet', quality: 'rare', levelReq: 8, defense: 5, hp: 10 },
  { id: 'crown', name: '沃玛头盔', slot: 'helmet', quality: 'epic', levelReq: 15, defense: 8, hp: 20, mp: 10 },
  // 项链
  { id: 'copper_neck', name: '铜项链', slot: 'necklace', quality: 'common', levelReq: 1, defense: 1 },
  { id: 'gold_neck', name: '金项链', slot: 'necklace', quality: 'uncommon', levelReq: 5, defense: 2, hp: 10 },
  { id: 'soul_neck', name: '灵魂项链', slot: 'necklace', quality: 'rare', levelReq: 10, hp: 30, mp: 15 },
  { id: 'demon_neck', name: '恶魔铃铛', slot: 'necklace', quality: 'epic', levelReq: 18, attack: 5, hp: 20 },
  // 手镯
  { id: 'iron_brace', name: '铁手镯', slot: 'bracelet', quality: 'common', levelReq: 1, defense: 1 },
  { id: 'silver_brace', name: '银手镯', slot: 'bracelet', quality: 'uncommon', levelReq: 3, defense: 2 },
  { id: 'power_brace', name: '力量手镯', slot: 'bracelet', quality: 'rare', levelReq: 8, attack: 4 },
  { id: 'magic_brace', name: '魔法手镯', slot: 'bracelet', quality: 'epic', levelReq: 15, attack: 6, mp: 10 },
  // 戒指
  { id: 'copper_ring', name: '铜戒指', slot: 'ring', quality: 'common', levelReq: 1, hp: 5 },
  { id: 'gold_ring', name: '金戒指', slot: 'ring', quality: 'uncommon', levelReq: 4, hp: 15, defense: 2 },
  { id: 'power_ring', name: '力量戒指', slot: 'ring', quality: 'rare', levelReq: 10, attack: 5 },
  { id: 'dragon_ring', name: '龙戒', slot: 'ring', quality: 'epic', levelReq: 20, attack: 8, hp: 30 },
  { id: 'legend_ring', name: '麻痹戒指', slot: 'ring', quality: 'legendary', levelReq: 30, attack: 12, hp: 50, defense: 5 },
  // 腰带
  { id: 'leather_belt', name: '皮带', slot: 'belt', quality: 'common', levelReq: 1, defense: 1, hp: 5 },
  { id: 'iron_belt', name: '铁腰带', slot: 'belt', quality: 'uncommon', levelReq: 5, defense: 3, hp: 15 },
  { id: 'silk_belt', name: '丝绒腰带', slot: 'belt', quality: 'rare', levelReq: 10, defense: 5, hp: 30 },
  { id: 'demon_belt', name: '恶魔腰带', slot: 'belt', quality: 'epic', levelReq: 20, defense: 8, hp: 50, attack: 3 },
  // 鞋子
  { id: 'cloth_shoes', name: '布靴', slot: 'shoes', quality: 'common', levelReq: 1, defense: 1 },
  { id: 'leather_boots', name: '皮靴', slot: 'shoes', quality: 'uncommon', levelReq: 4, defense: 2 },
  { id: 'iron_boots', name: '铁靴', slot: 'shoes', quality: 'rare', levelReq: 8, defense: 4, hp: 10 },
  { id: 'demon_boots', name: '恶魔之靴', slot: 'shoes', quality: 'epic', levelReq: 18, defense: 7, hp: 20, attack: 2 },
  // ===== 神话装备（mythic） =====
  { id: 'mythic_sword', name: '诛仙剑', slot: 'weapon', quality: 'mythic', levelReq: 200, attack: 5000, hp: 2000 },
  { id: 'mythic_blade', name: '轩辕剑', slot: 'weapon', quality: 'mythic', levelReq: 220, attack: 6000, hp: 2500, mp: 500 },
  { id: 'mythic_hammer', name: '开天辟地斧', slot: 'weapon', quality: 'mythic', levelReq: 240, attack: 7000, hp: 3000 },
  { id: 'mythic_staff', name: '混沌魔杖', slot: 'weapon', quality: 'mythic', levelReq: 260, attack: 8000, mp: 1000, hp: 1500 },
  { id: 'mythic_spear', name: '方天画戟', slot: 'weapon', quality: 'mythic', levelReq: 280, attack: 9000, hp: 3500 },
  { id: 'mythic_bow', name: '后羿神弓', slot: 'weapon', quality: 'mythic', levelReq: 300, attack: 10000, hp: 4000, mp: 500 },
  { id: 'mythic_armor', name: '玄武甲', slot: 'armor', quality: 'mythic', levelReq: 200, defense: 3000, hp: 5000 },
  { id: 'mythic_armor2', name: '麒麟战甲', slot: 'armor', quality: 'mythic', levelReq: 240, defense: 4000, hp: 7000 },
  { id: 'mythic_armor3', name: '青龙战袍', slot: 'armor', quality: 'mythic', levelReq: 280, defense: 5000, hp: 10000 },
  { id: 'mythic_helm', name: '天界战盔', slot: 'helmet', quality: 'mythic', levelReq: 200, defense: 2000, hp: 3000 },
  { id: 'mythic_helm2', name: '混沌战盔', slot: 'helmet', quality: 'mythic', levelReq: 250, defense: 3000, hp: 5000 },
  { id: 'mythic_neck', name: '凤凰项链', slot: 'necklace', quality: 'mythic', levelReq: 200, attack: 2000, hp: 3000, mp: 500 },
  { id: 'mythic_neck2', name: '龙魂坠', slot: 'necklace', quality: 'mythic', levelReq: 250, attack: 3000, hp: 4000, mp: 800 },
  { id: 'mythic_neck3', name: '神魔之泪', slot: 'necklace', quality: 'mythic', levelReq: 300, attack: 4000, hp: 5000, mp: 1000 },
  { id: 'mythic_bracelet', name: '天界神镯', slot: 'bracelet', quality: 'mythic', levelReq: 200, defense: 1500, hp: 2000 },
  { id: 'mythic_bracelet2', name: '混沌神镯', slot: 'bracelet', quality: 'mythic', levelReq: 250, defense: 2000, hp: 3000, attack: 1000 },
  { id: 'mythic_ring', name: '乾坤戒', slot: 'ring', quality: 'mythic', levelReq: 200, attack: 1500, defense: 1000, hp: 2000 },
  { id: 'mythic_ring2', name: '混沌神戒', slot: 'ring', quality: 'mythic', levelReq: 250, attack: 2500, defense: 1500, hp: 3000 },
  { id: 'mythic_belt', name: '天界神带', slot: 'belt', quality: 'mythic', levelReq: 200, defense: 1000, hp: 3000 },
  { id: 'mythic_boots', name: '天界神靴', slot: 'shoes', quality: 'mythic', levelReq: 200, defense: 1000, hp: 2000 },
  // ===== 仙器装备（divine） =====
  { id: 'divine_sword', name: '盘古斧', slot: 'weapon', quality: 'divine', levelReq: 300, attack: 15000, hp: 5000, mp: 2000 },
  { id: 'divine_blade', name: '混沌之刃', slot: 'weapon', quality: 'divine', levelReq: 350, attack: 20000, hp: 7000, mp: 3000 },
  { id: 'divine_hammer', name: '女娲补天锤', slot: 'weapon', quality: 'divine', levelReq: 400, attack: 25000, hp: 10000, mp: 5000 },
  { id: 'divine_staff', name: '造化玉碟', slot: 'weapon', quality: 'divine', levelReq: 400, attack: 20000, mp: 5000, hp: 5000 },
  { id: 'divine_armor', name: '混沌圣甲', slot: 'armor', quality: 'divine', levelReq: 300, defense: 10000, hp: 20000 },
  { id: 'divine_armor2', name: '天道神甲', slot: 'armor', quality: 'divine', levelReq: 350, defense: 15000, hp: 30000 },
  { id: 'divine_helm', name: '混沌神冠', slot: 'helmet', quality: 'divine', levelReq: 300, defense: 8000, hp: 15000 },
  { id: 'divine_neck', name: '混沌之心', slot: 'necklace', quality: 'divine', levelReq: 300, attack: 8000, hp: 10000, mp: 5000 },
  { id: 'divine_neck2', name: '天道神坠', slot: 'necklace', quality: 'divine', levelReq: 400, attack: 12000, hp: 15000, mp: 8000 },
  { id: 'divine_bracelet', name: '混沌神镯', slot: 'bracelet', quality: 'divine', levelReq: 300, defense: 5000, hp: 8000, attack: 3000 },
  { id: 'divine_ring', name: '混沌神戒', slot: 'ring', quality: 'divine', levelReq: 300, attack: 6000, defense: 4000, hp: 8000 },
  { id: 'divine_ring2', name: '天道神戒', slot: 'ring', quality: 'divine', levelReq: 400, attack: 10000, defense: 6000, hp: 12000 },
  { id: 'divine_belt', name: '混沌神带', slot: 'belt', quality: 'divine', levelReq: 300, defense: 4000, hp: 10000 },
  { id: 'divine_boots', name: '混沌神靴', slot: 'shoes', quality: 'divine', levelReq: 300, defense: 4000, hp: 8000 },
];

// ===== 生肖装备（12生肖×10阶=120件） =====
const ZODIAC_SLOT_NAMES = {weapon:"刃",armor:"甲",necklace:"链",ring:"戒"};
const ZODIAC_SLOTS = ['weapon','armor','necklace','ring'];
for (let tier = 0; tier < 10; tier++) {
  const level = ZODIAC_LEVEL_REQ[tier];
  const baseAtk = 20 + tier * 15;
  const baseDef = 15 + tier * 10;
  const baseHp = 50 + tier * 30;
  ZODIAC_NAMES.forEach((name, zi) => {
    const zMult = 1 + zi * 0.15;
    const tMult = 1 + tier * 0.3;
    EQUIPMENT_DB.push({
      id: `zodiac_${name}_${tier}`,
      name: `${name}年·${tier+1}阶`,
      slot: `zodiac_${name}`,
      quality: "legendary", levelReq: level,
      attack: Math.floor(baseAtk * zMult * tMult * 4),
      defense: Math.floor(baseDef * zMult * tMult * 4),
      hp: Math.floor(baseHp * zMult * tMult * 6),
      mp: Math.floor(baseHp * 0.3 * zMult * tMult * 4)
    });
  });
}

// ===== 五行神装（5行×4件=20件） =====
const WUXING_CN = { metal:"金锐", wood:"木灵", water:"水渊", fire:"火狱", earth:"土岳" };
const WUXING_STATS = {
  weapon: { metal:{attack:80}, wood:{attack:40,hp:100}, water:{attack:60,mp:40}, fire:{attack:90}, earth:{attack:50,defense:20} },
  armor:  { metal:{defense:50,hp:80}, wood:{defense:30,hp:150}, water:{defense:60,hp:60,mp:30}, fire:{defense:40,hp:100}, earth:{defense:70,hp:120} },
  necklace:{ metal:{attack:20,defense:15}, wood:{defense:20,hp:80,mp:20}, water:{attack:15,defense:20,mp:50}, fire:{attack:25,hp:50}, earth:{defense:30,hp:60} },
  ring:   { metal:{attack:30,defense:10}, wood:{defense:15,hp:60,mp:15}, water:{attack:20,defense:15,mp:30}, fire:{attack:35,hp:40}, earth:{attack:15,defense:25,hp:50} },
};
WUXING_ELEMENTS.forEach(el => {
  const cn = WUXING_CN[el];
  ZODIAC_SLOTS.forEach(slot => {
    const stats = WUXING_STATS[slot][el];
    EQUIPMENT_DB.push({
      id: `wuxing_${el}_${slot}`,
      name: `${cn}·${slot==="weapon"?"神锋":slot==="armor"?"神铠":slot==="necklace"?"神链":"神戒"}`,
      slot, quality: "legendary", levelReq: 80,
      attack: stats.attack || 0,
      defense: stats.defense || 0,
      hp: stats.hp || 0,
      mp: stats.mp || 0,
    });
  });
});

// ===== 药水/消耗品 =====
const POTIONS = {
  small_hp: { id: 'small_hp', name: '金创药(小)', type: 'potion', effect: { hp: 50 }, price: 50 },
  medium_hp: { id: 'medium_hp', name: '金创药(中)', type: 'potion', effect: { hp: 150 }, price: 150 },
  large_hp: { id: 'large_hp', name: '金创药(大)', type: 'potion', effect: { hp: 300 }, price: 350 },
  small_mp: { id: 'small_mp', name: '魔法药水(小)', type: 'potion', effect: { mp: 30 }, price: 60 },
  medium_mp: { id: 'medium_mp', name: '魔法药水(中)', type: 'potion', effect: { mp: 100 }, price: 180 },
  large_mp: { id: 'large_mp', name: '魔法药水(大)', type: 'potion', effect: { mp: 200 }, price: 400 },
  sun: { id: 'sun', name: '太阳水', type: 'potion', effect: { hp: 200, mp: 100 }, price: 500 },
  great_sun: { id: 'great_sun', name: '万年雪霜', type: 'potion', effect: { hp: 500, mp: 300 }, price: 1500 },
};

// ===== 装备套装系统 =====
const EQUIPMENT_SETS = {
  // 沃玛套装 (3件)
  woma_set: { name: '沃玛套装', pieces: ['crown', 'holy_armor', 'dragon_neck'], bonus: { attack: 5, defense: 5, hp: 30 } },
  // 祖玛套装 (3件)
  zumma_set: { name: '祖玛套装', pieces: ['dragon_helm', 'dragon_armor', 'dragon_ring'], bonus: { attack: 10, defense: 10, hp: 60 } },
  // 圣战套装 (4件)
  holy_set: { name: '圣战套装', pieces: ['holy_armor', 'crown', 'demon_neck', 'dragon_blade'], bonus: { attack: 15, defense: 15, hp: 100 } },
  // 恶魔套装 (4件)
  demon_set: { name: '恶魔套装', pieces: ['demon_belt', 'demon_boots', 'demon_neck', 'dragon_ring'], bonus: { attack: 12, defense: 12, hp: 80, mp: 50 } },
  // 开天套装 (5件)
  heaven_set: { name: '开天套装', pieces: ['heaven_blade', 'holy_armor', 'crown', 'demon_neck', 'legend_ring'], bonus: { attack: 25, defense: 20, hp: 150, mp: 80 } },
};

// ===== 技能系统 =====
const SKILLS = {
  // 战士技能
  fire_sword: { id: 'fire_sword', name: '烈火剑法', class: 'warrior', levelReq: 7, mpCost: 10, cooldown: 5000, description: '凝聚火焰之力，造成2倍物理伤害', damageMult: 2.0 },
  assassination: { id: 'assassination', name: '刺杀剑术', class: 'warrior', levelReq: 4, mpCost: 5, cooldown: 3000, description: '无视防御的精准一击，造成1.5倍伤害', damageMult: 1.5 },
  lion_roar: { id: 'lion_roar', name: '狮子吼', class: 'warrior', levelReq: 12, mpCost: 15, cooldown: 8000, description: '震慑周围怪物，使怪物眩晕3秒', damageMult: 1.0, aoe: true },
  // 法师技能
  lightning: { id: 'lightning', name: '雷电术', class: 'mage', levelReq: 3, mpCost: 8, cooldown: 2000, description: '召唤雷电攻击敌人，造成魔法攻击×2.5的伤害', damageMult: 2.5 },
  ice_roar: { id: 'ice_roar', name: '冰咆哮', class: 'mage', levelReq: 10, mpCost: 20, cooldown: 6000, description: '冰冻周围敌人，造成魔法攻击×2的范围伤害', damageMult: 2.0, aoe: true },
  fire_wall: { id: 'fire_wall', name: '火墙', class: 'mage', levelReq: 15, mpCost: 25, cooldown: 10000, description: '在地面释放火墙，持续5秒，每秒造成魔法攻击×0.8的伤害', damageMult: 0.8, dot: true, dotDuration: 5000 },
  // 道士技能
  heal: { id: 'heal', name: '治愈术', class: 'taoist', levelReq: 3, mpCost: 6, cooldown: 3000, description: '治疗自身，恢复最大HP的30%', healPercent: 0.3 },
  poison: { id: 'poison', name: '施毒术', class: 'taoist', levelReq: 5, mpCost: 10, cooldown: 5000, description: '对敌人施放毒素，降低防御并持续掉血', damageMult: 1.2, dot: true, dotDuration: 5000, defenseReduce: 0.3 },
  summon: { id: 'summon', name: '召唤骷髅', class: 'taoist', levelReq: 8, mpCost: 30, cooldown: 30000, description: '召唤骷髅战士协助战斗', summon: true, summonHp: 200, summonAttack: 20, summonDuration: 60000 },
};

// ===== 地图定义 =====
const MAPS = {
  bichon: { name: '比奇城', width: 100, height: 80, safeZone: {x1:40,y1:40,x2:60,y2:60} },
  mengzhong: { name: '盟重土城', width: 80, height: 60, safeZone: {x1:30,y1:20,x2:50,y2:40} },
  zombie_cave: { name: '僵尸洞', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  woma_temple: { name: '沃玛寺庙', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  pig_cave: { name: '石墓阵', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  fengmo: { name: '封魔谷', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zumma: { name: '祖玛寺庙', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  redmoon: { name: '赤月峡谷', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  bull: { name: '牛魔寺庙', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  cangyue: { name: '苍月岛', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  shaba: { name: '沙巴克城', width: 80, height: 60, safeZone: {x1:35,y1:35,x2:45,y2:45} },
  // 生肖神殿（掉落12生肖套装）
  // 生肖神殿10层（每层对应一阶装备）
  zodiac_floor_1: { name: '生肖神殿·1层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_2: { name: '生肖神殿·2层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_3: { name: '生肖神殿·3层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_4: { name: '生肖神殿·4层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_5: { name: '生肖神殿·5层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_6: { name: '生肖神殿·6层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_7: { name: '生肖神殿·7层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_8: { name: '生肖神殿·8层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_9: { name: '生肖神殿·9层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_10: { name: '生肖神殿·10层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  // 五行神殿（掉落五行神装）
  wuxing_palace: { name: '五行神殿', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  // 高级地图
  heaven: { name: '天界', width: 120, height: 100, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  abyss: { name: '混沌之渊', width: 120, height: 100, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  // 副本地图
  dungeon_cave: { name: '矿洞副本', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:12,y2:12} },
  dungeon_woma: { name: '沃玛寺庙副本', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:12,y2:12} },
  dungeon_zumma: { name: '祖玛寺庙副本', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:12,y2:12} },
  // 生肖神殿10层（每层对应一阶装备）
  zodiac_floor_1: { name: '生肖神殿·1层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_2: { name: '生肖神殿·2层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_3: { name: '生肖神殿·3层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_4: { name: '生肖神殿·4层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_5: { name: '生肖神殿·5层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_6: { name: '生肖神殿·6层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_7: { name: '生肖神殿·7层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_8: { name: '生肖神殿·8层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_9: { name: '生肖神殿·9层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
  zodiac_floor_10: { name: '生肖神殿·10层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15} },
};

// ===== 商店物品 =====
const SHOP_ITEMS = {
  potion: Object.values(POTIONS),
  material: Object.values(APPRAISE_SCROLLS).concat([{ id: 'bless_oil', name: '祝福油', type: 'material', price: 300 }, { id: 'wedding_ring', name: '求婚戒指', type: 'material', price: MARRIAGE_REQ.ringPrice }]),
  weapon: [
    {id:'wood_sword',name:'木剑',price:100,type:'weapon',attack:2},
    {id:'iron_sword',name:'铁剑',price:500,type:'weapon',attack:5},
    {id:'steel_sword',name:'炼狱战斧',price:1500,type:'weapon',attack:15},
  ],
  armor: [
    {id:'cloth_armor',name:'布甲',price:200,type:'armor',defense:2},
    {id:'iron_armor',name:'重盔甲',price:800,type:'armor',defense:6},
    {id:'dragon_armor',name:'天魔神甲',price:3000,type:'armor',defense:12},
  ],
  jewelry: [
    {id:'copper_neck',name:'铜项链',price:150,type:'jewelry',defense:1},
    {id:'gold_neck',name:'金项链',price:400,type:'jewelry',defense:2,hp:10},
    {id:'copper_ring',name:'铜戒指',price:100,type:'jewelry',hp:5},
    {id:'gold_ring',name:'金戒指',price:300,type:'jewelry',hp:15,defense:2},
    {id:'iron_brace',name:'铁手镯',price:120,type:'jewelry',defense:1},
    {id:'silver_brace',name:'银手镯',price:250,type:'jewelry',defense:2},
  ],
};

// ===== 职业定义 =====
const CLASSES = {
  warrior: {
    name: '战士', color: '#ff4444',
    baseHp: 150, baseMp: 30, baseAtk: 15, baseDef: 10,
    hpGrowth: 25, mpGrowth: 5, atkGrowth: 5, defGrowth: 4,
    skills: [
      { id: 'fire_sword', name: '烈火剑法', level: 5, mpCost: 10, damageMult: 1.8, cooldown: 3, desc: '烈火附体，伤害+80%' },
      { id: 'double_strike', name: '双龙斩', level: 10, mpCost: 15, damageMult: 2.2, cooldown: 5, desc: '双剑合璧，伤害+120%' },
      { id: 'fierce_sword', name: '逐日剑法', level: 20, mpCost: 25, damageMult: 3.0, cooldown: 8, desc: '剑气如虹，伤害+200%' },
      { id: 'berserk', name: '狂暴之力', level: 35, mpCost: 40, damageMult: 4.0, cooldown: 12, desc: '进入狂暴，伤害+300%' },
    ],
  },
  mage: {
    name: '法师', color: '#4488ff',
    baseHp: 80, baseMp: 100, baseAtk: 25, baseDef: 3,
    hpGrowth: 10, mpGrowth: 15, atkGrowth: 7, defGrowth: 2,
    skills: [
      { id: 'fireball', name: '火球术', level: 3, mpCost: 8, damageMult: 1.6, cooldown: 2, desc: '火焰之球，伤害+60%' },
      { id: 'ice_storm', name: '冰咆哮', level: 10, mpCost: 20, damageMult: 2.5, cooldown: 5, desc: '冰霜风暴，伤害+150%' },
      { id: 'lightning', name: '雷电术', level: 18, mpCost: 30, damageMult: 3.2, cooldown: 7, desc: '天雷降世，伤害+220%' },
      { id: 'meteor', name: '流星火雨', level: 30, mpCost: 50, damageMult: 4.5, cooldown: 10, desc: '天火降临，伤害+350%' },
    ],
  },
  taoist: {
    name: '道士', color: '#44cc44',
    baseHp: 110, baseMp: 70, baseAtk: 12, baseDef: 7,
    hpGrowth: 15, mpGrowth: 10, atkGrowth: 4, defGrowth: 3,
    skills: [
      { id: 'heal', name: '治愈术', level: 3, mpCost: 10, damageMult: 0, cooldown: 5, desc: '恢复30%最大HP', heal: true, healPct: 0.3 },
      { id: 'poison', name: '施毒术', level: 8, mpCost: 12, damageMult: 1.2, cooldown: 4, desc: '施毒造成伤害+20%并持续掉血', dot: true, dotDmg: 5, dotDur: 5 },
      { id: 'summon', name: '召唤神兽', level: 15, mpCost: 30, damageMult: 0, cooldown: 15, desc: '召唤神兽助战', summon: true },
      { id: 'soul_strike', name: '灵魂火符', level: 25, mpCost: 35, damageMult: 3.5, cooldown: 6, desc: '灵魂之火，伤害+250%' },
    ],
  },
};

const MONSTER_TEMPLATES = [
  { name: '鸡', level: 1, hp: 30, attack: 3, defense: 1, exp: 10, speed: 0.5, dropChance: 0.05 },
  { name: '鹿', level: 2, hp: 50, attack: 5, defense: 2, exp: 15, speed: 0.8, dropChance: 0.08 },
  { name: '稻草人', level: 3, hp: 80, attack: 8, defense: 3, exp: 25, speed: 0.4, dropChance: 0.12 },
  { name: '钉耙猫', level: 5, hp: 120, attack: 12, defense: 5, exp: 40, speed: 0.6, dropChance: 0.15 },
  { name: '半兽人', level: 8, hp: 200, attack: 18, defense: 8, exp: 65, speed: 0.5, dropChance: 0.2 },
  { name: '骷髅战士', level: 12, hp: 350, attack: 28, defense: 14, exp: 100, speed: 0.4, dropChance: 0.25 },
  { name: '蝎子', level: 15, hp: 500, attack: 38, defense: 18, exp: 150, speed: 0.6, dropChance: 0.3 },
  { name: '沃玛战士', level: 20, hp: 800, attack: 55, defense: 28, exp: 250, speed: 0.5, dropChance: 0.35 },
  { name: '祖玛卫士', level: 25, hp: 1200, attack: 75, defense: 38, exp: 400, speed: 0.4, dropChance: 0.4 },
  { name: '白野猪', level: 30, hp: 2000, attack: 100, defense: 50, exp: 650, speed: 0.5, dropChance: 0.5 },
  { name: '虹魔', level: 40, hp: 5000, attack: 150, defense: 80, exp: 1200, speed: 0.4, dropChance: 0.55 },
  { name: '赤月恶魔', level: 50, hp: 10000, attack: 220, defense: 120, exp: 2500, speed: 0.3, dropChance: 0.6 },
  { name: '赤月魔使', level: 55, hp: 15000, attack: 280, defense: 140, exp: 3500, speed: 0.3, dropChance: 0.65 },
  { name: '牛魔战士', level: 55, hp: 12000, attack: 250, defense: 130, exp: 3000, speed: 0.4, dropChance: 0.6 },
  { name: '牛魔将军', level: 60, hp: 18000, attack: 300, defense: 150, exp: 4000, speed: 0.3, dropChance: 0.65 },
  { name: '苍月魔将', level: 65, hp: 20000, attack: 320, defense: 160, exp: 4500, speed: 0.3, dropChance: 0.65 },
  { name: '沙巴克守卫', level: 70, hp: 25000, attack: 350, defense: 180, exp: 5000, speed: 0.3, dropChance: 0.7 },
  { name: '远古龙王', level: 75, hp: 30000, attack: 400, defense: 200, exp: 6000, speed: 0.3, dropChance: 0.7 },
  { name: '上古魔尊', level: 100, hp: 80000, attack: 700, defense: 350, exp: 15000, speed: 0.3, dropChance: 0.8 },
  // BOSS怪物（必掉装备，品质更高）
  { name: '👑沃玛教主', level: 25, hp: 5000, attack: 80, defense: 40, exp: 800, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '👑祖玛教主', level: 30, hp: 8000, attack: 120, defense: 60, exp: 1500, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '👑白野猪王', level: 35, hp: 3000, attack: 90, defense: 45, exp: 1000, speed: 0.4, dropChance: 1.0, isBoss: true },
  { name: '👑虹魔教主', level: 40, hp: 10000, attack: 180, defense: 90, exp: 2000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '👑赤月恶魔', level: 50, hp: 20000, attack: 300, defense: 150, exp: 5000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑赤月老祖', level: 55, hp: 25000, attack: 350, defense: 160, exp: 6000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑牛魔王', level: 60, hp: 30000, attack: 400, defense: 180, exp: 7000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑苍月魔王', level: 70, hp: 40000, attack: 500, defense: 220, exp: 10000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑沙巴克城主', level: 80, hp: 50000, attack: 600, defense: 280, exp: 12000, speed: 0.2, dropChance: 1.0, isBoss: true },
  // 生肖神殿BOSS（1层=50级，每层+10级）
  { name: '🐭生肖鼠神', level: 50, hp: 30000, attack: 400, defense: 150, exp: 8000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐮生肖牛神', level: 60, hp: 50000, attack: 500, defense: 200, exp: 12000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐯生肖虎神', level: 70, hp: 70000, attack: 600, defense: 250, exp: 18000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐰生肖兔神', level: 80, hp: 90000, attack: 700, defense: 300, exp: 25000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐲生肖龙神', level: 90, hp: 120000, attack: 800, defense: 350, exp: 35000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐍生肖蛇神', level: 100, hp: 150000, attack: 900, defense: 400, exp: 50000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐴生肖马神', level: 110, hp: 180000, attack: 1000, defense: 450, exp: 70000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐑生肖羊神', level: 120, hp: 220000, attack: 1100, defense: 500, exp: 100000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐵生肖猴神', level: 130, hp: 280000, attack: 1200, defense: 550, exp: 150000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐔生肖鸡神', level: 140, hp: 350000, attack: 1300, defense: 600, exp: 200000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐶生肖狗神', level: 150, hp: 420000, attack: 1400, defense: 650, exp: 300000, speed: 0.3, dropChance: 1.0, isBoss: true },
  { name: '🐷生肖猪神', level: 160, hp: 500000, attack: 1500, defense: 700, exp: 400000, speed: 0.3, dropChance: 1.0, isBoss: true },
  // 五行神殿BOSS
  { name: '⚔️金锐神将', level: 100, hp: 120000, attack: 1800, defense: 600, exp: 40000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '🌲木灵神将', level: 100, hp: 160000, attack: 1200, defense: 720, exp: 40000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '💧水渊神将', level: 100, hp: 140000, attack: 1400, defense: 640, exp: 40000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '🔥火狱神将', level: 100, hp: 100000, attack: 2000, defense: 480, exp: 40000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '🪨土岳神将', level: 100, hp: 180000, attack: 1120, defense: 880, exp: 40000, speed: 0.2, dropChance: 1.0, isBoss: true },
  // 天界（200级+）
  { name: '天界守卫', level: 200, hp: 600000, attack: 2000, defense: 900, exp: 500000, speed: 0.3, dropChance: 0.75 },
  { name: '天界战将', level: 220, hp: 800000, attack: 2500, defense: 1100, exp: 700000, speed: 0.3, dropChance: 0.8 },
  { name: '天界禁军', level: 240, hp: 1000000, attack: 3000, defense: 1300, exp: 1000000, speed: 0.3, dropChance: 0.85 },
  { name: '天界神官', level: 260, hp: 1200000, attack: 3500, defense: 1500, exp: 1500000, speed: 0.2, dropChance: 0.85 },
  { name: '神界使者', level: 280, hp: 1500000, attack: 4000, defense: 1700, exp: 2000000, speed: 0.2, dropChance: 0.9 },
  { name: '天道监察', level: 300, hp: 2000000, attack: 5000, defense: 2000, exp: 3000000, speed: 0.2, dropChance: 0.9 },
  // 天界BOSS
  { name: '👑天将·青龙', level: 200, hp: 800000, attack: 2200, defense: 1000, exp: 600000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑天将·白虎', level: 220, hp: 1000000, attack: 2800, defense: 1200, exp: 900000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑天将·朱雀', level: 240, hp: 1200000, attack: 3400, defense: 1400, exp: 1200000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑天将·玄武', level: 260, hp: 1500000, attack: 4000, defense: 1600, exp: 1500000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑天道神帝', level: 300, hp: 3000000, attack: 6000, defense: 2000, exp: 3000000, speed: 0.2, dropChance: 1.0, isBoss: true },
  // 混沌之渊（300级+）
  { name: '混沌兽', level: 300, hp: 2500000, attack: 5500, defense: 1800, exp: 4000000, speed: 0.3, dropChance: 0.9 },
  { name: '混沌魔影', level: 320, hp: 3000000, attack: 6500, defense: 2000, exp: 5500000, speed: 0.3, dropChance: 0.9 },
  { name: '混沌领主', level: 340, hp: 4000000, attack: 7500, defense: 2200, exp: 7000000, speed: 0.3, dropChance: 0.9 },
  { name: '混沌君王', level: 360, hp: 5000000, attack: 8500, defense: 2500, exp: 9000000, speed: 0.3, dropChance: 0.9 },
  { name: '混沌主宰', level: 380, hp: 6000000, attack: 9500, defense: 2800, exp: 12000000, speed: 0.2, dropChance: 0.9 },
  { name: '混沌之眼', level: 400, hp: 8000000, attack: 10000, defense: 3000, exp: 15000000, speed: 0.2, dropChance: 0.9 },
  // 混沌BOSS
  { name: '👑混沌魔神', level: 300, hp: 5000000, attack: 7000, defense: 2500, exp: 5000000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑混沌魔帝', level: 350, hp: 8000000, attack: 9000, defense: 3000, exp: 8000000, speed: 0.2, dropChance: 1.0, isBoss: true },
  { name: '👑混沌神主', level: 400, hp: 12000000, attack: 12000, defense: 3500, exp: 12000000, speed: 0.2, dropChance: 1.0, isBoss: true },
];

function createGameEngine(db, io) {
  const players = new Map();
  const monsters = new Map();
  const summons = new Map();
  let monsterIdCounter = 0;
  const monsterDots = new Map();
  const playerSkillCooldowns = new Map(); // socketId -> { skillId: remainingTime }

  function getEquipmentByLevel(level) {
    const eligible = EQUIPMENT_DB.filter(e => e.levelReq <= level);
    if (eligible.length === 0) return null;
    // Weighted random - prefer higher level items
    const weights = eligible.map(e => e.levelReq);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < eligible.length; i++) {
      r -= weights[i];
      if (r <= 0) return eligible[i];
    }
    return eligible[eligible.length - 1];
  }

  function rollEquipmentDrop(monsterLevel, mapId, isBoss = false) {
    // 不同地图掉落不同品质的装备
    const mapQualityPool = {
      bichon: ['common','common','common','uncommon'],           // 比奇城: 普通/优秀
      mengzhong: ['common','uncommon','uncommon','rare'],        // 盟重: 优秀/精良
      zombie_cave: ['uncommon','uncommon','rare','rare'],        // 僵尸洞: 精良
      woma_temple: ['uncommon','rare','rare','epic','legendary'], // 沃玛: 史诗/传说
      pig_cave: ['rare','rare','epic','epic','legendary'],       // 猪洞: 史诗/传说
      fengmo: ['rare','rare','epic','epic','legendary'],         // 封魔谷: 史诗/传说
      zumma: ['rare','epic','epic','legendary','legendary'],     // 祖玛阁: 传说
      redmoon: ['epic','epic','legendary','legendary'],          // 赤月峡谷: 传说
      bull: ['epic','epic','legendary','legendary'],             // 牛魔寺庙: 传说
      cangyue: ['epic','legendary','legendary','legendary'],     // 苍月岛: 传说
      shaba: ['legendary','legendary','legendary'],              // 沙巴克城: 传说
      dungeon_cave: ['uncommon','uncommon','rare','rare'],       // 矿洞副本: 精良
      dungeon_woma: ['uncommon','rare','rare','epic','legendary'], // 沃玛副本: 史诗/传说
      dungeon_zumma: ['rare','rare','epic','epic','legendary'],  // 祖玛副本: 史诗/传说
      zodiac_floor_1: ['legendary'], zodiac_floor_2: ['legendary'], zodiac_floor_3: ['legendary'],
      zodiac_floor_4: ['legendary'], zodiac_floor_5: ['legendary'], zodiac_floor_6: ['legendary'],
      zodiac_floor_7: ['legendary'], zodiac_floor_8: ['legendary'], zodiac_floor_9: ['legendary'],
      zodiac_floor_10: ['legendary'],
      wuxing_palace: ['legendary','legendary','legendary'],      // 五行神殿: 传说
      heaven: ['legendary','mythic','mythic'],                // 天界: 传说/神话
      abyss: ['mythic','mythic','divine'],                // 混沌之渊: 神话/仙器
    };
    // BOSS 使用更高品质池
    const bossQualityPool = {
      bichon: ['uncommon','uncommon','rare'],                    // 比奇城BOSS: 优秀/精良
      mengzhong: ['uncommon','rare','rare','epic'],              // 盟重BOSS: 精良/史诗
      zombie_cave: ['rare','rare','epic','legendary'],           // 僵尸洞BOSS: 史诗/传说
      woma_temple: ['rare','epic','epic','legendary'],           // 沃玛BOSS: 史诗/传说
      pig_cave: ['epic','epic','legendary','legendary'],         // 猪洞BOSS: 史诗/传说
      fengmo: ['epic','epic','legendary','legendary'],           // 封魔谷BOSS: 史诗/传说
      zumma: ['epic','legendary','legendary','legendary'],       // 祖玛阁BOSS: 传说
      redmoon: ['legendary','legendary','legendary'],            // 赤月峡谷BOSS: 传说
      bull: ['legendary','legendary','legendary'],               // 牛魔寺庙BOSS: 传说
      cangyue: ['legendary','legendary','legendary'],            // 苍月岛BOSS: 传说
      shaba: ['legendary','legendary','legendary'],              // 沙巴克城BOSS: 传说
      dungeon_cave: ['rare','rare','epic','legendary'],          // 矿洞副本BOSS: 史诗/传说
      dungeon_woma: ['rare','epic','epic','legendary'],          // 沃玛副本BOSS: 史诗/传说
      dungeon_zumma: ['epic','epic','legendary','legendary'],    // 祖玛副本BOSS: 史诗/传说
      zodiac_floor_1: ['legendary'], zodiac_floor_2: ['legendary'], zodiac_floor_3: ['legendary'],
      zodiac_floor_4: ['legendary'], zodiac_floor_5: ['legendary'], zodiac_floor_6: ['legendary'],
      zodiac_floor_7: ['legendary'], zodiac_floor_8: ['legendary'], zodiac_floor_9: ['legendary'],
      zodiac_floor_10: ['legendary'],
      wuxing_palace: ['legendary','legendary','legendary'],      // 五行神殿BOSS: 传说
      heaven: ['mythic','mythic','mythic','divine'],        // 天界BOSS: 神话/仙器
      abyss: ['mythic','divine','divine','divine'],        // 混沌之渊BOSS: 神话/仙器
    };
    const pool = isBoss
      ? (bossQualityPool[mapId] || ['uncommon','rare','rare'])
      : (mapQualityPool[mapId] || ['common','common','uncommon']);
    // 根据怪物等级提升品质上限
    const maxTier = Math.min(Math.floor(monsterLevel / 10), pool.length - 1);
    const quality = pool[Math.floor(Math.random() * (maxTier + 1))];
    let items = EQUIPMENT_DB.filter(e => e.quality === quality);
    // 生肖神殿每层只掉落对应阶的装备
    if (mapId?.startsWith('zodiac_floor_')) {
      const tier = parseInt(mapId.split('_').pop()) - 1;
      items = items.filter(e => e.id.startsWith('zodiac_') && e.id.endsWith(`_${tier}`));
    }
    // 五行神殿只掉落五行装备
    if (mapId === 'wuxing_palace') {
      items = items.filter(e => e.id.startsWith('wuxing_'));
    } else {
      // 其他地图不掉落五行装备
      items = items.filter(e => !e.id.startsWith('wuxing_'));
    }
    // 过滤掉等级要求超过怪物等级太多的装备（最多高20级）
    items = items.filter(e => e.levelReq <= monsterLevel + 20);
    if (items.length === 0) items = EQUIPMENT_DB.filter(e => e.quality === quality);
    if (items.length === 0) {
      // 动态生成装备
      const slots = ['weapon','armor','helmet','necklace','bracelet','ring','belt','shoes'];
      const slot = slots[Math.floor(Math.random() * slots.length)];
      const qMult = QUALITY_MULT[quality] || 1;
      const levelScale = monsterLevel / 100;
      const prefix = DYN_EQUIP_PREFIXES[quality] || '神秘';
      const suffix = DYN_EQUIP_SUFFIXES[Math.floor(Math.random() * DYN_EQUIP_SUFFIXES.length)];
      const slotName = DYN_SLOT_NAMES[slot] || '物';
      return {
        id: `dyn_${quality}_${slot}_${Date.now()}`,
        name: `${prefix}${slotName}${suffix}`,
        slot, quality, levelReq: Math.max(1, monsterLevel - 20),
        attack: Math.floor(500 * qMult * levelScale),
        defense: Math.floor(400 * qMult * levelScale),
        hp: Math.floor(2000 * qMult * levelScale),
        mp: Math.floor(500 * qMult * levelScale),
      };
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  function spawnMonsters(mapId, count) {
    // 根据地图选择怪物类型
    const mapMonsterIndices = {
      bichon: [0, 1, 2],           // 鸡、鹿、稻草人 (低级)
      mengzhong: [3, 4, 5, 6],      // 钉耙猫、半兽人、骷髅、蝎子 (中级)
      zombie_cave: [5, 6, 7, 8, 19],    // 骷髅、蝎子、沃玛、祖玛+沃玛教主BOSS
      woma_temple: [7, 8, 9, 20],  // 沃玛战士+祖玛教主BOSS
      pig_cave: [8, 9, 10, 21],    // 祖玛、白猪+白猪王BOSS
      fengmo: [10, 11, 22],        // 虹魔、赤月恶魔+虹魔教主BOSS
      zumma: [11, 12, 17, 18, 23], // 赤月恶魔、赤月魔使、远古龙王、上古魔尊+赤月恶魔BOSS
      redmoon: [11, 12, 24],       // 赤月恶魔、赤月魔使+赤月老祖BOSS
      bull: [13, 14, 25],          // 牛魔战士、牛魔将军+牛魔王BOSS
      cangyue: [15, 16, 26],       // 苍月魔将、沙巴克守卫+苍月魔王BOSS
      shaba: [16, 17, 27],         // 沙巴克守卫、远古龙王+沙巴克城主BOSS
      zodiac_floor_1: [28], zodiac_floor_2: [29], zodiac_floor_3: [30], zodiac_floor_4: [31],
      zodiac_floor_5: [32], zodiac_floor_6: [33], zodiac_floor_7: [34], zodiac_floor_8: [35],
      zodiac_floor_9: [36], zodiac_floor_10: [37],
      wuxing_palace: [40,41,42,43,44], // 五行BOSS
      heaven: [45,46,47,48],          // 天界怪物
      abyss: [57,58,59,60,61],        // 混沌之渊怪物
    };
    const indices = mapMonsterIndices[mapId] || [];
    for (let i = 0; i < count; i++) {
      const id = `m_${++monsterIdCounter}`;
      if (indices.length === 0) {
        // 未知地图：使用最高级模板动态生成
        const baseTmpl = MONSTER_TEMPLATES[MONSTER_TEMPLATES.length - 1];
        const level = baseTmpl.level + Math.floor(Math.random() * 20);
        const scale = 1 + (level * 0.1);
        const prefix = MONSTER_PREFIXES[Math.floor(Math.random() * MONSTER_PREFIXES.length)];
        const suffix = MONSTER_SUFFIXES[Math.floor(Math.random() * MONSTER_SUFFIXES.length)];
        monsters.set(id, {
          id, name: `${prefix}${baseTmpl.name}${suffix}`, level,
          hp: Math.floor(baseTmpl.hp * scale), maxHp: Math.floor(baseTmpl.hp * scale),
          attack: Math.floor(baseTmpl.attack * scale), defense: Math.floor(baseTmpl.defense * scale),
          exp: Math.floor(baseTmpl.exp * scale * 2),
          x: 2 + Math.random() * ((MAPS[mapId]?.width || 80) - 4), y: 2 + Math.random() * ((MAPS[mapId]?.height || 60) - 4),
          speed: baseTmpl.speed, mapId, isBoss: Math.random() < 0.05,
          targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
          dropChance: Math.min(baseTmpl.dropChance + 0.1, 1.0),
        });
      } else {
        const idx = indices[Math.floor(Math.random() * indices.length)];
        const template = MONSTER_TEMPLATES[idx];
        const scale = 1 + (template.level * 0.1);
        monsters.set(id, {
          id, name: template.name, level: template.level,
          hp: Math.floor(template.hp * scale), maxHp: Math.floor(template.hp * scale),
          attack: Math.floor(template.attack * scale), defense: Math.floor(template.defense * scale),
          exp: Math.floor(template.exp * scale),
          x: 2 + Math.random() * ((MAPS[mapId]?.width || 80) - 4), y: 2 + Math.random() * ((MAPS[mapId]?.height || 60) - 4),
          speed: template.speed, mapId, isBoss: template.isBoss || false,
          targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
          dropChance: template.dropChance,
        });
      }
    }
  }

  // 为每张地图生成怪物（跳过副本地图，副本怪物由 enterDungeon 生成）
  Object.keys(MAPS).filter(mapId => !mapId.startsWith('dungeon_')).forEach(mapId => spawnMonsters(mapId, 40));

  function calcEquipStats(player) {
    let bonusAtk = 0, bonusDef = 0, bonusHp = 0, bonusMp = 0, bonusLucky = 0;
    // 经脉加成
    const mer = player.meridians || {};
    for (const [key, val] of Object.entries(MERIDIANS)) {
      const opened = mer[key] || 0;
      if (opened > 0) {
        if (val.attr === 'hp') bonusHp += opened * val.valuePer;
        else if (val.attr === 'attack') bonusAtk += opened * val.valuePer;
        else if (val.attr === 'defense') bonusDef += opened * val.valuePer;
        else if (val.attr === 'mp') bonusMp += opened * val.valuePer;
      }
    }
    // 坐骑和翅膀加成
    if (player.mount) {
      bonusHp += player.mount.hp || 0;
      bonusAtk += player.mount.attack || 0;
      bonusDef += player.mount.defense || 0;
    }
    if (player.wings) {
      bonusHp += player.wings.hp || 0;
      bonusAtk += player.wings.attack || 0;
      bonusDef += player.wings.defense || 0;
    }

    // 套装加成
  const equippedIds = new Set();
  for (const slot of EQUIPMENT_SLOTS) {
    const item = player.equipment?.[slot];
    if (item) equippedIds.add(item.id);
  }
  // 检查所有套装
  const activeSets = [];
  const allSets = { ...EQUIPMENT_SETS, ...ZODIAC_SETS, ...WUXING_SETS };
  for (const [setId, set] of Object.entries(allSets)) {
    const hasAll = set.pieces.every(id => equippedIds.has(id));
    if (hasAll) {
      bonusAtk += set.bonus.attack || 0;
      bonusDef += set.bonus.defense || 0;
      bonusHp += set.bonus.hp || 0;
      bonusMp += set.bonus.mp || 0;
      activeSets.push(setId);
    }
  }
  // 生肖套装：12个槽位都有装备时，按最低阶激活
  const zodiacSlots = ['zodiac_鼠','zodiac_牛','zodiac_虎','zodiac_兔','zodiac_龙','zodiac_蛇','zodiac_马','zodiac_羊','zodiac_猴','zodiac_鸡','zodiac_狗','zodiac_猪'];
  const equippedTiers = [];
  for (const slot of zodiacSlots) {
    const item = player.equipment?.[slot];
    if (!item) { equippedTiers.length = 0; break; }
    const m = item.id.match(/^zodiac_([一-鿿]+)_(\d+)$/);
    if (m) equippedTiers.push(parseInt(m[2]));
  }
  if (equippedTiers.length === 12) {
    const minTier = Math.min(...equippedTiers);
    const zodiacSet = ZODIAC_SETS[`zodiac_tier_${minTier}`];
    if (zodiacSet) {
      bonusAtk += zodiacSet.bonus.attack || 0;
      bonusDef += zodiacSet.bonus.defense || 0;
      bonusHp += zodiacSet.bonus.hp || 0;
      bonusMp += zodiacSet.bonus.mp || 0;
      activeSets.push(`zodiac_tier_${minTier}`);
    }
  }

  for (const slot of EQUIPMENT_SLOTS) {
      const item = player.equipment?.[slot];
      if (!item) continue;
      bonusAtk += item.attack || 0;
      bonusDef += item.defense || 0;
      bonusHp += item.hp || 0;
      bonusMp += item.mp || 0;
      bonusLucky += item.lucky || 0;
      // 强化百分比加成
      const eLvl = item.enhanceLevel || 0;
      if (eLvl > 0) {
        const pct = ENHANCE_BONUS_PCT(eLvl);
        bonusAtk += Math.floor((item.attack || 0) * pct);
        bonusDef += Math.floor((item.defense || 0) * pct);
        bonusHp += Math.floor((item.hp || 0) * pct);
      }
      // 宝石加成
      if (item.gems?.length) {
        for (const gem of item.gems) {
          bonusAtk += gem.attack || 0;
          bonusDef += gem.defense || 0;
          bonusHp += gem.hp || 0;
          bonusMp += gem.mp || 0;
        }
      }
    }
    return { bonusAtk, bonusDef, bonusHp, bonusMp, bonusLucky };
  }

  function recalcStats(player) {
    const cls = CLASSES[player.class];
    const baseMaxHp = cls.baseHp + (player.level - 1) * (cls.hpGrowth + player.level);
    const baseMaxMp = cls.baseMp + (player.level - 1) * (cls.mpGrowth + Math.floor(player.level * 0.5));
    const baseAtk = cls.baseAtk + (player.level - 1) * (cls.atkGrowth + Math.floor(player.level * 0.3));
    const baseDef = cls.baseDef + (player.level - 1) * (cls.defGrowth + Math.floor(player.level * 0.2));
    const bonus = calcEquipStats(player);

    const oldRatio = player.hp / player.max_hp;
    player.max_hp = baseMaxHp + bonus.bonusHp;
    player.max_mp = baseMaxMp + bonus.bonusMp;
    player.attack = baseAtk + bonus.bonusAtk;
    player.defense = baseDef + bonus.bonusDef;
    player.lucky = bonus.bonusLucky || 0;
    player.hp = Math.min(player.max_hp, Math.floor(oldRatio * player.max_hp));
    if (player.hp <= 0) player.hp = player.max_hp;
  }

  function equipItem(player, item) {
    // 生肖装备有独立槽位，不占用默认装备栏
    if (item.id.startsWith('zodiac_')) {
      const match = item.id.match(/^zodiac_([鼠牛虎兔龙蛇马羊猴鸡狗猪])_/);
      if (match) {
        const slot = `zodiac_${match[1]}`;
        if (!player.equipment) player.equipment = {};
        const existing = player.equipment[slot];
        if (existing) {
          if (!player.inventory) player.inventory = [];
          player.inventory.push(existing);
        }
        player.equipment[slot] = item;
        recalcStats(player);
        return;
      }
    }
    // 五行装备有独立槽位，不占用默认装备栏
    if (item.id.startsWith('wuxing_')) {
      const match = item.id.match(/^wuxing_([a-z]+)_(weapon|armor|necklace|ring)/);
      if (match) {
        const el = match[1];
        const partSlot = item.slot;
        const slotName = partSlot === 'weapon' ? '神锋' : partSlot === 'armor' ? '神铠' : partSlot === 'necklace' ? '神链' : '神戒';
        const cn = { metal:'金锐', wood:'木灵', water:'水渊', fire:'火狱', earth:'土岳' }[el];
        const slot = `wuxing_${cn}_${slotName}`;
        if (!player.equipment) player.equipment = {};
        const existing = player.equipment[slot];
        if (existing) {
          if (!player.inventory) player.inventory = [];
          player.inventory.push(existing);
        }
        player.equipment[slot] = item;
        recalcStats(player);
        return;
      }
    }

    // 确保物品有 slot 属性
    if (!item.slot && item.type) {
      const typeToSlot = {weapon:'weapon',armor:'armor',jewelry:'necklace',belt:'belt',shoes:'shoes'};
      item.slot = typeToSlot[item.type] || 'necklace';
    }
    if (!item.slot) item.slot = 'necklace'; // 默认

    // 手镯和戒指优先占空位，都满时交换评分较低的那个
    let slot = item.slot;
    if (slot === 'bracelet' || slot === 'bracelet1' || slot === 'bracelet2') {
      const has1 = player.equipment?.bracelet1;
      const has2 = player.equipment?.bracelet2;
      slot = !has1 ? 'bracelet1' : !has2 ? 'bracelet2' : slotForItem(player, item, 'bracelet1', 'bracelet2');
      item.slot = slot;
    } else if (slot === 'ring' || slot === 'ring1' || slot === 'ring2') {
      const has1 = player.equipment?.ring1;
      const has2 = player.equipment?.ring2;
      slot = !has1 ? 'ring1' : !has2 ? 'ring2' : slotForItem(player, item, 'ring1', 'ring2');
      item.slot = slot;
      console.log('[ring equip] slot determined:', slot, 'ring1:', player.equipment?.ring1?.name, 'ring2:', player.equipment?.ring2?.name);
    }

    const existing = player.equipment?.[slot];
    if (existing) {
      // Swap: return old item to inventory
      if (!player.inventory) player.inventory = [];
      player.inventory.push(existing);
    }
    if (!player.equipment) player.equipment = {};
    player.equipment[slot] = item;
    recalcStats(player);
  }

  function itemScore(item) {
    return (item?.attack||0) * 3 + (item?.defense||0) * 2 + (item?.hp||0) + (item?.mp||0);
  }

  function slotForItem(player, newItem, slot1, slot2) {
    const s1 = itemScore(player.equipment?.[slot1]);
    const s2 = itemScore(player.equipment?.[slot2]);
    const newS = itemScore(newItem);
    // 新物品评分更高时，替换评分较低的那个
    if (newS > s1 && newS > s2) return s1 <= s2 ? slot1 : slot2;
    // 否则保持现状，返回评分较低的槽位
    return s1 <= s2 ? slot1 : slot2;
  }

  function unequipItem(player, slot) {
    if (!player.equipment?.[slot]) return null;
    const item = player.equipment[slot];
    delete player.equipment[slot];
    if (!player.inventory) player.inventory = [];
    player.inventory.push(item);
    recalcStats(player);
    return item;
  }

  function registerPlayer(socketId, username, playerClass = 'warrior') {
    // 删除旧的同名玩家（避免多个玩家对象导致数据不同步）
    for (const [sid, p] of players) {
      if (p.username === username) {
        players.delete(sid);
      }
    }

    const row = db.exec(`SELECT * FROM players WHERE username = '${username}'`);

    if (row.length > 0 && row[0].columns.length > 0) {
      const cols = row[0].columns;
      const vals = row[0].values[0];
      const player = {};
      cols.forEach((c, i) => { player[c] = vals[i]; });
      player.hp = player.max_hp;
      player.mp = player.max_mp;
      player.socketId = socketId;
      player.skills = JSON.parse(player.skills || '[]');
      player.equipment = JSON.parse(player.equipment || '{}');
      player.inventory = JSON.parse(player.inventory || '[]');
      player.quest_state = JSON.parse(player.quest_state || '{}');
      player.storage = JSON.parse(player.storage || '[]');
      player.cultivationRealm = player.cultivation_realm || 0;
      player.cultivationStage = player.cultivation_stage || 1;
      players.set(socketId, player);
      recalcStats(player);
      savePlayer(player);
      return player;
    }

    const cls = CLASSES[playerClass];
    const id = uuidv4();
    const player = {
      id, username, socketId, class: playerClass,
      x: 50, y: 50,
      level: 1, exp: 0,
      hp: cls.baseHp, max_hp: cls.baseHp,
      mp: cls.baseMp, max_mp: cls.baseMp,
      attack: cls.baseAtk, defense: cls.baseDef,
      gold: 0,
      map_id: 'bichon',
      skills: [],
      equipment: {},
      inventory: [],
      attackCooldown: 0,
    };

    const emptyObj = '{}', emptyArr = '[]';
    db.run(`INSERT INTO players (id, username, class, x, y, level, exp, hp, max_hp, mp, max_mp, attack, defense, gold, map_id, skills, equipment, inventory)
      VALUES ('${id}', '${username}', '${playerClass}', 50, 50, 1, 0, ${player.hp}, ${player.max_hp}, ${player.mp}, ${player.max_mp}, ${player.attack}, ${player.defense}, 0, 'bichon', '${emptyArr}', '${emptyObj}', '${emptyArr}')`);
    saveDB(db);

    players.set(socketId, player);
    return player;
  }

  function savePlayer(player) {
    const skillsJson = JSON.stringify(player.skills || []);
    const equipJson = JSON.stringify(player.equipment || {});
    const invJson = JSON.stringify(player.inventory || []);
    const questJson = JSON.stringify(player.quest_state || {});
    const storageJson = JSON.stringify(player.storage || []);
    db.run(`UPDATE players SET x=${player.x}, y=${player.y}, level=${player.level},
      exp=${player.exp}, hp=${player.hp}, max_hp=${player.max_hp},
      mp=${player.mp}, max_mp=${player.max_mp}, attack=${player.attack},
      defense=${player.defense}, gold=${player.gold}, class='${player.class}',
      title='${player.title || ''}',
      skills='${skillsJson}', equipment='${equipJson}', inventory='${invJson}',
      quest_state='${questJson}', storage='${storageJson}',
      cultivation_realm=${player.cultivationRealm || 0}, cultivation_stage=${player.cultivationStage || 1},
      last_save=CURRENT_TIMESTAMP WHERE id='${player.id}'`);
    saveDB(db);
  }

  function movePlayer(socketId, x, y) {
    const p = players.get(socketId);
    if (!p) return;
    p.x = Math.max(0, Math.min(100, x));
    p.y = Math.max(0, Math.min(80, y));
  }

  function useSkill(socketId, monsterId, skillId) {
    const p = players.get(socketId);
    if (!p) return null;
    const cls = CLASSES[p.class];
    if (!cls) return { error: 'class_not_found' };
    const skill = cls.skills.find(s => s.id === skillId);
    if (!skill) return { error: 'skill_not_found' };
    if (p.level < skill.level) return { error: 'level_too_low' };
    if (p.mp < skill.mpCost) return { error: 'not_enough_mp' };

    // 无尽副本技能路由到无尽副本攻击逻辑
    if (monsterId) {
      const m = monsters.get(monsterId);
      if (m && m.mapId && m.mapId.startsWith('endless_')) {
        return attackEndlessMonster(socketId, monsterId, skillId);
      }
    }

    // 检查冷却
    if (!p.skillCooldowns) p.skillCooldowns = {};
    if (p.skillCooldowns[skillId] && Date.now() < p.skillCooldowns[skillId]) {
      return { error: 'on_cooldown', remaining: p.skillCooldowns[skillId] - Date.now() };
    }
    p.mp -= skill.mpCost;
    p.skillCooldowns[skillId] = Date.now() + skill.cooldown * 1000;

    // 治愈术
    if (skill.heal) {
      const healAmt = Math.floor(p.max_hp * skill.healPct);
      p.hp = Math.min(p.max_hp, p.hp + healAmt);
      return { skillUsed: true, skillId, heal: healAmt, hp: p.hp, max_hp: p.max_hp, mp: p.mp, max_mp: p.max_mp, cooldown: skill.cooldown * 1000 };
    }

    // 召唤
    if (skill.summon) {
      const summonId = `sum_${p.id}_${Date.now()}`;
      monsters.set(summonId, {
        id: summonId, name: '骷髅战士', level: p.level,
        hp: 200 + p.level * 20, maxHp: 200 + p.level * 20,
        attack: 20 + p.level * 5, defense: Math.floor(p.defense * 0.5),
        x: p.x + (Math.random() - 0.5) * 3, y: p.y + (Math.random() - 0.5) * 3,
        speed: 0.8, mapId: p.map_id, isBoss: false, isSummon: true, ownerId: p.id,
        targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
        dropChance: 0, expireTime: Date.now() + skill.summonDuration,
      });
      return { skillUsed: true, skillId, summon: true, cooldown: skill.cooldown * 1000, mp: p.mp, max_mp: p.max_mp };
    }

    // 攻击技能
    if (!monsterId) return { error: 'no_target' };
    const m = monsters.get(monsterId);
    if (!m || m.mapId !== p.map_id) return { error: 'target_not_found' };

    let damage;
    if (skill.damageMult) {
      damage = Math.floor(p.attack * skill.damageMult) - Math.floor(m.defense * 0.5);
    } else {
      damage = Math.max(1, p.attack - Math.floor(m.defense * 0.5));
    }

    // AOE技能：攻击附近所有怪物
    if (skill.aoe) {
      let hitCount = 0;
      let totalDamage = 0;
      for (const [, other] of monsters) {
        if (other.mapId !== p.map_id || other.isSummon) continue;
        const dist = Math.sqrt((other.x - p.x) ** 2 + (other.y - p.y) ** 2);
        if (dist < 5) {
          const dmg = Math.max(1, damage - other.defense);
          other.hp -= dmg;
          totalDamage += dmg;
          hitCount++;
          if (other.hp <= 0) {
            killMonster(other, p);
          }
        }
      }
      return { skillUsed: true, skillId, aoe: true, hitCount, totalDamage, cooldown: skill.cooldown * 1000, mp: p.mp, max_mp: p.max_mp };
    }

    // DOT技能（中毒/火墙）
    if (skill.dot) {
      m.dot = { skillId, damage: Math.floor(p.attack * 0.3), duration: skill.dotDuration, startTime: Date.now() };
      if (skill.defenseReduce) {
        m.defenseDebuff = Math.floor(m.defense * skill.defenseReduce);
      }
    }

    const effectiveDef = m.defense - (m.defenseDebuff || 0);
    damage = Math.max(1, damage - Math.floor(effectiveDef * 0.5));
    m.hp -= damage;
    if (m.hp <= 0) {
      killMonster(m, p);
    }

    return {
      skillUsed: true, skillId, damage, monsterName: m.name, killed: m.hp <= 0,
      cooldown: skill.cooldown * 1000, mp: p.mp, max_mp: p.max_mp,
      dot: skill.dot ? { duration: skill.dotDuration } : null,
    };
  }

  function killMonster(m, p) {
    const oldLevel = p.level;
    p.exp += m.exp;
    p.gold += Math.floor(m.level * 2 + Math.random() * 10);
    const leveledUp = checkLevelUp(p);
    checkNewSkills(p);

    let drop = null;
    if (Math.random() < m.dropChance) {
      drop = rollEquipmentDrop(m.level, m.mapId, m.isBoss);
      if (drop) {
        if (!p.inventory) p.inventory = [];
        p.inventory.push({ ...drop, enhanceLevel: 0, gems: [] });
      }
    }

    monsters.delete(m.id);
    monsterDots.delete(m.id);
    savePlayer(p);
    return { leveledUp, exp: m.exp, gold: Math.floor(m.level * 2 + Math.random() * 10), drop };
  }

  function attackMonster(socketId, monsterId, skillId = null) {
    const p = players.get(socketId);
    const m = monsters.get(monsterId);
    if (!p || !m) return null;

    // 无尽副本怪物路由到无尽副本攻击逻辑
    if (m.mapId && m.mapId.startsWith('endless_')) {
      return attackEndlessMonster(socketId, monsterId, skillId);
    }

    let damageMult = 1;
    if (skillId) {
      const cls = CLASSES[p.class];
      const skill = cls.skills.find(s => s.id === skillId);
      if (skill && p.skills.includes(skillId)) {
        const cooldowns = playerSkillCooldowns.get(socketId) || {};
        if (cooldowns[skillId] > 0) return { error: 'skill_on_cooldown', cooldown: Math.ceil(cooldowns[skillId]) };
        if (p.mp < skill.mpCost) return { error: 'not_enough_mp' };
        p.mp -= skill.mpCost;
        damageMult = skill.damageMult;
        cooldowns[skillId] = skill.cooldown || 3;
        playerSkillCooldowns.set(socketId, cooldowns);
        if (skill.heal) {
          const healAmt = Math.floor(p.max_hp * skill.healPct);
          p.hp = Math.min(p.max_hp, p.hp + healAmt);
        }
      }
    }

    const damage = Math.max(1, Math.floor((p.attack - m.defense + Math.floor(Math.random() * 5)) * damageMult));
    m.hp -= damage;

    if (skillId) {
      const cls = CLASSES[p.class];
      const skill = cls.skills.find(s => s.id === skillId);
      if (skill && skill.dot) monsterDots.set(monsterId, { dmg: skill.dotDmg, turns: skill.dotDur });
    }

    if (m.hp <= 0) {
      // 世界BOSS特殊处理
      if (m.isWorldBoss) {
        onWorldBossDefeated(m, p);
        const leveledUp = checkLevelUp(p);
        const newSkills = checkNewSkills(p);
        const goldReward = m.goldMin + Math.floor(Math.random() * (m.goldMax - m.goldMin));
        p.gold += goldReward;
        // 世界BOSS必掉高品质装备
        let drop = null;
        const pool = m.qualityPool || ['epic', 'legendary'];
        const quality = pool[Math.floor(Math.random() * pool.length)];
        const items = EQUIPMENT_DB.filter(e => e.quality === quality);
        if (items.length > 0) {
          drop = items[Math.floor(Math.random() * items.length)];
          if (!p.inventory) p.inventory = [];
          p.inventory.push({ ...drop, enhanceLevel: 0, gems: [] });
        }
        savePlayer(p);
        return { damage, killed: true, monsterId, leveledUp, newSkills, exp: m.exp, gold: goldReward, skillId, drop, isWorldBoss: true };
      }

      const killResult = killMonster(m, p);
      const newSkills = checkNewSkills(p);

      setTimeout(() => {
        const id = `m_${++monsterIdCounter}`;
        const levelIdx = Math.min(Math.floor(p.level / 6), MONSTER_TEMPLATES.length - 1);
        const tmpl = MONSTER_TEMPLATES[levelIdx];
        const scale = 1 + Math.log2(p.level + 1);
        const isDynamic = p.level > 300 || levelIdx >= MONSTER_TEMPLATES.length - 1;
        require('fs').appendFileSync('/tmp/respawn_debug.log', `RESPAWN: p.level=${p.level} levelIdx=${levelIdx} tmpl=${tmpl.name} isDynamic=${isDynamic}\n`);
        const prefix = isDynamic ? MONSTER_PREFIXES[Math.floor(Math.random() * MONSTER_PREFIXES.length)] + ' ' : '';
        const suffix = isDynamic ? MONSTER_SUFFIXES[Math.floor(Math.random() * MONSTER_SUFFIXES.length)] : '';
        const level = isDynamic ? p.level + Math.floor(Math.random() * 20) : tmpl.level + Math.floor(p.level * 0.2);
        monsters.set(id, {
          id, name: `${prefix}${tmpl.name}${suffix}`, level,
          hp: Math.floor(tmpl.hp * scale), maxHp: Math.floor(tmpl.hp * scale),
          attack: Math.floor(tmpl.attack * scale), defense: Math.floor(tmpl.defense * scale),
          exp: Math.floor(tmpl.exp * scale * (isDynamic ? 2 : 1)),
          x: 2 + Math.random() * ((MAPS[m.mapId]?.width || 80) - 4), y: 2 + Math.random() * ((MAPS[m.mapId]?.height || 60) - 4),
          speed: tmpl.speed, mapId: m.mapId, isBoss: tmpl.isBoss || false,
          targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
          dropChance: tmpl.dropChance,
        });
      }, 500);

      return { damage, killed: true, monsterId, leveledUp: killResult.leveledUp, newSkills, exp: killResult.exp, gold: killResult.gold, skillId, drop: killResult.drop };
    }

    return { damage, killed: false, monsterHp: m.hp, skillId };
  }

  function checkNewSkills(player) {
    const cls = CLASSES[player.class];
    const newSkills = [];
    for (const skill of cls.skills) {
      if (player.level >= skill.level && !player.skills.includes(skill.id)) {
        player.skills.push(skill.id);
        newSkills.push(skill.name);
      }
    }
    return newSkills;
  }

  function checkLevelUp(player) {
    let leveledUp = false;
    while (true) {
      const expNeeded = Math.floor(100 * Math.pow(player.level, 1.5));
      if (player.exp < expNeeded) break;
      player.exp -= expNeeded;
      player.level++;
      const cls = CLASSES[player.class];
      player.max_hp += cls.hpGrowth + player.level;
      player.max_mp += cls.mpGrowth + Math.floor(player.level * 0.5);
      player.attack += cls.atkGrowth + Math.floor(player.level * 0.3);
      player.defense += cls.defGrowth + Math.floor(player.level * 0.2);
      player.hp = player.max_hp;
      player.mp = player.max_mp;
      checkNewSkills(player);
      leveledUp = true;
    }
    return leveledUp;
  }

  function updateMonsters(dt) {
    // 更新技能冷却
    for (const [sid, cooldowns] of playerSkillCooldowns) {
      for (const skillId in cooldowns) {
        cooldowns[skillId] -= dt;
        if (cooldowns[skillId] <= 0) delete cooldowns[skillId];
      }
      if (Object.keys(cooldowns).length === 0) playerSkillCooldowns.delete(sid);
    }

    for (const [mId, dot] of monsterDots) {
      const m = monsters.get(mId);
      if (m) {
        m.hp -= dot.dmg * dt;
        dot.turns -= dt;
        if (dot.turns <= 0) monsterDots.delete(mId);
        if (m.hp <= 0) { monsters.delete(mId); return { monsterDotKill: true, monsterId: mId }; }
      }
    }

    for (const [id, m] of monsters) {
      m.moveTimer += dt; m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      const mapDef = MAPS[m.mapId] || MAPS.bichon;

      // 寻找最近的同地图玩家
      let nearestPlayer = null;
      let nearestDist = Infinity;
      for (const [_, p] of players) {
        if (p.map_id !== m.mapId) continue;
        const dist = Math.sqrt((p.x - m.x) ** 2 + (p.y - m.y) ** 2);
        if (dist < nearestDist) { nearestDist = dist; nearestPlayer = p; }
      }

      // 攻击范围内的玩家
      if (nearestPlayer && nearestDist < 2 && m.attackCooldown <= 0) {
        m.attackCooldown = 1.5;
        const dmg = Math.max(1, m.attack - nearestPlayer.defense + Math.floor(Math.random() * 3));
        nearestPlayer.hp -= dmg;
        if (nearestPlayer.hp <= 0) {
          nearestPlayer.hp = nearestPlayer.max_hp;
          nearestPlayer.x = 50; nearestPlayer.y = 50;
          return { playerDied: true, socketId: nearestPlayer.socketId };
        }
        return { monsterAttack: true, socketId: nearestPlayer.socketId, monsterId: id, damage: dmg };
      }

      // 追击玩家或随机巡逻
      if (m.moveTimer > 2) {
        m.moveTimer = 0;
        if (nearestPlayer && nearestDist < 15) {
          m.targetX = nearestPlayer.x;
          m.targetY = nearestPlayer.y;
        } else {
          m.targetX = Math.max(5, Math.min(mapDef.width - 5, m.x + (Math.random() - 0.5) * 10));
          m.targetY = Math.max(5, Math.min(mapDef.height - 5, m.y + (Math.random() - 0.5) * 10));
        }
      }

      if (m.targetX !== null) {
        const dx = m.targetX - m.x, dy = m.targetY - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0.5) { m.x += (dx / dist) * m.speed * dt; m.y += (dy / dist) * m.speed * dt; }
        // 边界限制
        m.x = Math.max(2, Math.min(mapDef.width - 2, m.x));
        m.y = Math.max(2, Math.min(mapDef.height - 2, m.y));
      }
    }

    for (const [sid, s] of summons) {
      s.moveTimer += dt; s.attackCooldown = Math.max(0, s.attackCooldown - dt);
      const owner = [...players.values()].find(p => p.id === s.ownerId);
      if (owner) {
        const dx = owner.x - s.x, dy = owner.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 3) { s.x += (dx / dist) * s.speed * dt; s.y += (dy / dist) * s.speed * dt; }
        if (s.attackCooldown <= 0) {
          for (const [mid, m] of monsters) {
            const md = Math.sqrt((m.x - s.x) ** 2 + (m.y - s.y) ** 2);
            if (md < 3) { s.attackCooldown = 1; m.hp -= Math.floor(s.attack); if (m.hp <= 0) monsters.delete(mid); break; }
          }
        }
      }
    }

    // PK值随时间减少
    for (const [, p] of players) {
      if (p.pkPoints > 0) {
        const reduceTime = (p.pkReduceTime || 0);
        if (Date.now() - reduceTime > PK_REDUCE_INTERVAL * 1000) {
          p.pkPoints = Math.max(0, p.pkPoints - 1);
          p.pkReduceTime = Date.now();
          savePlayer(p);
        }
      }
    }
    return null;
  }

  function getMonsters() {
    // 返回所有地图的怪物，客户端会根据玩家所在地图过滤显示
    const all = [];
    for (const m of monsters.values()) {
      all.push(m);
    }
    for (const s of summons.values()) all.push({ ...s, isSummon: true });
    return all;
  }

  function getPlayers() {
    return Array.from(players.values()).map(p => ({
      id: p.id, username: p.username, x: p.x, y: p.y, level: p.level,
      exp: p.exp, hp: p.hp, max_hp: p.max_hp, class: p.class,
      equipment: p.equipment, inventory: p.inventory, gold: p.gold,
      attack: p.attack, defense: p.defense, mp: p.mp, max_mp: p.max_mp,
      map_id: p.map_id, cultivationRealm: p.cultivationRealm || 0, cultivationStage: p.cultivationStage || 1,
      skillCooldowns: playerSkillCooldowns.get(p.socketId) || {},
    }));
  }

  // ===== 副本系统 =====
  const dungeonInstances = new Map();
  const playerDungeonState = new Map(); // socketId -> {instanceId, originalMap, originalX, originalY}

  function enterDungeon(socketId, dungeonId) {
    const p = players.get(socketId);
    if (!p) return null;
    const dungeon = DUNGEONS[dungeonId];
    if (!dungeon) return { error: 'dungeon_not_found' };
    if (p.level < dungeon.levelReq) return { error: 'level_too_low', required: dungeon.levelReq };

    const instanceId = `${dungeonId}_${p.id}_${Date.now()}`;
    const mapId = `dungeon_${dungeonId}`;

    // 保存原始位置
    playerDungeonState.set(socketId, {
      instanceId,
      originalMap: p.map_id,
      originalX: p.x,
      originalY: p.y
    });

    // 传送玩家到副本地图
    p.map_id = mapId;
    p.x = 10; p.y = 10; // 副本入口

    // 生成副本怪物并添加到全局
    const monstersList = [];
    let mid = 0;
    for (const mt of dungeon.monsters) {
      for (let i = 0; i < mt.count; i++) {
        const id = `d_${++mid}`;
        monsters.set(id, {
          id, name: mt.name, level: mt.level,
          hp: mt.hp, maxHp: mt.hp, attack: mt.attack, defense: mt.defense, exp: mt.exp,
          x: 15 + Math.random() * 60, y: 15 + Math.random() * 40,
          speed: 0.5, targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
          mapId: mapId, isDungeon: true,
        });
        monstersList.push(id);
      }
    }
    // Boss
    const boss = dungeon.boss;
    const bossId = `boss_${++mid}`;
    monsters.set(bossId, {
      id: bossId, name: boss.name, level: boss.level,
      hp: boss.hp, maxHp: boss.hp, attack: boss.attack, defense: boss.defense, exp: boss.exp,
      x: 50, y: 30, speed: 0.3, targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
      mapId: mapId, isDungeon: true, isBoss: true,
    });
    monstersList.push(bossId);

    dungeonInstances.set(instanceId, {
      dungeonId, playerId: p.id, monsterIds: monstersList, cleared: false, mapId
    });

    return {
      instanceId, dungeonName: dungeon.name, monsterCount: monstersList.length,
      monsters: monstersList.map(id => monsters.get(id)).filter(Boolean),
      mapId
    };
  }

  function exitDungeon(socketId) {
    const state = playerDungeonState.get(socketId);
    if (!state) return;
    const p = players.get(socketId);
    if (!p) return;

    // 传回原位置
    p.map_id = state.originalMap;
    p.x = state.originalX;
    p.y = state.originalY;

    // 清理副本怪物
    const instance = dungeonInstances.get(state.instanceId);
    if (instance) {
      for (const mId of instance.monsterIds) {
        monsters.delete(mId);
      }
      dungeonInstances.delete(state.instanceId);
    }
    playerDungeonState.delete(socketId);
    return { map: p.map_id, x: p.x, y: p.y };
  }

  function attackDungeonMonster(socketId, instanceId, monsterId, skillId = null) {
    const p = players.get(socketId);
    const m = monsters.get(monsterId);
    if (!p || !m || !m.isDungeon) return { error: 'monster_not_found' };

    let damageMult = 1;
    if (skillId) {
      const cls = CLASSES[p.class];
      const skill = cls.skills.find(s => s.id === skillId);
      if (skill && p.skills.includes(skillId) && p.mp >= skill.mpCost) {
        p.mp -= skill.mpCost;
        damageMult = skill.damageMult;
      }
    }

    const damage = Math.max(1, Math.floor((p.attack - m.defense + Math.floor(Math.random() * 5)) * damageMult));
    m.hp -= damage;

    if (m.hp <= 0) {
      p.exp += m.exp;
      p.gold += Math.floor(m.level * 5 + Math.random() * 20);
      const leveledUp = checkLevelUp(p);
      checkNewSkills(p);

      let drop = null;
      if (m.isBoss) {
        // 副本BOSS必掉装备，优先从奖励列表抽取
        const instance = [...dungeonInstances.values()].find(i => i.monsterIds.includes(monsterId));
        if (instance) {
          const dungeon = DUNGEONS[instance.dungeonId];
          // 先尝试奖励列表（提高概率）
          for (const reward of dungeon.rewards) {
            if (Math.random() < reward.chance) {
              const equip = EQUIPMENT_DB.find(e => e.id === reward.id);
              if (equip) drop = { ...equip };
            }
          }
          // 如果奖励都没中，从当前地图品质池中必掉一件高品质装备
          if (!drop) {
            drop = rollEquipmentDrop(dungeon.boss.level, `dungeon_${instance.dungeonId}`, true);
          }
          instance.cleared = true;
        }
        if (drop) {
          if (!p.inventory) p.inventory = [];
          p.inventory.push({ ...drop, enhanceLevel: 0, gems: [] });
        }
        // 副本通关，传送回原地图
        setTimeout(() => exitDungeon(socketId), 1000);
      }

      monsters.delete(monsterId);

      return { damage, killed: true, monsterId, leveledUp, isBoss: m.isBoss, exp: m.exp, gold: Math.floor(m.level * 5 + Math.random() * 20), drop };
    }

    return { damage, killed: false, monsterHp: m.hp, monsterMaxHp: m.maxHp };
  }

  function getDungeonState(instanceId) {
    return dungeonInstances.get(instanceId);
  }

  // ===== 无尽副本系统 =====
  const endlessInstances = new Map(); // instanceId -> { layer, monsters, monstersLeft, bossKilled }
  const playerEndlessState = new Map(); // socketId -> { instanceId, layer, maxLayer }

  function getEndlessMonsterName(layer) {
    const prefixes = ['狂暴的','远古的','变异的','堕落的','混沌的','天界的','神圣的','黑暗的','燃烧的','冰封的'];
    const suffixes = ['·改','·真','·极','·终','·灭','·皇','·帝','·神','·圣','·尊','·祖','·源','·灭世','·天罚'];
    const p = prefixes[layer % prefixes.length];
    const s = suffixes[Math.floor(layer / 10) % suffixes.length];
    return `${p}骷髅战士${s}`;
  }

  function enterEndlessDungeon(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    if (p.level < 50) return { error: 'level_too_low', required: 50 };

    const instanceId = `endless_${socketId}_${Date.now()}`;
    const currentLayer = (playerEndlessState.get(socketId)?.maxLayer || 0) + 1;
    const layer = Math.max(1, currentLayer);

    // 生成怪物
    const monstersList = [];
    const baseLevel = ENDLESS_DUNGEON.baseLevel;
    const monsterLevel = Math.floor(baseLevel * Math.pow(ENDLESS_DUNGEON.levelScale, layer - 1));
    const monsterHp = Math.floor(200 * Math.pow(ENDLESS_DUNGEON.hpScale, layer - 1));
    const monsterAtk = Math.floor(15 * Math.pow(ENDLESS_DUNGEON.atkScale, layer - 1));
    const monsterDef = Math.floor(8 * Math.pow(ENDLESS_DUNGEON.defScale, layer - 1));

    for (let i = 0; i < ENDLESS_DUNGEON.monsterCount; i++) {
      const mId = `${instanceId}_m_${i}`;
      monsters.set(mId, {
        id: mId, name: getEndlessMonsterName(layer), level: monsterLevel,
        hp: monsterHp, maxHp: monsterHp, attack: monsterAtk, defense: monsterDef,
        exp: Math.floor(monsterLevel * 2), goldMin: Math.floor(monsterLevel), goldMax: Math.floor(monsterLevel * 2),
        x: 10 + Math.floor(Math.random() * 70), y: 10 + Math.floor(Math.random() * 40),
        speed: 0.5 + Math.random() * 0.3, targetX: null, targetY: null,
        moveTimer: 0, attackCooldown: 0, mapId: instanceId,
        isDungeon: true, isBoss: false,
      });
      monstersList.push(mId);
    }

    // BOSS每10层
    let bossInfo = null;
    if (layer % ENDLESS_DUNGEON.bossEvery === 0) {
      const bossLevel = Math.floor(monsterLevel * 3);
      const bossHp = Math.floor(monsterHp * 10);
      const bossAtk = Math.floor(monsterAtk * 3);
      const bossDef = Math.floor(monsterDef * 3);
      const bossId = `${instanceId}_boss`;
      monsters.set(bossId, {
        id: bossId, name: `无尽领主·第${layer}层`, level: bossLevel,
        hp: bossHp, maxHp: bossHp, attack: bossAtk, defense: bossDef,
        exp: Math.floor(bossLevel * 10), goldMin: Math.floor(bossLevel * 20), goldMax: Math.floor(bossLevel * 50),
        x: 40, y: 20, speed: 0.4, targetX: null, targetY: null,
        moveTimer: 0, attackCooldown: 0, mapId: instanceId,
        isDungeon: true, isBoss: true,
      });
      monstersList.push(bossId);
      bossInfo = { id: bossId, level: bossLevel, hp: bossHp };
    }

    endlessInstances.set(instanceId, {
      layer, monsters: monstersList, monstersLeft: monstersList.length,
      bossKilled: false, bossInfo,
    });

    playerEndlessState.set(socketId, { instanceId, layer });

    // 传送玩家到副本
    const origMap = p.map_id;
    const origX = p.x;
    const origY = p.y;
    p.map_id = instanceId;
    p.x = 40;
    p.y = 40;

    return {
      instanceId, layer, monsterCount: monstersList.length,
      monsters: monstersList.map(id => monsters.get(id)).filter(Boolean),
      bossInfo,
    };
  }

  function exitEndlessDungeon(socketId) {
    const state = playerEndlessState.get(socketId);
    if (!state) return;
    const p = players.get(socketId);
    if (!p) return;

    // 传送回比奇城
    p.map_id = 'bichon';
    p.x = 50;
    p.y = 50;

    // 清理副本怪物
    const instance = endlessInstances.get(state.instanceId);
    if (instance) {
      for (const mId of instance.monsters) {
        monsters.delete(mId);
      }
      endlessInstances.delete(state.instanceId);
    }
    playerEndlessState.delete(socketId);
    return { map: p.map_id, x: p.x, y: p.y };
  }

  function attackEndlessMonster(socketId, monsterId, skillId = null) {
    const p = players.get(socketId);
    const m = monsters.get(monsterId);
    if (!p || !m || !m.isDungeon) return { error: 'monster_not_found' };

    const state = playerEndlessState.get(socketId);
    if (!state) return { error: 'not_in_endless' };

    let damageMult = 1;
    if (skillId) {
      const cls = CLASSES[p.class];
      const skill = cls.skills.find(s => s.id === skillId);
      if (skill && p.skills.includes(skillId)) {
        const cooldowns = playerSkillCooldowns.get(socketId) || {};
        if (cooldowns[skillId] > 0) return { error: 'skill_on_cooldown', skillId, cooldown: Math.ceil(cooldowns[skillId]) };
        if (p.mp < skill.mpCost) return { error: 'not_enough_mp' };
        p.mp -= skill.mpCost;
        damageMult = skill.damageMult;
        cooldowns[skillId] = skill.cooldown || 3;
        playerSkillCooldowns.set(socketId, cooldowns);
      }
    }

    const damage = Math.max(1, Math.floor((p.attack - m.defense + Math.floor(Math.random() * 5)) * damageMult));
    m.hp -= damage;

    if (m.hp <= 0) {
      const instance = endlessInstances.get(state.instanceId);
      if (instance) {
        instance.monstersLeft--;
        console.log(`[Endless] Killed monster. monstersLeft: ${instance.monstersLeft}, layer: ${instance.layer}`);

        // BOSS掉落
        if (m.isBoss) {
          instance.bossKilled = true;
          const layer = instance.layer;
          const matQuality = layer >= 50 ? 'divine' : layer >= 30 ? 'mythic' : 'legendary';
          const matConfig = BREAKTHROUGH_MATERIALS[matQuality];
          const matName = matConfig ? matConfig.name : `${matQuality}碎片`;
          const baseCount = { legendary: 5, mythic: 10, divine: 20 }[matQuality] || 5;
          const count = baseCount * Math.floor(layer / 10 + 1);

          if (!p.inventory) p.inventory = [];
          for (let i = 0; i < count; i++) {
            p.inventory.push({ name: matName, type: 'material', quality: matQuality });
          }

          // 高阶掉落装备
          if (layer >= 20) {
            const equipPool = EQUIPMENT_DB.filter(e =>
              (matQuality === 'divine' && e.quality === 'divine') ||
              (matQuality === 'mythic' && (e.quality === 'mythic' || e.quality === 'divine')) ||
              (matQuality === 'legendary' && (e.quality === 'legendary' || e.quality === 'mythic'))
            );
            if (equipPool.length > 0) {
              const drop = { ...equipPool[Math.floor(Math.random() * equipPool.length)] };
              drop.enhanceLevel = 0;
              drop.gems = [];
              p.inventory.push(drop);
            }
          }
          savePlayer(p);
        }

        // 普通怪也掉少量材料
        if (!m.isBoss && Math.random() < 0.3) {
          const layer = instance.layer;
          const matQuality = layer >= 50 ? 'divine' : layer >= 30 ? 'mythic' : 'legendary';
          const matConfig = BREAKTHROUGH_MATERIALS[matQuality];
          const matName = matConfig ? matConfig.name : `${matQuality}碎片`;
          if (!p.inventory) p.inventory = [];
          p.inventory.push({ name: matName, type: 'material', quality: matQuality });
          savePlayer(p);
        }

        // 清空当前层，进入下一层
        console.log(`[Endless] Checking monstersLeft: ${instance.monstersLeft} (threshold: 0)`);
        if (instance.monstersLeft <= 0) {
          console.log(`[Endless] >>> Layer ${instance.layer} cleared! Entering next layer...`);
          const expReward = Math.floor(50 * Math.pow(1.05, instance.layer - 1));
          const goldReward = Math.floor(500 * Math.pow(1.12, instance.layer - 1));
          p.exp += expReward;
          p.gold += goldReward;
          checkLevelUp(p);

          // 更新最高层记录
          if (instance.layer > (state.maxLayer || 0)) {
            state.maxLayer = instance.layer;
          }

          // 清理当前层怪物，准备下一层
          for (const mId of instance.monsters) monsters.delete(mId);

          // 自动进入下一层
          setTimeout(() => {
            const nextLayer = instance.layer + 1;
            if (nextLayer > ENDLESS_DUNGEON.maxLayer) {
              exitEndlessDungeon(socketId);
              return;
            }
            // 重新生成下一层
            const monstersList = [];
            const baseLevel = ENDLESS_DUNGEON.baseLevel;
            const monsterLevel = Math.floor(baseLevel * Math.pow(ENDLESS_DUNGEON.levelScale, nextLayer - 1));
            const monsterHp = Math.floor(200 * Math.pow(ENDLESS_DUNGEON.hpScale, nextLayer - 1));
            const monsterAtk = Math.floor(15 * Math.pow(ENDLESS_DUNGEON.atkScale, nextLayer - 1));
            const monsterDef = Math.floor(8 * Math.pow(ENDLESS_DUNGEON.defScale, nextLayer - 1));
            for (let i = 0; i < ENDLESS_DUNGEON.monsterCount; i++) {
              const mId = `${state.instanceId}_m2_${i}`;
              monsters.set(mId, {
                id: mId, name: getEndlessMonsterName(nextLayer), level: monsterLevel,
                hp: monsterHp, maxHp: monsterHp, attack: monsterAtk, defense: monsterDef,
                exp: Math.floor(monsterLevel * 2), goldMin: Math.floor(monsterLevel), goldMax: Math.floor(monsterLevel * 2),
                x: 10 + Math.floor(Math.random() * 70), y: 10 + Math.floor(Math.random() * 40),
                speed: 0.5 + Math.random() * 0.3, targetX: null, targetY: null,
                moveTimer: 0, attackCooldown: 0, mapId: state.instanceId,
                isDungeon: true, isBoss: false,
              });
              monstersList.push(mId);
            }

            let bossInfo2 = null;
            if (nextLayer % ENDLESS_DUNGEON.bossEvery === 0) {
              const bossLevel2 = Math.floor(monsterLevel * 3);
              const bossHp2 = Math.floor(monsterHp * 10);
              const bossAtk2 = Math.floor(monsterAtk * 3);
              const bossDef2 = Math.floor(monsterDef * 3);
              const bossId2 = `${state.instanceId}_boss2_${nextLayer}`;
              monsters.set(bossId2, {
                id: bossId2, name: `无尽领主·第${nextLayer}层`, level: bossLevel2,
                hp: bossHp2, maxHp: bossHp2, attack: bossAtk2, defense: bossDef2,
                exp: Math.floor(bossLevel2 * 10), goldMin: Math.floor(bossLevel2 * 20), goldMax: Math.floor(bossLevel2 * 50),
                x: 40, y: 20, speed: 0.4, targetX: null, targetY: null,
                moveTimer: 0, attackCooldown: 0, mapId: state.instanceId,
                isDungeon: true, isBoss: true,
              });
              monstersList.push(bossId2);
              bossInfo2 = { id: bossId2, level: bossLevel2, hp: bossHp2 };
            }

            instance.layer = nextLayer;
            instance.monsters = monstersList;
            instance.monstersLeft = monstersList.length;
            instance.bossKilled = false;
            instance.bossInfo = bossInfo2;

            const newMonsters = monstersList.map(id => monsters.get(id)).filter(Boolean);
            // 通知客户端新层数据
            io.to(socketId).emit('endless_next_layer', {
              layer: nextLayer,
              monsterCount: monstersList.length,
              monsters: newMonsters,
              bossInfo: bossInfo2,
            });
          }, 2000);
        }
      }

      monsters.delete(monsterId);
      return { damage, killed: true, monsterId, leveledUp: false, isBoss: m.isBoss,
        exp: Math.floor(m.level * 2), gold: Math.floor(m.level * 5 + Math.random() * m.level * 10),
        skillId: skillId || null };
    }

    return { damage, killed: false, monsterHp: m.hp, monsterMaxHp: m.maxHp, skillId: skillId || null };
  }

  function getEndlessProgress(socketId) {
    const state = playerEndlessState.get(socketId);
    return {
      inDungeon: !!state,
      layer: state?.layer || 0,
      maxLayer: state?.maxLayer || 0,
    };
  }

  // ===== 公会系统 =====
  const guilds = new Map();
  let guildIdCounter = 0;

  function createGuild(socketId, guildName) {
    const p = players.get(socketId);
    if (!p) return null;
    if (p.gold < 100) return { error: 'not_enough_gold', need: 100 };

    for (const g of guilds.values()) {
      if (g.name === guildName) return { error: 'name_taken' };
    }

    const id = `g_${++guildIdCounter}`;
    const guild = {
      id, name: guildName, leaderId: p.id, leaderName: p.username,
      level: 1, exp: 0, members: [{ playerId: p.id, name: p.username, role: 'leader' }],
      createdAt: Date.now(),
    };
    p.gold -= 100;
    p.guildId = id;
    guilds.set(id, guild);
    savePlayer(p);
    return { guild: guild, message: `公会 "${guildName}" 创建成功！` };
  }

  function joinGuild(socketId, guildId) {
    const p = players.get(socketId);
    const g = guilds.get(guildId);
    if (!p || !g) return { error: 'not_found' };
    if (p.guildId) return { error: 'already_in_guild' };

    g.members.push({ playerId: p.id, name: p.username, role: 'member' });
    p.guildId = guildId;
    savePlayer(p);
    return { guild: g, message: `加入公会 "${g.name}"！` };
  }

  function leaveGuild(socketId) {
    const p = players.get(socketId);
    if (!p || !p.guildId) return { error: 'no_guild' };
    const g = guilds.get(p.guildId);
    if (!g) return { error: 'no_guild' };

    if (g.leaderId === p.id) {
      // 转让会长
      const newLeader = g.members.find(m => m.playerId !== p.id);
      if (newLeader) {
        newLeader.role = 'leader';
        g.leaderId = newLeader.playerId;
        g.leaderName = newLeader.name;
      } else {
        guilds.delete(p.guildId);
      }
    }

    g.members = g.members.filter(m => m.playerId !== p.id);
    p.guildId = null;
    savePlayer(p);
    return { message: '已退出公会' };
  }

  function getGuildInfo(guildId) {
    return guilds.get(guildId);
  }

  function getGuildList() {
    return Array.from(guilds.values()).map(g => ({
      id: g.id, name: g.name, level: g.level, memberCount: g.members.length,
      leaderName: g.leaderName,
    }));
  }

  // ===== PK 系统 =====
  function attackPlayer(socketId, targetSocketId) {
    const attacker = players.get(socketId);
    const target = players.get(targetSocketId);
    if (!attacker || !target) return null;
    if (socketId === targetSocketId) return { error: 'cannot_self' };

    const dist = Math.sqrt((attacker.x - target.x) ** 2 + (attacker.y - target.y) ** 2);
    // 单机游戏不检查距离，允许攻击
    if (dist > 50) return { error: 'too_far' };

    // 安全区不能PK
    if (isInSafeZone(attacker.x, attacker.y) || isInSafeZone(target.x, target.y)) {
      return { error: 'safe_zone' };
    }

    const damage = Math.max(1, attacker.attack - target.defense + Math.floor(Math.random() * 5));
    target.hp -= damage;
    attacker.pkPoints = (attacker.pkPoints || 0) + 1; // 每次攻击都加PK点

    if (target.hp <= 0) {
      target.hp = target.max_hp;
      target.x = 50; target.y = 50;
      attacker.gold += Math.floor(target.gold * 0.1);
      attacker.pkPoints += 9;
      // 红名被击杀有概率掉落装备
      let droppedItem = null;
      if (target.pkPoints > 50 && target.inventory?.length && Math.random() < RED_NAME_DROP_RATE) {
        const dropIdx = Math.floor(Math.random() * target.inventory.length);
        droppedItem = target.inventory.splice(dropIdx, 1)[0];
        if (!attacker.inventory) attacker.inventory = [];
        attacker.inventory.push(droppedItem);
      }
      savePlayer(target);
      return { damage, killed: true, targetName: target.username, goldStolen: Math.floor(target.gold * 0.1), droppedItem: droppedItem?.name };
    }

    return { damage, killed: false, targetHp: target.hp, targetMaxHp: target.max_hp };
  }

  function getPkStatus(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const pkPoints = p.pkPoints || 0;
    return {
      pkPoints,
      isRed: pkPoints > 50,
      nameColor: pkPoints > 100 ? '#ff0000' : pkPoints > 50 ? '#ff8800' : '#ffffff',
      inSafeZone: isInSafeZone(p.x, p.y),
    };
  }

  // ===== 世界BOSS =====
  function initWorldBosses() {
    for (const wb of WORLDBOSS_DB) {
      scheduleWorldBoss(wb);
    }
  }

  function scheduleWorldBoss(wb) {
    const spawnTime = Date.now() + wb.interval;
    worldBossState.nextSpawn[wb.id] = spawnTime;
    worldBossState.timers[wb.id] = setTimeout(() => {
      spawnWorldBoss(wb);
    }, wb.interval);
  }

  function spawnWorldBoss(wb) {
    if (worldBossState.active[wb.id]) return;

    const monster = {
      id: 'wb_' + wb.id + '_' + Date.now(),
      templateId: wb.id,
      name: wb.name,
      map: wb.map,
      x: wb.x, y: wb.y,
      hp: wb.hp, maxHp: wb.hp,
      attack: wb.attack,
      defense: wb.defense,
      exp: wb.exp,
      goldMin: wb.goldMin, goldMax: wb.goldMax,
      qualityPool: wb.qualityPool,
      isWorldBoss: true,
      isBoss: true,
      lastAttackTime: 0,
      attackers: new Set(),
      dropChance: 1.0,
      speed: 0.3,
      targetX: null, targetY: null, moveTimer: 0, attackCooldown: 0,
    };

    worldBossState.active[wb.id] = monster;
    monsters.set(monster.id, monster);

    if (io) {
      io.emit('system_msg', `【世界BOSS】${wb.name}已在${MAPS[wb.map]?.name || wb.map}刷新！所有勇士前去讨伐！`);
      io.emit('worldboss_update', getWorldBossState());
    }

    scheduleWorldBoss(wb);
  }

  function onWorldBossDefeated(monster, killer) {
    const wb = WORLDBOSS_DB.find(b => b.id === monster.templateId);
    if (!wb) return;

    delete worldBossState.active[wb.id];
    monsters.delete(monster.id);

    if (io) {
      io.emit('system_msg', `【世界BOSS】勇士 ${killer.username} 成功击杀了${wb.name}！`);
      io.emit('worldboss_update', getWorldBossState());
    }
  }

  function getWorldBossState() {
    const result = [];
    for (const wb of WORLDBOSS_DB) {
      const active = worldBossState.active[wb.id];
      result.push({
        id: wb.id,
        name: wb.name,
        map: wb.map,
        mapName: MAPS[wb.map]?.name || wb.map,
        active: !!active,
        monsterId: active?.id,
        hp: active?.hp || 0,
        maxHp: active?.maxHp || 0,
        nextSpawn: worldBossState.nextSpawn[wb.id] || Date.now(),
      });
    }
    return result;
  }

  function clearWorldBossMonsters() {
    for (const [id, m] of monsters) {
      if (m.isWorldBoss) monsters.delete(id);
    }
  }

  // 英雄/元神
  function unlockHero(socketId, heroClass) {
    const p = players.get(socketId);
    if (!p) return null;
    if (p.level < HERO_UNLOCK_LEVEL) return { error: 'level_too_low', required: HERO_UNLOCK_LEVEL };
    if (p.hero) return { error: 'already_has_hero' };
    if (p.gold < HERO_UNLOCK_COST) return { error: 'not_enough_gold', cost: HERO_UNLOCK_COST, gold: p.gold };
    const heroData = HERO_CLASSES[heroClass];
    if (!heroData) return { error: 'invalid_class' };
    p.gold -= HERO_UNLOCK_COST;
    p.hero = { class: heroClass, name: heroData.name, level: 1, hp: heroData.hp, maxHp: heroData.hp, attack: heroData.attack, defense: heroData.defense, skill: heroData.skill, exp: 0 };
    savePlayer(p);
    return { success: true, hero: p.hero };
  }
  function getHero(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    return p.hero || { unlocked: false };
  }
  function heroAttack(socketId, monsterId) {
    const p = players.get(socketId);
    if (!p || !p.hero) return { error: 'no_hero' };
    const m = monsters.get(monsterId);
    if (!m || m.mapId !== p.map_id) return { error: 'target_not_found' };
    const damage = Math.max(1, p.hero.attack - Math.floor(m.defense * 0.5));
    m.hp -= damage;
    if (m.hp <= 0) {
      p.hero.exp += m.exp;
      p.hero.level = Math.floor(p.hero.exp / 500) + 1;
      p.hero.attack += Math.floor(p.hero.level * 2);
      p.hero.hp = Math.floor(HERO_CLASSES[p.hero.class].hp * (1 + p.hero.level * 0.1));
      p.hero.maxHp = p.hero.hp;
      monsters.delete(monsterId);
      monsterDots.delete(monsterId);
      return { damage, killed: true, heroLevel: p.hero.level };
    }
    return { damage, killed: false, monsterHp: m.hp };
  }

  // 沙巴克攻城战
  function startSabakSiege(guildId) {
    if (!guildId) return { error: 'no_guild' };
    const guild = guilds.get(guildId);
    if (!guild) return { error: 'guild_not_found' };
    if (SABAK_EVENT.active) return { error: 'already_active' };
    SABAK_EVENT.active = true;
    SABAK_EVENT.startTime = Date.now();
    SABAK_EVENT.attackers = [guildId];
    SABAK_EVENT.defenders = [];
    SABAK_EVENT.gates = { main: { hp: 5000, maxHp: 5000 }, side: { hp: 3000, maxHp: 3000 } };
    SABAK_EVENT.palace = { controller: null };
    SABAK_EVENT.winner = null;
    // 全服公告
    if (ioInstance) {
      ioInstance.emit('system_msg', `【沙巴克攻城战】公会"${guild.name}"发起攻城！2小时后决出城主！`);
    }
    return { success: true, duration: SABAK_EVENT.duration / 60 };
  }
  function attackSabakGate(socketId, gate) {
    const p = players.get(socketId);
    if (!p) return null;
    if (!SABAK_EVENT.active) return { error: 'not_active' };
    const g = SABAK_EVENT.gates[gate];
    if (!g || g.hp <= 0) return { error: 'gate_destroyed' };
    const damage = Math.floor(p.attack * (1 + Math.random()));
    g.hp = Math.max(0, g.hp - damage);
    if (g.hp <= 0 && ioInstance) {
      ioInstance.emit('system_msg', `【沙巴克】${gate === 'main' ? '正门' : '侧门'}被攻破！`);
    }
    return { damage, gate, gateHp: g.hp, maxHp: g.maxHp };
  }
  function completeSabakSiege(guildId) {
    if (!SABAK_EVENT.active) return { error: 'not_active' };
    SABAK_EVENT.active = false;
    SABAK_EVENT.winner = guildId;
    const guild = guilds.get(guildId);
    if (guild) {
      SABAK_EVENT.palace.controller = guildId;
      if (ioInstance) ioInstance.emit('system_msg', `【沙巴克攻城战结束】公会"${guild.name}"成功占领沙巴克城！`);
    }
    return { success: true, winner: guild?.name };
  }
  function getSabakState() {
    return {
      active: SABAK_EVENT.active,
      elapsed: SABAK_EVENT.active ? Math.floor((Date.now() - SABAK_EVENT.startTime) / 1000) : 0,
      gates: SABAK_EVENT.gates,
      palace: SABAK_EVENT.palace,
    };
  }

  // 师徒
  function becomeApprentice(socketId, masterName) {
    const p = players.get(socketId);
    if (!p) return null;
    if (p.level > APPRENTICE_REQ.apprenticeMaxLevel) return { error: 'level_too_high', max: APPRENTICE_REQ.apprenticeMaxLevel };
    if (mentorMap.has(p.id)) return { error: 'already_apprentice' };
    const master = [...players.values()].find(pl => pl.username === masterName);
    if (!master) return { error: 'master_not_found' };
    if (master.level < APPRENTICE_REQ.masterMinLevel) return { error: 'master_level_too_low', min: APPRENTICE_REQ.masterMinLevel };
    mentorMap.set(p.id, master.id);
    if (!apprenticeMap.has(master.id)) apprenticeMap.set(master.id, new Set());
    apprenticeMap.get(master.id).add(p.id);
    savePlayer(p);
    return { success: true, masterName };
  }
  function getMasterInfo(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const masterId = mentorMap.get(p.id);
    if (!masterId) return { hasMaster: false };
    const master = players.get(masterId);
    return { hasMaster: true, masterName: master?.username, masterLevel: master?.level };
  }
  function getApprentices(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const apprentices = apprenticeMap.get(p.id);
    if (!apprentices) return { list: [] };
    return { list: [...apprentices].map(id => {
      const a = players.get(id);
      return { name: a?.username, level: a?.level };
    })};
  }

  // 经脉
  function getMeridianState(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const mer = p.meridians || {};
    const result = {};
    for (const [key, def] of Object.entries(MERIDIANS)) {
      result[key] = { name: def.name, attr: def.attr, opened: mer[key] || 0, max: def.points, cost: MERIDIAN_POINT_COST(mer[key] || 0) };
    }
    return result;
  }
  function openMeridian(socketId, meridianId) {
    const p = players.get(socketId);
    if (!p) return null;
    const def = MERIDIANS[meridianId];
    if (!def) return { error: 'invalid_meridian' };
    if (!p.meridians) p.meridians = {};
    const current = p.meridians[meridianId] || 0;
    if (current >= def.points) return { error: 'max_level' };
    const cost = MERIDIAN_POINT_COST(current);
    if (p.gold < cost) return { error: 'not_enough_gold', cost, gold: p.gold };
    p.gold -= cost;
    p.meridians[meridianId] = current + 1;
    recalcStats(p);
    savePlayer(p);
    return { success: true, meridian: def.name, level: current + 1, cost };
  }

  // 坐骑和翅膀
  function buyMount(socketId, mountId) {
    const p = players.get(socketId);
    if (!p) return null;
    const mount = MOUNTS_DB.find(m => m.id === mountId);
    if (!mount) return { error: 'not_found' };
    if (p.gold < mount.price) return { error: 'not_enough_gold', cost: mount.price, gold: p.gold };
    p.gold -= mount.price;
    p.mount = { ...mount };
    recalcStats(p);
    savePlayer(p);
    return { success: true, mount: mount.name };
  }
  function buyWings(socketId, wingId) {
    const p = players.get(socketId);
    if (!p) return null;
    const wing = WINGS_DB.find(w => w.id === wingId);
    if (!wing) return { error: 'not_found' };
    if (p.gold < wing.price) return { error: 'not_enough_gold', cost: wing.price, gold: p.gold };
    p.gold -= wing.price;
    p.wings = { ...wing };
    recalcStats(p);
    savePlayer(p);
    return { success: true, wings: wing.name };
  }

  // ===== 结婚 =====
  function proposeMarriage(socketId, targetName) {
    const p = players.get(socketId);
    if (!p) return null;
    if (p.level < MARRIAGE_REQ.minLevel) return { error: 'level_too_low', required: MARRIAGE_REQ.minLevel };
    if (marriedPairs.has(p.id)) return { error: 'already_married' };
    const target = [...players.values()].find(pl => pl.username === targetName);
    if (!target) return { error: 'target_not_found' };
    if (target.id === p.id) return { error: 'cannot_self' };
    if (marriedPairs.has(target.id)) return { error: 'target_married' };
    // 检查求婚戒指
    const ringIdx = p.inventory?.findIndex(i => i.id === MARRIAGE_REQ.ringId);
    if (ringIdx < 0) return { error: 'no_ring' };
    p.inventory.splice(ringIdx, 1);
    // 记录婚姻
    marriedPairs.set(p.id, { partnerId: target.id, partnerName: target.username, marriedAt: Date.now() });
    marriedPairs.set(target.id, { partnerId: p.id, partnerName: p.username, marriedAt: Date.now() });
    savePlayer(p);
    return { success: true, partner: target.username };
  }
  function getMarriageInfo(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const info = marriedPairs.get(p.id);
    if (!info) return { married: false };
    return { married: true, partnerName: info.partnerName, marriedAt: info.marriedAt };
  }
  function divorce(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const info = marriedPairs.get(p.id);
    if (!info) return { error: 'not_married' };
    marriedPairs.delete(p.id);
    marriedPairs.delete(info.partnerId);
    savePlayer(p);
    return { success: true };
  }
  function teleportToPartner(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const info = marriedPairs.get(p.id);
    if (!info) return { error: 'not_married' };
    const partner = players.get(info.partnerId);
    if (!partner) return { error: 'partner_offline' };
    p.map_id = partner.map_id;
    p.x = partner.x + 1; p.y = partner.y + 1;
    savePlayer(p);
    return { success: true, map: p.map_id, x: p.x, y: p.y };
  }

  // ===== 押镖 =====
  const ESCORT_STATE = { active: false, startTime: 0, progress: 0, targetMap: '', rewardExp: 0, rewardGold: 0 };
  function startEscort(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    if (ESCORT_STATE.active) return { error: 'already_escorting' };
    if (p.level < 10) return { error: 'level_too_low', required: 10 };
    const maps = Object.keys(MAPS).filter(m => !m.startsWith('dungeon_'));
    const target = maps[Math.floor(Math.random() * maps.length)];
    ESCORT_STATE.active = true;
    ESCORT_STATE.startTime = Date.now();
    ESCORT_STATE.progress = 0;
    ESCORT_STATE.targetMap = target;
    ESCORT_STATE.rewardExp = 500 + p.level * 50;
    ESCORT_STATE.rewardGold = 300 + p.level * 30;
    return { success: true, targetMap: target, targetName: MAPS[target]?.name || target, duration: 30 };
  }
  function updateEscort(dt) {
    if (!ESCORT_STATE.active) return null;
    ESCORT_STATE.progress += dt;
    if (ESCORT_STATE.progress >= 30) {
      ESCORT_STATE.active = false;
      return { completed: true };
    }
    return { progress: ESCORT_STATE.progress / 30 };
  }
  function completeEscort(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    if (!ESCORT_STATE.active) return { error: 'no_escort' };
    p.exp += ESCORT_STATE.rewardExp;
    p.gold += ESCORT_STATE.rewardGold;
    checkLevelUp(p);
    ESCORT_STATE.active = false;
    savePlayer(p);
    return { success: true, exp: ESCORT_STATE.rewardExp, gold: ESCORT_STATE.rewardGold };
  }

  // ===== 每日活动 =====
  function getDailyActivities(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const today = new Date().toDateString();
    const state = p.dailyState || {};
    if (state.date !== today) { p.dailyState = { date: today, completed: {} }; }
    const completed = p.dailyState.completed || {};
    const list = Object.values(DAILY_ACTIVITIES).map(a => ({
      ...a, completed: !!completed[a.id]
    }));
    return { date: today, activities: list };
  }
  function completeDaily(socketId, activityId) {
    const p = players.get(socketId);
    if (!p) return null;
    const today = new Date().toDateString();
    if (!p.dailyState || p.dailyState.date !== today) p.dailyState = { date: today, completed: {} };
    if (p.dailyState.completed[activityId]) return { error: 'already_completed' };
    const activity = DAILY_ACTIVITIES[activityId];
    if (!activity) return { error: 'not_found' };
    p.dailyState.completed[activityId] = true;
    p.gold += activity.reward.gold || 0;
    p.exp += activity.reward.exp || 0;
    checkLevelUp(p);
    addReputation(socketId, 10);
    savePlayer(p);
    return { success: true, activity: activity.name, reward: activity.reward };
  }

  // ===== 成就系统 =====
  function getAchievements(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const unlocked = p.achievements || {};
    return Object.values(ACHIEVEMENTS).map(a => ({ ...a, unlocked: !!unlocked[a.id] }));
  }
  function checkAchievements(socketId) {
    const p = players.get(socketId);
    if (!p) return;
    const unlocked = p.achievements || {};
    const newly = [];
    const check = (id, condition) => {
      if (!unlocked[id] && condition) {
        unlocked[id] = true;
        const ach = ACHIEVEMENTS[id];
        p.gold += ach.reward.gold || 0;
        p.reputation = (p.reputation || 0) + (ach.reward.reputation || 0);
        newly.push(ach.name);
      }
    };
    const killTotal = p.killTotal || 0;
    check('kill_100', killTotal >= 100);
    check('kill_1000', killTotal >= 1000);
    check('level_50', p.level >= 50);
    check('level_100', p.level >= 100);
    check('rebirth_1', (p.cultivationRealm || 0) >= 1);
    const hasLegendary = Object.values(p.equipment || {}).some(e => e.quality === 'legendary');
    check('equip_legendary', hasLegendary);
    check('rich_100k', p.totalGoldEarned >= 100000);
    if (newly.length > 0) {
      p.achievements = unlocked;
      savePlayer(p);
    }
    return newly;
  }

  // ===== 摆摊 =====
  // 声望
  function getReputation(socketId) {
    const p = players.get(socketId);
    if (!p) return null;
    const rep = p.reputation || 0;
    let tier = REPUTATION_TIERS[0].name;
    for (const t of REPUTATION_TIERS) { if (rep >= t.req) tier = t.name; }
    return { reputation: rep, tier };
  }
  function addReputation(socketId, amount) {
    const p = players.get(socketId);
    if (!p) return;
    p.reputation = (p.reputation || 0) + amount;
    savePlayer(p);
  }

  // 排行榜
  function getLeaderboard(type = 'level') {
    const all = [...players.values()];
    if (type === 'level') all.sort((a, b) => (b.level || 0) - (a.level || 0) || (b.exp || 0) - (a.exp || 0));
    else if (type === 'gold') all.sort((a, b) => (b.gold || 0) - (a.gold || 0));
    else if (type === 'reputation') all.sort((a, b) => (b.reputation || 0) - (a.reputation || 0));
    else all.sort((a, b) => ((b.attack || 0) + (b.defense || 0)) - ((a.attack || 0) + (a.defense || 0)));
    return all.slice(0, LEADERBOARD_TOP).map((p, i) => ({
      rank: i + 1, username: p.username, level: p.level, class: p.class,
      gold: p.gold, attack: p.attack, defense: p.defense,
      reputation: p.reputation || 0, cultivationRealm: p.cultivationRealm || 0,
    }));
  }

  // 装备合成
  function synthEquipment(socketId, itemIndices) {
    const p = players.get(socketId);
    if (!p || !p.inventory || itemIndices.length < 3) return null;
    const items = itemIndices.map(i => p.inventory[i]).filter(Boolean);
    if (items.length < 3) return { error: 'not_enough_items' };
    // 必须同品质
    const quality = items[0].quality;
    if (!items.every(i => i.quality === quality)) return { error: 'different_quality' };
    // 合成后保持相同装备类型(slot)
    const slot = items[0].slot;
    const nextQuality = { common: 'uncommon', uncommon: 'rare', rare: 'epic', epic: 'legendary', legendary: 'mythic', mythic: 'divine' }[quality];
    if (!nextQuality) return { error: 'max_quality' };
    const cost = SYNTH_COST(quality);
    if (p.gold < cost) return { error: 'not_enough_gold', cost, gold: p.gold };
    p.gold -= cost;
    // 移除3件装备
    itemIndices.sort((a, b) => b - a).forEach(i => p.inventory.splice(i, 1));
    // 合成成功判定
    const success = Math.random() < SYNTH_RATES[quality];
    if (success) {
      // 从下一品质相同slot的池中随机选一件
      const pool = EQUIPMENT_DB.filter(e => e.quality === nextQuality && (e.slot === slot || slot === 'bracelet' && ['bracelet1','bracelet2'].includes(e.slot) || slot === 'ring' && ['ring1','ring2'].includes(e.slot)));
      if (pool.length > 0) {
        const newEquip = { ...pool[Math.floor(Math.random() * pool.length)], enhanceLevel: 0, gems: [] };
        p.inventory.push(newEquip);
        savePlayer(p);
        return { success: true, itemName: newEquip.name, quality: nextQuality };
      }
    }
    savePlayer(p);
    return { success: false, message: '合成失败！' };
  }

  function doListStallItem(socketId, itemIndex, price) {
    const p = players.get(socketId);
    if (!p || !p.inventory?.[itemIndex]) return null;
    const item = p.inventory[itemIndex];
    if (item.type === 'ore' || item.type === 'scroll' || item.type === 'material') return { error: 'invalid_item' };
    p.inventory.splice(itemIndex, 1);
    if (!playerStalls.has(p.id)) {
      playerStalls.set(p.id, { name: `${p.username}的摊位`, items: [], ownerName: p.username });
    }
    const stall = playerStalls.get(p.id);
    stall.items.push({ ...item, price, sellerId: p.id });
    savePlayer(p);
    return { success: true, itemName: item.name, price };
  }

  function doGetAllStalls() {
    return Array.from(playerStalls.values()).filter(s => s.items.length > 0);
  }

  function doBuyStallItem(socketId, stallOwnerName, itemIdx) {
    const buyer = players.get(socketId);
    let stall = null;
    for (const s of playerStalls.values()) {
      if (s.ownerName === stallOwnerName) { stall = s; break; }
    }
    if (!buyer || !stall || !stall.items[itemIdx]) return null;
    const listing = stall.items[itemIdx];
    if (buyer.gold < listing.price) return { error: 'not_enough_gold' };
    buyer.gold -= listing.price;
    if (!buyer.inventory) buyer.inventory = [];
    const { price, sellerId, ...item } = listing;
    buyer.inventory.push(item);
    const seller = [...players.values()].find(p => p.id === sellerId);
    if (seller) {
      seller.gold += Math.floor(listing.price * 0.95);
      savePlayer(seller);
    }
    stall.items.splice(itemIdx, 1);
    savePlayer(buyer);
    return { success: true, itemName: item.name, price: listing.price };
  }

  return {
    CLASSES, EQUIPMENT_DB, EQUIPMENT_SLOTS, EQUIPMENT_SETS, ZODIAC_SETS, WUXING_SETS, QUALITY_NAMES, QUALITY_COLORS,
    DUNGEONS, PK_ZONES,
    registerPlayer, savePlayer, movePlayer, attackMonster, useSkill,
    equipItem, unequipItem, updateMonsters, getMonsters, getPlayers, checkLevelUp,
    getPlayerBySocket: (socketId) => players.get(socketId) || null,
    doEquip: (socketId, itemIndex) => {
      const p = players.get(socketId);
      if (!p || !p.inventory?.[itemIndex]) return null;
      const item = p.inventory[itemIndex];
      console.log('[doEquip] item:', item.name, 'slot:', item.slot, 'type:', item.type);
      if (p.level < item.levelReq) return { error: 'level_too_low' };
      p.inventory.splice(itemIndex, 1);
      equipItem(p, item);
      console.log('[doEquip] after equip, slots:', JSON.stringify(p.equipment));
      savePlayer(p);
      return { equipped: item, stats: { attack: p.attack, defense: p.defense, hp: p.hp, max_hp: p.max_hp } };
    },
    doUnequip: (socketId, slot) => {
      const p = players.get(socketId);
      if (!p) return null;
      const item = unequipItem(p, slot);
      if (!item) return null;
      savePlayer(p);
      return { unequipped: item, stats: { attack: p.attack, defense: p.defense, hp: p.hp, max_hp: p.max_hp } };
    },
    doSell: (socketId, itemIndex) => {
      const p = players.get(socketId);
      if (!p || !p.inventory?.[itemIndex]) return null;
      const item = p.inventory[itemIndex];
      // 矿石/材料使用固定price，装备使用等级*品质计算
      let sellPrice;
      if (item.price && (item.type === 'ore' || item.type === 'material')) {
        sellPrice = item.price;
      } else {
        const qualityMult = { common: 1, uncommon: 1.5, rare: 2, epic: 3, legendary: 5 }[item.quality] || 1;
        sellPrice = Math.floor((item.levelReq || 1) * 10 * qualityMult);
      }
      p.inventory.splice(itemIndex, 1);
      p.gold += sellPrice;
      savePlayer(p);
      return { sold: item, price: sellPrice, gold: p.gold };
    },
    recycleAll: (socketId) => {
      const p = players.get(socketId);
      if (!p || !p.inventory?.length) return null;
      let total = 0;
      p.inventory.forEach(item => {
        const qm = {common:1,uncommon:1.5,rare:2,epic:3,legendary:5}[item.quality]||1;
        total += Math.floor(item.levelReq * 10 * qm);
      });
      p.inventory = [];
      p.gold += total;
      savePlayer(p);
      return { totalGold: total, gold: p.gold };
    },
    // 装备突破
    breakthroughEquip: (socketId, slot) => {
      const p = players.get(socketId);
      if (!p) return null;
      const equip = p.equipment?.[slot];
      if (!equip) return { error: 'no_equipment' };
      if (equip.quality === 'common' || equip.quality === 'uncommon' || equip.quality === 'rare') {
        return { error: 'too_low_quality' };
      }

      const currentLevel = equip.breakthroughLevel || 0;
      // 成功率：基础成功率 × 衰减
      const baseRate = SYNTH_RATES[equip.quality] || 0.15;
      const rate = baseRate * Math.pow(EQUIP_BREAKTHROUGH_RATE_DECAY, currentLevel);
      // 金币消耗
      const cost = Math.floor(SYNTH_COST(equip.quality) * Math.pow(EQUIP_BREAKTHROUGH_COST_MULT, currentLevel));
      // 材料消耗
      const matConfig = BREAKTHROUGH_MATERIALS[equip.quality];
      const matName = matConfig ? matConfig.name : `${equip.quality}碎片`;
      const matNeeded = EQUIP_BREAKTHROUGH_MAT_BASE * Math.pow(EQUIP_BREAKTHROUGH_MAT_MULT, currentLevel);

      if (p.gold < cost) return { error: 'not_enough_gold', cost, gold: p.gold };
      if (!p.inventory) p.inventory = [];
      const matCount = p.inventory.filter(i => i.name === matName).length;
      if (matCount < matNeeded) return { error: 'not_enough_material', matName, needed: matNeeded, have: matCount };

      // 扣除消耗
      p.gold -= cost;
      for (let i = 0; i < matNeeded; i++) {
        const idx = p.inventory.findIndex(it => it.name === matName);
        if (idx >= 0) p.inventory.splice(idx, 1);
      }

      const success = Math.random() < rate;
      if (success) {
        equip.breakthroughLevel = currentLevel + 1;
        // 属性提升
        const origAtk = equip.attack || 0;
        const origDef = equip.defense || 0;
        const origHp = equip.hp || 0;
        const origMp = equip.mp || 0;
        equip.attack = Math.floor((equip.attack || 0) * EQUIP_BREAKTHROUGH_MULT);
        equip.defense = Math.floor((equip.defense || 0) * EQUIP_BREAKTHROUGH_MULT);
        equip.hp = Math.floor((equip.hp || 0) * EQUIP_BREAKTHROUGH_MULT);
        equip.mp = Math.floor((equip.mp || 0) * EQUIP_BREAKTHROUGH_MULT);

        // 随机额外词条
        let bonusAttr = null;
        if (Math.random() < EQUIP_BREAKTHROUGH_BONUS_CHANCE) {
          const template = BONUS_ATTRS[Math.floor(Math.random() * BONUS_ATTRS.length)];
          const value = template.min + Math.floor(Math.random() * (template.max - template.min));
          bonusAttr = { ...template, value };
          if (!equip.bonusAttrs) equip.bonusAttrs = [];
          equip.bonusAttrs.push(bonusAttr);
        }

        recalcStats(p);
        savePlayer(p);
        return {
          success: true,
          newLevel: equip.breakthroughLevel,
          rate: Math.round(rate * 100),
          cost,
          matNeeded,
          matName,
          bonusAttr,
          stats: {
            attack: { before: origAtk, after: equip.attack },
            defense: { before: origDef, after: equip.defense },
            hp: { before: origHp, after: equip.hp },
            mp: { before: origMp, after: equip.mp },
          }
        };
      } else {
        savePlayer(p);
        return {
          success: false,
          rate: Math.round(rate * 100),
          cost,
          matNeeded,
          matName,
        };
      }
    },
    // 分解装备获得突破材料
    dismantleEquip: (socketId, slot) => {
      const p = players.get(socketId);
      if (!p) return null;
      const equip = p.equipment?.[slot];
      if (!equip) return { error: 'no_equipment' };
      if (equip.quality === 'common' || equip.quality === 'uncommon') return { error: 'too_low_quality' };

      const matConfig = BREAKTHROUGH_MATERIALS[equip.quality];
      const matName = matConfig ? matConfig.name : `${equip.quality}碎片`;
      // 分解获得材料数量 = 品质基础 × (1 + 突破等级)
      const baseCount = { legendary: 5, mythic: 10, divine: 20 }[equip.quality] || 5;
      const count = baseCount * (1 + (equip.breakthroughLevel || 0));

      // 卸下装备
      const unequipped = unequipItem(p, slot);
      if (!unequipped) return { error: 'unequip_failed' };

      // 添加材料到背包
      for (let i = 0; i < count; i++) {
        p.inventory.push({ name: matName, type: 'material', quality: equip.quality, count: 1 });
      }

      recalcStats(p);
      savePlayer(p);
      return { success: true, matName, count, itemName: unequipped.name };
    },
    clearMapMonsters: (mapId) => {
      for (const [id, m] of monsters) {
        if (m.mapId === mapId) monsters.delete(id);
      }
    },
    spawnMonstersForMap: (mapId, count) => {
      spawnMonsters(mapId, count);
    },
    // 副本
    enterDungeon, attackDungeonMonster, getDungeonState, exitDungeon,
    // 公会
    createGuild, joinGuild, leaveGuild, getGuildInfo, getGuildList,
    // PK
    attackPlayer, getPkStatus, isInSafeZone,
    // 世界BOSS
    initWorldBosses, getWorldBossState, WORLDBOSS_DB, onWorldBossDefeated, clearWorldBossMonsters,
    removePlayer: (socketId) => players.delete(socketId),
    getSkillCooldowns: (socketId) => playerSkillCooldowns.get(socketId) || {},
    // 强化
    enhanceEquipment: (socketId, slot) => {
      const p = players.get(socketId);
      if (!p) return null;
      const item = p.equipment?.[slot];
      if (!item) return { error: 'no_equipment', slot };
      const cur = item.enhanceLevel || 0;
      if (cur >= MAX_ENHANCE) return { error: 'max_enhance' };
      const cost = ENHANCE_COST(cur);
      if (p.gold < cost) return { error: 'not_enough_gold', cost, gold: p.gold };
      p.gold -= cost;
      const success = Math.random() < ENHANCE_RATES[cur];
      if (success) {
        item.enhanceLevel = cur + 1;
        recalcStats(p);
      }
      savePlayer(p);
      return { success, enhanceLevel: success ? cur + 1 : cur, cost, slot };
    },
    // 镶嵌宝石
    socketGem: (socketId, itemSlot, gemIndex) => {
      const p = players.get(socketId);
      if (!p) return null;
      const item = p.equipment?.[itemSlot];
      if (!item) return { error: 'no_equipment' };
      if (!item.gems) item.gems = [];
      const maxSockets = SOCKET_LIMIT[item.quality] || 0;
      if (item.gems.length >= maxSockets) return { error: 'no_sockets_left', max: maxSockets };
      const gem = p.inventory?.[gemIndex];
      if (!gem || gem.type !== 'gem') return { error: 'invalid_gem' };
      const cost = SOCKET_COST(item.levelReq || 1);
      if (p.gold < cost) return { error: 'not_enough_gold', cost, gold: p.gold };
      p.gold -= cost;
      p.inventory.splice(gemIndex, 1);
      item.gems.push({ id: gem.id, name: gem.name, attack: gem.attack||0, defense: gem.defense||0, hp: gem.hp||0, mp: gem.mp||0 });
      recalcStats(p);
      savePlayer(p);
      return { success: true, slot: itemSlot, gems: item.gems, gold: p.gold };
    },
    // 卸下宝石
    removeGem: (socketId, itemSlot, gemIndex) => {
      const p = players.get(socketId);
      if (!p) return null;
      const item = p.equipment?.[itemSlot];
      if (!item || !item.gems?.[gemIndex]) return { error: 'no_gem' };
      if (p.gold < REMOVE_GEM_COST) return { error: 'not_enough_gold', cost: REMOVE_GEM_COST, gold: p.gold };
      p.gold -= REMOVE_GEM_COST;
      const gem = item.gems.splice(gemIndex, 1)[0];
      if (!p.inventory) p.inventory = [];
      p.inventory.push({ id: gem.id, name: gem.name, type: 'gem', attack: gem.attack, defense: gem.defense, hp: gem.hp, mp: gem.mp, quality: 'rare' });
      recalcStats(p);
      savePlayer(p);
      return { success: true, slot: itemSlot, gems: item.gems, gold: p.gold, returnedGem: gem.name };
    },
    // 鉴定装备
    appraiseEquipment: (socketId, scrollQuality, itemIndex) => {
      const p = players.get(socketId);
      if (!p || !p.inventory?.[itemIndex]) return null;
      const item = p.inventory[itemIndex];
      if (item.appraised) return { error: 'already_appraised' };
      if (item.type === 'potion' || item.type === 'gem' || item.type === 'scroll') return { error: 'not_equipment' };
      const scroll = Object.values(APPRAISE_SCROLLS).find(s => s.quality === scrollQuality);
      if (!scroll) return { error: 'invalid_scroll' };
      // 从背包移除鉴定符
      const scrollIdx = p.inventory.findIndex(i => i.id === scroll.id);
      if (scrollIdx < 0) return { error: 'no_scroll' };
      p.inventory.splice(scrollIdx, 1);
      // 随机鉴定属性
      const count = APPRAISE_COUNTS[scrollQuality];
      const ranges = APPRAISE_RANGES[scrollQuality];
      const attrs = [];
      const shuffled = [...APPRAISE_ATTRS].sort(() => Math.random() - 0.5);
      for (let i = 0; i < count && i < shuffled.length; i++) {
        const attr = shuffled[i];
        const [min, max] = ranges[attr];
        const val = min + Math.floor(Math.random() * (max - min + 1));
        item[attr] = (item[attr] || 0) + val;
        attrs.push({ name: attr, value: val });
      }
      item.appraised = true;
      item.appraiseQuality = scrollQuality;
      recalcStats(p);
      savePlayer(p);
      return { success: true, item, attrs, gold: p.gold };
    },
    // 喝祝福油（增加幸运值）
    blessOil: (socketId, itemSlot) => {
      const p = players.get(socketId);
      if (!p) return null;
      const item = p.equipment?.[itemSlot];
      if (!item) return { error: 'no_equipment' };
      if (itemSlot !== 'weapon' && itemSlot !== 'necklace') return { error: 'invalid_slot' };
      const currentLucky = item.lucky || 0;
      if (currentLucky >= LUCKY_MAX) return { error: 'max_lucky' };
      // 从背包找祝福油
      const oilIdx = p.inventory.findIndex(i => i.id === 'bless_oil');
      if (oilIdx < 0) return { error: 'no_oil' };
      p.inventory.splice(oilIdx, 1);
      // 幸运值+1，有概率失败
      const success = Math.random() < (currentLucky >= 5 ? 0.5 : 0.8);
      if (success) {
        item.lucky = currentLucky + 1;
        recalcStats(p);
      }
      savePlayer(p);
      return { success, lucky: success ? item.lucky : currentLucky, gold: p.gold };
    },
    // 转生/突破 - 无限境界
    breakthrough: (socketId) => {
      const p = players.get(socketId);
      if (!p) return null;
      const realm = p.cultivationRealm || 0;
      const stage = p.cultivationStage || 1;
      if (p.level < BREAKTHROUGH_LEVEL_REQ) return { error: 'level_too_low', required: BREAKTHROUGH_LEVEL_REQ };
      const cost = REALM_COST(realm, stage);
      if (p.gold < cost) return { error: 'not_enough_gold', cost, gold: p.gold };
      p.gold -= cost;
      // 突破逻辑：每9重进入下一境界，无限循环
      let newStage = stage + 1;
      let newRealm = realm;
      if (newStage > 9) {
        newStage = 1;
        newRealm++;
      }
      p.cultivationRealm = newRealm;
      p.cultivationStage = newStage;
      const realmName = REALM_NAMES[newRealm] || `第${newRealm + 1}境`;
      // 不再重置等级，继续累积
      // recalcStats 会基于基础属性重新计算
      recalcStats(p);

      // 突破后属性倍率：前19境保持原公式，20境开始指数增长
      let mult;
      if (newRealm < 19) {
        mult = REALM_MULT(newRealm);
      } else {
        // 第20境开始，每境×2，基于第19境的倍率
        mult = REALM_MULT(18) * Math.pow(2, newRealm - 18);
      }
      p.max_hp = Math.floor(p.max_hp * mult);
      p.max_mp = Math.floor(p.max_mp * mult);
      p.attack = Math.floor(p.attack * mult);
      p.defense = Math.floor(p.defense * mult);
      p.hp = p.max_hp;
      p.mp = p.max_mp;
      savePlayer(p);
      return { success: true, realm: newRealm, stage: newStage, realmName, mult };
    },
    // 挖矿
    mineOre: (socketId, spotIdx) => {
      const p = players.get(socketId);
      if (!p) return null;
      if (p.map_id !== 'zombie_cave') return { error: 'wrong_map' };
      const lastMine = p.lastMineTime || 0;
      if (Date.now() - lastMine < MINE_COOLDOWN) {
        return { error: 'on_cooldown', remaining: Math.ceil((MINE_COOLDOWN - (Date.now() - lastMine)) / 1000) };
      }
      p.lastMineTime = Date.now();
      const success = Math.random() < MINE_SUCCESS_RATE;
      if (!success) return { success: false, message: '挖矿失败，再试一次' };
      // 随机产出矿石
      const weights = [40, 25, 20, 10, 5]; // 铜/铁/银/金/陨铁
      let r = Math.random() * 100;
      let oreIdx = 0;
      for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) { oreIdx = i; break; } }
      const ore = { ...ORE_DB[oreIdx] };
      if (!p.inventory) p.inventory = [];
      p.inventory.push(ore);
      // 挖矿获得少量经验
      const expGain = 10 + Math.floor(Math.random() * 20);
      p.exp += expGain;
      savePlayer(p);
      return { success: true, ore: ore.name, exp: expGain, gold: p.gold };
    },
    getReputation,
    addReputation,
    getLeaderboard,
    synthEquipment,
    getDailyActivities,
    completeDaily,
    getAchievements,
    checkAchievements,
    // 英雄
    unlockHero,
    getHero,
    heroAttack,
    // 沙巴克攻城战
    startSabakSiege,
    attackSabakGate,
    completeSabakSiege,
    getSabakState,
    // 师徒
    becomeApprentice,
    getMasterInfo,
    getApprentices,
    // 经脉
    getMeridianState,
    openMeridian,
    // 坐骑翅膀
    buyMount,
    buyWings,
    proposeMarriage,
    getMarriageInfo,
    divorce,
    teleportToPartner,
    startEscort,
    updateEscort,
    completeEscort,
    // 摆摊
    listStallItem: doListStallItem,
    getAllStalls: doGetAllStalls,
    buyStallItem: doBuyStallItem,
    // 无尽副本
    enterEndlessDungeon,
    exitEndlessDungeon,
    attackEndlessMonster,
    getEndlessProgress,
  };
}

module.exports = { createGameEngine, SHOP_ITEMS, POTIONS, SKILLS, EQUIPMENT_SETS, ZODIAC_SETS, WUXING_SETS, EQUIPMENT_DB, EQUIPMENT_SLOTS, QUALITY_NAMES, QUALITY_COLORS, MAPS, MONSTER_TEMPLATES, SOCKET_LIMIT, ENHANCE_COST, ENHANCE_BONUS_PCT, MAX_ENHANCE, REMOVE_GEM_COST, GEM_DB, WORLDBOSS_DB, APPRAISE_SCROLLS, APPRAISE_ATTRS, APPRAISE_RANGES, APPRAISE_COUNTS, LUCKY_MAX, LUCKY_TARGET, ORE_DB, MINE_SPOTS, MINE_DURATION, MINE_COOLDOWN, REALM_NAMES, REALM_MULT, REALM_COST, BREAKTHROUGH_LEVEL_REQ };
