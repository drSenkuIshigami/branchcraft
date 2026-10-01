import { execFile } from 'node:child_process';
import os from 'node:os';
import type { WorkloadPlan } from '../src/types';

function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const times = cpu.times;
    idle += times.idle;
    total += times.user + times.nice + times.sys + times.idle + times.irq;
  }
  return { idle, total };
}

function sampleCpuBusy(ms: number): Promise<number> {
  const before = cpuSnapshot();
  return new Promise((resolve) => {
    setTimeout(() => {
      const after = cpuSnapshot();
      const idle = after.idle - before.idle;
      const total = after.total - before.total;
      if (total <= 0) {
        resolve(0);
        return;
      }
      resolve(Math.min(1, Math.max(0, 1 - idle / total)));
    }, ms);
  });
}

function runText(command: string, args: string[], timeout: number): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(command, args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) {
        resolve(null);
        return;
      }
      const text = stdout.trim();
      resolve(text || null);
    });
  });
}

function pickGpuName(names: string[]): string | null {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  const discrete = cleaned.find(
    (name) => !/basic display|remote display|intel\(r\) (?:uhd|hd) graphics/i.test(name)
  );
  return discrete || cleaned[0] || null;
}

async function probeGpu(): Promise<string | null> {
  const nvidia = await runText(
    'nvidia-smi',
    ['--query-gpu=name', '--format=csv,noheader'],
    800
  );
  if (nvidia) {
    return pickGpuName(nvidia.split(/\r?\n/));
  }
  if (process.platform !== 'win32') return null;
  const registry = await runText(
    'reg',
    [
      'query',
      'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}',
      '/s',
      '/v',
      'DriverDesc',
    ],
    2000
  );
  if (!registry) return null;
  const names = registry
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/DriverDesc\s+REG_SZ\s+(.+)$/i);
      return match ? match[1] : '';
    })
    .filter(Boolean);
  return pickGpuName(names);
}

function chooseWorkers(fileCount: number, cores: number, busy: number, freeMb: number): number {
  if (fileCount <= 1) return 1;
  if (freeMb < 512) return 1;
  if (busy >= 0.8) return 1;
  const reserve = cores >= 4 ? 1 : 0;
  const room = Math.max(1, cores - reserve);
  const byLoad = busy >= 0.55 ? Math.min(2, room) : room;
  return Math.max(1, Math.min(fileCount, byLoad, 8));
}

/**
 * Decide how many CPU workers to use for this run from the machine's current load.
 * Text matching is not sent to the GPU: copying file contents there costs more than the search.
 */
export async function planFileWorkload(fileCount: number): Promise<WorkloadPlan> {
  const [busy, gpuName] = await Promise.all([sampleCpuBusy(150), probeGpu()]);
  const logicalCpus = Math.max(1, os.cpus().length);
  const freeMb = Math.round(os.freemem() / (1024 * 1024));
  const workers = chooseWorkers(fileCount, logicalCpus, busy, freeMb);
  const busyPct = Math.round(busy * 100);
  const gpuSentence = gpuName
    ? `GPU ${gpuName} is present and was not used, because matching text in files is faster on the CPU.`
    : 'No GPU was detected. Matching text stays on the CPU.';
  return {
    workers,
    file_count: fileCount,
    logical_cpus: logicalCpus,
    cpu_busy_ratio: busy,
    free_memory_mb: freeMb,
    gpu_name: gpuName,
    gpu_used: false,
    summary: `Using ${workers} worker${workers === 1 ? '' : 's'} on ${logicalCpus} CPU cores (${busyPct}% busy, ${freeMb} MB free). ${gpuSentence}`,
  };
}
