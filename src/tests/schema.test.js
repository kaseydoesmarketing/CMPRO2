const { validateElementorTemplate } from '../export/validate';

describe('Schema test', () => {
  test('validates template', () => {
    const template = { version: "0.4", title: "Test", type: "page", content: [] };
    expect(validateElementorTemplate(template)).toBe(true);
  });
});
