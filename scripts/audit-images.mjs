import fs from 'node:fs/promises';
import sharp from 'sharp';
import { catalogImageLoader } from '../lib/catalogImageLoader.mjs';
import { resolveStorageImageUrl } from '../lib/storageImageUrl.mjs';
const base = process.env.AUDIT_URL || 'http://127.0.0.1:3000';
const preview = await (await fetch(`${base}/api/public/catalog-preview?sucursalId=c023312e-6fa7-4481-bb1c-fe9c360c3f73`)).json();
const images = [...new Set(Object.values(preview.previews).flatMap(p => p.categories.map(c => c.imageUrl)).filter(Boolean))];
const report = { base, timestamp: new Date().toISOString(), images: [], originalSamples: [] };
let cursor = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (cursor < images.length) {
    const source = images[cursor++];
    const url = catalogImageLoader({ src: source, width: 96 });
    const started = Date.now();
    try {
      const response = await fetch(new URL(url, base), { signal: AbortSignal.timeout(45000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      const meta = response.ok ? await sharp(bytes).metadata() : null;
      report.images.push({ source, status: response.status, durationMs: Date.now() - started, bytes: bytes.length,
        format: meta?.format, width: meta?.width, cache: response.headers.get('cache-control') });
    } catch (e) { report.images.push({ source, error: e.name, durationMs: Date.now() - started }); }
  }
}));
for (const source of images.slice(0, 4)) {
  const started = Date.now();
  const response = await fetch(resolveStorageImageUrl(source), { signal: AbortSignal.timeout(45000) });
  report.originalSamples.push({ source, status: response.status, bytes: (await response.arrayBuffer()).byteLength, durationMs: Date.now() - started });
}
await fs.writeFile('docs/audit-2026-11-04/image-service-real.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: images.length, passed: report.images.filter(i => i.status === 200 && i.width <= 96).length, failures: report.images.filter(i => i.status !== 200) }));
