const { makeElementorConverter } from '../converters';

describe('Roundtrip test', () => {
  test('converts and exports', async () => {
    const conv = makeElementorConverter();
    const ir = await conv.toIR('<html><body><h1>Test</h1></body></html>');
    const exp = await conv.exportTemplate(ir);
    expect(exp).toBeDefined();
    expect(exp.kind).toBe("json");
  });
});
