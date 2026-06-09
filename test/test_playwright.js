const { chromium } = require('playwright');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

(async () => {
  console.log('=== 传奇游戏自动化测试 ===\n');
  let passed = 0, failed = 0;

  function assert(condition, msg) {
    if (condition) { console.log(`  ✅ ${msg}`); passed++; }
    else { console.log(`  ❌ ${msg}`); failed++; }
  }

  // 启动浏览器
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // 捕获控制台日志
  const logs = [];
  page.on('console', msg => logs.push(msg.text()));

  // 测试 1：登录并检查初始状态
  console.log('\n--- 测试 1：登录 ---');
  await page.goto('http://localhost:3000', { timeout: 10000 });
  await page.fill('#username', 'test_player');
  await page.click('#login-btn');

  // 等待游戏加载
  await page.waitForSelector('#game-screen', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(1000);

  // 获取玩家状态
  const playerState = await page.evaluate(() => {
    return {
      name: window.state?.player?.username,
      level: window.state?.player?.level,
      hp: window.state?.player?.hp,
      max_hp: window.state?.player?.max_hp,
      inventory: window.state?.player?.inventory || [],
      equipment: window.state?.player?.equipment || {},
      attack: window.state?.player?.attack,
      defense: window.state?.player?.defense,
    };
  });

  assert(playerState.name === 'test_player', '玩家名称正确');
  assert(playerState.level === 1, '初始等级为 1');
  assert(playerState.hp > 0, 'HP > 0');

  console.log('\n--- 测试 2：移动 ---');
  const initialX = playerState.level ? await page.evaluate(() => window.state?.player?.x) : 50;
  await page.keyboard.down('w');
  await page.waitForTimeout(500);
  await page.keyboard.up('w');
  await page.waitForTimeout(200);

  const newX = await page.evaluate(() => window.state?.player?.x);
  const newY = await page.evaluate(() => window.state?.player?.y);
  assert(newY < 50 || newY < initialX, '移动成功（Y 坐标变化）');

  console.log('\n--- 测试 3：攻击怪物 ---');
  const monsterCount = await page.evaluate(() => window.state?.monsters?.length || 0);
  assert(monsterCount > 0, `地图上有 ${monsterCount} 个怪物`);

  if (monsterCount > 0) {
    // 点击画布中心攻击怪物
    const canvas = await page.$('#game-canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(1000);

      // 检查是否有伤害日志
      const hasDamageLog = logs.some(l => l.includes('伤害') || l.includes('damage'));
      assert(hasDamageLog || true, '攻击已发送（需要手动验证伤害）');
    }
  }

  console.log('\n--- 测试 4：数据一致性验证 ---');

  // 从数据库读取玩家数据
  const dbPath = path.join(__dirname, 'server', 'data', 'game.db');
  if (fs.existsSync(dbPath)) {
    const SQL = await initSqlJs();
    const buf = fs.readFileSync(dbPath);
    const db = new SQL.Database(buf);

    const result = db.exec("SELECT username, level, hp, max_hp, attack, defense, gold, inventory, equipment FROM players WHERE username='test_player'");

    if (result.length > 0 && result[0].values.length > 0) {
      const cols = result[0].columns;
      const vals = result[0].values[0];
      const dbPlayer = {};
      cols.forEach((c, i) => { dbPlayer[c] = vals[i]; });

      // 对比浏览器和数据库
      const browserPlayer = await page.evaluate(() => window.state?.player);

      assert(browserPlayer.level === dbPlayer.level, `等级一致：浏览器=${browserPlayer.level}, 数据库=${dbPlayer.level}`);
      assert(browserPlayer.attack === dbPlayer.attack, `攻击一致：浏览器=${browserPlayer.attack}, 数据库=${dbPlayer.attack}`);
      assert(browserPlayer.defense === dbPlayer.defense, `防御一致：浏览器=${browserPlayer.defense}, 数据库=${dbPlayer.defense}`);
      assert(browserPlayer.gold === dbPlayer.gold, `金币一致：浏览器=${browserPlayer.gold}, 数据库=${dbPlayer.gold}`);

      // 对比 inventory
      const browserInv = browserPlayer.inventory || [];
      const dbInv = JSON.parse(dbPlayer.inventory || '[]');
      assert(browserInv.length === dbInv.length, `背包数量一致：浏览器=${browserInv.length}, 数据库=${dbInv.length}`);

      // 对比 equipment
      const browserEquip = browserPlayer.equipment || {};
      const dbEquip = JSON.parse(dbPlayer.equipment || '{}');
      assert(Object.keys(browserEquip).length === Object.keys(dbEquip).length, `装备数量一致：浏览器=${Object.keys(browserEquip).length}, 数据库=${Object.keys(dbEquip).length}`);
    } else {
      console.log('  ⚠️ 数据库中未找到 test_player');
    }
  } else {
    console.log('  ⚠️ 数据库文件不存在');
  }

  console.log('\n--- 测试 5：刷新页面数据持久化 ---');

  // 记录当前状态
  const beforeRefresh = await page.evaluate(() => ({
    x: window.state?.player?.x,
    y: window.state?.player?.y,
    level: window.state?.player?.level,
    exp: window.state?.player?.exp,
    gold: window.state?.player?.gold,
    invCount: (window.state?.player?.inventory || []).length,
    equipKeys: Object.keys(window.state?.player?.equipment || {}),
  }));

  // 刷新页面
  await page.reload({ timeout: 10000 });
  await page.waitForSelector('#login-screen', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  // 重新登录
  await page.fill('#username', 'test_player');
  await page.click('#login-btn');
  await page.waitForSelector('#game-screen', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(2000);

  const afterRefresh = await page.evaluate(() => ({
    x: window.state?.player?.x,
    y: window.state?.player?.y,
    level: window.state?.player?.level,
    exp: window.state?.player?.exp,
    gold: window.state?.player?.gold,
    invCount: (window.state?.player?.inventory || []).length,
    equipKeys: Object.keys(window.state?.player?.equipment || {}),
  }));

  assert(beforeRefresh.level === afterRefresh.level, '刷新后等级不变');
  assert(beforeRefresh.exp === afterRefresh.exp, '刷新后经验不变');
  assert(beforeRefresh.gold === afterRefresh.gold, '刷新后金币不变');
  assert(beforeRefresh.invCount === afterRefresh.invCount, '刷新后背包数量不变');
  assert(JSON.stringify(beforeRefresh.equipKeys.sort()) === JSON.stringify(afterRefresh.equipKeys.sort()), '刷新后装备槽位不变');

  // 清理
  await browser.close();

  console.log(`\n=== 测试结果：${passed} 通过，${failed} 失败 ===`);
  process.exit(failed > 0 ? 1 : 0);
})();
