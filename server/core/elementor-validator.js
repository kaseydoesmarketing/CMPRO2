import { validateElementorTemplate, validateAndEnhanceTemplate, getValidationErrors } from './schemas/elementor-schema.js';

class ElementorValidator {
  static validate(template) {
    const validationResult = validateAndEnhanceTemplate(template);
    
    return {
      ...validationResult,
      stats: this.getTemplateStats(validationResult.enhancedTemplate || template)
    };
  }

  static getTemplateStats(template) {
    return {
      sections: this.countElementsByType(template, 'section'),
      columns: this.countElementsByType(template, 'column'),
      widgets: this.countElementsByType(template, 'widget'),
      images: this.countImageWidgets(template),
      fileSize: JSON.stringify(template).length,
      isValid: validateElementorTemplate(template)
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

  static getDetailedReport(template) {
    const validation = this.validate(template);
    const stats = this.getTemplateStats(template);
    
    return {
      validation: {
        isValid: validation.isValid,
        errors: validation.errors,
        errorCount: validation.errors.length
      },
      statistics: stats,
      recommendations: this.generateRecommendations(validation, stats)
    };
  }

  static generateRecommendations(validation, stats) {
    const recommendations = [];
    
    if (!validation.isValid) {
      recommendations.push({
        severity: 'error',
        message: 'Template failed Elementor schema validation',
        action: 'Fix validation errors before download'
      });
    }
    
    if (stats.sections === 0) {
      recommendations.push({
        severity: 'warning',
        message: 'Template contains no sections',
        action: 'Ensure at least one section is present'
      });
    }
    
    if (stats.fileSize < 10000) {
      recommendations.push({
        severity: 'warning',
        message: 'Template file size is very small',
        action: 'Check if all content was properly captured'
      });
    }
    
    return recommendations;
  }
}

export default ElementorValidator;