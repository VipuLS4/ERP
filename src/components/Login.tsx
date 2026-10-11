import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  ArrowRight,
  BadgeCheck,
  Boxes,
  Eye,
  EyeOff,
  Factory,
  FileText,
  Leaf,
  LockKeyhole,
  Mail,
  ShoppingCart,
  TrendingUp,
  Gauge,
  Users,
} from 'lucide-react';

const industrialImage =
  'https://images.pexels.com/photos/2496592/pexels-photo-2496592.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const brothers = [
  { name: 'Atul', role: 'Operations Excellence', image: '/c38528f7-261e-4f93-b443-089545ee2c9c.jpg', position: 'center 28%' },
  { name: 'Vipul', role: 'Technology & Systems', image: '/02c81547-a589-43a1-bd87-785812fd4dd2.jpg', position: 'center 32%' },
  { name: 'Raj', role: 'Growth & Execution', image: '/5f73bbfd-4c54-4acf-b5e1-709302ed13de.jpg', position: 'center 28%' },
];

const indicators = [
  { label: 'Quality Products', icon: BadgeCheck },
  { label: 'Efficient Operations', icon: Gauge },
  { label: 'Sustainable Growth', icon: Leaf },
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setError('');
    setLoading(true);

    try {
      const { error: authError } = await signIn(email.trim(), password);
      if (authError) setError(authError.message);
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen overflow-x-clip bg-[#082a1c] text-white lg:grid lg:grid-cols-[minmax(0,2.1fr)_minmax(360px,1fr)]">
      <section
        aria-label="Raj and Brothers branding and leadership"
        className="relative isolate flex flex-col gap-7 overflow-hidden bg-[#082a1c] px-4 py-5 sm:gap-8 sm:px-7 sm:py-7 lg:min-h-screen lg:justify-between lg:gap-8 lg:px-9 lg:py-8 xl:px-12 xl:py-10 2xl:px-14"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{ backgroundImage: `url("${industrialImage}")` }}
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(115deg,rgba(5,30,19,0.94)_0%,rgba(8,42,27,0.78)_50%,rgba(7,36,23,0.91)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_75%_15%,rgba(216,172,76,0.13),transparent_38%),linear-gradient(to_top,rgba(5,24,14,0.97),rgba(5,24,14,0.02)_65%)]"
        />

        <div className="relative mx-auto w-full max-w-5xl lg:mx-0">
          <div className="mb-6 flex items-center gap-3 sm:mb-8">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand-300/45 bg-forest-900/65 p-1.5 shadow-lg backdrop-blur-md sm:h-12 sm:w-12">
              <img src="/Logo_(3).png" alt="Raj & Brothers logo" className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold tracking-wide text-white sm:text-lg">Raj &amp; Brothers</p>
              <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-300 sm:text-[10px] sm:tracking-[0.26em]">Rice Bran Processing</p>
            </div>
          </div>

          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300 sm:text-xs sm:tracking-[0.3em]">Raj &amp; Brothers ERP</p>
          <h1 className="max-w-3xl text-[clamp(2rem,7.3vw,2.6rem)] font-semibold leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-5xl xl:text-6xl 2xl:text-7xl">
            Built for Progress.
            <span className="mt-1 block text-brand-300">Driven by Innovation.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-white/80 sm:mt-5 sm:text-base sm:leading-7">
            Connecting people, processes and technology for smarter operations.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-2 sm:mt-7 sm:max-w-2xl sm:gap-3">
            {indicators.map(({ label, icon: Icon }) => (
              <div key={label} className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-brand-300/25 bg-[#0b3020]/75 px-1.5 py-3 text-center shadow-sm backdrop-blur-md transition-colors hover:border-brand-300/50 sm:flex-row sm:justify-start sm:gap-3 sm:px-3 sm:py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-brand-300/45 bg-brand-300/5 text-brand-300 sm:h-9 sm:w-9">
                  <Icon size={16} strokeWidth={1.8} />
                </div>
                <p className="min-w-0 text-[9px] font-medium leading-[1.3] text-white/85 sm:text-[10px] sm:text-left sm:leading-4">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-5xl lg:mx-0">
          <div className="mb-4 flex items-center gap-3 sm:mb-5">
            <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.28em] text-brand-300">Leadership</p>
            <div className="h-px flex-1 bg-gradient-to-r from-brand-300/40 to-transparent" />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3 xl:gap-4">
            {brothers.map((brother) => (
              <article key={brother.name} className="group relative min-w-0 overflow-hidden rounded-xl border border-white/15 bg-gradient-to-b from-[#163c29]/90 via-[#0c2d1e]/90 to-[#071e14]/95 p-1.5 shadow-[0_8px_25px_rgba(0,0,0,0.18)] backdrop-blur-md transition-colors duration-300 hover:border-brand-300/45 sm:rounded-2xl sm:p-2.5 xl:p-3">
                <div className="relative isolate aspect-[4/3] overflow-hidden rounded-lg bg-[#153b29] sm:rounded-xl">
                  <img src={brother.image} alt={`${brother.name} - ${brother.role}`} loading="eager" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: brother.position }} />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,35,23,0.02)_35%,rgba(7,35,23,0.10)_65%,rgba(7,35,23,0.45)_100%)]" />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10 sm:rounded-xl" />
                </div>
                <div className="px-0.5 pb-1 pt-2 sm:px-1 sm:pt-2.5">
                  <h2 className="font-serif text-base italic leading-tight text-brand-300 sm:text-xl xl:text-2xl">{brother.name}</h2>
                  <p className="mt-1 min-h-[2rem] text-[8px] font-medium leading-3 text-white/80 sm:min-h-[2rem] sm:text-[10px] sm:leading-4 xl:text-[11px]">{brother.role}</p>
                  <span className="mt-1.5 block h-0.5 w-5 rounded-full bg-brand-300/75 sm:mt-2 sm:w-7" />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="relative hidden items-center justify-between gap-2 border-t border-white/10 pt-4 lg:flex xl:pt-5">
          {modules.map(({ label, icon: Icon }) => (
            <div key={label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center text-white/70">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-300/45 bg-forest-900/45 text-brand-300 transition-colors hover:bg-brand-300/15 sm:h-10 sm:w-10">
                <Icon size={16} strokeWidth={1.7} />
              </div>
              <span className="text-[9px] font-medium sm:text-[10px]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative isolate flex min-w-0 items-center justify-center overflow-hidden bg-[#082a1c] px-4 py-7 sm:px-7 sm:py-9 lg:min-h-screen lg:px-7 lg:py-8 xl:px-9 2xl:px-12">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_85%_10%,rgba(216,172,76,0.09),transparent_35%),radial-gradient(ellipse_at_10%_90%,rgba(34,98,60,0.24),transparent_40%)]" />

        <div className="my-auto w-full max-w-md">
          <div className="mb-5 text-center sm:mb-7">
            <img src="/Logo_(3).png" alt="Raj & Brothers Rice Bran" className="mx-auto h-[68px] w-[68px] object-contain drop-shadow-xl sm:h-24 sm:w-24" />
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-brand-300 sm:mt-5 sm:text-[10px] sm:tracking-[0.28em]">Rice Bran Filtration &amp; Processing</p>
            <h2 className="mx-auto mt-3 max-w-sm text-2xl font-semibold leading-tight tracking-[-0.035em] text-white sm:text-3xl xl:text-4xl">Welcome Back</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">Sign in to your workspace</p>
          </div>

          <div className="rounded-2xl border border-brand-200/60 bg-[#fffdf7] p-5 text-forest-900 shadow-[0_24px_70px_rgba(0,0,0,0.25)] sm:rounded-[1.75rem] sm:p-7 xl:p-8">
            <div className="mb-5 sm:mb-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-forest-600 sm:text-xs sm:tracking-[0.22em]">Secure Access</p>
              <h3 className="mt-2 text-xl font-semibold leading-snug tracking-tight sm:text-2xl">Manage your workspace</h3>
              <p className="mt-2 text-sm leading-5 text-slate-500 sm:leading-6">Manage your operations, people and business from one secure platform.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-forest-900">Email Address</label>
                <div className="relative">
                  <Mail size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-500" />
                  <input id="email" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base text-slate-900 outline-none transition placeholder:text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-300/20" placeholder="Enter your email address" autoComplete="username" autoCapitalize="none" spellCheck={false} required />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-semibold text-forest-900">Password</label>
                <div className="relative">
                  <LockKeyhole size={17} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-500" />
                  <input id="password" name="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-12 text-base text-slate-900 outline-none transition placeholder:text-sm placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-300/20" placeholder="Enter your password" autoComplete="current-password" required />
                  <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-forest-700 focus:outline-none focus:ring-2 focus:ring-brand-400" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-forest-700 text-sm font-semibold text-white shadow-lg shadow-forest-900/15 transition-colors hover:bg-forest-800 focus:outline-none focus:ring-4 focus:ring-forest-500/30 disabled:cursor-not-allowed disabled:opacity-60">
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />}
              </button>
            </form>

            <div className="mt-4 border-t border-forest-900/10 pt-4 text-center sm:mt-5">
              <p className="text-xs font-semibold leading-5 text-forest-700">Rooted in Trust. Driven by Quality.</p>
              <p className="mt-1 text-[10px] font-medium leading-4 text-forest-600">Smarter Operations. Stronger Growth.</p>
            </div>
          </div>

          <p className="mx-auto mt-4 max-w-sm text-center text-[11px] leading-5 text-white/55 sm:mt-6 sm:text-xs">
            Accounts are created by a Super Admin. Contact your administrator for access.
          </p>
          <p className="mt-2 text-center text-[9px] font-medium uppercase tracking-[0.13em] text-white/35">
            © Raj &amp; Brothers ERP Platform. All Rights Reserved.
          </p>
        </div>
      </section>
    </main>
  );
};
