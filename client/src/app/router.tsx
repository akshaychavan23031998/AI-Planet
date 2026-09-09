import { ClaimPage } from '../pages/ClaimPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TripPage } from '../pages/TripPage';
import { EvidencePage } from '../pages/EvidencePage';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { ApprovalsPage, FinancePage, NotFoundPage } from '../pages/pages';
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="trips/:travelRequestId" element={<TripPage />} />
        <Route
          path="trips/:travelRequestId/evidence"
          element={<EvidencePage />}
        />
        <Route path="claims/:claimId" element={<ClaimPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="finance" element={<FinancePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
