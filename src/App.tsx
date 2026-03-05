import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, Users, Calendar, Shield, LogIn, UserPlus, LogOut, 
  LayoutDashboard, Menu, X, ChevronRight, Target, Zap, 
  Wallet, User as UserIcon, Home, Bell, Copy, Check, 
  ArrowUpRight, ArrowDownLeft, Plus, Send, AlertCircle,
  Settings, MessageSquare, Clock, Eye, EyeOff, Languages
} from 'lucide-react';
import { translations, type Language } from './translations';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  id: number;
  username: string;
  email: string;
  ff_id: string;
  first_name?: string;
  last_name?: string;
  balance: number;
  profile_picture?: string;
  is_admin: number;
  last_username_change?: string;
}

interface Tournament {
  id: number;
  title: string;
  description: string;
  prize_pool: string;
  entry_fee: string;
  start_date: string;
  slots_total: number;
  slots_filled: number;
  status: string;
}

interface Transaction {
  id: number;
  type: 'deposit' | 'withdraw';
  amount: number;
  method: string;
  sender_number: string;
  transaction_id?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  username?: string;
}

interface Notice {
  id: number;
  content: string;
  created_at: string;
}

// --- Components ---

const Navbar = ({ user, onLogout, openAuth, noticesCount, lang, setLang }: { 
  user: User | null, 
  onLogout: () => void, 
  openAuth: (mode: 'login' | 'signup') => void, 
  noticesCount: number,
  lang: Language,
  setLang: (l: Language) => void
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const t = translations[lang].nav;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 px-6 py-4",
      isScrolled ? "bg-black/80 backdrop-blur-lg border-b border-white/10" : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="bg-orange-600 p-2 rounded-lg group-hover:rotate-12 transition-transform">
            <Target className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-display font-bold tracking-tighter leading-none">YOUR MEHERUN GAMING</span>
            <span className="text-[10px] text-white/40 font-bold tracking-widest uppercase">Elite Free Fire Community</span>
          </div>
        </Link>

        <div className="flex items-center gap-4">
          <button 
            onClick={() => setLang(lang === 'en' ? 'bn' : 'en')}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/60 hover:text-white flex items-center gap-2"
          >
            <Languages className="w-5 h-5" />
            <span className="text-xs font-bold uppercase">{lang}</span>
          </button>

          <Link to="/notices" className="relative p-2 text-white/60 hover:text-white transition-colors">
            <Bell className="w-6 h-6" />
            {noticesCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-orange-600 text-[10px] font-bold flex items-center justify-center rounded-full text-white">
                {noticesCount}
              </span>
            )}
          </Link>
          
          <div className="hidden md:flex items-center gap-6 ml-4">
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-xs text-white/40 font-bold uppercase">{translations[lang].wallet.balance}</span>
                  <span className="text-sm font-mono font-bold text-orange-500">৳{user.balance}</span>
                </div>
                <button onClick={onLogout} className="text-white/40 hover:text-white transition-colors">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={() => openAuth('login')} className="btn-primary py-2 px-6 text-sm">{t.login}</button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

const BottomNav = ({ user }: { user: User | null }) => {
  const location = useLocation();
  const navItems = [
    { label: 'HOME', icon: Home, path: '/' },
    { label: 'MATCHES', icon: Trophy, path: '/tournaments' },
    { label: 'WALLET', icon: Wallet, path: '/wallet' },
    { label: 'PROFILE', icon: UserIcon, path: '/profile' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-xl border-t border-white/10 px-4 py-2 md:hidden">
      <div className="flex justify-around items-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.label} 
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 p-2 transition-colors",
                isActive ? "text-orange-500" : "text-white/40 hover:text-white"
              )}
            >
              <item.icon className={cn("w-6 h-6", isActive && "fill-orange-500/10")} />
              <span className="text-[10px] font-bold tracking-wider">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

const AuthModal = ({ isOpen, onClose, mode, setMode, onAuthSuccess, lang }: { 
  isOpen: boolean, 
  onClose: () => void, 
  mode: 'login' | 'signup', 
  setMode: (m: 'login' | 'signup') => void,
  onAuthSuccess: (token: string, user: User) => void,
  lang: Language
}) => {
  const [formData, setFormData] = useState({ 
    username: '', 
    email: '', 
    password: '', 
    confirm_password: '',
    ff_id: '',
    first_name: '',
    last_name: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (mode === 'signup' && formData.password !== formData.confirm_password) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Authentication failed');

      if (mode === 'login') {
        onAuthSuccess(data.token, data.user);
        onClose();
      } else {
        setMode('login');
        setError('Account created! Please login.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="glass-card w-full max-w-md p-8 relative z-10 max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-display font-bold mb-2">
          {mode === 'login' ? translations[lang].nav.login : 'Create Account'}
        </h2>
        <p className="text-white/60 mb-8">
          {mode === 'login' ? 'Sign in to access your tournaments' : 'Join the elite Free Fire community'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder={translations[lang].profile.first_name}
                  className="input-field"
                  required
                  value={formData.first_name}
                  onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder={translations[lang].profile.last_name}
                  className="input-field"
                  required
                  value={formData.last_name}
                  onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                />
              </div>
              <input
                type="text"
                placeholder={translations[lang].profile.username}
                className="input-field"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
              <input
                type="text"
                placeholder={translations[lang].profile.ff_id}
                className="input-field"
                required
                value={formData.ff_id}
                onChange={(e) => setFormData({ ...formData, ff_id: e.target.value })}
              />
            </>
          )}
          <input
            type="email"
            placeholder="Email Address"
            className="input-field"
            required
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              className="input-field pr-12"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          {mode === 'signup' && (
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Confirm Password"
                className="input-field pr-12"
                required
                value={formData.confirm_password}
                onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          )}

          {error && <p className={cn("text-sm", error.includes('created') ? "text-green-500" : "text-red-500")}>{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full mt-4">
            {loading ? 'Processing...' : (mode === 'login' ? translations[lang].nav.login : 'Sign Up')}
          </button>
        </form>

        <p className="mt-6 text-center text-white/60 text-sm">
          {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
          <button onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-orange-500 font-bold hover:underline">
            {mode === 'login' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </motion.div>
    </div>
  );
};

const TournamentCard: React.FC<{ tournament: Tournament, onRegister: (id: number) => void, lang: Language }> = ({ tournament, onRegister, lang }) => {
  const t = translations[lang].hero;
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="glass-card p-6 flex flex-col gap-4 group"
    >
      <div className="flex justify-between items-start">
        <div className="bg-orange-600/20 text-orange-500 text-xs font-bold px-3 py-1 rounded-full border border-orange-500/20">
          {tournament.status.toUpperCase()}
        </div>
        <div className="text-white/40 text-sm font-mono">
          #{tournament.id}
        </div>
      </div>
      
      <div>
        <h3 className="text-xl font-display font-bold mb-2 group-hover:text-orange-500 transition-colors">{tournament.title}</h3>
        <p className="text-white/60 text-sm line-clamp-2">{tournament.description}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 my-2">
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-orange-500" />
          <span>{tournament.prize_pool}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-orange-500" />
          <span>{tournament.slots_filled}/{tournament.slots_total} Slots</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-orange-500" />
          <span>{tournament.entry_fee}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-orange-500" />
          <span>{new Date(tournament.start_date).toLocaleDateString()}</span>
        </div>
      </div>

      <button 
        onClick={() => onRegister(tournament.id)}
        className="btn-primary w-full py-2 mt-auto"
      >
        {t.join_now || 'Join Tournament'}
      </button>
    </motion.div>
  );
};

// --- Pages ---

const LandingPage = ({ user, openAuth, lang }: { user: User | null, openAuth: (mode: 'login' | 'signup') => void, lang: Language }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const t = translations[lang].hero;
  const ts = translations[lang].stats;

  useEffect(() => {
    fetch('/api/tournaments').then(res => res.json()).then(setTournaments);
    fetch('/api/notices').then(res => res.json()).then(setNotices);
  }, []);

  return (
    <div className="pt-24 pb-20">
      {/* Notice Section */}
      {notices.length > 0 && (
        <div className="bg-orange-600/10 border-y border-orange-500/20 py-3 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase flex-shrink-0">Notice</div>
              <div className="flex-1 overflow-hidden">
                <div className="whitespace-nowrap animate-marquee">
                  {notices.map((n, i) => (
                    <span key={n.id} className="inline-block mr-12 text-sm text-white/80">
                      {n.content}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative px-6 py-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-orange-600/10 blur-[120px] rounded-full -z-10" />
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-6xl md:text-8xl font-display font-black tracking-tighter mb-6 leading-none">
              {t.title_part1} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-yellow-500">{t.title_part2}</span>
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10">
              {t.subtitle}
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link to="/profile" className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2">
                  <UserIcon className="w-5 h-5" /> {t.profile}
                </Link>
              ) : (
                <button onClick={() => openAuth('signup')} className="btn-primary w-full sm:w-auto">{t.get_started}</button>
              )}
              <Link to="/tournaments" className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2">
                {t.view_schedule} <ChevronRight className="w-4 h-4" />
              </Link>
              <Link 
                to={user ? "/wallet" : "#"} 
                onClick={(e) => {
                  if (!user) {
                    e.preventDefault();
                    openAuth('login');
                  }
                }}
                className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 bg-orange-600/10 border-orange-500/20 hover:bg-orange-600/20"
              >
                <Wallet className="w-4 h-4 text-orange-500" /> {t.wallet}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-10">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: ts.players, value: '50K+' },
            { label: ts.tournaments, value: '1.2K' },
            { label: ts.prizes, value: '৳500K' },
            { label: ts.teams, value: '200+' },
          ].map((stat, i) => (
            <div key={i} className="glass-card p-6 text-center">
              <div className="text-3xl font-display font-bold text-orange-500 mb-1">{stat.value}</div>
              <div className="text-xs text-white/40 uppercase tracking-widest font-bold">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Wallet CTA Section */}
      <section className="px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <div className="glass-card p-8 md:p-12 bg-gradient-to-br from-orange-600/20 to-transparent flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl font-display font-bold mb-4">{translations[lang].wallet.withdraw}</h2>
              <p className="text-white/60 text-lg mb-6">
                {translations[lang].wallet.success_withdraw}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to={user ? "/wallet" : "#"} 
                  onClick={(e) => {
                    if (!user) {
                      e.preventDefault();
                      openAuth('login');
                    }
                  }}
                  className="btn-primary flex items-center justify-center gap-2"
                >
                  <Wallet className="w-5 h-5" /> {translations[lang].hero.wallet}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Tournaments */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-end mb-12">
            <div>
              <h2 className="text-4xl font-display font-bold mb-2">Active Tournaments</h2>
              <p className="text-white/60">Join the current battles and prove your skills</p>
            </div>
            <Link to="/tournaments" className="text-orange-500 font-bold hover:underline hidden md:block">View All Tournaments</Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tournaments.slice(0, 3).map((t: Tournament) => (
              <TournamentCard 
                key={t.id} 
                tournament={t} 
                lang={lang}
                onRegister={() => openAuth('login')} 
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const WalletPage = ({ user, refreshUser, lang }: { user: User, refreshUser: () => void, lang: Language }) => {
  const [mode, setMode] = useState<'main' | 'deposit' | 'withdraw'>('main');
  const [step, setStep] = useState(1);
  const [depositData, setDepositData] = useState({ amount: 50, method: 'bkash', sender: '', txid: '' });
  const [withdrawData, setWithdrawData] = useState({ amount: 50, method: 'bkash', number: '' });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const t = translations[lang].wallet;
  const tc = translations[lang].common;

  const BKASH_NUMBER = "01818215450";

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    const token = localStorage.getItem('ff_token');
    const res = await fetch('/api/wallet/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setTransactions(data);
  };

  const handleDeposit = async () => {
    setLoading(true);
    const token = localStorage.getItem('ff_token');
    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: depositData.amount,
          method: depositData.method,
          sender_number: depositData.sender,
          transaction_id: depositData.txid
        })
      });
      if (!res.ok) throw new Error('Failed to submit deposit');
      setMessage(t.success_deposit);
      setTimeout(() => {
        setMode('main');
        setStep(1);
        setMessage('');
        fetchTransactions();
      }, 3000);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (withdrawData.amount > user.balance) {
      setMessage(t.insufficient);
      return;
    }
    setLoading(true);
    const token = localStorage.getItem('ff_token');
    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: withdrawData.amount,
          method: withdrawData.method,
          sender_number: withdrawData.number
        })
      });
      if (!res.ok) throw new Error('Failed to submit withdrawal');
      setMessage(t.success_withdraw);
      refreshUser();
      setTimeout(() => {
        setMode('main');
        setStep(1);
        setMessage('');
        fetchTransactions();
      }, 3000);
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  const copyNumber = () => {
    navigator.clipboard.writeText(BKASH_NUMBER);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pt-32 pb-32 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-8 mb-8 bg-gradient-to-br from-orange-600/20 to-transparent">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-sm text-white/40 font-bold uppercase tracking-widest mb-1">{t.balance}</h1>
              <div className="text-5xl font-display font-black text-white">৳{user.balance}</div>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl">
              <Wallet className="w-10 h-10 text-orange-500" />
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={() => { setMode('deposit'); setStep(1); }} className="btn-primary flex-1 flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" /> {t.deposit}
            </button>
            <button onClick={() => { setMode('withdraw'); setStep(1); }} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              <ArrowUpRight className="w-5 h-5" /> {t.withdraw}
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {mode === 'main' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <h2 className="text-xl font-display font-bold mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-orange-500" /> {t.history}
              </h2>
              <div className="space-y-4">
                {transactions.length > 0 ? transactions.map(tx => (
                  <div key={tx.id} className="glass-card p-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "p-3 rounded-xl",
                        tx.type === 'deposit' ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                      )}>
                        {tx.type === 'deposit' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="font-bold capitalize">{tx.type} via {tx.method}</div>
                        <div className="text-xs text-white/40">{new Date(tx.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("font-bold", tx.type === 'deposit' ? "text-green-500" : "text-red-500")}>
                        {tx.type === 'deposit' ? '+' : '-'}৳{tx.amount}
                      </div>
                      <div className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded-full inline-block",
                        tx.status === 'approved' ? "bg-green-500/20 text-green-500" : 
                        tx.status === 'rejected' ? "bg-red-500/20 text-red-500" : "bg-orange-500/20 text-orange-500"
                      )}>
                        {tx.status}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-12 text-white/20">No transactions yet</div>
                )}
              </div>
            </motion.div>
          )}

          {mode === 'deposit' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card p-8">
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setMode('main')} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                <h2 className="text-2xl font-display font-bold">{t.deposit}</h2>
              </div>

              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-white/40 mb-2">{t.enter_amount} (৳50 - ৳5000)</label>
                    <input 
                      type="number" 
                      className="input-field text-2xl font-bold" 
                      value={depositData.amount}
                      onChange={(e) => setDepositData({ ...depositData, amount: parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="flex gap-4">
                    {[50, 100, 500, 1000].map(amt => (
                      <button 
                        key={amt} 
                        onClick={() => setDepositData({ ...depositData, amount: amt })}
                        className={cn("flex-1 py-2 rounded-xl border transition-all", depositData.amount === amt ? "bg-orange-600 border-orange-600" : "border-white/10 hover:bg-white/5")}
                      >
                        ৳{amt}
                      </button>
                    ))}
                  </div>
                  <button 
                    onClick={() => setStep(2)} 
                    disabled={depositData.amount < 50 || depositData.amount > 5000}
                    className="btn-primary w-full"
                  >
                    {tc.next}
                  </button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <label className="block text-sm text-white/40 mb-2">{t.select_method}</label>
                  <div className="grid grid-cols-2 gap-4">
                    {['bkash', 'nagad'].map(m => (
                      <button 
                        key={m} 
                        onClick={() => setDepositData({ ...depositData, method: m })}
                        className={cn(
                          "p-6 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                          depositData.method === m ? "border-orange-500 bg-orange-500/10" : "border-white/10 hover:bg-white/5"
                        )}
                      >
                        <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center font-bold uppercase text-xs">
                          {m}
                        </div>
                        <span className="capitalize font-bold">{m}</span>
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-1">{tc.back}</button>
                    <button onClick={() => setStep(3)} className="btn-primary flex-1">{tc.next}</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div className="bg-orange-600/10 border border-orange-500/20 p-6 rounded-2xl text-center">
                    <p className="text-sm text-white/60 mb-2">Send Money to this {depositData.method} number:</p>
                    <div className="flex items-center justify-center gap-4">
                      <span className="text-2xl font-mono font-bold">{BKASH_NUMBER}</span>
                      <button onClick={copyNumber} className="p-2 bg-white/10 rounded-lg hover:bg-white/20">
                        {copied ? <Check className="text-green-500" /> : <Copy />}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep(2)} className="btn-secondary flex-1">{tc.back}</button>
                    <button onClick={() => setStep(4)} className="btn-primary flex-1">{tc.next}</button>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-white/40 mb-2">{t.enter_number}</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Your Bkash/Nagad number"
                        value={depositData.sender}
                        onChange={(e) => setDepositData({ ...depositData, sender: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-white/40 mb-2">Transaction ID</label>
                      <input 
                        type="text" 
                        className="input-field" 
                        placeholder="Enter TxID"
                        value={depositData.txid}
                        onChange={(e) => setDepositData({ ...depositData, txid: e.target.value })}
                      />
                    </div>
                  </div>
                  {message && <p className={cn("text-sm text-center", message.includes('submitted') ? "text-green-500" : "text-red-500")}>{message}</p>}
                  <div className="flex gap-4">
                    <button onClick={() => setStep(3)} className="btn-secondary flex-1">{tc.back}</button>
                    <button onClick={handleDeposit} disabled={loading} className="btn-primary flex-1">
                      {loading ? tc.loading : tc.submit}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {mode === 'withdraw' && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="glass-card p-8">
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setMode('main')} className="p-2 hover:bg-white/5 rounded-full"><X /></button>
                <h2 className="text-2xl font-display font-bold">{t.withdraw}</h2>
              </div>

              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-white/40 mb-2">{t.select_method}</label>
                    <div className="grid grid-cols-3 gap-4">
                      {['bkash', 'nagad', 'flexiload'].map(m => (
                        <button 
                          key={m} 
                          onClick={() => setWithdrawData({ ...withdrawData, method: m })}
                          className={cn(
                            "p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                            withdrawData.method === m ? "border-orange-500 bg-orange-500/10" : "border-white/10 hover:bg-white/5"
                          )}
                        >
                          <span className="capitalize font-bold text-sm">{m}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => setStep(2)} className="btn-primary w-full">{tc.next}</button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-white/40 mb-2">{t.enter_number} ({withdrawData.method})</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="01XXXXXXXXX"
                      value={withdrawData.number}
                      onChange={(e) => setWithdrawData({ ...withdrawData, number: e.target.value })}
                    />
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep(1)} className="btn-secondary flex-1">{tc.back}</button>
                    <button onClick={() => setStep(3)} className="btn-primary flex-1">{tc.next}</button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm text-white/40 mb-2">{t.enter_amount} ({t.min_amount})</label>
                    <input 
                      type="number" 
                      className="input-field text-2xl font-bold" 
                      value={withdrawData.amount}
                      onChange={(e) => setWithdrawData({ ...withdrawData, amount: parseInt(e.target.value) })}
                    />
                    <p className="text-xs text-white/40 mt-2">{t.available}: ৳{user.balance}</p>
                  </div>
                  {message && <p className={cn("text-sm text-center", message.includes('submitted') ? "text-green-500" : "text-red-500")}>{message}</p>}
                  <div className="flex gap-4">
                    <button onClick={() => setStep(2)} className="btn-secondary flex-1">{tc.back}</button>
                    <button 
                      onClick={handleWithdraw} 
                      disabled={loading || withdrawData.amount > user.balance || withdrawData.amount < 50} 
                      className="btn-primary flex-1"
                    >
                      {loading ? t.processing : t.confirm}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const ProfilePage = ({ user, onLogout, refreshUser, lang }: { user: User, onLogout: () => void, refreshUser: () => void, lang: Language }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ 
    username: user.username, 
    ff_id: user.ff_id, 
    profile_picture: user.profile_picture || '',
    first_name: user.first_name || '',
    last_name: user.last_name || ''
  });
  const [message, setMessage] = useState('');
  const [clickCount, setClickCount] = useState(0);
  const navigate = useNavigate();
  const timerRef = useRef<any>(null);
  const t = translations[lang].profile;
  const tc = translations[lang].common;

  const handleProfileClick = () => {
    setClickCount(prev => prev + 1);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setClickCount(0), 2000);
  };

  useEffect(() => {
    if (clickCount >= 5 && user.is_admin) {
      navigate('/admin');
      setClickCount(0);
    }
  }, [clickCount, user.is_admin, navigate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const token = localStorage.getItem('ff_token');
    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        setIsEditing(false);
        refreshUser();
        setMessage('Profile updated successfully!');
      } else {
        setMessage(data.error || 'Failed to update profile');
      }
    } catch (err) {
      setMessage('An error occurred');
    }
  };

  return (
    <div className="pt-32 pb-32 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="glass-card p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-orange-600 to-yellow-500 -z-10 opacity-20" />
          
          <div className="relative inline-block mb-6">
            <div 
              onClick={handleProfileClick}
              className="w-32 h-32 rounded-full border-4 border-orange-600 p-1 cursor-pointer select-none overflow-hidden"
            >
              {user.profile_picture ? (
                <img src={user.profile_picture} alt="Profile" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-full rounded-full bg-white/5 flex items-center justify-center">
                  <UserIcon className="w-12 h-12 text-white/20" />
                </div>
              )}
            </div>
            {user.is_admin === 1 && (
              <div className="absolute -top-2 -right-2 bg-orange-600 text-white p-1.5 rounded-lg shadow-lg">
                <Shield className="w-4 h-4" />
              </div>
            )}
          </div>

          <h1 className="text-3xl font-display font-bold mb-1">
            {user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}` : user.username}
          </h1>
          <p className="text-white/40 font-mono mb-6">@{user.username}</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="glass-card p-4">
              <div className="text-xs text-white/40 uppercase font-bold mb-1">{translations[lang].wallet.balance}</div>
              <div className="text-xl font-bold text-orange-500">৳{user.balance}</div>
            </div>
            <div className="glass-card p-4">
              <div className="text-xs text-white/40 uppercase font-bold mb-1">{t.ff_id}</div>
              <div className="text-xl font-bold text-white">{user.ff_id}</div>
            </div>
          </div>

          <div className="space-y-4">
            <Link to="/notices" className="btn-secondary w-full flex items-center justify-center gap-2">
              <Bell className="w-4 h-4 text-orange-500" /> {translations[lang].common.view_notices || 'View Notices'}
            </Link>
            <button onClick={() => setIsEditing(!isEditing)} className="btn-secondary w-full">
              {isEditing ? tc.cancel : t.edit}
            </button>
            <button onClick={onLogout} className="btn-primary w-full bg-red-600 hover:bg-red-500 shadow-red-600/20">
              {translations[lang].nav.logout}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {isEditing && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }}
              className="glass-card p-8 mt-8"
            >
              <h2 className="text-xl font-display font-bold mb-6">{t.edit}</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-white/40 mb-2">{t.first_name}</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={formData.first_name}
                      onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-white/40 mb-2">{t.last_name}</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      value={formData.last_name}
                      onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">{t.username}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                  <p className="text-[10px] text-white/20 mt-1">Can be changed once every 30 days</p>
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">{t.ff_id}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    value={formData.ff_id}
                    onChange={(e) => setFormData({ ...formData, ff_id: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/40 mb-2">{t.profile_pic}</label>
                  <input 
                    type="text" 
                    className="input-field" 
                    placeholder="https://..."
                    value={formData.profile_picture}
                    onChange={(e) => setFormData({ ...formData, profile_picture: e.target.value })}
                  />
                </div>
                {message && <p className={cn("text-sm text-center", message.includes('success') ? "text-green-500" : "text-red-500")}>{message}</p>}
                <button type="submit" className="btn-primary w-full mt-4">{t.save}</button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

const NoticePage = () => {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch('/api/notices').then(res => res.json()).then(setNotices);
  }, []);

  return (
    <div className="pt-32 pb-32 px-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-4xl font-display font-bold mb-8 flex items-center gap-4">
          <Bell className="w-8 h-8 text-orange-500" /> Notices
        </h1>
        <div className="space-y-6">
          {notices.length > 0 ? notices.map(notice => (
            <div key={notice.id} className="glass-card p-6 border-l-4 border-l-orange-600">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-orange-600/10 p-2 rounded-lg">
                  <MessageSquare className="w-5 h-5 text-orange-500" />
                </div>
                <span className="text-xs text-white/40">{new Date(notice.created_at).toLocaleString()}</span>
              </div>
              <p className="text-white/80 leading-relaxed">{notice.content}</p>
            </div>
          )) : (
            <div className="text-center py-20 text-white/20">No notices at the moment</div>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminPanel = ({ user }: { user: User }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ users: 0, tournaments: 0, pending: 0 });
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'notice'>('requests');

  useEffect(() => {
    fetchTransactions();
    fetchStats();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const token = localStorage.getItem('ff_token');
    const res = await fetch('/api/admin/users', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setUsers(data);
  };

  const fetchStats = async () => {
    const token = localStorage.getItem('ff_token');
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setStats(data);
  };

  const fetchTransactions = async () => {
    const token = localStorage.getItem('ff_token');
    const res = await fetch('/api/admin/transactions', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    setTransactions(data);
  };

  const handleAction = async (id: number, action: 'approve' | 'reject') => {
    const token = localStorage.getItem('ff_token');
    await fetch(`/api/admin/transactions/${id}/${action}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchTransactions();
  };

  const handlePostNotice = async () => {
    if (!notice) return;
    setLoading(true);
    const token = localStorage.getItem('ff_token');
    await fetch('/api/admin/notices', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ content: notice })
    });
    setNotice('');
    setLoading(false);
    alert('Notice posted!');
  };

  if (!user.is_admin) return <Navigate to="/" />;

  return (
    <div className="pt-32 pb-32 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-display font-bold mb-12">Admin Control Center</h1>

        <div className="flex gap-4 mb-8 overflow-x-auto pb-2">
          <button 
            onClick={() => setActiveTab('requests')}
            className={cn("px-6 py-2 rounded-full font-bold transition-all whitespace-nowrap", activeTab === 'requests' ? "bg-orange-600 text-white" : "bg-white/5 text-white/40 hover:text-white")}
          >
            Requests ({transactions.length})
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn("px-6 py-2 rounded-full font-bold transition-all whitespace-nowrap", activeTab === 'users' ? "bg-orange-600 text-white" : "bg-white/5 text-white/40 hover:text-white")}
          >
            Users ({users.length})
          </button>
          <button 
            onClick={() => setActiveTab('notice')}
            className={cn("px-6 py-2 rounded-full font-bold transition-all whitespace-nowrap", activeTab === 'notice' ? "bg-orange-600 text-white" : "bg-white/5 text-white/40 hover:text-white")}
          >
            Post Notice
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {activeTab === 'requests' && (
              <div className="glass-card p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Pending Requests</h2>
                <div className="space-y-4">
                  {transactions.length > 0 ? transactions.map(tx => (
                    <div key={tx.id} className="bg-white/5 border border-white/10 rounded-2xl p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-xs text-white/40 uppercase font-bold mb-1">{tx.type} Request</div>
                          <div className="text-2xl font-bold text-orange-500">৳{tx.amount}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{tx.username}</div>
                          <div className="text-xs text-white/40">{tx.email}</div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                        <div className="bg-black/20 p-3 rounded-xl">
                          <div className="text-white/40 text-[10px] uppercase font-bold">Method</div>
                          <div className="font-bold capitalize">{tx.method}</div>
                        </div>
                        <div className="bg-black/20 p-3 rounded-xl">
                          <div className="text-white/40 text-[10px] uppercase font-bold">Number</div>
                          <div className="font-bold">{tx.sender_number}</div>
                        </div>
                        {tx.transaction_id && (
                          <div className="bg-black/20 p-3 rounded-xl col-span-2">
                            <div className="text-white/40 text-[10px] uppercase font-bold">Transaction ID</div>
                            <div className="font-bold font-mono">{tx.transaction_id}</div>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-4">
                        <button 
                          onClick={() => handleAction(tx.id, 'reject')}
                          className="flex-1 py-3 rounded-xl border border-red-500/20 text-red-500 font-bold hover:bg-red-500/10 transition-all"
                        >
                          REJECT
                        </button>
                        <button 
                          onClick={() => handleAction(tx.id, 'approve')}
                          className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-500 transition-all"
                        >
                          APPROVE
                        </button>
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-20 text-white/20 border-2 border-dashed border-white/10 rounded-2xl">
                      No pending requests
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="glass-card p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Registered Users</h2>
                <div className="space-y-4">
                  {users.map(u => (
                    <div key={u.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <div className="font-bold">{u.username} ({u.first_name} {u.last_name})</div>
                        <div className="text-xs text-white/40">{u.email} | ID: {u.ff_id}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-orange-500 font-bold">৳{u.balance}</div>
                        <div className="text-[10px] text-white/20 uppercase">{new Date(u.created_at).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notice' && (
              <div className="glass-card p-8">
                <h2 className="text-2xl font-display font-bold mb-6">Post New Notice</h2>
                <textarea 
                  className="input-field min-h-[200px] mb-6" 
                  placeholder="Write your notice here..."
                  value={notice}
                  onChange={(e) => setNotice(e.target.value)}
                />
                <button 
                  onClick={handlePostNotice}
                  disabled={loading}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" /> {loading ? 'Posting...' : 'Post Notice'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <div className="glass-card p-8">
              <h2 className="text-xl font-display font-bold mb-4">System Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Total Users</span>
                  <span className="font-bold">{stats.users}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Active Matches</span>
                  <span className="font-bold">{stats.tournaments}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-white/40">Pending Requests</span>
                  <span className="font-bold text-orange-500">{stats.pending}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Dashboard = ({ user }: { user: User }) => {
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ff_token');
    fetch('/api/user/registrations', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      setRegistrations(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2">Welcome, {user.username}</h1>
            <p className="text-white/60">Manage your profile and tournament participations</p>
          </div>
          <div className="glass-card p-4 flex items-center gap-4">
            <div className="bg-orange-600/20 p-3 rounded-xl">
              <Shield className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="text-xs text-white/40 uppercase font-bold">Free Fire ID</div>
              <div className="font-mono font-bold text-lg">{user.ff_id}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="glass-card p-8">
              <h2 className="text-2xl font-display font-bold mb-6 flex items-center gap-2">
                <Trophy className="w-6 h-6 text-orange-500" />
                Your Registrations
              </h2>
              
              {loading ? (
                <div className="py-10 text-center text-white/40">Loading your matches...</div>
              ) : registrations.length > 0 ? (
                <div className="space-y-4">
                  {registrations.map(reg => (
                    <div key={reg.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex justify-between items-center">
                      <div>
                        <div className="font-bold">{reg.tournament_title}</div>
                        <div className="text-sm text-white/40">Team: {reg.team_name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-orange-500 font-bold uppercase">{reg.status}</div>
                        <div className="text-sm text-white/40">{new Date(reg.start_date).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center border-2 border-dashed border-white/10 rounded-2xl">
                  <p className="text-white/40 mb-4">You haven't joined any tournaments yet.</p>
                  <Link to="/tournaments" className="btn-primary py-2 px-6 text-sm inline-block">Browse Tournaments</Link>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="glass-card p-8">
              <h2 className="text-xl font-display font-bold mb-6">Quick Stats</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Matches Played</span>
                  <span className="font-bold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Wins</span>
                  <span className="font-bold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-white/60">Total Earnings</span>
                  <span className="font-bold">৳0</span>
                </div>
              </div>
            </div>
            
            <div className="glass-card p-8 bg-gradient-to-br from-orange-600/20 to-transparent">
              <h2 className="text-xl font-display font-bold mb-4">Need Help?</h2>
              <p className="text-sm text-white/60 mb-6">Join our discord community for support and match updates.</p>
              <button className="w-full bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-3 rounded-xl transition-colors">
                Join Discord
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TournamentsPage = ({ user, openAuth, lang }: { user: User | null, openAuth: (mode: 'login' | 'signup') => void, lang: Language }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [registeringId, setRegisteringId] = useState<number | null>(null);
  const [teamName, setTeamName] = useState('');
  const [message, setMessage] = useState('');
  const tc = translations[lang].common;

  useEffect(() => {
    fetch('/api/tournaments').then(res => res.json()).then(setTournaments);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return openAuth('login');
    
    const token = localStorage.getItem('ff_token');
    try {
      const res = await fetch(`/api/tournaments/${registeringId}/register`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ team_name: teamName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setMessage('Registration successful!');
      setTimeout(() => {
        setRegisteringId(null);
        setMessage('');
        setTeamName('');
        // Refresh tournaments
        fetch('/api/tournaments').then(res => res.json()).then(setTournaments);
      }, 2000);
    } catch (err: any) {
      setMessage(err.message);
    }
  };

  return (
    <div className="pt-32 pb-20 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-display font-bold mb-4">{translations[lang].hero.view_schedule}</h1>
          <p className="text-white/60 text-lg">{translations[lang].hero.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {tournaments.map((t: Tournament) => (
            <TournamentCard 
              key={t.id} 
              tournament={t} 
              lang={lang}
              onRegister={(id) => {
                if (!user) return openAuth('login');
                setRegisteringId(id);
              }} 
            />
          ))}
        </div>
      </div>

      {/* Registration Modal */}
      <AnimatePresence>
        {registeringId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setRegisteringId(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              className="glass-card w-full max-w-md p-8 relative z-10"
            >
              <h2 className="text-2xl font-display font-bold mb-4">Tournament Registration</h2>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">Team Name</label>
                  <input
                    type="text"
                    className="input-field"
                    required
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="Enter your squad name"
                  />
                </div>
                {message && <p className={cn("text-sm", message.includes('successful') ? "text-green-500" : "text-red-500")}>{message}</p>}
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setRegisteringId(null)} className="btn-secondary flex-1 py-2">{tc.cancel}</button>
                  <button type="submit" className="btn-primary flex-1 py-2">{tc.confirm || 'Confirm'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authModal, setAuthModal] = useState<{ isOpen: boolean, mode: 'login' | 'signup' }>({ isOpen: false, mode: 'login' });
  const [noticesCount, setNoticesCount] = useState(0);
  const [lang, setLang] = useState<Language>('en');

  useEffect(() => {
    refreshUser();
    fetchNotices();
  }, []);

  const refreshUser = () => {
    const token = localStorage.getItem('ff_token');
    if (token) {
      fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Invalid token');
      })
      .then(setUser)
      .catch(() => {
        localStorage.removeItem('ff_token');
        setUser(null);
      });
    }
  };

  const fetchNotices = () => {
    fetch('/api/notices').then(res => res.json()).then(data => setNoticesCount(data.length));
  };

  const handleAuthSuccess = (token: string, userData: User) => {
    localStorage.setItem('ff_token', token);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('ff_token');
    setUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-[#0a0a0a] selection:bg-orange-600/30 selection:text-orange-500 pb-20 md:pb-0">
        <Navbar 
          user={user} 
          onLogout={handleLogout} 
          openAuth={(mode) => setAuthModal({ isOpen: true, mode })} 
          noticesCount={noticesCount}
          lang={lang}
          setLang={setLang}
        />

        <Routes>
          <Route path="/" element={<LandingPage user={user} openAuth={(mode) => setAuthModal({ isOpen: true, mode })} lang={lang} />} />
          <Route path="/tournaments" element={<TournamentsPage user={user} openAuth={(mode) => setAuthModal({ isOpen: true, mode })} lang={lang} />} />
          <Route path="/wallet" element={user ? <WalletPage user={user} refreshUser={refreshUser} lang={lang} /> : <Navigate to="/" />} />
          <Route path="/profile" element={user ? <ProfilePage user={user} onLogout={handleLogout} refreshUser={refreshUser} lang={lang} /> : <Navigate to="/" />} />
          <Route path="/notices" element={<NoticePage />} />
          <Route path="/admin" element={user ? <AdminPanel user={user} /> : <Navigate to="/" />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
          <Route path="/leaderboard" element={<div className="pt-32 text-center text-white/40">Leaderboard coming soon...</div>} />
        </Routes>

        <BottomNav user={user} />

        <AuthModal 
          isOpen={authModal.isOpen} 
          onClose={() => setAuthModal({ ...authModal, isOpen: false })}
          mode={authModal.mode}
          setMode={(mode) => setAuthModal({ ...authModal, mode })}
          onAuthSuccess={handleAuthSuccess}
          lang={lang}
        />

        <footer className="hidden md:block border-t border-white/10 py-12 px-6 mt-20">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <Target className="w-6 h-6 text-orange-600" />
              <div className="flex flex-col">
                <span className="text-xl font-display font-bold tracking-tighter leading-none">YOUR MEHERUN GAMING</span>
                <span className="text-[10px] text-white/40 font-bold tracking-widest uppercase">YOUR MEHERUN GAMING</span>
              </div>
            </div>
            <div className="flex gap-8 text-sm text-white/40">
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/contact" className="hover:text-white transition-colors">Contact Us</Link>
            </div>
            <div className="text-sm text-white/20">
              © 2026 YOUR MEHERUN GAMING. All rights reserved.
            </div>
          </div>
        </footer>
      </div>
    </Router>
  );
}
