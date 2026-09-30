import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import {
  LayoutDashboard,
  Palette,
  Printer,
  Scissors,
  Package,
  Truck,
  Tag,
  Building2,
  Users,
  Lock,
  Camera,
  FileSpreadsheet,
  Globe,
  Sun,
  Moon,
  LogOut,
  Layers,
  Box,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Menu,
  X,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Building,
  Key
} from 'lucide-react';
import KawanLamaTab from './components/KawanLamaTab';
import LabelGeneratorTab from './components/LabelGeneratorTab';
import MainTrackingTable from './components/MainTrackingTable';
import FinishingPanel from './components/FinishingPanel';
import DesignPanel from './components/DesignPanel';
import PackingPanel from './components/PackingPanel';
import { BranchLoginModal, AdminLoginModal, ScanQCModal, ImagePreviewModal } from './components/Modals';
import CustomModulesIndex from './custom-modules/Index';

const STAFF_QC_LIST = [
  "Budi (QC Paking)", "Siti (QC Paking)", "Agus (QC Checker)",
  "Dewi (QC Checker)", "Eko (QC Deliver)", "Rian (QC Deliver)"
];

// Daftar 4 User Staf Paking Resmi
const PACKING_USERS = [
  { id: 'paking_1', name: 'Staf Paking 1 (Budi)', pin: '1111' },
  { id: 'paking_2', name: 'Staf Paking 2 (Siti)', pin: '2222' },
  { id: 'paking_3', name: 'Staf Paking 3 (Joko)', pin: '3333' },
  { id: 'paking_4', name: 'Staf Paking 4 (Ani)', pin: '4444' }
];

function GaugeArchCard({
  pillTitle,
  centerPercent = 0,
  headline,
  subHeadline,
  buttonLabel,
  isDarkMode,
  arcColor = "#EA580C"
}) {
  const radius = 42;
  const strokeWidth = 9;
  const circumference = Math.PI * radius; // ~131.95 for 180 deg semi-circle
  const safePercent = Math.max(0, Math.min(100, centerPercent));
  const strokeOffset = circumference - (safePercent / 100) * circumference;

  // Calculate tip handle node position along semi-circle arc (from 180 deg left to 0 deg right)
  const angleRad = Math.PI - (safePercent / 100) * Math.PI;
  const nodeX = 60 + radius * Math.cos(angleRad);
  const nodeY = 55 - radius * Math.sin(angleRad);

  return (
    <div className={`p-6 sm:p-7 rounded-[28px] border shadow-xs transition-all duration-200 hover:shadow-md flex flex-col justify-between items-center text-center space-y-4 ${
      isDarkMode ? 'bg-neutral-800 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-black'
    }`}>
      {/* Top Oval Pill Badge (Image 1 Style) */}
      <div>
        <span className="px-5 py-1.5 rounded-full border border-slate-300 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 text-black dark:text-white font-extrabold text-xs shadow-2xs inline-block">
          {pillTitle}
        </span>
      </div>

      {/* Speedo Arch Meter Gauge Chart */}
      <div className="relative w-48 h-32 flex items-center justify-center my-1">
        <svg viewBox="0 0 120 68" className="w-full h-full overflow-visible">
          {/* Outer Dashed Tick Marks (Image 1 Style) */}
          <circle
            cx="60"
            cy="55"
            r={radius + 8}
            stroke={isDarkMode ? '#475569' : '#94A3B8'}
            strokeWidth="1.5"
            strokeDasharray="1.5 5"
            className="fill-none opacity-60"
          />

          {/* Background Arch Track */}
          <path
            d="M 18 55 A 42 42 0 0 1 102 55"
            stroke={isDarkMode ? '#374151' : '#E2E8F0'}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            className="fill-none"
          />

          {/* Filled Progress Arch */}
          {safePercent > 0 && (
            <path
              d="M 18 55 A 42 42 0 0 1 102 55"
              stroke={arcColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              strokeLinecap="round"
              className="fill-none transition-all duration-700 ease-out"
            />
          )}

          {/* Floating Handle Node Indicator */}
          <circle
            cx={nodeX}
            cy={nodeY}
            r="6"
            fill="#FFFFFF"
            stroke={arcColor}
            strokeWidth="3"
            className="shadow-md"
          />
        </svg>

        {/* Big Percentage Number in Center */}
        <div className="absolute bottom-2 flex flex-col items-center justify-center">
          <span className="text-3xl sm:text-4xl font-black text-black dark:text-white tracking-tight leading-none">
            {safePercent}%
          </span>
        </div>
      </div>

      {/* Bottom Headline & Subtitle Text (Solid Black Text) */}
      <div className="space-y-1 w-full pt-1">
        <h3 className="text-base sm:text-lg font-black text-black dark:text-white tracking-tight leading-snug">
          {headline}
        </h3>
        {subHeadline && (
          <p className="text-xs font-bold text-black dark:text-slate-200 leading-relaxed max-w-xs mx-auto">
            {subHeadline}
          </p>
        )}
      </div>

      {/* Bottom Button Action / Pill Tag */}
      {buttonLabel && (
        <div className="pt-2">
          <span className="px-5 py-2 bg-[#EA580C] hover:bg-orange-500 text-white font-extrabold rounded-xl text-xs shadow-sm shadow-orange-600/20 inline-flex items-center gap-1.5 transition-all">
            {buttonLabel}
          </span>
        </div>
      )}
    </div>
  );
}

function GlassmorphismLoginView({
  isBranchMode,
  scanParam,
  PACKING_USERS,
  selectedPackingUser,
  setSelectedPackingUser,
  packingPin,
  setPackingPin,
  handlePackingLoginSubmit,
  onAdminLogin,
  onKawanLamaLogin,
  onBranchLogin
}) {
  const [activeTab, setActiveTab] = useState(isBranchMode ? 'branch' : 'admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setErrorMsg('');
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (activeTab === 'admin') {
        if (username.trim().toLowerCase() === 'packing' && password === 'Paking1') {
          onAdminLogin({ role: 'packing_role', name: 'Packing' });
        } else if (username.toUpperCase() === 'ADMIN' && password === '123456') {
          onAdminLogin({ role: 'admin', name: 'Administrator' });
        } else {
          setErrorMsg('Username atau Password salah!');
        }
      } else if (activeTab === 'kawan_lama') {
        if (username === 'admin_kl' && password === 'kawanlama2026') {
          onKawanLamaLogin({ role: 'admin_kl', name: 'Admin Kawan Lama' });
        } else {
          setErrorMsg('Username atau Password Admin Kawan Lama salah!');
        }
      } else if (activeTab === 'branch') {
        const { data } = await supabase
          .from('kl_branch_access')
          .select('*, kl_branches(branch_name)')
          .eq('access_code', accessCode.toUpperCase())
          .eq('pin_code', pinCode)
          .maybeSingle();

        if (data) {
          onBranchLogin({ role: 'branch', branch_id: data.branch_id, branch_name: data.kl_branches.branch_name });
        } else {
          setErrorMsg('Kode Cabang atau PIN Salah!');
        }
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan sistem!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-950 flex items-center justify-center p-4 sm:p-6 select-none font-sans">
      {/* Colorful Gradient Ambient Light Orbs (Matching Image 2 Liquid Background) */}
      <div className="absolute top-[-10%] left-[-10%] w-[520px] h-[520px] rounded-full bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-500 opacity-60 blur-[130px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[520px] h-[520px] rounded-full bg-gradient-to-bl from-indigo-600 via-purple-600 to-pink-600 opacity-60 blur-[130px] pointer-events-none animate-pulse" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full bg-gradient-to-r from-orange-500/25 via-rose-500/25 to-indigo-500/25 blur-[150px] pointer-events-none" />

      {/* Glassmorphism Main Card */}
      <div className="relative z-10 w-full max-w-md p-8 sm:p-10 rounded-[32px] bg-white/10 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/20 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] text-white space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Sign in</h1>
          <p className="text-sm text-white/80 font-normal">
            {scanParam ? 'Good to see you again. (Paking Mode)' : 'Good to see you again.'}
          </p>
        </div>

        {scanParam ? (
          /* Packing Staff Form */
          <form onSubmit={handlePackingLoginSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-white/90 block mb-1.5">Pilih Staf Paking</label>
              <select
                value={selectedPackingUser}
                onChange={(e) => setSelectedPackingUser(e.target.value)}
                className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15 text-white focus:outline-none transition-all text-sm font-medium cursor-pointer"
              >
                {PACKING_USERS.map(u => (
                  <option key={u.id} value={u.id} className="bg-slate-900 text-white">{u.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/90 block mb-1.5">PIN Keamanan</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  value={packingPin}
                  onChange={(e) => setPackingPin(e.target.value)}
                  placeholder="Masukkan 4 digit PIN"
                  maxLength={4}
                  required
                  className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15 text-white placeholder-white/40 focus:outline-none transition-all text-sm tracking-widest text-center font-bold pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-white/60 hover:text-white transition-all p-1 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-white text-slate-900 hover:bg-slate-100 font-extrabold py-3.5 px-6 rounded-2xl shadow-xl transition-all duration-150 active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              Sign in <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        ) : (
          /* Portal Login Form (Admin / Kawan Lama / Branch) */
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab !== 'branch' ? (
              <>
                <div>
                  <label className="text-xs font-semibold text-white/90 block mb-1.5">
                    {activeTab === 'admin' ? 'Username' : 'Email address'}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={activeTab === 'admin' ? 'ADMIN' : 'admin_kl'}
                    required
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15 text-white placeholder-white/40 focus:outline-none transition-all text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/90 block mb-1.5">Password</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15 text-white placeholder-white/40 focus:outline-none transition-all text-sm font-medium pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-white/60 hover:text-white transition-all p-1 cursor-pointer"
                      title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="text-xs font-semibold text-white/90 block mb-1.5">Kode Cabang</label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="AZKO-001"
                    required
                    className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15 text-white placeholder-white/40 focus:outline-none transition-all text-sm font-medium uppercase"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-white/90 block mb-1.5">PIN 6 Digit</label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={pinCode}
                      onChange={(e) => setPinCode(e.target.value)}
                      placeholder="••••••"
                      maxLength={6}
                      required
                      className="w-full px-4 py-3.5 rounded-2xl bg-white/10 border border-white/20 focus:border-white/50 focus:bg-white/15 text-white placeholder-white/40 focus:outline-none transition-all text-sm font-medium tracking-widest text-center pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-white/60 hover:text-white transition-all p-1 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Remember me & Forgot Password */}
            <div className="flex items-center justify-between text-xs text-white/80 pt-1">
              <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-white/30 bg-white/10 text-orange-500 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Remember me</span>
              </label>
              <span className="hover:underline cursor-pointer opacity-80 hover:opacity-100">Forgot password?</span>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-2xl bg-rose-500/20 border border-rose-500/30 text-rose-200 text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-white text-slate-900 hover:bg-slate-100 font-extrabold py-3.5 px-6 rounded-2xl shadow-xl transition-all duration-150 active:scale-[0.98] text-sm flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Sign in'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        {/* Divider & Role Pills */}
        {!scanParam && (
          <div className="space-y-4 pt-2">
            <div className="relative flex items-center justify-center">
              <div className="border-t border-white/20 w-full" />
              <span className="bg-slate-900/30 backdrop-blur-md px-3 text-[11px] text-white/70 uppercase tracking-wider font-medium shrink-0">
                or continue with
              </span>
              <div className="border-t border-white/20 w-full" />
            </div>

            {/* Role Pills matching bottom icons in Image 2 */}
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-white/25 border-white/60 text-white shadow-lg backdrop-blur-md'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Key className="w-4 h-4 text-amber-300" />
                <span>Admin Pusat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('kawan_lama')}
                className={`py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'kawan_lama'
                    ? 'bg-white/25 border-white/60 text-white shadow-lg backdrop-blur-md'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Shield className="w-4 h-4 text-emerald-300" />
                <span>Admin KL</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('branch')}
                className={`py-3 px-2 rounded-2xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition-all cursor-pointer ${
                  activeTab === 'branch'
                    ? 'bg-white/25 border-white/60 text-white shadow-lg backdrop-blur-md'
                    : 'bg-white/5 border-white/15 text-white/70 hover:bg-white/15 hover:text-white'
                }`}
              >
                <Building className="w-4 h-4 text-sky-300" />
                <span>Cabang</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Subtitle / Demo text matching Image 2 */}
        <div className="text-center pt-1">
          <p className="text-[11px] text-white/50 tracking-wide font-normal">
            Demo — Web-Track Monitoring Portal
          </p>
        </div>

      </div>
    </div>
  );
}

function ComingSoonDashboardView({ title = 'PRODUCTION DASHBOARD' }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const seconds = time.getSeconds();
  const minutes = time.getMinutes();
  const hours = time.getHours() % 12;

  const secondDeg = seconds * 6; // 360 / 60
  const minuteDeg = minutes * 6 + seconds * 0.1;
  const hourDeg = hours * 30 + minutes * 0.5;

  return (
    <div className="relative w-full min-h-[580px] rounded-[32px] overflow-hidden bg-slate-950 text-white flex flex-col items-center justify-center p-8 sm:p-12 shadow-2xl border border-white/10 select-none">

      {/* Dark Cinematic Background Overlay with Image */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 filter grayscale contrast-150 scale-105 pointer-events-none"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=1600&auto=format&fit=crop')` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-slate-950/60 pointer-events-none" />

      {/* Clock Face Dial & Ticks Overlay */}
      <div className="relative z-10 w-[360px] h-[360px] sm:w-[420px] sm:h-[420px] flex items-center justify-center">

        {/* SVG Clock Ticks & Live Hands */}
        <svg viewBox="0 0 300 300" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none">
          {/* 12 Radial Ticks */}
          {[...Array(12)].map((_, i) => {
            const angle = i * 30 * (Math.PI / 180);
            const x1 = 150 + 120 * Math.sin(angle);
            const y1 = 150 - 120 * Math.cos(angle);
            const x2 = 150 + 135 * Math.sin(angle);
            const y2 = 150 - 135 * Math.cos(angle);
            return (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#FFFFFF"
                strokeWidth={i % 3 === 0 ? "3" : "1.5"}
                strokeLinecap="round"
                className="opacity-80"
              />
            );
          })}

          {/* Hour Hand (Thick White) */}
          <line
            x1="150"
            y1="150"
            x2="150"
            y2="85"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
            style={{
              transformOrigin: '150px 150px',
              transform: `rotate(${hourDeg}deg)`
            }}
          />

          {/* Minute Hand (Medium White) */}
          <line
            x1="150"
            y1="150"
            x2="150"
            y2="60"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            style={{
              transformOrigin: '150px 150px',
              transform: `rotate(${minuteDeg}deg)`
            }}
          />

          {/* Red Second Hand (Thin Red Line Extending Through Center) */}
          <line
            x1="150"
            y1="200"
            x2="150"
            y2="30"
            stroke="#E51B24"
            strokeWidth="2"
            strokeLinecap="round"
            style={{
              transformOrigin: '150px 150px',
              transform: `rotate(${secondDeg}deg)`
            }}
          />

          {/* Center Red Pivot Dot */}
          <circle cx="150" cy="150" r="4.5" fill="#E51B24" stroke="#FFFFFF" strokeWidth="1.5" />
        </svg>

        {/* Center Typography Overlay */}
        <div className="relative z-20 flex flex-col items-center justify-center text-center px-4 pointer-events-auto space-y-2">

          <p className="text-xs sm:text-sm font-extrabold tracking-[0.35em] text-white/80 uppercase">
            {title} IS
          </p>

          <h1 className="text-5xl sm:text-7xl font-black tracking-[0.2em] text-white uppercase leading-none py-1 drop-shadow-2xl">
            COMING<br />SOON
          </h1>

          <p className="text-xs sm:text-sm font-extrabold tracking-[0.35em] text-white/90 uppercase pt-2">
            STAY TUNED!
          </p>
        </div>

      </div>
    </div>
  );
}

export default function App() {
  const searchParams = new URLSearchParams(window.location.search);
  const isBranchMode = searchParams.get('mode') === 'cabang';
  const scanParam = searchParams.get('scan'); 

  const [spkList, setSpkList] = useState([]);
  
  const [currentKawanLamaAdmin, setCurrentKawanLamaAdmin] = useState(() => {
    const s = localStorage.getItem('kl_special_admin_session');
    return s ? JSON.parse(s) : null;
  });

  const [activeTab, setActiveTab] = useState(
    scanParam ? 'paking' : (currentKawanLamaAdmin ? 'label' : (isBranchMode ? 'kawan_lama' : 'dashboard'))
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (currentAdmin?.role === 'packing_role') {
      setActiveTab('paking');
    }
  }, [currentAdmin]);

  const [searchTerm, setSearchTerm] = useState(scanParam || ''); 
  const [selectedSpkIds, setSelectedSpkIds] = useState([]);
  const [modalImageInfo, setModalImageModalInfo] = useState({ isOpen: false, url: '', title: '' });
  
  const [showScanModal, setShowScanModal] = useState(false);
  const [scanTargetColumn, setScanTargetColumn] = useState('qc_checker');
  const [qcStaffName, setQcStaffName] = useState(STAFF_QC_LIST[2]);
  const [scannedInput, setScannedInput] = useState('');
  const [lastScanMessage, setLastScanMessage] = useState('');
  const [selectedSpkId, setSelectedSpkId] = useState('');
  const [finishingForm, setFinishingForm] = useState({ finishing_type: 'inhouse', sub_vendor_name: '', qty_finish_sub_out: 0, qty_finish: 0 });
  const [isImporting, setIsImporting] = useState(false);

  const [currentAdmin, setCurrentAdmin] = useState(() => { 
    const s = localStorage.getItem('kl_admin_session'); 
    return s ? JSON.parse(s) : null; 
  });
  
  const [currentBranch, setCurrentBranch] = useState(() => { 
    const s = localStorage.getItem('kl_branch_session'); 
    return s ? JSON.parse(s) : null; 
  });

  const [packingStaffSession, setPackingStaffSession] = useState(() => {
    const s = localStorage.getItem('packing_staff_session');
    return s ? JSON.parse(s) : null;
  });
  const [selectedPackingUser, setSelectedPackingUser] = useState(PACKING_USERS[0].id);
  const [packingPin, setPackingPin] = useState('');

  const [showKawanLamaAdminModal, setShowKawanLamaAdminModal] = useState(false);
  const [klAdminUser, setKlAdminUser] = useState('');
  const [klAdminPass, setKlAdminPass] = useState('');

  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [showBranchLoginModal, setShowBranchLoginModal] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  useEffect(() => {
    if (scanParam) {
      setActiveTab('paking');
      setSearchTerm(scanParam); 
    }
  }, [scanParam]);

  useEffect(() => {
    const viewImgParam = searchParams.get('viewImg');
    if (viewImgParam) {
      const title = searchParams.get('title') || 'Bukti Paking';
      const storeName = searchParams.get('store') || '';
      const projectName = searchParams.get('project') || '';
      const spkNo = searchParams.get('spk') || '';
      openImageModal(viewImgParam, title, storeName, projectName, spkNo);
    }
  }, []);

  useEffect(() => { 
    if (isBranchMode && !currentBranch) {
      setShowBranchLoginModal(true); 
    }
  }, [isBranchMode, currentBranch]);

  useEffect(() => { 
    fetchSpkData(); 

    const channel = supabase
      .channel('spk_data_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'spk_data' },
        () => {
          fetchSpkData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const openImageModal = (url, title, storeName = '', projectName = '', spkNo = '') => {
    if (url) setModalImageModalInfo({ isOpen: true, url, title: title || 'Preview', storeName, projectName, spkNo });
  };
  const closeImageModal = () => setModalImageModalInfo({ isOpen: false, url: '', title: '', storeName: '', projectName: '', spkNo: '' });
  const toggleTheme = () => setIsDarkMode(prev => { localStorage.setItem('theme', !prev ? 'dark' : 'light'); return !prev; });

  const fetchSpkData = async () => {
    const { data } = await supabase
      .from('spk_data')
      .select('*')
      .order('id', { ascending: false });

    if (data) { 
      setSpkList(data); 
      if (data.length > 0 && !selectedSpkId) initFinishingForm(data[0]); 
    }
  };

  const initFinishingForm = (item) => {
    if (!item) return; 
    setSelectedSpkId(item.id);
    setFinishingForm({ 
      finishing_type: item.finishing_type || 'inhouse', 
      sub_vendor_name: item.sub_vendor_name || '', 
      qty_finish_sub_out: item.qty_finish_sub_out || 0, 
      qty_finish: item.qty_finish || 0 
    });
  };

  const handleSelectSpk = (spkId) => {
    setSelectedSpkId(spkId); 
    const item = spkList.find(s => String(s.id) === String(spkId));
    if (item) {
      setFinishingForm({ 
        finishing_type: item.finishing_type || 'inhouse', 
        sub_vendor_name: item.sub_vendor_name || '', 
        qty_finish_sub_out: item.qty_finish_sub_out || 0, 
        qty_finish: item.qty_finish || 0 
      });
    }
  };

  const handleToggleCheck = (id) => {
    setSelectedSpkIds(prev => { 
      const exist = prev.includes(id); 
      if (!exist) handleSelectSpk(id); 
      return exist ? prev.filter(item => item !== id) : [...prev, id]; 
    });
  };

  const handleToggleSelectAll = (filteredItems) => {
    if (selectedSpkIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedSpkIds([]);
    } else { 
      setSelectedSpkIds(filteredItems.map(item => item.id)); 
      if (filteredItems.length > 0) handleSelectSpk(filteredItems[0].id); 
    }
  };

  const handleUpdateField = async (id, payload) => {
    const { error } = await supabase.from('spk_data').update(payload).eq('id', id);
    if (!error) {
      setSpkList(prev => prev.map(item => item.id === id ? { ...item, ...payload } : item));
    } else {
      alert('Gagal memperbarui data: ' + error.message);
    }
  };

  const handleUpdateQty = async (id, field, value, maxAllowed, customErrorMessage) => {
    const val = Number(value) || 0;
    if (maxAllowed && val > maxAllowed) return alert(customErrorMessage || `❌ Gagal: Jumlah tidak boleh melebihi ${maxAllowed.toLocaleString()} pcs!`);
    handleUpdateField(id, { [field]: val });
  };

  const handleDeleteSpk = async (id, noSpk) => {
    if (confirm(`⚠️ Hapus data SPK "${noSpk || id}" dari sistem?`)) {
      const { error } = await supabase.from('spk_data').delete().eq('id', id);
      if (!error) {
        setSpkList(prev => prev.filter(item => item.id !== id));
        setSelectedSpkIds(prev => prev.filter(selectedId => selectedId !== id));
        alert(`✅ SPK "${noSpk}" berhasil dihapus.`);
      } else {
        alert('Gagal menghapus SPK: ' + error.message);
      }
    }
  };

  const handleBatchDelete = async () => {
    if (selectedSpkIds.length === 0) return alert('⚠️ Silakan centang minimal 1 SPK yang ingin dihapus!');
    if (confirm(`🚨 YAKIN HAPUS ${selectedSpkIds.length} DATA SPK TERPILIH? Tindakan ini tidak dapat dibatalkan.`)) {
      const { error } = await supabase.from('spk_data').delete().in('id', selectedSpkIds);
      if (!error) {
        setSpkList(prev => prev.filter(item => !selectedSpkIds.includes(item.id)));
        setSelectedSpkIds([]);
        alert('✅ Semua SPK terpilih berhasil dibersihkan.');
      } else {
        alert('Gagal hapus massal: ' + error.message);
      }
    }
  };

  const handleProcessScan = async (codeValue) => {
    if (!codeValue) return;
    const cleanCode = codeValue.toString().replace(/[\r\n]+/g, '').trim().toLowerCase();
    const targetItem = spkList.find(item => 
      (item.qr_address || '').toLowerCase().includes(cleanCode) || 
      (item.store_code || '').toLowerCase() === cleanCode || 
      (item.no_spk || '').toLowerCase().includes(cleanCode) || 
      (item.project || '').toLowerCase().includes(cleanCode)
    );
    if (!targetItem) { 
      setLastScanMessage(`❌ SPK "${cleanCode}" tidak ditemukan!`); 
      setScannedInput(''); 
      return; 
    }
    
    const updaterValue = qcStaffName ? `${qcStaffName} (OK)` : 'VERIFIED (OK)';
    let updatePayload = { tes_scan: updaterValue };
    if (scanTargetColumn === 'qc_paking') updatePayload.qc_paking = updaterValue;
    if (scanTargetColumn === 'qc_checker') updatePayload.qc_checker = updaterValue;
    if (scanTargetColumn === 'qc_deliver') updatePayload.qc_deliver = updaterValue;
    if (scanTargetColumn === 'qty_finish') updatePayload.qty_finish = targetItem.qty_order;

    await handleUpdateField(targetItem.id, updatePayload);
    setLastScanMessage(`✅ SUKSES UPDATE SPK ${targetItem.no_spk}!`); 
    setScannedInput('');
  };

  const handleSubmitInput = (e) => { e.preventDefault(); handleProcessScan(scannedInput); };

  const handleBatchPrint = async () => {
    const items = spkList.filter(item => selectedSpkIds.includes(item.id));
    if (items.length === 0) return alert('⚠️ Centang minimal 1 SPK!');
    const html = items.map(item => `<div style="page-break-after:always; padding:20px; font-family:Arial; border:2px solid #000;"><h2>STORE: ${item.project}</h2><p>SPK: ${item.no_spk}</p></div>`).join('');
    const pw = window.open('', '_blank', 'width=800,height=800'); 
    pw.document.write(`<html><body>${html}</body></html>`); 
    pw.document.close(); 
    setTimeout(() => pw.print(), 500);
  };

  const handleUploadSuratJalan = async (e, item) => {
    const file = e.target.files[0]; 
    if (!file) return;
    const fileName = `sj_${item.no_spk}_${Date.now()}`;
    const { error } = await supabase.storage.from('surat-jalan').upload(fileName, file);
    if (!error) {
      const { data } = supabase.storage.from('surat-jalan').getPublicUrl(fileName);
      handleUpdateField(item.id, { surat_jalan_url: data.publicUrl });
      alert('Surat Jalan Diunggah!');
    }
  };

  const processImportData = async (rawRows) => {
    const formattedData = rawRows
      .filter(row => row && row.length > 7) 
      .map((row, index) => {
        const colF = row[5] ? String(row[5]).trim() : ''; 
        const colG = row[6] ? String(row[6]).trim() : ''; 
        const colH = row[7] ? String(row[7]).trim() : ''; 

        if (!colF && !colG && !colH) return null;

        return {
          no_spk: colH.split('_')[0] || `SPK-${index + 1}`,
          client: colF || '-',
          project: colG || '-',
          bahan: null,       
          ukuran: null,      
          qty_order: null,   
          qty_print: 0, 
          qty_finish: 0, 
          qty_pack: 0, 
          qty_ship: 0,
          store_code: colH || '-',
          delivery_route: '-'
        };
      })
      .filter(item => item !== null);

    if (formattedData.length > 0) {
      const { error } = await supabase.from('spk_data').insert(formattedData);
      if (error) {
        alert("❌ Error saat menyimpan ke database: " + error.message);
      } else {
        alert(`✅ Sukses! ${formattedData.length} data berhasil diimpor.`);
        await fetchSpkData();
      }
    } else {
      alert("⚠️ Tidak ada data ditemukan pada Kolom F, G, H mulai baris ke-5.");
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const rawData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { range: 4, header: 1 });
      await processImportData(rawData);
    };
    reader.readAsBinaryString(file); e.target.value = '';
  };

  const handleGoogleSheetImport = async () => {
    const sheetUrl = prompt("🌐 Masukkan URL Link Google Sheets (Pastikan akses disetel 'Anyone with the link can view' / Publik):");
    if (!sheetUrl) return;

    setIsImporting(true);
    try {
      let csvUrl = sheetUrl.trim();
      if (csvUrl.includes('/edit')) {
        csvUrl = csvUrl.replace(/\/edit.*$/, '/export?format=csv');
      }
      if (!csvUrl.includes('format=csv')) {
        csvUrl += (csvUrl.includes('?') ? '&' : '?') + 'format=csv';
      }

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error(`Gagal mengambil data (Status: ${response.status}). Pastikan link Google Sheets sudah publik.`);
      }
      
      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: 'string' });
      const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { range: 4, header: 1 });
      
      await processImportData(rawData);
    } catch (err) {
      alert("❌ Terjadi kesalahan saat import Google Sheets: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handlePackingLoginSubmit = (e) => {
    e.preventDefault();
    const foundUser = PACKING_USERS.find(u => u.id === selectedPackingUser);
    if (foundUser && foundUser.pin === packingPin.trim()) {
      const sessionData = { username: foundUser.name, loginTime: new Date().toISOString() };
      localStorage.setItem('packing_staff_session', JSON.stringify(sessionData));
      setPackingStaffSession(sessionData);
      alert(`✅ Selamat datang, ${foundUser.name}!`);
    } else {
      alert('❌ PIN Staf Paking salah! (Gunakan PIN sesuai akun masing-masing: 1111, 2222, 3333, atau 4444)');
    }
  };

  const handleKawanLamaAdminLogin = (e) => {
    e.preventDefault();
    if (klAdminUser.trim() === 'admin_kl' && klAdminPass.trim() === 'kawanlama2026') {
      const sessionData = { username: 'Admin Kawan Lama', loginTime: new Date().toISOString() };
      localStorage.setItem('kl_special_admin_session', JSON.stringify(sessionData));
      setCurrentKawanLamaAdmin(sessionData);
      setShowKawanLamaAdminModal(false);
      setActiveTab('label');
      alert('✅ Berhasil Login sebagai Admin Kawan Lama!');
    } else {
      alert('❌ Username atau Password Admin Kawan Lama salah!');
    }
  };

  const getPercent = (qty, total) => (!total || total <= 0) ? 0 : Math.min(100, Math.round((qty / total) * 100));
  const getStatusBadge = (p) => p >= 100 ? { text: 'text-green-800 bg-green-100', icon: '🟢' } : p > 0 ? { text: 'text-yellow-800 bg-yellow-100', icon: '🟡' } : { text: 'text-red-800 bg-red-100', icon: '🔴' };

  const totalSpk = spkList.length;
  const displayedList = spkList.filter(item => 
    (item.no_spk || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (item.project || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.client || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.store_code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isAuthenticated = scanParam 
    ? (packingStaffSession || currentAdmin || currentKawanLamaAdmin) 
    : isBranchMode 
      ? currentBranch 
      : (currentAdmin || currentKawanLamaAdmin);

  if (!isAuthenticated) {
    return (
      <GlassmorphismLoginView
        isBranchMode={isBranchMode}
        scanParam={scanParam}
        PACKING_USERS={PACKING_USERS}
        selectedPackingUser={selectedPackingUser}
        setSelectedPackingUser={setSelectedPackingUser}
        packingPin={packingPin}
        setPackingPin={setPackingPin}
        handlePackingLoginSubmit={handlePackingLoginSubmit}
        onAdminLogin={(admin) => {
          localStorage.setItem('kl_admin_session', JSON.stringify(admin));
          setCurrentAdmin(admin);
        }}
        onKawanLamaLogin={(klAdmin) => {
          localStorage.setItem('kl_special_admin_session', JSON.stringify(klAdmin));
          setCurrentKawanLamaAdmin(klAdmin);
        }}
        onBranchLogin={(branch) => {
          localStorage.setItem('kl_branch_session', JSON.stringify(branch));
          setCurrentBranch(branch);
        }}
      />
    );
  }

  return (
    <div className={`min-h-screen p-4 sm:p-6 font-sans antialiased transition-colors duration-300 ${isDarkMode ? 'bg-neutral-900 text-neutral-100' : 'bg-[#F4F5F7] text-stone-800'}`}>
      <div className="max-w-[1700px] w-full mx-auto space-y-6">
        
        {/* HEADER BAR */}
        <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 rounded-3xl shadow-sm border transition-colors ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700' : 'bg-white border-stone-200/80'}`}>
          <div className="flex items-center gap-3.5">
            {/* GB3 Precise Vertical Curved Bars Logo */}
            <svg viewBox="0 0 26 30" className="w-6 h-7 shrink-0 overflow-visible" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="8" width="6" height="22" rx="3" fill="#FFE600" />
              <rect x="8" y="4" width="6" height="26" rx="3" fill="#FF7A00" />
              <rect x="16" y="0" width="6" height="30" rx="3" fill="#E51B24" />
            </svg>
            <div>
              <h1 className={`text-base font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Web Tracking Monitoring
              </h1>
              <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {scanParam ? `Staf Paking Login: ${packingStaffSession?.username || 'Aktif'}` : (isBranchMode ? `Login Cabang: ${currentBranch?.branch_name || 'Aktif'}` : (currentKawanLamaAdmin ? 'Login: Admin Kawan Lama (Akses 3 Tab)' : `Admin Login: Aktif`))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap mt-3 sm:mt-0">
            {/* Theme Toggle Pill Button Matching Reference */}
            <button
              onClick={toggleTheme}
              className={`px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border shadow-2xs cursor-pointer ${
                isDarkMode
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-amber-300 border-neutral-700'
                  : 'bg-slate-100/80 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
              <span>{isDarkMode ? 'Tema Terang' : 'Tema Gelap'}</span>
            </button>

            {/* Logout Red Pill Button Matching Reference */}
            {scanParam && (
              <button
                onClick={() => { localStorage.removeItem('packing_staff_session'); setPackingStaffSession(null); window.location.href = window.location.pathname; }}
                className="px-5 py-2 bg-[#E11D48] hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Logout Staf Paking
              </button>
            )}
            {isBranchMode && (
              <button
                onClick={() => { localStorage.removeItem('kl_branch_session'); setCurrentBranch(null); window.location.reload(); }}
                className="px-5 py-2 bg-[#E11D48] hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Logout Cabang
              </button>
            )}
            {currentKawanLamaAdmin && (
              <button
                onClick={() => { localStorage.removeItem('kl_special_admin_session'); setCurrentKawanLamaAdmin(null); window.location.reload(); }}
                className="px-5 py-2 bg-[#E11D48] hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Logout Admin KL
              </button>
            )}
            {currentAdmin && (
              <button
                onClick={() => { localStorage.removeItem('kl_admin_session'); setCurrentAdmin(null); setActiveTab('dashboard'); }}
                className="px-5 py-2 bg-[#E11D48] hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <LogOut className="w-4 h-4" /> Logout Admin
              </button>
            )}
          </div>
        </div>

        {/* MAIN BODY AREA */}
        {scanParam ? (
          <PackingPanel isDarkMode={isDarkMode} spkList={displayedList} handleUpdateField={handleUpdateField} onOpenImageModal={openImageModal} isPackingRole={currentAdmin?.role === 'packing_role'} />
        ) : (
          <>
            {isBranchMode ? (
              <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentBranch} isBranchMode={true} />
            ) : (
              <div className="flex flex-col lg:flex-row gap-6 items-start">

                {/* MODERN SIDEBAR NAVIGATION MATCHING REFERENCE IMAGE */}
                <div className={`transition-all duration-300 ease-in-out flex-shrink-0 rounded-3xl p-4 border shadow-sm space-y-5 sticky top-6 ${
                  isSidebarCollapsed ? 'w-full lg:w-20' : 'w-full lg:w-64'
                } ${isDarkMode ? 'bg-neutral-800/90 border-neutral-700/80 text-white' : 'bg-white border-slate-200/80 text-slate-900'}`}>

                  <div className="flex items-center justify-between px-2 pb-3 border-b border-slate-200/60 dark:border-neutral-700/60">
                    {!isSidebarCollapsed && (
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">NAVIGASI</span>
                    )}
                    <button
                      onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                      className="p-1.5 rounded-xl bg-slate-100 dark:bg-neutral-700 hover:bg-slate-200 dark:hover:bg-neutral-600 text-slate-700 dark:text-slate-200 transition-all cursor-pointer shadow-2xs mx-auto lg:mx-0 flex items-center justify-center"
                      title={isSidebarCollapsed ? "Buka Sidebar" : "Tutup Sidebar"}
                    >
                      {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                    </button>
                  </div>

                  {currentAdmin?.role === 'packing_role' ? (
                    <div>
                      {!isSidebarCollapsed && (
                        <h3 className={`text-[11px] font-bold uppercase tracking-wider px-3 mb-2 ${
                          isDarkMode ? 'text-neutral-400' : 'text-slate-400'
                        }`}>
                          Menu Paking
                        </h3>
                      )}
                      <div className="space-y-1">
                        {[
                          { id: 'paking', label: 'Paking Station', icon: Package }
                        ].map(item => {
                          const isActive = activeTab === item.id;
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              title={isSidebarCollapsed ? item.label : ""}
                              className={`group w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl text-xs sm:text-[13px] transition-all cursor-pointer ${
                                isActive
                                  ? (isDarkMode ? 'bg-blue-950/70 text-blue-400 border border-blue-800/80 font-semibold' : 'bg-[#ebf3fe] text-[#2563eb] border border-[#d2e3fc] font-semibold')
                                  : (isDarkMode ? 'text-neutral-300 hover:text-white hover:bg-neutral-700/50 font-medium' : 'text-[#374151] hover:text-[#111827] hover:bg-slate-100/80 font-medium')
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <ItemIcon className={`w-4 h-4 flex-shrink-0 ${
                                  isActive
                                    ? (isDarkMode ? 'text-blue-400' : 'text-[#2563eb]')
                                    : (isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-[#6b7280] group-hover:text-[#374151]')
                                }`} />
                                {!isSidebarCollapsed && <span>{item.label}</span>}
                              </div>
                              {!isSidebarCollapsed && isActive && <ChevronRight className={`w-4 h-4 ml-auto ${isDarkMode ? 'text-blue-400' : 'text-[#2563eb]'}`} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : currentKawanLamaAdmin ? (
                    <div>
                      {!isSidebarCollapsed && (
                        <h3 className={`text-[11px] font-bold uppercase tracking-wider px-3 mb-2 ${
                          isDarkMode ? 'text-neutral-400' : 'text-slate-400'
                        }`}>
                          Portal Admin Kawan Lama
                        </h3>
                      )}
                      <div className="space-y-1">
                        {[
                          { id: 'label', label: 'Cetak Label & SJ', icon: Tag },
                          { id: 'kawan_lama', label: 'Project Kawan Lama', icon: Building2 },
                          { id: 'custom_modules', label: 'Customer & Label Custom', icon: Users }
                        ].map(item => {
                          const isActive = activeTab === item.id;
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => setActiveTab(item.id)}
                              title={isSidebarCollapsed ? item.label : ""}
                              className={`group w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl text-xs sm:text-[13px] transition-all cursor-pointer ${
                                isActive
                                  ? (isDarkMode ? 'bg-blue-950/70 text-blue-400 border border-blue-800/80 font-semibold' : 'bg-[#ebf3fe] text-[#2563eb] border border-[#d2e3fc] font-semibold')
                                  : (isDarkMode ? 'text-neutral-300 hover:text-white hover:bg-neutral-700/50 font-medium' : 'text-[#374151] hover:text-[#111827] hover:bg-slate-100/80 font-medium')
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <ItemIcon className={`w-4 h-4 flex-shrink-0 ${
                                  isActive
                                    ? (isDarkMode ? 'text-blue-400' : 'text-[#2563eb]')
                                    : (isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-[#6b7280] group-hover:text-[#374151]')
                                }`} />
                                {!isSidebarCollapsed && <span>{item.label}</span>}
                              </div>
                              {!isSidebarCollapsed && isActive && <ChevronRight className={`w-4 h-4 ml-auto ${isDarkMode ? 'text-blue-400' : 'text-[#2563eb]'}`} />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* GROUP 1: PRODUKSI & MONITORING */}
                      <div>
                        {!isSidebarCollapsed && (
                          <h3 className={`text-[11px] font-bold uppercase tracking-wider px-3 mb-2 ${
                            isDarkMode ? 'text-neutral-400' : 'text-slate-400'
                          }`}>
                            PRODUKSI & MONITORING
                          </h3>
                        )}
                        <div className="space-y-1">
                          {[
                            { id: 'dashboard', label: 'Production Dashboard', icon: LayoutDashboard },
                            { id: 'design', label: 'Desk Print', icon: Palette },
                            { id: 'produksi', label: 'Produksi Cetak', icon: Printer },
                            { id: 'finishing', label: 'Finishing Panel', icon: Scissors },
                            { id: 'paking', label: 'Paking Station', icon: Package },
                            { id: 'pengiriman', label: 'Pengiriman & SJ', icon: Truck }
                          ].map(item => {
                            const isActive = activeTab === item.id;
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                title={isSidebarCollapsed ? item.label : ""}
                                className={`group w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl text-xs sm:text-[13px] transition-all cursor-pointer ${
                                  isActive
                                    ? (isDarkMode ? 'bg-blue-950/70 text-blue-400 border border-blue-800/80 font-semibold' : 'bg-[#ebf3fe] text-[#2563eb] border border-[#d2e3fc] font-semibold')
                                    : (isDarkMode ? 'text-neutral-300 hover:text-white hover:bg-neutral-700/50 font-medium' : 'text-[#374151] hover:text-[#111827] hover:bg-slate-100/80 font-medium')
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <ItemIcon className={`w-4 h-4 flex-shrink-0 ${
                                    isActive
                                      ? (isDarkMode ? 'text-blue-400' : 'text-[#2563eb]')
                                      : (isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-[#6b7280] group-hover:text-[#374151]')
                                  }`} />
                                  {!isSidebarCollapsed && <span>{item.label}</span>}
                                </div>
                                {!isSidebarCollapsed && isActive && <ChevronRight className={`w-4 h-4 ml-auto ${isDarkMode ? 'text-blue-400' : 'text-[#2563eb]'}`} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* GROUP 2: PROJECT & CUSTOM MODUL */}
                      <div>
                        {!isSidebarCollapsed && (
                          <h3 className={`text-[11px] font-bold uppercase tracking-wider px-3 mb-2 ${
                            isDarkMode ? 'text-neutral-400' : 'text-slate-400'
                          }`}>
                            PROJECT & CUSTOM MODUL
                          </h3>
                        )}
                        <div className="space-y-1">
                          {[
                            { id: 'label', label: 'Cetak Label & SJ', icon: Tag },
                            { id: 'kawan_lama', label: 'Project Kawan Lama', icon: Building2 },
                            { id: 'custom_modules', label: 'Customer & Label Custom', icon: Users }
                          ].map(item => {
                            const isLocked = item.id === 'kawan_lama' && !currentAdmin;
                            const isActive = activeTab === item.id;
                            const ItemIcon = item.icon;
                            return (
                              <button
                                key={item.id}
                                onClick={() => !isLocked && setActiveTab(item.id)}
                                disabled={isLocked}
                                title={isLocked ? "Silakan Login Admin terlebih dahulu" : (isSidebarCollapsed ? item.label : "")}
                                className={`group w-full flex items-center ${isSidebarCollapsed ? 'justify-center p-3' : 'justify-between px-3.5 py-2.5'} rounded-2xl text-xs sm:text-[13px] transition-all cursor-pointer ${
                                  isLocked
                                    ? 'cursor-not-allowed bg-stone-50/50 dark:bg-neutral-900/40 text-slate-400 font-medium'
                                    : isActive
                                      ? (isDarkMode ? 'bg-blue-950/70 text-blue-400 border border-blue-800/80 font-semibold' : 'bg-[#ebf3fe] text-[#2563eb] border border-[#d2e3fc] font-semibold')
                                      : (isDarkMode ? 'text-neutral-300 hover:text-white hover:bg-neutral-700/50 font-medium' : 'text-[#374151] hover:text-[#111827] hover:bg-slate-100/80 font-medium')
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <ItemIcon className={`w-4 h-4 flex-shrink-0 ${
                                    isLocked
                                      ? 'text-slate-400'
                                      : isActive
                                        ? (isDarkMode ? 'text-blue-400' : 'text-[#2563eb]')
                                        : (isDarkMode ? 'text-neutral-400 group-hover:text-neutral-200' : 'text-[#6b7280] group-hover:text-[#374151]')
                                  }`} />
                                  {!isSidebarCollapsed && <span>{item.label}</span>}
                                </div>
                                {isLocked ? (
                                  !isSidebarCollapsed && <Lock className="w-3.5 h-3.5 text-amber-500/80" />
                                ) : (
                                  !isSidebarCollapsed && isActive && <ChevronRight className={`w-4 h-4 ml-auto ${isDarkMode ? 'text-blue-400' : 'text-[#2563eb]'}`} />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                </div>

                {/* MAIN PANEL CONTENT (MAXIMIZED RIGHT AREA) */}
                <div className="flex-1 min-w-0 space-y-6">
                  {activeTab === 'dashboard' && (
                    <ComingSoonDashboardView title="PRODUCTION DASHBOARD" />
                  )}

                  {activeTab === 'design' && (
                    <DesignPanel isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
                  )}

                  {activeTab === 'finishing' && (
                    <ComingSoonDashboardView title="FINISHING PANEL" />
                  )}

                  {activeTab === 'paking' && (
                    <PackingPanel isDarkMode={isDarkMode} spkList={displayedList} handleUpdateField={handleUpdateField} onOpenImageModal={openImageModal} isPackingRole={currentAdmin?.role === 'packing_role'} />
                  )}

                  {activeTab === 'pengiriman' && (
                    <ComingSoonDashboardView title="PENGIRIMAN & SURAT JALAN" />
                  )}

                  {activeTab === 'kawan_lama' && (
                    <KawanLamaTab isDarkMode={isDarkMode} currentUser={currentKawanLamaAdmin || currentAdmin} isBranchMode={false} />
                  )}

                  {activeTab === 'label' && (
                    <LabelGeneratorTab isDarkMode={isDarkMode} onOpenImageModal={openImageModal} />
                  )}

                  {activeTab === 'custom_modules' && (
                    <CustomModulesIndex isDarkMode={isDarkMode} />
                  )}

                  {activeTab !== 'label' && activeTab !== 'kawan_lama' && activeTab !== 'design' && activeTab !== 'custom_modules' && activeTab !== 'paking' && activeTab !== 'dashboard' && activeTab !== 'finishing' && activeTab !== 'pengiriman' && (
                    <MainTrackingTable
                      isDarkMode={isDarkMode}
                      activeTab={activeTab}
                      spkList={spkList}
                      displayedList={displayedList}
                      selectedSpkIds={selectedSpkIds}
                      handleToggleCheck={handleToggleCheck}
                      handleToggleSelectAll={handleToggleSelectAll}
                      handleUpdateQty={handleUpdateQty}
                      handleUpdateField={handleUpdateField}
                      handleDeleteSpk={handleDeleteSpk}
                      handleBatchDelete={handleBatchDelete}
                      handleBatchPrint={handleBatchPrint}
                      openImageModal={openImageModal}
                      handleUploadSuratJalan={handleUploadSuratJalan}
                      getPercent={getPercent}
                      getStatusBadge={getStatusBadge}
                      STAFF_QC_LIST={STAFF_QC_LIST}
                      searchTerm={searchTerm}
                      setSearchTerm={setSearchTerm}
                    />
                  )}
                </div>

              </div>
            )}
          </>
        )}

      </div>

      <ScanQCModal isOpen={showScanModal} onClose={() => setShowScanModal(false)} isDarkMode={isDarkMode} scanTargetColumn={scanTargetColumn} setScanTargetColumn={setScanTargetColumn} scannedInput={scannedInput} setScannedInput={setScannedInput} handleSubmitInput={handleSubmitInput} lastScanMessage={lastScanMessage} />
      <ImagePreviewModal isOpen={modalImageInfo.isOpen} onClose={closeImageModal} modalImageInfo={modalImageInfo} />
      <AdminLoginModal isOpen={showAdminLoginModal} onClose={() => setShowAdminLoginModal(false)} onLoginSuccess={(admin) => { localStorage.setItem('kl_admin_session', JSON.stringify(admin)); setCurrentAdmin(admin); setShowAdminLoginModal(false); }} />
      <BranchLoginModal isOpen={showBranchLoginModal} onClose={() => setShowBranchLoginModal(false)} onLoginSuccess={(branch) => { setCurrentBranch(branch); localStorage.setItem('kl_branch_session', JSON.stringify(branch)); setShowBranchLoginModal(false); }} />
    </div>
  );
}