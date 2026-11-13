import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';

import HomeSection from '../../components/HomeSection';
import GoalPanel from '../shared/GoalPanel';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import { httpGoals, webSocketGoals } from '../shared/packages';

const protocols = [
  {
    id: 'http',
    title: 'For HTTP APIs',
    description: 'Start with a schema. Add the typed client, the mocks, or both.',
    goals: httpGoals,
  },
  {
    id: 'websockets',
    title: 'For WebSockets',
    description: 'A separate set of packages. Skip it if your project has no WebSockets.',
    goals: webSocketGoals,
  },
];

function ProtocolsHomePage() {
  return (
    <HomeVariationLayout>
      {protocols.map((protocol, index) => (
        <div
          key={protocol.id}
          className={
            index % 2 === 1 ? 'border-primary-500/10 dark:border-primary-500/20 bg-primary-500/5 border-y' : undefined
          }
        >
          <HomeSection
            title={protocol.title}
            titleId={protocol.id}
            description={protocol.description}
            className="max-w-6xl px-6 md:px-12"
          >
            <Tabs className="justify-center">
              {protocol.goals.map((goal) => (
                <TabItem key={goal.id} value={goal.id} label={goal.label}>
                  <div className="pt-8">
                    <GoalPanel goal={goal} />
                  </div>
                </TabItem>
              ))}
            </Tabs>
          </HomeSection>
        </div>
      ))}
    </HomeVariationLayout>
  );
}

export default ProtocolsHomePage;
