import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError, localDateString } from './utils.js';
import { aiConfig } from './services/zhipu.js';
import settingsRoutes from './routes/settings.js';
import papersRoutes from './routes/papers.js';
import discoveryRoutes from './routes/discovery.js';
import aiRoutes from './routes/ai.js';
import habitsRoutes from './routes/habits.js';
import healthRoutes from './routes/health.js';
import coursesRoutes from './routes/courses.js';
import memosRoutes from './routes/memos.js';
import remindersRoutes from './routes/reminders.js';
import filesRoutes from './routes/files.js';
import exportRoutes from './routes/export.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '4mb' }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(
        `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - started}ms`
      );
    }
  });
  next();
});

app.get('/api/status', (_req, res) => {
  res.json({
    ok: true,
    date: localDateString(),
    ai: { configured: aiConfig().configured, model: aiConfig().model },
  });
});

// PDF.js runtime assets (CJK cmaps, standard fonts, wasm decoders) served from
// the installed package so offline PDF rendering works without a CDN.
const pdfjsDist = path.join(ROOT, 'node_modules', 'pdfjs-dist');
for (const assetDir of ['cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  app.use(
    `/pdfjs-assets/${assetDir}`,
    express.static(path.join(pdfjsDist, assetDir), { fallthrough: false, maxAge: '7d' })
  );
}

app.use('/api', settingsRoutes);
app.use('/api', papersRoutes);
app.use('/api', discoveryRoutes);
app.use('/api', aiRoutes);
app.use('/api', habitsRoutes);
app.use('/api', healthRoutes);
app.use('/api', coursesRoutes);
app.use('/api', memosRoutes);
app.use('/api', remindersRoutes);
app.use('/api', filesRoutes);
app.use('/api', exportRoutes);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: '接口不存在' });
});

if (process.env.NODE_ENV === 'production') {
  const distDir = path.join(ROOT, 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        next();
        return;
      }
      if (!req.accepts('html') || req.path.startsWith('/assets/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.warn('未找到 dist 目录，请先运行 npm run build');
  }
}

app.use((error, req, res, _next) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error?.name === 'MulterError') {
    const message =
      error.code === 'LIMIT_FILE_SIZE' ? '文件超过 50MB 限制' : `文件上传失败：${error.message}`;
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
    return;
  }
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: '请求内容过大' });
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    res.status(400).json({ error: '请求 JSON 格式无效' });
    return;
  }
  console.error(`[${req.method} ${req.originalUrl}]`, error);
  res.status(500).json({ error: '服务器内部错误，请查看服务端日志' });
});

app.listen(PORT, HOST, () => {
  const ai = aiConfig();
  console.log(`My Workspace API：http://${HOST}:${PORT}`);
  console.log(
    `智谱 AI：${ai.configured ? `已配置（${ai.model}）` : '未配置（设置 ZHIPU_API_KEY 后可启用）'}`
  );
});
