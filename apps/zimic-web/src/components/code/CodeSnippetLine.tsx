import { RenderProps } from 'prism-react-renderer';

import { cn } from '@/utils/styles';

interface Props {
  line: RenderProps['tokens'][number];
  lineIndex: number;
  showLineNumbers: boolean;
  isHighlighted: boolean;
  getLineProps: RenderProps['getLineProps'];
  getTokenProps: RenderProps['getTokenProps'];
}

function CodeSnippetLine({ line, lineIndex, showLineNumbers, isHighlighted, getLineProps, getTokenProps }: Props) {
  const lineNumber = lineIndex + 1;
  const linePropsResult = getLineProps({ line });

  return (
    <div
      key={linePropsResult.key as string}
      className={cn(
        linePropsResult.className,
        'table-row',
        isHighlighted && 'bg-primary-500/10 dark:bg-primary-500/20 border-l-primary-500 -mx-4 block border-l-2 px-4',
      )}
      style={linePropsResult.style}
    >
      {showLineNumbers && (
        <span className="table-cell pr-4 text-right text-slate-400 select-none dark:text-slate-500">{lineNumber}</span>
      )}
      <span className={showLineNumbers ? 'table-cell' : ''}>
        {line.map((token) => {
          const tokenPropsResult = getTokenProps({ token });
          return (
            <span
              key={String(tokenPropsResult.key)}
              className={tokenPropsResult.className}
              style={tokenPropsResult.style}
            >
              {tokenPropsResult.children}
            </span>
          );
        })}
      </span>
    </div>
  );
}

export default CodeSnippetLine;
