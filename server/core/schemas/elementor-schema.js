import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

// Simplified Elementor JSON Schema for validation
const elementorSchema = {
  type: 'object',
  required: ['version', 'title', 'type', 'content'],
  properties: {
    version: { 
      type: 'string', 
      pattern: '^0\\.4$'
    },
    title: { 
      type: 'string',
      minLength: 1
    },
    type: { 
      type: 'string', 
      enum: ['page', 'section', 'header', 'footer', 'single', 'archive']
    },
    content: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'elType', 'settings', 'elements'],
        properties: {
          id: { 
            type: 'string', 
            pattern: '^[a-z0-9]{8}$'
          },
          elType: { 
            type: 'string', 
            enum: ['section']
          },
          settings: { type: 'object' },
          elements: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'elType', 'settings', 'elements'],
              properties: {
                id: { 
                  type: 'string', 
                  pattern: '^[a-z0-9]{8}$'
                },
                elType: { 
                  type: 'string', 
                  enum: ['column']
                },
                settings: { type: 'object' },
                elements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'elType', 'widgetType', 'settings'],
                    properties: {
                      id: { 
                        type: 'string', 
                        pattern: '^[a-z0-9]{8}$'
                      },
                      elType: { 
                        type: 'string', 
                        enum: ['widget']
                      },
                      widgetType: { type: 'string' },
                      settings: { type: 'object' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    page_settings: {
      type: 'object',
      properties: {
        template: { type: 'string' },
        custom_css: { type: 'string' },
        custom_colors: { type: 'array' },
        custom_fonts: { type: 'array' }
      }
    },
    metadata: {
      type: 'object',
      properties: {
        created_at: { type: 'string' },
        source_url: { type: 'string' },
        cloned_by: { type: 'string' }
      }
    }
  },
  additionalProperties: false
};

// Compile the schema validator
export const validateElementorTemplate = ajv.compile(elementorSchema);

// Helper function to get detailed validation errors
export function getValidationErrors(errors) {
  if (!errors) return [];
  
  return errors.map(error => {
    const path = error.instancePath || 'root';
    const message = error.message || 'Invalid value';
    
    return {
      path,
      message,
      keyword: error.keyword,
      params: error.params
    };
  });
}

// Function to validate and enhance template
export function validateAndEnhanceTemplate(template) {
  const isValid = validateElementorTemplate(template);
  const errors = getValidationErrors(validateElementorTemplate.errors);
  
  return {
    isValid,
    errors,
    enhancedTemplate: isValid ? enhanceTemplateStructure(template) : template
  };
}

// Function to enhance template structure for better Elementor compatibility
function enhanceTemplateStructure(template) {
  const enhanced = JSON.parse(JSON.stringify(template));
  
  // Ensure required properties exist
  if (!enhanced.version) enhanced.version = "0.4";
  if (!enhanced.type) enhanced.type = "page";
  if (!enhanced.page_settings) enhanced.page_settings = {};
  if (!enhanced.page_settings.template) enhanced.page_settings.template = "elementor_canvas";
  
  // Add proper metadata
  enhanced.metadata = {
    ...enhanced.metadata,
    created_at: new Date().toISOString(),
    elementor_version: '3.16.0',
    export_date: new Date().toISOString()
  };
  
  return enhanced;
} 