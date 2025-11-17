import VisualWebScraper from './visual-scraper.js';
import * as cheerio from 'cheerio';

class ElementorConverter {
  constructor() {
    this.elementCounter = 0;

    // DEFAULT STYLING for fallback text widgets (when no layout data is captured)
    this.DEFAULT_TEXT_STYLING = {
      typography_typography: 'custom',
      typography_font_family: 'Arial, sans-serif',
      typography_font_size: { size: 16, unit: 'px' },
      typography_font_weight: '400',
      typography_line_height: { size: 1.5, unit: 'em' },
      text_color: '#333333'
    };
  }

  generateElementId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Check if an element is button-like (CTA, call-to-action, etc.)
   * Uses precise word-boundary matching to avoid false positives
   * @param {object} element - Element to check
   * @returns {boolean} True if element appears to be a button
   */
  isButtonLike(element) {
    const className = element.className || '';
    const tagName = element.tagName || '';
    const layout = element.layout || {};

    // FIXED: Use word boundaries to prevent false positives like "distribute", "attribution"
    const buttonClasses = ['btn', 'button', 'cta', 'call-to-action', 'action', 'submit', 'download'];
    const hasButtonClass = buttonClasses.some(btnClass => {
      // Match whole words only using regex word boundaries
      const regex = new RegExp(`\\b${btnClass.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      return regex.test(className);
    });

    // Check for actual button or input[type=submit/button] tags
    const isButtonTag = tagName === 'button' ||
                       (tagName === 'input' &&
                        (element.attributes?.type === 'submit' || element.attributes?.type === 'button'));

    // Check for button-like styling (more strict criteria)
    const hasStrongButtonStyling = (
      // Must have background color AND significant padding/border-radius
      layout.backgroundColor &&
      layout.backgroundColor !== "rgba(0, 0, 0, 0)" &&
      layout.backgroundColor !== "transparent" &&
      (
        (layout.borderRadius && parseInt(layout.borderRadius) >= 3) ||
        (layout.padding && (
          parseInt(layout.padding.top) >= 8 &&
          parseInt(layout.padding.bottom) >= 8 &&
          parseInt(layout.padding.left) >= 12 &&
          parseInt(layout.padding.right) >= 12
        ))
      )
    );

    return hasButtonClass || isButtonTag || hasStrongButtonStyling;
  }

  /**
   * Check if a link is a navigation link (should be filtered out)
   * Uses precise detection to avoid false positives
   * @param {object} element - Link element to check
   * @returns {boolean} True if element is a navigation link
   */
  isNavigationLink(element) {
    const href = element.attributes?.href || '';
    const className = element.className || '';
    const textContent = (element.textContent || '').toLowerCase().trim();

    // Empty or placeholder hrefs
    if (!href || href === '#' || href === 'javascript:void(0)' || href === 'javascript:;') {
      return true;
    }

    // Check for navigation-specific class names (word boundaries)
    const navClasses = ['nav', 'menu', 'navigation', 'navbar', 'header-link', 'footer-link'];
    const hasNavClass = navClasses.some(navClass => {
      const regex = new RegExp(`\\b${navClass}\\b`, 'i');
      return regex.test(className);
    });

    if (hasNavClass) return true;

    // Check for common navigation text patterns
    const navTextPatterns = [
      'home', 'about', 'contact', 'services', 'products', 'blog',
      'portfolio', 'team', 'careers', 'faq', 'support', 'pricing',
      'features', 'login', 'sign in', 'register', 'sign up'
    ];

    const hasNavText = navTextPatterns.some(pattern =>
      textContent === pattern || textContent.includes(pattern)
    );

    // Common navigation URL patterns (but exclude obvious CTAs)
    const navUrlPatterns = [
      /^\/(about|contact|blog|services|products|team|careers|faq|support)$/i,
      /^#[a-z-]+$/i, // Hash links like #about, #contact
      /\/category\//i,
      /\/tag\//i,
      /\/archive\//i,
      /\/page\//i
    ];

    const hasNavUrl = navUrlPatterns.some(pattern => pattern.test(href));

    // If it has nav text AND nav URL, definitely navigation
    if (hasNavText && (hasNavUrl || href.startsWith('/'))) {
      return true;
    }

    // Just nav class or just nav URL (but not both) - less certain
    return hasNavClass || hasNavUrl;
  }

  async convertVisualToElementor(visualData, verificationReport, assetMapping = null) {
    console.log(' ElementorConverter.convertVisualToElementor called with comprehensive data');

    // Clear image cache for new page
    this.clearImageCache();

    // Store asset mapping for URL rewriting with validation
    try {
      this.assetMapping = this.validateAssetMapping(assetMapping) || {};
      if (this.assetMapping && this.assetMapping.images && this.assetMapping.images.length > 0) {
        console.log(`✅ Asset mapping loaded: ${this.assetMapping.images.length} images available`);
      } else {
        console.log('ℹ️  No asset mapping provided - using original image URLs');
      }
    } catch (error) {
      console.error('⚠️  Asset mapping validation failed:', error.message);
      this.assetMapping = {};
    }
    
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
  
  /**
   * Extract all images recursively from element tree
   * OPTIMIZED: Uses caching and duplicate detection
   * @param {object} element - Root element to extract images from
   * @param {boolean} useCache - Whether to use cached results (default: true)
   * @returns {Array} Array of image elements
   */
  extractAllImages(element, useCache = true) {
    // Use cache if available and requested
    if (useCache && this._imageCache) {
      return this._imageCache;
    }

    const images = [];
    const seenSrcs = new Set(); // Duplicate detection

    const traverse = (el, depth = 0) => {
      if (!el || depth > 50) return; // Prevent infinite recursion

      // If this element is an image, capture it
      if (el.tagName === 'img') {
        const src = el.attributes?.src || '';

        // DUPLICATE DETECTION: Skip if we've already seen this exact src
        if (src && seenSrcs.has(src)) {
          return;
        }

        // Mark as seen
        if (src) {
          seenSrcs.add(src);
        }

        images.push({
          tagName: 'img',
          attributes: el.attributes || {},
          layout: el.layout || {},
          textContent: el.textContent || '',
          innerHTML: el.innerHTML || ''
        });
      }

      // Recursively check children
      if (el.children && Array.isArray(el.children)) {
        el.children.forEach(child => traverse(child, depth + 1));
      }
    };

    traverse(element);

    // Cache the results for future calls
    if (useCache) {
      this._imageCache = images;
    }

    return images;
  }

  /**
   * Clear the image cache (call when processing a new page)
   */
  clearImageCache() {
    this._imageCache = null;
  }

  /**
   * Validate and sanitize asset mapping
   * Ensures asset mapping has required structure and valid URLs
   * @param {object} assetMapping - Raw asset mapping to validate
   * @returns {object|null} Validated asset mapping or null
   */
  validateAssetMapping(assetMapping) {
    if (!assetMapping || typeof assetMapping !== 'object') {
      return null;
    }

    const validated = {
      sessionId: assetMapping.sessionId || null,
      images: [],
      fonts: [],
      css: []
    };

    // Validate images
    if (Array.isArray(assetMapping.images)) {
      validated.images = assetMapping.images.filter(img => {
        // Must have both original URL and local URL
        if (!img.originalUrl || !img.localUrl) {
          console.warn(`⚠️  Skipping invalid image asset: missing URLs`);
          return false;
        }
        // Validate URLs are non-empty strings
        if (typeof img.originalUrl !== 'string' || typeof img.localUrl !== 'string') {
          console.warn(`⚠️  Skipping invalid image asset: URLs must be strings`);
          return false;
        }
        return true;
      });
    }

    // Validate fonts (optional)
    if (Array.isArray(assetMapping.fonts)) {
      validated.fonts = assetMapping.fonts.filter(font =>
        font.originalUrl && font.localUrl &&
        typeof font.originalUrl === 'string' &&
        typeof font.localUrl === 'string'
      );
    }

    // Validate CSS (optional)
    if (Array.isArray(assetMapping.css)) {
      validated.css = assetMapping.css.filter(css =>
        css.originalUrl && css.localUrl &&
        typeof css.originalUrl === 'string' &&
        typeof css.localUrl === 'string'
      );
    }

    return validated;
  }

  /**
   * Find matching asset using precise URL comparison
   * Tries multiple strategies with decreasing precision
   * @param {string} imageUrl - URL to find in asset mapping
   * @param {Array} assetImages - Array of downloaded images
   * @returns {object|null} Matching asset or null
   */
  findMatchingAsset(imageUrl, assetImages) {
    if (!imageUrl || !assetImages || assetImages.length === 0) {
      return null;
    }

    // Normalize URLs for comparison (remove query params, fragments)
    const normalizeUrl = (url) => {
      try {
        const parsed = new URL(url, 'http://dummy.com');
        return parsed.pathname;
      } catch {
        // Not a valid URL, just remove query params and fragments manually
        return url.split('?')[0].split('#')[0];
      }
    };

    const normalizedImageUrl = normalizeUrl(imageUrl);

    // Strategy 1: Exact URL match (highest priority)
    let match = assetImages.find(img =>
      img.originalUrl === imageUrl || img.absoluteUrl === imageUrl
    );
    if (match) return match;

    // Strategy 2: Normalized path match (without query params)
    match = assetImages.find(img =>
      normalizeUrl(img.originalUrl) === normalizedImageUrl ||
      normalizeUrl(img.absoluteUrl) === normalizedImageUrl
    );
    if (match) return match;

    // Strategy 3: Filename match (lowest priority, requires exact filename)
    const getFilename = (url) => {
      const normalized = normalizeUrl(url);
      return normalized.split('/').pop() || '';
    };

    const imageFilename = getFilename(imageUrl);
    if (imageFilename) {
      match = assetImages.find(img => {
        const assetFilename = getFilename(img.originalUrl);
        // Only match if filenames are identical and non-empty
        return assetFilename && assetFilename === imageFilename;
      });
      if (match) return match;
    }

    // No match found
    return null;
  }

  // ==================== CENTRALIZED STYLING INFRASTRUCTURE ====================

  /**
   * Helper: Parse CSS padding string into object
   * @param {string} paddingStr - e.g. "10px 20px 10px 20px"
   * @returns {object} - {top, right, bottom, left, unit: 'px'}
   */
  parsePaddingString(paddingStr) {
    if (!paddingStr || paddingStr === '0' || paddingStr === '0px') {
      return { unit: 'px', top: '', right: '', bottom: '', left: '', isLinked: false };
    }

    const parts = String(paddingStr).trim().split(/\s+/);
    const values = parts.map(p => parseInt(p) || 0);

    if (values.length === 1) {
      return { unit: 'px', top: values[0], right: values[0], bottom: values[0], left: values[0], isLinked: true };
    } else if (values.length === 2) {
      return { unit: 'px', top: values[0], right: values[1], bottom: values[0], left: values[1], isLinked: false };
    } else if (values.length === 3) {
      return { unit: 'px', top: values[0], right: values[1], bottom: values[2], left: values[1], isLinked: false };
    } else if (values.length === 4) {
      return { unit: 'px', top: values[0], right: values[1], bottom: values[2], left: values[3], isLinked: false };
    }

    return { unit: 'px', top: '', right: '', bottom: '', left: '', isLinked: false };
  }

  /**
   * Helper: Parse border width (handles "1px", "1px solid rgb(...)", etc)
   * @param {string} border - Full border string
   * @returns {object} - {unit: 'px', top, right, bottom, left}
   */
  parseBorderWidth(border) {
    if (!border || border === 'none' || border === '0') {
      return { unit: 'px', top: '', right: '', bottom: '', left: '', isLinked: true };
    }

    const match = String(border).match(/(\d+)px/);
    const width = match ? parseInt(match[1]) : 1;
    return { unit: 'px', top: width, right: width, bottom: width, left: width, isLinked: true };
  }

  /**
   * Helper: Extract border color from border string
   * @param {string} border - e.g. "1px solid rgb(0, 0, 0)"
   * @returns {string} - color or empty string
   */
  extractBorderColor(border) {
    if (!border || border === 'none') return '';

    const rgbMatch = String(border).match(/rgb\([^)]+\)/);
    if (rgbMatch) return rgbMatch[0];

    const hexMatch = String(border).match(/#[0-9a-fA-F]{3,6}/);
    if (hexMatch) return hexMatch[0];

    return '';
  }

  /**
   * CENTRAL STYLING FUNCTION - Apply comprehensive Elementor styling to any widget
   * @param {object} widget - Base widget object with widgetType
   * @param {object} element - Source element with layout data
   * @returns {object} - Widget with full styling applied
   */
  applyElementStyles(widget, element) {
    if (!widget || !widget.settings) {
      console.warn('⚠️ applyElementStyles: Invalid widget or missing settings');
      return widget;
    }

    const layout = element?.layout || {};
    const widgetType = widget.widgetType;

    // 1. TYPOGRAPHY - Font family, size, weight, line height
    if (layout.fontFamily) {
      widget.settings.typography_typography = "custom";
      widget.settings.typography_font_family = layout.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    }

    if (layout.fontSize) {
      const size = parseInt(layout.fontSize) || 16;
      if (!widget.settings.typography_typography) widget.settings.typography_typography = "custom";
      widget.settings.typography_font_size = { size, unit: "px" };
    }

    if (layout.fontWeight) {
      if (!widget.settings.typography_typography) widget.settings.typography_typography = "custom";
      widget.settings.typography_font_weight = layout.fontWeight;
    }

    if (layout.lineHeight) {
      const lineHeight = parseFloat(layout.lineHeight) || 1.5;
      if (!widget.settings.typography_typography) widget.settings.typography_typography = "custom";
      widget.settings.typography_line_height = { size: lineHeight, unit: "em" };
    }

    // 2. COLORS - Text color and background
    if (layout.color && layout.color !== "rgb(0, 0, 0)") {
      // Widget-specific color property names
      if (widgetType === "heading") {
        widget.settings.title_color = layout.color;
      } else if (widgetType === "text-editor") {
        widget.settings.text_color = layout.color;
      } else if (widgetType === "button") {
        widget.settings.button_text_color = layout.color;
      }
    }

    if (layout.backgroundColor && layout.backgroundColor !== "rgba(0, 0, 0, 0)" && layout.backgroundColor !== "transparent") {
      if (widgetType === "button") {
        widget.settings.button_background_color = layout.backgroundColor;
      } else {
        // Generic background for other widgets
        widget.settings._background_background = "classic";
        widget.settings._background_color = layout.backgroundColor;
      }
    }

    // 3. SPACING - Margin and padding
    if (layout.margin) {
      // Handle both object format {top, right, bottom, left} and string format
      if (typeof layout.margin === 'object' && !Array.isArray(layout.margin)) {
        widget.settings._margin = {
          unit: 'px',
          top: parseInt(layout.margin.top) || '',
          right: parseInt(layout.margin.right) || '',
          bottom: parseInt(layout.margin.bottom) || '',
          left: parseInt(layout.margin.left) || '',
          isLinked: false
        };
      } else {
        widget.settings._margin = this.parsePaddingString(String(layout.margin));
      }
    }

    if (layout.padding) {
      // Handle both object format {top, right, bottom, left} and string format
      if (typeof layout.padding === 'object' && !Array.isArray(layout.padding)) {
        widget.settings._padding = {
          unit: 'px',
          top: parseInt(layout.padding.top) || '',
          right: parseInt(layout.padding.right) || '',
          bottom: parseInt(layout.padding.bottom) || '',
          left: parseInt(layout.padding.left) || '',
          isLinked: false
        };
      } else {
        widget.settings._padding = this.parsePaddingString(String(layout.padding));
      }
    }

    // 4. BORDERS - Width, color, radius
    if (layout.border && layout.border !== 'none') {
      widget.settings._border_border = "solid";
      widget.settings._border_width = this.parseBorderWidth(layout.border);

      const borderColor = this.extractBorderColor(layout.border);
      if (borderColor) {
        widget.settings._border_color = borderColor;
      }
    }

    if (layout.borderRadius) {
      const radius = parseInt(layout.borderRadius) || 0;
      widget.settings._border_radius = {
        unit: "px",
        top: radius,
        right: radius,
        bottom: radius,
        left: radius,
        isLinked: true
      };
    }

    // 5. BOX SHADOW
    if (layout.boxShadow && layout.boxShadow !== 'none') {
      widget.settings._box_shadow_box_shadow_type = "yes";
      widget.settings._box_shadow_box_shadow = {
        horizontal: 0,
        vertical: 2,
        blur: 5,
        spread: 0,
        color: "rgba(0, 0, 0, 0.1)"
      };
    }

    // 6. DISPLAY PROPERTIES - Text alignment
    if (layout.textAlign) {
      widget.settings.align = layout.textAlign;
    }

    // 7. WIDTH/HEIGHT for images
    if (widgetType === "image") {
      if (layout.width) {
        const width = parseInt(layout.width) || 0;
        if (width > 0) {
          widget.settings.width = { size: width, unit: "px" };
        }
      }

      if (layout.height) {
        const height = parseInt(layout.height) || 0;
        if (height > 0) {
          widget.settings.height = { size: height, unit: "px" };
        }
      }
    }

    return widget;
  }

  // ==================== END CENTRALIZED STYLING ====================

  convertStructureToElementor(structure) {
    if (!structure) return [];

    const convertElement = (element, parentType = null) => {
      if (!element) return null;

      const { tagName, layout, children, textContent, innerHTML, attributes } = element;

      // Determine Elementor element type (pass parent type for better context)
      const elementType = this.determineElementorElementType(element, parentType);

      switch (elementType) {
        case 'section':
          // FIRST: Extract all images from this section's tree
          const sectionImages = this.extractAllImages(element);

          // Sections must contain columns
          const sectionChildren = children?.map(child => convertElement(child, 'section')).filter(Boolean) || [];
          const columns = sectionChildren.length > 0 ? sectionChildren : [
            {
              id: this.generateElementId(),
              elType: 'column',
              settings: this.buildColumnSettings(element),
              elements: [this.applyElementStyles({
                id: this.generateElementId(),
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: element.textContent || element.innerHTML || 'Edit this text in Elementor',
                  align: 'left',
                  ...this.DEFAULT_TEXT_STYLING  // Add default styling for fallback widgets
                },
                elements: []
              }, element)]
            }
          ];

          // ADD: Convert extracted images to widgets and inject into first column
          if (sectionImages.length > 0 && columns.length > 0) {
            const imageWidgets = sectionImages.map(img => this.buildWidget(img));
            // Add images to the first column
            if (columns[0] && columns[0].elements) {
              columns[0].elements.push(...imageWidgets);
            }
          }

          return {
            id: this.generateElementId(),
            elType: 'section',
            settings: this.buildSectionSettings(element),
            elements: columns.map(child => {
              // Ensure all section children are columns
              if (child && child.elType !== 'column') {
                return {
                  id: this.generateElementId(),
                  elType: 'column',
                  settings: this.buildColumnSettings(element),
                  elements: [child.elType === 'widget' ? child : this.applyElementStyles({
                    id: this.generateElementId(),
                    elType: 'widget',
                    widgetType: 'text-editor',
                    settings: {
                      editor: child.textContent || child.innerHTML || 'Edit this text in Elementor',
                      align: 'left',
                      ...this.DEFAULT_TEXT_STYLING  // Add default styling for fallback widgets
                    },
                    elements: []
                  }, child)]
                };
              }
              return child;
            }).filter(Boolean)
          };
          
        case 'column':
          const columnElements = children?.map(child => convertElement(child, 'column')).filter(Boolean) || [];
          // Ensure all column elements are widgets
          const widgetElements = columnElements.map(child => {
            if (child && child.elType !== 'widget') {
              // Convert non-widget elements to proper widgets
              return this.applyElementStyles({
                id: this.generateElementId(),
                elType: 'widget',
                widgetType: 'text-editor',
                settings: {
                  editor: child.textContent || child.innerHTML || 'Edit this text in Elementor',
                  align: 'left',
                  ...this.DEFAULT_TEXT_STYLING  // Add default styling for fallback widgets
                },
                elements: []
              }, child);
            }
            return child;
          }).filter(Boolean);

          // If no valid elements, create a default text widget
          const finalElements = widgetElements.length > 0 ? widgetElements : [this.applyElementStyles({
            id: this.generateElementId(),
            elType: 'widget',
            widgetType: 'text-editor',
            settings: {
              editor: element.textContent || element.innerHTML || 'Edit this text in Elementor',
              align: 'left',
              ...this.DEFAULT_TEXT_STYLING  // Add default styling for fallback widgets
            },
            elements: []
          }, element)];

          return {
            id: this.generateElementId(),
            elType: 'column',
            settings: this.buildColumnSettings(element),
            elements: finalElements
          };
          
        case 'widget':
          return this.buildWidget(element);

        default:
          return null;
      }
    };
    
    // Ensure we always have a valid structure
    const rootElement = convertElement(structure);
    
    if (!rootElement) {
      // Fallback: create a basic section with default content
      return [{
        id: this.generateElementId(),
        elType: 'section',
        settings: this.buildSectionSettings(structure),
        elements: [{
          id: this.generateElementId(),
          elType: 'column',
          settings: this.buildColumnSettings(structure),
          elements: [this.applyElementStyles({
            id: this.generateElementId(),
            elType: 'widget',
            widgetType: 'text-editor',
            settings: {
              editor: structure?.textContent || 'Edit this text in Elementor',
              align: 'left',
              ...this.DEFAULT_TEXT_STYLING  // Add default styling for fallback widgets
            },
            elements: []
          }, structure)]
        }]
      }];
    }
    
    // If the root element is not a section, wrap it in a section
    if (rootElement.elType !== 'section') {
      return [{
        id: this.generateElementId(),
        elType: 'section',
        settings: this.buildSectionSettings(structure),
        elements: [{
          id: this.generateElementId(),
          elType: 'column',
          settings: this.buildColumnSettings(structure),
          elements: [rootElement]
        }]
      }];
    }
    
    return [rootElement].filter(Boolean);
  }
  
  determineElementorElementType(element, parentType = null) {
    const { tagName, layout, children } = element;

    // PRIORITY 1: Section logic - major layout containers
    // These MUST be checked FIRST before content tags
    if (tagName === 'body' || tagName === 'section' || tagName === 'header' || tagName === 'footer' ||
        tagName === 'main' || tagName === 'article' || tagName === 'aside') {
      return 'section';
    }

    // PRIORITY 2: Column logic - containers with children or flexbox/grid layout
    // Check for structural containers BEFORE treating as widgets
    if (tagName === 'div' || tagName === 'nav') {
      // If parent is a section, this is likely a column
      if (parentType === 'section') {
        return 'column';
      }
      // Containers with children become columns
      if (children && children.length > 0) {
        // Check if children are mostly content widgets (not structural)
        const contentTagCount = children.filter(c => {
          const childTag = c.tagName || '';
          return ['p', 'span', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'button', 'input', 'textarea', 'label', 'strong', 'em', 'i', 'b', 'u', 'small', 'mark', 'del', 'ins', 'sub', 'sup', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'].includes(childTag);
        }).length;
        
        // If most children are content widgets, this is a column
        if (contentTagCount > 0 && contentTagCount >= children.length * 0.5) {
          return 'column';
        }
        
        // If it has structural children (div, section, etc.), it's a column
        const structuralChildren = children.filter(c => {
          const childTag = c.tagName || '';
          return ['div', 'section', 'header', 'footer', 'main', 'article', 'aside', 'nav'].includes(childTag);
        });
        if (structuralChildren.length > 0) {
          return 'column';
        }
      }
      // Containers with flexbox/grid layout become columns
      if (layout && (layout.display === 'flex' || layout.display === 'grid')) {
        return 'column';
      }
      // Large containers (likely layout containers) become columns
      if (layout && layout.width && parseInt(layout.width) > 200) {
        return 'column';
      }
    }

    // PRIORITY 3: Content tags - ONLY checked after section/column logic
    // These are always widgets, never structural containers
    const contentTags = ['p', 'span', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'button', 'input', 'textarea', 'label', 'strong', 'em', 'i', 'b', 'u', 'small', 'mark', 'del', 'ins', 'sub', 'sup', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li'];
    if (contentTags.includes(tagName)) {
      return 'widget';
    }

    // PRIORITY 4: Default fallback for unknown tags
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
      inlineStyledHTML: visualData.visualStructure?.inlineStyledHTML || visualData.visualStructure?.completeHTML || '',  // ENHANCED: Inline styled HTML for accurate preview
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
  async exportTemplate(ir, mode = "template", assetMapping = null) {
    console.log("🔍 ElementorConverter.exportTemplate called with mode:", mode);

    // CRITICAL FIX: Get structure from responsiveLayouts.desktop.structure, not ir.structure
    const desktopStructure = ir.responsiveLayouts?.desktop?.structure || ir.structure || null;

    const template = await this.convertVisualToElementor({
      visualStructure: {
        completeHTML: ir.html,
        structure: desktopStructure
      },
      pageInfo: ir.pageInfo || {},
      assets: ir.assets || []
    }, {}, assetMapping);

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

  // Generate unique ID for Elementor elements
  generateId() {
    return Math.random().toString(36).substr(2, 8);
  }

  // Added missing methods for proper Elementor conversion
  buildSectionSettings(element) {
    const layout = element?.layout || {};
    const hasBackground = layout.backgroundColor && layout.backgroundColor !== "rgba(0, 0, 0, 0)" && layout.backgroundColor !== "transparent";

    return {
      _element_width: "",
      _element_width_tablet: "",
      _element_width_mobile: "",
      _element_custom_width: null,
      _element_vertical_align: null,
      _background_background: hasBackground ? "classic" : "",
      _background_color: hasBackground ? layout.backgroundColor : "",
      _background_image: layout.backgroundImage && layout.backgroundImage !== "none" ? { url: layout.backgroundImage } : "",
      _border_border: "",
      _border_width: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: true },
      _border_color: "",
      _border_radius: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: true },
      _box_shadow_box_shadow_type: "",
      _margin: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: false },
      _padding: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: false }
    };
  }

  buildColumnSettings(element) {
    const layout = element?.layout || {};
    const hasBackground = layout.backgroundColor && layout.backgroundColor !== "rgba(0, 0, 0, 0)" && layout.backgroundColor !== "transparent";

    return {
      _column_size: 100,
      _inline_size: null,
      _background_background: hasBackground ? "classic" : "",
      _background_color: hasBackground ? layout.backgroundColor : "",
      _background_image: layout.backgroundImage && layout.backgroundImage !== "none" ? { url: layout.backgroundImage } : "",
      _border_border: "",
      _border_width: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: true },
      _border_color: "",
      _border_radius: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: true },
      _margin: { unit: "px", top: "", right: "", bottom: "", left: "", isLinked: false },
      _padding: { unit: "px", top: "20", right: "20", bottom: "20", left: "20", isLinked: true }
    };
  }

  buildWidget(element) {
    const baseWidget = {
      id: this.generateElementId(),
      elType: "widget",
      settings: {},
      elements: [],
      widgetType: "text"
    };

    // Handle case where element might be null or undefined
    if (!element) {
      // Ensure all required properties are present
    baseWidget.elType = "widget";
    baseWidget.widgetType = baseWidget.widgetType || "text";
    baseWidget.settings = baseWidget.settings || {};
    baseWidget.elements = [];

    return baseWidget;
    }

    // Determine widget type and settings based on element
    const tagName = element.tagName || element.tag || 'div';
    // ENHANCED: Use allTextContent first (aggressive extraction), fallback to textContent, then innerHTML
    const textContent = element.allTextContent || element.textContent || element.text || element.innerHTML || '';
    const attributes = element.attributes || {};
    
    if (tagName === 'img') {
      // CRITICAL FIX: Rewrite image URL to use downloaded asset if available
      let imageUrl = attributes.src || '';
      let assetFound = false;

      // ERROR HANDLING: Wrap asset mapping in try-catch to prevent crashes
      if (imageUrl && this.assetMapping && this.assetMapping.images && this.assetMapping.images.length > 0) {
        try {
          // Use precise matching function
          const downloadedImage = this.findMatchingAsset(imageUrl, this.assetMapping.images);

          if (downloadedImage && downloadedImage.localUrl) {
            const originalUrl = imageUrl;
            imageUrl = downloadedImage.localUrl;
            assetFound = true;
            console.log(`✅ Rewrote image URL: ${originalUrl} → ${imageUrl}`);
          } else {
            console.log(`⚠️  No matching asset found for image: ${imageUrl} (falling back to original URL)`);
          }
        } catch (assetError) {
          console.error(`❌ Asset mapping error for ${imageUrl}:`, assetError.message);
          console.log(`   Falling back to original URL`);
          // imageUrl stays as original - graceful degradation
        }
      }
      
      baseWidget.widgetType = "image";
      baseWidget.settings = {
        image: imageUrl ? { url: imageUrl, alt: attributes.alt || "" } : "",
        image_size: "full",
        align: "center"
      };
    } else if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
      baseWidget.widgetType = "heading";
      const layout = element.layout || {};
      baseWidget.settings = {
        title: textContent || "Heading",
        header_size: tagName || "h2",
        align: layout.textAlign || "left",
        ...(layout.color && layout.color !== "rgb(0, 0, 0)" && {
          title_color: layout.color
        }),
        typography_typography: "custom",
        ...(layout.fontFamily && {
          typography_font_family: layout.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
        }),
        ...(layout.fontSize && {
          typography_font_size: { size: parseInt(layout.fontSize) || 16, unit: "px" }
        }),
        ...(layout.fontWeight && {
          typography_font_weight: layout.fontWeight
        }),
        ...(layout.lineHeight && {
          typography_line_height: { size: parseFloat(layout.lineHeight) || 1.5, unit: "em" }
        })
      };
    } else if (tagName === 'a') {
      // CRITICAL FIX: Filter out navigation links using precise detection
      const href = attributes.href || '';
      const isNav = this.isNavigationLink(element);
      const isButton = this.isButtonLike(element);

      // Navigation links that aren't buttons → convert to text (no href)
      if (isNav && !isButton) {
        // Convert to text widget without link
        const layout = element.layout || {};
        baseWidget.widgetType = "text-editor";
        baseWidget.settings = {
          editor: textContent || "Text content",
          align: layout.textAlign || "left",
          ...(layout.color && layout.color !== "rgb(0, 0, 0)" && {
            text_color: layout.color
          }),
          typography_typography: "custom",
          ...(layout.fontFamily && {
            typography_font_family: layout.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
          }),
          ...(layout.fontSize && {
            typography_font_size: { size: parseInt(layout.fontSize) || 16, unit: "px" }
          }),
          ...(layout.fontWeight && {
            typography_font_weight: layout.fontWeight
          }),
          ...(layout.lineHeight && {
            typography_line_height: { size: parseFloat(layout.lineHeight) || 1.5, unit: "em" }
          })
        };
      } else {
        // Convert button-like links to buttons
        baseWidget.widgetType = "button";
        const layout = element.layout || {};
        baseWidget.settings = {
          text: textContent || "Click Here",
          link: { url: href || "#", is_external: "", nofollow: "" },
          align: layout.textAlign || "left",
          button_type: "default",
          size: "sm",
          ...(layout.backgroundColor && layout.backgroundColor !== "rgba(0, 0, 0, 0)" && {
            button_background_color: layout.backgroundColor
          }),
          ...(layout.color && {
            button_text_color: layout.color
          }),
          typography_typography: "custom",
          ...(layout.fontFamily && {
            typography_font_family: layout.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
          }),
          ...(layout.fontSize && {
            typography_font_size: { size: parseInt(layout.fontSize) || 16, unit: "px" }
          })
        };
      }
    } else {
      // Default text widget
      const layout = element.layout || {};
      baseWidget.widgetType = "text-editor";
      baseWidget.settings = {
        editor: textContent || "Text content",
        align: layout.textAlign || "left",
        ...(layout.color && layout.color !== "rgb(0, 0, 0)" && {
          text_color: layout.color
        }),
        typography_typography: "custom",
        ...(layout.fontFamily && {
          typography_font_family: layout.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
        }),
        ...(layout.fontSize && {
          typography_font_size: { size: parseInt(layout.fontSize) || 16, unit: "px" }
        }),
        ...(layout.fontWeight && {
          typography_font_weight: layout.fontWeight
        }),
        ...(layout.lineHeight && {
          typography_line_height: { size: parseFloat(layout.lineHeight) || 1.5, unit: "em" }
        })
      };
    }

    // Ensure all required properties are present
    baseWidget.elType = "widget";
    baseWidget.widgetType = baseWidget.widgetType || "text";
    baseWidget.settings = baseWidget.settings || {};
    baseWidget.elements = [];
    
    return baseWidget;
  }
}

export default ElementorConverter; 
