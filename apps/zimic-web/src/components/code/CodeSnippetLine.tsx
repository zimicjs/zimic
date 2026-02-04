import { Token, RenderProps } from 'prism-react-renderer';

import { cn } from '@/utils/styles';

interface Props {
  line: Token[];
  getLineProps: RenderProps['getLineProps'];
  getTokenProps: RenderProps['getTokenProps'];
}

function CodeSnippetLine({ line, getLineProps, getTokenProps }: Props) {
  const linePropsResult = getLineProps({ line });

  return (
    <div style={linePropsResult.style} className={cn(linePropsResult.className, 'table-row')}>
      <span>
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
