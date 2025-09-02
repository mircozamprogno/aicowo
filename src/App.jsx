import Router from './components/common/Router';
import ToastContainer from './components/common/ToastContainer';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { TourProvider } from './contexts/TourContext'; // ADD THIS IMPORT

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <TourProvider>  {/* ADD THIS WRAPPER */}
          <Router />
          <ToastContainer />
        </TourProvider>  {/* END WRAPPER */}
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;