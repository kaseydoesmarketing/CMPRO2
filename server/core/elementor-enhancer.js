import Ajv from 'ajv';

// Elementor JSON Schema based on official Elementor exports
const elementorSchema = {
  type: 'object',
  required: ['version', 'title', 'type', 'content', 'page_settings'],
  properties: {
    version: { type: 'string', pattern: '^0\\.4$' },
    title: { type: 'string' },
    type: { type: 'string', enum: ['page', 'section', 'header', 'footer'] },
    content: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'elType', 'settings', 'elements'],
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9]{8}$' },
          elType: { type: 'string', enum: ['section'] },
          settings: { type: 'object' },
          elements: {
            type: 'array',
            items: {
              type: 'object',
              required: ['id', 'elType', 'settings', 'elements'],
              properties: {
                id: { type: 'string', pattern: '^[a-z0-9]{8}$' },
                elType: { type: 'string', enum: ['column'] },
                settings: { type: 'object' },
                elements: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['id', 'elType', 'widgetType', 'settings'],
                    properties: {
                      id: { type: 'string', pattern: '^[a-z0-9]{8}$' },
                      elType: { type: 'string', enum: ['widget'] },
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
      required: ['template'],
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
        created_at: { type: 'string', format: 'date-time' },
        source_url: { type: 'string', format: 'uri' },
        cloned_by: { type: 'string' }
      }
    }
  }
};

const ajv = new Ajv();
export const validateElementorTemplate = ajv.compile(elementorSchema);

import { validateElementorTemplate } from './schemas/elementor-schema.js';

class ElementorValidator {
  static validateTemplate(template) {
    const isValid = validateElementorTemplate(template);
    
    return {
      isValid,
      errors: validateElementorTemplate.errors || [],
      details: {
        hasSections: template.content?.length > 0,
        sectionsCount: template.content?.length || 0,
        columnsCount: this.countElementsByType(template, 'column'),
        widgetsCount: this.countElementsByType(template, 'widget'),
        imagesCount: this.countImageWidgets(template),
        fileSize: JSON.stringify(template).length
      }
    };
  }

  static countElementsByType(template, type) {
    let count = 0;
    
    const countRecursive = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.elType === type) count++;
      
      if (Array.isArray(obj)) {
        obj.forEach(item => countRecursive(item));
      } else {
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            countRecursive(value);
          }
        });
      }
    };
    
    countRecursive(template);
    return count;
  }

  static countImageWidgets(template) {
    let count = 0;
    
    const countImages = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      if (obj.elType === 'widget' && obj.widgetType === 'image') {
        count++;
      }
      
      if (Array.isArray(obj)) {
        obj.forEach(item => countImages(item));
      } else {
        Object.values(obj).forEach(value => {
          if (typeof value === 'object' && value !== null) {
            countImages(value);
          }
        });
      }
    };
    
    countImages(template);
    return count;
  }

  static getTemplateStats(template) {
    const validation = this.validateTemplate(template);
    
    return {
      isValid: validation.isValid,
      sections: validation.details.sectionsCount,
      columns: validation.details.columnsCount,
      widgets: validation.details.widgetsCount,
      images: validation.details.imagesCount,
      fileSize: validation.details.fileSize,
      errors: validation.errors
    };
  }
}

export default ElementorValidator;

import ElementorValidator from '../core/elementor-validator.js';

// Update the metadata section in the scan endpoint (around line 245)
metadata: {
  originalUrl: url,
  title: visualData.pageInfo?.title,
  timestamp: visualData.timestamp,
  elementsCount: ElementorValidator.countElementsByType(elementorTemplate, 'widget'),
  sectionsCount: ElementorTemplate.countElementsByType(elementorTemplate, 'section'),
  columnsCount: ElementorValidator.countElementsByType(elementorTemplate, 'column'),
  widgetsCount: ElementorValidator.countElementsByType(elementorTemplate, 'widget'),
  imagesCount: ElementorValidator.countImageWidgets(elementorTemplate),
  templateSize: JSON.stringify(elementorTemplate).length,
  fileSize: calculateTotalResponseSize(res, elementorTemplate, visualData),
  totalResponseSize: calculateTotalResponseSize(res, elementorTemplate, visualData),
  actualFileSize: calculateTotalResponseSize(res, elementorTemplate, visualData),
  scrapeDuration: Date.now() - parseInt(sessionId),
  verificationPassed: verificationReport.passed,
  fidelityScore: Math.round(verificationReport.fidelityScore * 100),
  // Add validation status
  isValidElementor: ElementorValidator.validateTemplate(elementorTemplate).isValid
}

// Add validation before download
router.post('/download', (req, res) => {
  const { template, filename = 'cloned-template' } = req.body;
  
  if (!template) {
    return res.status(400).json({ error: 'Template data is required' });
  }

  // Validate template before download
  const validation = ElementorValidator.validateTemplate(template);
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: 'Invalid Elementor template format',
      details: validation.errors,
      recommendation: 'Template failed schema validation and cannot be imported into Elementor'
    });
  }

  // Set headers for file download
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
  
  // Send the validated template
  res.send(JSON.stringify(template, null, 2));
});

import ElementorValidator from '../core/elementor-validator.js';

// Update the progress interval (around line 44)
const progressInterval = setInterval(() => {
  setProgress(prev => {
    // Clamp progress at 95% until final completion
    if (prev >= 95) {
      clearInterval(progressInterval);
      return prev;
    }
    // More realistic progress increments
    return Math.min(prev + Math.random() * 5, 95);
  });
}, 800); // Slower progress updates

// New class to handle proper asset embedding and file size optimization
class ElementorEnhancer {
  static enhanceTemplate(template, visualData) {
    const enhanced = JSON.parse(JSON.stringify(template));
    
    // Embed essential assets to increase file size properly
    this.embedAssets(enhanced, visualData);
    this.optimizeStructure(enhanced);
    this.addKitMetadata(enhanced);
    
    return enhanced;
  }
  
  static embedAssets(template, visualData) {
    if (visualData.assets?.images) {
      template.metadata.embedded_images = visualData.assets.images.slice(0, 20);
    }
    
    if (visualData.assets?.fonts) {
      template.page_settings.custom_fonts = visualData.assets.fonts.map((font, index) => ({
        _id: `font_${index}`,
        title: `Font ${index + 1}`,
        font_family: font
      }));
    }
    
    if (visualData.assets?.colors) {
      template.page_settings.custom_colors = visualData.assets.colors.map((color, index) => ({
        _id: `color_${index}`,
        title: `Color ${index + 1}`,
        color: color
      }));
    }
  }
  
  static optimizeStructure(template) {
    // Ensure proper Elementor kit structure
    if (!template.content || template.content.length === 0) {
      template.content = [this.createDefaultSection()];
    }
    
    // Add proper responsive settings
    template.page_settings.viewport_mobile = 767;
    template.page_settings.viewport_tablet = 1024;
  }
  
  static addKitMetadata(template) {
    template.metadata.kit_info = {
      generated_at: new Date().toISOString(),
      total_elements: template.content.reduce((total, section) => 
        total + section.elements.reduce((colTotal, column) => 
          colTotal + column.elements.length, 0), 0),
      estimated_size: JSON.stringify(template).length
    };
  }
} 