export interface ProgressInfo {
  frames: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  percent?: number;
}

export function timemarkToSeconds(timemark: string): number {
  if (timemark.indexOf(':') === -1 && timemark.indexOf('.') >= 0) {
    return Number(timemark);
  }

  const parts = timemark.split(':');
  let secs = Number(parts.pop());

  if (parts.length) {
    secs += Number(parts.pop()) * 60;
  }

  if (parts.length) {
    secs += Number(parts.pop()) * 3600;
  }

  return secs;
}

function parseProgressLine(line: string): Record<string, string> | null {
  const cleaned = line.replace(/=\s+/g, '=').trim();
  const parts = cleaned.split(' ');
  const progress: Record<string, string> = {};

  for (const part of parts) {
    const [key, value] = part.split('=', 2);
    if (typeof value === 'undefined') {
      return null;
    }
    progress[key] = value;
  }

  return progress;
}

export function extractProgress(line: string, totalDurationSeconds?: number): ProgressInfo | null {
  const raw = parseProgressLine(line);
  if (!raw || !raw.time) return null;

  const info: ProgressInfo = {
    frames: parseInt(raw.frame, 10),
    currentFps: parseInt(raw.fps, 10),
    currentKbps: raw.bitrate ? parseFloat(raw.bitrate.replace('kbits/s', '')) : 0,
    targetSize: parseInt(raw.size || raw.Lsize, 10),
    timemark: raw.time
  };

  if (typeof totalDurationSeconds === 'number' && !isNaN(totalDurationSeconds)) {
    info.percent = (timemarkToSeconds(info.timemark) / totalDurationSeconds) * 100;
  }

  return info;
}
