import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

class VisualWebScraper {
  constructor() {
    this.browser = null;
    this.breakpoints = {
      mobile: 375,
      tablet: 768,
      desktop: 1200
    };
  }

  async initialize() {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('Browser not connected or not initialized - launching new instance');
      if (this.browser) {
        await this.browser.close().catch(() => {}); // Force close if stuck
      }
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-web-security',
          '--allow-running-insecure-content'
        ],
        executablePath: process.env.CHROMIUM_PATH || undefined,
        protocolTimeout: 120000
      });
    }
  }

  async scrapeVisualLayout(url, progressCallback) {
    await this.initialize();
    const page = await this.browser.newPage();
    page.setDefaultNavigationTimeout(90000);
    page.setDefaultTimeout(90000);
    
    try {
      // Progress tracking: 0-20% Initial setup and page load
      progressCallback?.({ phase: 'connecting', progress: 2 });
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1200, height: 800 });
      
      progressCallback?.({ phase: 'loading_page', progress: 8 });
      
      // Navigate and wait for page to fully load (with one retry)
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(url, { 
            waitUntil: ['networkidle0', 'domcontentloaded'],
            timeout: 60000 
          });
          lastError = null;
          break;
        } catch (e) {
          lastError = e;
          if (attempt === 2) throw e;
          await new Promise(r => setTimeout(r, 1000));
        }
      }
      
      progressCallback?.({ phase: 'page_loaded', progress: 15 });
      
      // Wait for any dynamic content and lazy loading
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Scroll to trigger lazy loading and ensure all content is visible
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;
            
            if(totalHeight >= scrollHeight) {
              clearInterval(timer);
              // Scroll back to top
              window.scrollTo(0, 0);
              setTimeout(resolve, 1000);
            }
          }, 100);
        });
      });
      
      // Progress tracking: 20-40% Element discovery and mapping
      progressCallback?.({ phase: 'analyzing_layout', progress: 22 });
      
      // Get page info
      const pageInfo = await this.extractPageInfo(page);
      
      progressCallback?.({ phase: 'capturing_visual_structure', progress: 28 });
      
      // Capture visual structure for each breakpoint (28-35% for responsive layouts)
      const responsiveLayouts = {};
      const deviceTypes = Object.entries(this.breakpoints);
      
      for (let i = 0; i < deviceTypes.length; i++) {
        const [deviceType, width] = deviceTypes[i];
        const progressIncrement = Math.floor(7 / deviceTypes.length); // 7% total for responsive
        progressCallback?.({ phase: `capturing_${deviceType}`, progress: 28 + (i * progressIncrement) });
        responsiveLayouts[deviceType] = await this.captureLayoutAtBreakpoint(page, width);
      }
      
      // Progress tracking: 40-70% Content and asset capture
      progressCallback?.({ phase: 'extracting_assets', progress: 42 });
      
      // Extract all visual assets
      const assets = await this.extractVisualAssets(page);
      
      progressCallback?.({ phase: 'processing_assets', progress: 58 });
      
      // Progress tracking: 70-90% Template structure generation
      progressCallback?.({ phase: 'building_structure_map', progress: 72 });
      
      // Build complete visual structure map
      const visualStructure = await this.buildVisualStructureMap(page, responsiveLayouts);
      
      // Progress tracking: 90-95% Final validation and completion
      progressCallback?.({ phase: 'validating_structure', progress: 88 });
      
      await page.close();
      
      progressCallback?.({ phase: 'scraping_complete', progress: 95 }); // Never exceed 95% here
      
      return {
        url,
        pageInfo,
        visualStructure,
        responsiveLayouts,
        assets,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      await page.close().catch(() => {});
      const err = new Error(`Scrape failed: ${error.message}. Hint: If this persists, set CHROMIUM_PATH or increase timeouts.`);
      err.cause = error;
      throw err;
    }
  }

  async extractPageInfo(page) {
    return await page.evaluate(() => {
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.content || '',
        favicon: document.querySelector('link[rel="icon"]')?.href || 
                document.querySelector('link[rel="shortcut icon"]')?.href || null,
        charset: document.charset,
        lang: document.documentElement.lang,
        viewport: document.querySelector('meta[name="viewport"]')?.content || ''
      };
    });
  }

  async captureLayoutAtBreakpoint(page, width) {
    // Set viewport for this breakpoint
    await page.setViewport({ width, height: 800 });
    await new Promise(resolve => setTimeout(resolve, 500)); // Let layout settle
    
    // Capture the actual HTML content and styles
    const result = await page.evaluate(() => {
      // Get all stylesheets and their rules
      const getAllStyles = () => {
        let allStyles = '';
        try {
          // Get inline styles
          const styleElements = document.querySelectorAll('style');
          styleElements.forEach(style => {
            if (style.textContent) {
              allStyles += style.textContent + '\n';
            }
          });
          
          // Get external stylesheets
          const stylesheets = Array.from(document.styleSheets);
          stylesheets.forEach(sheet => {
            try {
              const rules = Array.from(sheet.cssRules || sheet.rules || []);
              rules.forEach(rule => {
                allStyles += rule.cssText + '\n';
              });
            } catch (e) {
              // Cross-origin stylesheets might not be accessible
              console.warn('Could not access stylesheet:', e);
            }
          });
        } catch (e) {
          console.warn('Error collecting styles:', e);
        }
        return allStyles;
      };

      const getComputedLayout = (element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        
        return {
          // Position and dimensions
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          
          // Layout properties
          position: style.position,
          display: style.display,
          flexDirection: style.flexDirection,
          flexWrap: style.flexWrap,
          justifyContent: style.justifyContent,
          alignItems: style.alignItems,
          gridTemplateColumns: style.gridTemplateColumns,
          gridTemplateRows: style.gridTemplateRows,
          
          // Spacing
          margin: {
            top: style.marginTop,
            right: style.marginRight,
            bottom: style.marginBottom,
            left: style.marginLeft
          },
          padding: {
            top: style.paddingTop,
            right: style.paddingRight,
            bottom: style.paddingBottom,
            left: style.paddingLeft
          },
          
          // Visual properties
          backgroundColor: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          backgroundSize: style.backgroundSize,
          backgroundPosition: style.backgroundPosition,
          backgroundRepeat: style.backgroundRepeat,
          borderRadius: style.borderRadius,
          boxShadow: style.boxShadow,
          border: style.border,
          
          // Typography
          fontSize: style.fontSize,
          fontFamily: style.fontFamily,
          fontWeight: style.fontWeight,
          fontStyle: style.fontStyle,
          lineHeight: style.lineHeight,
          textAlign: style.textAlign,
          textDecoration: style.textDecoration,
          textTransform: style.textTransform,
          letterSpacing: style.letterSpacing,
          wordSpacing: style.wordSpacing,
          color: style.color,
          
          // Visibility and overflow
          visibility: style.visibility,
          opacity: style.opacity,
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          zIndex: style.zIndex,
          
          // Transform and animation properties
          transform: style.transform,
          transformOrigin: style.transformOrigin,
          transition: style.transition,
          animation: style.animation,
          
          // Additional layout properties
          float: style.float,
          clear: style.clear,
          verticalAlign: style.verticalAlign,
          whiteSpace: style.whiteSpace,
          wordBreak: style.wordBreak,
          cursor: style.cursor,
          
          // Grid properties
          gridArea: style.gridArea,
          gridColumn: style.gridColumn,
          gridRow: style.gridRow,
          
          // Flex properties
          flex: style.flex,
          flexBasis: style.flexBasis,
          flexGrow: style.flexGrow,
          flexShrink: style.flexShrink,
          alignSelf: style.alignSelf,
          order: style.order
        };
      };

      const mapElement = (element, depth = 0) => {
        if (depth > 25) return null; // Increased depth for more comprehensive capture
        
        const tagName = element.tagName?.toLowerCase();
        if (!tagName || ['script', 'style', 'meta', 'link', 'title', 'head'].includes(tagName)) {
          return null;
        }
        
        const layout = getComputedLayout(element);
        const children = [];
        
        // Capture direct text content (not just for leaf nodes)
        let directTextContent = '';
        for (let node of element.childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            directTextContent += node.textContent || '';
          }
        }
        directTextContent = directTextContent.trim();
        
        // Get innerHTML for elements that might contain rich content
        let innerHTML = '';
        const richContentTags = [
          'p', 'div', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th', 
          'blockquote', 'article', 'section', 'header', 'footer', 'main', 'nav',
          'aside', 'figure', 'figcaption', 'form', 'button', 'a', 'strong', 'em',
          'ul', 'ol', 'dl', 'dt', 'dd', 'table', 'tbody', 'thead', 'tr'
        ];
        if (richContentTags.includes(tagName)) {
          innerHTML = element.innerHTML;
        }
        
        // Process visible elements and important structural elements even if not visible
        const isImportantStructural = ['body', 'html', 'head', 'form', 'table', 'thead', 'tbody', 'tr'].includes(tagName);
        const isVisible = layout.width > 0 && layout.height > 0 && layout.visibility !== 'hidden' && layout.display !== 'none';
        const shouldProcess = isVisible || isImportantStructural || innerHTML.trim().length > 0 || directTextContent.length > 0;
        
        if (shouldProcess) {
          for (const child of element.children) {
            const childMap = mapElement(child, depth + 1);
            if (childMap) {
              children.push(childMap);
            }
          }
          
          return {
            tagName,
            className: element.className,
            id: element.id,
            textContent: directTextContent,
            innerHTML: innerHTML,
            outerHTML: element.outerHTML, // Capture complete HTML
            attributes: {
              src: element.src,
              href: element.href,
              alt: element.alt,
              title: element.title,
              name: element.name,
              type: element.type,
              value: element.value,
              placeholder: element.placeholder,
              role: element.getAttribute('role'),
              'aria-label': element.getAttribute('aria-label'),
              'data-*': Array.from(element.attributes)
                .filter(attr => attr.name.startsWith('data-'))
                .reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {}),
              // Capture all other attributes for comprehensive recreation
              allAttributes: Array.from(element.attributes)
                .reduce((acc, attr) => {
                  acc[attr.name] = attr.value;
                  return acc;
                }, {})
            },
            layout,
            children,
            depth
          };
        }
        
        return null;
      };

      // Capture the complete structure
      const structure = mapElement(document.body);
      const allStyles = getAllStyles();
      
      // Also capture the complete page HTML as fallback
      const completeHTML = document.documentElement.outerHTML;
      
      return {
        structure,
        styles: allStyles,
        completeHTML: completeHTML,
        documentTitle: document.title,
        documentURL: window.location.href
      };
    });
    
    return result;
  }

  async extractVisualAssets(page) {
    return await page.evaluate(() => {
      const assets = {
        images: [],
        fonts: new Set(),
        colors: new Set(),
        gradients: [],
        videos: [],
        forms: [],
        buttons: [],
        links: [],
        stylesheets: [],
        scripts: []
      };

      // Extract images (including lazy loaded and data-src)
      document.querySelectorAll('img, [data-src], [data-lazy-src]').forEach(img => {
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (src && src !== '') {
          const rect = img.getBoundingClientRect();
          assets.images.push({
            src: src,
            alt: img.alt || '',
            title: img.title || '',
            width: rect.width || img.offsetWidth,
            height: rect.height || img.offsetHeight,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            className: img.className,
            id: img.id,
            loading: img.loading,
            srcset: img.srcset,
            sizes: img.sizes
          });
        }
      });

      // Extract background images
      document.querySelectorAll('*').forEach(el => {
        const style = window.getComputedStyle(el);
        if (style.backgroundImage && style.backgroundImage !== 'none') {
          const match = style.backgroundImage.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (match) {
            assets.images.push({
              src: match[1],
              type: 'background',
              width: el.offsetWidth,
              height: el.offsetHeight
            });
          }
        }
        
        // Extract fonts
        if (style.fontFamily) {
          style.fontFamily.split(',').forEach(font => {
            assets.fonts.add(font.trim().replace(/['"]/g, ''));
          });
        }
        
        // Extract colors
        if (style.color && style.color !== 'rgba(0, 0, 0, 0)') {
          assets.colors.add(style.color);
        }
        if (style.backgroundColor && style.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          assets.colors.add(style.backgroundColor);
        }
        
        // Extract gradients
        if (style.backgroundImage && style.backgroundImage.includes('gradient')) {
          assets.gradients.push(style.backgroundImage);
        }
      });

      // Extract videos
      document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').forEach(video => {
        assets.videos.push({
          src: video.src || video.getAttribute('data-src'),
          type: video.tagName.toLowerCase(),
          width: video.offsetWidth,
          height: video.offsetHeight,
          autoplay: video.autoplay,
          controls: video.controls,
          poster: video.poster
        });
      });
      
      // Extract forms and inputs
      document.querySelectorAll('form').forEach(form => {
        const inputs = Array.from(form.querySelectorAll('input, textarea, select, button')).map(input => ({
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          value: input.value,
          required: input.required,
          className: input.className,
          id: input.id
        }));
        
        assets.forms.push({
          action: form.action,
          method: form.method,
          className: form.className,
          id: form.id,
          inputs: inputs
        });
      });
      
      // Extract buttons
      document.querySelectorAll('button, input[type="button"], input[type="submit"], .btn, [role="button"]').forEach(button => {
        assets.buttons.push({
          text: button.textContent?.trim() || button.value,
          type: button.type,
          className: button.className,
          id: button.id,
          onclick: button.onclick ? button.onclick.toString() : null,
          href: button.href
        });
      });
      
      // Extract links
      document.querySelectorAll('a[href]').forEach(link => {
        assets.links.push({
          href: link.href,
          text: link.textContent?.trim(),
          title: link.title,
          target: link.target,
          className: link.className,
          id: link.id
        });
      });
      
      // Extract stylesheets
      document.querySelectorAll('link[rel="stylesheet"], style').forEach(style => {
        if (style.tagName === 'LINK') {
          assets.stylesheets.push({
            href: style.href,
            media: style.media,
            type: 'external'
          });
        } else {
          assets.stylesheets.push({
            content: style.textContent,
            type: 'internal'
          });
        }
      });
      
      // Extract scripts
      document.querySelectorAll('script[src]').forEach(script => {
        assets.scripts.push({
          src: script.src,
          async: script.async,
          defer: script.defer,
          type: script.type
        });
      });
      
      return {
        images: assets.images,
        fonts: Array.from(assets.fonts),
        colors: Array.from(assets.colors),
        gradients: assets.gradients,
        videos: assets.videos,
        forms: assets.forms,
        buttons: assets.buttons,
        links: assets.links,
        stylesheets: assets.stylesheets,
        scripts: assets.scripts
      };
    });
  }

  async buildVisualStructureMap(page, responsiveLayouts) {
    // Analyze the responsive layouts to build a unified structure map
    const desktopLayout = responsiveLayouts.desktop;
    
    // Use the structure from the new enhanced capture
    const structure = desktopLayout.structure;
    
    if (!structure) {
      // Fallback to complete HTML if structure is not available
      return {
        completeHTML: desktopLayout.completeHTML,
        styles: desktopLayout.styles,
        fallbackMode: true
      };
    }
    
    const buildElementorStructure = (element, parentType = 'body') => {
      if (!element) return null;
      
      const { layout, tagName, children, textContent, innerHTML, attributes } = element;
      
      // Determine if this should be a section, column, or widget
      const elementType = this.determineElementorType(element, parentType);
      
      switch (elementType) {
        case 'section':
          return {
            elType: 'section',
            settings: this.buildSectionSettings(element),
            elements: children.map(child => buildElementorStructure(child, 'section')).filter(Boolean)
          };
          
        case 'column':
          return {
            elType: 'column',
            settings: this.buildColumnSettings(element),
            elements: children.map(child => buildElementorStructure(child, 'column')).filter(Boolean)
          };
          
        case 'widget':
          return this.buildWidget(element);
          
        default:
          return null;
      }
    };
    
    const elementorStructure = buildElementorStructure(structure);
    
    // Include the complete HTML and styles for pixel-perfect rendering
    return {
      elementorStructure,
      completeHTML: desktopLayout.completeHTML,
      styles: desktopLayout.styles,
      structure: structure
    };
  }

  determineElementorType(element, parentType) {
    const { layout, tagName, children } = element;
    
    // Section logic - containers that group content
    if (parentType === 'body' || 
        tagName === 'section' || 
        tagName === 'header' || 
        tagName === 'footer' || 
        tagName === 'main' ||
        (layout.display === 'flex' && layout.flexDirection === 'column') ||
        (layout.width >= 300 && children.length > 0)) {
      return 'section';
    }
    
    // Column logic - layout columns within sections
    if (parentType === 'section' && 
        (layout.display === 'flex' || 
         layout.display === 'block' || 
         layout.display === 'inline-block') &&
        children.length > 0) {
      return 'column';
    }
    
    // Widget logic - actual content elements
    return 'widget';
  }

  buildSectionSettings(element) {
    const { layout } = element;
    
    return {
      background_background: layout.backgroundColor !== 'rgba(0, 0, 0, 0)' ? 'classic' : '',
      background_color: layout.backgroundColor !== 'rgba(0, 0, 0, 0)' ? layout.backgroundColor : '',
      background_image: layout.backgroundImage !== 'none' ? { url: layout.backgroundImage } : '',
      padding: {
        top: parseInt(layout.padding.top) || 0,
        right: parseInt(layout.padding.right) || 0,
        bottom: parseInt(layout.padding.bottom) || 0,
        left: parseInt(layout.padding.left) || 0,
        unit: 'px'
      },
      margin: {
        top: parseInt(layout.margin.top) || 0,
        right: parseInt(layout.margin.right) || 0,
        bottom: parseInt(layout.margin.bottom) || 0,
        left: parseInt(layout.margin.left) || 0,
        unit: 'px'
      }
    };
  }

  buildColumnSettings(element) {
    const { layout } = element;
    
    return {
      _column_size: 100, // Will be calculated based on flex or grid
      background_background: layout.backgroundColor !== 'rgba(0, 0, 0, 0)' ? 'classic' : '',
      background_color: layout.backgroundColor !== 'rgba(0, 0, 0, 0)' ? layout.backgroundColor : '',
      padding: {
        top: parseInt(layout.padding.top) || 0,
        right: parseInt(layout.padding.right) || 0,
        bottom: parseInt(layout.padding.bottom) || 0,
        left: parseInt(layout.padding.left) || 0,
        unit: 'px'
      }
    };
  }

  buildWidget(element) {
    const { tagName, textContent, innerHTML, attributes, layout } = element;
    
    const baseWidget = {
      elType: 'widget',
      settings: {
        _element_id: this.generateElementId()
      }
    };

    // Use innerHTML for rich content, fallback to textContent
    const content = innerHTML || textContent || '';

    // Determine widget type and settings
    switch (tagName) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        return {
          ...baseWidget,
          widgetType: 'heading',
          settings: {
            ...baseWidget.settings,
            title: content,
            header_size: tagName,
            color: layout.color,
            typography_font_family: layout.fontFamily,
            typography_font_size: { size: parseInt(layout.fontSize), unit: 'px' },
            typography_font_weight: layout.fontWeight,
            align: layout.textAlign
          }
        };
        
      case 'img':
        return {
          ...baseWidget,
          widgetType: 'image',
          settings: {
            ...baseWidget.settings,
            image: { url: attributes.src },
            image_size: 'full',
            caption: attributes.alt || '',
            width: { size: layout.width, unit: 'px' },
            height: { size: layout.height, unit: 'px' }
          }
        };
        
      case 'a':
        return {
          ...baseWidget,
          widgetType: 'button',
          settings: {
            ...baseWidget.settings,
            text: content,
            link: { url: attributes.href, is_external: true },
            background_color: layout.backgroundColor,
            text_color: layout.color,
            border_radius: { size: parseInt(layout.borderRadius), unit: 'px' },
            padding: {
              top: parseInt(layout.padding.top) || 0,
              right: parseInt(layout.padding.right) || 0,
              bottom: parseInt(layout.padding.bottom) || 0,
              left: parseInt(layout.padding.left) || 0,
              unit: 'px'
            }
          }
        };
        
      default:
        return {
          ...baseWidget,
          widgetType: 'html',
          settings: {
            ...baseWidget.settings,
            html: innerHTML || `<${tagName} style="color: ${layout.color}; font-family: ${layout.fontFamily}; font-size: ${layout.fontSize}; text-align: ${layout.textAlign};">${textContent || ''}</${tagName}>`,
            text_color: layout.color,
            typography_font_family: layout.fontFamily,
            typography_font_size: { size: parseInt(layout.fontSize), unit: 'px' }
          }
        };
    }
  }

  generateElementId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default VisualWebScraper;