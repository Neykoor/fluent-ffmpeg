export function buildAtempoChain(factor: number): string {
  const filters: string[] = [];
  let remaining = factor;

  while (remaining < 0.5 || remaining > 2.0) {
    if (remaining > 2.0) {
      filters.push('atempo=2.0');
      remaining /= 2.0;
    } else {
      filters.push('atempo=0.5');
      remaining /= 0.5;
    }
  }

  filters.push(`atempo=${remaining}`);
  return filters.join(',');
}

export function buildSilenceTrimFilter(thresholdDb: number, minDurationSeconds: number): string {
  const clause = `start_periods=1:start_duration=${minDurationSeconds}:start_threshold=${thresholdDb}dB:detection=peak`;
  return `silenceremove=${clause},areverse,silenceremove=${clause},areverse`;
}

export function buildLoudnormFilter(targetLufs: number): string {
  return `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`;
}
