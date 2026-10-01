const fs = require('node:fs');
const path = require('node:path');
const koffi = require('koffi');

const SOURCE = `
bool is_word(uchar c) {
  return (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '_';
}
uchar fold(uchar c, uint caseSensitive) {
  if (!caseSensitive && c >= 'A' && c <= 'Z') return c + 32;
  return c;
}
__kernel void scan(
  __global const uchar* text,
  __global const uint* starts,
  __global const uint* lengths,
  __global const uchar* needle,
  uint needleLen,
  uint caseSensitive,
  uint wholeWord,
  __global uint* hits
) {
  uint file = get_global_id(0);
  uint start = starts[file];
  uint len = lengths[file];
  hits[file] = 0;
  if (needleLen == 0 || len < needleLen) return;
  for (uint i = 0; i + needleLen <= len; i++) {
    if (wholeWord && i > 0 && is_word(text[start + i - 1])) continue;
    bool ok = true;
    for (uint j = 0; j < needleLen; j++) {
      if (fold(text[start + i + j], caseSensitive) != fold(needle[j], caseSensitive)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (wholeWord && i + needleLen < len && is_word(text[start + i + needleLen])) continue;
    hits[file] = 1;
    return;
  }
}
`;

let session = null;
let sessionError = null;

function bind() {
  const lib = koffi.load(process.platform === 'win32' ? 'OpenCL.dll' : 'libOpenCL.so.1');
  return {
    clGetPlatformIDs: lib.func('int32 clGetPlatformIDs(uint32, _Out_ void **, _Out_ uint32 *)'),
    clGetDeviceIDs: lib.func('int32 clGetDeviceIDs(void *, uint64, uint32, _Out_ void **, _Out_ uint32 *)'),
    clGetDeviceInfo: lib.func('int32 clGetDeviceInfo(void *, uint32, uintptr, _Out_ void *, _Out_ uintptr *)'),
    clCreateContext: lib.func('void *clCreateContext(void *, uint32, void **, void *, void *, _Out_ int32 *)'),
    clCreateCommandQueue: lib.func('void *clCreateCommandQueue(void *, void *, uint64, _Out_ int32 *)'),
    clCreateProgramWithSource: lib.func(
      'void *clCreateProgramWithSource(void *, uint32, const char **, uintptr *, _Out_ int32 *)'
    ),
    clBuildProgram: lib.func('int32 clBuildProgram(void *, uint32, void **, const char *, void *, void *)'),
    clGetProgramBuildInfo: lib.func(
      'int32 clGetProgramBuildInfo(void *, void *, uint32, uintptr, _Out_ void *, _Out_ uintptr *)'
    ),
    clCreateKernel: lib.func('void *clCreateKernel(void *, const char *, _Out_ int32 *)'),
    clCreateBuffer: lib.func('void *clCreateBuffer(void *, uint64, uintptr, void *, _Out_ int32 *)'),
    clSetKernelArg: lib.func('int32 clSetKernelArg(void *, uint32, uintptr, void *)'),
    clEnqueueNDRangeKernel: lib.func(
      'int32 clEnqueueNDRangeKernel(void *, void *, uint32, uintptr *, uintptr *, uintptr *, uint32, void *, void *)'
    ),
    clEnqueueReadBuffer: lib.func(
      'int32 clEnqueueReadBuffer(void *, void *, uint32, uintptr, uintptr, _Out_ void *, uint32, void *, void *)'
    ),
    clFinish: lib.func('int32 clFinish(void *)'),
    clReleaseMemObject: lib.func('int32 clReleaseMemObject(void *)'),
  };
}

function openSession() {
  if (session) return session;
  if (sessionError) throw new Error(sessionError);
  try {
    const api = bind();
    const platforms = [null];
    const platformCount = [0];
    let code = api.clGetPlatformIDs(1, platforms, platformCount);
    if (code !== 0 || !platforms[0]) throw new Error(`OpenCL platform failed (${code})`);
    const devices = [null];
    const deviceCount = [0];
    code = api.clGetDeviceIDs(platforms[0], 4, 1, devices, deviceCount);
    if (code !== 0 || !devices[0]) throw new Error(`OpenCL GPU device failed (${code})`);
    const nameBuf = Buffer.alloc(256);
    const nameSize = [0];
    api.clGetDeviceInfo(devices[0], 0x102b, nameBuf.length, nameBuf, nameSize);
    const deviceName = nameBuf.toString('utf8', 0, Math.max(0, nameSize[0] - 1)).trim() || 'GPU';
    const err = [0];
    const context = api.clCreateContext(null, 1, devices, null, null, err);
    if (err[0] !== 0 || !context) throw new Error(`OpenCL context failed (${err[0]})`);
    const queue = api.clCreateCommandQueue(context, devices[0], 0, err);
    if (err[0] !== 0 || !queue) throw new Error(`OpenCL queue failed (${err[0]})`);
    const src = [SOURCE];
    const lengths = [BigInt(Buffer.byteLength(SOURCE))];
    const program = api.clCreateProgramWithSource(context, 1, src, lengths, err);
    if (err[0] !== 0 || !program) throw new Error(`OpenCL program failed (${err[0]})`);
    code = api.clBuildProgram(program, 1, devices, null, null, null);
    if (code !== 0) {
      const log = Buffer.alloc(4096);
      const size = [0];
      api.clGetProgramBuildInfo(program, devices[0], 0x1183, log.length, log, size);
      throw new Error(log.toString('utf8').trim() || `OpenCL build failed (${code})`);
    }
    const kernel = api.clCreateKernel(program, 'scan', err);
    if (err[0] !== 0 || !kernel) throw new Error(`OpenCL kernel failed (${err[0]})`);
    session = { api, context, queue, kernel, deviceName, ptrSize: koffi.sizeof('void *') };
    return session;
  } catch (err) {
    sessionError = err instanceof Error ? err.message : String(err);
    throw new Error(sessionError);
  }
}

function setMem(api, kernel, index, mem, ptrSize) {
  const code = api.clSetKernelArg(kernel, index, ptrSize, koffi.as([mem], 'void **'));
  if (code !== 0) throw new Error(`OpenCL argument ${index} failed (${code})`);
}

function setU32(api, kernel, index, value) {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(value >>> 0);
  const code = api.clSetKernelArg(kernel, index, 4, koffi.as(buf, 'uint32 *'));
  if (code !== 0) throw new Error(`OpenCL argument ${index} failed (${code})`);
}

function scanBuffers(buffers, needle, options) {
  const text = Buffer.isBuffer(needle) ? needle : Buffer.from(needle, 'utf8');
  if (text.length === 0 || buffers.length === 0) {
    return { used: false, deviceName: null, hits: [], reason: 'Nothing to scan on the GPU.' };
  }
  let gpu;
  try {
    gpu = openSession();
  } catch (err) {
    return {
      used: false,
      deviceName: null,
      hits: [],
      reason: err instanceof Error ? err.message : String(err),
    };
  }
  const hits = new Array(buffers.length).fill(false);
  const limit = 32 * 1024 * 1024;
  let offset = 0;
  while (offset < buffers.length) {
    const starts = [];
    const lengths = [];
    const chunks = [];
    let bytes = 0;
    while (offset < buffers.length && chunks.length < 4096) {
      const buf = buffers[offset];
      if (bytes + buf.length > limit && chunks.length > 0) break;
      starts.push(bytes);
      lengths.push(buf.length);
      chunks.push(buf);
      bytes += buf.length;
      offset += 1;
      if (bytes > limit) break;
    }
    if (bytes === 0) {
      const base = offset - chunks.length;
      for (let i = 0; i < chunks.length; i += 1) hits[base + i] = false;
      continue;
    }
    const textBuf = Buffer.concat(chunks);
    const startBuf = Buffer.alloc(starts.length * 4);
    const lenBuf = Buffer.alloc(lengths.length * 4);
    starts.forEach((value, index) => startBuf.writeUInt32LE(value, index * 4));
    lengths.forEach((value, index) => lenBuf.writeUInt32LE(value, index * 4));
    const hitBuf = Buffer.alloc(chunks.length * 4);
    const flags = 4n | 32n;
    const err = [0];
    const textMem = gpu.api.clCreateBuffer(gpu.context, flags, BigInt(textBuf.length), textBuf, err);
    const startMem = gpu.api.clCreateBuffer(gpu.context, flags, BigInt(startBuf.length), startBuf, err);
    const lenMem = gpu.api.clCreateBuffer(gpu.context, flags, BigInt(lenBuf.length), lenBuf, err);
    const needleMem = gpu.api.clCreateBuffer(gpu.context, flags, BigInt(text.length), text, err);
    const hitMem = gpu.api.clCreateBuffer(gpu.context, 2n | 32n, BigInt(hitBuf.length), hitBuf, err);
    try {
      if (!textMem || !startMem || !lenMem || !needleMem || !hitMem) {
        throw new Error('OpenCL buffer allocation failed');
      }
      setMem(gpu.api, gpu.kernel, 0, textMem, gpu.ptrSize);
      setMem(gpu.api, gpu.kernel, 1, startMem, gpu.ptrSize);
      setMem(gpu.api, gpu.kernel, 2, lenMem, gpu.ptrSize);
      setMem(gpu.api, gpu.kernel, 3, needleMem, gpu.ptrSize);
      setU32(gpu.api, gpu.kernel, 4, text.length);
      setU32(gpu.api, gpu.kernel, 5, options.caseSensitive ? 1 : 0);
      setU32(gpu.api, gpu.kernel, 6, options.wholeWord ? 1 : 0);
      setMem(gpu.api, gpu.kernel, 7, hitMem, gpu.ptrSize);
      const global = Buffer.alloc(8);
      global.writeBigUInt64LE(BigInt(chunks.length));
      const launch = gpu.api.clEnqueueNDRangeKernel(gpu.queue, gpu.kernel, 1, null, global, null, 0, null, null);
      if (launch !== 0) throw new Error(`OpenCL launch failed (${launch})`);
      const out = Buffer.alloc(hitBuf.length);
      const read = gpu.api.clEnqueueReadBuffer(gpu.queue, hitMem, 1, 0, out.length, out, 0, null, null);
      if (read !== 0) throw new Error(`OpenCL read failed (${read})`);
      const done = gpu.api.clFinish(gpu.queue);
      if (done !== 0) throw new Error(`OpenCL finish failed (${done})`);
      const base = offset - chunks.length;
      for (let i = 0; i < chunks.length; i += 1) {
        hits[base + i] = out.readUInt32LE(i * 4) === 1;
      }
    } finally {
      for (const mem of [textMem, startMem, lenMem, needleMem, hitMem]) {
        if (mem) gpu.api.clReleaseMemObject(mem);
      }
    }
  }
  return { used: true, deviceName: gpu.deviceName, hits, reason: '' };
}

function inside(root, full) {
  const rootPath = path.resolve(root);
  const fullPath = path.resolve(full);
  const rootCmp = process.platform === 'win32' ? rootPath.toLowerCase() : rootPath;
  const fullCmp = process.platform === 'win32' ? fullPath.toLowerCase() : fullPath;
  return fullCmp === rootCmp || fullCmp.startsWith(rootCmp + path.sep);
}

function readCandidates(rootPath, filePaths) {
  const readable = [];
  const force = [];
  for (const relPath of filePaths) {
    const fullPath = path.resolve(rootPath, relPath);
    if (!inside(rootPath, fullPath) || !fs.existsSync(fullPath)) continue;
    let stat;
    try {
      stat = fs.statSync(fullPath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) {
      force.push(relPath);
      continue;
    }
    try {
      readable.push({ relPath, data: fs.readFileSync(fullPath) });
    } catch {
      force.push(relPath);
    }
  }
  return { readable, force };
}

function filterPaths(rootPath, filePaths, needles, options) {
  const { readable, force } = readCandidates(rootPath, filePaths);
  if (readable.length === 0) {
    return {
      used: true,
      deviceName: null,
      paths: force,
      reason: '',
    };
  }
  const matched = new Array(readable.length).fill(false);
  let deviceName = null;
  for (const needle of needles) {
    if (!needle) continue;
    const scan = scanBuffers(
      readable.map((file) => file.data),
      needle,
      options
    );
    if (!scan.used) {
      return { used: false, deviceName: null, paths: filePaths, reason: scan.reason };
    }
    deviceName = scan.deviceName;
    scan.hits.forEach((hit, index) => {
      if (hit) matched[index] = true;
    });
  }
  const paths = readable.filter((_, index) => matched[index]).map((file) => file.relPath);
  return { used: true, deviceName, paths: [...force, ...paths], reason: '' };
}

module.exports = { filterPaths };
