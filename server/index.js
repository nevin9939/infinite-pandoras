const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const { createGameEngine } = require('./game/engine');
const { initDB } = require('./db/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('client', { setHeaders: r => { r.setHeader('Cache-Control','no-cache'); } }));

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ 已创建数据目录: server/data/');
}

let db;

async function start() {
  db = await initDB();
  const engine = createGameEngine(db, io);
  engine.initWorldBosses();

  io.on('connection', (socket) => {
    socket.on('login', ({ username, playerClass }) => {
      if (!username || username.length < 2) return;
      const player = engine.registerPlayer(socket.id, username, playerClass);
      socket.emit('login_success', player);
      socket.emit('classes_info', engine.CLASSES);
      socket.emit('equip_info', { slots: engine.EQUIPMENT_SLOTS, qualityNames: engine.QUALITY_NAMES, qualityColors: engine.QUALITY_COLORS, equipDb: engine.EQUIPMENT_DB, setInfo: engine.EQUIPMENT_SETS });
      socket.emit('zodiac_sets', engine.ZODIAC_SETS);
      socket.emit('wuxing_sets', engine.WUXING_SETS);
      socket.emit('potions_info', engine.POTIONS);
      socket.emit('dungeon_info', engine.DUNGEONS);
      const { SHOP_ITEMS } = require('./game/engine');
      socket.emit('shop_items', { potion: SHOP_ITEMS.potion, material: SHOP_ITEMS.material, weapon: SHOP_ITEMS.weapon, armor: SHOP_ITEMS.armor, jewelry: SHOP_ITEMS.jewelry });
      socket.broadcast.emit('player_joined', { id: player.id, username: player.username, x: player.x, y: player.y, level: player.level, hp: player.hp, max_hp: player.max_hp, class: player.class });
    });

    socket.on('move', data => engine.movePlayer(socket.id, data.x, data.y));
    socket.on('attack', monsterId => {
      const m = engine.getMonsters().find(mon => mon.id === monsterId);
      if (!m) { socket.emit('attack_result', { error: 'monster_not_found' }); return; }
      const r = engine.attackMonster(socket.id, monsterId);
      if(r) socket.emit('attack_result', r);
    });
    socket.on('skill', ({monsterId, skillId}) => {
      const m = engine.getMonsters().find(mon => mon.id === monsterId);
      if (!m) { socket.emit('attack_result', { error: 'monster_not_found' }); return; }
      const r = engine.attackMonster(socket.id, monsterId, skillId);
      if(r) socket.emit('attack_result', r);
    });
    socket.on('equip', idx => {
      const r = engine.doEquip(socket.id, idx);
      if (r) r.error ? socket.emit('equip_error', r) : socket.emit('equip_success', {success: true});
    });
    socket.on('unequip', slot => {
      const r = engine.doUnequip(socket.id, slot);
      if (r) r.error ? socket.emit('equip_error', r) : socket.emit('equip_success', {success: true});
    });
    socket.on('sell', idx => {
      const r = engine.doSell(socket.id, idx);
      if (r) socket.emit('sell_success', r);
    });
    socket.on('recycle_all', () => { const r = engine.recycleAll(socket.id); if(r) socket.emit('recycle_success', r); });

    socket.on('buy_item', itemId => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p) { console.log('[buy] player not found for', socket.id); return; }
      const items = require('./game/engine').SHOP_ITEMS;
      const item = [...items.potion, ...items.weapon, ...items.armor, ...items.jewelry, ...items.material].find(i => i.id === itemId);
      if (!item) { socket.emit('buy_error', {error:'not_found'}); return; }
      if (p.gold < item.price) { socket.emit('buy_error', {error:'not_enough_gold'}); return; }
      p.gold -= item.price;
      if (item.type === 'potion') {
        if (item.effect?.hp) p.hp = Math.min(p.max_hp, p.hp + item.effect.hp);
        if (item.effect?.mp) p.mp = Math.min(p.max_mp, p.mp + item.effect.mp);
        // 药水不进入背包，直接消耗
        engine.savePlayer(p);
        socket.emit('buy_success', item);
        io.to(socket.id).emit('system_msg', `使用了 ${item.name}`);
      } else if (item.type === 'scroll' || item.type === 'material') {
        if (!p.inventory) p.inventory = [];
        p.inventory.push({...item});
        engine.savePlayer(p);
        socket.emit('buy_success', item);
        io.to(socket.id).emit('system_msg', `购买了 ${item.name}`);
      } else {
        // 武器和护甲都进入背包，添加 slot 属性
        if (!p.inventory) p.inventory = [];
        // 从 EQUIPMENT_DB 查找正确的 slot
        const equipDb = require('./game/engine').EQUIPMENT_DB;
        const dbItem = equipDb.find(e => e.id === item.id);
        const slot = dbItem?.slot || {weapon:'weapon',armor:'armor',jewelry:'necklace'}[item.type] || 'necklace';
        const shopItem = {...item, slot, levelReq: dbItem?.levelReq||item.levelReq||1};
        p.inventory.push(shopItem);
        engine.savePlayer(p);
        socket.emit('buy_success', shopItem);
        io.to(socket.id).emit('system_msg', `购买了 ${item.name}`);
      }
    });

    socket.on('teleport', ({map, x, y}) => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p) return;
      // 清除旧地图怪物，生成新地图怪物
      const oldMap = p.map_id;
      engine.clearMapMonsters(oldMap);
      engine.spawnMonstersForMap(map, 20);
      p.x = x; p.y = y; p.map_id = map;
      engine.savePlayer(p);
      socket.emit('teleport_result', {map, x, y});
    });

    socket.on('refresh_map_monsters', (mapId) => {
      engine.clearMapMonsters(mapId);
      engine.spawnMonstersForMap(mapId, 20);
    });

    socket.on('chat', data => socket.broadcast.emit('chat_msg', data));

    // 使用药水
    socket.on('use_potion', ({itemIndex}) => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p || !p.inventory?.[itemIndex]) return;
      const item = p.inventory[itemIndex];
      const potion = require('./game/engine').POTIONS[item.id];
      if (!potion || potion.type !== 'potion') return;
      // 移除药水
      p.inventory.splice(itemIndex, 1);
      // 应用效果
      if (potion.effect.hp) p.hp = Math.min(p.max_hp, p.hp + potion.effect.hp);
      if (potion.effect.mp) p.mp = Math.min(p.max_mp, p.mp + potion.effect.mp);
      engine.savePlayer(p);
      socket.emit('potion_used', { name: potion.name, hp: p.hp, max_hp: p.max_hp, mp: p.mp, max_mp: p.max_mp, inventory: p.inventory });
    });

    // 使用技能
    socket.on('use_skill', ({monsterId, skillId}) => {
      const m = engine.getMonsters().find(mon => mon.id === monsterId);
      if (m && m.mapId && m.mapId.startsWith('endless_')) {
        const r = engine.attackEndlessMonster(socket.id, monsterId, skillId);
        if (r) socket.emit('endless_attack_result', r);
      } else if (!m) {
        // 怪物不存在，发无尽错误让客户端清除选中
        socket.emit('endless_attack_result', { error: 'monster_not_found', skillId });
      } else {
        const r = engine.useSkill(socket.id, monsterId, skillId);
        if (r) socket.emit('skill_result', r);
      }
    });

    // 强化装备
    socket.on('enhance_item', slot => {
      const r = engine.enhanceEquipment(socket.id, slot);
      if (r) {
        if (r.error) socket.emit('enhance_error', r);
        else socket.emit('enhance_result', r);
      }
    });

    // 装备突破
    socket.on('breakthrough_equip', slot => {
      const r = engine.breakthroughEquip(socket.id, slot);
      if (r) {
        if (r.error) socket.emit('breakthrough_equip_error', r);
        else socket.emit('breakthrough_equip_result', r);
      }
    });

    // 分解装备
    socket.on('dismantle_equip', slot => {
      const r = engine.dismantleEquip(socket.id, slot);
      if (r) {
        if (r.error) socket.emit('dismantle_equip_error', r);
        else socket.emit('dismantle_equip_result', r);
      }
    });

    // 镶嵌宝石
    socket.on('socket_gem', ({slot, gemIndex}) => {
      const r = engine.socketGem(socket.id, slot, gemIndex);
      if (r) {
        if (r.error) socket.emit('socket_gem_error', r);
        else socket.emit('socket_gem_result', r);
      }
    });

    // 卸下宝石
    socket.on('remove_gem', ({slot, gemIndex}) => {
      const r = engine.removeGem(socket.id, slot, gemIndex);
      if (r) {
        if (r.error) socket.emit('remove_gem_error', r);
        else socket.emit('remove_gem_result', r);
      }
    });

    // 购买宝石
    socket.on('buy_gem', gemId => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p) return;
      const gemDb = require('./game/engine').GEM_DB;
      const gem = gemDb.find(g => g.id === gemId);
      if (!gem) { socket.emit('buy_error', {error:'not_found'}); return; }
      if (p.gold < gem.price) { socket.emit('buy_error', {error:'not_enough_gold'}); return; }
      p.gold -= gem.price;
      if (!p.inventory) p.inventory = [];
      p.inventory.push({ ...gem });
      engine.savePlayer(p);
      socket.emit('buy_success', gem);
      io.to(socket.id).emit('system_msg', `购买了 ${gem.name}`);
    });

    socket.on('enter_dungeon', dungeonId => { const r = engine.enterDungeon(socket.id, dungeonId); if(r) socket.emit('dungeon_entered', r); });
    socket.on('exit_dungeon', () => { const r = engine.exitDungeon(socket.id); if(r) socket.emit('dungeon_exited', r); });
    socket.on('dungeon_attack', ({instanceId, monsterId, skillId}) => {
      if (monsterId === 'refresh') { const ins = engine.getDungeonState(instanceId); if(ins) socket.emit('dungeon_state', {instanceId, monsters: ins.monsters}); return; }
      const r = engine.attackDungeonMonster(socket.id, instanceId, monsterId, skillId); if(r) socket.emit('dungeon_attack_result', r);
    });

    // 无尽副本
    socket.on('enter_endless', () => { const r = engine.enterEndlessDungeon(socket.id); if(r) r.error ? socket.emit('endless_error', r) : socket.emit('endless_entered', r); });
    socket.on('exit_endless', () => { const r = engine.exitEndlessDungeon(socket.id); if(r) socket.emit('endless_exited', r); });
    socket.on('endless_attack', monsterId => {
      const r = engine.attackEndlessMonster(socket.id, monsterId); if(r) socket.emit('endless_attack_result', r);
    });

    socket.on('create_guild', name => { const r = engine.createGuild(socket.id, name); if(r) r.error ? socket.emit('guild_error', r) : socket.emit('guild_created', r); });
    socket.on('join_guild', guildId => { const r = engine.joinGuild(socket.id, guildId); if(r) r.error ? socket.emit('guild_error', r) : socket.emit('guild_joined', r); });
    socket.on('leave_guild', () => { const r = engine.leaveGuild(socket.id); if(r) socket.emit('guild_left', r); });
    socket.on('guild_list', () => socket.emit('guild_list', engine.getGuildList()));

    socket.on('worldboss_list', () => socket.emit('worldboss_list', engine.getWorldBossState()));

    socket.on('appraise_item', ({scrollQuality, itemIndex}) => {
      const r = engine.appraiseEquipment(socket.id, scrollQuality, itemIndex);
      if (r) { if(r.error) socket.emit('appraise_error', r); else socket.emit('appraise_result', r); }
    });

    socket.on('bless_oil', itemSlot => {
      const r = engine.blessOil(socket.id, itemSlot);
      if (r) { if(r.error) socket.emit('bless_error', r); else socket.emit('bless_result', r); }
    });

    socket.on('mine_ore', spotIdx => {
      const r = engine.mineOre(socket.id, spotIdx);
      if (r) { if(r.error) socket.emit('mine_error', r); else socket.emit('mine_result', r); }
    });

    socket.on('stall_list', ({itemIndex, price}) => {
      const r = engine.listStallItem(socket.id, itemIndex, price);
      if (r) { if(r.error) socket.emit('stall_error', r); else socket.emit('stall_listed', r); }
    });

    socket.on('stall_list_all', () => socket.emit('stall_list', engine.getAllStalls()));

    socket.on('stall_buy', ({stallOwnerId, itemIdx}) => {
      const r = engine.buyStallItem(socket.id, stallOwnerId, itemIdx);
      if (r) { if(r.error) socket.emit('stall_error', r); else socket.emit('stall_bought', r); }
    });

    socket.on('get_reputation', () => {
      const r = engine.getReputation(socket.id);
      if (r) socket.emit('reputation_result', r);
    });

    socket.on('get_leaderboard', type => {
      const r = engine.getLeaderboard(type);
      if (r) socket.emit('leaderboard_result', { type, list: r });
    });

    socket.on('synth_equip', itemIndices => {
      const r = engine.synthEquipment(socket.id, itemIndices);
      if (r) { if(r.error) socket.emit('synth_error', r); else socket.emit('synth_result', r); }
    });

    socket.on('get_daily', () => {
      const r = engine.getDailyActivities(socket.id);
      if (r) socket.emit('daily_list', r);
    });

    socket.on('complete_daily', activityId => {
      const r = engine.completeDaily(socket.id, activityId);
      if (r) { if(r.error) socket.emit('daily_error', r); else socket.emit('daily_completed', r); }
    });

    socket.on('get_achievements', () => {
      const r = engine.getAchievements(socket.id);
      if (r) socket.emit('achievement_list', r);
    });

    socket.on('propose', targetName => {
      const r = engine.proposeMarriage(socket.id, targetName);
      if (r) { if(r.error) socket.emit('marriage_error', r); else socket.emit('marriage_success', r); }
    });

    socket.on('marriage_info', () => {
      const r = engine.getMarriageInfo(socket.id);
      if (r) socket.emit('marriage_info', r);
    });

    socket.on('divorce', () => {
      const r = engine.divorce(socket.id);
      if (r) { if(r.error) socket.emit('marriage_error', r); else socket.emit('divorce_success', r); }
    });

    socket.on('teleport_partner', () => {
      const r = engine.teleportToPartner(socket.id);
      if (r) { if(r.error) socket.emit('marriage_error', r); else socket.emit('teleport_result', r); }
    });

    socket.on('start_escort', () => {
      const r = engine.startEscort(socket.id);
      if (r) { if(r.error) socket.emit('escort_error', r); else socket.emit('escort_started', r); }
    });

    socket.on('complete_escort', () => {
      const r = engine.completeEscort(socket.id);
      if (r) { if(r.error) socket.emit('escort_error', r); else socket.emit('escort_completed', r); }
    });

    socket.on('open_meridian', meridianId => {
      const r = engine.openMeridian(socket.id, meridianId);
      if (r) { if(r.error) socket.emit('meridian_error', r); else socket.emit('meridian_result', r); }
    });

    socket.on('get_meridians', () => {
      const r = engine.getMeridianState(socket.id);
      if (r) socket.emit('meridian_state', r);
    });

    socket.on('buy_mount', mountId => {
      const r = engine.buyMount(socket.id, mountId);
      if (r) { if(r.error) socket.emit('mount_error', r); else socket.emit('mount_result', r); }
    });

    socket.on('buy_wings', wingId => {
      const r = engine.buyWings(socket.id, wingId);
      if (r) { if(r.error) socket.emit('wings_error', r); else socket.emit('wings_result', r); }
    });

    socket.on('become_apprentice', masterName => {
      const r = engine.becomeApprentice(socket.id, masterName);
      if (r) { if(r.error) socket.emit('apprentice_error', r); else socket.emit('apprentice_success', r); }
    });

    socket.on('master_info', () => {
      const r = engine.getMasterInfo(socket.id);
      if (r) socket.emit('master_info', r);
    });

    socket.on('apprentices', () => {
      const r = engine.getApprentices(socket.id);
      if (r) socket.emit('apprentices_list', r);
    });

    socket.on('unlock_hero', heroClass => {
      const r = engine.unlockHero(socket.id, heroClass);
      if (r) { if(r.error) socket.emit('hero_error', r); else socket.emit('hero_unlocked', r); }
    });

    socket.on('get_hero', () => {
      const r = engine.getHero(socket.id);
      if (r) socket.emit('hero_info', r);
    });

    socket.on('hero_attack', monsterId => {
      const r = engine.heroAttack(socket.id, monsterId);
      if (r) { if(r.error) socket.emit('hero_error', r); else socket.emit('hero_attack_result', r); }
    });

    socket.on('start_siege', guildId => {
      const r = engine.startSabakSiege(guildId);
      if (r) { if(r.error) socket.emit('siege_error', r); else socket.emit('siege_started', r); }
    });

    socket.on('attack_gate', gate => {
      const r = engine.attackSabakGate(socket.id, gate);
      if (r) { if(r.error) socket.emit('siege_error', r); else socket.emit('gate_attacked', r); }
    });

    socket.on('complete_siege', guildId => {
      const r = engine.completeSabakSiege(guildId);
      if (r) { if(r.error) socket.emit('siege_error', r); else socket.emit('siege_completed', r); }
    });

    socket.on('get_siege_state', () => {
      const r = engine.getSabakState();
      socket.emit('siege_state', r);
    });

    socket.on('breakthrough', () => {
      const r = engine.breakthrough(socket.id);
      if (r) { if(r.error) socket.emit('breakthrough_error', r); else socket.emit('breakthrough_result', r); }
    });

    socket.on('pvp_attack', targetId => {
      const r = engine.attackPlayer(socket.id, targetId);
      if (r) { if(r.error) socket.emit('pvp_error', r); else { socket.emit('pvp_result', r); const t = io.sockets.sockets.get(targetId); if(t) t.emit('pvp_attacked', {attacker: socket.id, damage: r.damage}); } }
    });
    socket.on('pk_status', () => { const s = engine.getPkStatus(socket.id); if(s) socket.emit('pk_status', s); });

    // 同步玩家数据（用于强化等操作）
    socket.on('sync_player', data => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p) return;
      if (data.gold !== undefined) p.gold = data.gold;
      if (data.level !== undefined) { p.level = data.level; p.exp = data.exp || p.exp; }
      if (data.cultivationRealm !== undefined) p.cultivationRealm = data.cultivationRealm;
      if (data.cultivationStage !== undefined) p.cultivationStage = data.cultivationStage;
      if (data.equipment) p.equipment = data.equipment;
      engine.savePlayer(p);
    });

    // 仓库系统
    socket.on('warehouse_deposit', ({itemIndex}) => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p || !p.inventory?.[itemIndex]) return;
      if (!p.storage) p.storage = [];
      const item = p.inventory.splice(itemIndex, 1)[0];
      p.storage.push(item);
      engine.savePlayer(p);
      socket.emit('warehouse_updated', { inventory: p.inventory, storage: p.storage });
    });

    socket.on('warehouse_withdraw', ({itemIndex}) => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p || !p.storage?.[itemIndex]) return;
      if (!p.inventory) p.inventory = [];
      const item = p.storage.splice(itemIndex, 1)[0];
      p.inventory.push(item);
      engine.savePlayer(p);
      socket.emit('warehouse_updated', { inventory: p.inventory, storage: p.storage });
    });

    socket.on('warehouse_list', () => {
      const p = engine.getPlayerBySocket(socket.id);
      if (!p) return;
      socket.emit('warehouse_list', { storage: p.storage || [], maxSlots: 40 });
    });

    socket.on('disconnect', () => {
      engine.removePlayer(socket.id);
      console.log('断开:', socket.id);
    });
  });

  let lastUpdate = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = (now - lastUpdate) / 1000; lastUpdate = now;
    engine.updateMonsters(dt);
    const escort = engine.updateEscort(dt);
    if (escort) io.emit('escort_update', escort);
    io.emit('world_state', { players: engine.getPlayers(), monsters: engine.getMonsters() });
  }, 100);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`无限世界: http://localhost:${PORT}`));
}

start();
