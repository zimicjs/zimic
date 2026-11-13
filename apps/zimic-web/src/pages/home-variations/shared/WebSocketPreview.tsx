import HomeSection from '../../components/HomeSection';
import PackageDetails from './PackageDetails';
import { webSocketPackage } from './packages';
import Snippet from './Snippet';

function WebSocketPreview() {
  return (
    <HomeSection
      title="Coming next: WebSockets"
      titleId="websockets"
      description="@zimic/ws brings schemas to real-time APIs."
      className="max-w-6xl px-6 md:px-12"
    >
      <div className="border-primary-500/30 grid items-center gap-8 rounded-xl border-2 border-dashed p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PackageDetails package={webSocketPackage} />
        <Snippet title={webSocketPackage.snippet.title} code={webSocketPackage.snippet.code} />
      </div>
    </HomeSection>
  );
}

export default WebSocketPreview;
