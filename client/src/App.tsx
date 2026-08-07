import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/store';
import { IS_STATIC } from './api';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Athletes } from './pages/Athletes';
import { Capture } from './pages/Capture';
import { PoseStudio } from './pages/PoseStudio';
import { Mirror } from './pages/Mirror';
import { Physique } from './pages/Physique';
import { Compare } from './pages/Compare';
import { Timelapse } from './pages/Timelapse';
import { Guides } from './pages/Guides';
import { Backup } from './pages/Backup';

// GitHub Pages has no SPA rewrite, so a deep link like /compare would 404 on reload. Hash routing
// sidesteps that entirely; the self-hosted server does have the rewrite, so it keeps clean URLs.
const Router = IS_STATIC ? HashRouter : BrowserRouter;

export default function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="capture" element={<Capture />} />
            <Route path="pose" element={<PoseStudio />} />
            <Route path="mirror" element={<Mirror />} />
            <Route path="physique" element={<Physique />} />
            <Route path="compare" element={<Compare />} />
            <Route path="timelapse" element={<Timelapse />} />
            <Route path="guides" element={<Guides />} />
            <Route path="athletes" element={<Athletes />} />
            <Route path="backup" element={<Backup />} />
          </Route>
        </Routes>
      </Router>
    </AppProvider>
  );
}
