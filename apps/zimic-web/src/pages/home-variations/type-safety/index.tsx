import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

import GetStartedLink from '../../components/GetStartedLink';
import HighlightCard from '../../components/HighlightCard';
import HomeSection from '../../components/HomeSection';
import { HERO_DESCRIPTION } from '../shared/HomeHero';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import ProjectCards from '../shared/ProjectCards';
import Snippet from '../shared/Snippet';
import * as snippets from '../shared/snippets';
import WebSocketPreview from '../shared/WebSocketPreview';

const caughtMistakes = [
  {
    title: 'A typo in a path',
    description: 'Paths autocomplete from the schema. A path that is not declared does not compile.',
    code: snippets.typeErrorPath,
  },
  {
    title: 'A wrong parameter',
    description: 'Headers, search params, path params, and bodies follow the types of each endpoint.',
    code: snippets.typeErrorParams,
  },
  {
    title: 'A mock that drifted from the API',
    description:
      'Mock responses use the same schema as your client, so tests cannot return a shape the API never does.',
    code: snippets.typeErrorMock,
  },
];

function SplitHero() {
  const { siteConfig } = useDocusaurusContext();

  return (
    <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:px-12 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="flex flex-col items-center gap-6 text-center lg:items-start lg:text-left">
        <h1 className="from-highlight-600 via-highlight-400 to-highlight-300 dark:from-highlight-500 dark:via-highlight-300 dark:to-highlight-300 mb-0 w-fit bg-gradient-to-br bg-clip-text text-7xl text-transparent">
          {siteConfig.title}
        </h1>

        <span className="text-2xl font-medium">{siteConfig.tagline}</span>

        <p className="mb-0 text-lg text-slate-700 dark:text-slate-200">{HERO_DESCRIPTION}</p>

        <GetStartedLink arrow />
      </div>

      <Snippet title="users.ts" code={snippets.typeErrorHero} />
    </div>
  );
}

function TypeSafetyHomePage() {
  return (
    <HomeVariationLayout hero={<SplitHero />}>
      <HomeSection
        title="Mistakes that stop at the compiler"
        titleId="type-safety"
        description="Zimic turns common HTTP bugs into type errors, before any request is sent."
        className="max-w-[96rem] px-6 md:px-12"
      >
        <div className="grid gap-6 lg:grid-cols-3">
          {caughtMistakes.map((mistake) => (
            <HighlightCard key={mistake.title} className="flex min-w-0 flex-col gap-4">
              <h3 className="dark:text-white-light mb-0 text-xl font-bold text-slate-900">{mistake.title}</h3>
              <p className="mb-0 text-base text-slate-600 dark:text-slate-300">{mistake.description}</p>
              <Snippet code={mistake.code} />
            </HighlightCard>
          ))}
        </div>
      </HomeSection>

      <HomeSection
        title="It starts with a schema"
        titleId="schema"
        description="Declare the API by hand or generate it from an OpenAPI document."
        className="max-w-6xl px-6 md:px-12"
      >
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <Snippet title="schema.ts" code={snippets.schema} />
          <Snippet language="bash" title="Or generate it" code={snippets.typegen} />
        </div>
      </HomeSection>

      <ProjectCards />
      <WebSocketPreview />
    </HomeVariationLayout>
  );
}

export default TypeSafetyHomePage;
