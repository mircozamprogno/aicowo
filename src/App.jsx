import Router from './components/common/Router';
import ToastContainer from './components/common/ToastContainer';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router />
        <ToastContainer />
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;