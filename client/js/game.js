const socket = io();
const state = {
  player: null, monsters: [], otherPlayers: [], npcs: [], items: [],
  selectedMonster: null, selectedClass: 'warrior',
  classes: null, equipInfo: null, dungeons: null,
  keys: {}, camera: { x: 0, y: 0 }, damageNumbers: [], running: false,
  connected: false, autoAttack: false, autoAttackTimer: null,
  afkMode: false, afkTimer: null, afkTargetId: null,
  currentDungeon: null, currentMap: 'bichon', chatTab: 'world',
  shopCategory: 'potion',
  // 视觉效果
  particles: [], effects: [], time: 0,
  // 技能冷却
  skillCooldowns: {},
};

// 技能图标映射（仅用于显示）
const SKILL_ICONS = {
  fire_sword: '🔥', double_strike: '⚔️', fierce_sword: '💫', berserk: '💢',
  fireball: '🔥', ice_storm: '❄️', lightning: '⚡', meteor: '☄️',
  heal: '💚', poison: '☠️', summon: '💀', soul_strike: '🔮',
};
const SKILL_KEYS = ['1', '2', '3', '4'];

function getClientSkills(pClass) {
  const cls = state.classes?.[pClass];
  if (!cls) return [];
  return cls.skills.map((s, i) => ({
    id: s.id, name: s.name, class: pClass, levelReq: s.level,
    mpCost: s.mpCost, cooldown: s.cooldown * 1000,
    key: SKILL_KEYS[i] || `${i+1}`,
    description: s.desc, icon: SKILL_ICONS[s.id] || '✨',
    damageMult: s.damageMult, healPercent: s.healPct || 0, summon: s.summon,
  }));
}

const SOCKET_LIMIT = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 3 };
const APPRAISE_SCROLLS = {
  1: { id: 'appraise_normal', name: '鉴定符(普通)', price: 200 },
  2: { id: 'appraise_high', name: '鉴定符(高级)', price: 800 },
  3: { id: 'appraise_supreme', name: '鉴定符(至尊)', price: 2000 },
};
const LUCKY_MAX = 7;
const MINE_COOLDOWN = 5000;
const BREAKTHROUGH_LEVEL_REQ = 50;

// 挖矿NPC
const MINER_NPC = { name: '矿工头领', icon: '⛏️', dialog: '这里是矿区，点击矿点可以挖矿', spots: true };
const REMOVE_GEM_COST = 500;

const GEM_DB = [
  { id: 'gem_attack', name: '攻击宝石', type: 'gem', attack: 5, price: 500, quality: 'rare' },
  { id: 'gem_defense', name: '防御宝石', type: 'gem', defense: 5, price: 500, quality: 'rare' },
  { id: 'gem_hp', name: '生命宝石', type: 'gem', hp: 50, price: 500, quality: 'rare' },
  { id: 'gem_mp', name: '魔法宝石', type: 'gem', mp: 30, price: 500, quality: 'rare' },
];

const WORLDBOSS_REFRESH_INTERVAL = 30000; // 30秒刷新状态

function ENHANCE_STAT_BONUS(level) {
  if (level <= 0) return 0;
  if (level <= 3) return 0.15;
  if (level <= 6) return 0.20;
  if (level <= 9) return 0.25;
  return 0.30;
}

const MAPS = {
  bichon: { name: '比奇城', width: 100, height: 80, safeZone: {x1:40,y1:40,x2:60,y2:60}, color: '#2d5a1e', colorDark: '#1a3a0e', npcColor: '#88cc44', wallColor: '#5a4a3a', groundPattern: 'grass', npcs: ['weapon_smith','armor_smith','jewelry_smith','pharmacy','warehouse','blacksmith','recycler','teleporter','stall_master','rep_master','synth_master','activity_master','escort_npc','marriage_npc','meridian_npc','mount_npc','apprentice_npc','hero_npc','siege_npc'] },
  mengzhong: { name: '盟重土城', width: 80, height: 60, safeZone: {x1:30,y1:20,x2:50,y2:40}, color: '#8a7a3e', colorDark: '#5a4a1e', npcColor: '#ddcc88', wallColor: '#7a6a4a', groundPattern: 'desert', npcs: ['weapon_smith','potion_shop','guild_master','warehouse','blacksmith','teleporter','stall_master'] },
  zombie_cave: { name: '僵尸洞', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#2a2a3a', colorDark: '#1a1a2a', npcColor: '#8888aa', wallColor: '#4a4a5a', groundPattern: 'cave', npcs: ['teleporter','miner'] },
  woma_temple: { name: '沃玛寺庙', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a2a1a', colorDark: '#2a1a0a', npcColor: '#cc8844', wallColor: '#6a4a3a', groundPattern: 'temple', npcs: ['teleporter'] },
  pig_cave: { name: '石墓阵', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#3a2a2a', colorDark: '#2a1a1a', npcColor: '#aa8866', wallColor: '#5a4a3a', groundPattern: 'cave', npcs: ['teleporter'] },
  fengmo: { name: '封魔谷', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#2a1a3a', colorDark: '#1a0a2a', npcColor: '#aa66cc', wallColor: '#4a3a5a', groundPattern: 'temple', npcs: ['teleporter'] },
  zumma: { name: '祖玛寺庙', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#3a3a2a', colorDark: '#2a2a1a', npcColor: '#cccc88', wallColor: '#5a5a4a', groundPattern: 'temple', npcs: ['teleporter'] },
  redmoon: { name: '赤月峡谷', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#3a0a0a', colorDark: '#2a0a0a', npcColor: '#cc4444', wallColor: '#5a2a2a', groundPattern: 'cave', npcs: ['teleporter'] },
  bull: { name: '牛魔寺庙', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a2a1a', colorDark: '#2a1a0a', npcColor: '#cc8844', wallColor: '#6a4a3a', groundPattern: 'temple', npcs: ['teleporter'] },
  cangyue: { name: '苍月岛', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#0a2a3a', colorDark: '#0a1a2a', npcColor: '#44aacc', wallColor: '#2a4a5a', groundPattern: 'grass', npcs: ['teleporter'] },
  shaba: { name: '沙巴克城', width: 80, height: 60, safeZone: {x1:35,y1:35,x2:45,y2:45}, color: '#3a3a3a', colorDark: '#2a2a2a', npcColor: '#cccccc', wallColor: '#5a5a5a', groundPattern: 'temple', npcs: ['teleporter'] },
  // 生肖神殿10层
  zodiac_floor_1: { name: '生肖神殿·1层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#3a2a4a', colorDark: '#2a1a3a', npcColor: '#ffcc44', wallColor: '#5a4a6a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_2: { name: '生肖神殿·2层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a2a3a', colorDark: '#3a1a2a', npcColor: '#ffcc44', wallColor: '#6a4a5a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_3: { name: '生肖神殿·3层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a3a2a', colorDark: '#3a2a1a', npcColor: '#ffcc44', wallColor: '#6a5a4a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_4: { name: '生肖神殿·4层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#2a3a4a', colorDark: '#1a2a3a', npcColor: '#ffcc44', wallColor: '#4a5a6a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_5: { name: '生肖神殿·5层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#2a4a3a', colorDark: '#1a3a2a', npcColor: '#ffcc44', wallColor: '#4a6a5a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_6: { name: '生肖神殿·6层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a2a4a', colorDark: '#3a1a3a', npcColor: '#ffcc44', wallColor: '#6a4a6a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_7: { name: '生肖神殿·7层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a4a2a', colorDark: '#3a3a1a', npcColor: '#ffcc44', wallColor: '#6a6a4a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_8: { name: '生肖神殿·8层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#2a2a4a', colorDark: '#1a1a3a', npcColor: '#ffcc44', wallColor: '#4a4a6a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_9: { name: '生肖神殿·9层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a3a4a', colorDark: '#3a2a3a', npcColor: '#ffcc44', wallColor: '#6a5a6a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  zodiac_floor_10: { name: '生肖神殿·10层', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a4a4a', colorDark: '#3a3a3a', npcColor: '#ffcc44', wallColor: '#6a6a6a', groundPattern: 'temple', npcs: ['teleporter','zodiac_guide'] },
  wuxing_palace: { name: '五行神殿', width: 100, height: 80, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#2a3a4a', colorDark: '#1a2a3a', npcColor: '#44ccff', wallColor: '#4a5a6a', groundPattern: 'temple', npcs: ['teleporter'] },
  heaven: { name: '天界', width: 120, height: 100, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#4a4a6a', colorDark: '#2a2a4a', npcColor: '#ffdd44', wallColor: '#6a6a8a', groundPattern: 'cloud', npcs: ['teleporter'] },
  abyss: { name: '混沌之渊', width: 120, height: 100, safeZone: {x1:5,y1:5,x2:15,y2:15}, color: '#3a0a0a', colorDark: '#2a0505', npcColor: '#ff4444', wallColor: '#5a1a1a', groundPattern: 'lava', npcs: ['teleporter'] },
  dungeon_cave: { name: '矿洞副本', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:12,y2:12}, color: '#2a2a3a', colorDark: '#1a1a2a', npcColor: '#8888aa', wallColor: '#4a4a5a', groundPattern: 'cave', npcs: [] },
  dungeon_woma: { name: '沃玛副本', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:12,y2:12}, color: '#4a2a1a', colorDark: '#2a1a0a', npcColor: '#cc8844', wallColor: '#6a4a3a', groundPattern: 'temple', npcs: [] },
  dungeon_zumma: { name: '祖玛副本', width: 80, height: 60, safeZone: {x1:5,y1:5,x2:12,y2:12}, color: '#3a3a2a', colorDark: '#2a2a1a', npcColor: '#cccc88', wallColor: '#5a5a4a', groundPattern: 'temple', npcs: [] },
};

const NPC_DEFS = {
  weapon_smith: { name: '武器店老板', icon: '🔨', dialog: '要买武器还是卖装备？', options: [{text:'打开商店',action:'shop_weapon'},{text:'回收装备',action:'recycle'},{text:'再见',action:'close'}] },
  armor_smith: { name: '盔甲店老板', icon: '🛡️', dialog: '来看看护甲吧', options: [{text:'打开商店',action:'shop_armor'},{text:'回收装备',action:'recycle'},{text:'再见',action:'close'}] },
  jewelry_smith: { name: '首饰店老板', icon: '💍', dialog: '来看看首饰吧', options: [{text:'打开商店',action:'shop_jewelry'},{text:'回收装备',action:'recycle'},{text:'再见',action:'close'}] },
  pharmacy: { name: '药店老板', icon: '💊', dialog: '需要买药吗？', options: [{text:'买金疮药(50金币,回50HP)',action:'buy_hp'},{text:'买魔法药(30金币,回30MP)',action:'buy_mp'},{text:'再见',action:'close'}] },
  potion_shop: { name: '药品商人', icon: '🧪', dialog: '各种药品应有尽有', options: [{text:'金疮药(50金币)',action:'buy_hp'},{text:'魔法药(30金币)',action:'buy_mp'},{text:'太阳水(100金币,全满)',action:'buy_sunwater'},{text:'再见',action:'close'}] },
  guild_master: { name: '行会管理员', icon: '🏛️', dialog: '要创建或加入行会吗？', options: [{text:'创建行会(100金币)',action:'create_guild'},{text:'查看行会',action:'view_guild'},{text:'再见',action:'close'}] },
  teleporter: { name: '传送使者', icon: '🌀', dialog: '要去哪里？', options: [
    {text:'传送到比奇城',action:'teleport_bichon'},{text:'传送到盟重土城',action:'teleport_mengzhong'},
    {text:'传送到僵尸洞',action:'teleport_zombie'},{text:'传送到沃玛寺庙',action:'teleport_woma'},
    {text:'传送到石墓阵',action:'teleport_pig_cave'},{text:'传送到封魔谷',action:'teleport_fengmo'},
    {text:'传送到祖玛寺庙',action:'teleport_zumma'},
    {text:'传送到赤月峡谷',action:'teleport_redmoon'},{text:'传送到牛魔寺庙',action:'teleport_bull'},
    {text:'传送到苍月岛',action:'teleport_cangyue'},{text:'传送到沙巴克城',action:'teleport_shaba'},
    {text:'传送到生肖神殿1层',action:'teleport_zodiac_1'},
    {text:'传送到五行神殿',action:'teleport_wuxing'},
    {text:'传送到天界(200级+)',action:'teleport_heaven'},
    {text:'传送到混沌之渊(300级+)',action:'teleport_abyss'},
    {text:'⚔ 进入无尽副本',action:'open_endless_dungeon'},
    {text:'再见',action:'close'}
  ]},
  zodiac_guide: { name: '生肖引路人', icon: '🐉', dialog: '要前往哪一层？', options: [
    {text:'传送到1层',action:'zodiac_1'},{text:'传送到2层',action:'zodiac_2'},
    {text:'传送到3层',action:'zodiac_3'},{text:'传送到4层',action:'zodiac_4'},
    {text:'传送到5层',action:'zodiac_5'},{text:'传送到6层',action:'zodiac_6'},
    {text:'传送到7层',action:'zodiac_7'},{text:'传送到8层',action:'zodiac_8'},
    {text:'传送到9层',action:'zodiac_9'},{text:'传送到10层',action:'zodiac_10'},
    {text:'再见',action:'close'}
  ]},
  recycler: { name: '回收商人', icon: '♻️', dialog: '回收装备换金币', options: [{text:'一键回收',action:'recycle'},{text:'再见',action:'close'}] },
  warehouse: { name: '仓库管理员', icon: '📦', dialog: '需要存取物品吗？', options: [{text:'存入装备',action:'warehouse_deposit'},{text:'取出装备',action:'warehouse_withdraw'},{text:'再见',action:'close'}] },
  blacksmith: { name: '铁匠', icon: '⚒️', dialog: '可以强化装备、镶嵌宝石', options: [{text:'强化装备',action:'upgrade_equip'},{text:'装备突破',action:'breakthrough_equip_menu'},{text:'分解装备',action:'dismantle_equip_menu'},{text:'镶嵌宝石',action:'socket_gem_menu'},{text:'卸下宝石',action:'remove_gem_menu'},{text:'鉴定装备',action:'appraise_menu'},{text:'喝祝福油',action:'bless_menu'},{text:'再见',action:'close'}] },
  miner: { name: '矿工头领', icon: '⛏️', dialog: '矿区有8个矿点，点击开始挖矿', options: [{text:'开始挖矿',action:'start_mining'},{text:'出售矿石',action:'sell_ore'},{text:'再见',action:'close'}] },
  stall_master: { name: '摊主', icon: '🏪', dialog: '摆摊交易系统', options: [{text:'摆摊',action:'open_stall'},{text:'逛摊位',action:'browse_stalls'},{text:'再见',action:'close'}] },
  rep_master: { name: '声望使者', icon: '🎖️', dialog: '查看声望和排行榜', options: [{text:'我的声望',action:'check_reputation'},{text:'等级榜',action:'lb_level'},{text:'战力榜',action:'lb_combat'},{text:'财富榜',action:'lb_gold'},{text:'再见',action:'close'}] },
  synth_master: { name: '炼金术士', icon: '⚗️', dialog: '装备合成服务', options: [{text:'合成装备',action:'open_synth'},{text:'再见',action:'close'}] },
  activity_master: { name: '活动大使', icon: '🎁', dialog: '每日活动和成就', options: [{text:'每日活动',action:'daily_activities'},{text:'我的成就',action:'my_achievements'},{text:'再见',action:'close'}] },
  escort_npc: { name: '镖师', icon: '🐴', dialog: '押镖护送任务', options: [{text:'开始押镖',action:'start_escort'},{text:'完成任务',action:'complete_escort'},{text:'再见',action:'close'}] },
  marriage_npc: { name: '月老', icon: '💝', dialog: '姻缘天注定', options: [{text:'求婚',action:'propose_marriage'},{text:'查看婚姻',action:'marriage_info'},{text:'传送伴侣',action:'teleport_partner'},{text:'离婚',action:'divorce'},{text:'再见',action:'close'}] },
  meridian_npc: { name: '经脉导师', icon: '🧘', dialog: '打通经脉获得属性', options: [{text:'查看经脉',action:'show_meridians'},{text:'再见',action:'close'}] },
  mount_npc: { name: '坐骑商人', icon: '🐎', dialog: '购买坐骑和翅膀', options: [{text:'购买黄骠马(2000💰)',action:'buy_horse'},{text:'购买赤兔马(10000💰)',action:'buy_redhare'},{text:'购买初翼(3000💰)',action:'buy_wings_small'},{text:'购买魔神之翼(30000💰)',action:'buy_wings_demon'},{text:'再见',action:'close'}] },
  apprentice_npc: { name: '引路人', icon: '👴', dialog: '师徒传承', options: [{text:'拜师',action:'find_master'},{text:'查看师傅',action:'check_master'},{text:'查看徒弟',action:'check_apprentices'},{text:'再见',action:'close'}] },
  hero_npc: { name: '元神导师', icon: '👻', dialog: '解锁元神协助战斗', options: [{text:'解锁战神护卫(战士)',action:'unlock_hero_warrior'},{text:'解锁灵法侍从(法师)',action:'unlock_hero_mage'},{text:'解锁道灵童子(道士)',action:'unlock_hero_taoist'},{text:'查看元神',action:'view_hero'},{text:'元神攻击(当前目标)',action:'hero_attack_target'},{text:'再见',action:'close'}] },
  siege_npc: { name: '攻城统领', icon: '🏰', dialog: '沙巴克攻城战', options: [{text:'发起攻城',action:'start_siege'},{text:'攻击正门',action:'attack_main_gate'},{text:'攻击侧门',action:'attack_side_gate'},{text:'结束攻城',action:'complete_siege'},{text:'查看状态',action:'view_siege'},{text:'再见',action:'close'}] },
};

const SHOP_ITEMS = {
  potion: [
    {id:'small_hp',name:'金创药(小)',price:50,type:'potion',effect:{hp:50}},
    {id:'medium_hp',name:'金创药(中)',price:150,type:'potion',effect:{hp:150}},
    {id:'large_hp',name:'金创药(大)',price:350,type:'potion',effect:{hp:300}},
    {id:'small_mp',name:'魔法药水(小)',price:60,type:'potion',effect:{mp:30}},
    {id:'medium_mp',name:'魔法药水(中)',price:180,type:'potion',effect:{mp:100}},
    {id:'large_mp',name:'魔法药水(大)',price:400,type:'potion',effect:{mp:200}},
    {id:'sun',name:'太阳水',price:500,type:'potion',effect:{hp:200,mp:100}},
    {id:'great_sun',name:'万年雪霜',price:1500,type:'potion',effect:{hp:500,mp:300}},
  ],
  material: [
    {id:'appraise_normal',name:'鉴定符(普通)',price:200,type:'scroll'},
    {id:'appraise_high',name:'鉴定符(高级)',price:800,type:'scroll'},
    {id:'appraise_supreme',name:'鉴定符(至尊)',price:2000,type:'scroll'},
    {id:'bless_oil',name:'祝福油',price:300,type:'material'},
    {id:'wedding_ring',name:'求婚戒指',price:5000,type:'material'},
  ],
  weapon: [
    {id:'wood_sword',name:'木剑',price:100,type:'weapon',attack:2,quality:'common'},
    {id:'iron_sword',name:'铁剑',price:500,type:'weapon',attack:5,quality:'common'},
    {id:'steel_sword',name:'炼狱战斧',price:1500,type:'weapon',attack:15,quality:'rare'},
  ],
  armor: [
    {id:'cloth_armor',name:'布甲',price:200,type:'armor',defense:2,quality:'common'},
    {id:'iron_armor',name:'重盔甲',price:800,type:'armor',defense:6,quality:'uncommon'},
    {id:'dragon_armor',name:'天魔神甲',price:3000,type:'armor',defense:12,quality:'rare'},
  ],
  jewelry: [
    {id:'copper_neck',name:'铜项链',price:150,type:'jewelry',defense:1,quality:'common'},
    {id:'gold_neck',name:'金项链',price:400,type:'jewelry',defense:2,hp:10,quality:'uncommon'},
    {id:'copper_ring',name:'铜戒指',price:100,type:'jewelry',hp:5,quality:'common'},
    {id:'gold_ring',name:'金戒指',price:300,type:'jewelry',hp:15,defense:2,quality:'uncommon'},
    {id:'iron_brace',name:'铁手镯',price:120,type:'jewelry',defense:1,quality:'common'},
    {id:'silver_brace',name:'银手镯',price:250,type:'jewelry',defense:2,quality:'uncommon'},
  ],
};

// 登录后可从服务端更新商店数据

const MAP = { width: 100, height: 80, tileSize: 48, tiles: [] };

function generateMap() {
  const mapDef = MAPS[state.currentMap] || MAPS.bichon;
  MAP.width = mapDef.width; MAP.height = mapDef.height;
  for (let y = 0; y < MAP.height; y++) {
    MAP.tiles[y] = [];
    for (let x = 0; x < MAP.width; x++) {
      const edge = x < 1 || x >= MAP.width-1 || y < 1 || y >= MAP.height-1;
      MAP.tiles[y][x] = edge ? 1 : (Math.random() < 0.03 ? 2 : Math.random() < 0.02 ? 3 : Math.random() < 0.01 ? 4 : 0);
    }
  }
  // 安全区清空
  const sz = mapDef.safeZone;
  for (let y = sz.y1; y <= sz.y2; y++) for (let x = sz.x1; x <= sz.x2; x++) MAP.tiles[y][x] = 0;
}

function spawnNPCs() {
  state.npcs = [];
  const mapDef = MAPS[state.currentMap] || MAPS.bichon;
  const sz = mapDef.safeZone;
  mapDef.npcs.forEach((npcId, i) => {
    // 在安全区内均匀分布
    const padding = 3;
    const width = sz.x2 - sz.x1 - padding * 2;
    const height = sz.y2 - sz.y1 - padding * 2;
    const cols = Math.max(2, Math.ceil(Math.sqrt(mapDef.npcs.length * (width / height))));
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = sz.x1 + padding + (col * width / Math.max(1, cols - 1));
    const y = sz.y1 + padding + (row * height / Math.max(1, Math.ceil(mapDef.npcs.length / cols) - 1));
    state.npcs.push({
      id: npcId, ...NPC_DEFS[npcId],
      x: Math.max(sz.x1 + 1, Math.min(sz.x2 - 1, x)),
      y: Math.max(sz.y1 + 1, Math.min(sz.y2 - 1, y)),
    });
  });
}

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas); resizeCanvas();

// 预计算种子，确保地面纹理一致
const tileSeeds = [];
for (let i = 0; i < 200; i++) tileSeeds[i] = Math.random() * 1000;

function render() {
  if (!state.running) return;
  state.time += 0.02;
  const cw = canvas.width, ch = canvas.height, ts = MAP.tileSize;
  if (state.player) { state.camera.x = state.player.x * ts - cw/2; state.camera.y = state.player.y * ts - ch/2; }
  ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, cw, ch);
  const camX = state.camera.x, camY = state.camera.y;
  const mapDef = MAPS[state.currentMap] || MAPS.bichon;
  const startX = Math.max(0, Math.floor(camX/ts)), startY = Math.max(0, Math.floor(camY/ts));
  const endX = Math.min(MAP.width, startX + Math.ceil(cw/ts) + 2), endY = Math.min(MAP.height, startY + Math.ceil(ch/ts) + 2);

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const sx = x*ts - camX, sy = y*ts - camY;
      const tile = MAP.tiles[y][x];
      const inSafe = state.currentMap && isSafeZone(x, y);
      const seed = tileSeeds[(x * 7 + y * 13) % 200];

      // 地面绘制 - 根据地图类型
      if (inSafe) {
        // 安全区石板路
        ctx.fillStyle = '#5a5a4a'; ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = '#6a6a5a';
        ctx.fillRect(sx+2, sy+2, ts/2-3, ts/2-3);
        ctx.fillRect(sx+ts/2+1, sy+ts/2+1, ts/2-3, ts/2-3);
        ctx.strokeStyle = '#4a4a3a'; ctx.lineWidth = 1;
        ctx.strokeRect(sx+2, sy+2, ts/2-3, ts/2-3);
        ctx.strokeRect(sx+ts/2+1, sy+ts/2+1, ts/2-3, ts/2-3);
      } else {
        // 野外地面
        ctx.fillStyle = (x+y)%2 === 0 ? mapDef.color : mapDef.colorDark;
        ctx.fillRect(sx, sy, ts+1, ts+1);

        // 地图纹理细节
        if (mapDef.groundPattern === 'grass') {
          // 草地 - 随机草点
          ctx.fillStyle = '#3a7a2e';
          for (let g = 0; g < 3; g++) {
            const gx = sx + ((seed + g * 31) % ts);
            const gy = sy + ((seed + g * 17) % ts);
            ctx.fillRect(gx, gy, 2, 4);
          }
        } else if (mapDef.groundPattern === 'desert') {
          // 沙漠 - 沙粒纹理
          ctx.fillStyle = '#9a8a4e';
          for (let g = 0; g < 4; g++) {
            const gx = sx + ((seed + g * 23) % ts);
            const gy = sy + ((seed + g * 19) % ts);
            ctx.fillRect(gx, gy, 1, 1);
          }
        } else if (mapDef.groundPattern === 'cave') {
          // 洞穴 - 岩石纹理
          ctx.fillStyle = '#3a3a4a';
          for (let g = 0; g < 2; g++) {
            const gx = sx + ((seed + g * 29) % (ts - 8));
            const gy = sy + ((seed + g * 13) % (ts - 8));
            ctx.fillRect(gx, gy, 8, 6);
          }
        } else if (mapDef.groundPattern === 'temple') {
          // 寺庙 - 地砖纹理
          ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 1;
          ctx.strokeRect(sx+2, sy+2, ts-4, ts-4);
          ctx.fillStyle = '#5a3a2a';
          ctx.fillRect(sx + ts/2 - 1, sy + 2, 2, ts - 4);
          ctx.fillRect(sx + 2, sy + ts/2 - 1, ts - 4, 2);
        }
      }

      // 障碍物
      if (tile === 1) {
        // 墙壁 - 3D效果
        ctx.fillStyle = mapDef.wallColor; ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = lightenColor(mapDef.wallColor, 30); ctx.fillRect(sx, sy, ts, 4);
        ctx.fillStyle = darkenColorHex(mapDef.wallColor, 20); ctx.fillRect(sx, sy+ts-4, ts, 4);
        // 砖块纹理
        ctx.strokeStyle = darkenColorHex(mapDef.wallColor, 10); ctx.lineWidth = 1;
        for (let by = 0; by < ts; by += 8) {
          ctx.beginPath(); ctx.moveTo(sx, sy+by); ctx.lineTo(sx+ts, sy+by); ctx.stroke();
        }
      } else if (tile === 2) {
        // 树 - 更好看
        ctx.fillStyle = '#2a5a1a'; ctx.beginPath(); ctx.arc(sx+ts/2, sy+ts/2+2, ts*0.38, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#1a4a0a'; ctx.beginPath(); ctx.arc(sx+ts/2-3, sy+ts/2-2, ts*0.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a2a0a'; ctx.fillRect(sx+ts/2-3, sy+ts/2+5, 6, 12);
        // 树叶高光
        ctx.fillStyle = '#4a8a2a'; ctx.beginPath(); ctx.arc(sx+ts/2+5, sy+ts/2-5, ts*0.12, 0, Math.PI*2); ctx.fill();
      } else if (tile === 3) {
        // 石头 - 3D效果
        ctx.fillStyle = '#6a6a6a'; ctx.beginPath(); ctx.arc(sx+ts/2, sy+ts/2+2, ts*0.28, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.arc(sx+ts/2-2, sy+ts/2, ts*0.18, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#4a4a4a'; ctx.beginPath(); ctx.arc(sx+ts/2+2, sy+ts/2+4, ts*0.15, 0, Math.PI*2); ctx.fill();
      } else if (tile === 4) {
        // 水 - 动画效果
        const waveOffset = Math.sin(state.time * 2 + x * 0.5 + y * 0.3) * 5;
        ctx.fillStyle = '#1a4a8a'; ctx.fillRect(sx, sy, ts, ts);
        ctx.fillStyle = '#2a6aaa'; ctx.fillRect(sx+waveOffset, sy+5, ts-10, 3);
        ctx.fillStyle = '#3a8acc'; ctx.fillRect(sx-waveOffset+10, sy+15, ts-20, 2);
      }
    }
  }

  // NPC - 添加光环
  state.npcs.forEach(n => {
    const sx = n.x * ts - camX, sy = n.y * ts - camY;
    // 光环
    const glowSize = 2 + Math.sin(state.time * 3) * 1;
    ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 10 + glowSize;
    ctx.font = '24px serif'; ctx.textAlign = 'center';
    ctx.fillText(n.icon, sx + ts/2, sy + ts/2 + 8);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 10px Microsoft YaHei';
    ctx.fillText(n.name, sx + ts/2, sy + ts + 14);
  });

  // 其他玩家
  for (const p of state.otherPlayers) drawCharacter(p.x*ts - camX, p.y*ts - camY, state.classes?.[p.class]?.color||'#4488ff', p.username, p.level, false, p.class);
  // 怪物
  for (const m of state.monsters) {
    const sx = m.x*ts - camX, sy = m.y*ts - camY;
    if (sx < -ts*2 || sx > cw+ts*2 || sy < -ts*2 || sy > ch+ts*2) continue;
    drawMonster(sx, sy, m);
  }
  // 玩家
  if (state.player) {
    const sx = state.player.x*ts - camX, sy = state.player.y*ts - camY;
    drawCharacter(sx, sy, state.classes?.[state.player.class]?.color||'#ffcc00', state.player.username, state.player.level, true, state.player.class);
  }

  // 粒子效果
  renderParticles();
  renderDamageNumbers();
}

function lightenColor(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.min(255, r+amt); g = Math.min(255, g+amt); b = Math.min(255, b+amt);
  return `rgb(${r},${g},${b})`;
}

function darkenColor(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, r-amt); g = Math.max(0, g-amt); b = Math.max(0, b-amt);
  return `rgb(${r},${g},${b})`;
}

function darkenColorHex(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, r-amt); g = Math.max(0, g-amt); b = Math.max(0, b-amt);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

function darkenColor(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, r-amt); g = Math.max(0, g-amt); b = Math.max(0, b-amt);
  return `rgb(${r},${g},${b})`;
}

function isSafeZone(x, y) {
  const sz = (MAPS[state.currentMap] || MAPS.bichon).safeZone;
  return x >= sz.x1 && x <= sz.x2 && y >= sz.y1 && y <= sz.y2;
}

function darken(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.max(0, r-amt); g = Math.max(0, g-amt); b = Math.max(0, b-amt);
  return `rgb(${r},${g},${b})`;
}
function lighten(hex, amt) {
  let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  r = Math.min(255, r+amt); g = Math.min(255, g+amt); b = Math.min(255, b+amt);
  return `rgb(${r},${g},${b})`;
}

// ===== Detailed human character drawing =====
function drawHumanFig(cx, cy, s, color, weapon, armor, skinTone, hairCol, isPlayer, level) {
  const breathe = Math.sin(state.time * 3) * s * 0.5;
  const walk = Math.sin(state.time * 5) * s * 0.8;
  const swing = Math.sin(state.time * 2.5) * s * 0.08;

  // Level glow
  if (level > 100) {
    ctx.fillStyle = `rgba(255,255,200,${0.04 + Math.sin(state.time*2)*0.02})`;
    ctx.beginPath(); ctx.arc(cx, cy-16*s, 28*s, 0, Math.PI*2); ctx.fill();
  }
  // Equipment glow
  if (armor === 'divine') {
    ctx.shadowColor = color; ctx.shadowBlur = 10*s;
    ctx.fillStyle = color+'22';
    ctx.beginPath(); ctx.arc(cx, cy-12*s, 22*s, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Boots
  ctx.fillStyle = '#2a1a08';
  ctx.beginPath(); ctx.moveTo(cx-6*s,cy+10*s+Math.floor(walk)); ctx.lineTo(cx-7*s,cy+13*s+Math.floor(walk));
  ctx.lineTo(cx-2*s,cy+13*s+Math.floor(walk)); ctx.lineTo(cx-2*s,cy+10*s+Math.floor(walk)); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a1a08';
  ctx.beginPath(); ctx.moveTo(cx+2*s,cy+10*s-Math.floor(walk)); ctx.lineTo(cx+1*s,cy+13*s-Math.floor(walk));
  ctx.lineTo(cx+7*s,cy+13*s-Math.floor(walk)); ctx.lineTo(cx+6*s,cy+10*s-Math.floor(walk)); ctx.closePath(); ctx.fill();

  // Legs
  const pantColor = armor==='none' ? '#3a2a18' : darken(color,35);
  ctx.fillStyle = pantColor;
  ctx.beginPath(); ctx.moveTo(cx-5*s,cy+2*s+breathe); ctx.lineTo(cx-6*s,cy+11*s+Math.floor(walk));
  ctx.lineTo(cx-3*s,cy+11*s+Math.floor(walk)); ctx.lineTo(cx-2*s,cy+2*s+breathe); ctx.closePath(); ctx.fill();
  ctx.fillStyle = pantColor;
  ctx.beginPath(); ctx.moveTo(cx+2*s,cy+2*s+breathe); ctx.lineTo(cx+3*s,cy+11*s-Math.floor(walk));
  ctx.lineTo(cx+6*s,cy+11*s-Math.floor(walk)); ctx.lineTo(cx+5*s,cy+2*s+breathe); ctx.closePath(); ctx.fill();

  // Torso
  const bodyGrad = ctx.createLinearGradient(cx-8*s,cy-18*s+breathe,cx+8*s,cy+2*s+breathe);
  bodyGrad.addColorStop(0, armor==='divine'?lighten(color,20):color);
  bodyGrad.addColorStop(1, darken(color,30));
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx-7*s,cy+2*s+breathe); ctx.quadraticCurveTo(cx-9*s,cy-4*s+breathe,cx-8*s,cy-14*s+breathe);
  ctx.quadraticCurveTo(cx,cy-18*s+breathe,cx+8*s,cy-14*s+breathe);
  ctx.quadraticCurveTo(cx+9*s,cy-4*s+breathe,cx+7*s,cy+2*s+breathe); ctx.closePath(); ctx.fill();

  // Armor details
  if (armor==='divine'||armor==='legendary') {
    ctx.strokeStyle='rgba(255,255,200,0.25)'; ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(cx,cy-17*s+breathe); ctx.lineTo(cx,cy+1*s+breathe); ctx.stroke();
    ctx.fillStyle=darken(color,20);
    ctx.beginPath(); ctx.ellipse(cx-8*s,cy-15*s+breathe,3.5*s,2.5*s,-0.2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx+8*s,cy-15*s+breathe,3.5*s,2.5*s,0.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#553300'; ctx.fillRect(cx-7*s,cy-1*s+breathe,14*s,2.5*s);
    ctx.fillStyle='#ffcc00'; ctx.fillRect(cx-2*s,cy-1*s+breathe,4*s,2.5*s);
  } else {
    ctx.fillStyle='#443322'; ctx.fillRect(cx-6*s,cy-0.5*s+breathe,12*s,2*s);
  }

  // Left arm
  const armColor = armor==='none'?skinTone:color;
  ctx.fillStyle = armColor;
  ctx.beginPath();
  ctx.moveTo(cx-7*s,cy-14*s+breathe); ctx.quadraticCurveTo(cx-11*s,cy-8*s+breathe,cx-10*s,cy-2*s+breathe);
  ctx.quadraticCurveTo(cx-9*s,cy+1*s+breathe,cx-8*s,cy+1*s+breathe);
  ctx.quadraticCurveTo(cx-8*s,cy-1*s+breathe,cx-9*s,cy-5*s+breathe);
  ctx.quadraticCurveTo(cx-10*s,cy-10*s+breathe,cx-6*s,cy-12*s+breathe); ctx.closePath(); ctx.fill();

  // Right arm + weapon
  ctx.save(); ctx.translate(cx+7*s,cy-14*s+breathe); ctx.rotate(swing);
  ctx.fillStyle = armColor;
  ctx.beginPath();
  ctx.moveTo(-7*s,0); ctx.quadraticCurveTo(-3*s,4*s,-1*s,10*s);
  ctx.quadraticCurveTo(0,11*s,1*s,10*s); ctx.quadraticCurveTo(2*s,5*s,-1*s,2*s);
  ctx.quadraticCurveTo(1*s,2*s,0,0); ctx.closePath(); ctx.fill();
  ctx.fillStyle = skinTone;
  ctx.beginPath(); ctx.arc(0,10.5*s,1.5*s,0,Math.PI*2); ctx.fill();

  if (weapon==='sword') {
    ctx.fillStyle='#ddd';
    ctx.beginPath(); ctx.moveTo(-1.2*s,-14*s); ctx.lineTo(-0.8*s,-14*s); ctx.lineTo(-0.3*s,-1*s);
    ctx.lineTo(0.3*s,-1*s); ctx.lineTo(0.8*s,-14*s); ctx.lineTo(1.2*s,-14*s); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.4)'; ctx.fillRect(-0.3*s,-11*s,0.6*s,8*s);
    ctx.fillStyle='#aa8800'; ctx.fillRect(-4*s,-1.5*s,8*s,1.5*s);
    ctx.fillStyle='#553300'; ctx.fillRect(-0.8*s,0,1.6*s,3*s);
    ctx.fillStyle='#aa8800'; ctx.beginPath(); ctx.ellipse(0,3.5*s,2*s,1.2*s,0,0,Math.PI*2); ctx.fill();
  } else if (weapon==='staff') {
    ctx.fillStyle='#7B4F2A';
    ctx.beginPath(); ctx.moveTo(-0.6*s,-18*s); ctx.lineTo(0.6*s,-18*s);
    ctx.lineTo(0.5*s,2*s); ctx.lineTo(-0.5*s,2*s); ctx.closePath(); ctx.fill();
    ctx.fillStyle='#888'; ctx.beginPath(); ctx.arc(0,-18*s,3*s,0,Math.PI*2); ctx.fill();
    const orbHue = 210+Math.sin(state.time*3)*20;
    ctx.shadowColor=`hsl(${orbHue},80%,65%)`; ctx.shadowBlur=12*s;
    const orbGrad=ctx.createRadialGradient(0,-18*s,0,0,-18*s,3*s);
    orbGrad.addColorStop(0,`hsla(${orbHue},90%,90%,0.95)`);
    orbGrad.addColorStop(0.5,`hsla(${orbHue},80%,70%,0.7)`);
    orbGrad.addColorStop(1,`hsla(${orbHue},80%,70%,0)`);
    ctx.fillStyle=orbGrad; ctx.beginPath(); ctx.arc(0,-18*s,3*s,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(-0.5*s,-18.5*s,0.8*s,0,Math.PI*2); ctx.fill();
  } else if (weapon==='talisman') {
    for (let i=0;i<2;i++) {
      const ty=-6*s+i*5*s+Math.sin(state.time*2.5+i*1.5)*2*s;
      const tx=2*s+Math.sin(state.time*3+i*2)*1.5*s;
      ctx.save(); ctx.translate(tx,ty); ctx.rotate(Math.sin(state.time*2+i*1.5)*0.4);
      ctx.fillStyle='#ffffcc'; ctx.fillRect(-2.5*s,-4*s,5*s,8*s);
      ctx.strokeStyle='#cc8800'; ctx.lineWidth=0.3; ctx.strokeRect(-2.5*s,-4*s,5*s,8*s);
      ctx.fillStyle='#cc0000'; ctx.beginPath(); ctx.arc(0,-0.5*s,1.8*s,0,Math.PI*2); ctx.fill();
      ctx.fillStyle='#ffffcc'; ctx.font=`bold ${Math.max(5,4*s)}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('符',0,-0.5*s); ctx.restore();
    }
    ctx.fillStyle='#ccc'; ctx.fillRect(-2*s,0,1*s,8*s);
    ctx.fillStyle='#aa8800'; ctx.fillRect(-3*s,1*s,4*s,1*s);
  }
  ctx.restore();

  // Neck
  ctx.fillStyle = skinTone;
  ctx.fillRect(cx-2*s,cy-18*s+breathe,4*s,3*s);

  // Head
  const headCY = cy-26*s+breathe, headR = 6*s;
  const headGrad = ctx.createRadialGradient(cx-1*s,headCY-1*s,0,cx,headCY,headR*1.2);
  headGrad.addColorStop(0,lighten(skinTone,10)); headGrad.addColorStop(0.7,skinTone); headGrad.addColorStop(1,darken(skinTone,15));
  ctx.fillStyle = headGrad;
  ctx.beginPath(); ctx.ellipse(cx,headCY,headR,headR*1.15,0,0,Math.PI*2); ctx.fill();

  // Hair
  ctx.fillStyle = hairCol;
  if (weapon==='sword') {
    ctx.beginPath(); ctx.ellipse(cx,headCY-2*s,headR+0.5*s,headR*0.55,0,Math.PI,0); ctx.fill();
    ctx.fillRect(cx-headR-0.5*s,headCY-2*s,2*s,headR*0.4);
    ctx.fillRect(cx+headR-1.5*s,headCY-2*s,2*s,headR*0.4);
  } else if (weapon==='staff') {
    ctx.beginPath(); ctx.ellipse(cx,headCY-2*s,headR+0.5*s,headR*0.55,0,Math.PI,0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx-headR-0.5*s,headCY-1*s);
    ctx.quadraticCurveTo(cx-headR-3*s,headCY+3*s,cx-headR-1*s,headCY+10*s);
    ctx.quadraticCurveTo(cx-headR,headCY+12*s,cx-headR+1*s,headCY+8*s);
    ctx.quadraticCurveTo(cx-headR+1.5*s,headCY+3*s,cx-headR+0.5*s,headCY+1*s); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx+headR+0.5*s,headCY-1*s);
    ctx.quadraticCurveTo(cx+headR+3*s,headCY+3*s,cx+headR+1*s,headCY+10*s);
    ctx.quadraticCurveTo(cx+headR,headCY+12*s,cx+headR-1*s,headCY+8*s);
    ctx.quadraticCurveTo(cx+headR-1.5*s,headCY+3*s,cx+headR-0.5*s,headCY+1*s); ctx.fill();
  } else {
    ctx.beginPath(); ctx.ellipse(cx,headCY-2*s,headR+0.5*s,headR*0.55,0,Math.PI,0); ctx.fill();
    ctx.beginPath(); ctx.arc(cx,headCY-headR-3*s,2.5*s,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#ffcc00'; ctx.fillRect(cx-3.5*s,headCY-headR-2*s,7*s,0.8*s);
  }

  // Face
  ctx.strokeStyle=hairCol; ctx.lineWidth=0.8*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-3.8*s,headCY-3.2*s); ctx.quadraticCurveTo(cx-2*s,headCY-4*s,cx-0.8*s,headCY-3.5*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+0.8*s,headCY-3.5*s); ctx.quadraticCurveTo(cx+2*s,headCY-4*s,cx+3.8*s,headCY-3.2*s); ctx.stroke();

  ctx.fillStyle='#f0ece0';
  ctx.beginPath(); ctx.ellipse(cx-2.5*s,headCY-1.5*s,2*s,1.2*s,-0.05,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+2.5*s,headCY-1.5*s,2*s,1.2*s,0.05,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#3a2810';
  ctx.beginPath(); ctx.arc(cx-2.5*s,headCY-1.5*s,1*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+2.5*s,headCY-1.5*s,1*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.arc(cx-2.5*s,headCY-1.5*s,0.5*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+2.5*s,headCY-1.5*s,0.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#fff';
  ctx.beginPath(); ctx.arc(cx-2.1*s,headCY-2*s,0.35*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+2.9*s,headCY-2*s,0.35*s,0,Math.PI*2); ctx.fill();

  ctx.strokeStyle=darken(skinTone,25); ctx.lineWidth=0.5*s; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx,headCY-1*s);
  ctx.quadraticCurveTo(cx-0.3*s,headCY+0.5*s,cx-0.8*s,headCY+1.5*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx,headCY-1*s);
  ctx.quadraticCurveTo(cx+0.3*s,headCY+0.5*s,cx+0.8*s,headCY+1.5*s); ctx.stroke();

  ctx.fillStyle=darken(skinTone,10);
  ctx.beginPath();
  ctx.moveTo(cx-2*s,headCY+3.5*s); ctx.quadraticCurveTo(cx-1*s,headCY+3*s,cx,headCY+3.5*s);
  ctx.quadraticCurveTo(cx+1*s,headCY+3*s,cx+2*s,headCY+3.5*s);
  ctx.quadraticCurveTo(cx,headCY+5*s,cx-2*s,headCY+3.5*s); ctx.fill();
  ctx.fillStyle=darken(skinTone,15);
  ctx.beginPath();
  ctx.moveTo(cx-1.5*s,headCY+4*s); ctx.quadraticCurveTo(cx,headCY+5.5*s,cx+1.5*s,headCY+4*s);
  ctx.quadraticCurveTo(cx,headCY+4.5*s,cx-1.5*s,headCY+4*s); ctx.fill();
}

// ===== Skeleton monster =====
function drawSkeletonFig(cx, cy, s) {
  const breathe = Math.sin(state.time*3)*s*0.5;
  const walk = Math.sin(state.time*5)*s*0.7;

  ctx.strokeStyle='#777'; ctx.lineWidth=Math.max(2,2.5*s); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-2.5*s,cy+2*s); ctx.lineTo(cx-3.5*s,cy+12*s+Math.floor(walk*0.6)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+2.5*s,cy+2*s); ctx.lineTo(cx+3.5*s,cy+12*s-Math.floor(walk*0.6)); ctx.stroke();
  ctx.fillStyle='#666';
  ctx.beginPath(); ctx.moveTo(cx-5.5*s,cy+11*s+Math.floor(walk*0.6)); ctx.lineTo(cx-1.5*s,cy+11*s+Math.floor(walk*0.6));
  ctx.lineTo(cx-1.5*s,cy+12.5*s+Math.floor(walk*0.6)); ctx.lineTo(cx-5.5*s,cy+12.5*s+Math.floor(walk*0.6)); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+1.5*s,cy+11*s-Math.floor(walk*0.6)); ctx.lineTo(cx+5.5*s,cy+11*s-Math.floor(walk*0.6));
  ctx.lineTo(cx+5.5*s,cy+12.5*s-Math.floor(walk*0.6)); ctx.lineTo(cx+1.5*s,cy+12.5*s-Math.floor(walk*0.6)); ctx.closePath(); ctx.fill();

  ctx.fillStyle='#888';
  ctx.beginPath(); ctx.moveTo(cx-6*s,cy+1*s); ctx.quadraticCurveTo(cx,cy+4*s,cx+6*s,cy+1*s);
  ctx.quadraticCurveTo(cx+4*s,cy-1*s,cx,cy-1*s); ctx.quadraticCurveTo(cx-4*s,cy-1*s,cx-6*s,cy+1*s); ctx.fill();

  ctx.strokeStyle='#888'; ctx.lineWidth=Math.max(1.5,2*s);
  ctx.beginPath(); ctx.moveTo(cx,cy-2*s); ctx.lineTo(cx,cy-14*s+breathe); ctx.stroke();

  ctx.strokeStyle='#999'; ctx.lineWidth=Math.max(1.5,2*s);
  for (let i=0;i<4;i++) {
    const ry=cy-12*s+i*2.8*s+breathe, rw=6.5*s-i*0.8*s;
    ctx.beginPath(); ctx.moveTo(cx-rw,ry); ctx.quadraticCurveTo(cx,ry+2.5*s,cx+rw,ry); ctx.stroke();
  }

  const skullY=cy-24*s+breathe, skullR=7*s;
  const skullGrad=ctx.createRadialGradient(cx-1*s,skullY-1*s,0,cx,skullY,skullR);
  skullGrad.addColorStop(0,'#aaa'); skullGrad.addColorStop(1,'#666');
  ctx.fillStyle=skullGrad;
  ctx.beginPath(); ctx.ellipse(cx,skullY,skullR,skullR*1.15,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#555'; ctx.lineWidth=0.5; ctx.stroke();

  ctx.strokeStyle='#777'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(cx,skullY-skullR+1*s); ctx.lineTo(cx,skullY+1*s); ctx.stroke();

  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.ellipse(cx-2.8*s,skullY-1.5*s,2.5*s,3*s,-0.1,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+2.8*s,skullY-1.5*s,2.5*s,3*s,0.1,0,Math.PI*2); ctx.fill();
  const glowAlpha=0.5+Math.sin(state.time*3)*0.3;
  ctx.fillStyle=`rgba(255,${60+Math.sin(state.time*4)*30},0,${glowAlpha})`;
  ctx.shadowColor='#ff4400'; ctx.shadowBlur=6*s;
  ctx.beginPath(); ctx.arc(cx-2.8*s,skullY-1.5*s,1.2*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+2.8*s,skullY-1.5*s,1.2*s,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  ctx.fillStyle='#111';
  ctx.beginPath(); ctx.moveTo(cx-1*s,skullY+1.5*s); ctx.lineTo(cx,skullY+4*s);
  ctx.lineTo(cx+1*s,skullY+1.5*s); ctx.closePath(); ctx.fill();

  ctx.fillStyle='#777';
  ctx.beginPath(); ctx.moveTo(cx-5*s,skullY+3*s); ctx.quadraticCurveTo(cx,skullY+8*s,cx+5*s,skullY+3*s);
  ctx.quadraticCurveTo(cx+3*s,skullY+5*s,cx,skullY+5*s);
  ctx.quadraticCurveTo(cx-3*s,skullY+5*s,cx-5*s,skullY+3*s); ctx.fill();
  ctx.fillStyle='#bbb';
  for (let i=-2;i<=2;i++) ctx.fillRect(cx+i*2*s-0.6*s,skullY+3.5*s,1.2*s,1.8*s);

  ctx.strokeStyle='#888'; ctx.lineWidth=Math.max(1.5,2*s);
  ctx.beginPath(); ctx.moveTo(cx-6*s,cy-10*s+breathe);
  ctx.quadraticCurveTo(cx-11*s,cy-6*s+breathe,cx-9*s,cy+Math.sin(state.time*2)*2*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+6*s,cy-10*s+breathe);
  ctx.quadraticCurveTo(cx+11*s,cy-6*s+breathe,cx+9*s,cy-Math.sin(state.time*2)*2*s); ctx.stroke();

  ctx.save(); ctx.translate(cx+9*s,cy-Math.sin(state.time*2)*2*s);
  ctx.rotate(Math.sin(state.time*1.5)*0.12);
  ctx.fillStyle='#aa8844';
  ctx.beginPath(); ctx.moveTo(-0.6*s,-10*s); ctx.lineTo(0.6*s,-10*s);
  ctx.lineTo(0.4*s,-1*s); ctx.lineTo(-0.4*s,-1*s); ctx.closePath(); ctx.fill();
  ctx.fillStyle='#775522'; ctx.fillRect(-2.5*s,-1.5*s,5*s,1.5*s);
  ctx.fillStyle='#553311'; ctx.fillRect(-0.5*s,0,1*s,4*s);
  ctx.restore();
}

// ===== Demon boss =====
function drawDemonFig(cx, cy, s) {
  const breathe = Math.sin(state.time*3)*s*0.6;
  const walk = Math.sin(state.time*5)*s;
  const wingFlap = Math.sin(state.time*2.5)*0.12;

  ctx.strokeStyle='#771100'; ctx.lineWidth=Math.max(3,4*s); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx-5*s,cy+2*s); ctx.quadraticCurveTo(cx-6*s,cy+8*s,cx-7*s,cy+15*s+Math.floor(walk)); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+5*s,cy+2*s); ctx.quadraticCurveTo(cx+6*s,cy+8*s,cx+7*s,cy+15*s-Math.floor(walk)); ctx.stroke();
  ctx.fillStyle='#661100';
  ctx.beginPath(); ctx.ellipse(cx-8*s,cy+15*s+Math.floor(walk),4*s,2*s,-0.3,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+8*s,cy+15*s-Math.floor(walk),4*s,2*s,0.3,0,Math.PI*2); ctx.fill();

  const bodyGrad=ctx.createRadialGradient(cx,cy-12*s+breathe,0,cx,cy-12*s+breathe,16*s);
  bodyGrad.addColorStop(0,'#dd3300'); bodyGrad.addColorStop(0.6,'#aa2200'); bodyGrad.addColorStop(1,'#661100');
  ctx.fillStyle=bodyGrad;
  ctx.beginPath();
  ctx.moveTo(cx-12*s,cy-4*s+breathe); ctx.quadraticCurveTo(cx-14*s,cy-14*s+breathe,cx-10*s,cy-22*s+breathe);
  ctx.quadraticCurveTo(cx,cy-26*s+breathe,cx+10*s,cy-22*s+breathe);
  ctx.quadraticCurveTo(cx+14*s,cy-14*s+breathe,cx+12*s,cy-4*s+breathe);
  ctx.quadraticCurveTo(cx+10*s,cy+2*s,cx,cy+2*s);
  ctx.quadraticCurveTo(cx-10*s,cy+2*s,cx-12*s,cy-4*s+breathe); ctx.closePath(); ctx.fill();

  ctx.strokeStyle='rgba(255,100,0,0.2)'; ctx.lineWidth=0.5;
  ctx.beginPath(); ctx.moveTo(cx,cy-24*s+breathe); ctx.lineTo(cx,cy+1*s); ctx.stroke();

  ctx.fillStyle=`rgba(255,80,0,${0.1+Math.sin(state.time*3)*0.05})`;
  ctx.beginPath(); ctx.arc(cx,cy-12*s+breathe,10*s,0,Math.PI*2); ctx.fill();

  const headY=cy-32*s+breathe, headR=10*s;
  const hGrad=ctx.createRadialGradient(cx-2*s,headY-2*s,0,cx,headY,headR);
  hGrad.addColorStop(0,'#ee4400'); hGrad.addColorStop(0.7,'#cc3300'); hGrad.addColorStop(1,'#881100');
  ctx.fillStyle=hGrad;
  ctx.beginPath(); ctx.ellipse(cx,headY,headR,headR*1.1,0,0,Math.PI*2); ctx.fill();

  ctx.fillStyle='#ffcc00';
  ctx.beginPath(); ctx.moveTo(cx-5*s,headY-headR+3*s);
  ctx.quadraticCurveTo(cx-10*s,headY-headR-4*s,cx-15*s,headY-headR-2*s);
  ctx.quadraticCurveTo(cx-10*s,headY-headR+1*s,cx-4*s,headY-headR+2*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+5*s,headY-headR+3*s);
  ctx.quadraticCurveTo(cx+10*s,headY-headR-4*s,cx+15*s,headY-headR-2*s);
  ctx.quadraticCurveTo(cx+10*s,headY-headR+1*s,cx+4*s,headY-headR+2*s); ctx.fill();

  ctx.shadowColor='#ff0'; ctx.shadowBlur=8*s; ctx.fillStyle='#ff0';
  ctx.beginPath(); ctx.ellipse(cx-3.5*s,headY-2*s,2.5*s,2*s,-0.1,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+3.5*s,headY-2*s,2.5*s,2*s,0.1,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;
  ctx.fillStyle='#000';
  ctx.beginPath(); ctx.ellipse(cx-3.5*s,headY-2*s,0.8*s,1.5*s,0,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+3.5*s,headY-2*s,0.8*s,1.5*s,0,0,Math.PI*2); ctx.fill();

  ctx.fillStyle='#220000';
  ctx.beginPath();
  ctx.moveTo(cx-5*s,headY+2*s); ctx.quadraticCurveTo(cx,headY+7*s,cx+5*s,headY+2*s);
  ctx.quadraticCurveTo(cx,headY+5*s,cx-5*s,headY+2*s); ctx.fill();
  ctx.fillStyle='#eee';
  ctx.beginPath(); ctx.moveTo(cx-3.5*s,headY+2.5*s); ctx.lineTo(cx-2.8*s,headY+6*s); ctx.lineTo(cx-2*s,headY+2.5*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+2*s,headY+2.5*s); ctx.lineTo(cx+2.8*s,headY+6*s); ctx.lineTo(cx+3.5*s,headY+2.5*s); ctx.fill();

  ctx.strokeStyle='#aa2200'; ctx.lineWidth=Math.max(3,5*s);
  ctx.beginPath(); ctx.moveTo(cx-12*s,cy-16*s+breathe);
  ctx.quadraticCurveTo(cx-18*s,cy-8*s+breathe+Math.sin(state.time*2)*2*s,cx-16*s,cy+2*s+Math.sin(state.time*2)*3*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx+12*s,cy-16*s+breathe);
  ctx.quadraticCurveTo(cx+18*s,cy-8*s+breathe-Math.sin(state.time*2)*2*s,cx+16*s,cy+2*s-Math.sin(state.time*2)*3*s); ctx.stroke();
  ctx.fillStyle='#ff4400';
  ctx.beginPath(); ctx.arc(cx-16*s,cy+2*s+Math.sin(state.time*2)*3*s,3*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+16*s,cy+2*s-Math.sin(state.time*2)*3*s,3*s,0,Math.PI*2); ctx.fill();

  ctx.fillStyle=`rgba(120,17,0,${0.55+Math.sin(state.time*2.5)*0.1})`;
  ctx.save(); ctx.translate(cx-10*s,cy-18*s+breathe); ctx.rotate(-0.35+wingFlap);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(-14*s,-12*s,-20*s,-4*s);
  ctx.quadraticCurveTo(-18*s,4*s,-10*s,8*s); ctx.quadraticCurveTo(-5*s,5*s,0,0); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(cx+10*s,cy-18*s+breathe); ctx.rotate(0.35-wingFlap);
  ctx.beginPath(); ctx.moveTo(0,0); ctx.quadraticCurveTo(14*s,-12*s,20*s,-4*s);
  ctx.quadraticCurveTo(18*s,4*s,10*s,8*s); ctx.quadraticCurveTo(5*s,5*s,0,0); ctx.fill(); ctx.restore();

  ctx.strokeStyle='#aa2200'; ctx.lineWidth=Math.max(2,3.5*s); ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(cx,cy+2*s);
  ctx.quadraticCurveTo(cx+10*s,cy+10*s+Math.sin(state.time*2)*3*s,cx+18*s,cy+8*s+Math.sin(state.time*2.5)*2*s); ctx.stroke();
  ctx.fillStyle='#ff4400';
  ctx.beginPath(); ctx.moveTo(cx+16*s,cy+8*s+Math.sin(state.time*2.5)*2*s-3*s);
  ctx.lineTo(cx+22*s,cy+8*s+Math.sin(state.time*2.5)*2*s);
  ctx.lineTo(cx+16*s,cy+8*s+Math.sin(state.time*2.5)*2*s+3*s); ctx.closePath(); ctx.fill();
}

function drawCharacter(x, y, color, name, level, isPlayer, playerClass) {
  const s = 1.3;
  const cls = playerClass || state.player?.class;
  const weaponMap = { warrior:'sword', mage:'staff', taoist:'talisman' };
  const weapon = weaponMap[cls] || 'sword';
  const armor = (state.player?.equipment && Object.keys(state.player.equipment).length > 0) ? 'divine' : 'none';
  const skinTone = '#e8c89a';
  const hairColors = { warrior:'#1a0a00', mage:'#334466', taoist:'#1a0a00' };
  const hairCol = hairColors[cls] || '#2a1a0a';

  drawHumanFig(x, y, s, color, weapon, armor, skinTone, hairCol, isPlayer, level);

  ctx.fillStyle = isPlayer ? '#fff' : '#ddd';
  ctx.font = 'bold 11px Microsoft YaHei'; ctx.textAlign = 'center';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(name, x, y + 22*s);
  ctx.fillStyle = '#aaa'; ctx.font = '10px Microsoft YaHei';
  ctx.fillText(`Lv.${level}`, x, y + 34*s);
  ctx.shadowBlur = 0;
}

function drawMonster(x, y, monster) {
  const r = Math.min(40, 12 + (monster.level||1)*0.3);
  const s = 1.2;
  const sel = state.selectedMonster && state.selectedMonster.id === monster.id;

  if (sel) {
    ctx.strokeStyle = monster.isSummon ? '#88ff88' : '#ff4444'; ctx.lineWidth = 2;
    ctx.shadowColor = monster.isSummon ? '#88ff88' : '#ff4444'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y-8, r+4, 0, Math.PI*2); ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (monster.isBoss) {
    const auraGrad = ctx.createRadialGradient(x,y-20*s,0,x,y-20*s,35*s);
    auraGrad.addColorStop(0,`rgba(255,68,0,${0.1+Math.sin(state.time*2)*0.05})`);
    auraGrad.addColorStop(1,'rgba(255,68,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath(); ctx.arc(x,y-20*s,35*s,0,Math.PI*2); ctx.fill();
    drawDemonFig(x, y, s);
  } else {
    drawSkeletonFig(x, y, s);
  }

  ctx.fillStyle = monster.isBoss ? '#ff8800' : monster.isSummon ? '#88ff88' : '#ff8888';
  ctx.font = `bold ${monster.isBoss ? 12 : 10}px Microsoft YaHei`; ctx.textAlign = 'center';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillText(monster.name, x, y + 22*s);
  ctx.shadowBlur = 0;

  if (monster.maxHp) {
    const bw = monster.isBoss ? 60 : 40, bh = monster.isBoss ? 6 : 5;
    const bx = x-bw/2, by = y - (monster.isBoss ? 48*s : 40*s);
    ctx.fillStyle = '#333'; ctx.fillRect(bx, by, bw, bh);
    const ratio = monster.hp / monster.maxHp;
    ctx.fillStyle = ratio > 0.5 ? '#40c040' : ratio > 0.25 ? '#c0c040' : '#c04040';
    ctx.fillRect(bx, by, bw*ratio, bh);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh);
  }
}

function addDamageNumber(x, y, text, color) { state.damageNumbers.push({x,y,text,color,life:1,vy:-2}); }
function renderDamageNumbers() {
  for (let i = state.damageNumbers.length-1; i >= 0; i--) {
    const d = state.damageNumbers[i]; d.y += d.vy; d.life -= 0.02;
    if (d.life <= 0) { state.damageNumbers.splice(i,1); continue; }
    ctx.globalAlpha = d.life; ctx.fillStyle = d.color; ctx.font = 'bold 16px Microsoft YaHei'; ctx.textAlign = 'center';
    ctx.fillText(d.text, d.x*MAP.tileSize - state.camera.x, d.y*MAP.tileSize - state.camera.y); ctx.globalAlpha = 1;
  }
}

function renderParticles() {
  // 环境粒子（萤火虫/灰尘）
  const camX = state.camera.x, camY = state.camera.y;
  const mapDef = MAPS[state.currentMap] || MAPS.bichon;
  for (let i = 0; i < 15; i++) {
    const px = ((i * 137 + state.time * 20) % (canvas.width + 100)) - 50;
    const py = ((i * 89 + Math.sin(state.time + i) * 30) % (canvas.height + 100)) - 50;
    const alpha = 0.3 + Math.sin(state.time * 2 + i) * 0.2;
    ctx.globalAlpha = alpha;
    if (mapDef.groundPattern === 'cave') {
      ctx.fillStyle = '#8888aa'; // 洞穴灰尘
    } else if (mapDef.groundPattern === 'temple') {
      ctx.fillStyle = '#ffaa44'; // 寺庙火星
    } else {
      ctx.fillStyle = '#aadd44'; // 草地萤火虫
    }
    ctx.beginPath(); ctx.arc(px, py, 1.5, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // 安全区光效
  const sz = mapDef.safeZone;
  if (sz) {
    const glowAlpha = 0.1 + Math.sin(state.time * 1.5) * 0.05;
    const sx1 = sz.x1 * MAP.tileSize - camX, sy1 = sz.y1 * MAP.tileSize - camY;
    const sx2 = sz.x2 * MAP.tileSize - camX, sy2 = sz.y2 * MAP.tileSize - camY;
    ctx.fillStyle = `rgba(255, 200, 100, ${glowAlpha})`;
    ctx.fillRect(sx1, sy1, sx2-sx1, sy2-sy1);
  }
}

function updateSkillBar() {
  const c = document.getElementById('skills'); c.innerHTML = '';
  if (!state.player || !state.classes) return;
  const classSkills = getClientSkills(state.player.class);
  if (classSkills.length === 0) return;

  classSkills.forEach((skill) => {
    const btn = document.createElement('div');
    const isLocked = state.player.level < skill.levelReq;
    const cdEnd = state.skillCooldowns[skill.id] || 0;
    const isOnCooldown = Date.now() < cdEnd;
    const mpNotEnough = (state.player.mp || 0) < skill.mpCost;
    const noTarget = !state.selectedMonster && !skill.healPercent;
    btn.className = 'skill-btn' + (isLocked ? ' locked' : '') + (isOnCooldown ? ' on-cooldown' : '');
    const cooldownText = isOnCooldown ? ` (${Math.ceil((cdEnd - Date.now()) / 1000)}s)` : '';

    let limitHTML = '';
    if (isLocked) {
      limitHTML = `<span class="t-limit cant-use">🔒 需要等级 ${skill.levelReq} 解锁</span>`;
    } else if (isOnCooldown) {
      limitHTML = `<span class="t-limit cant-use">⏱ 冷却中 ${Math.ceil((cdEnd - Date.now()) / 1000)} 秒</span>`;
    } else if (mpNotEnough) {
      limitHTML = `<span class="t-limit cant-use">💧 MP 不足（需要 ${skill.mpCost}）</span>`;
    } else if (noTarget) {
      limitHTML = `<span class="t-limit info">🎯 请先选择目标</span>`;
    } else {
      limitHTML = `<span class="t-limit can-use">✅ 可以使用</span>`;
    }

    btn.innerHTML = `<span class="skill-key">${skill.key}</span><span class="skill-icon">${skill.icon}</span><span class="skill-name">${skill.name}${cooldownText}</span>
      <div class="tooltip">
        <span class="t-name">${skill.name}</span>
        <span class="t-desc">${skill.description}</span>
        <span class="t-cost">🔮 消耗 MP: ${skill.mpCost} | ⏱ 冷却: ${skill.cooldown/1000}秒</span>
        ${limitHTML}
      </div>`;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (isLocked) { addMessage(`需要等级 ${skill.levelReq}`, 'msg-death'); return; }
      if (isOnCooldown) { addMessage(`技能冷却中`, 'msg-death'); return; }
      if (mpNotEnough) { addMessage('MP不足！', 'msg-death'); return; }
      if (!state.selectedMonster && !skill.healPercent) { addMessage('请先选择目标', 'msg-death'); return; }
      const targetId = state.selectedMonster ? state.selectedMonster.id : null;
      socket.emit('use_skill', { monsterId: targetId, skillId: skill.id });
    });
    c.appendChild(btn);
  });
}

function updateSkillBarCooldowns() {
  // 简单刷新整个技能栏，确保冷却状态正确
  updateSkillBar();
}

let lastAttackTick = 0;
function startAutoAttack(monsterId) {
  stopAutoAttack(); state.autoAttack = true; lastAttackTick = 0;
  state.autoAttackTimer = setInterval(() => {
    const target = state.monsters.find(m => m.id === monsterId);
    if (!target) {
      stopAutoAttack();
      const nearest = findNearestMonster();
      if (nearest) {
        state.selectedMonster = nearest;
        moveTo(nearest.x + 2, nearest.y);
        lastAttackTick = 3;
        startAutoAttack(nearest.id);
      }
      return;
    }
    const dist = Math.sqrt((state.player.x-target.x)**2+(state.player.y-target.y)**2);
    if (dist > 3) {
      moveTo(target.x + 2, target.y);
      lastAttackTick = 3;
    } else if (dist <= 5) {
      if (lastAttackTick <= 0) {
        // 尝试使用技能，如果MP不足或冷却中则使用普通攻击
        const cls = state.classes?.[state.player?.class];
        if (cls) {
          let usedSkill = false;
          for (const skill of cls.skills) {
            if (state.player.skills.includes(skill.id) &&
                (state.player.mp || 0) >= skill.mpCost &&
                !(state.skillCooldowns && state.skillCooldowns[skill.id] > Date.now())) {
              socket.emit('skill', { monsterId, skillId: skill.id });
              usedSkill = true;
              break;
            }
          }
          if (!usedSkill) {
            socket.emit('attack', monsterId);
          }
        } else {
          socket.emit('attack', monsterId);
        }
        lastAttackTick = 2;
      }
    }
    lastAttackTick = Math.max(0, lastAttackTick - 1);
  }, 200);
}
function stopAutoAttack() { state.autoAttack = false; if (state.autoAttackTimer) { clearInterval(state.autoAttackTimer); state.autoAttackTimer = null; } }

function findNearestMonster() {
  if (!state.player) return null;
  let nearest = null, minDist = Infinity;
  for (const m of state.monsters) { if (m.isSummon) continue; const d = Math.sqrt((state.player.x-m.x)**2+(state.player.y-m.y)**2); if (d < minDist) { minDist = d; nearest = m; } }
  return nearest;
}

function startAfkLoop() {
  stopAfkLoop();
  lastAttackTick = 0;
  state.afkTimer = setInterval(() => {
    if (!state.afkMode || !state.player) return;

    // 自动喝药：HP低于50%使用大金创药，MP低于30%使用大魔法药
    autoUsePotion();

    const target = state.selectedMonster && state.monsters.find(m => m.id === state.selectedMonster.id);
    if (target) {
      const dist = Math.sqrt((state.player.x-target.x)**2+(state.player.y-target.y)**2);
      if (dist > 3) {
        moveTo(target.x + 2, target.y);
        lastAttackTick = 3;
      } else if (dist <= 5) {
        if (lastAttackTick <= 0) {
          // 自动释放技能
          const classSkills = getClientSkills(state.player.class);
          let usedSkill = false;
          for (const skill of classSkills) {
            if (state.player.level >= skill.levelReq &&
                (state.player.mp || 0) >= skill.mpCost &&
                !(state.skillCooldowns && state.skillCooldowns[skill.id] > Date.now()) &&
                !skill.healPercent && !skill.summon) {
              socket.emit('use_skill', { monsterId: target.id, skillId: skill.id });
              usedSkill = true;
              break;
            }
          }
          if (!usedSkill) {
            socket.emit('attack', target.id);
          }
          lastAttackTick = 2;
        }
      }
      lastAttackTick = Math.max(0, lastAttackTick - 1);
      return;
    }
    // 没目标，找最近的
    const nearest = findNearestMonster();
    if (nearest) {
      state.selectedMonster = nearest;
      moveTo(nearest.x + 2, nearest.y);
      lastAttackTick = 3;
    }
  }, 200);
}

// 自动使用药水
function autoUsePotion() {
  if (!state.player || !state.potions) return;
  const inv = state.player.inventory || [];
  const hpRatio = state.player.hp / state.player.max_hp;
  const mpRatio = (state.player.mp || 0) / state.player.max_mp;

  // 优先使用太阳水（HP和MP都回）
  if (hpRatio < 0.4 || mpRatio < 0.3) {
    const sunIdx = inv.findIndex(i => i.id === 'sun' || i.id === 'great_sun');
    if (sunIdx >= 0) { socket.emit('use_potion', { itemIndex: sunIdx }); return; }
  }

  // HP低时使用金创药
  if (hpRatio < 0.5) {
    const hpIdx = inv.findIndex(i => i.id === 'large_hp' || i.id === 'medium_hp' || i.id === 'small_hp');
    if (hpIdx >= 0) { socket.emit('use_potion', { itemIndex: hpIdx }); return; }
  }

  // MP低时使用魔法药水
  if (mpRatio < 0.3) {
    const mpIdx = inv.findIndex(i => i.id === 'large_mp' || i.id === 'medium_mp' || i.id === 'small_mp');
    if (mpIdx >= 0) { socket.emit('use_potion', { itemIndex: mpIdx }); return; }
  }
}
function stopAfkLoop() { if (state.afkTimer) { clearInterval(state.afkTimer); state.afkTimer = null; } }

function moveTo(tx, ty) {
  state.player.x = Math.max(2, Math.min(MAP.width-2, tx));
  state.player.y = Math.max(2, Math.min(MAP.height-2, ty));
  socket.emit('move', {x: state.player.x, y: state.player.y});
}

// ===== 输入处理 =====
document.addEventListener('keydown', e => {
  // B键切换背包显示
  if (e.key.toLowerCase() === 'b' && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault();
    toggleInventory();
    return;
  }
  state.keys[e.key.toLowerCase()] = true;
  // 技能快捷键 1/2/3/4
  if (e.key >= '1' && e.key <= '4' && state.player && document.activeElement.tagName !== 'INPUT') {
    const classSkills = getClientSkills(state.player.class).filter(s => s.key === e.key);
    if (classSkills.length > 0) {
      const skill = classSkills[0];
      // 检查等级
      if (state.player.level < skill.levelReq) { addMessage(`需要等级 ${skill.levelReq}`, 'msg-death'); return; }
      // 检查MP
      if ((state.player.mp || 0) < skill.mpCost) { addMessage('MP不足！', 'msg-death'); return; }
      // 检查冷却
      if (state.skillCooldowns[skill.id] && Date.now() < state.skillCooldowns[skill.id]) { addMessage('技能冷却中', 'msg-death'); return; }
      // 治愈术不需要目标
      if (!state.selectedMonster && !skill.healPercent) { addMessage('请先选择目标', 'msg-death'); return; }
      const targetId = state.selectedMonster ? state.selectedMonster.id : null;
      socket.emit('use_skill', { monsterId: targetId, skillId: skill.id });
    }
  }
  if (e.key === 'Enter') { const ci = document.getElementById('chat-input'); if (document.activeElement === ci) sendChat(); }
  if (e.key.toLowerCase() === 'z' && document.activeElement.tagName !== 'INPUT') {
    const btn = document.getElementById('afk-btn');
    state.afkMode = !state.afkMode;
    if (state.afkMode) { btn.style.borderColor = '#40c040'; btn.style.color = '#40c040'; addMessage('🤖 挂机开启', 'msg-level'); startAfkLoop(); }
    else { btn.style.borderColor = ''; btn.style.color = ''; addMessage('挂机关闭', 'msg-exp'); stopAfkLoop(); }
  }
});
document.addEventListener('keyup', e => { state.keys[e.key.toLowerCase()] = false; });

setInterval(() => {
  if (!state.player || !state.running) return;
  const speed = 0.8; let moved = false; let {x, y} = state.player;
  if (state.keys['w']||state.keys['arrowup']) { y -= speed; moved = true; }
  if (state.keys['s']||state.keys['arrowdown']) { y += speed; moved = true; }
  if (state.keys['a']||state.keys['arrowleft']) { x -= speed; moved = true; }
  if (state.keys['d']||state.keys['arrowright']) { x += speed; moved = true; }
  if (moved) moveTo(x, y);
}, 50);

// HP/MP 每10秒恢复1%
setInterval(() => {
  if (!state.player || !state.running) return;
  const hpRegen = Math.max(1, Math.floor(state.player.max_hp * 0.01));
  const mpRegen = Math.max(1, Math.floor(state.player.max_mp * 0.01));
  if (hpRegen > 0 && state.player.hp < state.player.max_hp) {
    state.player.hp = Math.min(state.player.max_hp, state.player.hp + hpRegen);
  }
  if (mpRegen > 0 && state.player.mp < state.player.max_mp) {
    state.player.mp = Math.min(state.player.max_mp, state.player.mp + mpRegen);
  }
  updateHUD(); updateAttrPanel();
}, 10000);

// 世界BOSS状态定期刷新
setInterval(() => {
  if (state.running) updateWorldBossPanel();
}, WORLDBOSS_REFRESH_INTERVAL);

canvas.addEventListener('click', e => {
  if (!state.player || !state.running) return;
  const rect = canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top; const ts = MAP.tileSize;
  // 检查 NPC 点击
  for (const npc of state.npcs) {
    const sx = npc.x*ts - state.camera.x, sy = npc.y*ts - state.camera.y;
    if (Math.sqrt((mx-sx)**2+(my-sy)**2) < ts) { openNPC(npc); return; }
  }
  for (const m of state.monsters) {
    const sx = m.x*ts - state.camera.x, sy = m.y*ts - state.camera.y;
    if (Math.sqrt((mx-sx)**2+(my-sy)**2) < 25) { state.selectedMonster = m; socket.emit('attack', m.id); startAutoAttack(m.id); return; }
  }
  const wx = (mx + state.camera.x) / ts, wy = (my + state.camera.y) / ts;
  stopAutoAttack(); socket.emit('move', {x: wx, y: wy}); state.selectedMonster = null; updateTargetInfo();
  closeNPC();
});

// ===== UI =====
function updateHUD() {
  const p = state.player; if (!p) return;
  const realm = p.cultivationRealm || 0;
  const stage = p.cultivationStage || 1;
  const realmNames = ['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','真仙','金仙','太乙','大罗','混元','道祖','圣人','天道','混沌','无极'];
  const realmName = realmNames[realm] || `第${realm + 1}境`;
  document.getElementById('player-name').textContent = p.username + (realm > 0 ? `[${realmName}·${stage}重]` : '');
  document.getElementById('player-class').textContent = state.classes?.[p.class] ? `[${state.classes[p.class].name}]` : '';
  document.getElementById('player-level').textContent = `Lv.${p.level}`;
  document.getElementById('player-stats').textContent = `ATK:${p.attack} DEF:${p.defense}`;
  document.getElementById('current-map').textContent = state.endlessActive
    ? `无尽副本·第${state.endlessLayer}层`
    : (MAPS[state.currentMap]||MAPS.bichon).name;
  const hpRatio = p.hp/p.max_hp; document.getElementById('hp-bar').style.width = `${hpRatio*100}%`; document.getElementById('hp-text').textContent = `${p.hp}/${p.max_hp}`;
  const mpRatio = p.mp/p.max_mp; document.getElementById('mp-bar').style.width = `${mpRatio*100}%`; document.getElementById('mp-text').textContent = `${p.mp}/${p.max_mp}`;
  const expNeeded = Math.floor(100 * Math.pow(p.level, 1.5));
  document.getElementById('exp-bar').style.width = `${(p.exp/expNeeded)*100}%`; document.getElementById('exp-text').textContent = `${p.exp}/${expNeeded}`;
}

function updateAttrPanel() {
  const p = state.player; if (!p) return;
  const realm = p.cultivationRealm || 0;
  const stage = p.cultivationStage || 1;
  const realmNames = ['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','真仙','金仙','太乙','大罗','混元','道祖','圣人','天道','混沌','无极'];
  const realmName = realmNames[realm] || `第${realm + 1}境`;
  document.getElementById('attr-level').textContent = p.level;
  const rebirthRow = document.getElementById('attr-rebirth-row');
  if (realm > 0) {
    rebirthRow.style.display = '';
    document.getElementById('attr-rebirth').textContent = `${realmName}期·${stage}重`;
  } else {
    rebirthRow.style.display = 'none';
  }
  document.getElementById('attr-atk').textContent = p.attack;
  document.getElementById('attr-def').textContent = p.defense;
  document.getElementById('attr-hp').textContent = `${p.hp}/${p.max_hp}`;
  document.getElementById('attr-mp').textContent = `${p.mp}/${p.max_mp}`;
  const expNeeded = Math.floor(100 * Math.pow(p.level, 1.5));
  document.getElementById('attr-exp').textContent = `${p.exp}/${expNeeded}`;
  document.getElementById('attr-gold').textContent = p.gold || 0;
  // 动态显示转生按钮
  updateRebirthButton();
}

function updateRebirthButton() {
  const p = state.player; if (!p) return;
  if (p.level >= BREAKTHROUGH_LEVEL_REQ) {
    let btn = document.getElementById('rebirth-btn');
    if (!btn) {
      btn = document.createElement('div');
      btn.id = 'rebirth-btn';
      btn.style.cssText = 'margin:8px auto 4px;padding:6px 12px;background:#8b0000;border:2px solid #ff4400;border-radius:6px;cursor:pointer;font-size:13px;color:#ff8800;font-weight:bold;text-align:center;';
      btn.innerHTML = '⚡ 突破';
      btn.addEventListener('click', doRebirth);
      document.getElementById('rebirth-btn-container').appendChild(btn);
    }
  } else {
    const oldBtn = document.getElementById('rebirth-btn');
    if (oldBtn) oldBtn.remove();
  }
}

function updateTargetInfo() {
  const el = document.getElementById('target-info');
  if (!state.selectedMonster) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  document.getElementById('target-name').textContent = `Lv.${state.selectedMonster.level} ${state.selectedMonster.name}`;
  if (state.selectedMonster.maxHp) document.getElementById('target-hp-bar').style.width = `${(state.selectedMonster.hp/state.selectedMonster.maxHp)*100}%`;
}

function addMessage(text, className = '') {
  const c = document.getElementById('messages'); const d = document.createElement('div'); d.className = className; d.textContent = text;
  c.appendChild(d); if (c.children.length > 20) c.removeChild(c.firstChild); c.scrollTop = c.scrollHeight;
}

function addChatMsg(text, cls = '') {
  if (state.chatTab !== 'world' && state.chatTab !== 'system') return;
  const c = document.getElementById('chat-messages'); const d = document.createElement('div'); d.className = cls; d.textContent = text;
  c.appendChild(d); if (c.children.length > 50) c.removeChild(c.firstChild); c.scrollTop = c.scrollHeight;
}

function sendChat() {
  const input = document.getElementById('chat-input'); const msg = input.value.trim(); if (!msg) return;
  socket.emit('chat', {text: msg, username: state.player?.username});
  addChatMsg(`${state.player?.username}: ${msg}`);
  input.value = '';
}

function openNPC(npc) {
  const panel = document.getElementById('npc-panel');
  document.getElementById('npc-name').textContent = npc.name;
  const content = document.getElementById('npc-content');
  let html = `<p style="margin-bottom:8px;color:#ddd;">${npc.dialog}</p>`;
  npc.options.forEach(opt => {
    html += `<div class="npc-option" data-action="${opt.action}">${opt.text}</div>`;
  });
  content.innerHTML = html;
  panel.style.display = 'block';
  content.querySelectorAll('.npc-option').forEach(el => {
    el.addEventListener('click', () => handleNPCAction(el.dataset.action, npc));
  });
}

function closeNPC() { warehouseMode = null; document.getElementById('npc-panel').style.display = 'none'; }
document.getElementById('npc-close').addEventListener('click', closeNPC);

function handleNPCAction(action, npc) {
  closeNPC();
  switch(action) {
    case 'shop_weapon': openShop('weapon'); break;
    case 'shop_armor': openShop('armor'); break;
    case 'shop_jewelry': openShop('jewelry'); break;
    case 'recycle': recycleAll(); break;
    case 'buy_hp': buyItem('hp_pot'); break;
    case 'buy_mp': buyItem('mp_pot'); break;
    case 'buy_sunwater': buyItem('sunwater'); break;
    case 'create_guild': socket.emit('create_guild', state.player.username + '的行会'); break;
    case 'view_guild': socket.emit('guild_list'); break;
    case 'teleport_bichon': teleport('bichon'); break;
    case 'teleport_mengzhong': teleport('mengzhong'); break;
    case 'teleport_zombie': teleport('zombie_cave'); break;
    case 'teleport_woma': teleport('woma_temple'); break;
    case 'teleport_pig_cave': teleport('pig_cave'); break;
    case 'teleport_fengmo': teleport('fengmo'); break;
    case 'teleport_zumma': teleport('zumma'); break;
    case 'teleport_redmoon': teleport('redmoon'); break;
    case 'teleport_bull': teleport('bull'); break;
    case 'teleport_cangyue': teleport('cangyue'); break;
    case 'teleport_shaba': teleport('shaba'); break;
    case 'teleport_zodiac_1': teleport('zodiac_floor_1'); break;
    case 'zodiac_1': teleport('zodiac_floor_1'); break;
    case 'zodiac_2': teleport('zodiac_floor_2'); break;
    case 'zodiac_3': teleport('zodiac_floor_3'); break;
    case 'zodiac_4': teleport('zodiac_floor_4'); break;
    case 'zodiac_5': teleport('zodiac_floor_5'); break;
    case 'zodiac_6': teleport('zodiac_floor_6'); break;
    case 'zodiac_7': teleport('zodiac_floor_7'); break;
    case 'zodiac_8': teleport('zodiac_floor_8'); break;
    case 'zodiac_9': teleport('zodiac_floor_9'); break;
    case 'zodiac_10': teleport('zodiac_floor_10'); break;
    case 'teleport_wuxing': teleport('wuxing_palace'); break;
    case 'teleport_heaven': teleport('heaven'); break;
    case 'teleport_abyss': teleport('abyss'); break;
    case 'upgrade_equip': upgradeEquipment(); break;
    case 'breakthrough_equip_menu': openBreakthroughEquipMenu(); break;
    case 'dismantle_equip_menu': openDismantleEquipMenu(); break;
    case 'appraise_menu': openAppraiseMenu(); break;
    case 'bless_menu': openBlessMenu(); break;
    case 'start_mining': openMiningUI(); break;
    case 'sell_ore': sellOreMenu(); break;
    case 'open_stall': openStallUI(); break;
    case 'browse_stalls': browseStalls(); break;
    case 'open_endless_dungeon': openEndlessDungeonMenu(); break;
    case 'check_reputation': socket.emit('get_reputation'); break;
    case 'lb_level': socket.emit('get_leaderboard', 'level'); break;
    case 'lb_combat': socket.emit('get_leaderboard', 'combat'); break;
    case 'lb_gold': socket.emit('get_leaderboard', 'gold'); break;
    case 'open_synth': openSynthUI(); break;
    case 'daily_activities': socket.emit('get_daily'); break;
    case 'my_achievements': socket.emit('get_achievements'); break;
    case 'start_escort': socket.emit('start_escort'); break;
    case 'complete_escort': socket.emit('complete_escort'); break;
    case 'marriage_info': socket.emit('marriage_info'); break;
    case 'teleport_partner': socket.emit('teleport_partner'); break;
    case 'divorce': if(confirm('确认离婚？')) socket.emit('divorce'); break;
    case 'propose_marriage': openProposeUI(); break;
    case 'show_meridians': socket.emit('get_meridians'); break;
    case 'buy_horse': socket.emit('buy_mount', 'mount_horse'); break;
    case 'buy_redhare': socket.emit('buy_mount', 'mount_red'); break;
    case 'buy_wings_small': socket.emit('buy_wings', 'wings_small'); break;
    case 'buy_wings_demon': socket.emit('buy_wings', 'wings_demon'); break;
    case 'find_master': openApprenticeUI(); break;
    case 'check_master': socket.emit('master_info'); break;
    case 'check_apprentices': socket.emit('apprentices'); break;
    case 'unlock_hero_warrior': socket.emit('unlock_hero', 'warrior'); break;
    case 'unlock_hero_mage': socket.emit('unlock_hero', 'mage'); break;
    case 'unlock_hero_taoist': socket.emit('unlock_hero', 'taoist'); break;
    case 'view_hero': socket.emit('get_hero'); break;
    case 'hero_attack_target': {
      const targetId = state.selectedMonster?.id;
      if (targetId) socket.emit('hero_attack', targetId);
      else addMessage('请先选择目标', 'msg-death');
      break;
    }
    case 'start_siege': {
      const guildId = state.player?.guildId;
      if (guildId) socket.emit('start_siege', guildId);
      else addMessage('需要加入公会才能发起攻城', 'msg-death');
      break;
    }
    case 'attack_main_gate': socket.emit('attack_gate', 'main'); break;
    case 'attack_side_gate': socket.emit('attack_gate', 'side'); break;
    case 'complete_siege': {
      const guildId = state.player?.guildId;
      if (guildId) socket.emit('complete_siege', guildId);
      else addMessage('需要加入公会', 'msg-death');
      break;
    }
    case 'view_siege': socket.emit('get_siege_state'); break;
    case 'socket_gem_menu': openSocketGemMenu(); break;
    case 'remove_gem_menu': openRemoveGemMenu(); break;
    case 'warehouse_deposit': openWarehouse('deposit'); break;
    case 'warehouse_withdraw': openWarehouse('withdraw'); break;
  }
}

function teleport(mapId) {
  if (!MAPS[mapId]) return;
  const sz = MAPS[mapId].safeZone;
  state.currentMap = mapId;
  state.player.x = (sz.x1 + sz.x2) / 2;
  state.player.y = (sz.y1 + sz.y2) / 2;
  socket.emit('teleport', {map: mapId, x: state.player.x, y: state.player.y});
  generateMap(); spawnNPCs();
  addMessage(`传送到了 ${MAPS[mapId].name}`, 'msg-system');
  updateHUD();
  // 通知服务器重新生成当前地图的怪物
  socket.emit('refresh_map_monsters', mapId);
}

function openShop(category) {
  state.shopCategory = category;
  const panel = document.getElementById('shop-panel');
  const tabs = document.getElementById('shop-tabs');
  tabs.innerHTML = '<div class="shop-tab active" data-cat="potion">药品</div><div class="shop-tab" data-cat="weapon">武器</div><div class="shop-tab" data-cat="armor">护甲</div><div class="shop-tab" data-cat="jewelry">首饰</div><div class="shop-tab" data-cat="material">材料</div><div class="shop-tab" data-cat="gem">宝石</div><div class="shop-tab" data-cat="sell">出售</div>';
  renderShopItems();
  panel.style.display = 'block';
  tabs.querySelectorAll('.shop-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.shopCategory = tab.dataset.cat;
      if (state.shopCategory === 'sell') renderSellItems();
      else if (state.shopCategory === 'gem') renderGemShop();
      else if (state.shopCategory === 'material') renderMaterialShop();
      else renderShopItems();
    });
  });
  document.getElementById('shop-close').addEventListener('click', () => panel.style.display = 'none', {once:true});
}

function renderShopItems() {
  const items = SHOP_ITEMS[state.shopCategory] || SHOP_ITEMS.potion;
  const container = document.getElementById('shop-items');
  container.innerHTML = '';
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span class="s-name">${item.name}</span><span class="s-price">${item.price}💰</span><button class="shop-buy">购买</button>`;
    div.querySelector('.shop-buy').addEventListener('click', () => buyItem(item.id));
    container.appendChild(div);
  });
}

function renderMaterialShop() {
  const container = document.getElementById('shop-items');
  container.innerHTML = '';
  const items = SHOP_ITEMS.material || [];
  if (!items.length) { container.innerHTML = '<div style="color:#555;padding:8px;font-size:12px">暂无材料</div>'; return; }
  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span class="s-name" style="color:#d4a017">${item.name}</span><span class="s-price">${item.price}💰</span><button class="shop-buy">购买</button>`;
    div.querySelector('.shop-buy').addEventListener('click', () => buyItem(item.id));
    container.appendChild(div);
  });
}

function renderGemShop() {
  const container = document.getElementById('shop-items');
  container.innerHTML = '';
  GEM_DB.forEach(gem => {
    const div = document.createElement('div');
    div.className = 'shop-item';
    const color = state.equipInfo?.qualityColors?.[gem.quality] || '#4488ff';
    div.innerHTML = `<span class="s-name" style="color:${color}">${gem.name}</span><span class="s-price">${gem.price}💰</span><span style="color:#aaa;font-size:11px;">${formatGemStats(gem)}</span><button class="shop-buy">购买</button>`;
    div.querySelector('.shop-buy').addEventListener('click', () => socket.emit('buy_gem', gem.id));
    container.appendChild(div);
  });
}

function renderSellItems() {
  const container = document.getElementById('shop-items');
  const inv = state.player?.inventory || [];
  if (!inv.length) { container.innerHTML = '<div style="padding:8px;color:#888;">背包为空</div>'; return; }
  container.innerHTML = '';
  inv.forEach((item, idx) => {
    const qualityMult = {common:1,uncommon:1.5,rare:2,epic:3,legendary:5}[item.quality]||1;
    const price = Math.floor(item.levelReq * 10 * qualityMult);
    const div = document.createElement('div');
    div.className = 'shop-item';
    div.innerHTML = `<span class="s-name" style="color:${state.equipInfo?.qualityColors?.[item.quality]||'#aaa'}">${item.name}</span><span class="s-price">${price}💰</span><button class="shop-buy">出售</button>`;
    div.querySelector('.shop-buy').addEventListener('click', () => {
      socket.emit('sell', idx);
      // 立即从本地移除，等服务端确认
      if (state.player?.inventory?.[idx]) {
        state.player.inventory.splice(idx, 1);
        renderSellItems();
        updateInventory();
      }
    });
    container.appendChild(div);
  });
}

function buyItem(itemId) {
  const item = [...SHOP_ITEMS.potion, ...SHOP_ITEMS.weapon, ...SHOP_ITEMS.armor, ...SHOP_ITEMS.jewelry, ...SHOP_ITEMS.material].find(i => i.id === itemId);
  if (!item) return;
  if ((state.player?.gold||0) < item.price) { addMessage('金币不足！', 'msg-death'); return; }
  socket.emit('buy_item', itemId);
}

function upgradeEquipment() {
  if (!state.player) return;
  const slots = ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes'];
  // 优先选择当前已装备的装备（让用户先穿上要强化的装备）
  for (const slot of slots) {
    const item = state.player.equipment?.[slot];
    if (item) {
      socket.emit('enhance_item', slot);
      return;
    }
  }
  addMessage('没有装备可以强化', 'msg-exp');
}

// ===== 装备突破 UI =====
function openBreakthroughEquipMenu() {
  if (!state.player) return;
  const slots = ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes'];
  const slotNames = {weapon:'武器',armor:'衣服',helmet:'头盔',necklace:'项链',bracelet1:'手镯1',bracelet2:'手镯2',ring1:'戒指1',ring2:'戒指2',belt:'腰带',shoes:'鞋子'};
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '⚡ 装备突破';
  const content = document.getElementById('npc-content');
  let html = '<p style="margin-bottom:8px;color:#aaa;">选择要突破的装备 (仙器品质以上):</p>';
  let hasEquip = false;
  for (const slot of slots) {
    const item = state.player.equipment?.[slot];
    if (!item || !['legendary','mythic','divine'].includes(item.quality)) continue;
    hasEquip = true;
    const btLevel = item.breakthroughLevel || 0;
    const baseRate = {legendary:0.4, mythic:0.25, divine:0.15}[item.quality];
    const rate = Math.round(baseRate * Math.pow(0.85, btLevel) * 100);
    const cost = Math.floor({legendary:10000, mythic:50000, divine:200000}[item.quality] * Math.pow(3, btLevel));
    const matBase = {legendary:5, mythic:10, divine:20}[item.quality];
    const matNeeded = matBase * Math.pow(2, btLevel);
    const matConfig = {legendary:{name:'传说碎片'}, mythic:{name:'神话碎片'}, divine:{name:'仙器碎片'}};
    const matName = matConfig[item.quality]?.name || `${item.quality}碎片`;
    const matCount = (state.player.inventory||[]).filter(i => i.name === matName).length;
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    const matOk = matCount >= matNeeded;
    html += `<div class="npc-option" style="opacity:${rate<5?'0.5':'1'}" onclick="doBreakthroughEquip('${slot}')">
      <span style="color:${color}">${item.name}</span> <span style="color:#ff0;font-size:11px;">+${btLevel}</span>
      <br><span style="font-size:10px;color:${rate<10?'#f44':'#aaa'};">成功率:${rate}%</span>
      <span style="font-size:10px;color:${matOk?'#aaa':'#f44'};"> 需${matNeeded}×${matName}(${matCount})</span>
      <span style="font-size:10px;color:${state.player.gold>=cost?'#aaa':'#f44'};"> ${cost}💰</span>
    </div>`;
  }
  if (!hasEquip) html = '<p style="color:#888;">没有可突破的装备 (需要传说品质以上)</p>';
  content.innerHTML = html;
}

function doBreakthroughEquip(slot) {
  closeNPC();
  socket.emit('breakthrough_equip', slot);
}

// 装备突破结果
socket.on('breakthrough_equip_result', r => {
  if (r.success) {
    let msg = ` 突破成功！强化等级+${r.newLevel}`;
    if (r.bonusAttr) {
      msg += ` 获得词条: ${r.bonusAttr.name}+${r.bonusAttr.value}${r.bonusAttr.suffix}`;
    }
    addMessage(msg, 'msg-level');
    updateAttrPanel();
  } else {
    addMessage(`⚡ 突破失败 (成功率${r.rate}%)，下次继续尝试`, 'msg-death');
  }
});
socket.on('breakthrough_equip_error', r => {
  const msgs = {
    no_equipment: '该部位没有装备',
    too_low_quality: '品质太低，无法突破 (需要传说以上)',
    not_enough_gold: `金币不足！需要${r.cost}💰`,
    not_enough_material: `材料不足！需要${r.needed}个${r.matName}，只有${r.have}个`,
  };
  addMessage(msgs[r.error] || `错误: ${r.error}`, 'msg-death');
});

// ===== 分解装备 UI =====
function openDismantleEquipMenu() {
  if (!state.player) return;
  const slots = ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes'];
  const slotNames = {weapon:'武器',armor:'衣服',helmet:'头盔',necklace:'项链',bracelet1:'手镯1',bracelet2:'手镯2',ring1:'戒指1',ring2:'戒指2',belt:'腰带',shoes:'鞋子'};
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '🔨 分解装备';
  const content = document.getElementById('npc-content');
  let html = '<p style="margin-bottom:8px;color:#aaa;">选择要分解的装备 (获得突破材料):</p>';
  let hasEquip = false;
  for (const slot of slots) {
    const item = state.player.equipment?.[slot];
    if (!item || !['legendary','mythic','divine'].includes(item.quality)) continue;
    hasEquip = true;
    const btLevel = item.breakthroughLevel || 0;
    const matConfig = {legendary:{name:'传说碎片',base:5}, mythic:{name:'神话碎片',base:10}, divine:{name:'仙器碎片',base:20}};
    const mat = matConfig[item.quality];
    const count = mat.base * (1 + btLevel);
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    html += `<div class="npc-option" onclick="doDismantleEquip('${slot}')">
      <span style="color:${color}">${item.name}</span> <span style="color:#ff0;font-size:11px;">+${btLevel}</span>
      <br><span style="font-size:10px;color:#aaa;">分解获得: ${count}×${mat.name}</span>
    </div>`;
  }
  if (!hasEquip) html = '<p style="color:#888;">没有可分解的装备 (需要传说品质以上)</p>';
  content.innerHTML = html;
}

function doDismantleEquip(slot) {
  closeNPC();
  socket.emit('dismantle_equip', slot);
}

socket.on('dismantle_equip_result', r => {
  addMessage(`🔨 分解成功！${r.itemName} → ${r.count}×${r.matName}`, 'msg-level');
  updateAttrPanel();
});
socket.on('dismantle_equip_error', r => {
  const msgs = {
    no_equipment: '该部位没有装备',
    too_low_quality: '品质太低，无法分解',
    unequip_failed: '卸下装备失败',
  };
  addMessage(msgs[r.error] || `错误: ${r.error}`, 'msg-death');
});

// ===== 宝石镶嵌 UI =====
function openSocketGemMenu() {
  if (!state.player) return;
  const slots = ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes'];
  const slotNames = {weapon:'武器',armor:'衣服',helmet:'头盔',necklace:'项链',bracelet1:'手镯1',bracelet2:'手镯2',ring1:'戒指1',ring2:'戒指2',belt:'腰带',shoes:'鞋子'};
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '镶嵌宝石';
  const content = document.getElementById('npc-content');
  let html = '<p style="margin-bottom:8px;color:#aaa;">选择要镶嵌宝石的装备:</p>';
  for (const slot of slots) {
    const item = state.player.equipment?.[slot];
    if (!item) continue;
    const maxSockets = SOCKET_LIMIT[item.quality] || 0;
    if (maxSockets === 0) continue;
    const cur = item.gems?.length || 0;
    if (cur >= maxSockets) continue;
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    const cost = 200 * (item.levelReq || 1);
    html += `<div class="npc-option" onclick="openSocketGemSelect('${slot}')"><span style="color:${color}">${item.name}</span> <span style="color:#888;font-size:11px;">(${cur}/${maxSockets}) 费用:${cost}💰</span></div>`;
  }
  if (!html.includes('npc-option')) html = '<p style="color:#888;">没有可镶嵌的装备</p>';
  content.innerHTML = html;
}

function openSocketGemSelect(slot) {
  document.getElementById('npc-name').textContent = '选择宝石';
  const content = document.getElementById('npc-content');
  let html = '<p style="margin-bottom:8px;color:#aaa;">选择要镶嵌的宝石:</p>';
  const inv = state.player?.inventory || [];
  const gems = inv.map((item, idx) => ({ item, idx })).filter(({ item }) => item.type === 'gem');
  if (gems.length === 0) {
    html = '<p style="color:#888;">背包中没有宝石<br><a href="#" onclick="openShop(\'gem\');closeNPC();return false;" style="color:#d4a017;">去商店购买宝石</a></p>';
  } else {
    for (const { item, idx } of gems) {
      const color = state.equipInfo?.qualityColors?.[item.quality] || '#4488ff';
      html += `<div class="npc-option" onclick="doSocketGem('${slot}', ${idx})"><span style="color:${color}">${item.name}</span> <span style="color:#ddd;font-size:11px;">${formatGemStats(item)}</span></div>`;
    }
  }
  content.innerHTML = html;
}

function doSocketGem(slot, gemIndex) {
  closeNPC();
  socket.emit('socket_gem', { slot, gemIndex });
}

function openRemoveGemMenu() {
  if (!state.player) return;
  const slots = ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes'];
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '卸下宝石';
  const content = document.getElementById('npc-content');
  let html = `<p style="margin-bottom:8px;color:#aaa;">选择要卸下宝石的装备 (费用:${REMOVE_GEM_COST}💰):</p>`;
  for (const slot of slots) {
    const item = state.player.equipment?.[slot];
    if (!item || !item.gems?.length) continue;
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    item.gems.forEach((gem, idx) => {
      html += `<div class="npc-option" onclick="doRemoveGem('${slot}', ${idx})"><span style="color:${color}">${item.name}</span> → <span style="color:#4488ff">${gem.name}</span></div>`;
    });
  }
  if (!html.includes('npc-option')) html = '<p style="color:#888;">没有镶嵌宝石的装备</p>';
  content.innerHTML = html;
}

function openAppraiseMenu() {
  if (!state.player) return;
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '鉴定装备';
  const content = document.getElementById('npc-content');
  let html = '<p style="margin-bottom:8px;color:#aaa;">选择鉴定符品质:</p>';
  for (const [q, scroll] of Object.entries(APPRAISE_SCROLLS)) {
    const qNames = {1:'普通(1条属性)',2:'高级(2条属性)',3:'至尊(3条属性)'};
    html += `<div class="npc-option" onclick="doAppraise(${q})">${scroll.name} - ${qNames[q]} - 💰${scroll.price}</div>`;
  }
  content.innerHTML = html;
}

function doAppraise(scrollQuality) {
  if (!state.player) return;
  const inv = (state.player.inventory || []).map((item, idx) => ({item, idx})).filter(({item}) => item && !item.appraised && item.type !== 'potion' && item.type !== 'gem' && item.type !== 'scroll' && item.type !== 'material');
  if (inv.length === 0) { addMessage('没有可鉴定的装备', 'msg-death'); return; }
  const scroll = APPRAISE_SCROLLS[scrollQuality];
  const scrollIdx = (state.player.inventory || []).findIndex(i => i.id === scroll.id);
  if (scrollIdx < 0) { addMessage(`缺少${scroll.name}`, 'msg-death'); return; }

  const panel = document.getElementById('npc-panel');
  document.getElementById('npc-name').textContent = '选择要鉴定的装备';
  const content = document.getElementById('npc-content');
  let html = '';
  inv.forEach(({item, idx}) => {
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    html += `<div class="npc-option" onclick="doAppraisal(${scrollQuality}, ${idx})"><span style="color:${color}">${item.name}</span></div>`;
  });
  content.innerHTML = html;
}

function doAppraisal(scrollQuality, itemIndex) {
  socket.emit('appraise_item', { scrollQuality, itemIndex });
}

function openBlessMenu() {
  if (!state.player) return;
  const slots = ['weapon', 'necklace'];
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '喝祝福油';
  const content = document.getElementById('npc-content');
  let html = `<p style="margin-bottom:8px;color:#aaa;">选择要增加幸运的装备 (武器/项链):</p>`;
  for (const slot of slots) {
    const item = state.player.equipment?.[slot];
    if (!item) continue;
    const currentLucky = item.lucky || 0;
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    const maxed = currentLucky >= LUCKY_MAX;
    html += `<div class="npc-option" onclick="doBless('${slot}')" style="${maxed ? 'opacity:0.4' : ''}"><span style="color:${color}">${item.name}</span> <span style="color:#d4a017">幸运:${currentLucky}/${LUCKY_MAX}</span>${maxed ? ' <span style="color:#40c040">已满</span>' : ''}</div>`;
  }
  const hasOil = (state.player.inventory || []).some(i => i.id === 'bless_oil');
  if (!hasOil) html += '<p style="color:#e04040;text-align:center;margin-top:8px;">缺少祝福油！</p>';
  content.innerHTML = html;
}

function doBless(slot) {
  socket.emit('bless_oil', slot);
}

function openMiningUI() {
  if (!state.player) return;
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '挖矿 - 选择矿点';
  const content = document.getElementById('npc-content');
  const mineSpots = [
    { idx: 0, name: '东侧矿点', x: 15, y: 20 },
    { idx: 1, name: '南侧矿点', x: 25, y: 35 },
    { idx: 2, name: '中央矿点', x: 40, y: 15 },
    { idx: 3, name: '西侧矿点', x: 55, y: 45 },
    { idx: 4, name: '北侧矿点', x: 70, y: 30 },
    { idx: 5, name: '深处矿点', x: 30, y: 50 },
    { idx: 6, name: '废弃矿道', x: 60, y: 55 },
    { idx: 7, name: '隐秘矿脉', x: 45, y: 25 },
  ];
  let html = `<p style="margin-bottom:8px;color:#aaa;">选择一个矿点开始挖矿 (冷却5秒):</p>`;
  mineSpots.forEach(spot => {
    html += `<div class="npc-option" onclick="doMine(${spot.idx})">⛏️ ${spot.name}</div>`;
  });
  content.innerHTML = html;
}

function doMine(spotIdx) {
  socket.emit('mine_ore', spotIdx);
}

function sellOreMenu() {
  if (!state.player) return;
  const inv = (state.player.inventory || []).map((item, idx) => ({item, idx})).filter(({item}) => item.type === 'ore');
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '出售矿石';
  const content = document.getElementById('npc-content');
  if (inv.length === 0) {
    content.innerHTML = '<p style="color:#888;text-align:center;">没有可出售的矿石</p>';
    return;
  }
  let html = '';
  inv.forEach(({item, idx}) => {
    html += `<div class="npc-option" onclick="doSellOre(${idx})"><span style="color:#d4a017">${item.name}</span> - 💰${item.price}</div>`;
  });
  content.innerHTML = html;
}

function doSellOre(itemIndex) {
  socket.emit('sell', itemIndex);
}

function openStallUI() {
  if (!state.player) return;
  const inv = (state.player.inventory || []).filter(item => item.type !== 'ore' && item.type !== 'scroll' && item.type !== 'material');
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '摆摊 - 设置价格';
  const content = document.getElementById('npc-content');
  if (inv.length === 0) {
    content.innerHTML = '<p style="color:#888;text-align:center;">没有可出售的物品</p>';
    return;
  }
  let html = '<p style="margin-bottom:8px;color:#aaa;">选择物品并设置价格:</p>';
  inv.forEach((item, realIdx) => {
    const color = state.equipInfo?.qualityColors?.[item.quality] || (item.type === 'potion' ? '#ff8888' : '#aaa');
    html += `<div class="npc-option"><span style="color:${color}">${item.name}</span><input type="number" id="stall-price-${realIdx}" placeholder="价格" min="1" style="width:80px;margin-left:8px;padding:2px 4px;background:#2a2a2a;border:1px solid #444;color:#ddd;border-radius:3px;font-size:11px;"><button class="shop-buy" onclick="doListStall(${realIdx})" style="margin-left:4px;">上架</button></div>`;
  });
  content.innerHTML = html;
}

function doListStall(itemIndex) {
  const input = document.getElementById(`stall-price-${itemIndex}`);
  const price = parseInt(input?.value);
  if (!price || price <= 0) { addMessage('请输入有效价格', 'msg-death'); return; }
  socket.emit('stall_list', { itemIndex, price });
}

function browseStalls() {
  socket.emit('stall_list_all');
}

window.doListStall = doListStall;

function doRemoveGem(slot, gemIndex) {
  closeNPC();
  socket.emit('remove_gem', { slot, gemIndex });
}

function formatGemStats(item) {
  const s = [];
  if (item.attack) s.push(`攻击+${item.attack}`);
  if (item.defense) s.push(`防御+${item.defense}`);
  if (item.hp) s.push(`生命+${item.hp}`);
  if (item.mp) s.push(`魔法+${item.mp}`);
  return s.join(' ');
}

function recycleAll() {
  if (!state.player?.inventory?.length) { addMessage('背包为空', 'msg-exp'); return; }
  let total = 0;
  state.player.inventory.forEach(item => {
    const qualityMult = {common:1,uncommon:1.5,rare:2,epic:3,legendary:5}[item.quality]||1;
    total += Math.floor(item.levelReq * 10 * qualityMult);
  });
  socket.emit('recycle_all');
  addMessage(`一键回收获得 ${total} 金币`, 'msg-gold');
}

// ===== 仓库系统 =====
let warehouseMode = null; // 'deposit' | 'withdraw'

function openWarehouse(mode) {
  warehouseMode = mode;
  if (mode === 'deposit') {
    // 显示背包，点击物品存入仓库
    addMessage('点击背包装备存入仓库', 'msg-system');
    updateInventory();
  } else {
    socket.emit('warehouse_list');
  }
}

function openWarehouseUI(storage) {
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '仓库 - 取出装备';
  const content = document.getElementById('npc-content');
  content.innerHTML = '';
  if (!storage || storage.length === 0) {
    content.innerHTML = '<p style="color:#888;text-align:center;">仓库为空</p>';
    return;
  }
  storage.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'npc-option';
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    div.innerHTML = `<span style="color:${color}">${item.name}</span> <span style="color:#888;font-size:11px;">${formatItemStats(item)}</span>`;
    div.addEventListener('click', () => {
      socket.emit('warehouse_withdraw', { itemIndex: idx });
    });
    content.appendChild(div);
  });
}

// 仓库物品存入
function handleInventoryDeposit(idx) {
  if (warehouseMode === 'deposit') {
    socket.emit('warehouse_deposit', { itemIndex: idx });
    addMessage('已存入仓库', 'msg-system');
  }
}

// ===== 交易系统 =====
const QUESTS = [
  { id: 'kill_chicken', name: '初出茅庐', desc: '击杀 5 只鸡', type: 'kill', target: '鸡', required: 5, reward: { exp: 50, gold: 100, title: '新手猎人' } },
  { id: 'kill_deer', name: '草原猎人', desc: '击杀 5 只鹿', type: 'kill', target: '鹿', required: 5, reward: { exp: 100, gold: 200, title: '鹿林猎手' } },
  { id: 'level_5', name: '初具实力', desc: '达到 5 级', type: 'level', target: 5, required: 1, reward: { exp: 0, gold: 500, title: '勇士' } },
  { id: 'level_10', name: '渐入佳境', desc: '达到 10 级', type: 'level', target: 10, required: 1, reward: { exp: 0, gold: 1000, title: '强者' } },
  { id: 'kill_50', name: '身经百战', desc: '累计击杀 50 只怪物', type: 'kill_total', target: '', required: 50, reward: { exp: 500, gold: 2000, title: '战斗大师' } },
  { id: 'equip_3', name: '全副武装', desc: '装备 3 件装备', type: 'equip', target: 3, required: 3, reward: { exp: 200, gold: 500, title: '收藏家' } },
];

function checkQuestProgress() {
  if (!state.player) return;
  for (const q of QUESTS) {
    const qs = state.questState?.[q.id];
    if (qs?.completed) continue;
    let progress = 0;
    if (q.type === 'kill') {
      progress = (state.questState?.kill_counts || {})[q.target] || 0;
    } else if (q.type === 'level') {
      progress = state.player.level >= q.target ? 1 : 0;
    } else if (q.type === 'kill_total') {
      progress = state.questState?.total_kills || 0;
    } else if (q.type === 'equip') {
      progress = Object.keys(state.player.equipment || {}).length;
    }
    if (progress >= q.required && !qs?.completed) {
      if (!state.questState) state.questState = {};
      state.questState[q.id] = { completed: true, progress };
      // 发放奖励
      if (q.reward.exp) { state.player.exp += q.reward.exp; }
      if (q.reward.gold) { state.player.gold += q.reward.gold; }
      if (q.reward.title) {
        state.player.title = q.reward.title;
        document.getElementById('current-title').textContent = `[${q.reward.title}] `;
        document.getElementById('title-display').style.display = 'inline';
      }
      addMessage(`🎉 任务完成: ${q.name}！`, 'msg-level');
      updateQuestPanel();
    } else if (!qs) {
      if (!state.questState) state.questState = {};
      state.questState[q.id] = { completed: false, progress: 0 };
    } else {
      qs.progress = progress;
    }
  }
}

function updateQuestPanel() {
  const list = document.getElementById('quest-list');
  if (!list || !state.player) return;
  list.innerHTML = '';
  for (const q of QUESTS) {
    const qs = state.questState?.[q.id];
    const div = document.createElement('div');
    div.className = 'quest-item' + (qs?.completed ? ' completed' : '');
    const prog = qs?.progress || 0;
    div.innerHTML = `<div class="quest-name">${q.name}</div><div class="quest-desc">${q.desc}</div><div class="quest-reward">奖励: ${q.reward.exp}经验 ${q.reward.gold}金币${q.reward.title ? ' ['+q.reward.title+']' : ''}</div><div class="quest-progress">${qs?.completed ? '✅ 已完成' : `${Math.min(prog, q.required)}/${q.required}`}</div>`;
    div.addEventListener('click', () => showQuestDetail(q));
    list.appendChild(div);
  }
}

function showQuestDetail(q) {
  const detail = document.getElementById('quest-detail');
  if (!detail) return;
  const qs = state.questState?.[q.id];
  const prog = qs?.progress || 0;
  detail.innerHTML = `<h3 style="color:#d4a017">${q.name}</h3><p style="color:#aaa;font-size:12px">${q.desc}</p><div class="quest-objective ${qs?.completed?'completed':''}">目标: ${Math.min(prog, q.required)}/${q.required}</div>`;
}

// ===== 面板切换 =====
document.getElementById('trade-btn').addEventListener('click', () => {
  const panel = document.getElementById('trade-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('trade-close').addEventListener('click', () => { document.getElementById('trade-panel').style.display = 'none'; });

document.getElementById('quest-btn').addEventListener('click', () => {
  const panel = document.getElementById('quest-panel');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) updateQuestPanel();
});
document.getElementById('quest-close').addEventListener('click', () => { document.getElementById('quest-panel').style.display = 'none'; });

function updateEquipPanel() {
  // 使用renderEquipTab代替，支持TAB切换
  renderEquipTab(currentEquipTab || 'default');
}

// 装备TAB切换
let currentEquipTab = 'default';

function renderEquipTab(tab) {
  currentEquipTab = tab;
  const container = document.getElementById('equip-slots');
  if (!state.player || !state.equipInfo) return;
  container.innerHTML = '';

  const tabSlots = {
    default: ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes'],
    zodiac: ['zodiac_鼠','zodiac_牛','zodiac_虎','zodiac_兔','zodiac_龙','zodiac_蛇','zodiac_马','zodiac_羊','zodiac_猴','zodiac_鸡','zodiac_狗','zodiac_猪'],
    wuxing: ['wuxing_金锐_神锋','wuxing_金锐_神铠','wuxing_金锐_神链','wuxing_金锐_神戒',
             'wuxing_木灵_神锋','wuxing_木灵_神铠','wuxing_木灵_神链','wuxing_木灵_神戒',
             'wuxing_水渊_神锋','wuxing_水渊_神铠','wuxing_水渊_神链','wuxing_水渊_神戒',
             'wuxing_火狱_神锋','wuxing_火狱_神铠','wuxing_火狱_神链','wuxing_火狱_神戒',
             'wuxing_土岳_神锋','wuxing_土岳_神铠','wuxing_土岳_神链','wuxing_土岳_神戒'],
  };
  const tabNames = { default:'默认装备', zodiac:'生肖装备', wuxing:'五行装备' };
  const slotNames = {
    weapon:'武器',armor:'衣服',helmet:'头盔',necklace:'项链',
    bracelet1:'手镯1',bracelet2:'手镯2',ring1:'戒指1',ring2:'戒指2',
    belt:'腰带',shoes:'鞋子',
    'zodiac_鼠':'鼠', 'zodiac_牛':'牛', 'zodiac_虎':'虎', 'zodiac_兔':'兔',
    'zodiac_龙':'龙', 'zodiac_蛇':'蛇', 'zodiac_马':'马', 'zodiac_羊':'羊',
    'zodiac_猴':'猴', 'zodiac_鸡':'鸡', 'zodiac_狗':'狗', 'zodiac_猪':'猪',
    'wuxing_金锐':'金', 'wuxing_木灵':'木', 'wuxing_水渊':'水', 'wuxing_火狱':'火', 'wuxing_土岳':'土',
    'wuxing_金锐_神锋':'金·锋', 'wuxing_金锐_神铠':'金·铠', 'wuxing_金锐_神链':'金·链', 'wuxing_金锐_神戒':'金·戒',
    'wuxing_木灵_神锋':'木·锋', 'wuxing_木灵_神铠':'木·铠', 'wuxing_木灵_神链':'木·链', 'wuxing_木灵_神戒':'木·戒',
    'wuxing_水渊_神锋':'水·锋', 'wuxing_水渊_神铠':'水·铠', 'wuxing_水渊_神链':'水·链', 'wuxing_水渊_神戒':'水·戒',
    'wuxing_火狱_神锋':'火·锋', 'wuxing_火狱_神铠':'火·铠', 'wuxing_火狱_神链':'火·链', 'wuxing_火狱_神戒':'火·戒',
    'wuxing_土岳_神锋':'土·锋', 'wuxing_土岳_神铠':'土·铠', 'wuxing_土岳_神链':'土·链', 'wuxing_土岳_神戒':'土·戒',
  };

  document.querySelectorAll('.equip-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const slots = tabSlots[tab] || tabSlots.default;
  slots.forEach(slot => {
    const item = state.player.equipment?.[slot];
    const div = document.createElement('div');
    div.className = 'equip-slot' + (item ? '' : ' empty');
    const name = slotNames[slot] || slot;
    if (item) {
      const color = state.equipInfo.qualityColors?.[item.quality] || '#aaa';
      const stats = formatItemStats(item);
      const btLevel = item.breakthroughLevel || 0;
      const btHtml = btLevel > 0 ? `<div style="color:#ffcc00;font-size:11px">⚡ 突破 +${btLevel}</div>` : '';
      const bonusHtml = (item.bonusAttrs && item.bonusAttrs.length > 0) ? item.bonusAttrs.map(a =>
        `<div style="color:#cc88ff;font-size:10px">${a.name} +${a.value}</div>`
      ).join('') : '';
      div.innerHTML = `<div class="slot-name">${name}</div><div class="item-name" style="color:${color}">${item.name}${btLevel > 0 ? ` <span style="color:#ffcc00">⚡${btLevel}</span>` : ''}</div><div class="equip-tooltip"><div class="equip-tooltip-header" style="color:${color}">${item.name}</div>${btHtml}<div class="equip-tooltip-stats">${stats}</div>${bonusHtml}<div class="equip-tooltip-hint">点击卸下</div></div>`;
      div.addEventListener('pointerdown', e => { e.preventDefault(); socket.emit('unequip', slot); });
    } else {
      div.innerHTML = `<div class="slot-name">${name}</div><div class="item-name" style="color:#555">空</div>`;
    }
    container.appendChild(div);
  });
  updateSetBonusPanel();
}

// TAB点击事件
document.addEventListener('click', e => {
  if (e.target.classList.contains('equip-tab')) {
    renderEquipTab(e.target.dataset.tab);
  }
});

function updateSetBonusPanel() {
  if (!state.player || !state.equipInfo) return;
  const container = document.getElementById('set-bonus-items');
  if (!container) return;
  const equippedIds = new Set();
  for (const slot of state.equipInfo.slots) {
    const item = state.player.equipment?.[slot];
    if (item) equippedIds.add(item.id);
  }
  const allSets = { ...state.equipInfo?.setInfo, ...(state.zodiacSets || {}), ...(state.wuxingSets || {}) };
  const setNames = {
    woma_set:'沃玛套装', zumma_set:'祖玛套装', holy_set:'圣战套装',
    demon_set:'恶魔套装', heaven_set:'开天套装',
  };
  let html = '';
  for (const [setId, set] of Object.entries(allSets)) {
    if (!set.pieces) continue;
    // 跳过生肖套装，后面单独处理
    if (setId.startsWith('zodiac_tier_')) continue;
    const hasAll = set.pieces.every(id => equippedIds.has(id));
    if (hasAll) {
      const name = setNames[setId] || set.name || setId;
      html += `<div style="padding:6px 8px;border-bottom:1px solid #333;font-size:11px;">`;
      html += `<span style="color:#d4a017;font-weight:bold;">${name}</span><br>`;
      if (set.bonus?.attack) html += `<span style="color:#40c040;">攻+${set.bonus.attack}</span> `;
      if (set.bonus?.defense) html += `<span style="color:#40c040;">防+${set.bonus.defense}</span> `;
      if (set.bonus?.hp) html += `<span style="color:#40c040;">HP+${set.bonus.hp}</span> `;
      if (set.bonus?.mp) html += `<span style="color:#40c040;">MP+${set.bonus.mp}</span>`;
      html += `</div>`;
    }
  }
  // 生肖套装：12个槽位都有装备时，按最低阶激活
  const zodiacSlots = ['zodiac_鼠','zodiac_牛','zodiac_虎','zodiac_兔','zodiac_龙','zodiac_蛇','zodiac_马','zodiac_羊','zodiac_猴','zodiac_鸡','zodiac_狗','zodiac_猪'];
  const equippedTiers = [];
  for (const slot of zodiacSlots) {
    const item = state.player.equipment?.[slot];
    if (!item) { equippedTiers.length = 0; break; }
    const m = item.id.match(/^zodiac_([一-鿿]+)_(\d+)$/);
    if (m) equippedTiers.push(parseInt(m[2]));
  }
  if (equippedTiers.length === 12) {
    const minTier = Math.min(...equippedTiers);
    const allZodiacSets = state.zodiacSets || {};
    const zodiacSet = allZodiacSets[`zodiac_tier_${minTier}`];
    if (zodiacSet) {
      html += `<div style="padding:6px 8px;border-bottom:1px solid #333;font-size:11px;">`;
      html += `<span style="color:#d4a017;font-weight:bold;">${zodiacSet.name}</span><br>`;
      if (zodiacSet.bonus?.attack) html += `<span style="color:#40c040;">攻+${zodiacSet.bonus.attack}</span> `;
      if (zodiacSet.bonus?.defense) html += `<span style="color:#40c040;">防+${zodiacSet.bonus.defense}</span> `;
      if (zodiacSet.bonus?.hp) html += `<span style="color:#40c040;">HP+${zodiacSet.bonus.hp}</span> `;
      if (zodiacSet.bonus?.mp) html += `<span style="color:#40c040;">MP+${zodiacSet.bonus.mp}</span>`;
      html += `</div>`;
    }
  }
  if (!html) html = '<div style="padding:8px;color:#888;font-size:11px;">未激活套装</div>';
  container.innerHTML = html;
}

function formatItemStats(item) {
  const s = [];
  if (item.attack) s.push(`攻击 +${item.attack}`);
  if (item.defense) s.push(`防御 +${item.defense}`);
  if (item.hp) s.push(`生命 +${item.hp}`);
  if (item.mp) s.push(`魔法 +${item.mp}`);
  if (item.lucky) s.push(`幸运 +${item.lucky}`);
  // 鉴定属性
  if (item.appraised && item.appraiseQuality) {
    const aParts = [];
    if (item.attack) aParts.push(`攻+${item.attack}`);
    if (item.defense) aParts.push(`防+${item.defense}`);
    if (item.hp) aParts.push(`HP+${item.hp}`);
    if (item.mp) aParts.push(`MP+${item.mp}`);
    if (item.lucky) aParts.push(`幸运+${item.lucky}`);
    const qNames = {1:'普通',2:'高级',3:'至尊'};
    s.push(`<span style="color:#ffcc00">[鉴定(${qNames[item.appraiseQuality]})]</span>`);
  }
  // 强化信息
  if (item.enhanceLevel > 0) {
    const pct = Math.round(ENHANCE_STAT_BONUS(item.enhanceLevel) * 100);
    s.push(`<span style="color:#ff8800">强化 +${item.enhanceLevel} (全属性+${pct}%)</span>`);
  }
  // 宝石信息
  if (item.gems?.length) {
    for (const gem of item.gems) {
      const parts = [];
      if (gem.attack) parts.push(`攻+${gem.attack}`);
      if (gem.defense) parts.push(`防+${gem.defense}`);
      if (gem.hp) parts.push(`HP+${gem.hp}`);
      if (item.mp) parts.push(`MP+${gem.mp}`);
      s.push(`<span style="color:#44ccff">[镶嵌:${gem.name} ${parts.join(' ')}]</span>`);
    }
  }
  return s.join('<br>') || '无属性';
}

function getItemTooltipHTML(item) {
  if (!item) return '';
  const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
  const stats = formatItemStats(item);

  // 确定对比槽位
  let compareSlot = null;
  let compareLabel = '';

  if (item.id?.startsWith('wuxing_')) {
    // 五行装备：根据元素+部位找对应槽位
    const match = item.id.match(/^wuxing_([a-z]+)_(weapon|armor|necklace|ring)/);
    if (match) {
      const el = match[1];
      const part = match[2];
      const slotName = part === 'weapon' ? '神锋' : part === 'armor' ? '神铠' : part === 'necklace' ? '神链' : '神戒';
      const cn = { metal:'金锐', wood:'木灵', water:'水渊', fire:'火狱', earth:'土岳' }[el];
      compareSlot = `wuxing_${cn}_${slotName}`;
      compareLabel = cn + '·' + slotName;
    }
  } else if (item.id?.startsWith('zodiac_')) {
    // 生肖装备：根据生肖名找对应槽位
    const match = item.id.match(/^zodiac_([鼠牛虎兔龙蛇马羊猴鸡狗猪])_/);
    if (match) {
      compareSlot = `zodiac_${match[1]}`;
      compareLabel = match[1] + '年';
    }
  } else {
    // 普通装备
    let itemSlot = item.slot || {weapon:'weapon',armor:'armor',jewelry:'necklace'}[item.type] || null;
    if (itemSlot === 'bracelet') {
      const has1 = state.player?.equipment?.bracelet1;
      const has2 = state.player?.equipment?.bracelet2;
      if (!has1) itemSlot = 'bracelet1';
      else if (!has2) itemSlot = 'bracelet2';
      else itemSlot = itemScore(state.player.equipment.bracelet1) <= itemScore(state.player.equipment.bracelet2) ? 'bracelet1' : 'bracelet2';
    } else if (itemSlot === 'ring') {
      const has1 = state.player?.equipment?.ring1;
      const has2 = state.player?.equipment?.ring2;
      if (!has1) itemSlot = 'ring1';
      else if (!has2) itemSlot = 'ring2';
      else itemSlot = itemScore(state.player.equipment.ring1) <= itemScore(state.player.equipment.ring2) ? 'ring1' : 'ring2';
    }
    compareSlot = itemSlot;
    const slotNames = {weapon:'武器',armor:'衣服',helmet:'头盔',necklace:'项链',bracelet1:'手镯1',bracelet2:'手镯2',ring1:'戒指1',ring2:'戒指2',belt:'腰带',shoes:'鞋子'};
    compareLabel = slotNames[itemSlot] || itemSlot;
  }

  const eqItem = compareSlot && state.player?.equipment?.[compareSlot];
  let compare = '';
  if (eqItem) {
    const eqColor = state.equipInfo?.qualityColors?.[eqItem.quality] || '#aaa';
    const diffs = [];
    const atkD = (item.attack||0) - (eqItem.attack||0);
    const defD = (item.defense||0) - (eqItem.defense||0);
    const hpD = (item.hp||0) - (eqItem.hp||0);
    const mpD = (item.mp||0) - (eqItem.mp||0);
    const lucD = (item.lucky||0) - (eqItem.lucky||0);
    if (atkD !== 0) diffs.push(`<span style="color:${atkD > 0 ? '#40c040' : '#e04040'}">攻击 ${atkD > 0 ? '+' : ''}${atkD}</span>`);
    if (defD !== 0) diffs.push(`<span style="color:${defD > 0 ? '#40c040' : '#e04040'}">防御 ${defD > 0 ? '+' : ''}${defD}</span>`);
    if (hpD !== 0) diffs.push(`<span style="color:${hpD > 0 ? '#40c040' : '#e04040'}">生命 ${hpD > 0 ? '+' : ''}${hpD}</span>`);
    if (mpD !== 0) diffs.push(`<span style="color:${mpD > 0 ? '#40c040' : '#e04040'}">魔法 ${mpD > 0 ? '+' : ''}${mpD}</span>`);
    if (lucD !== 0) diffs.push(`<span style="color:${lucD > 0 ? '#40c040' : '#e04040'}">幸运 ${lucD > 0 ? '+' : ''}${lucD}</span>`);
    if (diffs.length === 0) diffs.push('<span style="color:#888">属性相同</span>');
    compare = `<div class="compare-section"><span class="compare-label">对比 ${compareLabel}:</span><span class="compare-equipped" style="color:${eqColor}">${eqItem.name}</span><span class="compare-diff">${diffs.join('')}</span></div>`;
  }

  const enhanceText = item.enhanceLevel > 0 ? `<span class="equip-tooltip-enhance" style="color:#ff8800">✨ 强化 +${item.enhanceLevel}</span>` : '';
  const btLevel = item.breakthroughLevel || 0;
  const btText = btLevel > 0 ? `<span class="equip-tooltip-enhance" style="color:#ffcc00">⚡ 突破 +${btLevel}</span>` : '';
  const bonusText = (item.bonusAttrs && item.bonusAttrs.length > 0) ? item.bonusAttrs.map(a =>
    `<span style="color:#cc88ff;font-size:11px">${a.name} +${a.value}</span>`
  ).join('') : '';
  return `<div class="equip-tooltip"><span class="equip-tooltip-header" style="color:${color}">${item.name}${item.enhanceLevel > 0 ? ` +${item.enhanceLevel}` : ''}</span><span class="equip-tooltip-level">需要等级: ${item.levelReq}</span>${enhanceText}${btText}<span class="equip-tooltip-stats">${stats}</span>${bonusText ? `<span class="equip-tooltip-gems">${bonusText}</span>` : ''}${compare}</div>`;
}

// 检查背包物品是否比当前装备的属性更好
function isUpgrade(item) {
  let compareSlot = null;

  if (item.id?.startsWith('wuxing_')) {
    const match = item.id.match(/^wuxing_([a-z]+)_(weapon|armor|necklace|ring)/);
    if (match) {
      const el = match[1];
      const part = match[2];
      const slotName = part === 'weapon' ? '神锋' : part === 'armor' ? '神铠' : part === 'necklace' ? '神链' : '神戒';
      const cn = { metal:'金锐', wood:'木灵', water:'水渊', fire:'火狱', earth:'土岳' }[el];
      compareSlot = `wuxing_${cn}_${slotName}`;
    }
  } else if (item.id?.startsWith('zodiac_')) {
    const match = item.id.match(/^zodiac_([鼠牛虎兔龙蛇马羊猴鸡狗猪])_/);
    if (match) {
      compareSlot = `zodiac_${match[1]}`;
    }
  } else {
    let itemSlot = item.slot || {weapon:'weapon',armor:'armor',jewelry:'necklace',belt:'belt',shoes:'shoes'}[item.type] || null;
    if (itemSlot === 'bracelet') {
      const has1 = state.player?.equipment?.bracelet1;
      const has2 = state.player?.equipment?.bracelet2;
      if (!has1) itemSlot = 'bracelet1';
      else if (!has2) itemSlot = 'bracelet2';
      else itemSlot = itemScore(state.player.equipment.bracelet1) <= itemScore(state.player.equipment.bracelet2) ? 'bracelet1' : 'bracelet2';
    } else if (itemSlot === 'ring') {
      const has1 = state.player?.equipment?.ring1;
      const has2 = state.player?.equipment?.ring2;
      if (!has1) itemSlot = 'ring1';
      else if (!has2) itemSlot = 'ring2';
      else itemSlot = itemScore(state.player.equipment.ring1) <= itemScore(state.player.equipment.ring2) ? 'ring1' : 'ring2';
    }
    compareSlot = itemSlot;
  }

  if (!compareSlot) return false;
  const eqItem = state.player?.equipment?.[compareSlot];
  if (!eqItem) return true;

  // 综合评分
  const score = (item) => (item.attack||0) * 3 + (item.defense||0) * 2 + (item.hp||0) + (item.mp||0);
  return score(item) > score(eqItem);
}

function itemScore(item) {
  return (item?.attack||0) * 3 + (item?.defense||0) * 2 + (item?.hp||0) + (item?.mp||0);
}

function updateInventory() {
  const container = document.getElementById('inv-items');
  if (!state.player || !state.equipInfo) return;
  container.innerHTML = '';
  const inv = state.player.inventory || [];
  if (!inv.length) { container.innerHTML = '<div style="color:#555;padding:8px;font-size:12px">背包为空</div>'; return; }
  inv.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'inv-item';
    const isPotion = item.type === 'potion';
    const isGem = item.type === 'gem';
    if (isGem) {
      const color = state.equipInfo?.qualityColors?.[item.quality] || '#4488ff';
      div.innerHTML = `<div class="item-name" style="color:${color}">${item.name}</div><div style="position:absolute;right:2px;top:2px;color:#4488ff;font-size:8px">镶嵌</div>`;
      div.style.cursor = 'default';
    } else if (isPotion) {
      const potion = state.potions?.[item.id];
      const potionName = potion ? potion.name : item.name;
      div.innerHTML = `<div class="item-name" style="color:#ff8888">${potionName}</div><div style="position:absolute;right:2px;top:2px;color:#40c040;font-size:8px">使用</div>`;
      div.style.cursor = 'pointer';
      div.addEventListener('pointerdown', e => {
        e.preventDefault();
        socket.emit('use_potion', { itemIndex: idx });
      });
    } else {
      const color = state.equipInfo.qualityColors?.[item.quality] || '#aaa';
      const upgradeArrow = isUpgrade(item) ? '<div class="upgrade-arrow">▲</div>' : '';
      div.innerHTML = `${upgradeArrow}<div class="item-name" style="color:${color}">${item.name}</div>${getItemTooltipHTML(item)}`;
      div.style.cursor = 'pointer';
      div.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (warehouseMode === 'deposit') {
          handleInventoryDeposit(idx);
        } else {
          socket.emit('equip', idx);
        }
      });
      div.addEventListener('contextmenu', e => { e.preventDefault(); socket.emit('sell', idx); });
    }
    container.appendChild(div);
  });
}

// ===== 面板折叠 =====
document.getElementById('afk-btn').addEventListener('click', () => {
  state.afkMode = !state.afkMode;
  const btn = document.getElementById('afk-btn');
  if (state.afkMode) { btn.style.borderColor = '#40c040'; btn.style.color = '#40c040'; addMessage('🤖 挂机开启', 'msg-level'); startAfkLoop(); }
  else { btn.style.borderColor = ''; btn.style.color = ''; addMessage('挂机关闭', 'msg-exp'); stopAfkLoop(); }
});

document.getElementById('dungeon-btn').addEventListener('click', () => {
  const panel = document.getElementById('dungeon-panel');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible && state.dungeons) updateDungeonList();
});
document.getElementById('dungeon-close').addEventListener('click', () => { document.getElementById('dungeon-panel').style.display = 'none'; });
document.getElementById('exit-dungeon-btn').addEventListener('click', () => { socket.emit('exit_dungeon'); });

document.getElementById('shop-btn').addEventListener('click', () => openShop('potion'));

document.getElementById('recycle-btn').addEventListener('click', () => recycleAll());

document.getElementById('worldboss-btn').addEventListener('click', () => {
  const panel = document.getElementById('worldboss-panel');
  const visible = panel.style.display !== 'none';
  panel.style.display = visible ? 'none' : 'block';
  if (!visible) updateWorldBossPanel();
});

document.getElementById('chat-toggle').addEventListener('click', () => {
  const panel = document.getElementById('chat-panel');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});
document.getElementById('chat-send').addEventListener('click', sendChat);
document.querySelectorAll('.chat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.chatTab = tab.dataset.tab;
  });
});

document.getElementById('map-btn').addEventListener('click', () => {
  const maps = Object.keys(MAPS);
  const idx = (maps.indexOf(state.currentMap) + 1) % maps.length;
  teleport(maps[idx]);
});

document.getElementById('attr-toggle').addEventListener('click', function() {
  const c = document.getElementById('attr-content'); const v = c.style.display !== 'none';
  c.style.display = v ? 'none' : 'block'; this.textContent = v ? '展开' : '收起';
});
document.getElementById('equip-toggle').addEventListener('click', function() {
  const c = document.getElementById('equip-slots'); const v = c.style.display !== 'none';
  c.style.display = v ? 'none' : 'grid'; this.textContent = v ? '展开' : '收起';
});

function toggleInventory() {
  const panel = document.getElementById('inventory-panel');
  panel.classList.toggle('show');
}
document.getElementById('inv-close').addEventListener('click', toggleInventory);
// 点击背包外关闭
document.addEventListener('click', e => {
  const panel = document.getElementById('inventory-panel');
  if (panel.classList.contains('show') && !panel.contains(e.target) && !e.target.closest('#inv-toggle') && !e.target.closest('#shop-btn')) {
    panel.classList.remove('show');
  }
});

// ===== Socket 事件 =====
socket.on('connect', () => { state.connected = true; const d = document.getElementById('conn-dot'); if(d) d.className = 'connected'; const t = document.getElementById('conn-text'); if(t) t.textContent = '已连接'; });
socket.on('disconnect', () => { state.connected = false; const d = document.getElementById('conn-dot'); if(d) d.className = 'disconnected'; const t = document.getElementById('conn-text'); if(t) t.textContent = '已断开'; });

socket.on('login_success', player => {
  state.player = player; state.running = true;
  state.currentMap = player.map_id || 'bichon';
  state.player.exp = player.exp || 0;
  state.player.level = player.level || 1;
  state.player.gold = player.gold || 0;
  state.player.inventory = player.inventory || [];
  state.questState = player.quest_state || {};
  // 显示称号
  if (player.title) {
    state.player.title = player.title;
    document.getElementById('current-title').textContent = `[${player.title}] `;
    document.getElementById('title-display').style.display = 'inline';
  }
  // 初始化技能冷却状态
  state.skillCooldowns = {};
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  generateMap(); spawnNPCs();
  addMessage('欢迎来到传奇！', 'msg-exp');
  addMessage('WASD移动，点击NPC交互，点击怪物攻击', 'msg-exp');
  updateSkillBar(); updateAttrPanel(); updateEquipPanel(); updateInventory(); updateHUD();
  if (state.afkMode) { startAfkLoop(); document.getElementById('afk-btn').style.borderColor = '#40c040'; }
  checkQuestProgress();
});

socket.on('classes_info', c => { state.classes = c; updateSkillBar(); });
socket.on('equip_info', info => {
  state.equipInfo = info;
  state.equipInfo.slots = ['weapon','armor','helmet','necklace','bracelet1','bracelet2','ring1','ring2','belt','shoes',
    'zodiac_鼠','zodiac_牛','zodiac_虎','zodiac_兔','zodiac_龙','zodiac_蛇','zodiac_马','zodiac_羊','zodiac_猴','zodiac_鸡','zodiac_狗','zodiac_猪',
    'wuxing_金锐_神锋','wuxing_金锐_神铠','wuxing_金锐_神链','wuxing_金锐_神戒',
    'wuxing_木灵_神锋','wuxing_木灵_神铠','wuxing_木灵_神链','wuxing_木灵_神戒',
    'wuxing_水渊_神锋','wuxing_水渊_神铠','wuxing_水渊_神链','wuxing_水渊_神戒',
    'wuxing_火狱_神锋','wuxing_火狱_神铠','wuxing_火狱_神链','wuxing_火狱_神戒',
    'wuxing_土岳_神锋','wuxing_土岳_神铠','wuxing_土岳_神链','wuxing_土岳_神戒'];
  renderEquipTab('default');
  updateInventory();
});
socket.on('zodiac_sets', s => { state.zodiacSets = s; });
socket.on('wuxing_sets', s => { state.wuxingSets = s; });
socket.on('potions_info', p => { state.potions = p; });
socket.on('dungeon_info', d => { state.dungeons = d; });
socket.on('shop_items', s => { Object.assign(SHOP_ITEMS, s); });

socket.on('world_state', data => {
  // 确保 currentMap 是有效的（跳过无尽副本实例ID）
  if (!state.endlessActive) {
    const validMaps = Object.keys(MAPS);
    if (!validMaps.includes(state.currentMap)) {
      state.currentMap = 'bichon';
    }
  }
  // 更新怪物列表：无尽副本期间用 mapId 过滤，非无尽用 currentMap 过滤
  if (state.endlessActive && state.endlessInstanceId) {
    state.monsters = data.monsters.filter(m => m.mapId === state.endlessInstanceId);
  } else {
    state.monsters = data.monsters.filter(m => m.mapId === state.currentMap);
  }
  state.otherPlayers = data.players.filter(p => p.id !== state.player?.id);
  if (state.player) {
    const me = data.players.find(p => p.id === state.player.id);
    if (me) {
      // 同步装备、背包、属性、金币、MP、经验、等级、HP（服务器是权威来源）
      state.player.equipment = me.equipment || {};
      state.player.inventory = me.inventory || [];
      state.player.attack = me.attack; state.player.defense = me.defense;
      state.player.gold = me.gold || 0;
      state.player.mp = me.mp || 0; state.player.max_mp = me.max_mp || 0;
      state.player.exp = me.exp || 0; state.player.level = me.level || 1;
      state.player.cultivationRealm = me.cultivationRealm || 0; state.player.cultivationStage = me.cultivationStage || 1;
      state.player.hp = me.hp || 0; state.player.max_hp = me.max_hp || 0;
      // 同步技能冷却（服务端存剩余秒数，客户端转为时间戳）
      const srvCd = me.skillCooldowns || {};
      for (const [sid, remaining] of Object.entries(srvCd)) {
        if (remaining > 0) {
          state.skillCooldowns[sid] = Date.now() + remaining * 1000;
        } else {
          delete state.skillCooldowns[sid];
        }
      }
      // 清理本地已过期的冷却
      for (const [sid, cdEnd] of Object.entries(state.skillCooldowns)) {
        if (Date.now() >= cdEnd) delete state.skillCooldowns[sid];
      }
      updateSkillBarCooldowns();
    }
  }
  if (state.selectedMonster) {
    const m = state.monsters.find(m => m.id === state.selectedMonster.id);
    if (!m) { state.selectedMonster = null; stopAutoAttack(); } else state.selectedMonster = m;
  }
  updateHUD(); updateTargetInfo(); updateAttrPanel(); updateEquipPanel(); updateInventory();
});

socket.on('attack_result', result => {
  if (result.error === 'not_enough_mp') { addMessage('MP不足！','msg-death'); return; }
  if (result.error === 'skill_on_cooldown') { addMessage('技能冷却中！','msg-death'); return; }
  if (result.error === 'monster_not_found') {
    addMessage('目标已消失，寻找新目标', 'msg-system');
    state.selectedMonster = null;
    return;
  }
  if (result.drop) { const q = state.equipInfo?.qualityNames?.[result.drop.quality]||result.drop.quality; addMessage(`🎁 ${result.drop.name} [${q}]`,'msg-equip'); }
  if (result.skillId) {
    const s = state.classes?.[state.player?.class]?.skills?.find(s=>s.id===result.skillId);
    if (s) addMessage(`${s.name} 造成 ${result.damage} 伤害`,'msg-skill');
  } else {
    addMessage(`造成 ${result.damage} 伤害`,'msg-damage');
  }
  if (result.killed) {
    if (result.isWorldBoss) {
      addMessage(`🎉 世界BOSS被击杀！+${result.exp}经验 +${result.gold}金币`,'msg-level');
    } else {
      addMessage(`击杀！+${result.exp}经验`,'msg-exp');
    }
    addMessage(`+${result.gold}金币`,'msg-gold');
    // 更新任务进度
    if (state.player) {
      if (!state.questState) state.questState = {};
      if (!state.questState.kill_counts) state.questState.kill_counts = {};
      const monsterName = state.selectedMonster?.name || '';
      state.questState.kill_counts[monsterName] = (state.questState.kill_counts[monsterName] || 0) + 1;
      state.questState.total_kills = (state.questState.total_kills || 0) + 1;
      checkQuestProgress();
    }
    if (state.player) {
      state.player.exp += result.exp;
      state.player.gold = (state.player.gold||0) + result.gold;
      if (result.leveledUp) {
        state.player.level++;
        const cls = state.classes?.[state.player.class];
        if (cls) {
          state.player.max_hp += cls.hpGrowth + state.player.level;
          state.player.max_mp += cls.mpGrowth + Math.floor(state.player.level * 0.5);
          state.player.attack += cls.atkGrowth + Math.floor(state.player.level * 0.3);
          state.player.defense += cls.defGrowth + Math.floor(state.player.level * 0.2);
          state.player.hp = state.player.max_hp;
          state.player.mp = state.player.max_mp;
        }
        addMessage(`🎉 升级 Lv.${state.player.level}`,'msg-level');
      }
      updateHUD(); updateAttrPanel();
    }
    state.selectedMonster = null; stopAutoAttack(); updateTargetInfo();
  }
  if (result.newSkills?.length) { result.newSkills.forEach(s => addMessage(`🌟 ${s}`,'msg-level')); updateSkillBar(); }
});

// 技能使用结果
socket.on('skill_result', result => {
  if (result.error) {
    const msgs = { skill_not_found:'技能不存在', wrong_class:'不是你的职业技能', level_too_low:'等级不足', not_enough_mp:'MP不足！', no_target:'没有目标', target_not_found:'目标不在范围内', skill_not_learned:'未学习该技能', on_cooldown:'技能冷却中！' };
    addMessage(msgs[result.error] || result.error, 'msg-death');
    return;
  }
  const skill = getClientSkills(state.player.class).find(s => s.id === result.skillId);
  if (!skill) return;

  // 设置客户端冷却
  state.skillCooldowns[result.skillId] = Date.now() + result.cooldown;

  if (result.heal) {
    addMessage(`${skill.name} 恢复 ${result.heal} HP`, 'msg-heal');
    if (state.player) { state.player.hp = result.hp; state.player.mp = result.mp; }
  } else if (result.summon) {
    addMessage(`${skill.name} 召唤骷髅战士！`, 'msg-level');
    if (state.player) { state.player.mp = result.mp; }
  } else if (result.aoe) {
    addMessage(`${skill.name} 命中 ${result.hitCount} 个目标，总伤害 ${result.totalDamage}`, 'msg-skill');
    if (state.player) { state.player.mp = result.mp; }
    state.selectedMonster = null; updateTargetInfo();
  } else if (result.damage !== undefined) {
    const dotText = result.dot ? ' (中毒)' : '';
    addMessage(`${skill.name} 造成 ${result.damage} 伤害${dotText}`, 'msg-skill');
    if (state.player) { state.player.mp = result.mp; }
  }

  updateSkillBar(); updateHUD(); updateAttrPanel();
});

socket.on('potion_used', data => {
  if (state.player) {
    state.player.hp = data.hp; state.player.max_hp = data.max_hp;
    state.player.mp = data.mp; state.player.max_mp = data.max_mp;
    state.player.inventory = data.inventory;
    updateHUD(); updateAttrPanel(); updateInventory();
  }
  addMessage(`使用了 ${data.name}`, 'msg-system');
});

// 强化结果
socket.on('enhance_result', r => {
  if (r.success) {
    addMessage(`✨ 强化成功！+${r.enhanceLevel}`, 'msg-level');
  } else {
    addMessage('强化失败...', 'msg-death');
  }
});
socket.on('enhance_error', r => {
  if (r.error === 'no_equipment') addMessage('该装备栏没有装备', 'msg-death');
  else if (r.error === 'max_enhance') addMessage('已达到最高强化等级 +12', 'msg-level');
  else if (r.error === 'not_enough_gold') addMessage(`金币不足！需要 ${r.cost} 金币`, 'msg-death');
});

// 宝石镶嵌结果
socket.on('socket_gem_result', r => { addMessage('宝石镶嵌成功！', 'msg-equip'); });
socket.on('socket_gem_error', r => {
  if (r.error === 'no_sockets_left') addMessage(`孔位已满 (最多${r.max}个)`, 'msg-death');
  else if (r.error === 'invalid_gem') addMessage('无效的宝石', 'msg-death');
  else if (r.error === 'not_enough_gold') addMessage(`金币不足！需要 ${r.cost} 金币`, 'msg-death');
});

// 卸下宝石结果
socket.on('remove_gem_result', r => { addMessage(`已卸下 ${r.returnedGem}`, 'msg-system'); });
socket.on('remove_gem_error', r => {
  if (r.error === 'no_gem') addMessage('该装备没有镶嵌宝石', 'msg-death');
  else if (r.error === 'not_enough_gold') addMessage(`金币不足！需要 ${r.cost} 金币`, 'msg-death');
});

// 鉴定结果
socket.on('appraise_result', r => {
  const attrText = r.attrs.map(a => {
    const names = {attack:'攻击',defense:'防御',hp:'生命',mp:'魔法',lucky:'幸运'};
    return `${names[a.name]||a.name}+${a.value}`;
  }).join(', ');
  addMessage(`鉴定成功！获得属性: ${attrText}`, 'msg-level');
  openAppraiseMenu();
});
socket.on('appraise_error', r => {
  const msgs = {already_appraised:'装备已鉴定过',not_equipment:'不能鉴定该物品',invalid_scroll:'无效的鉴定符',no_scroll:'缺少鉴定符'};
  addMessage(msgs[r.error] || `鉴定失败: ${r.error}`, 'msg-death');
});

// 祝福油结果
socket.on('bless_result', r => {
  if (r.success) {
    addMessage(`祝福油生效！幸运+1，当前幸运:${r.lucky}`, 'msg-level');
  } else {
    addMessage('祝福油使用失败，幸运未变化', 'msg-death');
  }
  openBlessMenu();
});
socket.on('bless_error', r => {
  const msgs = {no_equipment:'未装备该物品',invalid_slot:'只能对武器或项链使用',max_lucky:'幸运值已满',no_oil:'缺少祝福油'};
  addMessage(msgs[r.error] || `错误: ${r.error}`, 'msg-death');
});

// 挖矿结果
socket.on('mine_result', r => {
  if (r.success) {
    addMessage(`⛏️ 挖到 ${r.ore}! +${r.exp}经验`, 'msg-level');
    openMiningUI();
  } else {
    addMessage(`⛏️ ${r.message}`, 'msg-death');
  }
});
socket.on('mine_error', r => {
  if (r.error === 'wrong_map') addMessage('必须在僵尸洞矿区才能挖矿', 'msg-death');
  else if (r.error === 'on_cooldown') addMessage(`挖矿冷却中！剩余${r.remaining}秒`, 'msg-death');
  else addMessage(`挖矿失败: ${r.error}`, 'msg-death');
});

// 摆摊结果
socket.on('stall_listed', r => { addMessage(`摆摊上架成功: ${r.itemName} 价格${r.price}💰`, 'msg-system'); openStallUI(); });
socket.on('stall_error', r => addMessage(`摆摊失败: ${r.error}`, 'msg-death'));
socket.on('stall_list', stalls => {
  if (!stalls.length) { addMessage('当前没有摊位', 'msg-system'); return; }
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '摊位列表';
  const content = document.getElementById('npc-content');
  let html = '';
  stalls.forEach((stall, si) => {
    html += `<p style="color:#d4a017;font-weight:bold;margin-top:8px;">🏪 ${stall.name} (${stall.items.length}件)</p>`;
    stall.items.forEach((item, ii) => {
      const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
      html += `<div class="npc-option" onclick="doBuyStall('${stall.ownerName}', ${ii})"><span style="color:${color}">${item.name}</span> <span style="color:#d4a017">${item.price}💰</span></div>`;
    });
  });
  content.innerHTML = html;
});
socket.on('stall_bought', r => { addMessage(`购买成功: ${r.itemName} -${r.price}💰`, 'msg-equip'); });

function doBuyStall(ownerName, itemIdx) {
  socket.emit('stall_buy', { stallOwnerId: ownerName, itemIdx });
}

// 转生
socket.on('rebirth_result', r => {
  addMessage(`🌟 转生成功！${r.title} (第${r.tier}转)`, 'msg-level');
});
socket.on('rebirth_error', r => {
  if (r.error === 'max_rebirth') addMessage('已达到最高转生等级(10转)', 'msg-level');
  else if (r.error === 'level_too_low') addMessage(`等级不足！需要${r.required}级`, 'msg-death');
  else if (r.error === 'not_enough_gold') addMessage(`金币不足！需要${r.cost}💰`, 'msg-death');
  else addMessage(`转生失败: ${r.error}`, 'msg-death');
});

// 突破
socket.on('breakthrough_result', r => {
  addMessage(`⚡ 突破成功！${r.realmName}·${r.stage}重 (倍率 x${r.mult.toFixed(2)})`, 'msg-level');
  updateAttrPanel();
  updateRebirthButton();
});
socket.on('breakthrough_error', r => {
  if (r.error === 'level_too_low') addMessage(`等级不足！需要${r.required}级`, 'msg-death');
  else if (r.error === 'not_enough_gold') addMessage(`金币不足！需要${r.cost}💰`, 'msg-death');
  else addMessage(`突破失败: ${r.error}`, 'msg-death');
});

// 声望
socket.on('reputation_result', r => {
  addMessage(`声望: ${r.reputation} (${r.tier})`, 'msg-system');
});

// 排行榜
socket.on('leaderboard_result', ({type, list}) => {
  const typeNames = { level: '等级榜', gold: '财富榜', reputation: '声望榜', combat: '战力榜' };
  let html = `<p style="color:#d4a017;font-weight:bold;margin-bottom:8px;">${typeNames[type] || type}</p>`;
  list.forEach(p => {
    html += `<div style="padding:4px;border-bottom:1px solid #333;font-size:12px;">${p.rank}. ${p.username} [${p.level}级] ${p.cultivationRealm > 0 ? '境界' + p.cultivationRealm : ''} 攻${p.attack || 0}</div>`;
  });
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '排行榜';
  document.getElementById('npc-content').innerHTML = html;
});

// 合成结果
socket.on('synth_result', r => {
  if (r.success) {
    addMessage(`合成成功！${r.itemName} [${r.quality}]`, 'msg-level');
  } else {
    addMessage(`合成失败！${r.message || '消耗了金币'}`, 'msg-death');
  }
});
socket.on('synth_error', r => {
  const msgs = { not_enough_items:'需要3件同品质装备', different_quality:'品质不一致', max_quality:'已是最高品质', not_enough_gold:'金币不足' };
  addMessage(msgs[r.error] || r.error, 'msg-death');
});

// 每日活动
socket.on('daily_list', ({date, activities}) => {
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '每日活动';
  const content = document.getElementById('npc-content');
  let html = `<p style="color:#aaa;margin-bottom:8px;">${date}</p>`;
  activities.forEach(a => {
    const done = a.completed ? '✅' : '⬜';
    const btn = a.completed ? '' : `<button class="shop-buy" onclick="completeDaily('${a.id}')" style="margin-left:8px;">领取</button>`;
    html += `<div class="npc-option" style="display:flex;justify-content:space-between;align-items:center;">${done} ${a.name} - ${a.desc} - 💰${a.reward.gold} +${a.reward.exp}EXP${btn}</div>`;
  });
  content.innerHTML = html;
});
socket.on('daily_completed', r => {
  addMessage(`完成每日活动: ${r.activity} +💰${r.reward.gold} +${r.reward.exp}EXP`, 'msg-level');
  socket.emit('get_daily');
});
socket.on('daily_error', r => addMessage(`活动失败: ${r.error}`, 'msg-death'));

// 结婚系统
socket.on('marriage_success', r => {
  addMessage(`💕 求婚成功！${r.partner}同意与你结婚！`, 'msg-level');
});
socket.on('marriage_error', r => {
  const msgs = { level_too_low:'等级不足', already_married:'你已结婚', target_not_found:'目标玩家不在线', cannot_self:'不能和自己结婚', target_married:'对方已结婚', no_ring:'缺少求婚戒指', not_married:'你未结婚', partner_offline:'伴侣不在线' };
  addMessage(msgs[r.error] || r.error, 'msg-death');
});
socket.on('marriage_info', r => {
  if (r.married) {
    addMessage(`已婚，伴侣: ${r.partnerName}`, 'msg-system');
  } else {
    addMessage('未婚', 'msg-system');
  }
});
socket.on('divorce_success', () => addMessage('💔 已离婚', 'msg-death'));

// 押镖
socket.on('escort_started', r => {
  addMessage(`🚚 押镖开始！目标: ${r.targetName} (${r.duration}秒)`, 'msg-level');
});
socket.on('escort_completed', r => {
  addMessage(`押镖完成！+${r.exp}EXP +${r.gold}💰`, 'msg-level');
});
socket.on('escort_error', r => {
  const msgs = { already_escorting:'正在进行押镖', level_too_low:'等级不足', no_escort:'没有押镖任务' };
  addMessage(msgs[r.error] || r.error, 'msg-death');
});

// 经脉
socket.on('meridian_result', r => {
  addMessage(`经脉打通: ${r.meridian} 达到${r.level}级`, 'msg-level');
});
socket.on('meridian_error', r => {
  const msgs = { invalid_meridian:'无效经脉', max_level:'已满级', not_enough_gold:'金币不足' };
  addMessage(msgs[r.error] || r.error, 'msg-death');
});
socket.on('meridian_state', state => {
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '经脉系统';
  const content = document.getElementById('npc-content');
  let html = '';
  for (const [key, val] of Object.entries(state)) {
    const done = val.opened >= val.max ? '✅' : '○';
    html += `<div class="npc-option" style="cursor:pointer" onclick="openMeridian('${key}')">${done} ${val.name} (${val.attr}) ${val.opened}/${val.max} - ${val.cost}💰</div>`;
  }
  content.innerHTML = html;
});

// 坐骑翅膀
socket.on('mount_result', r => { addMessage(`获得坐骑: ${r.mount}`, 'msg-level'); });
socket.on('mount_error', r => { addMessage(`坐骑购买失败: ${r.error}`, 'msg-death'); });
socket.on('wings_result', r => { addMessage(`获得翅膀: ${r.wings}`, 'msg-level'); });
socket.on('wings_error', r => { addMessage(`翅膀购买失败: ${r.error}`, 'msg-death'); });

// 师徒
// 师徒
socket.on('apprentice_success', r => { addMessage(`拜师成功: ${r.masterName}`, 'msg-level'); });
socket.on('apprentice_error', r => {
  const msgs = { level_too_high:'等级过高不能拜师', already_apprentice:'已有师傅', master_not_found:'师傅不在线', master_level_too_low:'师傅等级不足' };
  addMessage(msgs[r.error] || r.error, 'msg-death');
});
socket.on('master_info', r => {
  if (r.hasMaster) addMessage(`师傅: ${r.masterName} (${r.masterLevel}级)`, 'msg-system');
  else addMessage('暂无师傅', 'msg-system');
});
socket.on('apprentices_list', r => {
  if (r.list.length === 0) addMessage('暂无徒弟', 'msg-system');
  else addMessage(`徒弟: ${r.list.map(a => `${a.name}(${a.level}级)`).join(', ')}`, 'msg-system');
});

// 英雄/元神
socket.on('hero_unlocked', r => { addMessage(`🌟 元神解锁: ${r.hero.name} (${r.hero.class})`, 'msg-level'); });
socket.on('hero_info', r => {
  if (r.unlocked === false) addMessage('未解锁元神 (需要30级+10000💰)', 'msg-system');
  else addMessage(`元神: ${r.name} Lv.${r.level} ATK:${r.attack} DEF:${r.defense}`, 'msg-system');
});
socket.on('hero_attack_result', r => {
  if (r.killed) addMessage(`元神击杀！升级至Lv.${r.heroLevel}`, 'msg-level');
  else addMessage(`元神攻击: 造成${r.damage}伤害 (怪物HP:${r.monsterHp})`, 'msg-damage');
});
socket.on('hero_error', r => {
  const msgs = { level_too_low:'等级不足', already_has_hero:'已有元神', not_enough_gold:'金币不足', invalid_class:'无效的元神职业', no_hero:'未解锁元神', target_not_found:'目标不在范围内' };
  addMessage(msgs[r.error] || r.error, 'msg-death');
});

// 沙巴克攻城战
socket.on('siege_started', r => { addMessage(`⚔️ 沙巴克攻城战开始！持续${r.duration}分钟`, 'msg-level'); });
socket.on('gate_attacked', r => { addMessage(`攻击${r.gate === 'main' ? '正门' : '侧门'}: 造成${r.damage}伤害 (${r.gateHp}/${r.maxHp})`, 'msg-damage'); });
socket.on('siege_completed', r => { addMessage(`🏆 沙巴克攻城战结束！${r.winner}获胜！`, 'msg-level'); });
socket.on('siege_state', r => {
  if (!r.active) { addMessage('沙巴克攻城战未开启', 'msg-system'); return; }
  addMessage(`攻城中 - 正门:${r.gates.main.hp}/${r.gates.main.maxHp} 侧门:${r.gates.side.hp}/${r.gates.side.maxHp}`, 'msg-system');
});
socket.on('siege_error', r => { addMessage(`攻城失败: ${r.error}`, 'msg-death'); });

// 成就系统
socket.on('achievement_list', list => {
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '成就系统';
  const content = document.getElementById('npc-content');
  let html = '';
  list.forEach(a => {
    const done = a.unlocked ? '🏆' : '🔒';
    const color = a.unlocked ? '#d4a017' : '#666';
    html += `<div class="npc-option" style="color:${color}">${done} ${a.name} - ${a.desc} - 💰${a.reward.gold} +${a.reward.reputation}声望</div>`;
  });
  content.innerHTML = html;
});

function doRebirth() {
  const realm = state.player.cultivationRealm || 0;
  const stage = state.player.cultivationStage || 1;
  const realmNames = ['炼气','筑基','金丹','元婴','化神','炼虚','合体','大乘','渡劫','真仙','金仙','太乙','大罗','混元','道祖','圣人','天道','混沌','无极'];
  const realmName = realmNames[realm] || `第${realm + 1}境`;
  const nextName = realmNames[realm + (stage >= 9 ? 1 : 0)] || `第${realm + (stage >= 9 ? 2 : 1)}境`;
  if (confirm(`突破到${nextName}·${stage >= 9 ? 1 : stage + 1}重，属性将大幅提升。确认突破？`)) {
    socket.emit('breakthrough');
  }
}

function openSynthUI() {
  if (!state.player) return;
  const inv = (state.player.inventory || []).map((item, idx) => ({ item, idx })).filter(({ item }) => item && item.type !== 'potion' && item.type !== 'ore' && item.type !== 'gem' && item.type !== 'scroll' && item.type !== 'material' && item.quality !== 'divine');
  inv.sort((a, b) => (a.item.name || '').localeCompare(b.item.name || ''));
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '装备合成 - 选择3件同品质装备';
  const content = document.getElementById('npc-content');
  if (inv.length < 3) {
    content.innerHTML = '<p style="color:#888;text-align:center;">背包中可合成装备不足3件</p>';
    return;
  }
  let html = '<p style="margin-bottom:8px;color:#aaa;">点击选择3件同品质装备:</p>';
  const qNames = { common: '普通', uncommon: '优秀', rare: '精良', epic: '史诗', legendary: '传说', mythic: '神话', divine: '仙器' };
  inv.forEach(({ item, idx }) => {
    const color = state.equipInfo?.qualityColors?.[item.quality] || '#aaa';
    const q = qNames[item.quality] || item.quality;
    html += `<div class="npc-option" onclick="toggleSynth(${idx})"><span style="color:${color}">[${q}] ${item.name}</span></div>`;
  });
  html += `<div style="text-align:center;margin-top:12px;"><button class="shop-buy" onclick="doSynth()" style="font-size:14px;padding:8px 16px;">合成</button></div>`;
  content.innerHTML = html;
  state.synthSelected = [];
}

function toggleSynth(idx) {
  if (!state.synthSelected) state.synthSelected = [];
  const pos = state.synthSelected.indexOf(idx);
  if (pos >= 0) state.synthSelected.splice(pos, 1);
  else state.synthSelected.push(idx);
  // 刷新UI高亮
  const opts = document.querySelectorAll('#npc-content .npc-option');
  opts.forEach((opt, i) => {
    if (state.synthSelected.includes(parseInt(opt.getAttribute('onclick').match(/\d+/)[0]))) {
      opt.style.background = '#3a3a2a';
      opt.style.border = '1px solid #d4a017';
    } else {
      opt.style.background = '';
      opt.style.border = '';
    }
  });
}

function doSynth() {
  if (!state.synthSelected || state.synthSelected.length !== 3) {
    addMessage('请选择3件装备', 'msg-death');
    return;
  }
  // 立即从本地移除，等服务端确认
  const indices = [...state.synthSelected].sort((a, b) => b - a);
  if (state.player?.inventory) {
    indices.forEach(idx => state.player.inventory.splice(idx, 1));
  }
  state.synthSelected = [];
  openSynthUI();
  socket.emit('synth_equip', indices);
}

window.doRebirth = doRebirth;
window.doBuyStall = doBuyStall;
window.toggleSynth = toggleSynth;
window.doSynth = doSynth;
window.completeDaily = (id) => socket.emit('complete_daily', id);

function openProposeUI() {
  const target = prompt('输入要求婚的玩家名称:');
  if (target) socket.emit('propose', target);
}
window.openProposeUI = openProposeUI;
window.openMeridian = (id) => socket.emit('open_meridian', id);

function openApprenticeUI() {
  const name = prompt('输入师傅的玩家名称:');
  if (name) socket.emit('become_apprentice', name);
}
window.openApprenticeUI = openApprenticeUI;

socket.on('player_damaged', d => {
  if (state.player) {
    state.player.hp = Math.max(1, state.player.hp - d.damage);
    updateHUD(); updateAttrPanel();
  }
  addMessage(`受到 ${d.damage} 伤害`,'msg-death');
});
socket.on('player_death', () => {
  if (state.player) {
    state.player.hp = state.player.max_hp;
    state.player.mp = state.player.max_mp;
    state.player.x = 50; state.player.y = 50;
    state.currentMap = 'bichon';
    generateMap(); spawnNPCs();
    updateHUD(); updateAttrPanel();
  }
  addMessage('你已阵亡，复活在比奇城...','msg-death');
  stopAutoAttack();
});

socket.on('equip_success', r => {
  addMessage('装备成功','msg-equip');
});
socket.on('equip_error', r => {
  if (r.error === 'level_too_low') addMessage(`等级不足！需要${r.required}级`,'msg-death');
  else addMessage(`装备失败: ${r.error}`,'msg-death');
});

socket.on('unequip_success', r => {
  addMessage('卸下成功','msg-equip');
});

socket.on('sell_success', r => {
  addMessage(`${r.sold?.name || '物品'}出售成功 +${r.price || 0}💰`,'msg-gold');
  if (state.player) {
    state.player.gold = r.gold || 0;
    updateHUD();
    updateAttrPanel();
  }
});

socket.on('recycle_success', r => {
  addMessage('回收成功','msg-gold');
  if (state.player) {
    state.player.gold = r.gold || 0;
    state.player.inventory = [];
    updateHUD();
    updateAttrPanel();
    updateInventory();
  }
});

// 仓库
socket.on('warehouse_list', data => {
  openWarehouseUI(data.storage);
});

socket.on('warehouse_updated', data => {
  if (state.player) {
    state.player.inventory = data.inventory;
    state.player.storage = data.storage;
  }
  updateInventory();
  openWarehouseUI(data.storage);
});

socket.on('buy_success', item => {
  addMessage(`购买了 ${item.name}`,'msg-equip');
  // 不修改本地状态，等待 world_state 同步
});

socket.on('buy_error', r => addMessage(`购买失败: ${r.error||''}`, 'msg-death'));

socket.on('chat_msg', data => {
  if (state.chatTab === 'world') addChatMsg(`${data.username}: ${data.text}`);
});

socket.on('system_msg', text => { addMessage(text, 'msg-system'); addChatMsg(text, 'msg-sys'); });

socket.on('worldboss_list', bosses => {
  renderWorldBossList(bosses);
});

socket.on('worldboss_update', bosses => {
  if (worldBossPanel && worldBossPanel.style.display !== 'none') {
    renderWorldBossList(bosses);
  }
});

socket.on('teleport_result', data => {
  state.currentMap = data.map;
  generateMap(); spawnNPCs();
  addMessage(`传送到了 ${MAPS[data.map]?.name||data.map}`, 'msg-system');
  updateHUD();
});

socket.on('dungeon_attack_result', r => {
  if (r.error) return;
  if (r.drop) {
    const eq = state.equipInfo?.equipDb?.find(e => e.id === r.drop?.id);
    const name = eq ? eq.name : (r.drop?.id || '');
    addMessage(`副本掉落: ${name}`, 'msg-equip');
  }
  addMessage(`${r.damage} 伤害`,'msg-damage');
  if (r.killed) {
    addMessage(`击杀！+${r.exp}经验`,'msg-exp');
    if (r.isBoss) {
      addMessage('🎉 副本Boss已击败！即将返回...', 'msg-level');
      // 等待服务器传送
    }
    if (state.player) {
      state.player.exp += r.exp;
      state.player.gold = (state.player.gold||0) + r.gold;
      if (r.leveledUp) {
        state.player.level++;
        const cls = state.classes?.[state.player.class];
        if (cls) {
          state.player.max_hp += cls.hpGrowth + state.player.level;
          state.player.max_mp += cls.mpGrowth + Math.floor(state.player.level * 0.5);
          state.player.attack += cls.atkGrowth + Math.floor(state.player.level * 0.3);
          state.player.defense += cls.defGrowth + Math.floor(state.player.level * 0.2);
          state.player.hp = state.player.max_hp;
          state.player.mp = state.player.max_mp;
        }
        addMessage(`🎉 升级 Lv.${state.player.level}`,'msg-level');
      }
      updateHUD(); updateAttrPanel();
    }
  }
});

// 副本内自动攻击
socket.on('dungeon_entered', r => {
  if (r.error) { addMessage('进入副本失败','msg-death'); return; }
  addMessage(`进入 ${r.dungeonName}！`,'msg-level');
  // 立即清空旧地图怪物，防止进入副本后还显示原地图怪物
  state.monsters = [];
  state.currentMap = r.mapId;
  state.selectedMonster = null;
  generateMap(); spawnNPCs();
  updateHUD();
  // 更新地图显示
  document.getElementById('current-map').textContent = r.dungeonName;
  // 显示副本状态面板
  const dungeonState = document.getElementById('dungeon-state');
  if (dungeonState) dungeonState.style.display = 'block';
  document.getElementById('dungeon-name-text').textContent = r.dungeonName;
  // 隐藏副本列表，显示副本状态
  document.getElementById('dungeon-list').style.display = 'none';
  dungeonState.style.display = 'block';
});

socket.on('dungeon_exited', r => {
  // 立即清空副本怪物，等待 world_state 填充原地图怪物
  state.monsters = [];
  state.currentMap = r.map;
  state.selectedMonster = null;
  generateMap(); spawnNPCs();
  updateHUD();
  document.getElementById('current-map').textContent = (MAPS[state.currentMap]||MAPS.bichon).name;
  // 隐藏副本状态面板，恢复副本列表
  const dungeonState = document.getElementById('dungeon-state');
  if (dungeonState) dungeonState.style.display = 'none';
  const dungeonList = document.getElementById('dungeon-list');
  if (dungeonList) { dungeonList.style.display = 'block'; updateDungeonList(); }
});

// ===== 无尽副本 =====
function openEndlessDungeonMenu() {
  if (!state.player) return;
  const panel = document.getElementById('npc-panel');
  panel.style.display = 'block';
  document.getElementById('npc-name').textContent = '⚔ 无尽副本';
  const content = document.getElementById('npc-content');
  let html = '<p style="margin-bottom:8px;color:#aaa;">无尽副本 - 层数无限，奖励无限！</p>';
  html += '<p style="font-size:11px;color:#888;margin-bottom:8px;">每10层一个BOSS，掉落突破材料和高阶装备</p>';
  html += `<div class="npc-option" onclick="doEnterEndless()" style="background:#8b0000;border-color:#ff4400;">⚔ 进入无尽副本</div>`;
  html += `<div class="npc-option" onclick="doExitEndless()">退出无尽副本</div>`;
  content.innerHTML = html;
}

function doEnterEndless() {
  closeNPC();
  socket.emit('enter_endless');
}

function doExitEndless() {
  closeNPC();
  socket.emit('exit_endless');
}

socket.on('endless_entered', r => {
  addMessage(`⚔ 进入无尽副本第${r.layer}层！怪物数量:${r.monsterCount}`, 'msg-level');
  state.currentMap = r.instanceId;
  state.monsters = r.monsters || [];
  state.endlessLayer = r.layer;
  state.endlessInstanceId = r.instanceId;
  state.endlessActive = true;
  if (r.bossInfo) addMessage(`👹 BOSS: ${r.bossInfo.name} Lv.${r.bossInfo.level}`, 'msg-boss');
  // 清空旧NPC和物品，只显示副本怪物
  state.npcs = [];
  state.items = [];
  // 设置无尽副本地图尺寸（80x60）
  MAP.width = 80; MAP.height = 60;
  // 生成简单的洞穴风格地图
  for (let y = 0; y < MAP.height; y++) {
    MAP.tiles[y] = [];
    for (let x = 0; x < MAP.width; x++) {
      const edge = x < 1 || x >= MAP.width-1 || y < 1 || y >= MAP.height-1;
      MAP.tiles[y][x] = edge ? 1 : (Math.random() < 0.05 ? 3 : 0);
    }
  }
  updateDungeonUI(r);
});

socket.on('endless_error', r => {
  const msgs = { level_too_low: `等级不足！需要${r.required}级` };
  addMessage(msgs[r.error] || `错误: ${r.error}`, 'msg-death');
});

socket.on('endless_exited', r => {
  addMessage('已退出无尽副本', 'msg-system');
  state.currentMap = r.map;
  state.monsters = [];
  state.endlessLayer = 0;
  state.endlessActive = false;
  generateMap(); spawnNPCs();
  updateHUD();
  document.getElementById('current-map').textContent = (MAPS[state.currentMap]||MAPS.bichon).name;
});

socket.on('endless_attack_result', r => {
  // 无论成功还是失败，都设置技能冷却
  if (r.skillId) {
    const cooldownMs = r.cooldown ? r.cooldown * 1000 : 0;
    const skill = getClientSkills(state.player?.class)?.find(s => s.id === r.skillId);
    if (skill) {
      state.skillCooldowns[r.skillId] = Date.now() + (cooldownMs || skill.cooldown || 2000);
    }
  }
  if (r.error) {
    if (r.error === 'skill_on_cooldown') addMessage('技能冷却中', 'msg-death');
    else if (r.error === 'monster_not_found' || r.error === 'target_not_found') {
      addMessage('目标已消失，寻找新目标', 'msg-system');
      state.selectedMonster = null;
    }
    else addMessage(`错误: ${r.error}`, 'msg-death');
    return;
  }
  if (r.killed) {
    state.monsters = state.monsters.filter(m => m.id !== r.monsterId);
    addMessage(`击杀 ${r.isBoss ? ' BOSS' : '怪物'}！获得 ${r.exp}经验 ${r.gold}金币`, 'msg-level');
    if (r.isBoss) addMessage('BOSS被击败！掉落大量突破材料', 'msg-equip');
    // 击杀后清除选中，让挂机自动找下一个
    if (state.selectedMonster && state.selectedMonster.id === r.monsterId) {
      state.selectedMonster = null;
    }
  }
  updateDungeonUI();
  if (state.player) updateInventory();
});

socket.on('endless_next_layer', r => {
  state.endlessLayer = r.layer;
  state.monsters = r.monsters || [];
  addMessage(`🎉 恭喜！进入第${r.layer}层！`, 'msg-level');
  if (r.bossInfo) addMessage(`👹 BOSS: ${r.bossInfo.name} Lv.${r.bossInfo.level}`, 'msg-boss');
  updateDungeonUI();
});

function updateDungeonUI(data) {
  // 更新地图显示为无尽副本
  document.getElementById('current-map').textContent = `无尽副本·第${state.endlessLayer || '?'}层`;
  // 更新怪物显示
  if (state.monsters && state.monsters.length > 0) {
    // 怪物已在 world_state 或 endless_entered 中更新
  }
}

function updateDungeonList() {
  const c = document.getElementById('dungeon-list'); if (!c || !state.dungeons || !state.player) return;
  c.innerHTML = '';
  for (const [id, d] of Object.entries(state.dungeons)) {
    const div = document.createElement('div');
    const canEnter = state.player.level >= d.levelReq;
    div.className = 'dungeon-entry' + (canEnter?'':' locked');
    const rewards = d.rewards.map(r => {
      const eq = state.equipInfo?.equipDb?.find(e => e.id === r.id);
      return eq ? eq.name : r.id;
    }).join('、');
    div.innerHTML = `<div class="d-name">${d.name}</div><div class="d-info">需要 Lv.${d.levelReq} | Boss: ${d.boss.name}</div><div class="d-rewards">奖励: ${rewards}</div>${canEnter?'':'<div style="color:#e04040;font-size:10px;margin-top:2px">等级不足</div>'}`;
    if (canEnter) div.addEventListener('click', () => socket.emit('enter_dungeon', id));
    c.appendChild(div);
  }
}

// ===== 职业选择 =====
document.querySelectorAll('.class-option').forEach(el => {
  el.addEventListener('click', () => { document.querySelectorAll('.class-option').forEach(e => e.classList.remove('selected')); el.classList.add('selected'); state.selectedClass = el.dataset.class; });
});

// ===== 登录 =====
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('username').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
function doLogin() {
  const u = document.getElementById('username').value.trim();
  if (u.length < 2) { alert('至少2个字符'); return; }
  socket.emit('login', {username: u, playerClass: state.selectedClass});
}

// ===== 世界BOSS面板 =====
let worldBossPanel = null;

function createWorldBossPanel() {
  const panel = document.createElement('div');
  panel.id = 'worldboss-panel';
  panel.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:340px;max-height:400px;background:#1a1a1af0;border:1px solid #555;border-radius:8px;overflow-y:auto;z-index:100;display:none;';
  panel.innerHTML = `
    <div class="panel-header"><span>世界BOSS</span><span class="panel-toggle" id="worldboss-close">关闭</span></div>
    <div id="worldboss-list" style="padding:8px;"></div>
  `;
  document.getElementById('game-screen').appendChild(panel);
  worldBossPanel = panel;
  document.getElementById('worldboss-close').addEventListener('click', () => { panel.style.display = 'none'; });
}

function updateWorldBossPanel() {
  socket.emit('worldboss_list');
}

function renderWorldBossList(bosses) {
  const container = document.getElementById('worldboss-list');
  if (!container) return;
  container.innerHTML = '';
  const now = Date.now();
  for (const wb of bosses) {
    const div = document.createElement('div');
    div.style.cssText = 'padding:10px 12px;margin:4px 0;background:#2a2a2a;border:1px solid #444;border-radius:4px;';
    if (wb.active) {
      const hpRatio = wb.hp / wb.maxHp;
      const barColor = hpRatio > 0.5 ? '#40c040' : hpRatio > 0.25 ? '#c0c040' : '#c04040';
      div.style.borderColor = '#ff4400';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#ff8800;font-weight:bold;font-size:14px;">👑 ${wb.name}</span>
          <span style="color:#ff4444;font-size:11px;">已刷新</span>
        </div>
        <div style="color:#aaa;font-size:11px;margin-top:2px;">地图: ${wb.mapName} | HP: ${wb.hp}/${wb.maxHp}</div>
        <div style="background:#333;height:8px;border-radius:4px;margin-top:4px;overflow:hidden;">
          <div style="background:${barColor};height:100%;width:${hpRatio*100}%;transition:width 0.3s;"></div>
        </div>
        <div style="color:#ff8800;font-size:10px;margin-top:2px;">⚔ 快去讨伐！</div>
      `;
    } else {
      const timeLeft = wb.nextSpawn - now;
      const minutes = Math.max(0, Math.floor(timeLeft / 60000));
      const seconds = Math.max(0, Math.floor((timeLeft % 60000) / 1000));
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:#888;font-weight:bold;font-size:14px;">👑 ${wb.name}</span>
          <span style="color:#40c040;font-size:11px;">${minutes}分${seconds}秒后刷新</span>
        </div>
        <div style="color:#aaa;font-size:11px;margin-top:2px;">地图: ${wb.mapName}</div>
      `;
    }
    container.appendChild(div);
  }
}

createWorldBossPanel();

generateMap();
function gameLoop() { render(); requestAnimationFrame(gameLoop); }
gameLoop();
window.state = state;
window.socket = socket;
window.doAppraise = doAppraise;
window.doAppraisal = doAppraisal;
window.doBless = doBless;
window.doMine = doMine;
window.doSellOre = doSellOre;
