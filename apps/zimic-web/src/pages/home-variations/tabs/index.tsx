import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';

import HomeSection from '../../components/HomeSection';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import PackagePanel from '../shared/PackagePanel';
import { packages } from '../shared/packages';

function TabsHomePage() {
  return (
    <HomeVariationLayout>
      <HomeSection
        title="Pick the packages you need"
        titleId="packages"
        description="Each package installs separately. They share schemas and work best together, but no project needs all of them."
        className="max-w-6xl px-6 md:px-12"
      >
        <Tabs className="justify-center">
          {packages.map((packageInfo) => (
            <TabItem key={packageInfo.name} value={packageInfo.name} label={packageInfo.name}>
              <div className="pt-8">
                <PackagePanel package={packageInfo} />
              </div>
            </TabItem>
          ))}
        </Tabs>
      </HomeSection>
    </HomeVariationLayout>
  );
}

export default TabsHomePage;
