import { spawn } from 'child_process';
import { locateBinary } from './locateBinary';

export interface FfprobeStream {
  index: number;
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  tags?: Record<string, string>;
  [key: string]: unknown;
}

export interface FfprobeFormat {
  duration?: string;
  format_name?: string;
  size?: string;
  [key: string]: unknown;
}

export interface FfprobeData {
  format: FfprobeFormat;
  streams: FfprobeStream[];
}

let cachedFfprobePath: string | null = null;

export function setFfprobePath(path: string): void {
  cachedFfprobePath = path;
}

async function resolveFfprobePath(): Promise<string> {
  if (cachedFfprobePath) {
    return cachedFfprobePath;
  }

  if (process.env.FFPROBE_PATH) {
    cachedFfprobePath = process.env.FFPROBE_PATH;
    return cachedFfprobePath;
  }

  const found = await locateBinary('ffprobe');
  if (!found) {
    throw new Error('Cannot find ffprobe');
  }

  cachedFfprobePath = found;
  return found;
}

export async function ffprobe(input: string): Promise<FfprobeData> {
  const bin = await resolveFfprobePath();

  return new Promise((resolve, reject) => {
    const args = ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', input];
    const proc = spawn(bin, args, { windowsHide: true });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('error', reject);

    proc.on('exit', (code: number | null) => {
      if (code) {
        reject(new Error(`ffprobe exited with code ${code}: ${stderr.trim()}`));
        return;
      }

      try {
        resolve(JSON.parse(stdout) as FfprobeData);
      } catch (err) {
        reject(err);
      }
    });
  });
}
