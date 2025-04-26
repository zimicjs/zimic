import Link from '@docusaurus/Link';

import HighlightCard from './HighlightCard';
import ProjectCardLogo from './ProjectCardLogo';

interface Props {
  title: string;
  description: string;
  href: string;
}

function ProjectCard({ title, description, href }: Props) {
  return (
    <Link href={href} className="no-underline">
      <HighlightCard hoverable className="flex flex-col items-center justify-center text-center">
        <ProjectCardLogo title={title} />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
        <p className="mb-0 text-base text-slate-600 dark:text-slate-300">{description}</p>
      </HighlightCard>
    </Link>
  );
}

export default ProjectCard;
