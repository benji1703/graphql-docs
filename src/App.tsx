import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { NotFoundPage } from './pages/NotFoundPage';
import { OverviewPage } from './pages/OverviewPage';

const ExplorerPage = lazy(() => import('./pages/ExplorerPage').then((module) => ({ default: module.ExplorerPage })));
const TypePage = lazy(() => import('./pages/TypePage').then((module) => ({ default: module.TypePage })));

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<OverviewPage />} />
        <Route path="docs/:typeName" element={<Suspense fallback={<div className="route-loader">Loading definition…</div>}><TypePage /></Suspense>} />
        <Route path="docs/:typeName/:fieldName" element={<Suspense fallback={<div className="route-loader">Loading definition…</div>}><TypePage /></Suspense>} />
        <Route path="explorer" element={<Suspense fallback={<div className="route-loader">Loading explorer…</div>}><ExplorerPage /></Suspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
