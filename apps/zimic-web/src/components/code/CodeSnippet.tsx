import { useColorMode } from '@docusaurus/theme-common';
import { Highlight } from 'prism-react-renderer';

import { cn } from '@/utils/styles';

import CodeSnippetLine from './CodeSnippetLine';
import { darkTheme, lightTheme } from './themes';

interface Props {
  code: string;
  language: 'typescript' | 'bash' | 'json';
  className?: string;
}

function CodeSnippet({ code, language, className }: Props) {
  const { colorMode } = useColorMode();
  const theme = colorMode === 'dark' ? darkTheme : lightTheme;

  return (
    <div
      className={cn(
        'border-primary-500/10 dark:border-primary-500/20 overflow-hidden rounded-xl border',
        'bg-[#f6f8fa] dark:bg-[#011627]',
        className,
      )}
    >
      <Highlight theme={theme} code={code} language={language}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre
            className="m-0 overflow-x-auto p-4 text-sm leading-relaxed"
            style={{ background: 'transparent' }}
            aria-label={`Code snippet in ${language}`}
          >
            <code className="font-mono">
              {tokens.map((line) => {
                const linePropsResult = getLineProps({ line });

                return (
                  <CodeSnippetLine
                    key={String(linePropsResult.key)}
                    line={line}
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
