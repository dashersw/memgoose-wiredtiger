export interface WTCursorResult {
  key: string
  value: string
}

export class WiredTigerCursor {
  private cursor: any

  constructor(cursor: any) {
    this.cursor = cursor
  }

  set(key: string, value: string): void {
    this.cursor.set(key, value)
  }

  get(): WTCursorResult | null {
    return this.cursor.get()
  }

  search(key: string): string | null {
    return this.cursor.search(key)
  }

  searchNear(key: ArrayBuffer): { exact: number } | null {
    return this.cursor.searchNear(key)
  }

  next(): WTCursorResult | null {
    return this.cursor.next()
  }

  prev(): WTCursorResult | null {
    return this.cursor.prev()
  }

  reset(): void {
    this.cursor.reset()
  }

  insert(): void {
    this.cursor.insert()
  }

  update(): void {
    this.cursor.update()
  }

  remove(): void {
    this.cursor.remove()
  }

  close(): void {
    this.cursor.close()
  }

  getRawKey(): ArrayBuffer | null {
    return this.cursor.getKey()
  }

  getRawValue(): ArrayBuffer | null {
    return this.cursor.getValue()
  }

  setRawKey(buffer: ArrayBuffer): void {
    this.cursor.setRawKey(buffer)
  }

  setRawValue(buffer: ArrayBuffer): void {
    this.cursor.setRawValue(buffer)
  }
}
