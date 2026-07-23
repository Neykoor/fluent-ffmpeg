import { spawn } from 'child_process';
import { locateBinary } from './locateBinary';

export interface HealthcheckResult {
  ffmpegAvailable: boolean;
  ffmpegVersion?: string;
  ffprobeAvailable: boolean;
  ffprobeVersion?: string;
}

async function getVersion(binaryName: string, envVar: string): Promise<string | null> {
  const bin = process.env[envVar] || (await locateBinary(binaryName));
  if (!bin) {
    return null;
  }

  return new Promise((resolve) => {
    const proc = spawn(bin, ['-version'], { windowsHide: true });
    let output = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });

    proc.on('error', () => resolve(null));

    proc.on('exit', () => {
      const match = /version\s+(\S+)/.exec(output);
      resolve(match ? match[1] : output.split('\n')[0] || null);
    });
  });
}

export async function checkFfmpegInstalled(): Promise<HealthcheckResult> {
  const [ffmpegVersion, ffprobeVersion] = await Promise.all([
    getVersion('ffmpeg', 'FFMPEG_PATH'),
    getVersion('ffprobe', 'FFPROBE_PATH')
  ]);

  return {
    ffmpegAvailable: !!ffmpegVersion,
    ffmpegVersion: ffmpegVersion ?? undefined,
    ffprobeAvailable: !!ffprobeVersion,
    ffprobeVersion: ffprobeVersion ?? undefined
  };
}
