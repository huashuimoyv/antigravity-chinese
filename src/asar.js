'use strict';

// A narrow ASAR editor: retain the complete original payload and append one file.
// No archive extraction, path writes, executable loading or unpacked-file repacking.
const { createHash } = require('node:crypto');
const sha256 = data => createHash('sha256').update(data).digest('hex');

function parse(buffer) {
  if (buffer.length < 16 || buffer.readUInt32LE(0) !== 4) throw new Error('无效 ASAR 头');
  const headerSize = buffer.readUInt32LE(4);
  const jsonSize = buffer.readUInt32LE(12);
  if (headerSize < 8 || headerSize % 4 || headerSize + 8 > buffer.length ||
      buffer.readUInt32LE(8) !== headerSize - 4 ||
      headerSize !== 8 + Math.ceil(jsonSize / 4) * 4) throw new Error('ASAR 头长度不一致');
  const header = JSON.parse(buffer.subarray(16, 16 + jsonSize).toString('utf8'));
  if (!header.files || typeof header.files !== 'object') throw new Error('ASAR 缺少文件目录');
  return { buffer, header, start: 8 + headerSize };
}

function entry(archive, name) {
  let node = archive.header;
  for (const part of name.split('/')) {
    if (!node.files || !Object.hasOwn(node.files, part)) throw new Error(`ASAR 缺少 ${name}`);
    node = node.files[part];
  }
  if (node.files || node.link || node.unpacked) throw new Error(`不支持的 ASAR 文件类型: ${name}`);
  if (typeof node.offset !== 'string' || !/^\d+$/.test(node.offset) ||
      !Number.isSafeInteger(Number(node.offset)) || !Number.isSafeInteger(node.size) || node.size < 0 ||
      Number(node.offset) + node.size > archive.buffer.length - archive.start) {
    throw new Error(`ASAR 文件越界: ${name}`);
  }
  return node;
}

function integrity(data, blockSize = 4194304) {
  if (!Number.isSafeInteger(blockSize) || blockSize < 1) throw new Error('无效完整性块大小');
  const blocks = [];
  for (let i = 0; i < data.length; i += blockSize) blocks.push(sha256(data.subarray(i, i + blockSize)));
  return { algorithm: 'SHA256', hash: sha256(data), blockSize, blocks };
}

function read(archive, name) {
  const node = entry(archive, name);
  const start = archive.start + Number(node.offset);
  const data = archive.buffer.subarray(start, start + node.size);
  if (node.integrity) {
    const expected = integrity(data, node.integrity.blockSize);
    if (node.integrity.algorithm !== 'SHA256' || node.integrity.hash !== expected.hash ||
        JSON.stringify(node.integrity.blocks) !== JSON.stringify(expected.blocks)) {
      throw new Error(`ASAR 完整性校验失败: ${name}`);
    }
  }
  return data;
}

function encodeHeader(header) {
  const json = Buffer.from(JSON.stringify(header));
  const size = 8 + Math.ceil(json.length / 4) * 4;
  const output = Buffer.alloc(8 + size);
  output.writeUInt32LE(4, 0);
  output.writeUInt32LE(size, 4);
  output.writeUInt32LE(size - 4, 8);
  output.writeUInt32LE(json.length, 12);
  json.copy(output, 16);
  return output;
}

function replace(buffer, name, data) {
  const archive = parse(buffer);
  read(archive, name);
  const node = entry(archive, name);
  node.offset = String(buffer.length - archive.start);
  node.size = data.length;
  node.integrity = integrity(data, node.integrity?.blockSize);
  return Buffer.concat([encodeHeader(archive.header), buffer.subarray(archive.start), data]);
}

module.exports = { parse, read, replace, sha256 };
