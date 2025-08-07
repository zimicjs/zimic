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
      <HighlightCard hoverable className="flex flex-col items-center text-center">
        <ProjectCardLogo title={title} />
        <h2 className="dark:text-white-light text-xl font-bold text-slate-900">{title}</h2>
        <p className="mb-0 text-base text-slate-600 dark:text-slate-300">{description}</p>
      </HighlightCard>
    </Link>
  );
}

export default ProjectCard;
