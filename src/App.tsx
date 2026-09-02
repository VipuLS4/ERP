import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Vendors } from './components/Vendors';
import { Customers } from './components/Customers';
import { Purchases } from './components/Purchases';
import { MaterialReceiving } from './components/MaterialReceiving';
import { Production } from './components/Production';
import { Stock } from './components/Stock';
import { Sales } from './components/Sales';
import { PlantExpenses } from './components/PlantExpenses';
import { Employees } from './components/Employees';
import { Salary } from './components/Salary';
import { Reports } from './components/Reports';
import { UserManagement } from './components/UserManagement';
import { Settings as SettingsPage } from './components/Settings';

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
      case 'dashboard': return <Dashboard />;
      case 'vendors': return <Vendors />;
      case 'customers': return <Customers />;
      case 'purchases': return <Purchases />;
      case 'material-receiving': return <MaterialReceiving />;
      case 'production': return <Production />;
      case 'stock': return <Stock />;
      case 'sales': return <Sales />;
      case 'expenses': return <PlantExpenses />;
      case 'employees': return <Employees />;
      case 'salary': return <Salary />;
      case 'reports': return <Reports />;
      case 'user-management': return <UserManagement />;
      case 'settings': return <SettingsPage />;
      default: return <Dashboard />;
    }
  };

  return (
    <Layout currentPage={currentPage} onPageChange={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

export default App;
