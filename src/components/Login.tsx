import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight,
  Boxes,
  Eye,
  EyeOff,
  Factory,
  FileText,
  LockKeyhole,
  Mail,
  ShoppingCart,
  TrendingUp,
  Users,
  Wheat,
} from 'lucide-react';

const industrialImage = 'https://images.pexels.com/photos/2496592/pexels-photo-2496592.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const brothers = [
  { name: 'Raj', role: 'Growth & Execution', image: '/02c81547-a589-43a1-bd87-785812fd4dd2.jpg', position: 'center 28%' },
  { name: 'Atul', role: 'Operations Excellence', image: '/5f73bbfd-4c54-4acf-b5e1-709302ed13de.jpg', position: 'center 32%' },
  { name: 'Vipul', role: 'Technology & Systems', image: '/c38528f7-261e-4f93-b443-089545ee2c9c.jpg', position: 'center 28%' },
];

const modules = [
  { label: 'Purchase', icon: ShoppingCart },
  { label: 'Production', icon: Factory },
  { label: 'Inventory', icon: Boxes },
  { label: 'Vendors', icon: Users },
  { label: 'Sales', icon: TrendingUp },
  { label: 'Reports', icon: FileText },
];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password);
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-forest-900 text-white lg:grid lg:grid-cols-[minmax(0,1.85fr)_minmax(360px,1fr)]">
      <section
        className="relative isolate flex min-h-[430px] flex-col justify-between overflow-hidden bg-forest-900 px-5 py-8 sm:min-h-[520px] sm:p-8 lg:min-h-screen lg:p-10 xl:p-14"
        style={{ backgroundImage: `url(${industrialImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        aria-label="Raj and Brothers family business story"
      >
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(8,35,21,.96)_0%,rgba(13,57,31,.72)_42%,rgba(8,35,21,.86)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_20%,rgba(232,180,74,.18),transparent_30%),linear-gradient(to_top,rgba(5,24,14,.94),transparent_48%)]" />

        <div className="relative max-w-2xl">
          <div className="mb-14 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-brand-300/50 bg-forest-900/70 shadow-lg backdrop-blur-sm">
              <Wheat size={25} className="text-brand-300" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-wide text-white">Raj &amp; Brothers</p>
              <p className="text-[10px] font-medium uppercase tracking-[0.26em] text-brand-300">Rice Bran Processing</p>
            </div>
          </div>

          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-brand-300">A family business, built for tomorrow</p>
          <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-white xl:text-7xl">
            Three Brothers.<br />
            <span className="text-brand-300">One Vision.</span><br />
            A Smarter Future.
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-white/75">
            A family business rooted in hard work, growing through quality, teamwork and smarter operations.
          </p>
        </div>

        <div className="relative">
          <div className="mb-8 grid max-w-3xl grid-cols-3 gap-3 xl:gap-5">
            {brothers.map((brother) => (
              <div key={brother.name} className="group rounded-2xl border border-white/15 bg-forest-900/65 p-3 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:border-brand-300/60 hover:bg-forest-900/80 xl:p-4">
                <div className="flex items-center gap-3">
                  <img src={brother.image} alt={`${brother.name}, ${brother.role}`} className="h-12 w-12 shrink-0 rounded-full border border-brand-300/70 object-cover shadow-inner xl:h-14 xl:w-14" style={{ objectPosition: brother.position }} />
                  <div className="min-w-0">
                    <p className="font-serif text-xl italic text-brand-300 xl:text-2xl">{brother.name}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-white/70 xl:text-xs">{brother.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex max-w-3xl items-center justify-between border-t border-white/15 pt-5">
            {modules.map(({ label, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center text-white/70">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-300/60 bg-forest-900/70 text-brand-300 transition hover:bg-brand-300 hover:text-forest-900">
                  <Icon size={17} strokeWidth={1.8} />
                </div>
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-forest-900 px-5 py-8 sm:px-8 lg:px-10 xl:px-16">
        <div className="absolute -right-28 -top-28 h-80 w-80 rounded-full bg-brand-300/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-28 h-80 w-80 rounded-full bg-forest-500/20 blur-3xl" />

        <div className="relative w-full max-w-md">
          <div className="mb-8 text-center">
            <img src="/Logo_(3).png" alt="Raj & Brothers Rice Bran" className="mx-auto h-24 w-24 object-contain drop-shadow-2xl sm:h-28 sm:w-28" />
            <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-300">Rice Bran Filtration &amp; Processing</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Welcome to Raj &amp; Brothers ERP</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">Your operations, connected with clarity.</p>
          </div>

          <div className="rounded-[1.75rem] border border-brand-200/60 bg-[#fffdf7] p-6 text-forest-900 shadow-[0_24px_70px_rgba(0,0,0,.28)] sm:p-8">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest-600">Secure access</p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">Sign in to your workspace</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">Manage every part of your business from one place.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-forest-900">Email Address</label>
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest-500" />
                  <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-300/20" placeholder="Enter your email address" autoComplete="email" required />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-forest-900">Password</label>
                <div className="relative">
                  <LockKeyhole size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-forest-500" />
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-300/20" placeholder="Enter your password" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-forest-700 focus:outline-none focus:ring-2 focus:ring-brand-400" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">{error}</div>}

              <button type="submit" disabled={loading} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest-700 text-sm font-semibold text-white shadow-lg shadow-forest-900/15 transition hover:bg-forest-800 focus:outline-none focus:ring-4 focus:ring-forest-500/30 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="mt-7 flex items-center gap-3 text-center">
              <span className="h-px flex-1 bg-brand-200" />
              <p className="font-serif text-sm italic text-forest-700">Three Brothers. One Vision.</p>
              <span className="h-px flex-1 bg-brand-200" />
            </div>
            <p className="mt-2 text-center text-xs font-semibold tracking-wide text-brand-700">A Smarter Future.</p>
          </div>

          <p className="mt-6 text-center text-xs text-white/45">Accounts are created by a Super Admin. Contact your administrator for access.</p>
          <p className="mt-3 text-center text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">© Raj &amp; Brothers ERP Platform</p>
        </div>
      </section>
    </main>
  );
};
