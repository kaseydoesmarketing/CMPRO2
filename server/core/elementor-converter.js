import VisualWebScraper from './visual-scraper.js';
import * as cheerio from 'cheerio';

class ElementorConverter {
  constructor() {
    this.elementCounter = 0;
  }

  generateElementId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async convertVisualToElementor(visualData, verificationReport) {
    console.log(' ElementorConverter.convertVisualToElementor called with comprehensive data');
    
    // Use the structure from IR if available, otherwise fallback to simple template
    const irStructure = visualData.visualStructure?.structure;
    const completeHTML = visualData.visualStructure?.completeHTML || '';
    
    let template;
    
    if (irStructure && this.hasValidContent(irStructure)) {
      // Build comprehensive template from captured structure
      template = this.buildComprehensiveTemplate(irStructure, visualData);
    } else {
      // Fallback to simple template
      template = this.buildSimpleTemplate(visualData);
    }
    
    console.log('✅ ElementorConverter generated template successfully');
    return template;
  }
  
  buildComprehensiveTemplate(structure, visualData) {
    // Convert the captured structure to Elementor format
    const elementorContent = this.convertStructureToElementor(structure);
    
    return {
      version: "0.4",
      title: visualData.pageInfo?.title || 'Cloned Page',
      type: "page",
      content: elementorContent,
      page_settings: {
        template: 'elementor_canvas'
      },
      metadata: {
        created_at: new Date().toISOString(),
        source_url: visualData.url || visualData.pageInfo?.url,
        cloned_by: 'CloneMentor Pro',
        elementor_version: '3.16.0',
        fidelity_score: visualData.verification?.fidelityScore || 0,
        elements_count: this.countElementsInStructure(structure),
        sections_count: this.countSectionsInStructure(structure)
      }
    };
  }
  
  buildSimpleTemplate(visualData) {
    // Simple fallback template
    return {
      version: "0.4",
      title: visualData.pageInfo?.title || 'Test Cloned Page',
      type: "page",
      content: [
        {
          id: this.generateElementId(),
          elType: 'section',
          settings: {
            content_width: 'boxed'
          },
          elements: [
            {
              id: this.generateElementId(),
              elType: 'column',
              settings: {
                _column_size: 100,
                _inline_size: null
              },
              elements: [
                {
                  id: this.generateElementId(),
                  elType: 'widget',
                  widgetType: 'heading',
                  settings: {
                    title: 'Successfully Cloned!',
                    header_size: 'h1'
                  }
                }
              ]
            }
          ]
        }
      ],
      page_settings: {
        template: 'elementor_canvas'
      },
      metadata: {
        created_at: new Date().toISOString(),
        source_url: visualData.url || visualData.pageInfo?.url,
        cloned_by: 'ElementorConverter',
        elementor_version: '3.16.0',
        fallback_mode: true
      }
    };
  }
  
  convertStructureToElementor(structure) {
    if (!structure) return [];
    
    const convertElement = (element) => {
      if (!element) return null;
      
      const { tagName, layout, children, textContent, innerHTML, attributes } = element;
      
      // Determine Elementor element type
      const elementType = this.determineElementorElementType(element);
      
      switch (elementType) {
        case 'section':
          return {
            id: this.generateElementId(),
            elType: 'section',
            settings: this.buildSectionSettings(element),
            elements: children.map(convertElement).filter(Boolean)
          };
          
        case 'column':
          return {
            id: this.generateElementId(),
            elType: 'column',
            settings: this.buildColumnSettings(element),
            elements: children.map(convertElement).filter(Boolean)
          };
          
        case 'widget':
          return this.buildWidget(element);
          
        default:
          return null;
      }
    };
    
    return [convertElement(structure)].filter(Boolean);
  }
  
  determineElementorElementType(element) {
    const { tagName, layout, children } = element;
    
    // Section logic
    if (tagName === 'section' || tagName === 'header' || tagName === 'footer' || 
        tagName === 'main' || (layout.display === 'flex' && layout.flexDirection === 'column') ||
        (layout.width >= 300 && children.length > 0)) {
      return 'section';
    }
    
    // Column logic
    if ((layout.display === 'flex' || layout.display === 'block' || 
         layout.display === 'inline-block') && children.length > 0) {
      return 'column';
    }
    
    // Widget logic
    return 'widget';
  }
  
  hasValidContent(structure) {
    if (!structure) return false;
    
    const hasText = structure.textContent && structure.textContent.trim().length > 0;
    const hasChildren = structure.children && structure.children.length > 0;
    const hasImages = structure.tagName === 'img' || 
                     (structure.attributes && structure.attributes.src);
    
    return hasText || hasChildren || hasImages;
  }
  
  countElementsInStructure(structure) {
    if (!structure) return 0;
    
    let count = 1; // Count this element
    
    if (structure.children) {
      structure.children.forEach(child => {
        count += this.countElementsInStructure(child);
      });
    }
    
    return count;
  }
  
  countSectionsInStructure(structure) {
    if (!structure) return 0;
    
    let count = structure.tagName === 'section' ? 1 : 0;
    
    if (structure.children) {
      structure.children.forEach(child => {
        count += this.countSectionsInStructure(child);
      });
    }
    
    return count;
  }

  // IR conversion method - single source of truth for both preview and export
  async toIR(input) {
    console.log("�� ElementorConverter.toIR called");
    let visualData;
    if (typeof input === 'string') {
      const src = String(input || '').trim();
      if (!src) throw new Error('Empty source');
      // Treat as HTML if it looks like markup
      const looksLikeHtml = src.startsWith('<') || src.includes('<html');
      if (looksLikeHtml) {
        visualData = {
          url: '',
          pageInfo: { title: 'From HTML' },
          visualStructure: { completeHTML: src, structure: null, styles: '' },
          responsiveLayouts: {},
          assets: { images: [], fonts: [], colors: [], gradients: [], videos: [], forms: [], buttons: [], links: [], stylesheets: [], scripts: [] },
          timestamp: new Date().toISOString()
        };
      } else {
        // Assume URL - scrape to build visual data
        const scraper = new VisualWebScraper();
        try {
          visualData = await scraper.scrapeVisualLayout(src);
        } finally {
          await scraper.close().catch(() => {});
        }
      }
    } else {
      // Assume already visualData shape
      visualData = input || {};
    }

    // Create comprehensive IR that includes all captured data
    const ir = {
      html: visualData.visualStructure?.completeHTML || '',
      structure: visualData.visualStructure?.structure || null,
      styles: visualData.visualStructure?.styles || '',
      responsiveLayouts: visualData.responsiveLayouts || {},
      assets: visualData.assets || {
        images: [], fonts: [], colors: [], gradients: [], videos: [], forms: [], buttons: [], links: [], stylesheets: [], scripts: []
      },
      pageInfo: visualData.pageInfo || {
        title: '', description: '', favicon: null, charset: '', lang: '', viewport: ''
      },
      source: { url: visualData.url || '', timestamp: visualData.timestamp || new Date().toISOString() },
      metadata: { processedAt: new Date().toISOString(), converterVersion: '1.0', elementorCompatible: true }
    };

    console.log("✅ Comprehensive IR generated successfully");
    return ir;
  }
  
  // Legacy shim for buildIntermediateRepresentation
  async buildIntermediateRepresentation(html) {
    console.log("🔍 Legacy buildIntermediateRepresentation called - using toIR");
    return this.toIR(html);
  }
  
  // Export template method
  async exportTemplate(ir, mode = "template") {
    console.log("🔍 ElementorConverter.exportTemplate called with mode:", mode);
    
    const template = await this.convertVisualToElementor({ visualStructure: { completeHTML: ir.html } }, {});

    if (mode === "template") {
      const bytes = Buffer.from(JSON.stringify(template, null, 2));
      return {
        bytes,
        kind: "json",
        report: {
          isValid: true,
          mode: "template",
          size: bytes.length
        }
      };
    } else if (mode === "kit") {
      const { default: AdmZip } = await import('adm-zip');
      const zip = new AdmZip();
      zip.addFile("template.json", Buffer.from(JSON.stringify(template, null, 2)));
      // Add assets from ir (supports shapes: array or object collections)
      const addAsset = (p, content) => {
        const safe = String(p || '').replace(/[^a-zA-Z0-9._\/-]/g, '_');
        const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content || ''), 'utf8');
        zip.addFile(`assets/${safe}`, buf);
      };
      if (ir && ir.assets) {
        if (Array.isArray(ir.assets)) {
          ir.assets.forEach(a => addAsset(a.path || a.src || 'asset.bin', a.content || ''));
        } else {
          // Support categorized assets: images, fonts, etc.
          const { images = [], fonts = [], videos = [] } = ir.assets;
          images.forEach((img, i) => addAsset(img.path || img.src || `image_${i}.txt`, img.content || img.src || ''));
          fonts.forEach((f, i) => addAsset(f.path || `font_${i}.txt`, f.content || ''));
          videos.forEach((v, i) => addAsset(v.path || v.src || `video_${i}.txt`, v.content || v.src || ''));
        }
      }
      // Add a simple manifest
      zip.addFile("manifest.json", Buffer.from(JSON.stringify({
        generatedAt: new Date().toISOString(),
        sourceUrl: ir?.source?.url || '',
        counts: await this.counts(ir)
      }, null, 2)));
      const bytes = zip.toBuffer();
      return {
        bytes,
        kind: "zip",
        report: {
          isValid: true,
          mode: "kit",
          size: bytes.length
        }
      };
    } else {
      throw new Error("Invalid mode");
    }
  }

  async counts(ir) {
    try {
      if (ir && ir.structure) {
        const countRecursive = (node) => {
          if (!node) return { sections: 0, elements: 0, images: 0 };
          let sections = node.tagName === 'section' ? 1 : 0;
          let images = node.tagName === 'img' || (node.attributes && node.attributes.src) ? 1 : 0;
          let elements = 1;
          if (Array.isArray(node.children)) {
            for (const c of node.children) {
              const sub = countRecursive(c);
              sections += sub.sections;
              images += sub.images;
              elements += sub.elements;
            }
          }
          return { sections, elements, images };
        };
        return countRecursive(ir.structure);
      }
      const $ = cheerio.load(ir?.html || '');
      return {
        sections: $('section').length,
        elements: $('body *').length,
        images: $('img').length
      };
    } catch (_e) {
      return { sections: 0, elements: 0, images: 0 };
    }
  }
}

export default ElementorConverter; 
