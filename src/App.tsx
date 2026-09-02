import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Vendors } from './components/Vendors';
import { Purchases } from './components/Purchases';
import { Sales } from './components/Sales';
import { Stock } from './components/Stock';
import { PlantExpenses } from './components/PlantExpenses';
import { Salary } from './components/Salary';
import { Reports } from './components/Reports';

function App() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'vendors':
        return <Vendors />;
      case 'purchases':
        return <Purchases />;
      case 'sales':
        return <Sales />;
      case 'stock':
        return <Stock />;
      case 'expenses':
        return <PlantExpenses />;
      case 'salary':
        return <Salary />;
      case 'reports':
        return <Reports />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default App;
