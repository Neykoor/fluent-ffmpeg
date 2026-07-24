const NEWLINE_REGEXP = /\r\n|\r|\n/;

export function extractError(stderr: string): string {
  const lines = stderr.split(NEWLINE_REGEXP);
  let messages: string[] = [];

  for (const line of lines) {
    if (line.charAt(0) === ' ' || line.charAt(0) === '[') {
      if (messages.length) {
        messages.push(line);
      }
      continue;
    }

    messages = [line];
  }

  return messages.join('\n');
}
