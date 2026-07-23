import { Readable } from 'stream';
import { FfmpegCommand, FfmpegCommandOptions } from './FfmpegCommand';

function ffmpeg(input?: string | Readable, options?: FfmpegCommandOptions): FfmpegCommand {
  return new FfmpegCommand(input, options);
}

export { FfmpegCommand, FfmpegCommandOptions };
export {
  WebpStickerOptions,
  GifOptions,
  WatermarkOptions,
  SilenceTrimOptions
} from './FfmpegCommand';
export { ffprobe, setFfprobePath, FfprobeData, FfprobeFormat, FfprobeStream } from './ffprobe';
export { ProgressInfo } from './progress';
export { getMediaInfo, MediaInfo } from './mediaInfo';
export { detectExtension } from './fileSignature';
export { createTempFile, removeTempFile } from './tempFile';
export { checkFfmpegInstalled, HealthcheckResult } from './healthcheck';
export { concatBuffers, ConcatBuffersOptions } from './concat';
export {
  convertBuffer,
  ConvertBufferOptions,
  bufferToWebp,
  BufferToWebpOptions,
  bufferToWebpSized,
  BufferToWebpSizedOptions,
  bufferToWhatsappAudio,
  BufferToWhatsappAudioOptions,
  bufferToWhatsappVideo,
  BufferToWhatsappVideoOptions,
  bufferToThumbnailJpeg,
  BufferToThumbnailOptions
} from './convert';
export default ffmpeg;
