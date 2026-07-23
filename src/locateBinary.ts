import { access, constants } from 'fs/promises';
import { join, delimiter } from 'path';

const isWindows = process.platform === 'win32';

export async function locateBinary(name: string): Promise<string | null> {
  const pathEnv = process.env.PATH || '';
  const pathExt = isWindows ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';') : [''];
  const dirs = pathEnv.split(delimiter).filter(Boolean);

  for (const dir of dirs) {
    for (const ext of pathExt) {
      const candidate = join(dir, name + ext);
      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        continue;
      }
    }
  }

  return null;
}
