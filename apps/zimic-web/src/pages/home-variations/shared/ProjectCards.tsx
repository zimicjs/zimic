import HomeSection from '../../components/HomeSection';
import ProjectCard from '../../components/ProjectCard';
import { packages } from './packages';

function ProjectCards() {
  return (
    <HomeSection
      title="Four packages, installed separately"
      titleId="packages"
      description="They share schemas and work best together, but no project needs all of them. Add one when you need it."
      className="max-w-6xl px-6 md:px-12"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-6">
        {packages.map((packageInfo) => (
          <ProjectCard
            key={packageInfo.name}
            href={packageInfo.href}
            title={packageInfo.name}
            description={`${packageInfo.summary}. ${packageInfo.requirement}.`}
          />
        ))}
      </div>
    </HomeSection>
  );
}

export default ProjectCards;
