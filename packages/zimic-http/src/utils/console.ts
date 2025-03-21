import color from 'picocolors';

export function logWithPrefix(message: string, options: { method: 'log' | 'warn' | 'error' }) {
  const { method } = options;

  console[method](color.cyan('[@zimic/http]'), message);
}
