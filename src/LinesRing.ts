const NEWLINE_REGEXP = /\r\n|\r|\n/;

export class LinesRing {
  private lines: string[] = [];
  private current: string | null = null;
  private closed = false;
  private max: number;
  private callbacks: Array<(line: string) => void> = [];

  constructor(maxLines: number) {
    this.max = maxLines - 1;
  }

  callback(cb: (line: string) => void): void {
    for (const line of this.lines) {
      cb(line);
    }
    this.callbacks.push(cb);
  }

  private emit(line: string): void {
    for (const cb of this.callbacks) {
      cb(line);
    }
  }

  append(chunk: Buffer | string): void {
    if (this.closed) return;

    const str = chunk instanceof Buffer ? chunk.toString() : chunk;
    if (!str || str.length === 0) return;

    const parts = str.split(NEWLINE_REGEXP);

    if (parts.length === 1) {
      this.current = this.current !== null ? this.current + parts[0] : parts[0];
      return;
    }

    if (this.current !== null) {
      this.current = this.current + parts.shift();
      this.emit(this.current);
      this.lines.push(this.current);
    }

    this.current = parts.pop() ?? null;

    for (const line of parts) {
      this.emit(line);
      this.lines.push(line);
    }

    if (this.max > -1 && this.lines.length > this.max) {
      this.lines.splice(0, this.lines.length - this.max);
    }
  }

  get(): string {
    if (this.current !== null) {
      return [...this.lines, this.current].join('\n');
    }
    return this.lines.join('\n');
  }

  close(): void {
    if (this.closed) return;

    if (this.current !== null) {
      this.emit(this.current);
      this.lines.push(this.current);

      if (this.max > -1 && this.lines.length > this.max) {
        this.lines.shift();
      }

      this.current = null;
    }

    this.closed = true;
  }
}
