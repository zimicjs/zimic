import { useColorMode } from '@docusaurus/theme-common';
import { Highlight } from 'prism-react-renderer';

import { cn } from '@/utils/styles';

import CodeSnippetHeader from './CodeSnippetHeader';
import CodeSnippetLine from './CodeSnippetLine';
import { darkTheme, lightTheme } from './themes';

interface Props {
  code: string;
  language: 'typescript' | 'bash' | 'json';
  className?: string;
  showLineNumbers?: boolean;
  highlightLines?: number[];
  title?: string;
}

function CodeSnippet({ code, language, className, showLineNumbers = false, highlightLines = [], title }: Props) {
  const { colorMode } = useColorMode();
  const theme = colorMode === 'dark' ? darkTheme : lightTheme;

  const trimmedCode = code.trim();

  return (
    <div
      className={cn(
        'border-primary-500/10 dark:border-primary-500/20 overflow-hidden rounded-xl border',
        'bg-[#f6f8fa] dark:bg-[#011627]',
        className,
      )}
    >
      {title && <CodeSnippetHeader title={title} language={language} />}

      <Highlight theme={theme} code={trimmedCode} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            className="m-0 overflow-x-auto p-4 text-sm leading-relaxed"
            style={{ background: 'transparent' }}
            aria-label={`Code snippet in ${language}`}
          >
            <code className="font-mono">
              {tokens.map((line, lineIndex) => {
                const lineNumber = lineIndex + 1;
                const isHighlighted = highlightLines.includes(lineNumber);
                const linePropsResult = getLineProps({ line });
                const lineKey = linePropsResult.key as string;

                return (
                  <CodeSnippetLine
                    key={lineKey}
                    line={line}
                    lineIndex={lineIndex}
                    showLineNumbers={showLineNumbers}
                    isHighlighted={isHighlighted}
                    getLineProps={getLineProps}
                    getTokenProps={getTokenProps}
                  />
                );
              })}
            </code>
          </pre>
        )}
      </Highlight>
    </div>
  );
}

export default CodeSnippet;
