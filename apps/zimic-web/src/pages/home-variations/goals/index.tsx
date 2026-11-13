import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';

import HomeSection from '../../components/HomeSection';
import GoalPanel from '../shared/GoalPanel';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import { goals } from '../shared/packages';
import ProjectCards from '../shared/ProjectCards';

function GoalsHomePage() {
  return (
    <HomeVariationLayout>
      <HomeSection
        title="What do you want to do?"
        titleId="goals"
        description="Pick a task to see which packages it needs. Most tasks need one or two."
        className="max-w-6xl px-6 md:px-12"
      >
        <Tabs className="justify-center">
          {goals.map((goal) => (
            <TabItem key={goal.id} value={goal.id} label={goal.label}>
              <div className="pt-8">
                <GoalPanel goal={goal} />
              </div>
            </TabItem>
          ))}
        </Tabs>
      </HomeSection>

      <ProjectCards />
    </HomeVariationLayout>
  );
}

export default GoalsHomePage;
