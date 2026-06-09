function registerSocketHandlers(io, engine) {
  let lastUpdate = Date.now();

  io.on('connection', (socket) => {
    console.log('玩家连接:', socket.id);

    socket.on('login', ({ username, playerClass }) => {
      if (!username || username.length < 2) return;
      const player = engine.registerPlayer(socket.id, username, playerClass);
      socket.emit('login_success', player);
      socket.emit('classes_info', engine.CLASSES);
      socket.emit('equip_info', {
        slots: engine.EQUIPMENT_SLOTS,
        qualityNames: engine.QUALITY_NAMES,
        qualityColors: engine.QUALITY_COLORS,
        equipDb: engine.EQUIPMENT_DB,
      });
      socket.emit('dungeon_info', engine.DUNGEONS);
      socket.broadcast.emit('player_joined', {
        id: player.id, username: player.username,
        x: player.x, y: player.y, level: player.level,
        hp: player.hp, max_hp: player.max_hp, class: player.class,
      });
    });

    socket.on('move', (data) => { engine.movePlayer(socket.id, data.x, data.y); });

    socket.on('attack', (monsterId) => {
      const result = engine.attackMonster(socket.id, monsterId);
      if (result) socket.emit('attack_result', result);
    });

    socket.on('skill', ({ monsterId, skillId }) => {
      const result = engine.attackMonster(socket.id, monsterId, skillId);
      if (result) socket.emit('attack_result', result);
    });

    socket.on('equip', (itemIndex) => {
      const result = engine.doEquip(socket.id, itemIndex);
      if (result) {
        if (result.error) socket.emit('equip_error', result.error);
        else socket.emit('equip_success', result);
      }
    });

    socket.on('unequip', (slot) => {
      const result = engine.doUnequip(socket.id, slot);
      if (result) socket.emit('unequip_success', result);
    });

    socket.on('sell', (itemIndex) => {
      const result = engine.doSell(socket.id, itemIndex);
      if (result) socket.emit('sell_success', result);
    });

    // 副本
    socket.on('enter_dungeon', (dungeonId) => {
      const result = engine.enterDungeon(socket.id, dungeonId);
      if (result) socket.emit('dungeon_entered', result);
    });

    socket.on('dungeon_attack', ({ instanceId, monsterId, skillId }) => {
      if (monsterId === 'refresh') {
        const instance = engine.getDungeonState(instanceId);
        if (instance) socket.emit('dungeon_state', { instanceId, monsters: instance.monsters });
        return;
      }
      const result = engine.attackDungeonMonster(socket.id, instanceId, monsterId, skillId);
      if (result) socket.emit('dungeon_attack_result', result);
    });

    socket.on('exit_dungeon', () => {
      const result = engine.exitDungeon(socket.id);
      if (result) socket.emit('dungeon_exited', result);
    });

    // 公会
    socket.on('create_guild', (name) => {
      const result = engine.createGuild(socket.id, name);
      if (result) {
        if (result.error) socket.emit('guild_error', result);
        else socket.emit('guild_created', result);
      }
    });

    socket.on('join_guild', (guildId) => {
      const result = engine.joinGuild(socket.id, guildId);
      if (result) {
        if (result.error) socket.emit('guild_error', result);
        else socket.emit('guild_joined', result);
      }
    });

    socket.on('leave_guild', () => {
      const result = engine.leaveGuild(socket.id);
      if (result) socket.emit('guild_left', result);
    });

    socket.on('guild_list', () => {
      socket.emit('guild_list', engine.getGuildList());
    });

    // PK
    socket.on('pvp_attack', (targetSocketId) => {
      const result = engine.attackPlayer(socket.id, targetSocketId);
      if (result) {
        if (result.error) socket.emit('pvp_error', result);
        else {
          socket.emit('pvp_result', result);
          const target = io.sockets.sockets.get(targetSocketId);
          if (target) target.emit('pvp_attacked', { attacker: socket.id, damage: result.damage });
        }
      }
    });

    socket.on('pk_status', () => {
      const status = engine.getPkStatus(socket.id);
      if (status) socket.emit('pk_status', status);
    });

    socket.on('disconnect', () => { console.log('玩家断开:', socket.id); });
  });

  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastUpdate) / 1000;
    lastUpdate = now;
    const event = engine.updateMonsters(dt);
    if (event?.monsterAttack) {
      const s = io.sockets.sockets.get(event.socketId);
      if (s) s.emit('player_damaged', { damage: event.damage, monsterId: event.monsterId });
    }
    if (event?.playerDied) {
      const s = io.sockets.sockets.get(event.socketId);
      if (s) s.emit('player_death');
    }
    io.emit('world_state', {
      players: engine.getPlayers(),
      monsters: engine.getMonsters(),
    });
  }, 100);
}

module.exports = { registerSocketHandlers };
