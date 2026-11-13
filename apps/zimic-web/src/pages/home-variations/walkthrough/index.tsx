import HomeSection from '../../components/HomeSection';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import PackageDetails from '../shared/PackageDetails';
import { httpPackages } from '../shared/packages';
import ProjectCards from '../shared/ProjectCards';
import Snippet from '../shared/Snippet';
import * as snippets from '../shared/snippets';
import WebSocketPreview from '../shared/WebSocketPreview';

function WalkthroughHomePage() {
  return (
    <HomeVariationLayout>
      <HomeSection
        title="One schema, from request to test"
        titleId="walkthrough"
        description="Three steps take an API from a type declaration to a tested integration."
        className="max-w-6xl px-6 md:px-12"
      >
        <ol className="m-0 list-none p-0">
          {httpPackages.map((packageInfo, index) => {
            const isLastStep = index === httpPackages.length - 1;

            return (
              <li key={packageInfo.name} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 md:gap-x-8">
                <div className="flex flex-col items-center">
                  <div className="from-highlight-600 via-highlight-400 to-highlight-200 text-white-light flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tl text-lg font-bold">
                    {index + 1}
                  </div>
                  {!isLastStep && <div className="bg-primary-500/20 w-0.5 flex-1" />}
                </div>

                <div className="grid items-start gap-8 pb-16 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <PackageDetails package={packageInfo} />

                  <div className="min-w-0 space-y-4">
                    <Snippet title={packageInfo.snippet.title} code={packageInfo.snippet.code} />

                    {index === 0 && (
                      <>
                        <p className="mb-0 text-sm text-slate-600 dark:text-slate-300">
                          Already have an OpenAPI document? Generate the schema instead of writing it.
                        </p>
                        <Snippet language="bash" code={snippets.typegen} />
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </HomeSection>

      <WebSocketPreview />
      <ProjectCards />
    </HomeVariationLayout>
  );
}

export default WalkthroughHomePage;
