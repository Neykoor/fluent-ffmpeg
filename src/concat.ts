import { readFile } from 'fs/promises';
import { FfmpegCommand } from './FfmpegCommand';
import { createTempFile, removeTempFile } from './tempFile';

export interface ConcatBuffersOptions {
  extension: string;
  outputExtension?: string;
}

export async function concatBuffers(inputs: Buffer[], options: ConcatBuffersOptions): Promise<Buffer> {
  const outputExtension = options.outputExtension ?? options.extension;
  const inputPaths: string[] = [];

  for (const buffer of inputs) {
    inputPaths.push(await createTempFile(options.extension, buffer));
  }

  const listContent = inputPaths.map((path) => `file '${path.replace(/'/g, "'\\''")}'`).join('\n');
  const listPath = await createTempFile('txt', Buffer.from(listContent, 'utf8'));
  const outputPath = await createTempFile(outputExtension);

  try {
    await new Promise<void>((resolve, reject) => {
      const command = new FfmpegCommand(listPath);
      command.inputOptions(['-f', 'concat', '-safe', '0']);
      command.addOutputOptions(['-c', 'copy']);
      command.once('error', reject);
      command.once('end', () => resolve());
      command.save(outputPath);
    });

    return await readFile(outputPath);
  } finally {
    await removeTempFile(listPath);
    await removeTempFile(outputPath);
    await Promise.all(inputPaths.map((path) => removeTempFile(path)));
  }
}
