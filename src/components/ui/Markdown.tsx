import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

marked.setOptions({ gfm: true, breaks: true });

export function Markdown({ content, className = '' }: { content: string; className?: string }) {
  const html = useMemo(() => {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ['style', 'iframe', 'form', 'input', 'button'],
      FORBID_ATTR: ['style'],
    });
  }, [content]);

  return (
    <div
      className={`prose ${className}`}
      // Content is sanitized above with DOMPurify.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
