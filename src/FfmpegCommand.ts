import { EventEmitter } from 'events';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { Readable, Writable, PassThrough } from 'stream';
import { ArgumentList } from './ArgumentList';
import { LinesRing } from './LinesRing';
import { locateBinary } from './locateBinary';
import { extractError } from './extractError';
import { extractProgress } from './progress';
import { ffprobe, FfprobeData } from './ffprobe';
import { buildWebpStickerFilter, formatDuration } from './webpSticker';
import { buildAtempoChain, buildSilenceTrimFilter, buildLoudnormFilter } from './audioFx';

export interface FfmpegCommandOptions {
  niceness?: number;
  stdoutLines?: number;
  timeout?: number;
  cwd?: string;
  retries?: number;
  retryDelayMs?: number;
  logLevel?: string;
  hideBanner?: boolean;
}

interface InputEntry {
  source: string | Readable;
  isStream: boolean;
  options: ArgumentList;
}

interface OutputEntry {
  target?: string | Writable;
  isStream: boolean;
  options: ArgumentList;
  videoFilters: string[];
  audioFilters: string[];
}

export interface WebpStickerOptions {
  animated?: boolean;
  durationSeconds?: number;
  maxDimension?: number;
  fps?: number;
}

export interface GifOptions {
  fps?: number;
  maxDimension?: number;
}

export interface WatermarkOptions {
  x?: string;
  y?: string;
}

export interface SilenceTrimOptions {
  thresholdDb?: number;
  minDurationSeconds?: number;
}

let cachedFfmpegPath: string | null = null;

function createEmptyOutput(): OutputEntry {
  return { isStream: false, options: new ArgumentList(), videoFilters: [], audioFilters: [] };
}

export class FfmpegCommand extends EventEmitter {
  private inputs: InputEntry[] = [];
  private outputs: OutputEntry[] = [];
  private globalOptions = new ArgumentList();
  private currentInput: InputEntry | null = null;
  private currentOutput: OutputEntry;
  private options: Required<FfmpegCommandOptions>;
  private process: ChildProcessWithoutNullStreams | null = null;
  private probedDurationSeconds: number | undefined;

  constructor(input?: string | Readable, options: FfmpegCommandOptions = {}) {
    super();

    this.options = {
      niceness: options.niceness ?? 0,
      stdoutLines: options.stdoutLines ?? 100,
      timeout: options.timeout ?? 0,
      cwd: options.cwd ?? process.cwd(),
      retries: options.retries ?? 2,
      retryDelayMs: options.retryDelayMs ?? 300,
      logLevel: options.logLevel ?? 'error',
      hideBanner: options.hideBanner ?? true
    };

    if (this.options.hideBanner) {
      this.globalOptions.add('-hide_banner');
    }

    if (this.options.logLevel) {
      this.globalOptions.add('-loglevel', this.options.logLevel);
    }

    this.currentOutput = createEmptyOutput();
    this.outputs.push(this.currentOutput);

    if (input) {
      this.input(input);
    }
  }

  input(source: string | Readable): this {
    const isStream = typeof source !== 'string';

    if (isStream) {
      (source as Readable).pause();
    }

    this.currentInput = { source, isStream, options: new ArgumentList() };
    this.inputs.push(this.currentInput);
    return this;
  }

  inputOptions(options: string | string[], ...rest: string[]): this {
    if (!this.currentInput) {
      throw new Error('No input specified');
    }

    const list = Array.isArray(options) ? options : rest.length ? [options, ...rest] : [options];
    this.currentInput.options.add(...list);
    return this;
  }

  addGlobalOptions(options: string | string[], ...rest: string[]): this {
    const list = Array.isArray(options) ? options : rest.length ? [options, ...rest] : [options];
    this.globalOptions.add(...list);
    return this;
  }

  output(target?: string | Writable): this {
    if (!target) {
      return this;
    }

    const isStream = typeof target !== 'string';

    if (!this.currentOutput.target) {
      this.currentOutput.target = target;
      this.currentOutput.isStream = isStream;
    } else {
      this.currentOutput = { target, isStream, options: new ArgumentList(), videoFilters: [], audioFilters: [] };
      this.outputs.push(this.currentOutput);
    }

    return this;
  }

  addOutputOptions(options: string | string[], ...rest: string[]): this {
    const list = Array.isArray(options) ? options : rest.length ? [options, ...rest] : [options];
    this.currentOutput.options.add(...list);
    return this;
  }

  outputOptions(options: string | string[], ...rest: string[]): this {
    return this.addOutputOptions(options, ...rest);
  }

  private pushVideoFilter(filter: string): this {
    this.currentOutput.videoFilters.push(filter);
    return this;
  }

  private pushAudioFilter(filter: string): this {
    this.currentOutput.audioFilters.push(filter);
    return this;
  }

  toFormat(format: string): this {
    this.currentOutput.options.add('-f', format);
    return this;
  }

  format(format: string): this {
    return this.toFormat(format);
  }

  audioCodec(codec: string): this {
    this.currentOutput.options.add('-acodec', codec);
    return this;
  }

  videoCodec(codec: string): this {
    this.currentOutput.options.add('-vcodec', codec);
    return this;
  }

  size(spec: string): this {
    this.currentOutput.options.add('-s', spec);
    return this;
  }

  audioBitrate(bitrate: string | number): this {
    this.currentOutput.options.add('-b:a', String(bitrate));
    return this;
  }

  videoBitrate(bitrate: string | number): this {
    this.currentOutput.options.add('-b:v', String(bitrate));
    return this;
  }

  fps(fps: number): this {
    this.currentOutput.options.add('-r', String(fps));
    return this;
  }

  duration(seconds: number | string): this {
    this.currentOutput.options.add('-t', String(seconds));
    return this;
  }

  seek(time: number | string): this {
    this.currentOutput.options.add('-ss', String(time));
    return this;
  }

  noAudio(): this {
    this.currentOutput.options.add('-an');
    return this;
  }

  loopOutput(times = 0): this {
    this.currentOutput.options.add('-loop', String(times));
    return this;
  }

  setSpeed(factor: number): this {
    this.pushVideoFilter(`setpts=PTS/${factor}`);
    this.pushAudioFilter(buildAtempoChain(factor));
    return this;
  }

  reverse(): this {
    this.pushVideoFilter('reverse');
    this.pushAudioFilter('areverse');
    return this;
  }

  trimSilence(options: SilenceTrimOptions = {}): this {
    this.pushAudioFilter(buildSilenceTrimFilter(options.thresholdDb ?? -35, options.minDurationSeconds ?? 0.3));
    return this;
  }

  normalizeAudio(targetLufs = -16): this {
    this.pushAudioFilter(buildLoudnormFilter(targetLufs));
    return this;
  }

  watermark(overlayPath: string, options: WatermarkOptions = {}): this {
    this.input(overlayPath);
    const x = options.x ?? 'W-w-10';
    const y = options.y ?? 'H-h-10';
    this.currentOutput.options.add('-filter_complex', `[0:v][1:v]overlay=${x}:${y}`);
    return this;
  }

  async autoRotate(): Promise<this> {
    const input = this.inputs[0];

    if (!input || input.isStream) {
      return this;
    }

    const data = await ffprobe(input.source as string);
    const videoStream = data.streams.find((stream) => stream.codec_type === 'video');
    const rotate = videoStream?.tags?.rotate ? Number(videoStream.tags.rotate) : 0;

    if (rotate === 90) {
      this.pushVideoFilter('transpose=1');
    } else if (rotate === 270) {
      this.pushVideoFilter('transpose=2');
    } else if (rotate === 180) {
      this.pushVideoFilter('hflip,vflip');
    }

    return this;
  }

  toWebpSticker(options: WebpStickerOptions = {}): this {
    const filter = buildWebpStickerFilter(options.maxDimension ?? 320, options.fps ?? 15);
    this.addOutputOptions(['-vcodec', 'libwebp']);
    this.pushVideoFilter(filter);

    if (options.animated) {
      const seconds = options.durationSeconds ?? 5;
      this.addOutputOptions([
        '-loop', '0',
        '-ss', '00:00:00',
        '-t', formatDuration(seconds),
        '-preset', 'default',
        '-an',
        '-vsync', '0'
      ]);
    }

    return this.toFormat('webp');
  }

  toGif(options: GifOptions = {}): this {
    const fps = options.fps ?? 12;
    const maxDimension = options.maxDimension ?? 480;
    const filter = `fps=${fps},scale=${maxDimension}:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`;
    this.pushVideoFilter(filter);
    return this.toFormat('gif');
  }

  toWhatsappAudio(bitrateKbps = 32): this {
    this.addOutputOptions([
      '-vn',
      '-c:a', 'libopus',
      '-ar', '48000',
      '-ac', '1',
      '-b:a', `${bitrateKbps}k`,
      '-application', 'voip'
    ]);

    return this.toFormat('ogg');
  }

  toWhatsappVideo(maxSizeBytes: number, durationSeconds: number): this {
    const audioKbps = 128;
    const totalKbps = (maxSizeBytes * 8) / 1000 / durationSeconds * 0.92;
    const videoKbps = Math.max(Math.floor(totalKbps - audioKbps), 150);

    this.addOutputOptions([
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-b:v', `${videoKbps}k`,
      '-maxrate', `${videoKbps}k`,
      '-bufsize', `${videoKbps * 2}k`,
      '-c:a', 'aac',
      '-b:a', `${audioKbps}k`,
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart'
    ]);

    return this.toFormat('mp4');
  }

  toThumbnailJpeg(maxDimension = 200): this {
    this.pushVideoFilter(`scale='min(${maxDimension},iw)':-1`);
    this.addOutputOptions(['-vframes', '1', '-q:v', '4']);
    return this.toFormat('mjpeg');
  }

  toFrameAtJpeg(timestampSeconds: number, maxDimension = 200): this {
    if (this.currentInput) {
      this.currentInput.options.add('-ss', String(timestampSeconds));
    }

    return this.toThumbnailJpeg(maxDimension);
  }

  setFfmpegPath(path: string): this {
    cachedFfmpegPath = path;
    return this;
  }

  async ffprobeInput(): Promise<FfprobeData> {
    const input = this.inputs[0];

    if (!input || input.isStream) {
      throw new Error('No file input to probe');
    }

    const data = await ffprobe(input.source as string);
    this.probedDurationSeconds = data.format.duration ? Number(data.format.duration) : undefined;
    return data;
  }

  toBuffer(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = new PassThrough();

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('error', reject);

      this.output(stream);
      this.once('error', (err: Error) => reject(err));
      this.once('end', () => resolve(Buffer.concat(chunks)));
      this.run();
    });
  }

  save(output: string): this {
    this.output(output);
    return this.run();
  }

  saveToFile(output: string): this {
    return this.save(output);
  }

  run(): this {
    const outputPresent = this.outputs.some((output) => !!output.target);
    if (!outputPresent) {
      throw new Error('No output specified');
    }

    this.attemptRun(0);
    return this;
  }

  exec(): this {
    return this.run();
  }

  execute(): this {
    return this.run();
  }

  kill(signal?: NodeJS.Signals): this {
    if (this.process) {
      this.process.kill(signal ?? 'SIGKILL');
    }
    return this;
  }

  private attemptRun(attempt: number): void {
    const args = this.buildArguments();

    this.resolveFfmpegPath()
      .then((bin) => this.spawnProcess(bin, args, attempt))
      .catch((err: Error) => this.emit('error', err));
  }

  private buildArguments(): string[] {
    const fileOutput = this.outputs.some((output) => typeof output.target === 'string');

    let args: string[] = [];

    for (const input of this.inputs) {
      const source = typeof input.source === 'string' ? input.source : 'pipe:0';
      args = args.concat(input.options.get(), ['-i', source]);
    }

    args = args.concat(this.globalOptions.get());

    if (fileOutput) {
      args.push('-y');
    }

    for (const output of this.outputs) {
      args = args.concat(output.options.get());

      if (output.videoFilters.length) {
        args.push('-vf', output.videoFilters.join(','));
      }

      if (output.audioFilters.length) {
        args.push('-af', output.audioFilters.join(','));
      }

      if (typeof output.target === 'string') {
        args.push(output.target);
      } else if (output.target) {
        args.push('pipe:1');
      }
    }

    return args;
  }

  private async resolveFfmpegPath(): Promise<string> {
    if (cachedFfmpegPath) {
      return cachedFfmpegPath;
    }

    if (process.env.FFMPEG_PATH) {
      cachedFfmpegPath = process.env.FFMPEG_PATH;
      return cachedFfmpegPath;
    }

    const found = await locateBinary('ffmpeg');
    if (!found) {
      throw new Error('Cannot find ffmpeg');
    }

    cachedFfmpegPath = found;
    return found;
  }

  private spawnProcess(bin: string, args: string[], attempt: number): void {
    let command = bin;
    let spawnArgs = args;

    if (this.options.niceness !== 0 && process.platform !== 'win32') {
      spawnArgs = ['-n', String(this.options.niceness), bin, ...args];
      command = 'nice';
    }

    const stdoutRing = new LinesRing(this.options.stdoutLines);
    const stderrRing = new LinesRing(this.options.stdoutLines);

    const proc = spawn(command, spawnArgs, { cwd: this.options.cwd, windowsHide: true });
    this.process = proc;

    this.emit('start', 'ffmpeg ' + args.join(' '));

    let ended = false;
    let started = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (err?: Error): void => {
      if (ended) return;
      ended = true;

      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      this.process = null;

      if (err) {
        this.emit('error', err, stdoutRing.get(), stderrRing.get());
      } else {
        this.emit('end', stdoutRing.get(), stderrRing.get());
      }
    };

    if (this.options.timeout) {
      timeoutHandle = setTimeout(() => {
        finish(new Error(`process ran into a timeout (${this.options.timeout}s)`));
        proc.kill();
      }, this.options.timeout * 1000);
    }

    const inputStream = this.inputs.find((input) => input.isStream);
    if (inputStream) {
      const source = inputStream.source as Readable;

      source.on('error', (err: Error) => {
        finish(new Error('Input stream error: ' + err.message));
        proc.kill();
      });

      source.resume();
      source.pipe(proc.stdin);
      proc.stdin.on('error', () => undefined);
    }

    const outputStream = this.outputs.find((output) => output.isStream && output.target);
    if (outputStream) {
      const target = outputStream.target as Writable;
      proc.stdout.pipe(target);

      target.on('error', (err: Error) => {
        finish(new Error('Output stream error: ' + err.message));
        proc.kill('SIGKILL');
      });
    } else {
      proc.stdout.on('data', (data: Buffer) => stdoutRing.append(data));
    }

    proc.stderr.on('data', (data: Buffer) => {
      stderrRing.append(data);
      if (this.listenerCount('stderr')) {
        this.emit('stderr', data.toString());
      }
    });

    if (this.listenerCount('progress')) {
      stderrRing.callback((line: string) => {
        const progress = extractProgress(line, this.probedDurationSeconds);
        if (progress) {
          this.emit('progress', progress);
        }
      });
    }

    proc.on('error', (err: NodeJS.ErrnoException) => {
      if (!started && err.code === 'ENOENT' && attempt < this.options.retries) {
        ended = true;
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        cachedFfmpegPath = null;
        this.process = null;
        setTimeout(() => this.attemptRun(attempt + 1), this.options.retryDelayMs * (attempt + 1));
        return;
      }

      finish(err);
    });

    proc.on('spawn', () => {
      started = true;
    });

    proc.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
      if (signal) {
        finish(new Error(`ffmpeg was killed with signal ${signal}`));
      } else if (code) {
        finish(new Error(`ffmpeg exited with code ${code}: ${extractError(stderrRing.get())}`));
      } else {
        finish();
      }
    });
  }
}
