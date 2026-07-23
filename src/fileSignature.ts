interface Signature {
  extension: string;
  match: (buffer: Buffer) => boolean;
}

const SIGNATURES: Signature[] = [
  { extension: 'jpg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { extension: 'png', match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { extension: 'gif', match: (b) => b.slice(0, 3).toString('ascii') === 'GIF' },
  {
    extension: 'webp',
    match: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP'
  },
  {
    extension: 'wav',
    match: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WAVE'
  },
  {
    extension: 'mov',
    match: (b) => b.slice(4, 8).toString('ascii') === 'ftyp' && b.slice(8, 10).toString('ascii') === 'qt'
  },
  { extension: 'mp4', match: (b) => b.slice(4, 8).toString('ascii') === 'ftyp' },
  { extension: 'webm', match: (b) => b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { extension: 'ogg', match: (b) => b.slice(0, 4).toString('ascii') === 'OggS' },
  {
    extension: 'mp3',
    match: (b) => (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
  }
];

export function detectExtension(buffer: Buffer, fallback = 'bin'): string {
  for (const signature of SIGNATURES) {
    if (buffer.length >= 12 && signature.match(buffer)) {
      return signature.extension;
    }
  }
  return fallback;
}
