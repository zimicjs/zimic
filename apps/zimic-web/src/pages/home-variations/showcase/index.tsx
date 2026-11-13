import { cn } from '@/utils/styles';

import HomeVariationLayout from '../shared/HomeVariationLayout';
import PackagePanel from '../shared/PackagePanel';
import { packages } from '../shared/packages';
import ProjectCards from '../shared/ProjectCards';

function ShowcaseHomePage() {
  return (
    <HomeVariationLayout>
      <ProjectCards />

      <div>
        {packages.map((packageInfo, index) => {
          const isReversed = index % 2 === 1;

          return (
            <section
              key={packageInfo.name}
              aria-label={packageInfo.name}
              className={cn(
                'px-6 py-16 md:px-12',
                isReversed && 'border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 border-y',
              )}
            >
              <div className="mx-auto max-w-6xl">
                <PackagePanel package={packageInfo} reversed={isReversed} />
              </div>
            </section>
          );
        })}
      </div>
    </HomeVariationLayout>
  );
}

export default ShowcaseHomePage;
