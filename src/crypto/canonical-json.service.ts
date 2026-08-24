import { Injectable } from '@nestjs/common';

@Injectable()
export class CanonicalJsonService {
  /**
   * Deterministically serialize any object according to RFC 8785 (JSON Canonicalization Scheme).
   * All object keys are sorted lexicographically by UTF-16 code units.
   */
  canonicalize(object: any): string {
    return this.serialize(object);
  }

  private serialize(value: any): string {
    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
      const serializedElements = value.map((elem) => this.serialize(elem));
      return `[${serializedElements.join(',')}]`;
    }

    // Object: sort keys lexicographically
    const keys = Object.keys(value).sort();
    const serializedPairs = keys.map(
      (key) => `${JSON.stringify(key)}:${this.serialize(value[key])}`,
    );

    return `{${serializedPairs.join(',')}}`;
  }
}
