export class Base64Url {
  static encode(input: string | Buffer): string {
    const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf-8');
    return buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  static decodeToString(input: string): string {
    return Base64Url.decodeToBuffer(input).toString('utf-8');
  }

  static decodeToBuffer(input: string): Buffer {
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }
    return Buffer.from(base64, 'base64');
  }
}
