import HomeSection from '../../components/HomeSection';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import ProjectCards from '../shared/ProjectCards';
import Snippet from '../shared/Snippet';
import * as snippets from '../shared/snippets';
import WebSocketPreview from '../shared/WebSocketPreview';

const comparisons = [
  {
    titleId: 'requests',
    title: 'Calling an API',
    description: 'Native fetch returns untyped data. @zimic/fetch keeps the same API and adds the types.',
    before: { title: 'Native fetch', code: snippets.plainFetch },
    after: { title: '@zimic/fetch', code: snippets.zimicFetch },
  },
  {
    titleId: 'mocks',
    title: 'Mocking an API',
    description:
      'A hand-written mock can return data the API never does. @zimic/interceptor checks mocks against the schema.',
    before: { title: 'Mocking fetch by hand', code: snippets.plainMock },
    after: { title: '@zimic/interceptor', code: snippets.zimicMock },
  },
];

function ComparisonHomePage() {
  return (
    <HomeVariationLayout>
      <HomeSection
        title="Start from a schema"
        titleId="schema"
        description="@zimic/http describes your API as a type. Write it by hand or generate it from an OpenAPI document."
        className="max-w-3xl px-6 md:px-12"
      >
        <Snippet title="schema.ts" code={snippets.schema} />
      </HomeSection>

      {comparisons.map((comparison) => (
        <HomeSection
          key={comparison.titleId}
          title={comparison.title}
          titleId={comparison.titleId}
          description={comparison.description}
          className="max-w-6xl px-6 md:px-12"
        >
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <Snippet title={comparison.before.title} code={comparison.before.code} />
            <Snippet title={comparison.after.title} code={comparison.after.code} />
          </div>
        </HomeSection>
      ))}

      <ProjectCards />
      <WebSocketPreview />
    </HomeVariationLayout>
  );
}

export default ComparisonHomePage;
