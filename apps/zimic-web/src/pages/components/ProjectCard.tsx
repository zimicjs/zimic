import Link from '@docusaurus/Link';
import { useMemo } from 'react';

interface Props {
  title: string;
  description: string;
  href: string;
}

function ProjectCard({ title, description, href }: Props) {
  const projectInitial = useMemo(() => {
    return title
      .replace(/^@[^/]+\//, '')
      .charAt(0)
      .toUpperCase();
  }, [title]);

  return (
    <Link
      href={href}
      className="border-primary-600/10 dark:border-primary-600/20 bg-primary-600/5 dark:bg-primary-600/10 hover:bg-primary-600/15 dark:hover:bg-primary-600/20 flex flex-col items-center justify-center space-y-4 rounded-xl border-2 p-6 text-center no-underline backdrop-blur-sm transition-all"
    >
      <div className="from-highlight-200 to-highlight-500 dark:from-highlight-300 dark:to-highlight-500 flex h-12 w-12 items-center justify-center rounded-md bg-gradient-to-br text-xl font-bold text-white">
        {projectInitial}
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-300">{description}</p>
    </Link>
  );
}

export default ProjectCard;
