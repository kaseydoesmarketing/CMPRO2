import express from 'express';
import path from 'path';
import fs from 'fs';
import { makeElementorConverter } from '../core/converters/index.js';
import { validateElementorTemplate, getValidationErrors } from '../core/schemas/elementor-schema.js';

const router = express.Router();

router.get('/progress/:sessionId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  const intervalId = setInterval(() => { res.write(':\n\n'); }, 30000);
  req.on('close', () => { clearInterval(intervalId); });
});

router.post('/scan', async (req, res, next) => {
  try {
    const url = String(req.body?.url || "");
    const html = String(req.body?.html || "");
    const conv = makeElementorConverter();
    const source = html || url;
    if (!source) throw new Error("Provide 'url' or 'html'");

    // Build IR (includes visual scraping)
    const ir = typeof conv.toIR === 'function' ? await conv.toIR(source) : await conv.buildIntermediateRepresentation(source);
    const counts = conv.counts ? await conv.counts(ir) : { sections: 0, elements: 0, images: 0 };

    // ENHANCED: Download and manage assets
    let assetSession = null;
    let downloadedAssets = null;
    let rewrittenContent = null;

    const assetManager = req.app.locals.assetManager;

    if (assetManager && url) {
      try {
        console.log('🚀 Processing assets with Asset Manager...');

        // Process webpage assets (create session, download, rewrite URLs)
        const assetResult = await assetManager.processWebpage(ir, url);

        assetSession = assetResult.sessionId;
        downloadedAssets = assetResult.assets;
        rewrittenContent = assetResult.rewrittenContent;

        console.log(`✅ Assets processed: Session ${assetSession}`);
      } catch (assetError) {
        console.warn('⚠️  Asset processing failed, continuing without assets:', assetError.message);
      }
    }

    // Build metadata for frontend
    const metadata = {
      isValidElementor: true,
      elementsCount: counts.elements || 0,
      sectionsCount: counts.sections || 0,
      imagesCount: counts.images || 0,
      fileSize: JSON.stringify(ir).length,
      validationErrors: 0,
      assetSession: assetSession,
      assetsDownloaded: downloadedAssets ? downloadedAssets.summary : null
    };

    // Extract HTML and styles from IR for preview
    // ENHANCED: Use rewritten content if assets were downloaded
    const previewHTML = rewrittenContent?.html ||
                        ir?.inlineStyledHTML ||
                        ir?.html ||
                        ir?.responsiveLayouts?.desktop?.completeHTML ||
                        '';
    const previewStyles = rewrittenContent?.css ||
                          ir?.styles ||
                          ir?.responsiveLayouts?.desktop?.styles ||
                          '';

    res.json({
      success: true,
      ok: true,
      converter: conv.constructor.name,
      irPresent: !!ir,
      counts,
      template: ir,
      metadata,
      html: previewHTML,
      styles: previewStyles,
      visualStructure: ir?.visualStructure || {},
      assets: ir?.assets || {},
      pageInfo: ir?.pageInfo || {},
      assetSession: assetSession,
      downloadedAssets: downloadedAssets,
      // CRITICAL: Include assetUrls for frontend to pass to download endpoint
      assetUrls: downloadedAssets ? {
        images: downloadedAssets.images?.map(img => ({
          original: img.originalUrl,
          local: `/api/assets/${assetSession}/images/${img.filename}`,
          filename: img.filename
        })) || [],
        fonts: downloadedAssets.fonts?.map(font => ({
          original: font.originalUrl,
          local: `/api/assets/${assetSession}/fonts/${font.filename}`,
          filename: font.filename
        })) || [],
        css: downloadedAssets.css?.map(css => ({
          original: css.originalUrl,
          local: `/api/assets/${assetSession}/css/${css.filename}`,
          filename: css.filename
        })) || []
      } : null
    });
  } catch (e) { next(e); }
});

router.post('/download', async (req, res, next) => {
  try {
    const { mode = 'template', url = '', html = '', template, assetSession, assetUrls } = req.body || {};
    const conv = makeElementorConverter();

    // If template is provided directly, use it; otherwise re-scan from url/html
    let ir;
    if (template) {
      ir = template;
    } else {
      const source = html || url;
      if (!source) throw new Error("Provide 'template', 'url', or 'html'");
      ir = typeof conv.toIR === 'function' ? await conv.toIR(source) : await conv.buildIntermediateRepresentation(source);
    }

    // CRITICAL FIX: Build asset mapping from assetUrls if provided
    let assetMapping = null;
    if (assetSession && assetUrls) {
      // Convert assetUrls format to mapping format expected by converter
      assetMapping = {
        sessionId: assetSession,
        images: (assetUrls.images || []).map(img => ({
          originalUrl: img.original,
          absoluteUrl: img.original,
          localUrl: img.local || `/api/assets/${assetSession}/images/${img.filename || ''}`
        })),
        fonts: (assetUrls.fonts || []).map(font => ({
          originalUrl: font.original,
          localUrl: font.local || `/api/assets/${assetSession}/fonts/${font.filename || ''}`
        })),
        css: (assetUrls.css || []).map(css => ({
          originalUrl: css.original,
          localUrl: css.local || `/api/assets/${assetSession}/css/${css.filename || ''}`
        }))
      };
      console.log(`✅ Using asset mapping for session ${assetSession}: ${assetMapping.images.length} images`);
    } else if (assetSession) {
      // Try to get asset info from asset manager if available
      const assetManager = req.app.locals.assetManager;
      if (assetManager) {
        try {
          const sessionInfo = await assetManager.getSession(assetSession);
          if (sessionInfo && sessionInfo.assets) {
            assetMapping = {
              sessionId: assetSession,
              images: (sessionInfo.assets.images || []).map(img => ({
                originalUrl: img.originalUrl,
                absoluteUrl: img.absoluteUrl,
                localUrl: `/api/assets/${assetSession}/images/${img.filename}`
              })),
              fonts: [],
              css: []
            };
            console.log(`✅ Built asset mapping from session: ${assetMapping.images.length} images`);
          }
        } catch (err) {
          console.warn('⚠️  Could not retrieve asset session info:', err.message);
        }
      }
    }

    const out = await conv.exportTemplate(ir, mode, assetMapping);

    if (out.kind === 'json') {
      const json = JSON.parse(Buffer.isBuffer(out.bytes) ? out.bytes.toString('utf8') : String(out.bytes));
      const ok = validateElementorTemplate(json);
      if (!ok) {
        const errs = getValidationErrors(validateElementorTemplate.errors).slice(0, 8);
        res.status(400).json({ ok: false, code: 'INVALID_ELEMENTOR_JSON', errors: errs });
        return;
      }
    }

    res.setHeader('Content-Type', out.kind === 'zip' ? 'application/zip' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=template.${out.kind === 'zip' ? 'zip' : 'json'}`);
    res.send(out.bytes);
  } catch (e) { next(e); }
});

export default router;
