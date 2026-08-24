import { CanonicalJsonService } from './canonical-json.service';

describe('CanonicalJsonService', () => {
  let service: CanonicalJsonService;

  beforeEach(() => {
    service = new CanonicalJsonService();
  });

  it('should deterministically sort object keys lexicographically', () => {
    const obj1 = { z: 1, a: 2, m: 3 };
    const obj2 = { a: 2, m: 3, z: 1 };
    const obj3 = { m: 3, z: 1, a: 2 };

    const canonical1 = service.canonicalize(obj1);
    const canonical2 = service.canonicalize(obj2);
    const canonical3 = service.canonicalize(obj3);

    expect(canonical1).toEqual('{"a":2,"m":3,"z":1}');
    expect(canonical1).toBe(canonical2);
    expect(canonical2).toBe(canonical3);
  });

  it('should sort nested object keys recursively', () => {
    const nested = {
      b: { y: 10, x: 20 },
      a: { beta: 'two', alpha: 'one' },
    };

    const result = service.canonicalize(nested);
    expect(result).toBe('{"a":{"alpha":"one","beta":"two"},"b":{"x":20,"y":10}}');
  });

  it('should preserve array element order while canonicalizing array elements', () => {
    const arrObj = {
      items: [{ b: 1, a: 2 }, { d: 4, c: 3 }],
      tag: 'list',
    };

    const result = service.canonicalize(arrObj);
    expect(result).toBe('{"items":[{"a":2,"b":1},{"c":3,"d":4}],"tag":"list"}');
  });
});
