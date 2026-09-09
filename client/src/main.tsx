import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from './app/queryClient';
import { DemoIdentityProvider } from './context/DemoIdentityProvider';
import './index.css';
import App from './App';
const queryClient = createQueryClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <DemoIdentityProvider>
          <App />
        </DemoIdentityProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
