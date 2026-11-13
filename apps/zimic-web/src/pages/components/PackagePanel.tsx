import PackageExample from './PackageExample';
import PackageFeatures from './PackageFeatures';
import PackageIntro from './PackageIntro';
import { PackageInfo } from './packages';

interface Props {
  package: PackageInfo;
}

/** The description of a package on one side and its example on the other. */
function PackagePanel({ package: packageInfo }: Props) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
      <div className="flex flex-col gap-6">
        <PackageIntro package={packageInfo} />
        <PackageFeatures package={packageInfo} />
      </div>

      <PackageExample package={packageInfo} />
    </div>
  );
}

export default PackagePanel;
