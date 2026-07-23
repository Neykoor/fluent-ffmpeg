const NEWLINE_REGEXP = /\r\n|\r|\n/;

export function extractError(stderr: string): string {
  return stderr
    .split(NEWLINE_REGEXP)
    .reduce<string[]>((messages, message) => {
      if (message.charAt(0) === ' ' || message.charAt(0) === '[') {
        return [];
      }
      messages.push(message);
      return messages;
    }, [])
    .join('\n');
}
