import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const FALLBACK_HTML = new Map();
const fallbackCandidates = [
  { hostname: 'example.com', file: 'example.com.html' },
  { hostname: 'www.example.com', file: 'example.com.html' }
];
for (const candidate of fallbackCandidates) {
  const filePath = path.resolve(ROOT_DIR, 'fixtures', candidate.file);
  if (fs.existsSync(filePath)) {
    FALLBACK_HTML.set(candidate.hostname, fs.readFileSync(filePath, 'utf8'));
  }
}

function looksLikeHtml(input) {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  return trimmed.startsWith('<') || trimmed.includes('<html');
}

function sanitizeText(text = '') {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueFilenameFromUrl(url, fallbackExtension = '.bin') {
  try {
    if (url.startsWith('data:')) {
      const match = /^data:([^;]+);/i.exec(url);
      const mime = match ? match[1] : 'application/octet-stream';
      const extFromMime = mime.split('/')[1] || 'bin';
      const digest = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12);
      return `${digest}.${extFromMime}`;
    }
    const u = new URL(url);
    const baseName = path.basename(u.pathname);
    if (baseName && baseName !== '/') {
      const cleanName = baseName.split('?')[0].split('#')[0];
      if (cleanName) return cleanName;
    }
    return `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}${fallbackExtension}`;
  } catch (_err) {
    return `${crypto.createHash('sha1').update(url).digest('hex').slice(0, 12)}${fallbackExtension}`;
  }
}

class ElementorConverter {
  constructor(options = {}) {
    this.options = options;
    this._idCounter = 0;
    this.assetRegistry = new Map();
  }

  nextId() {
    const id = (this._idCounter++).toString(36).padStart(8, '0').slice(-8);
    return id.replace(/[^a-z0-9]/g, 'a');
  }

  resolveUrl(value, baseUrl) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return new URL(trimmed).toString();
      }
      if (baseUrl) {
        return new URL(trimmed, baseUrl).toString();
      }
    } catch (_err) {
      return null;
    }
    return null;
  }

  registerImageAsset(src, alt, baseUrl) {
    const resolved = this.resolveUrl(src, baseUrl);
    if (!resolved) return null;
    if (!this.assetRegistry.has(resolved)) {
      const id = this.nextId();
      this.assetRegistry.set(resolved, {
        id,
        url: resolved,
        alt: sanitizeText(alt),
        filename: uniqueFilenameFromUrl(resolved, '.img'),
        type: 'image'
      });
    }
    return this.assetRegistry.get(resolved);
  }

  getFallbackHtml(url) {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return FALLBACK_HTML.get(hostname) || null;
    } catch (_err) {
      return null;
    }
  }

  async fetchUrl(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const headers = {
        'User-Agent': 'CloneMentorPro/1.0 (+https://clonementor.pro)',
        Accept: 'text/html,application/xhtml+xml'
      };
      const res = await fetch(url, { signal: controller.signal, headers, redirect: 'follow' });
      if (!res.ok) {
        const fallbackHtml = this.getFallbackHtml(url);
        if (fallbackHtml) {
          return { html: fallbackHtml, url, finalUrl: url, fallbackUsed: true };
        }
        const error = new Error(`Fetch failed for ${url}: HTTP ${res.status}`);
        error.status = res.status === 404 ? 404 : res.status >= 500 ? 502 : 400;
        throw error;
      }
      const html = await res.text();
      return { html, url, finalUrl: res.url || url, fallbackUsed: false };
    } catch (err) {
      const fallbackHtml = this.getFallbackHtml(url);
      if (fallbackHtml) {
        return { html: fallbackHtml, url, finalUrl: url, fallbackUsed: true };
      }
      err.status = err.status || 502;
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async toIR(input) {
    if (!input) throw new Error('No input provided to ElementorConverter.toIR');
    this._idCounter = 0;
    this.assetRegistry.clear();

    if (looksLikeHtml(input)) {
      return this.buildIR({ html: String(input), url: '', finalUrl: '', fallbackUsed: false });
    }

    let url;
    try {
      url = new URL(String(input)).toString();
    } catch (_err) {
      throw new Error(`Invalid URL: ${input}`);
    }

    const fetched = await this.fetchUrl(url);
    return this.buildIR({ ...fetched });
  }

  async buildIntermediateRepresentation(htmlOrUrl) {
    return this.toIR(htmlOrUrl);
  }

  buildIR({ html, url, finalUrl, fallbackUsed }) {
    const $ = cheerio.load(html || '');
    const title = sanitizeText($('title').first().text()) || 'Cloned Page';
    const description = sanitizeText($('meta[name="description"]').attr('content'));
    const lang = $('html').attr('lang') || 'en';
    const baseUrl = finalUrl || url || '';

    const sections = this.extractSections($, baseUrl);
    const stats = this.computeStats(sections);

    return {
      version: '1.0',
      source: {
        type: url ? 'url' : 'html',
        url: finalUrl || url || '',
        originalUrl: url || '',
        fetchedAt: new Date().toISOString(),
        fallbackUsed: Boolean(fallbackUsed)
      },
      document: {
        title,
        description,
        lang,
        sections
      },
      assets: {
        images: Array.from(this.assetRegistry.values())
      },
      styles: {
        inline: $('style').map((_, el) => $(el).html() || '').get().filter(Boolean),
        links: $('link[rel="stylesheet"]').map((_, el) => this.resolveUrl($(el).attr('href'), baseUrl)).get().filter(Boolean)
      },
      stats
    };
  }

  extractSections($, baseUrl) {
    const body = $('body');
    const candidates = body.find('section, main, header, footer, article').toArray();
    const sections = [];
    const nodesToProcess = candidates.length ? candidates : [body.get(0)].filter(Boolean);

    for (const node of nodesToProcess) {
      const section = this.normalizeSection($, node, baseUrl);
      if (section && section.columns.some(col => col.widgets.length > 0)) {
        sections.push(section);
      }
    }

    if (!sections.length) {
      const fallbackWidgets = this.extractWidgetsFromNodes($, body.contents().toArray(), baseUrl);
      if (fallbackWidgets.length) {
        sections.push({
          id: this.nextId(),
          tag: 'section',
          classes: [],
          style: '',
          columns: [
            {
              id: this.nextId(),
              width: 100,
              widgets: fallbackWidgets
            }
          ]
        });
      }
    }

    return sections;
  }

  normalizeSection($, node, baseUrl) {
    const $node = $(node);
    const tagName = (node?.name || 'section').toLowerCase();
    if (['script', 'style', 'noscript'].includes(tagName)) return null;

    const classes = ($node.attr('class') || '')
      .split(/\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    const style = $node.attr('style') || '';
    const contents = $node.contents().toArray().filter(child => {
      if (child.type === 'tag') {
        const name = child.name?.toLowerCase();
        if (!name) return false;
        if (['script', 'style', 'noscript'].includes(name)) return false;
      }
      return true;
    });

    const widgets = this.extractWidgetsFromNodes($, contents, baseUrl);

    return {
      id: this.nextId(),
      tag: tagName,
      classes,
      style,
      columns: [
        {
          id: this.nextId(),
          width: 100,
          widgets
        }
      ]
    };
  }

  extractWidgetsFromNodes($, nodes, baseUrl) {
    const widgets = [];

    for (const node of nodes) {
      if (!node) continue;
      if (node.type === 'text') {
        const text = sanitizeText(node.data);
        if (text) {
          widgets.push({
            id: this.nextId(),
            kind: 'text',
            text,
            html: `<p>${text}</p>`
          });
        }
        continue;
      }

      if (node.type !== 'tag') continue;
      const name = node.name?.toLowerCase();
      if (!name || ['script', 'style', 'noscript'].includes(name)) continue;

      const $node = $(node);

      if (name === 'img') {
        const asset = this.registerImageAsset($node.attr('src'), $node.attr('alt'), baseUrl);
        if (asset) {
          widgets.push({
            id: this.nextId(),
            kind: 'image',
            assetId: asset.id,
            src: asset.url,
            alt: asset.alt,
            caption: sanitizeText($node.attr('title') || $node.attr('data-caption'))
          });
        }
        continue;
      }

      if (/^h[1-6]$/.test(name)) {
        const text = sanitizeText($node.text());
        if (text) {
          widgets.push({
            id: this.nextId(),
            kind: 'heading',
            level: name,
            text,
            html: `<${name}>${$node.html() || text}</${name}>`
          });
        }
        continue;
      }

      if (['p', 'blockquote'].includes(name)) {
        const innerHtml = $node.html() || sanitizeText($node.text());
        const text = sanitizeText($node.text());
        if (text) {
          widgets.push({
            id: this.nextId(),
            kind: 'text',
            text,
            html: `<${name}>${innerHtml}</${name}>`
          });
        }
        continue;
      }

      if (['ul', 'ol'].includes(name)) {
        const text = sanitizeText($node.text());
        if (text) {
          widgets.push({
            id: this.nextId(),
            kind: 'text',
            text,
            html: `<${name}>${$node.html() || ''}</${name}>`
          });
        }
        continue;
      }

      if (name === 'a') {
        const text = sanitizeText($node.text());
        const href = this.resolveUrl($node.attr('href'), baseUrl) || '#';
        if (text) {
          widgets.push({
            id: this.nextId(),
            kind: 'button',
            text,
            href
          });
        }
        continue;
      }

      if (['video', 'iframe'].includes(name)) {
        const src = this.resolveUrl($node.attr('src'), baseUrl);
        if (src) {
          widgets.push({
            id: this.nextId(),
            kind: 'text',
            text: src,
            html: `<div class="embedded-media"><iframe src="${src}"></iframe></div>`
          });
        }
        continue;
      }

      const childWidgets = this.extractWidgetsFromNodes($, $node.contents().toArray(), baseUrl);
      if (childWidgets.length) {
        widgets.push(...childWidgets);
      }
    }

    return widgets;
  }

  computeStats(sections) {
    let columns = 0;
    let widgets = 0;
    const imageSet = new Set();

    for (const section of sections) {
      for (const column of section.columns) {
        columns += 1;
        for (const widget of column.widgets) {
          widgets += 1;
          if (widget.kind === 'image') {
            imageSet.add(widget.assetId || widget.src);
          }
        }
      }
    }

    return {
      sections: sections.length,
      columns,
      widgets,
      images: imageSet.size
    };
  }

  counts(ir) {
    if (!ir || !ir.document) return { sections: 0, elements: 0, images: 0 };
    const sections = ir.document.sections?.length || 0;
    const columns = ir.document.sections?.reduce((sum, section) => sum + (section.columns?.length || 0), 0) || 0;
    const widgets = ir.document.sections?.reduce(
      (sum, section) => sum + section.columns.reduce((cSum, column) => cSum + column.widgets.length, 0),
      0
    ) || 0;
    const images = new Set();
    ir.document.sections?.forEach(section => {
      section.columns.forEach(column => {
        column.widgets.forEach(widget => {
          if (widget.kind === 'image') {
            images.add(widget.assetId || widget.src);
          }
        });
      });
    });

    return {
      sections,
      elements: sections + columns + widgets,
      images: images.size
    };
  }

  sectionToElementor(section) {
    return {
      id: this.nextId(),
      elType: 'section',
      isInner: false,
      settings: {
        structure: '100',
        layout: 'boxed',
        content_width: 'boxed',
        gap: 'no',
        html_tag: section.tag || 'section'
      },
      elements: section.columns.map(column => this.columnToElementor(column))
    };
  }

  columnToElementor(column) {
    const width = typeof column.width === 'number' ? Math.max(5, Math.min(100, Math.round(column.width))) : 100;
    return {
      id: this.nextId(),
      elType: 'column',
      isInner: false,
      settings: {
        _column_size: width,
        _inline_size: null
      },
      elements: column.widgets.map(widget => this.widgetToElementor(widget))
    };
  }

  widgetToElementor(widget) {
    const base = {
      id: this.nextId(),
      elType: 'widget',
      widgetType: 'text-editor',
      settings: {},
      elements: []
    };

    switch (widget.kind) {
      case 'heading':
        base.widgetType = 'heading';
        base.settings = {
          title: widget.text,
          header_size: widget.level || 'h2',
          tag: (widget.level || 'h2').toLowerCase(),
          align: 'center'
        };
        break;
      case 'image':
        base.widgetType = 'image';
        base.settings = {
          image: {
            url: widget.src,
            id: widget.assetId || '',
            alt: widget.alt || '',
            source: widget.src?.startsWith('http') ? 'url' : 'library'
          },
          caption: widget.caption || '',
          image_size: 'full',
          align: 'center',
          link_to: 'none'
        };
        break;
      case 'button':
        base.widgetType = 'button';
        base.settings = {
          text: widget.text,
          size: 'md',
          align: 'center',
          link: {
            url: widget.href,
            is_external: /^https?:/i.test(widget.href || ''),
            nofollow: false,
            custom_attributes: ''
          }
        };
        break;
      default:
        base.widgetType = 'text-editor';
        base.settings = {
          editor: widget.html || `<p>${widget.text || ''}</p>`,
          align: 'center'
        };
        break;
    }

    return base;
  }

  buildTemplate(ir) {
    const sections = ir.document.sections.map(section => this.sectionToElementor(section));
    return {
      version: '0.4',
      title: ir.document.title || 'Cloned Page',
      type: 'page',
      content: sections,
      page_settings: {
        template: 'elementor_canvas',
        custom_css: '',
        custom_colors: [],
        custom_fonts: []
      },
      metadata: {
        created_at: new Date().toISOString(),
        source_url: ir.source.url || ir.source.originalUrl || '',
        generator: 'CloneMentorPro',
        elementor_version: '3.16.0',
        stats: ir.stats,
        fallback_used: Boolean(ir.source.fallbackUsed)
      }
    };
  }

  async exportTemplate(ir, mode = 'template') {
    if (!ir || !ir.document) {
      throw new Error('Invalid IR provided to exportTemplate');
    }

    const template = this.buildTemplate(ir);

    if (mode === 'template') {
      const bytes = Buffer.from(JSON.stringify(template, null, 2));
      return {
        bytes,
        kind: 'json',
        report: {
          mode: 'template',
          bytes: bytes.length,
          sections: ir.stats.sections,
          widgets: ir.stats.widgets
        }
      };
    }

    if (mode === 'kit') {
      return this.buildKit(template, ir);
    }

    throw new Error(`Unsupported export mode: ${mode}`);
  }

  async buildKit(template, ir) {
    const { default: AdmZip } = await import('adm-zip');
    const zip = new AdmZip();
    const clonedTemplate = JSON.parse(JSON.stringify(template));
    const assetBuffers = [];
    const assetMap = new Map();

    for (const image of ir.assets.images || []) {
      const bufferInfo = await this.downloadAsset(image);
      const fileName = image.filename || uniqueFilenameFromUrl(image.url, '.img');
      assetBuffers.push({ name: fileName, buffer: bufferInfo.buffer, bytes: bufferInfo.buffer.length });
      assetMap.set(image.id, fileName);
    }

    const rewriteImageUrls = widget => {
      if (widget.widgetType === 'image' && widget.settings?.image) {
        const assetKey = widget.settings.image.id || null;
        const mapped = assetMap.get(assetKey);
        if (mapped) {
          widget.settings.image.url = `assets/${mapped}`;
          widget.settings.image.source = 'library';
          widget.settings.image.path = `assets/${mapped}`;
        }
      }
      (widget.elements || []).forEach(rewriteImageUrls);
    };

    clonedTemplate.content.forEach(section => {
      section.elements.forEach(column => {
        column.elements.forEach(rewriteImageUrls);
      });
    });

    const templateBytes = Buffer.from(JSON.stringify(clonedTemplate, null, 2));
    zip.addFile('template.json', templateBytes);

    let totalAssetBytes = 0;
    assetBuffers.forEach(asset => {
      totalAssetBytes += asset.bytes;
      zip.addFile(path.join('assets', asset.name), asset.buffer);
    });

    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceUrl: ir.source.url || '',
      assetCount: assetBuffers.length,
      assetBytes: totalAssetBytes,
      stats: ir.stats
    };
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

    const zipBuffer = zip.toBuffer();
    if (totalAssetBytes > 0) {
      const minimum = Math.floor(totalAssetBytes * 0.9);
      if (zipBuffer.length < minimum) {
        const err = new Error(`Kit ZIP too small (${zipBuffer.length} bytes) for ${totalAssetBytes} bytes of assets`);
        err.code = 'KIT_SIZE_MISMATCH';
        throw err;
      }
    }

    return {
      bytes: zipBuffer,
      kind: 'zip',
      report: {
        mode: 'kit',
        bytes: zipBuffer.length,
        assets: assetBuffers.length,
        assetBytes: totalAssetBytes
      }
    };
  }

  async downloadAsset(asset) {
    if (!asset || !asset.url) {
      throw new Error('Invalid asset descriptor');
    }

    if (asset.url.startsWith('data:')) {
      const match = /^data:([^;]+);base64,(.+)$/i.exec(asset.url);
      if (!match) {
        throw new Error('Unsupported data URI format');
      }
      const buffer = Buffer.from(match[2], 'base64');
      return { buffer, mime: match[1] };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const res = await fetch(asset.url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'CloneMentorPro/1.0 (+https://clonementor.pro)',
          Accept: 'image/*,*/*;q=0.8'
        }
      });
      if (!res.ok) {
        throw new Error(`Failed to download asset ${asset.url}: HTTP ${res.status}`);
      }
      const arrayBuffer = await res.arrayBuffer();
      return { buffer: Buffer.from(arrayBuffer), mime: res.headers.get('content-type') || 'application/octet-stream' };
    } catch (err) {
      err.code = err.code || 'ASSET_DOWNLOAD_FAILED';
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async convertVisualToElementor(input) {
    const ir = await this.toIR(input);
    return this.buildTemplate(ir);
  }
}

export default ElementorConverter;
