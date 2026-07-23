import { writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';

export async function createTempFile(extension: string, data?: Buffer): Promise<string> {
  const name = randomBytes(8).toString('hex');
  const filePath = join(tmpdir(), `${name}.${extension}`);

  if (data) {
    await writeFile(filePath, data);
  }

  return filePath;
}

export async function removeTempFile(filePath: string): Promise<void> {
  await rm(filePath, { force: true }).catch(() => undefined);
}
