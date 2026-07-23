import { ffprobe } from './ffprobe';
import { createTempFile, removeTempFile } from './tempFile';
import { detectExtension } from './fileSignature';

export interface MediaInfo {
  durationSeconds: number;
  width?: number;
  height?: number;
  hasAudio: boolean;
  hasVideo: boolean;
  formatName?: string;
}

export async function getMediaInfo(input: Buffer, extension?: string): Promise<MediaInfo> {
  const resolvedExtension = extension ?? detectExtension(input, 'bin');
  const path = await createTempFile(resolvedExtension, input);

  try {
    const data = await ffprobe(path);
    const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
    const audioStream = data.streams.find((stream) => stream.codec_type === 'audio');

    return {
      durationSeconds: data.format.duration ? Number(data.format.duration) : 0,
      width: videoStream?.width,
      height: videoStream?.height,
      hasAudio: !!audioStream,
      hasVideo: !!videoStream,
      formatName: data.format.format_name
    };
  } finally {
    await removeTempFile(path);
  }
}
