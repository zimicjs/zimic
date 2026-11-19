import TabItem from '@theme/TabItem';
import Tabs from '@theme/Tabs';

import InstallCommand from './InstallCommand';
import { PackageInfo, PackageUsage } from './packages';
import Snippet from './Snippet';

function UsageExample({ usage }: { usage: PackageUsage }) {
  return (
    <div className="flex flex-col gap-4">
      <InstallCommand packages={usage.packages} isDevelopmentOnly={usage.isDevelopmentOnly} />
      <Snippet title={usage.example.title} code={usage.example.code} />
    </div>
  );
}

interface Props {
  package: PackageInfo;
}

/** The install command and code example of a package, with one tab per usage when it has several. */
function PackageExample({ package: packageInfo }: Props) {
  const [firstUsage] = packageInfo.usages;

  return (
    <div className="min-w-0 text-left">
      {packageInfo.usages.length === 1 ? (
        <UsageExample usage={firstUsage} />
      ) : (
        <Tabs groupId="protocols">
          {packageInfo.usages.map((usage) => (
            <TabItem key={usage.label} value={usage.label} label={usage.label}>
              <UsageExample usage={usage} />
            </TabItem>
          ))}
        </Tabs>
      )}
    </div>
  );
}

export default PackageExample;
