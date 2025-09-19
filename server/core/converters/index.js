import ElementorConverter from "../elementor-converter.js";

export { ElementorConverter };

export const makeElementorConverter = () => new ElementorConverter();

// Legacy shim — prevents crashes if older code calls this
ElementorConverter.prototype.buildIntermediateRepresentation = function (html) {
  return typeof this.toIR === 'function' ? this.toIR(String(html || '')) : String(html || '');
}; 