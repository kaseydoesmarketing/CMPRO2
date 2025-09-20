import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import ajvErrors from 'ajv-errors';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');
const SCHEMA_PATH = path.resolve(ROOT_DIR, 'schemas', 'elementor-schema.json');
const schemaJson = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));

const ajv = new Ajv({
  allErrors: true,
  strict: false,
  allowUnionTypes: true
});
addFormats(ajv);
ajvErrors(ajv);

export const validateElementorTemplate = ajv.compile(schemaJson);

export function getValidationErrors(errors) {
  if (!errors) return [];
  return errors.map(err => ({
    path: err.instancePath || '/',
    message: err.message || 'Invalid value',
    keyword: err.keyword,
    params: err.params
  }));
}

function enhanceTemplateStructure(template) {
  const clone = JSON.parse(JSON.stringify(template));
  if (!clone.page_settings) {
    clone.page_settings = { template: 'elementor_canvas', custom_css: '', custom_colors: [], custom_fonts: [] };
  }
  if (!clone.page_settings.template) {
    clone.page_settings.template = 'elementor_canvas';
  }
  clone.metadata = {
    ...(clone.metadata || {}),
    created_at: clone.metadata?.created_at || new Date().toISOString(),
    generator: clone.metadata?.generator || 'CloneMentorPro',
    elementor_version: clone.metadata?.elementor_version || '3.16.0'
  };
  return clone;
}

export function validateAndEnhanceTemplate(template) {
  const enhanced = enhanceTemplateStructure(template);
  const isValid = validateElementorTemplate(enhanced);
  const errors = getValidationErrors(validateElementorTemplate.errors);
  return { isValid, errors, enhancedTemplate: enhanced };
}
