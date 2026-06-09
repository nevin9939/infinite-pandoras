#!/bin/bash
# 重启传奇游戏服务器
# ⚠️ 此脚本不会删除任何数据文件

echo "正在停止旧服务器..."
kill $(lsof -ti :3000) 2>/dev/null
sleep 1

echo "正在启动服务器..."
node server/index.js &
echo "服务器已启动: http://localhost:3000"
