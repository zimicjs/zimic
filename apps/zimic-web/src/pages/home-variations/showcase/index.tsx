import { cn } from '@/utils/styles';

import HomeVariationLayout from '../shared/HomeVariationLayout';
import PackageDetails from '../shared/PackageDetails';
import { httpPackages } from '../shared/packages';
import ProjectCards from '../shared/ProjectCards';
import Snippet from '../shared/Snippet';
import WebSocketPreview from '../shared/WebSocketPreview';

function ShowcaseHomePage() {
  return (
    <HomeVariationLayout>
      <ProjectCards />

      <div>
        {httpPackages.map((packageInfo, index) => {
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
              <div className="mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2 lg:gap-16">
                <PackageDetails package={packageInfo} className={cn(isReversed && 'lg:order-last')} />
                <Snippet title={packageInfo.snippet.title} code={packageInfo.snippet.code} />
              </div>
            </section>
          );
        })}
      </div>

      <WebSocketPreview />
    </HomeVariationLayout>
  );
}

export default ShowcaseHomePage;
