const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const results = [];
  const log = (pass, msg) => { results.push({ pass, msg }); console.log(`  ${pass ? '✅' : '❌'} ${msg}`); };

  async function setup(level, gold) {
    await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded', timeout: 10000 });
    await page.fill('#username', 'testplayer');
    await page.click('#login-btn');
    await page.waitForTimeout(2000);
    const ok = await page.evaluate(() => {
      const el = document.getElementById('game-screen');
      return el && el.style.display !== 'none';
    });
    if (!ok) return false;
    await page.evaluate(({ level, gold }) => {
      window.socket.emit('sync_player', { level, exp: 99999, gold });
    }, { level, gold });
    await page.waitForTimeout(500);
    return true;
  }

  try {
    // ===== 测试1: 商店购买材料 =====
    console.log('\n--- 测试1: 商店购买材料 ---');
    if (await setup(1, 50000)) {
      const r = await page.evaluate(async () => {
        return new Promise(resolve => {
          let resolved = false;
          window.socket.once('buy_success', r => { if(!resolved) { resolved = true; resolve({ ok: true, name: r.name, type: r.type }); } });
          window.socket.once('buy_error', r => { if(!resolved) { resolved = true; resolve({ ok: false, error: r.error }); } });
          window.socket.emit('buy_item', 'appraise_normal');
          setTimeout(() => { if(!resolved) resolve({ ok: false, error: 'timeout' }); }, 3000);
        });
      });
      log(r.ok, `购买鉴定符: ${r.ok ? `${r.name} (type=${r.type})` : r.error}`);
    } else log(false, '登录失败');

    // ===== 测试2: 鉴定符使用 =====
    console.log('\n--- 测试2: 鉴定符使用 ---');
    const r2 = await page.evaluate(async () => {
      // 买一把新的木剑（未鉴定）
      await new Promise(resolve => {
        window.socket.once('buy_success', () => resolve());
        window.socket.emit('buy_item', 'wood_sword');
        setTimeout(resolve, 1500);
      });
      await new Promise(r => setTimeout(r, 300));
      const inv = window.state.player?.inventory || [];
      const swordIdx = inv.findIndex(i => i.id === 'wood_sword' && !i.appraised);
      if (swordIdx < 0) return { ok: false, error: 'no_sword' };
      return new Promise(resolve => {
        let resolved = false;
        window.socket.once('appraise_result', r => { if(!resolved) { resolved = true; resolve({ ok: true, msg: JSON.stringify(r.attrs) }); } });
        window.socket.once('appraise_error', r => { if(!resolved) { resolved = true; resolve({ ok: false, error: r.error }); } });
        window.socket.emit('appraise_item', { scrollQuality: 1, itemIndex: swordIdx });
        setTimeout(() => { if(!resolved) resolve({ ok: false, error: 'timeout' }); }, 5000);
      });
    });
    log(r2.ok, `鉴定符使用: ${r2.ok ? `获得属性: ${r2.msg}` : r2.error}`);

    // ===== 测试3: 购买祝福油 =====
    console.log('\n--- 测试3: 购买祝福油 ---');
    const r3 = await page.evaluate(async () => {
      return new Promise(resolve => {
        let resolved = false;
        window.socket.once('buy_success', r => { if(!resolved) { resolved = true; resolve({ ok: true, name: r.name, type: r.type }); } });
        window.socket.once('buy_error', r => { if(!resolved) { resolved = true; resolve({ ok: false, error: r.error }); } });
        window.socket.emit('buy_item', 'bless_oil');
        setTimeout(() => { if(!resolved) resolve({ ok: false, error: 'timeout' }); }, 3000);
      });
    });
    log(r3.ok, `购买祝福油: ${r3.ok ? `${r3.name} (type=${r3.type})` : r3.error}`);

    // ===== 测试4: 祝福油使用 =====
    console.log('\n--- 测试4: 祝福油使用 ---');
    const r4 = await page.evaluate(async () => {
      // 找一把已装备的武器，或者先装备一把
      const inv = window.state.player?.inventory || [];
      const swordIdx = inv.findIndex(i => i.id === 'wood_sword');
      if (swordIdx < 0) return { ok: false, error: 'no_sword_in_inventory' };
      // 先装备
      await new Promise(resolve => {
        window.socket.once('equip_success', () => resolve());
        window.socket.once('equip_error', () => resolve());
        window.socket.emit('equip', swordIdx);
        setTimeout(resolve, 2000);
      });
      await new Promise(r => setTimeout(r, 300));
      return new Promise(resolve => {
        let resolved = false;
        window.socket.once('bless_result', r => { if(!resolved) { resolved = true; resolve({ ok: true, success: r.success, lucky: r.lucky }); } });
        window.socket.once('bless_error', r => { if(!resolved) { resolved = true; resolve({ ok: false, error: r.error }); } });
        window.socket.emit('bless_oil', 'weapon');
        setTimeout(() => { if(!resolved) resolve({ ok: false, error: 'timeout' }); }, 5000);
      });
    });
    if (r4.ok) {
      log(true, `祝福油使用: 成功=${r4.success}, 幸运=${r4.lucky || 0}`);
    } else {
      log(false, `祝福油使用: ${r4.error}`);
    }

    // ===== 测试5: 验证装备背包显示 =====
    console.log('\n--- 测试5: 验证鉴定后装备 ---');
    const r5 = await page.evaluate(async () => {
      const inv = window.state.player?.inventory || [];
      const appraisedSwords = inv.filter(i => i.id === 'wood_sword' && i.appraised);
      const blessedWeapon = window.state.player?.equipment?.weapon;
      return {
        appraisedCount: appraisedSwords.length,
        weaponLucky: blessedWeapon?.lucky || 0,
        weaponAppraised: blessedWeapon?.appraised || false,
        weaponName: blessedWeapon?.name || 'none'
      };
    });
    log(true, `鉴定装备数: ${r5.appraisedCount}, 武器[${r5.weaponName}] 幸运=${r5.weaponLucky} 已鉴定=${r5.weaponAppraised}`);

    console.log('\n========== 最终结果 ==========');
    const passCount = results.filter(r => r.pass).length;
    const failCount = results.filter(r => !r.pass).length;
    console.log(`通过: ${passCount}/${passCount + failCount}`);
    results.forEach(r => console.log(`  ${r.pass ? '✅' : '❌'} ${r.msg}`));
    process.exit(failCount > 0 ? 1 : 0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
