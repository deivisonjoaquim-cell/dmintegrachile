import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installChunkLoadRecovery } from './utils/dynamicImportRecovery';

// Defesa global contra chunks dinâmicos desatualizados após novos deploys (ex.: Vercel)
installChunkLoadRecovery();

createRoot(document.getElementById('root')!).render(<App />);
