// Simple Elementor Template Validator
// This will work 100% without complex dependencies

export default class SimpleElementorValidator {
  static validate(template) {
    console.log('🔍 SimpleElementorValidator.validate called with:', typeof template);
    
    const errors = [];
    
    // Check required fields
    if (!template.version) {
      errors.push({ path: 'version', message: 'Version is required' });
    } else if (template.version !== '0.4') {
      errors.push({ path: 'version', message: 'Version must be "0.4"' });
    }
    
    if (!template.title) {
      errors.push({ path: 'title', message: 'Title is required' });
    }
    
    if (!template.type) {
      errors.push({ path: 'type', message: 'Type is required' });
    } else if (!['page', 'section', 'header', 'footer'].includes(template.type)) {
      errors.push({ path: 'type', message: 'Invalid type' });
    }
    
    if (!template.content || !Array.isArray(template.content)) {
      errors.push({ path: 'content', message: 'Content must be an array' });
    } else if (template.content.length === 0) {
      errors.push({ path: 'content', message: 'Content cannot be empty' });
    }
    
    const isValid = errors.length === 0;
    
    console.log('🔍 SimpleElementorValidator result:', { isValid, errorCount: errors.length });
    
    return {
      isValid,
      errors,
      enhancedTemplate: isValid ? this.enhanceTemplate(template) : template,
      stats: {
        sections: this.countSections(template),
        fileSize: JSON.stringify(template).length
      }
    };
  }
  
  static enhanceTemplate(template) {
    const enhanced = { ...template };
    
    // Ensure required properties
    if (!enhanced.page_settings) {
      enhanced.page_settings = {};
    }
    if (!enhanced.page_settings.template) {
      enhanced.page_settings.template = 'elementor_canvas';
    }
    
    // Add metadata
    enhanced.metadata = {
      ...enhanced.metadata,
      created_at: new Date().toISOString(),
      elementor_version: '3.16.0',
      export_date: new Date().toISOString(),
      validated_by: 'SimpleElementorValidator'
    };
    
    return enhanced;
  }
  
  static countSections(template) {
    if (!template.content || !Array.isArray(template.content)) return 0;
    return template.content.filter(item => item.elType === 'section').length;
  }

  static countElementsByType(template, type) {
    if (!template.content || !Array.isArray(template.content)) return 0;
    return template.content.filter(item => item.elType === type).length;
  }

  static countImageWidgets(template) {
    return this.countElementsByType(template, 'image');
  }
} 