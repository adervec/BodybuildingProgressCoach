import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './state/store';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Athletes } from './pages/Athletes';
import { Capture } from './pages/Capture';
import { PoseStudio } from './pages/PoseStudio';
import { Physique } from './pages/Physique';
import { Compare } from './pages/Compare';
import { Timelapse } from './pages/Timelapse';
import { Guides } from './pages/Guides';
import { Backup } from './pages/Backup';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="capture" element={<Capture />} />
            <Route path="pose" element={<PoseStudio />} />
            <Route path="physique" element={<Physique />} />
            <Route path="compare" element={<Compare />} />
            <Route path="timelapse" element={<Timelapse />} />
            <Route path="guides" element={<Guides />} />
            <Route path="athletes" element={<Athletes />} />
            <Route path="backup" element={<Backup />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
