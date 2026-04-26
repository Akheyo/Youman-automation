import dynamic from 'next/dynamic';

// PVConfigurator is interactive only — Zustand store, Cesium, browser APIs
// throughout. SSR adds nothing useful and triggers hydration mismatches when
// React reconciles the dynamically loaded Cesium tree against server HTML.
// Skipping SSR entirely is faster AND cleaner.
const PVConfigurator = dynamic(() => import('@/components/PVConfigurator'), {
  ssr: false,
  loading: () => <PageSkeleton />,
});

export default function Page() {
  return <PVConfigurator source="standalone" />;
}

function PageSkeleton() {
  return (
    <div className="page-skeleton" aria-busy="true" aria-label="Konfigurator wird geladen">
      <div className="page-skeleton__bar" />
      <div className="page-skeleton__main">
        <div className="page-skeleton__viewer" />
        <div className="page-skeleton__sidebar" />
      </div>
    </div>
  );
}
