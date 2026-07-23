export function buildWebpStickerFilter(maxDimension = 320, fps = 15): string {
  return `scale='min(${maxDimension},iw)':min'(${maxDimension},ih)':force_original_aspect_ratio=decrease,fps=${fps}, pad=${maxDimension}:${maxDimension}:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse`;
}

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
