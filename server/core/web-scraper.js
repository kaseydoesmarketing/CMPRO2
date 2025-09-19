import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

class WebScraper {
  constructor() {
    this.browser = null;
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ],
        executablePath: process.env.CHROMIUM_PATH || undefined
      });
    }
  }

  async scrapeWebpage(url, progressCallback) {
    await this.initialize();
    
    const page = await this.browser.newPage();
    
    try {
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 });
      
      // Progress: Starting
      progressCallback?.({ phase: 'initializing', progress: 5 });
      
      // Navigate to URL
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Progress: Page loaded
      progressCallback?.({ phase: 'page_loaded', progress: 20 });
      
      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Progress: Extracting HTML
      progressCallback?.({ phase: 'extracting_html', progress: 30 });
      
      // Get page title
      const title = await page.title();
      
      // Extract HTML
      const html = await page.content();
      
      // Progress: Extracting styles
      progressCallback?.({ phase: 'extracting_styles', progress: 40 });
      
      // Extract all CSS
      const css = await this.extractAllCSS(page);
      
      // Progress: Extracting images
      progressCallback?.({ phase: 'extracting_images', progress: 50 });
      
      // Extract images
      const images = await this.extractImages(page);
      
      // Progress: Extracting fonts
      progressCallback?.({ phase: 'extracting_fonts', progress: 60 });
      
      // Extract fonts
      const fonts = await this.extractFonts(page);
      
      // Progress: Analyzing structure
      progressCallback?.({ phase: 'analyzing_structure', progress: 70 });
      
      // Get viewport dimensions
      const dimensions = await page.evaluate(() => {
        return {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight
        };
      });
      
      // Progress: Processing elements
      progressCallback?.({ phase: 'processing_elements', progress: 80 });
      
      // Clean and process HTML
      const cleanedHtml = this.cleanHTML(html);
      
      // Progress: Finalizing
      progressCallback?.({ phase: 'finalizing', progress: 90 });
      
      await page.close();
      
      return {
        url,
        title,
        html: cleanedHtml,
        css,
        images,
        fonts,
        dimensions,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async extractAllCSS(page) {
    const css = await page.evaluate(() => {
      let allCSS = '';
      
      // Get inline styles
      const inlineStyles = document.querySelectorAll('style');
      inlineStyles.forEach(style => {
        allCSS += style.textContent + '\n';
      });
      
      // Get external stylesheets
      const styleSheets = Array.from(document.styleSheets);
      styleSheets.forEach(sheet => {
        try {
          if (sheet.cssRules) {
            const rules = Array.from(sheet.cssRules);
            rules.forEach(rule => {
              allCSS += rule.cssText + '\n';
            });
          }
        } catch (e) {
          // Cross-origin stylesheets will throw error
          console.log('Could not access stylesheet:', sheet.href);
        }
      });
      
      // Get computed styles for important elements
      const importantElements = document.querySelectorAll('header, nav, main, section, article, footer, h1, h2, h3, h4, h5, h6, p, a, button, img, form, input, textarea');
      const computedStyles = new Map();
      
      importantElements.forEach(element => {
        const styles = window.getComputedStyle(element);
        const selector = element.tagName.toLowerCase() + 
                        (element.id ? `#${element.id}` : '') + 
                        (element.className ? `.${element.className.split(' ').join('.')}` : '');
        
        if (!computedStyles.has(selector)) {
          let cssText = `${selector} {\n`;
          
          // Key properties to extract
          const properties = [
            'display', 'position', 'width', 'height', 'margin', 'padding',
            'background', 'background-color', 'background-image',
            'color', 'font-family', 'font-size', 'font-weight', 'line-height',
            'text-align', 'border', 'border-radius', 'box-shadow',
            'flex', 'flex-direction', 'justify-content', 'align-items',
            'grid-template-columns', 'grid-template-rows', 'gap'
          ];
          
          properties.forEach(prop => {
            const value = styles.getPropertyValue(prop);
            if (value && value !== 'initial' && value !== 'none' && value !== 'normal') {
              cssText += `  ${prop}: ${value};\n`;
            }
          });
          
          cssText += '}\n';
          computedStyles.set(selector, cssText);
        }
      });
      
      computedStyles.forEach(value => {
        allCSS += value + '\n';
      });
      
      return allCSS;
    });
    
    return css;
  }

  async extractImages(page) {
    const images = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.map(img => ({
        src: img.src,
        alt: img.alt,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        loading: img.loading
      }));
    });
    
    // Also extract background images
    const bgImages = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const backgrounds = [];
      
      elements.forEach(element => {
        const bg = window.getComputedStyle(element).backgroundImage;
        if (bg && bg !== 'none') {
          const matches = bg.match(/url\(['"]?(.*?)['"]?\)/);
          if (matches && matches[1]) {
            backgrounds.push({
              url: matches[1],
              selector: element.tagName.toLowerCase() + 
                       (element.id ? `#${element.id}` : '') + 
                       (element.className ? `.${element.className.split(' ')[0]}` : '')
            });
          }
        }
      });
      
      return backgrounds;
    });
    
    return { images, backgroundImages: bgImages };
  }

  async extractFonts(page) {
    const fonts = await page.evaluate(() => {
      const fontFaces = [];
      
      // Get @font-face rules
      Array.from(document.styleSheets).forEach(sheet => {
        try {
          Array.from(sheet.cssRules).forEach(rule => {
            if (rule.type === CSSRule.FONT_FACE_RULE) {
              fontFaces.push({
                family: rule.style.fontFamily,
                src: rule.style.src,
                weight: rule.style.fontWeight || '400',
                style: rule.style.fontStyle || 'normal'
              });
            }
          });
        } catch (e) {
          // Ignore cross-origin errors
        }
      });
      
      // Get used font families
      const usedFonts = new Set();
      document.querySelectorAll('*').forEach(element => {
        const fontFamily = window.getComputedStyle(element).fontFamily;
        if (fontFamily) {
          fontFamily.split(',').forEach(font => {
            usedFonts.add(font.trim().replace(/['"]/g, ''));
          });
        }
      });
      
      return {
        fontFaces,
        usedFonts: Array.from(usedFonts)
      };
    });
    
    return fonts;
  }

  cleanHTML(html) {
    const $ = cheerio.load(html);
    
    // Remove scripts and unnecessary elements
    $('script').remove();
    $('noscript').remove();
    $('link[rel="stylesheet"]').remove();
    $('meta').remove();
    $('style').remove();
    
    // Remove tracking and analytics
    $('[id*="google"]').remove();
    $('[id*="facebook"]').remove();
    $('[id*="analytics"]').remove();
    $('[class*="tracking"]').remove();
    
    // Clean attributes
    $('*').each((i, elem) => {
      const $elem = $(elem);
      
      // Remove data attributes except useful ones
      const attrs = elem.attribs;
      for (let attr in attrs) {
        if (attr.startsWith('data-') && 
            !attr.includes('data-id') && 
            !attr.includes('data-element')) {
          $elem.removeAttr(attr);
        }
        
        // Remove event handlers
        if (attr.startsWith('on')) {
          $elem.removeAttr(attr);
        }
      }
    });
    
    return $('body').html() || '';
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

export default WebScraper;