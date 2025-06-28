import DOMPurify from 'dompurify';

export function sanitizeSvg(svg: string) {
  return DOMPurify.sanitize(svg, {
    ALLOWED_TAGS: ['svg', 'clipPath', 'image', 'path', 'rect', 'style', 'text', 'a'],
    ADD_ATTR: ['target'],
  });
}
