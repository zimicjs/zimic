import HomeSection from '../../components/HomeSection';
import ProjectCard from '../../components/ProjectCard';
import { httpPackages } from './packages';

function ProjectCards() {
  return (
    <HomeSection
      title="Three packages, one schema"
      titleId="packages"
      description="Install only what you need. Each package works on its own and they share the same schema."
      className="max-w-4xl px-6 md:px-12"
    >
      <div className="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-6">
        {httpPackages.map((packageInfo) => (
          <ProjectCard
            key={packageInfo.name}
            href={packageInfo.href ?? '/docs'}
            title={packageInfo.name}
            description={packageInfo.summary}
          />
        ))}
      </div>
    </HomeSection>
  );
}

export default ProjectCards;
