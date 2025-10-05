import { useMemo } from 'react';

interface Props {
  title: string;
}

function ProjectCardLogo({ title }: Props) {
  const projectInitialLetter = useMemo(() => {
    return title
      .replace(/^@[^/]+\//, '')
      .charAt(0)
      .toUpperCase();
  }, [title]);

  return (
    <div
      role="img"
      aria-label={title}
      className="from-highlight-600 via-highlight-400 to-highlight-200 text-white-light flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-tl text-xl font-bold"
    >
      {projectInitialLetter}
    </div>
  );
}

export default ProjectCardLogo;
