export class ArgumentList {
  private list: string[] = [];

  add(...items: Array<string | number>): void {
    this.list = this.list.concat(items.map(String));
  }

  get(): string[] {
    return this.list;
  }

  clear(): void {
    this.list = [];
  }

  clone(): ArgumentList {
    const cloned = new ArgumentList();
    cloned.add(...this.list);
    return cloned;
  }
}
