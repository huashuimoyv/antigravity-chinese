#!/usr/bin/env node
'use strict';

const patcher = require('./src/patcher');
const args = process.argv.slice(2);
const help = `Antigravity 本地汉化工具 0.2.4（Windows / Node.js 22.12+）

  node cli.js check                 检查客户端版本、补丁状态和进程
  node cli.js status                只读查看状态及备份校验
  node cli.js install               备份并安装或更新，需先手动退出客户端
  node cli.js restore               校验备份后恢复安装前资源包

以上命令均可附加 --path "安装目录或 app.asar 路径"。
仅支持审核过的 2.12.2 preload。运行无需 npm install，也不访问网络。
`;
try {
  const command = args.shift() || 'help';
  if (command === 'help' || command === '--help') {
    console.log(help);
  } else {
    if (!['check', 'status', 'install', 'restore'].includes(command)) throw new Error('未知命令；使用 --help 查看用法');
    let custom;
    if (args.length) {
      if (args.length !== 2 || args[0] !== '--path' || !args[1]) throw new Error('参数格式错误；使用 --help 查看用法');
      custom = args[1];
    }
    const target = patcher.locate(custom);
    let result;
    if (command === 'status' || command === 'check') {
      result = patcher.status(target);
      if (command === 'check') {
        patcher.assertStopped();
        if (!result.supported && !result.patched) throw new Error(result.state);
      }
    } else result = patcher.change(target, command);
    console.log(JSON.stringify({ target, ...result }, null, 2));
  }
} catch (error) {
  console.error(`操作停止：${error.message}`);
  process.exitCode = 1;
}
