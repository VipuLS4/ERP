import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await signIn(email, password);
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#102b1b] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at 20% 20%, #d49a2a 0, transparent 34%), radial-gradient(circle at 90% 85%, #2d6a3e 0, transparent 38%)' }} />
      <div className="w-full max-w-md relative">
        <div className="text-center mb-8">
          <img src="/Logo_(3).png" alt="Raj & Brothers Rice Bran" className="mx-auto h-32 w-32 object-contain drop-shadow-2xl" />
          <h1 className="mt-4 text-3xl font-bold text-[#fff8e8] tracking-tight">Raj & Brothers</h1>
          <p className="text-[#e8b44a] mt-2 text-sm tracking-wide">Rice Bran Filtration & Processing</p>
        </div>

        <div className="bg-[#fffdf7] rounded-2xl shadow-2xl p-8 border border-[#e8b44a]/30">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-[#183b24]">Welcome back</h2>
            <p className="text-sm text-slate-500 mt-1">Sign in to manage your operations.</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#183b24] mb-1.5">Email Address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-[#d9d5c9] rounded-lg focus:ring-2 focus:ring-[#d49a2a] focus:border-[#d49a2a] outline-none transition text-sm bg-white" placeholder="admin@rajbrothers.com" required />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#183b24] mb-1.5">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-[#d9d5c9] rounded-lg focus:ring-2 focus:ring-[#d49a2a] focus:border-[#d49a2a] outline-none transition text-sm bg-white" placeholder="Enter your password" required />
            </div>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-lg text-sm">{error}</div>}
            <button type="submit" disabled={loading} className="w-full bg-[#1f542d] text-white py-2.5 rounded-lg font-semibold hover:bg-[#163d21] transition disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm">
              {loading ? 'Please wait...' : 'Sign In'}
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-slate-400">Accounts are created by a Super Admin. Contact your administrator for access.</p>
        </div>
        <p className="text-center text-[#d9d5c9] text-xs mt-6">Raj & Brothers ERP Platform</p>
      </div>
    </div>
  );
};
