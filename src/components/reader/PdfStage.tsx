import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { AlertTriangle, MessageSquarePlus, X } from 'lucide-react';
import type { Annotation, HighlightColor, HighlightRect } from '../../types';
import { fileUrl } from '../../lib/api';
import { Spinner } from '../ui/basics';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const COLORS: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'purple'];

interface SelectionState {
  rects: HighlightRect[];
  text: string;
  anchor: { x: number; y: number };
}

export function PdfStage({
  page,
  fileId,
  scale,
  annotations,
  onCreateAnnotation,
  onDocumentReady,
}: {
  page: number;
  fileId: number;
  scale: number;
  annotations: Annotation[];
  onCreateAnnotation: (data: {
    page: number;
    color: HighlightColor;
    rects: HighlightRect[];
    text: string;
    comment?: string | null;
  }) => Promise<void>;
  onDocumentReady: (
    doc: PDFDocumentProxy,
    info: { numPages: number; baseWidth: number; baseHeight: number }
  ) => void;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [creating, setCreating] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const readyRef = useRef(onDocumentReady);
  readyRef.current = onDocumentReady;

  useEffect(() => {
    let disposed = false;
    setLoading(true);
    setError(null);
    setSelection(null);
    setDoc(null);
    const task = pdfjsLib.getDocument({
      url: fileUrl(fileId),
      cMapUrl: '/pdfjs-assets/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: '/pdfjs-assets/standard_fonts/',
      wasmUrl: '/pdfjs-assets/wasm/',
      iccUrl: '/pdfjs-assets/iccs/',
    });
    task.promise
      .then(async (loaded) => {
        if (disposed) {
          void task.destroy();
          return;
        }
        const firstPage = await loaded.getPage(1);
        const viewport = firstPage.getViewport({ scale: 1 });
        if (disposed) return;
        setDoc(loaded);
        setLoading(false);
        readyRef.current(loaded, {
          numPages: loaded.numPages,
          baseWidth: viewport.width,
          baseHeight: viewport.height,
        });
      })
      .catch((loadError: Error) => {
        if (disposed) return;
        setLoading(false);
        setError(loadError.message || 'PDF 加载失败');
      });
    return () => {
      disposed = true;
      void task.destroy();
    };
  }, [fileId, reloadKey]);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null;
    let textLayer: InstanceType<typeof pdfjsLib.TextLayer> | null = null;
    setSelection(null);
    setCommentOpen(false);
    setLoading(true);

    const render = async () => {
      const safePage = Math.min(Math.max(page, 1), doc.numPages);
      const pdfPage = await doc.getPage(safePage);
      if (cancelled) return;
      const viewport = pdfPage.getViewport({ scale });
      const canvas = canvasRef.current;
      const textContainer = textLayerRef.current;
      if (!canvas || !textContainer) return;

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * ratio);
      canvas.height = Math.floor(viewport.height * ratio);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('无法创建 PDF 画布');
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, viewport.width, viewport.height);

      renderTask = pdfPage.render({ canvasContext: context, viewport, canvas });
      await renderTask.promise;
      if (cancelled) return;

      setPageSize({ width: viewport.width, height: viewport.height });
      textContainer.replaceChildren();
      textContainer.style.setProperty('--scale-factor', String(scale));
      textContainer.style.setProperty('--total-scale-factor', String(scale));
      textLayer = new pdfjsLib.TextLayer({
        textContentSource: pdfPage.streamTextContent(),
        container: textContainer,
        viewport,
      });
      await textLayer.render();
      if (!cancelled) setLoading(false);
    };

    render().catch((renderError: Error) => {
      if (cancelled || renderError?.name === 'RenderingCancelledException') return;
      setLoading(false);
      setError(renderError.message || 'PDF 页面渲染失败');
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [doc, page, scale]);

  const handleMouseUp = () => {
    const selected = window.getSelection();
    if (!selected || selected.rangeCount === 0 || selected.isCollapsed) return;
    const range = selected.getRangeAt(0);
    if (!textLayerRef.current?.contains(range.commonAncestorContainer)) return;
    const text = selected.toString().replace(/\s+/g, ' ').trim();
    if (!text) return;
    const pageRect = pageRef.current?.getBoundingClientRect();
    if (!pageRect || !pageRect.width || !pageRect.height) return;
    const clientRects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 1 && rect.height > 1
    );
    if (!clientRects.length) return;
    const rects = clientRects
      .map((rect) => ({
        x: (rect.left - pageRect.left) / pageRect.width,
        y: (rect.top - pageRect.top) / pageRect.height,
        w: rect.width / pageRect.width,
        h: rect.height / pageRect.height,
      }))
      .filter((rect) => rect.x >= -0.02 && rect.y >= -0.02 && rect.x <= 1.02 && rect.y <= 1.02);
    if (!rects.length) return;
    const left = Math.min(...clientRects.map((rect) => rect.left));
    const right = Math.max(...clientRects.map((rect) => rect.right));
    const top = Math.min(...clientRects.map((rect) => rect.top));
    setSelection({
      rects,
      text: text.slice(0, 5000),
      anchor: {
        x: (left + right) / 2 - pageRect.left,
        y: top - pageRect.top,
      },
    });
    setCommentOpen(false);
    setComment('');
  };

  const clearSelection = () => {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setCommentOpen(false);
    setComment('');
  };

  const createAnnotation = async (color: HighlightColor, withComment: boolean) => {
    if (!selection || creating) return;
    setCreating(true);
    try {
      await onCreateAnnotation({
        page,
        color,
        rects: selection.rects,
        text: selection.text,
        comment: withComment ? comment.trim() || null : null,
      });
      clearSelection();
    } finally {
      setCreating(false);
    }
  };

  const toolbarWidth = 224;
  const toolbarLeft = selection
    ? Math.min(Math.max(selection.anchor.x - toolbarWidth / 2, 8), Math.max(pageSize.width - toolbarWidth - 8, 8))
    : 0;
  const toolbarTop = selection
    ? selection.anchor.y > 56
      ? selection.anchor.y - 50
      : Math.min(selection.anchor.y + 26, Math.max(pageSize.height - 60, 8))
    : 0;

  return (
    <div className="pdf-stage">
      {loading && (
        <div className="pdf-loading" aria-live="polite">
          <Spinner size={22} />
          <span>正在准备页面…</span>
        </div>
      )}

      {error && (
        <div className="pdf-error" role="alert">
          <AlertTriangle size={22} />
          <strong>PDF 加载失败</strong>
          <p>{error}</p>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            重试
          </button>
        </div>
      )}

      <div
        ref={pageRef}
        className={`pdf-page ${loading ? 'is-loading' : ''}`}
        style={{
          width: pageSize.width || undefined,
          height: pageSize.height || undefined,
          '--scale-factor': scale,
          '--total-scale-factor': scale,
        } as CSSProperties}
      >
        <canvas ref={canvasRef} className="pdf-canvas" />
        <div className="pdf-highlights" aria-hidden="true">
          {annotations
            .filter((annotation) => annotation.page === page && annotation.type === 'highlight')
            .flatMap((annotation) =>
              annotation.rects.map((rect, index) => (
                <span
                  key={`${annotation.id}-${index}`}
                  className={`pdf-highlight hl-${annotation.color}`}
                  style={{
                    left: `${rect.x * 100}%`,
                    top: `${rect.y * 100}%`,
                    width: `${rect.w * 100}%`,
                    height: `${rect.h * 100}%`,
                  }}
                />
              ))
            )}
        </div>
        <div
          ref={textLayerRef}
          className="textLayer"
          onMouseUp={handleMouseUp}
        />

        {selection && (
          <div
            className="selection-toolbar"
            style={{ left: toolbarLeft, top: toolbarTop }}
            onMouseDown={(event) => event.preventDefault()}
          >
            <div className="selection-colors">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`hl-swatch hl-${color}`}
                  aria-label={`用${colorLabel(color)}高亮`}
                  title={`${colorLabel(color)}高亮`}
                  disabled={creating}
                  onClick={() => void createAnnotation(color, false)}
                />
              ))}
            </div>
            <span className="selection-divider" />
            <button
              type="button"
              className="selection-note-btn"
              onClick={() => setCommentOpen((value) => !value)}
              disabled={creating}
            >
              <MessageSquarePlus size={14} /> 批注
            </button>
            <button
              type="button"
              className="selection-close"
              onClick={clearSelection}
              aria-label="取消选择"
            >
              <X size={13} />
            </button>

            {commentOpen && (
              <div className="selection-comment">
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value.slice(0, 3000))}
                  placeholder="写下你的批注…"
                  rows={3}
                  autoFocus
                />
                <div className="selection-comment-foot">
                  <span>将同时保存高亮与批注</span>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={creating || !comment.trim()}
                    onClick={() => void createAnnotation('yellow', true)}
                  >
                    {creating ? <Spinner size={12} /> : null} 保存批注
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function colorLabel(color: HighlightColor) {
  return (
    {
      yellow: '黄色',
      green: '绿色',
      blue: '蓝色',
      pink: '粉色',
      purple: '紫色',
    } as const
  )[color];
}
