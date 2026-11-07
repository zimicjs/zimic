// Line separators (Zl) and paragraph separators (Zp) also break lines in comments.
const LINE_BREAK_REGEX = /\r\n|[\n\r\p{Zl}\p{Zp}]/gu;
const CONTINUATION_LINE_PREFIX = '\n *     ';

export interface JSDocAnnotations {
  title?: string;
  summary?: string;
  format?: string;
  deprecated?: boolean;
  description?: string;
  default?: unknown;
  example?: unknown;
  examples?: unknown;
  const?: unknown;
  enum?: unknown[];
  type?: string | string[];
  nullable?: boolean;
}

function formatAnnotationValue(value: unknown) {
  const serializedValue = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return serializedValue.trim().replace(LINE_BREAK_REGEX, CONTINUATION_LINE_PREFIX);
}

function formatEnumAnnotation(annotations: JSDocAnnotations) {
  let enumType = 'unknown';

  if (Array.isArray(annotations.type)) {
    enumType = annotations.type.join('|');
  } else if (typeof annotations.type === 'string') {
    enumType = annotations.type;
  }

  return `@enum {${enumType}${annotations.nullable ? '|null' : ''}}`;
}

function collectAnnotationLines(annotations: JSDocAnnotations) {
  const lines: string[] = [];

  if (annotations.title) {
    lines.push(formatAnnotationValue(annotations.title));
  }
  if (annotations.summary) {
    lines.push(formatAnnotationValue(annotations.summary));
  }
  if (annotations.format) {
    lines.push(`Format: ${annotations.format}`);
  }
  if (annotations.deprecated) {
    lines.push('@deprecated');
  }
  if (annotations.description !== undefined && annotations.description !== '') {
    lines.push(`@description ${formatAnnotationValue(annotations.description)}`);
  }
  if (annotations.default !== undefined) {
    lines.push(`@default ${formatAnnotationValue(annotations.default)}`);
  }
  if (annotations.example !== undefined) {
    lines.push(`@example ${formatAnnotationValue(annotations.example)}`);
  }
  if (Array.isArray(annotations.examples)) {
    for (const example of annotations.examples) {
      lines.push(`@example ${formatAnnotationValue(example)}`);
    }
  }
  if ('const' in annotations) {
    lines.push('@constant');
  }
  if (annotations.enum) {
    lines.push(formatEnumAnnotation(annotations));
  }

  return lines;
}

/** Creates a JSDoc comment from the annotations of an OpenAPI object, or `undefined` if there is nothing to document. */
export function createJSDocComment(annotations: JSDocAnnotations | boolean, options: { includeComments: boolean }) {
  if (!options.includeComments || typeof annotations === 'boolean') {
    return undefined;
  }

  const lines = collectAnnotationLines(annotations);

  if (lines.length === 0) {
    return undefined;
  }

  const isSingleLine = lines.length === 1 && !lines[0].includes('\n');
  const content = isSingleLine ? `* ${lines[0]} ` : `*\n * ${lines.join('\n * ')}\n `;

  // Closing sequences inside the content would end the comment early. Formatters, such as prettier-plugin-jsdoc,
  // decode backslash escapes and HTML entities, so a space is the only separator they keep.
  const escapedContent = content.replace(/\*\//g, '* /');

  return `/*${escapedContent}*/`
    .split('\n')
    .map((line, index) => (index === 0 ? line.trim() : ` ${line.trim()}`))
    .join('\n');
}
