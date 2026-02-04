interface Props {
  title: string;
  language: string;
}

function CodeSnippetHeader({ title, language }: Props) {
  return (
    <div className="border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 dark:bg-primary-500/10 flex items-center justify-between border-b px-4 py-2">
      <span className="font-mono text-sm text-slate-600 dark:text-slate-300">{title}</span>
      <span className="text-xs font-medium text-slate-500 uppercase dark:text-slate-400">{language}</span>
    </div>
  );
}

export default CodeSnippetHeader;
