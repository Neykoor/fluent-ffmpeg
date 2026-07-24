import { Readable } from 'stream';
import { FfmpegCommand, FfmpegCommandOptions, setFfmpegPath } from './FfmpegCommand';
import { ffprobe, setFfprobePath, FfprobeData, FfprobeFormat, FfprobeStream } from './ffprobe';
import { ProgressInfo } from './progress';
import { getMediaInfo, MediaInfo } from './mediaInfo';
import { detectExtension } from './fileSignature';
import { createTempFile, removeTempFile } from './tempFile';
import { checkFfmpegInstalled, HealthcheckResult } from './healthcheck';
import { concatBuffers, ConcatBuffersOptions } from './concat';
import {
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

function ffmpeg(input?: string | Readable, options?: FfmpegCommandOptions): FfmpegCommand {
  return new FfmpegCommand(input, options);
}

ffmpeg.FfmpegCommand = FfmpegCommand;
ffmpeg.setFfmpegPath = setFfmpegPath;
ffmpeg.ffprobe = ffprobe;
ffmpeg.setFfprobePath = setFfprobePath;
ffmpeg.getMediaInfo = getMediaInfo;
ffmpeg.detectExtension = detectExtension;
ffmpeg.createTempFile = createTempFile;
ffmpeg.removeTempFile = removeTempFile;
ffmpeg.checkFfmpegInstalled = checkFfmpegInstalled;
ffmpeg.concatBuffers = concatBuffers;
ffmpeg.convertBuffer = convertBuffer;
ffmpeg.bufferToWebp = bufferToWebp;
ffmpeg.bufferToWebpSized = bufferToWebpSized;
ffmpeg.bufferToWhatsappAudio = bufferToWhatsappAudio;
ffmpeg.bufferToWhatsappVideo = bufferToWhatsappVideo;
ffmpeg.bufferToThumbnailJpeg = bufferToThumbnailJpeg;

export = ffmpeg;

declare namespace ffmpeg {
  export {
    FfmpegCommand,
    FfmpegCommandOptions,
    FfprobeData,
    FfprobeFormat,
    FfprobeStream,
    ProgressInfo,
    MediaInfo,
    HealthcheckResult,
    ConcatBuffersOptions,
    ConvertBufferOptions,
    BufferToWebpOptions,
    BufferToWebpSizedOptions,
    BufferToWhatsappAudioOptions,
    BufferToWhatsappVideoOptions,
    BufferToThumbnailOptions
  };
}
