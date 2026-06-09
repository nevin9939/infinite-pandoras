// @ts-check
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const logs = [];
  page.on('console', msg => {
    logs.push(msg.text());
    console.log('  [LOG]', msg.text().substring(0, 120));
  });
  page.on('pageerror', err => {
    console.log('  [ERROR]', err.message);
  });

  console.log('\n=== 1. 打开游戏 ===');
  await page.goto('http://localhost:3000', { timeout: 10000 });
  await page.waitForSelector('#username', { timeout: 5000 });
  console.log('  登录页面已加载');

  console.log('\n=== 2. 登录 ===');
  await page.fill('#username', 'pw_test2');
  await page.click('#login-btn');
  await page.waitForSelector('#game-screen', { state: 'visible', timeout: 5000 });
  await page.waitForFunction(() => window.state && window.state.running, { timeout: 5000 });
  console.log('  登录成功');
  await page.waitForTimeout(1000);

  console.log('\n=== 3. 测试移动 ===');
  await page.keyboard.down('w');
  await page.waitForTimeout(300);
  await page.keyboard.up('w');
  await page.waitForTimeout(200);

  const posAfter = await page.evaluate(() => ({ x: window.state.player.x, y: window.state.player.y }));
  if (posAfter.y < 49) { console.log('  ✅ 移动成功 y=' + posAfter.y.toFixed(1)); }
  else { console.log('  ❌ 移动失败 y=' + posAfter.y.toFixed(1)); }

  console.log('\n=== 4. 移动到怪物附近并击杀 ===');
  // 获取第一个怪物位置
  const monster = await page.evaluate(() => {
    const m = window.state.monsters.find(m => !m.isSummon);
    return m ? { id: m.id, x: m.x, y: m.y } : null;
  });
  console.log('  怪物位置:', JSON.stringify(monster));

  if (monster) {
    // 使用 WASD 移动到怪物附近
    const dx = monster.x - 2 - (await page.evaluate(() => window.state.player.x));
    const dy = monster.y - (await page.evaluate(() => window.state.player.y));

    console.log('  需要移动 dx=' + dx.toFixed(1) + ' dy=' + dy.toFixed(1));

    // 计算需要按多久
    const duration = Math.max(Math.abs(dx), Math.abs(dy)) * 200; // speed=0.3, 50ms interval
    const startTime = Date.now();

    if (dx > 0) await page.keyboard.down('d');
    else if (dx < 0) await page.keyboard.down('a');
    if (dy > 0) await page.keyboard.down('s');
    else if (dy < 0) await page.keyboard.down('w');

    await page.waitForTimeout(duration + 500);

    await page.keyboard.up('d');
    await page.keyboard.up('a');
    await page.keyboard.up('s');
    await page.keyboard.up('w');

    await page.waitForTimeout(500);

    const playerPos = await page.evaluate(() => ({ x: window.state.player.x, y: window.state.player.y }));
    console.log('  移动后玩家位置:', JSON.stringify(playerPos));
    const dist = Math.sqrt((playerPos.x - monster.x) ** 2 + (playerPos.y - monster.y) ** 2);
    console.log('  距离怪物:', dist.toFixed(1));

    if (dist < 6) {
      console.log('  距离足够，开始攻击');
      // 持续攻击直到怪物死亡
      let killed = false;
      let attacks = 0;
      while (!killed && attacks < 50) {
        await page.keyboard.down(' '); // 空格攻击
        await page.keyboard.up(' ');
        // 模拟点击画布中心
        const canvas = await page.locator('#game-canvas');
        const box = await canvas.boundingBox();
        if (box) {
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }
        await page.waitForTimeout(500);
        attacks++;

        const exp = await page.evaluate(() => window.state.player.exp);
        const level = await page.evaluate(() => window.state.player.level);
        const gold = await page.evaluate(() => window.state.player.gold);
        if (exp > 0 || gold > 0) {
          console.log('  ✅ 获得经验=' + exp + ' 金币=' + gold + ' 等级=' + level);
          killed = true;
        }
      }
      if (!killed) {
        console.log('  ⚠️ 未获得经验（可能需要多次攻击）');
        const finalExp = await page.evaluate(() => window.state.player.exp);
        console.log('  最终经验:', finalExp);
      }
    } else {
      console.log('  ❌ 距离太远，无法攻击');
    }
  }

  console.log('\n=== 5. 测试挂机 ===');
  await page.click('#afk-btn');
  await page.waitForTimeout(500);
  const afkActive = await page.evaluate(() => window.state.afkMode);
  console.log('  挂机模式:', afkActive ? '开启' : '关闭');
  if (afkActive) console.log('  ✅ 挂机开启成功');
  else console.log('  ❌ 挂机开启失败');

  await page.waitForTimeout(2000);
  const afkPos = await page.evaluate(() => ({ x: window.state.player.x, y: window.state.player.y }));
  console.log('  挂机后位置:', JSON.stringify(afkPos));

  await page.click('#afk-btn');
  await page.waitForTimeout(500);
  const afkOff = await page.evaluate(() => window.state.afkMode);
  if (!afkOff) console.log('  ✅ 挂机关闭成功');

  console.log('\n=== 6. 测试副本面板 ===');
  await page.click('#dungeon-btn');
  await page.waitForTimeout(500);
  const dungeonVisible = await page.isVisible('#dungeon-panel');
  console.log('  副本面板:', dungeonVisible ? '可见' : '不可见');

  console.log('\n=== 7. 测试装备 ===');
  // 检查背包
  const invEmpty = await page.evaluate(() => !window.state.player.inventory?.length);
  console.log('  背包:', invEmpty ? '空' : '有物品');

  console.log('\n=== 测试完成 ===');
  const moveCount = logs.filter(l => l.includes('[move] keys')).length;
  console.log('  总移动次数:', moveCount);

  await browser.close();
  process.exit(0);
})();
