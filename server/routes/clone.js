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
    const ir = typeof conv.toIR === 'function' ? await conv.toIR(source) : await conv.buildIntermediateRepresentation(source);
    const counts = conv.counts ? await conv.counts(ir) : { sections: 0, elements: 0, images: 0 };
    res.json({ ok: true, converter: conv.constructor.name, irPresent: !!ir, counts });
  } catch (e) { next(e); }
});

router.post('/download', async (req, res, next) => {
  try {
    const { mode = 'template', url = '', html = '' } = req.body || {};
    const conv = makeElementorConverter();
    const source = html || url;
    if (!source) throw new Error("Provide 'url' or 'html'");
    const ir = typeof conv.toIR === 'function' ? await conv.toIR(source) : await conv.buildIntermediateRepresentation(source);
    const out = await conv.exportTemplate(ir, mode);

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
