import { readFile } from 'fs/promises';
import { FfmpegCommand } from './FfmpegCommand';
import { createTempFile, removeTempFile } from './tempFile';
import { getMediaInfo } from './mediaInfo';

export interface ConvertBufferOptions {
  inputExtension: string;
  outputExtension: string;
  configure: (command: FfmpegCommand) => void;
}

export async function convertBuffer(input: Buffer, options: ConvertBufferOptions): Promise<Buffer> {
  const inputPath = await createTempFile(options.inputExtension, input);
  const outputPath = await createTempFile(options.outputExtension);

  try {
    await new Promise<void>((resolve, reject) => {
      const command = new FfmpegCommand(inputPath);
      command.once('error', reject);
      command.once('end', () => resolve());
      options.configure(command);
      command.save(outputPath);
    });

    return await readFile(outputPath);
  } finally {
    await removeTempFile(inputPath);
    await removeTempFile(outputPath);
  }
}

export interface BufferToWebpOptions {
  animated?: boolean;
  durationSeconds?: number;
  inputExtension?: string;
}

export async function bufferToWebp(input: Buffer, options: BufferToWebpOptions = {}): Promise<Buffer> {
  return convertBuffer(input, {
    inputExtension: options.inputExtension ?? (options.animated ? 'mp4' : 'jpg'),
    outputExtension: 'webp',
    configure: (command) =>
      command.toWebpSticker({
        animated: options.animated,
        durationSeconds: options.durationSeconds
      })
  });
}

export interface BufferToWhatsappAudioOptions {
  inputExtension?: string;
  bitrateKbps?: number;
}

export async function bufferToWhatsappAudio(input: Buffer, options: BufferToWhatsappAudioOptions = {}): Promise<Buffer> {
  return convertBuffer(input, {
    inputExtension: options.inputExtension ?? 'mp3',
    outputExtension: 'ogg',
    configure: (command) => command.toWhatsappAudio(options.bitrateKbps)
  });
}

export interface BufferToWhatsappVideoOptions {
  inputExtension?: string;
  maxSizeBytes?: number;
}

export async function bufferToWhatsappVideo(input: Buffer, options: BufferToWhatsappVideoOptions = {}): Promise<Buffer> {
  const inputExtension = options.inputExtension ?? 'mp4';
  const info = await getMediaInfo(input, inputExtension);
  const maxSizeBytes = options.maxSizeBytes ?? 16 * 1024 * 1024;
  const durationSeconds = info.durationSeconds || 10;

  return convertBuffer(input, {
    inputExtension,
    outputExtension: 'mp4',
    configure: (command) => command.toWhatsappVideo(maxSizeBytes, durationSeconds)
  });
}

export interface BufferToThumbnailOptions {
  inputExtension?: string;
  maxDimension?: number;
}

export async function bufferToThumbnailJpeg(input: Buffer, options: BufferToThumbnailOptions = {}): Promise<Buffer> {
  return convertBuffer(input, {
    inputExtension: options.inputExtension ?? 'jpg',
    outputExtension: 'jpg',
    configure: (command) => command.toThumbnailJpeg(options.maxDimension)
  });
}

export interface BufferToWebpSizedOptions {
  animated?: boolean;
  durationSeconds?: number;
  inputExtension?: string;
  maxBytes?: number;
}

const STICKER_DEGRADE_STEPS = [
  { maxDimension: 320, fps: 15 },
  { maxDimension: 280, fps: 12 },
  { maxDimension: 240, fps: 10 },
  { maxDimension: 200, fps: 8 }
];

export async function bufferToWebpSized(input: Buffer, options: BufferToWebpSizedOptions = {}): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? 500 * 1024;
  let last: Buffer | null = null;

  for (const step of STICKER_DEGRADE_STEPS) {
    const buffer = await convertBuffer(input, {
      inputExtension: options.inputExtension ?? (options.animated ? 'mp4' : 'jpg'),
      outputExtension: 'webp',
      configure: (command) =>
        command.toWebpSticker({
          animated: options.animated,
          durationSeconds: options.durationSeconds,
          maxDimension: step.maxDimension,
          fps: step.fps
        })
    });

    last = buffer;
    if (buffer.length <= maxBytes) {
      return buffer;
    }
  }

  return last as Buffer;
}
