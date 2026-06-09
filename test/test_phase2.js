const io = require('socket.io-client');

async function test() {
  console.log('=== 阶段二：多职业系统测试 ===\n');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  ✅ ${msg}`); passed++; }
    else { console.log(`  ❌ ${msg}`); failed++; }
  }

  // 测试 1-3: 三职业创建
  const c1 = io('http://localhost:3000');
  let classesInfo = null;
  c1.on('classes_info', info => { classesInfo = info; });

  const warrior = await new Promise((resolve) => {
    c1.on('login_success', p => resolve(p));
    c1.emit('login', { username: 'warrior_test', playerClass: 'warrior' });
  });
  assert(warrior.class === 'warrior', '战士职业创建成功');
  assert(warrior.max_hp > warrior.max_mp, '战士 HP > MP');
  assert(warrior.defense > 5, '战士防御较高');
  console.log(`  战士属性: HP=${warrior.max_hp} MP=${warrior.max_mp} ATK=${warrior.attack} DEF=${warrior.defense}`);

  await new Promise(r => setTimeout(r, 500));
  assert(classesInfo !== null, '收到职业信息');

  const c2 = io('http://localhost:3000');
  const mage = await new Promise((resolve) => {
    c2.on('login_success', p => resolve(p));
    c2.emit('login', { username: 'mage_test', playerClass: 'mage' });
  });
  assert(mage.class === 'mage', '法师职业创建成功');
  assert(mage.max_mp > mage.max_hp, '法师 MP > HP');
  assert(mage.attack > warrior.attack, '法师攻击 > 战士攻击');
  console.log(`  法师属性: HP=${mage.max_hp} MP=${mage.max_mp} ATK=${mage.attack} DEF=${mage.defense}`);

  const c3 = io('http://localhost:3000');
  const taoist = await new Promise((resolve) => {
    c3.on('login_success', p => resolve(p));
    c3.emit('login', { username: 'taoist_test', playerClass: 'taoist' });
  });
  assert(taoist.class === 'taoist', '道士职业创建成功');
  assert(taoist.max_hp > mage.max_hp && taoist.max_hp < warrior.max_hp, '道士 HP 居中');
  assert(taoist.max_mp > warrior.max_mp && taoist.max_mp < mage.max_mp, '道士 MP 居中');
  console.log(`  道士属性: HP=${taoist.max_hp} MP=${taoist.max_mp} ATK=${taoist.attack} DEF=${taoist.defense}`);

  // 职业差异
  assert(warrior.max_hp > mage.max_hp, '战士 HP > 法师 HP');
  assert(mage.max_mp > warrior.max_mp, '法师 MP > 战士 MP');

  // 职业技能信息
  assert(classesInfo.warrior, '有战士职业信息');
  assert(classesInfo.mage, '有法师职业信息');
  assert(classesInfo.taoist, '有道士职业信息');
  assert(classesInfo.warrior.skills.length === 4, '战士有4个技能');
  assert(classesInfo.mage.skills.length === 4, '法师有4个技能');
  assert(classesInfo.taoist.skills.length === 4, '道士有4个技能');

  // 战士技能
  const wSkills = classesInfo.warrior.skills;
  assert(wSkills[0].id === 'fire_sword', '战士技能1: 烈火剑法');
  assert(wSkills[0].damageMult === 1.8, '烈火剑法伤害倍率 1.8');
  assert(wSkills[3].id === 'berserk', '战士技能4: 狂暴之力');

  // 法师技能
  const mSkills = classesInfo.mage.skills;
  assert(mSkills[0].id === 'fireball', '法师技能1: 火球术');
  assert(mSkills[3].id === 'meteor', '法师技能4: 流星火雨');

  // 道士技能
  const tSkills = classesInfo.taoist.skills;
  assert(tSkills[0].id === 'heal', '道士技能1: 治愈术');
  assert(tSkills[0].heal === true, '治愈术有治疗标记');
  assert(tSkills[2].id === 'summon', '道士技能3: 召唤神兽');

  // 职业成长率差异
  assert(classesInfo.warrior.hpGrowth > classesInfo.mage.hpGrowth, '战士 HP 成长 > 法师');
  assert(classesInfo.mage.mpGrowth > classesInfo.warrior.mpGrowth, '法师 MP 成长 > 战士');
  assert(classesInfo.warrior.defGrowth > classesInfo.mage.defGrowth, '战士防御成长 > 法师');

  // 测试攻击
  const ws = await new Promise((resolve) => {
    c1.on('world_state', data => resolve(data));
  });
  if (ws.monsters.length > 0) {
    const monster = ws.monsters[0];
    c1.emit('move', { x: monster.x + 2, y: monster.y });
    await new Promise(r => setTimeout(r, 300));
    const atkResult = await new Promise((resolve) => {
      c1.on('attack_result', r => resolve(r));
      c1.emit('attack', monster.id);
    });
    assert(atkResult.damage > 0, '战士攻击造成伤害');
  }

  c1.disconnect(); c2.disconnect(); c3.disconnect();

  console.log(`\n=== 阶段二测试结果: ${passed} 通过, ${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
}

test().catch(err => { console.error('测试出错:', err.message); process.exit(1); });
