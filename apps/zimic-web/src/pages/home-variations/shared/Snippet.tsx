import CodeBlock from '@theme/CodeBlock';

import { cn } from '@/utils/styles';

interface Props {
  code: string;
  language?: 'ts' | 'bash';
  title?: string;
  className?: string;
}

function Snippet({ code, language = 'ts', title, className }: Props) {
  return (
    <CodeBlock language={language} title={title} className={cn('mb-0 min-w-0 text-left', className)}>
      {code.trim()}
    </CodeBlock>
  );
}

export default Snippet;
