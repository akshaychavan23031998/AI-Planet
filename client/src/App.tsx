import { Toaster } from 'sonner';
import { AppRoutes } from './app/router';
import { ErrorBoundary } from './components/ErrorBoundary';
export default function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
      <Toaster position="bottom-right" richColors closeButton />
    </ErrorBoundary>
  );
}
