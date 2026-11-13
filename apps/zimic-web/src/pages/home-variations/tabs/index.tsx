import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';

import HomeSection from '../../components/HomeSection';
import HomeVariationLayout from '../shared/HomeVariationLayout';
import PackageDetails from '../shared/PackageDetails';
import { allPackages, webSocketPackage } from '../shared/packages';
import Snippet from '../shared/Snippet';

function TabsHomePage() {
  return (
    <HomeVariationLayout>
      <HomeSection
        title="Explore the packages"
        titleId="packages"
        description="Each package works on its own. Together, they share one schema of your API."
        className="max-w-6xl px-6 md:px-12"
      >
        <Tabs className="justify-center">
          {allPackages.map((packageInfo) => (
            <TabItem
              key={packageInfo.name}
              value={packageInfo.name}
              label={packageInfo === webSocketPackage ? `${packageInfo.name} (soon)` : packageInfo.name}
            >
              <div className="grid items-start gap-8 pt-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <PackageDetails package={packageInfo} />
                <Snippet title={packageInfo.snippet.title} code={packageInfo.snippet.code} />
              </div>
            </TabItem>
          ))}
        </Tabs>
      </HomeSection>
    </HomeVariationLayout>
  );
}

export default TabsHomePage;
