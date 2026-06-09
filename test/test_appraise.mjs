// 直接测试鉴定逻辑核心部分
console.log('=== 鉴定逻辑核心测试 ===\n');

// 鉴定配置（从engine.js复制）
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

// 模拟装备
const item = {
  id: 'iron_sword',
  name: '铁剑',
  type: 'weapon',
  attack: 5,
  defense: 0,
  hp: 0,
  mp: 0,
  levelReq: 5,
  quality: 'common',
  appraised: false,
};

const scrollQuality = 1; // 普通鉴定符

console.log('测试前装备属性:');
console.log(`  攻击: ${item.attack}`);
console.log(`  防御: ${item.defense}`);
console.log(`  HP: ${item.hp}`);

// 模拟鉴定逻辑
console.log('\n执行鉴定...');
const count = APPRAISE_COUNTS[scrollQuality];
const ranges = APPRAISE_RANGES[scrollQuality];
const attrs = [];
const appraisedStats = {};
const shuffled = [...APPRAISE_ATTRS].sort(() => Math.random() - 0.5);

for (let i = 0; i < count && i < shuffled.length; i++) {
  const attr = shuffled[i];
  const [min, max] = ranges[attr];
  const val = min + Math.floor(Math.random() * (max - min + 1));
  item[attr] = (item[attr] || 0) + val;
  appraisedStats[attr] = val;
  attrs.push({ name: attr, value: val });
}

item.appraised = true;
item.appraiseQuality = scrollQuality;
item.appraisedStats = appraisedStats;

console.log('鉴定属性:', attrs);

// 验证结果
console.log('\n验证装备数据:');
console.log(`  已鉴定: ${item.appraised ? '✅' : ''}`);
console.log(`  鉴定品质: ${item.appraiseQuality}`);
console.log(`  appraisedStats: ${JSON.stringify(item.appraisedStats)}`);
console.log(`  当前攻击: ${item.attack} (基础5 + 鉴定${appraisedStats.attack || 0})`);

// 验证tooltip显示
console.log('\n验证tooltip显示:');
const s = [];
if (item.attack) s.push(`攻击 +${item.attack}`);
if (item.defense) s.push(`防御 +${item.defense}`);
if (item.hp) s.push(`生命 +${item.hp}`);
if (item.mp) s.push(`魔法 +${item.mp}`);
if (item.lucky) s.push(`幸运 +${item.lucky}`);

if (item.appraised && item.appraiseQuality && item.appraisedStats) {
  const qNames = {1:'普通',2:'高级',3:'至尊'};
  const aParts = [];
  const attrNames = {attack:'攻',defense:'防',hp:'HP',mp:'MP',lucky:'幸运'};
  for (const [attr, val] of Object.entries(item.appraisedStats)) {
    aParts.push(`${attrNames[attr]||attr}+${val}`);
  }
  s.push(`[鉴定(${qNames[item.appraiseQuality]})] ${aParts.join(' ')}`);
}

console.log('Tooltip:', s.join('<br>'));

const hasDetail = s.some(line => line.includes('鉴定') && /[攻防HP幸运]\+\d+/.test(line));
console.log(`鉴定属性单独显示: ${hasDetail ? '✅' : '❌'}`);

if (hasDetail && item.appraisedStats && Object.keys(item.appraisedStats).length > 0) {
  console.log('\n=== 测试通过 ===');
} else {
  console.log('\n=== 测试失败 ===');
  process.exit(1);
}
