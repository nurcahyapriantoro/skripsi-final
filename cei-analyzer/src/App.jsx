import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import TR from './translations.js'

// ═══ Language Context ═══
const LangContext = createContext('id')
function useLang() { return useContext(LangContext) }
function Tx({ path }) { const lang = useLang(); const parts = path.split('.'); let val = TR; for (const p of parts) val = val?.[p]; return (val?.[lang] || val?.en || path) }

// ══════════════════════════════════════════════════════════════
// DATA KONSTAN
// ══════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You are an expert Solidity smart contract security auditor specializing in reentrancy vulnerability detection, specifically the Checks-Effects-Interactions (CEI) pattern.

Your task: Analyze Solidity function code and classify each meaningful line or block into one of three categories:
- CHECKS: Input validation, require statements, condition checks
- EFFECTS: State variable updates, balance modifications, status changes
- INTERACTIONS: External calls, .call(), .transfer(), .send(), interface calls

Then detect if the ordering violates CEI (i.e., INTERACTIONS appear before EFFECTS).

Respond ONLY with a valid JSON object. No preamble, no markdown fences.

JSON schema:
{
  "function_name": "string",
  "is_vulnerable": boolean,
  "vulnerability_type": "string or null",
  "security_score": number (0-100, 100 = fully secure),
  "cei_order_detected": ["CHECKS"|"EFFECTS"|"INTERACTIONS", ...],
  "expected_order": ["CHECKS", "EFFECTS", "INTERACTIONS"],
  "classified_lines": [
    {
      "line_number": number,
      "code_snippet": "string",
      "category": "CHECKS"|"EFFECTS"|"INTERACTIONS"|"OTHER",
      "risk_note": "string or null"
    }
  ],
  "violation_summary": "string or null",
  "recommendation": "string or null",
  "is_cei_compliant": boolean
}`

// ─── Preset Contracts ───
const INSECURE_VAULT = `// InsecureVault.sol — VULNERABLE (Interactions before Effects)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
enum Status { CREATED, LOCKED, RELEASED, COMPLETED }
contract InsecureVault {
    mapping(address => uint) public balances;
    Status public orderStatus;
    function withdrawFunds() external {
        uint amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");
        require(orderStatus == Status.RELEASED, "Order not released");
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
        orderStatus = Status.COMPLETED;
    }
}`
const SECURE_VAULT = `// SecureVault.sol — SECURE (CEI Pattern)
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
enum Status { CREATED, LOCKED, RELEASED, COMPLETED }
contract SecureVault {
    mapping(address => uint) public balances;
    Status public orderStatus;
    function withdrawFunds() external {
        uint amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");
        require(orderStatus == Status.RELEASED, "Order not released");
        balances[msg.sender] = 0;
        orderStatus = Status.COMPLETED;
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}`
const MUTEX_VAULT = `// MutexVault.sol — SECURE via ReentrancyGuard
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
enum Status { CREATED, LOCKED, RELEASED, COMPLETED }
contract MutexVault is ReentrancyGuard {
    mapping(address => uint) public balances;
    Status public orderStatus;
    function withdrawFunds() external nonReentrant {
        uint amount = balances[msg.sender];
        require(amount > 0, "Insufficient balance");
        require(orderStatus == Status.RELEASED, "Order not released");
        (bool success,) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;
        orderStatus = Status.COMPLETED;
    }
}`

// ─── Gas Cost Data — DATA ASLI PENELITIAN (30 iterasi Hardhat) ───
const GAS_DATA = {
  cei: {
    label: 'SecureVault (CEI)',
    color: '#22c55e',
    withdraw_gas: [
      29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950,
      29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950,
      29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950, 29950,
    ],
    sstore_count: 1,
    sload_count: 1,
  },
  mutex: {
    label: 'MutexVault (ReentrancyGuard)',
    color: '#f59e0b',
    withdraw_gas: [
      32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363,
      32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363,
      32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363, 32363,
    ],
    sstore_count: 3,
    sload_count: 2,
  },
}

const chartData = Array.from({ length: 30 }, (_, i) => ({
  iteration: i + 1,
  CEI: GAS_DATA.cei.withdraw_gas[i],
  Mutex: GAS_DATA.mutex.withdraw_gas[i],
  difference: GAS_DATA.mutex.withdraw_gas[i] - GAS_DATA.cei.withdraw_gas[i],
}))

function stats(arr) {
  const sorted = [...arr].sort((a, b) => a - b)
  const n = sorted.length
  const mean = sorted.reduce((a, b) => a + b, 0) / n
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1)
  const std = Math.sqrt(variance)
  return { mean, std, min: sorted[0], max: sorted[n - 1], median: n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[Math.floor(n / 2)], n }
}

const ceiStats = stats(GAS_DATA.cei.withdraw_gas)
const mutexStats = stats(GAS_DATA.mutex.withdraw_gas)

const opcodeData = [
  { opcode: 'SSTORE', CEI: 1, Mutex: 3, desc: <Tx path="opcode.sstoreDesc" /> },
  { opcode: 'SLOAD', CEI: 1, Mutex: 2, desc: <Tx path="opcode.sloadDesc" /> },
  { opcode: 'TOTAL OPCODES', CEI: 132, Mutex: 165, desc: <Tx path="opcode.totalDesc" /> },
]

// ─── Attack Animation Steps (FIX-04) ───
const ATTACK_STEPS = [
  {
    title:  <Tx path="problem.step1a" /> ,
    desc:  <Tx path="problem.step1ad" /> ,
    vault: { balances: { 'Attacker': '0.1', 'Buyer A': '1.5', 'Buyer B': '0.7' }, total: '2.3 ETH' },
    activeLine: null,
  },
  {
    title:  <Tx path="problem.step2a" /> ,
    desc: 'Attacker memanggil withdrawFunds(). require(amount > 0) lolos karena balances masih 0.1 ETH. Contract melakukan .call{value: 0.1}() — EXTERNAL CALL sebelum state update!',
    vault: { balances: { 'Attacker': '0.1', 'Buyer A': '1.5', 'Buyer B': '0.7' }, total: '2.3 ETH' },
    activeLine: 'INTERACTIONS',
    highlight: '.call{value: amount}()',
  },
  {
    title:  <Tx path="problem.step3a" /> ,
    desc:  <Tx path="problem.step3ad" /> ,
    vault: { balances: { 'Attacker': '0.1', 'Buyer A': '1.5', 'Buyer B': '0.7' }, total: '2.3 ETH' },
    activeLine: 'INTERACTIONS',
    highlight: 'fallback() → withdrawFunds() 🔄',
  },
  {
    title:  <Tx path="problem.step4a" /> ,
    desc: 'Loop rekursif berlanjut hingga semua ETH di InsecureVault habis. Attacker mendapat total 2.4 ETH (modal 0.1 + 2.3 curian). Buyer A & B kehilangan semua dana!',
    vault: { balances: { 'Attacker': '2.4', 'Buyer A': '0', 'Buyer B': '0' }, total: '0 ETH 💀' },
    activeLine: 'INTERACTIONS',
    highlight: '2.3 ETH terkuras!',
  },
  {
    title:  <Tx path="problem.step5a" /> ,
    desc:  <Tx path="problem.step5ad" /> ,
    vault: { balances: { 'Attacker': '0', 'Buyer A': '1.5', 'Buyer B': '0.7' }, total: '2.2 ETH ✅' },
    activeLine: null,
    highlight: 'balances = 0 → .call() ✅',
  },
]

// ─── Theme ───
const T = {
  light: {
    bg: '#ffffff', surface: '#ffffff', surfaceAlt: '#f8f9fa', card: '#ffffff',
    border: '#dadce0', borderLight: '#e8eaed',
    text: '#3c4043', textSec: '#5f6368', textTer: '#80868b',
    primary: '#1a73e8', primaryLight: '#e8f0fe', primaryDark: '#1557b0',
    green: '#188038', greenLight: '#e6f4ea',
    red: '#d93025', redLight: '#fce8e6',
    yellow: '#f9ab00', yellowLight: '#fef7e0',
    heroBg: 'linear-gradient(135deg, #e8f0fe 0%, #f0f7ff 50%, #f8f9fa 100%)',
  },
  dark: {
    bg: '#202124', surface: '#292a2d', surfaceAlt: '#202124', card: '#292a2d',
    border: '#3c4043', borderLight: '#35363a',
    text: '#e8eaed', textSec: '#9aa0a6', textTer: '#5f6368',
    primary: '#8ab4f8', primaryLight: '#1a3a5c', primaryDark: '#aecbfa',
    green: '#81c995', greenLight: '#1a3a2a',
    red: '#f28b82', redLight: '#4a1c1a',
    yellow: '#fdd663', yellowLight: '#3d2e00',
    heroBg: 'linear-gradient(135deg, #1a1c1e 0%, #202124 50%, #171717 100%)',
  },
}

// ══════════════════════════════════════════════════════════════
// HOOKS & HELPERS
// ══════════════════════════════════════════════════════════════

function useTheme() {
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem('cei-theme')
    if (s) return s === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    document.documentElement.classList.toggle('light', !isDark)
    localStorage.setItem('cei-theme', isDark ? 'dark' : 'light')
  }, [isDark])
  const t = isDark ? T.dark : T.light
  return { isDark, setIsDark, t }
}

function useInView(threshold = 0.1) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

function useCounter(end, duration = 2000, start = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!start) return
    let startTime = null
    const step = (ts) => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      setVal(Math.floor(p * end))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [end, duration, start])
  return val
}

function scoreColor(score, isDark) {
  if (score >= 80) return isDark ? '#81c995' : '#188038'
  if (score >= 50) return isDark ? '#fdd663' : '#f9ab00'
  return isDark ? '#f28b82' : '#d93025'
}

function catStyle(cat, isViolation, isDark) {
  const m = isDark ? {
    C: { bg: '#1a3a5c', text: '#8ab4f8', border: '#3b6da0' },
    E: { bg: '#3d2e00', text: '#fdd663', border: '#6b5200' },
    IV: { bg: '#4a1c1a', text: '#f28b82', border: '#8a3a35' },
    IS: { bg: '#1a3a2a', text: '#81c995', border: '#2d6b45' },
    O: { bg: '#3c4043', text: '#9aa0a6', border: '#5f6368' },
  } : {
    C: { bg: '#e8f0fe', text: '#174ea6', border: '#a8c7fa' },
    E: { bg: '#fef7e0', text: '#5f3c00', border: '#fdd663' },
    IV: { bg: '#fce8e6', text: '#c5221f', border: '#f5a8a3' },
    IS: { bg: '#e6f4ea', text: '#137333', border: '#81c995' },
    O: { bg: '#f1f3f4', text: '#5f6368', border: '#dadce0' },
  }
  if (cat === 'INTERACTIONS') return isViolation ? m.IV : m.IS
  return { CHECKS: m.C, EFFECTS: m.E, OTHER: m.O }[cat] || m.O
}

// ══════════════════════════════════════════════════════════════
// SUB-KOMPONEN
// ══════════════════════════════════════════════════════════════

function ThemeToggle({ isDark, onToggle }) {
  return (
    <button onClick={onToggle}
      className={`relative w-14 h-7 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${
        isDark ? 'bg-[#3c4043] focus:ring-[#8ab4f8]' : 'bg-[#dadce0] focus:ring-[#1a73e8]'
      }`}>
      <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 shadow-md ${
        isDark ? 'translate-x-7 bg-[#5f6368]' : 'translate-x-0 bg-white'
      }`}>
        {isDark ? (
          <svg className="w-3.5 h-3.5 text-[#fdd663]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3a9 9 0 109 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 01-4.4 2.26 5.403 5.403 0 01-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/></svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-[#f9ab00]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
        )}
      </span>
    </button>
  )
}

function GlowButton({ children, variant = 'primary', onClick, className = '', disabled = false }) {
  const ref = useRef(null)
  const handleMouse = (e) => {
    const r = ref.current?.getBoundingClientRect()
    if (r) ref.current?.style.setProperty('--mouse-x', `${e.clientX - r.left}px`)
    if (r) ref.current?.style.setProperty('--mouse-y', `${e.clientY - r.top}px`)
  }
  const base = 'relative overflow-hidden rounded-xl text-sm font-medium transition-all duration-300 active:scale-[0.97]'
  const vars = {
    primary: 'bg-[#1a73e8] text-white hover:shadow-lg hover:shadow-[#1a73e8]/25 hover:-translate-y-0.5',
    primaryDark: 'bg-[#8ab4f8] text-[#202124] hover:shadow-lg hover:shadow-[#8ab4f8]/25 hover:-translate-y-0.5',
    secondary: 'border hover:-translate-y-0.5 active:scale-[0.97]',
  }
  const v = disabled ? '' : (vars[variant] || vars.primary)
  return (
    <button ref={ref} onClick={onClick} disabled={disabled} onMouseMove={handleMouse}
      className={`${base} ${v} ${disabled ? 'opacity-50 cursor-not-allowed' : 'btn-glow'} ${className}`}>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </button>
  )
}

function AnimatedSection({ children, className = '' }) {
  const [ref, inView] = useInView(0.1)
  return (
    <div ref={ref} className={`transition-all duration-700 ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </div>
  )
}

function StatCard({ icon, value, suffix, label, inView, isDark }) {
  const count = useCounter(value, 2000, inView)
  const s = isDark ? T.dark : T.light
  return (
    <div className={`text-center p-4 sm:p-5 rounded-2xl border transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl sm:text-3xl font-bold ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>{count}{suffix}</div>
      <div className={`text-xs mt-1 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{label}</div>
    </div>
  )
}

function Modal({ open, onClose, title, children, isDark }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className={`relative max-w-2xl w-full max-h-[80vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 ${isDark ? 'bg-[#292a2d] border-[#3c4043]' : 'bg-white border-[#dadce0]'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-sm font-semibold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{title}</h3>
          <button onClick={onClose} className={`p-1 rounded-lg ${isDark ? 'hover:bg-[#3c4043] text-[#9aa0a6]' : 'hover:bg-[#f1f3f4] text-[#5f6368]'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Section({ id, className = '', children, isDark }) {
  const bg = isDark ? T.dark.bg : T.light.bg
  return (
    <section id={id} className={`relative ${className}`} style={{ backgroundColor: bg }}>
      {children}
    </section>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN APP
// ══════════════════════════════════════════════════════════════

export default function App() {
  const { isDark, setIsDark, t } = useTheme()
  const [lang, setLang] = useState(() => localStorage.getItem('cei-lang') || 'id')
  useEffect(() => { localStorage.setItem('cei-lang', lang) }, [lang])
  const toggleLang = () => setLang(prev => prev === 'id' ? 'en' : 'id')
  const [activeSection, setActiveSection] = useState('hero')
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [promptOpen, setPromptOpen] = useState(false)
  const [attackStep, setAttackStep] = useState(0)
  const [attackPlaying, setAttackPlaying] = useState(false)

  // Analyzer
  const [solidityCode, setSolidityCode] = useState('')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('single')
  const [loadingStep, setLoadingStep] = useState(0)

  // Compare 2
  const [leftCode, setLeftCode] = useState(INSECURE_VAULT)
  const [rightCode, setRightCode] = useState(SECURE_VAULT)
  const [leftResult, setLeftResult] = useState(null)
  const [rightResult, setRightResult] = useState(null)
  const [isCompareLoading, setIsCompareLoading] = useState(false)

  // Compare 3
  const [c3left, setC3left] = useState(INSECURE_VAULT)
  const [c3center, setC3center] = useState(SECURE_VAULT)
  const [c3right, setC3right] = useState(MUTEX_VAULT)
  const [c3lResult, setC3lResult] = useState(null)
  const [c3cResult, setC3cResult] = useState(null)
  const [c3rResult, setC3rResult] = useState(null)
  const [isC3Loading, setIsC3Loading] = useState(false)
  const [compareTab, setCompareTab] = useState('two')

  // Loading steps (FIX-09)
  const loadingSteps = [
    'Mengirim kode ke Deepseek AI...',
    'Mengklasifikasi pola CHECKS, EFFECTS, INTERACTIONS...',
    'Mendeteksi pelanggaran urutan CEI...',
    'Menghitung Security Score...',
    'Menyiapkan hasil analisis...',
  ]

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > 20)
      setShowScrollTop(window.scrollY > 500)
    }
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const sections = ['hero','problem','benefits','project','gas','analyzer']
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id) })
    }, { threshold: 0.3 })
    sections.forEach(id => {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    })
    return () => obs.disconnect()
  }, [])

  // Loading step simulation
  useEffect(() => {
    if (!isLoading && !isCompareLoading && !isC3Loading) { setLoadingStep(0); return }
    const timer = setInterval(() => {
      setLoadingStep(prev => prev < loadingSteps.length - 1 ? prev + 1 : prev)
    }, 800)
    return () => clearInterval(timer)
  }, [isLoading, isCompareLoading, isC3Loading, loadingSteps.length])

  // Auto-play attack animation (FIX-04)
  useEffect(() => {
    if (!attackPlaying) return
    const timer = setInterval(() => {
      setAttackStep(prev => prev < ATTACK_STEPS.length - 1 ? prev + 1 : 0)
    }, 2500)
    return () => clearInterval(timer)
  }, [attackPlaying])

  const navigate = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setActiveSection(id)
    setMenuOpen(false)
  }

  // ─── API ───
  const analyzeWithDeepseek = useCallback(async (code) => {
    const response = await fetch('https://cei-analyzer-api.vercel.app/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error')
      throw new Error(`API error (${response.status}): ${errText}`)
    }
    const data = await response.json()
    if (!data.success) throw new Error(data.error || 'Analysis failed')
    return data.data
  }, [])

  async function handleAnalyze() {
    if (!solidityCode.trim()) return
    setIsLoading(true); setError(null); setAnalysisResult(null); setLoadingStep(0)
    try { setAnalysisResult(await analyzeWithDeepseek(solidityCode)) }
    catch (err) { setError(err.message) }
    finally { setIsLoading(false) }
  }

  async function handleCompare() {
    if (!leftCode.trim() || !rightCode.trim()) return
    setIsCompareLoading(true); setLeftResult(null); setRightResult(null); setError(null)
    try { const [l, r] = await Promise.all([analyzeWithDeepseek(leftCode), analyzeWithDeepseek(rightCode)]); setLeftResult(l); setRightResult(r) }
    catch (err) { setError(err.message) }
    finally { setIsCompareLoading(false) }
  }

  async function handleCompare3() {
    if (!c3left.trim() || !c3center.trim() || !c3right.trim()) return
    setIsC3Loading(true); setC3lResult(null); setC3cResult(null); setC3rResult(null); setError(null)
    try {
      const [l, c, r] = await Promise.all([analyzeWithDeepseek(c3left), analyzeWithDeepseek(c3center), analyzeWithDeepseek(c3right)])
      setC3lResult(l); setC3cResult(c); setC3rResult(r)
    } catch (err) { setError(err.message) }
    finally { setIsC3Loading(false) }
  }

  function handleExport(data, name = 'result') {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `cei-analysis-${name}.json`
    a.click(); URL.revokeObjectURL(url)
  }

  function handleExportAll3() {
    handleExport({
      comparison_type: 'three_way',
      timestamp: new Date().toISOString(),
      contracts: { left: c3lResult, center: c3cResult, right: c3rResult },
      summary: {
        most_secure: c3lResult && c3cResult && c3rResult
          ? [c3lResult, c3cResult, c3rResult].reduce((a, b) => (a.security_score > b.security_score ? a : b)).function_name || 'unknown'
          : 'unknown',
        least_secure: c3lResult && c3cResult && c3rResult
          ? [c3lResult, c3cResult, c3rResult].reduce((a, b) => (a.security_score < b.security_score ? a : b)).function_name || 'unknown'
          : 'unknown',
        cei_compliant_count: [c3lResult, c3cResult, c3rResult].filter(r => r?.is_cei_compliant).length,
      }
    }, 'three-way-comparison')
  }

  // ─── Result Renderer ───
  function renderResult(r) {
    if (!r) return null
    const score = r.security_score ?? 0
    const color = scoreColor(score, isDark)
    return (
      <div className="space-y-4 animate-fadeInUp">
        <div className={`flex items-start justify-between gap-3 flex-wrap pb-3 border-b ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>function</span>
              <code className={`font-mono text-sm font-medium ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>{r.function_name || 'unknown'}</code>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium inline-flex items-center gap-1 ${
                r.is_vulnerable ? (isDark ? 'bg-[#4a1c1a] text-[#f28b82]' : 'bg-[#fce8e6] text-[#c5221f]') : (isDark ? 'bg-[#1a3a2a] text-[#81c995]' : 'bg-[#e6f4ea] text-[#137333]')
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${r.is_vulnerable ? (isDark ? 'bg-[#f28b82]' : 'bg-[#d93025]') : (isDark ? 'bg-[#81c995]' : 'bg-[#188038]')}`} />
                {r.is_vulnerable ? 'Vulnerable' : 'Secure'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              <span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}>CEI:</span>
              <span className={`font-medium ${r.is_cei_compliant ? (isDark ? 'text-[#81c995]' : 'text-[#188038]') : (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]')}`}>{r.is_cei_compliant ? 'Compliant ✓' : 'Violation ✗'}</span>
              {r.vulnerability_type && <span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}>· {r.vulnerability_type}</span>}
            </div>
          </div>
          <button onClick={() => handleExport(r, r.function_name || 'result')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] rounded-lg border transition-all duration-200 hover:-translate-y-0.5 ${
              isDark ? 'border-[#3c4043] hover:border-[#8ab4f8]/40' : 'border-[#dadce0] hover:border-[#1a73e8]/40'
            }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export
          </button>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Score</span>
            <span className="text-xl font-light" style={{ color }}>{score}<span className={`text-[10px] font-normal ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>/100</span></span>
          </div>
          <div className={`w-full h-2 rounded-full ${isDark ? 'bg-[#3c4043]' : 'bg-[#e8eaed]'}`}>
            <div className="h-full rounded-full score-bar-fill" style={{ width: `${score}%`, backgroundColor: color }} />
          </div>
          <div className="flex justify-between mt-0.5 text-[9px]">
            <span className={isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}>0</span>
            <span style={{ color }}>{score >= 80 ? 'Secure' : score >= 50 ? 'Moderate' : 'Vulnerable'}</span>
            <span className={isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}>100</span>
          </div>
        </div>
        {r.cei_order_detected?.length > 0 && (
          <div>
            <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>CEI Flow</h4>
            <div className={`inline-flex items-center gap-0 rounded-lg overflow-hidden border ${isDark ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
              {r.cei_order_detected.map((step, i) => {
                const isViolation = step === 'INTERACTIONS' && r.cei_order_detected.indexOf('EFFECTS') > i
                const c = catStyle(step, isViolation, isDark)
                return (
                  <div key={i} className="flex items-center">
                    {i > 0 && <div className={`w-4 h-px ${isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]'}`} />}
                    <div className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono font-medium" style={{ backgroundColor: c.bg, color: c.text }}>{step}{isViolation && ' ⚠️'}</div>
                  </div>
                )
              })}
            </div>
            {r.is_vulnerable && <p className={`mt-1 text-[10px] ${isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}`}><Tx path="result.violation" /></p>}
          </div>
        )}
        {r.classified_lines?.length > 0 && (
          <div>
            <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="result.lines" /></h4>
            <div className={`overflow-hidden rounded-lg border ${isDark ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead><tr className={isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}>
                    <th className={`text-left py-2 px-2.5 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Ln</th>
                    <th className={`text-left py-2 px-2.5 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Code</th>
                    <th className={`text-left py-2 px-2.5 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Cat</th>
                    <th className={`text-left py-2 px-2.5 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Risk</th>
                  </tr></thead>
                  <tbody>{r.classified_lines.map((line, idx) => {
                    const iv = r.is_vulnerable && line.category === 'INTERACTIONS'
                    const c = catStyle(line.category, iv, isDark)
                    return (
                      <tr key={idx} className={`border-t ${isDark ? 'border-[#3c4043] hover:bg-[#292a2d]' : 'border-[#e8eaed] hover:bg-[#f8f9fa]'}`}>
                        <td className={`py-1.5 px-2.5 font-mono ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{line.line_number}</td>
                        <td className={`py-1.5 px-2.5 font-mono max-w-[160px] truncate ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{line.code_snippet}</td>
                        <td className="py-1.5 px-2.5"><span className="px-1.5 py-0.5 rounded text-[9px] font-medium border" style={{ backgroundColor: c.bg, color: c.text, borderColor: c.border }}>{line.category}</span></td>
                        <td className={`py-1.5 px-2.5 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{line.risk_note || '—'}</td>
                      </tr>
                    )
                  })}</tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {r.recommendation && (
          <div className={`rounded-lg p-3 border ${isDark ? 'bg-[#1a3a5c]/20 border-[#3b6da0]/30' : 'bg-[#e8f0fe] border-[#a8c7fa]'}`}>
            <h4 className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}><Tx path="result.recommendation" /></h4>
            <p className={`text-xs ${isDark ? 'text-[#e8eaed]/80' : 'text-[#3c4043]/80'}`}>{r.recommendation}</p>
          </div>
        )}
        {r.violation_summary && (
          <div className={`rounded-lg p-3 border ${isDark ? 'bg-[#4a1c1a]/20 border-[#8a3a35]/30' : 'bg-[#fce8e6] border-[#f5a8a3]'}`}>
            <h4 className={`text-[10px] font-medium mb-0.5 ${isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}`}><Tx path="result.violationTitle" /></h4>
            <p className={`text-xs ${isDark ? 'text-[#e8eaed]/80' : 'text-[#3c4043]/80'}`}>{r.violation_summary}</p>
          </div>
        )}
      </div>
    )
  }

  const navLinks = [
    { id: 'hero', path: 'nav.home' },
    { id: 'problem', path: 'nav.problem' },
    { id: 'benefits', path: 'nav.benefits' },
    { id: 'project', path: 'nav.project' },
    { id: 'gas', path: 'nav.gas' },
    { id: 'analyzer', path: 'nav.analyzer' },
  ]

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <LangContext.Provider value={lang}>
    <div className={`${isDark ? 'dark' : 'light'} theme-transition`} style={{ backgroundColor: t.bg, color: t.text }}>

      {/* ═══ NAVBAR ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? (isDark ? 'bg-[#202124]/90 backdrop-blur-xl shadow-lg' : 'bg-white/90 backdrop-blur-xl shadow-sm') : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => navigate('hero')} className="flex items-center gap-2 group">
              <img src="/logo_cei.png" alt="CEI" className="h-9 w-auto transition-transform duration-300 group-hover:scale-105" />
              <span className={`text-sm font-medium hidden sm:block ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
                CEI <span className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}>Analyzer</span>
              </span>
            </button>
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(l => (
                <button key={l.id} onClick={() => navigate(l.id)}
                  className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                    activeSection === l.id
                      ? isDark ? 'text-[#8ab4f8] bg-[#8ab4f8]/10' : 'text-[#1a73e8] bg-[#1a73e8]/8'
                      : isDark ? 'text-[#9aa0a6] hover:text-[#e8eaed] hover:bg-[#3c4043]/50' : 'text-[#5f6368] hover:text-[#3c4043] hover:bg-[#f1f3f4]'
                  }`}>
                  <Tx path={l.path} />
                  {activeSection === l.id && <span className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${isDark ? 'bg-[#8ab4f8]' : 'bg-[#1a73e8]'}`} />}
                </button>
              ))}
              <div className={`w-px h-5 mx-2 ${isDark ? 'bg-[#3c4043]' : 'bg-[#dadce0]'}`} />
              <button onClick={toggleLang} className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${isDark ? 'border-[#3c4043] hover:bg-[#3c4043] text-[#9aa0a6]' : 'border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368]'}`}>
                {lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}
              </button>
              <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
            </div>
            <div className="flex items-center gap-2 md:hidden">
              <button onClick={toggleLang} className={`px-2 py-0.5 text-[10px] font-bold rounded border transition-all ${isDark ? 'border-[#3c4043] hover:bg-[#3c4043] text-[#9aa0a6]' : 'border-[#dadce0] hover:bg-[#f1f3f4] text-[#5f6368]'}`}>
                {lang === 'id' ? '🇮🇩 ID' : '🇬🇧 EN'}
              </button>
              <ThemeToggle isDark={isDark} onToggle={() => setIsDark(!isDark)} />
              <button onClick={() => setMenuOpen(!menuOpen)} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#3c4043]' : 'hover:bg-[#f1f3f4]'}`}>
                {menuOpen ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/></svg>
                )}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div className={`md:hidden border-t pb-3 pt-2 ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
              {navLinks.map(l => (
                <button key={l.id} onClick={() => navigate(l.id)}
                  className={`block w-full text-left px-3 py-2.5 text-sm font-medium rounded-lg ${
                    activeSection === l.id
                      ? isDark ? 'text-[#8ab4f8] bg-[#8ab4f8]/10' : 'text-[#1a73e8] bg-[#1a73e8]/8'
                      : isDark ? 'text-[#9aa0a6] hover:bg-[#3c4043]/50' : 'text-[#5f6368] hover:bg-[#f1f3f4]'
                  }`}><Tx path={l.path} /></button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <Section id="hero" isDark={isDark} className="min-h-screen flex items-center pt-16 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: t.heroBg }} />
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #1a73e8, transparent)' }} />
        <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #34a853, transparent)' }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full relative z-10">
          <HeroContent isDark={isDark} t={t} navigate={navigate} />
        </div>
      </Section>

      {/* ═══ THE PROBLEM ═══ */}
      <ProblemSection isDark={isDark} t={t} navigate={navigate}
        attackStep={attackStep} setAttackStep={setAttackStep}
        attackPlaying={attackPlaying} setAttackPlaying={setAttackPlaying} />

      {/* ═══ BENEFITS ═══ */}
      <BenefitsSection isDark={isDark} t={t} setPromptOpen={setPromptOpen} />

      {/* ═══ PROJECT ═══ */}
      <ProjectSection isDark={isDark} t={t} />

      {/* ═══ GAS ANALYSIS (FIX-02) ═══ */}
      <GasSection isDark={isDark} t={t} />

      {/* ═══ ANALYZER ═══ */}
      <Section id="analyzer" isDark={isDark} className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <AnalyzerContent
            isDark={isDark} t={t}
            activeTab={activeTab} setActiveTab={setActiveTab}
            compareTab={compareTab} setCompareTab={setCompareTab}
            solidityCode={solidityCode} setSolidityCode={setSolidityCode}
            analysisResult={analysisResult} isLoading={isLoading} error={error}
            handleAnalyze={handleAnalyze} renderResult={renderResult}
            loadingSteps={loadingSteps} loadingStep={loadingStep}
            leftCode={leftCode} setLeftCode={setLeftCode}
            rightCode={rightCode} setRightCode={setRightCode}
            leftResult={leftResult} rightResult={rightResult}
            isCompareLoading={isCompareLoading} handleCompare={handleCompare}
            c3left={c3left} setC3left={setC3left}
            c3center={c3center} setC3center={setC3center}
            c3right={c3right} setC3right={setC3right}
            c3lResult={c3lResult} c3cResult={c3cResult} c3rResult={c3rResult}
            isC3Loading={isC3Loading} handleCompare3={handleCompare3}
            handleExportAll3={handleExportAll3}
          />
        </div>
      </Section>

      {/* ═══ SYSTEM PROMPT MODAL (FIX-05) ═══ */}
      <Modal open={promptOpen} onClose={() => setPromptOpen(false)} title="📜 System Prompt — Deepseek AI CEI Analyzer" isDark={isDark}>
        <p className={`text-[10px] mb-3 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="common.version" /> | Model: deepseek-chat</p>
        <div className={`rounded-lg p-4 font-mono text-[10px] leading-relaxed max-h-80 overflow-y-auto ${isDark ? 'bg-[#202124] text-[#e8eaed]' : 'bg-[#f8f9fa] text-[#3c4043]'}`}>
          {SYSTEM_PROMPT.split('\n').map((line, i) => (
            <div key={i} className="whitespace-pre-wrap">{line}</div>
          ))}
        </div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => { navigator.clipboard.writeText(SYSTEM_PROMPT) }}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              isDark ? 'border-[#3c4043] hover:bg-[#3c4043] text-[#e8eaed]' : 'border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043]'
            }`}>
            📋 <Tx path="common.copy" />
          </button>
          <button onClick={() => setPromptOpen(false)}
            className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
              isDark ? 'border-[#3c4043] hover:bg-[#3c4043] text-[#e8eaed]' : 'border-[#dadce0] hover:bg-[#f1f3f4] text-[#3c4043]'
            }`}>
            Close
          </button>
        </div>
      </Modal>

      {/* ═══ FOOTER ═══ */}
      <FooterSection isDark={isDark} t={t} navigate={navigate} />

      {/* ═══ SCROLL TOP ═══ */}
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 ${
          showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        } ${isDark ? 'bg-[#8ab4f8] text-[#202124]' : 'bg-[#1a73e8] text-white'}`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
      </button>
    </div>
    </LangContext.Provider>
  )
}

// ══════════════════════════════════════════════════════════════
// SECTION COMPONENTS
// ══════════════════════════════════════════════════════════════

function HeroContent({ isDark, t, navigate }) {
  const [ref, inView] = useInView(0.1)
  const [statRef, statInView] = useInView(0.3)
  return (
    <div ref={ref} className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
      <div className={`space-y-6 transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${isDark ? 'border-[#8ab4f8]/30 text-[#8ab4f8] bg-[#8ab4f8]/10' : 'border-[#1a73e8]/20 text-[#1a73e8] bg-[#e8f0fe]'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          Research IPB University · Smart Contract Security
        </div>
        <h1 className={`text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
          <Tx path="hero.title" />
        </h1>
        <p className={`text-base sm:text-lg leading-relaxed max-w-xl ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
          <Tx path="hero.desc" />
        </p>
        <div className="flex flex-wrap gap-3">
          <GlowButton variant={isDark ? 'primaryDark' : 'primary'} onClick={() => navigate('analyzer')} className="px-6 py-3">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            Try the Analyzer
          </GlowButton>
          <GlowButton variant="secondary" onClick={() => navigate('problem')}
            className={`px-6 py-3 ${isDark ? 'border-[#3c4043] text-[#e8eaed] hover:bg-[#3c4043]/50' : 'border-[#dadce0] text-[#3c4043] hover:bg-[#f1f3f4]'}`}>
            Learn More
          </GlowButton>
        </div>
        <div ref={statRef} className="grid grid-cols-3 gap-3 pt-4">
          <StatCard value={60} suffix="M+" label={<Tx path="hero.stat1" />} icon="💰" inView={statInView} isDark={isDark} />
          <StatCard value={3} suffix="" label={<Tx path="hero.stat2" />} icon="🛡️" inView={statInView} isDark={isDark} />
          <StatCard value={100} suffix="%" label={<Tx path="hero.stat3" />} icon="✓" inView={statInView} isDark={isDark} />
        </div>
      </div>
      <div className={`hidden lg:flex items-center justify-center transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
        <HeroCard isDark={isDark} />
      </div>
    </div>
  )
}

function HeroCard({ isDark }) {
  return (
    <div className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 ${isDark ? 'bg-[#292a2d] border-[#3c4043]' : 'bg-white border-[#e8eaed]'}`}>
      <div className="flex items-center gap-3 mb-5">
        <img src="/logo_cei.png" alt="CEI" className="h-10" />
        <div>
          <div className={`text-sm font-semibold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="hero.cardTitle" /></div>
          <div className={`text-[10px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="hero.cardSub" /></div>
        </div>
      </div>
      <div className={`rounded-lg p-3 font-mono text-[10px] leading-relaxed ${isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}`}>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="w-2 h-2 rounded-full bg-[#d93025]" /><span className="w-2 h-2 rounded-full bg-[#f9ab00]" /><span className="w-2 h-2 rounded-full bg-[#188038]" />
          <span className={`ml-2 ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>withdrawFunds.sol</span>
        </div>
        <div className="space-y-1">
          <div><span className="text-[#c5221f] dark:text-[#f28b82]">1</span> <span className={isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}>function withdrawFunds() external {`{`}</span></div>
          <div><span className="text-[#c5221f] dark:text-[#f28b82]">2</span> <span className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}>require</span>(amount &gt; <span className={isDark ? 'text-[#81c995]' : 'text-[#188038]'}>0</span>);</div>
          <div><span className="text-[#c5221f] dark:text-[#f28b82]">3</span> <span className={isDark ? 'text-[#f28b82]' : 'text-[#d93025]'}>(bool success,) = msg.sender.call{`{value: amount}`}("");</span></div>
          <div><span className="text-[#c5221f] dark:text-[#f28b82]">4</span> <span className={isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}>balances[msg.sender] = 0;</span></div>
          <div><span className="text-[#c5221f] dark:text-[#f28b82]">5</span> <span className={isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}>{`}`}</span></div>
        </div>
      </div>
      <div className="mt-4">
        <div className={`text-[10px] font-medium mb-2 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>CEI ORDER FLOW</div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="px-2 py-1 rounded text-[10px] font-medium" style={{ backgroundColor: '#e8f0fe', color: '#174ea6' }}>CHECKS</span>
          <span className="text-[#dadce0]">→</span>
          <span className="px-2 py-1 rounded text-[10px] font-medium" style={{ backgroundColor: '#fce8e6', color: '#c5221f', border: '1px solid #f5a8a3' }}>INTERACTIONS ⚠️</span>
          <span className="text-[#dadce0]">→</span>
          <span className="px-2 py-1 rounded text-[10px] font-medium" style={{ backgroundColor: '#fef7e0', color: '#5f3c00' }}>EFFECTS</span>
        </div>
        <p className="text-[10px] text-[#c5221f] dark:text-[#f28b82] mt-1">⚠️ VULNERABLE: Reentrancy possible</p>
      </div>
    </div>
  )
}

// ═══ PROBLEM SECTION ═══
function ProblemSection({ isDark, t, attackStep, setAttackStep, attackPlaying, setAttackPlaying }) {
  const [ref, inView] = useInView(0.1)
  const S = isDark ? T.dark : T.light
  return (
    <Section id="problem" isDark={isDark} className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6" ref={ref}>
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-4 ${isDark ? 'border-[#f28b82]/30 text-[#f28b82] bg-[#f28b82]/10' : 'border-[#d93025]/20 text-[#d93025] bg-[#fce8e6]'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            The Largest Attack in Blockchain History
          </span>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
            The DAO Hack <span className="gradient-text">2016</span>
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <DAOIncident isDark={isDark} S={S} />
          <DAOTimeline isDark={isDark} S={S} />
        </div>

        {/* FIX-04: Attack Animation */}
        <AnimatedSection className="mt-16">
          <AttackAnimation isDark={isDark} S={S}
            attackStep={attackStep} setAttackStep={setAttackStep}
            attackPlaying={attackPlaying} setAttackPlaying={setAttackPlaying} />
        </AnimatedSection>

        {/* FIX-06: MutexVault Callout */}
        <AnimatedSection className="mt-10">
          <MutexCallout isDark={isDark} S={S} />
        </AnimatedSection>
      </div>
    </Section>
  )
}

function DAOIncident({ isDark, S }) {
  const [ref, inView] = useInView(0.1)
  return (
    <div className={`space-y-5 transition-all duration-700 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`} ref={ref}>
      <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#4a1c1a]/20 border-[#8a3a35]/40' : 'bg-[#fce8e6] border-[#f5a8a3]'}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${isDark ? 'bg-[#4a1c1a]' : 'bg-white'}`}>🏛️</div>
          <div>
            <h3 className={`text-base font-semibold ${isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}`}><Tx path="problem.cardTitle" /></h3>
            <p className={`text-xs ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="problem.date" /></p>
          </div>
        </div>
        <div className={`space-y-3 text-sm leading-relaxed ${isDark ? 'text-[#e8eaed]/80' : 'text-[#3c4043]/80'}`}>
          <p><strong className={isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}><Tx path="problem.exploit" /></strong> <Tx path="problem.exploitDesc" /></p>
          <p><strong className={isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}><Tx path="problem.mechanism" /></strong> <Tx path="problem.mechanismDesc" /></p>
          <p><strong className={isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}><Tx path="problem.impact" /></strong> <Tx path="problem.impactDesc" /></p>
        </div>
      </div>
      <HowReentrancyWorks isDark={isDark} S={S} />
    </div>
  )
}

function HowReentrancyWorks({ isDark, S }) {
  const steps = [
    { num: 1, label: 'Deposit', desc:  <Tx path="problem.step1d" /> , color: 'red' },
    { num: 2, label: 'Withdraw (VULN)', desc:  <Tx path="problem.step2d" /> , color: 'yellow' },
    { num: 3, label: 'Re-entry', desc:  <Tx path="problem.step3d" /> , color: 'red' },
    { num: 4, label: 'Drain', desc:  <Tx path="problem.step4d" /> , color: 'green' },
  ]
  const colors = {
    red: isDark ? { bg: '#4a1c1a', text: '#f28b82' } : { bg: '#fce8e6', text: '#c5221f' },
    yellow: isDark ? { bg: '#3d2e00', text: '#fdd663' } : { bg: '#fef7e0', text: '#5f3c00' },
    green: isDark ? { bg: '#1a3a2a', text: '#81c995' } : { bg: '#e6f4ea', text: '#137333' },
  }
  return (
    <div className={`rounded-2xl border p-6 ${isDark ? 'bg-[#292a2d] border-[#3c4043]' : 'bg-white border-[#e8eaed]'}`}>
      <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="problem.howTitle" /></h3>
      <div className={`space-y-3 text-sm ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
        {steps.map((s, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`} style={{ backgroundColor: colors[s.color].bg, color: colors[s.color].text }}>{s.num}</div>
            <p><strong className={isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}>{s.label}:</strong> {s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function DAOTimeline({ isDark, S }) {
  const [ref, inView] = useInView(0.2)
  const items = [
    { date: '17 Jun 2016', title:  <Tx path="problem.t1Title" /> , desc:  <Tx path="problem.t1Desc" /> , color: 'red' },
    { date: '17 Jun 2016', title:  <Tx path="problem.t2Title" /> , desc:  <Tx path="problem.t2Desc" /> , color: 'red' },
    { date: '20 Jul 2016', title:  <Tx path="problem.t3Title" /> , desc:  <Tx path="problem.t3Desc" /> , color: 'yellow' },
    { date: 'Okt 2016', title:  <Tx path="problem.t4Title" /> , desc:  <Tx path="problem.t4Desc" /> , color: 'green' },
  ]
  const colors = {
    red: isDark ? { dot: '#f28b82', line: '#4a1c1a' } : { dot: '#d93025', line: '#fce8e6' },
    yellow: isDark ? { dot: '#fdd663', line: '#3d2e00' } : { dot: '#f9ab00', line: '#fef7e0' },
    green: isDark ? { dot: '#81c995', line: '#1a3a2a' } : { dot: '#188038', line: '#e6f4ea' },
  }
  return (
    <div ref={ref} className={`space-y-6 transition-all duration-700 delay-200 ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}>
      <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="problem.timelineTitle" /></h3>
      {items.map((item, i) => {
        const c = colors[item.color]
        return (
          <div key={i} className={`relative pl-8 pb-6 ${i < 3 ? 'border-l-2' : ''}`} style={{ borderColor: c.line }}>
            <div className={`absolute left-[-7px] top-1 w-3.5 h-3.5 rounded-full border-2 ${isDark ? 'border-[#202124]' : 'border-white'}`} style={{ backgroundColor: c.dot }} />
            <div className={`rounded-xl p-4 border hover:-translate-y-0.5 transition-all duration-300 hover:shadow-lg ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`} style={{ borderLeft: `3px solid ${c.dot}` }}>
              <span className={`text-[10px] font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{item.date}</span>
              <h4 className={`text-sm font-semibold mt-0.5 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{item.title}</h4>
              <p className={`text-xs mt-1 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{item.desc}</p>
            </div>
          </div>
        )
      })}
      <div className={`rounded-2xl border p-5 ${isDark ? 'bg-[#1a3a5c]/20 border-[#8ab4f8]/30' : 'bg-[#e8f0fe] border-[#a8c7fa]'}`}>
        <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}><Tx path="problem.lesson" /></h4>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-[#e8eaed]/70' : 'text-[#3c4043]/70'}`}>
          <Tx path="problem.lessonDesc" />
        </p>
      </div>
    </div>
  )
}

// ═══ FIX-04: ATTACK ANIMATION ═══
function AttackAnimation({ isDark, attackStep, setAttackStep, attackPlaying, setAttackPlaying }) {
  const step = ATTACK_STEPS[attackStep]
  const total = ATTACK_STEPS.length
  return (
    <div className={`rounded-2xl border p-5 sm:p-6 ${isDark ? 'bg-[#292a2d] border-[#3c4043]' : 'bg-white border-[#e8eaed]'}`}>
      <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
        <span>⚡</span> <Tx path="problem.attackAnimTitle" />
      </h3>

      {/* Progress dots */}
      <div className="flex items-center gap-2 mb-5">
        {ATTACK_STEPS.map((_, i) => (
          <button key={i} onClick={() => setAttackStep(i)}
            className={`w-8 h-8 rounded-full text-[10px] font-medium transition-all duration-300 ${
              i === attackStep
                ? isDark ? 'bg-[#8ab4f8] text-[#202124] scale-110' : 'bg-[#1a73e8] text-white scale-110'
                : i < attackStep
                  ? isDark ? 'bg-[#81c995] text-[#202124]' : 'bg-[#188038] text-white'
                  : isDark ? 'bg-[#3c4043] text-[#5f6368]' : 'bg-[#e8eaed] text-[#80868b]'
            }`}>
            {i + 1}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={() => setAttackPlaying(!attackPlaying)}
          className={`px-3 py-1.5 text-[10px] rounded-lg border transition-all ${
            isDark ? 'border-[#3c4043] hover:bg-[#3c4043]' : 'border-[#dadce0] hover:bg-[#f1f3f4]'
          }`}>
          {attackPlaying ? <>⏸ <Tx path="problem.pause" /></> : <>▶ <Tx path="problem.autoPlay" /></>}
        </button>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Vault visualization */}
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#202124] border-[#3c4043]' : 'bg-[#f8f9fa] border-[#e8eaed]'}`}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={`text-xs font-semibold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>🏦 InsecureVault</h4>
            <span className={`text-xs font-mono font-bold ${step.vault.total.includes('0 ETH') ? 'text-[#d93025]' : step.vault.total.includes('✅') ? 'text-[#188038]' : isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
              {step.vault.total}
            </span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(step.vault.balances).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className={`text-[10px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{k}</span>
                <span className={`text-[10px] font-mono ${
                  v === '0' ? 'text-[#d93025]' : v === '2.4' ? 'text-[#188038]' : isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'
                }`}>{v} ETH</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step info */}
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#202124] border-[#3c4043]' : 'bg-[#f8f9fa] border-[#e8eaed]'}`}>
          <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
            <span className={attackStep === 4 ? 'text-[#188038]' : attackStep >= 2 ? 'text-[#d93025]' : ''}>{step.title}</span>
          </h4>
          <p className={`text-[11px] leading-relaxed ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{step.desc}</p>
          {step.highlight && (
            <div className={`mt-3 rounded-lg p-2 text-[10px] font-mono font-medium ${
              attackStep === 4
                ? (isDark ? 'bg-[#1a3a2a] text-[#81c995]' : 'bg-[#e6f4ea] text-[#137333]')
                : (isDark ? 'bg-[#4a1c1a] text-[#f28b82]' : 'bg-[#fce8e6] text-[#c5221f]')
            }`}>
              🔍 {step.highlight}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-5">
        <button onClick={() => setAttackStep(Math.max(0, attackStep - 1))} disabled={attackStep === 0}
          className={`px-4 py-2 text-xs rounded-lg border transition-all ${attackStep === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:-translate-y-0.5'} ${isDark ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
          ← <Tx path="problem.prev" />
        </button>
        <span className={`text-[10px] ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>{attackStep + 1} / {total}</span>
        <button onClick={() => setAttackStep(Math.min(total - 1, attackStep + 1))} disabled={attackStep === total - 1}
          className={`px-4 py-2 text-xs rounded-lg border transition-all ${attackStep === total - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:-translate-y-0.5'} ${isDark ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
          <Tx path="problem.next" /> →
        </button>
      </div>
    </div>
  )
}

// ═══ FIX-06: MUTEX CALLOUT ═══
function MutexCallout({ isDark }) {
  return (
    <div className={`rounded-2xl border-l-4 p-5 sm:p-6 ${
      isDark
        ? 'bg-[#3d2e00]/20 border-[#fdd663] border-[#6b5200]/50'
        : 'bg-[#fef7e0] border-[#f9ab00] border-[#fdd663]/50'
    }`} style={{ borderLeftWidth: '4px' }}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🔍</span>
        <div className="space-y-2">
          <h3 className={`text-sm font-bold ${isDark ? 'text-[#fdd663]' : 'text-[#5f3c00]'}`}>
            <Tx path="problem.mutexTitle" />
          </h3>
          <p className={`text-xs leading-relaxed ${isDark ? 'text-[#e8eaed]/80' : 'text-[#3c4043]/80'}`}>
            <Tx path="problem.mutexDesc" />
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
            {[
              { label: 'Security Score', value: '95/100', color: 'text-[#188038] dark:text-[#81c995]' },
              { label: 'CEI Compliant', value: '❌ No', color: 'text-[#d93025] dark:text-[#f28b82]' },
              { label: 'Vulnerability', value: '✅ None', color: 'text-[#188038] dark:text-[#81c995]' },
              { label: 'Protection', value: 'nonReentrant', color: 'text-[#f9ab00] dark:text-[#fdd663]' },
            ].map((s, i) => (
              <div key={i} className={`rounded-lg p-2 text-center ${isDark ? 'bg-[#202124]' : 'bg-white'}`}>
                <div className={`text-[9px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{s.label}</div>
                <div className={`text-xs font-bold ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
          <p className={`text-[10px] italic ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
            <Tx path="problem.mutexImpl" /> — membedakan "CEI violation" dari "reentrancy vulnerability" secara tepat.
          </p>
        </div>
      </div>
    </div>
  )
}

// ═══ BENEFITS SECTION ═══
function BenefitsSection({ isDark, setPromptOpen }) {
  const [ref, inView] = useInView(0.1)
  const features = [
    { icon: '🤖', title:  <Tx path="benefits.f1t" /> , desc:  <Tx path="benefits.f1d" /> , accent: isDark ? '#8ab4f8' : '#1a73e8', grad: isDark ? 'from-[#1a3a5c]' : 'from-[#e8f0fe]' },
    { icon: '📋', title:  <Tx path="benefits.f2t" /> , desc:  <Tx path="benefits.f2d" /> , accent: isDark ? '#81c995' : '#188038', grad: isDark ? 'from-[#1a3a2a]' : 'from-[#e6f4ea]' },
    { icon: '⚡', title:  <Tx path="benefits.f3t" /> , desc:  <Tx path="benefits.f3d" /> , accent: isDark ? '#fdd663' : '#f9ab00', grad: isDark ? 'from-[#3d2e00]' : 'from-[#fef7e0]' },
    { icon: '📊', title:  <Tx path="benefits.f4t" /> , desc:  <Tx path="benefits.f4d" /> , accent: isDark ? '#f28b82' : '#d93025', grad: isDark ? 'from-[#4a1c1a]' : 'from-[#fce8e6]' },
    { icon: '🔬', title:  <Tx path="benefits.f5t" /> , desc:  <Tx path="benefits.f5d" /> , accent: isDark ? '#8ab4f8' : '#1a73e8', grad: isDark ? 'from-[#1a3a5c]' : 'from-[#e8f0fe]' },
    { icon: '🔄', title:  <Tx path="benefits.f6t" /> , desc:  <Tx path="benefits.f6d" /> , accent: isDark ? '#81c995' : '#188038', grad: isDark ? 'from-[#1a3a2a]' : 'from-[#e6f4ea]' },
  ]
  return (
    <Section id="benefits" isDark={isDark} className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10" ref={ref}>
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-4 ${isDark ? 'border-[#8ab4f8]/30 text-[#8ab4f8] bg-[#8ab4f8]/10' : 'border-[#1a73e8]/20 text-[#1a73e8] bg-[#e8f0fe]'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <Tx path="benefits.badge" />
          </span>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
            <Tx path="benefits.title" /> <span className="gradient-text"><Tx path="benefits.title2" /></span>
          </h2>
        </AnimatedSection>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
          {features.map((f, idx) => (
            <div key={idx} className={`group relative rounded-2xl border p-6 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'} ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              style={{ transitionDelay: `${idx * 80}ms` }}>
              <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${f.grad} to-transparent`} />
              <div className="relative z-10">
                <div className="text-2xl mb-3 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
                <h3 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{f.title}</h3>
                <p className={`text-xs leading-relaxed ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* FIX-05: Methodology + System Prompt Button */}
        <MethodologySection isDark={isDark} setPromptOpen={setPromptOpen} />

        {/* FIX-03: AI vs Slither Table */}
        <AnimatedSection className="mt-12">
          <AiVsSlitherTable isDark={isDark} />
        </AnimatedSection>
      </div>
    </Section>
  )
}

// ═══ FIX-05: METHODOLOGY ═══
function MethodologySection({ isDark, setPromptOpen }) {
  return (
    <AnimatedSection>
      <div className={`rounded-2xl border p-6 sm:p-8 ${isDark ? 'bg-[#292a2d] border-[#3c4043]' : 'bg-white border-[#e8eaed]'}`}>
        <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="benefits.methTitle" /></h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Flowchart — redesigned vertical timeline */}
          <div>
            <h4 className={`text-sm font-semibold mb-6 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="benefits.methSub" /></h4>
            <div className="relative pl-10">
              {/* Vertical connector line */}
              <div className={`absolute left-[19px] top-4 bottom-4 w-0.5 ${isDark ? 'bg-[#3c4043]' : 'bg-[#dadce0]'}`} />
              {[
                { label:  <Tx path="benefits.methS1" /> , icon: '📄', desc:  <Tx path="benefits.methS1d" /> , color: isDark ? '#8ab4f8' : '#1a73e8' },
                { label:  <Tx path="benefits.methS2" /> , icon: '🔧', desc:  <Tx path="benefits.methS2d" /> , color: isDark ? '#9aa0a6' : '#5f6368' },
                { label:  <Tx path="benefits.methS3" /> , icon: '🤖', desc:  <Tx path="benefits.methS3d" /> , color: isDark ? '#81c995' : '#188038' },
                { label:  <Tx path="benefits.methS4" /> , icon: '📋', desc:  <Tx path="benefits.methS4d" /> , color: isDark ? '#fdd663' : '#f9ab00' },
                { label:  <Tx path="benefits.methS5" /> , icon: '⚡', desc:  <Tx path="benefits.methS5d" /> , color: isDark ? '#f28b82' : '#d93025' },
                { label:  <Tx path="benefits.methS6" /> , icon: '📊', desc:  <Tx path="benefits.methS6d" /> , color: isDark ? '#81c995' : '#188038' },
              ].map((s, i) => (
                <div key={i} className="relative pb-6 last:pb-0">
                  {/* Circle node */}
                  <div className="absolute -left-10 w-10 h-10 rounded-full flex items-center justify-center text-base border-2 bg-white dark:bg-[#202124] shadow-sm"
                    style={{ borderColor: s.color }}>
                    {s.icon}
                  </div>
                  {/* Content card */}
                  <div className={`ml-4 rounded-lg border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                    isDark ? 'border-[#3c4043] bg-[#202124] hover:border-gray-600' : 'border-[#e8eaed] bg-[#f8f9fa] hover:border-gray-300'
                  }`}>
                    <div className="text-xs font-semibold" style={{ color: s.color }}>{s.label}</div>
                    <div className={`text-[10px] mt-0.5 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* System Prompt + Limitations */}
          <div className="space-y-5">
            <div>
              <h4 className={`text-sm font-semibold mb-3 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="benefits.promptTitle" /></h4>
              <p className={`text-xs mb-3 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                <Tx path="benefits.promptDesc" />
              </p>
              <GlowButton variant={isDark ? 'primaryDark' : 'primary'} onClick={() => setPromptOpen(true)} className="px-4 py-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <Tx path="benefits.promptBtn" />
              </GlowButton>
            </div>
            {/* Limitations */}
            <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#3d2e00]/20 border-[#6b5200]/40' : 'bg-[#fef7e0] border-[#fdd663]'}`}>
              <h4 className={`text-xs font-semibold mb-2 ${isDark ? 'text-[#fdd663]' : 'text-[#5f3c00]'}`}><Tx path="benefits.limitsTitle" /></h4>
              <ul className={`text-[10px] space-y-1 ${isDark ? 'text-[#e8eaed]/70' : 'text-[#3c4043]/70'}`}>
                <li>• <Tx path="benefits.limit1" /></li>
                <li>• <Tx path="benefits.limit2" /></li>
                <li>• <Tx path="benefits.limit3" /></li>
                <li>• <Tx path="benefits.limit4" /></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}

// ═══ FIX-03: AI VS SLITHER TABLE ═══
function AiVsSlitherTable({ isDark }) {
  const rows = [
    { aspect:  <Tx path="benefits.analysisType" /> , slither: <Tx path="aiSlither.ruleBasedSlither" />, ai: <Tx path="aiSlither.semanticAI" /> },
    { aspect: 'InsecureVault', slither: <Tx path="aiSlither.insecureSlither" />, ai: <Tx path="aiSlither.insecureAI" /> },
    { aspect: 'SecureVault (CEI)', slither: <Tx path="aiSlither.secureSlither" />, ai: <Tx path="aiSlither.secureAI" /> },
    { aspect: 'MutexVault', slither: <Tx path="aiSlither.mutexSlither" />, ai: <Tx path="aiSlither.mutexAI" /> },
    { aspect: 'Output', slither: <Tx path="aiSlither.outputSlither" />, ai: <Tx path="aiSlither.outputAI" /> },
    { aspect:  <Tx path="benefits.contextExplanation" /> , slither: <Tx path="aiSlither.contextSlither" />, ai: <Tx path="aiSlither.contextAI" /> },
    { aspect: <Tx path="aiSlither.speedLabel" />, slither:  <Tx path="benefits.slitherSpeed" /> , ai: <Tx path="aiSlither.speedAI" /> },
    { aspect: <Tx path="aiSlither.roleLabel" />, slither:  <Tx path="benefits.slitherRole" /> , ai:  <Tx path="benefits.aiRole" />  },
  ]
  const highlightIdx = 3 // MutexVault row
  return (
    <div>
      <h3 className={`text-lg font-bold mb-4 text-center ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
        <Tx path="benefits.slitherTitle" />
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className={isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}>
            <th className={`text-left py-3 px-3 font-semibold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'} border-r ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}><Tx path="aiSlither.aspect" /></th>
            <th className={`text-left py-3 px-3 font-semibold ${isDark ? 'text-[#81c995]' : 'text-[#188038]'} border-r ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>🛡️ Slither (Static)</th>
            <th className={`text-left py-3 px-3 font-semibold ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>🤖 AI <Tx path="analyzer.title" /> <Tx path="analyzer.title2" /> (Semantic)</th>
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'} ${i === highlightIdx ? (isDark ? 'bg-[#3d2e00]/20' : 'bg-[#fef7e0]') : ''} hover:opacity-90`}>
                <td className={`py-2.5 px-3 font-medium border-r ${isDark ? 'border-[#3c4043] text-[#e8eaed]' : 'border-[#e8eaed] text-[#3c4043]'}`}>{row.aspect}</td>
                <td className={`py-2.5 px-3 border-r ${isDark ? 'border-[#3c4043] text-[#9aa0a6]' : 'border-[#e8eaed] text-[#5f6368]'}`}>{row.slither}</td>
                <td className={`py-2.5 px-3 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{row.ai}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={`text-[10px] text-center mt-3 italic ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
        Tabel ini menunjukkan bahwa AI Analyzer dan Slither bersifat komplementer, bukan substitusi.
        Baris MutexVault di-highlight karena menunjukkan insight unik penelitian ini.
      </p>
    </div>
  )
}

// ═══ PROJECT SECTION ═══
function ProjectSection({ isDark }) {
  const [ref, inView] = useInView(0.1)
  const S = isDark ? T.dark : T.light
  return (
    <Section id="project" isDark={isDark} className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6" ref={ref}>
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-4 ${isDark ? 'border-[#81c995]/30 text-[#81c995] bg-[#81c995]/10' : 'border-[#188038]/20 text-[#188038] bg-[#e6f4ea]'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <Tx path="project.badge" />
          </span>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
            Project <span className="gradient-text">Profile</span>
          </h2>
        </AnimatedSection>

        <div className={`space-y-6 transition-all duration-700 ${inView ? 'opacity-100' : 'opacity-0'}`}>
          {/* Info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🎓', label: <Tx path="project.info1" />, value: <Tx path="project.info1v" /> },
              { icon: '👨‍🔬', label: <Tx path="project.info2" />, value: <Tx path="project.info2v" />, sub: <Tx path="project.info2s" /> },
              { icon: '👩‍🏫', label: <Tx path="project.info3" />, value: <Tx path="project.info3v" />, sub: <Tx path="project.info3s" /> },
              { icon: '📅', label: <Tx path="project.info4" />, value: <Tx path="project.info4v" /> },
            ].map((item, i) => (
              <div key={i} className={`rounded-xl border p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
                <div className="text-2xl mb-2">{item.icon}</div>
                <div className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{item.label}</div>
                <div className={`text-sm font-semibold mt-1 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{item.value}</div>
                {item.sub && <div className={`text-[10px] mt-0.5 ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>{item.sub}</div>}
              </div>
            ))}
          </div>

          {/* Main content */}
          <div className={`rounded-2xl border p-6 sm:p-8 ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
            <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="project.summary" /></h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>🎯 <Tx path="project.goal" /></h4>
                  <p className={`text-sm leading-relaxed ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    <Tx path="project.goalDesc" />
                  </p>
                </div>
                <div>
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>🛡️ <Tx path="project.methods" /></h4>
                  <ul className={`space-y-1.5 text-sm ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    {['SecureVault (CEI Pattern) — Checks-Effects-Interactions', 'MutexVault (ReentrancyGuard) — nonReentrant modifier', 'AI-Assisted CEI Analyzer — LLM-based semantic verification'].map((m, i) => (
                      <li key={i} className="flex items-start gap-2"><span className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDark ? 'bg-[#81c995]' : 'bg-[#188038]'}`} />{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>🛠️ <Tx path="project.tech" /></h4>
                  <div className="flex flex-wrap gap-2">
                    {['Solidity', 'Hardhat', 'Ethers.js', 'Slither', 'React', 'Tailwind', 'Deepseek AI', 'OpenZeppelin', 'Sepolia'].map((tech, i) => (
                      <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-all hover:-translate-y-0.5 ${isDark ? 'border-[#3c4043] text-[#9aa0a6] bg-[#202124] hover:border-[#8ab4f8]/30' : 'border-[#e8eaed] text-[#5f6368] bg-[#f8f9fa] hover:border-[#1a73e8]/20'}`}>{tech}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className={`text-sm font-semibold mb-2 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="project.structure" /></h4>
                  <div className={`rounded-lg p-4 font-mono text-[10px] leading-relaxed ${isDark ? 'bg-[#202124] text-[#9aa0a6]' : 'bg-[#f8f9fa] text-[#5f6368]'}`}>
                    <div className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}>reentrancy-research/</div>
                    <div className="pl-4">├── contracts/ (3 vault contracts)</div>
                    <div className="pl-4">├── test/ (5 test suites)</div>
                    <div className="pl-4">├── slither/ (static analysis)</div>
                    <div className="pl-4">├── analysis/ (gas & data)</div>
                    <div className="pl-4">└── <span className={isDark ? 'text-[#81c995]' : 'text-[#188038]'}>cei-analyzer/</span> ← <Tx path="project.publication" /></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FIX-06 already shown in ProblemSection as MutexCallout */}

          {/* Contract comparison badges */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { name: 'InsecureVault', status: 'VULNERABLE', color: isDark ? 'bg-[#4a1c1a] text-[#f28b82] border-[#8a3a35]' : 'bg-[#fce8e6] text-[#c5221f] border-[#f5a8a3]' },
              { name: 'SecureVault', status: 'CEI SECURE', color: isDark ? 'bg-[#1a3a2a] text-[#81c995] border-[#2d6b45]' : 'bg-[#e6f4ea] text-[#137333] border-[#81c995]' },
              { name: 'MutexVault', status: 'MUTEX SECURE', color: isDark ? 'bg-[#3d2e00] text-[#fdd663] border-[#6b5200]' : 'bg-[#fef7e0] text-[#5f3c00] border-[#fdd663]' },
            ].map((c, i) => (
              <div key={i} className={`rounded-xl border p-3 sm:p-4 text-center ${c.color}`}>
                <div className={`text-[11px] font-mono font-semibold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{c.name}</div>
                <div className={`inline-block px-2 py-0.5 rounded text-[9px] font-medium mt-1 ${c.color}`}>{c.status}</div>
              </div>
            ))}
          </div>

          {/* CASE STUDY: SUPPLY CHAIN EFFICIENCY */}
          <SupplyChainCaseStudy isDark={isDark} />
        </div>
      </div>
    </Section>
  )
}

// ═══ SUPPLY CHAIN CASE STUDY ═══
function SupplyChainCaseStudy({ isDark }) {
  const [ref, inView] = useInView(0.1)
  const diff = mutexStats.mean - ceiStats.mean // 2,413 gas
  const deployDiff = 652666 - 597229 // 55,437 gas
  const pct = ((diff / mutexStats.mean) * 100).toFixed(2)
  const deployPct = ((deployDiff / 652666) * 100).toFixed(2)

  const scenarios = [
    { label: '🏭 Kopi Gayo (Aceh)', txMonth: 667, desc: 'Ekspor specialty coffee 2.000 kontainer/tahun' },
    { label: '🏪 B2B Marketplace RI', txMonth: 15000, desc: 'Platform escrow B2B Indonesia' },
    { label: '🛒 E-Commerce Nasional', txMonth: 2859000, desc: 'Migrasi COD ke blockchain escrow 5%' },
  ]

  function formatGas(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + ' M'
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Jt'
    return n.toLocaleString()
  }
  function formatMoney(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + ' Jt'
    if (n >= 1e3) return (n / 1e3).toFixed(0) + ' Rb'
    return Math.round(n).toLocaleString()
  }

  return (
    <AnimatedSection>
      <div ref={ref} className={`rounded-2xl border p-6 sm:p-8 mt-8 ${isDark ? 'border-[#81c995]/30 bg-[#1a3a2a]/10' : 'border-[#188038]/20 bg-[#e6f4ea]'}`}>
        <div className="flex items-start gap-3 mb-5">
          <span className="text-xl flex-shrink-0">📦</span>
          <div>
            <h3 className={`text-base sm:text-lg font-bold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
              <Tx path="case.title" /> <span className="gradient-text"><Tx path="case.title2" /></span>
            </h3>
            <p className={`text-xs mt-1 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
              Berdasarkan data penelitian — simulasi skenario escrow komoditas sesuai proposal (Pembeli A: 1,5 ETH/ton, Pembeli B: 0,8 ETH/partial)
            </p>
          </div>
        </div>

        {/* Keuntungan per Transaksi */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {[
            { icon: '⛽', label:  <Tx path="case.benefit1" /> , value: `${Math.round(diff).toLocaleString()} gas`, sub: `${pct}% <Tx path="case.benefit1s" />` },
            { icon: '🚀', label:  <Tx path="case.benefit2" /> , value: `${deployDiff.toLocaleString()} gas`, sub: <>{deployPct}% <Tx path="case.benefit2s" /></> },
            { icon: '🔬', label:  <Tx path="case.benefit3" /> , value: 'CEI: 1 vs Mutex: 3', sub: <>2 <Tx path="case.benefit3s" /></> },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border p-4 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className={`text-xs font-semibold ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>{s.label}</div>
              <div className={`text-lg font-bold mt-1 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{s.value}</div>
              <div className={`text-[10px] mt-1 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabel Simulasi */}
        <h4 className={`text-sm font-semibold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="case.tableTitle" /> <span className={`text-[10px] font-normal ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>(gas 20 gwei · ETH $2.500 · Rp 16.000/USD)</span></h4>
        <div className="overflow-x-auto mb-4">
          <table className="w-full border-separate border-spacing-0">
            <thead>
              <tr className={`text-[11px] ${isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}`}>
                <th className={`text-left py-3 px-4 font-semibold uppercase tracking-wider rounded-tl-xl border-b ${isDark ? 'border-[#3c4043] text-[#e8eaed]' : 'border-[#e8eaed] text-[#3c4043]'}`}><Tx path="case.thScenario" /></th>
                <th className={`text-right py-3 px-4 font-semibold uppercase tracking-wider border-b ${isDark ? 'border-[#3c4043] text-[#9aa0a6]' : 'border-[#e8eaed] text-[#5f6368]'}`}>Transaksi / <Tx path="project.info4" /></th>
                <th className={`text-right py-3 px-4 font-semibold uppercase tracking-wider border-b ${isDark ? 'border-[#3c4043] text-[#81c995]' : 'border-[#e8eaed] text-[#188038]'}`}><Tx path="case.thGas" /></th>
                <th className={`text-right py-3 px-4 font-semibold uppercase tracking-wider border-b ${isDark ? 'border-[#3c4043] text-[#8ab4f8]' : 'border-[#e8eaed] text-[#1a73e8]'}`}><Tx path="case.thUSD" /></th>
                <th className={`text-right py-3 px-4 font-semibold uppercase tracking-wider rounded-tr-xl border-b ${isDark ? 'border-[#3c4043] text-[#fdd663]' : 'border-[#e8eaed] text-[#f9ab00]'}`}><Tx path="case.thIDR" /></th>
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s, i) => {
                const yearly = diff * s.txMonth * 12
                const yearlyEth = yearly * 20 * 1e-9 * 2500
                const rupiah = yearlyEth * 16000
                const isLast = i === scenarios.length - 1
                const isBig = s.txMonth > 10000
                return (
                  <tr key={i} className={`group transition-all duration-200 ${isDark ? 'hover:bg-[#35363a]' : 'hover:bg-[#f1f3f4]'} ${isBig ? (isDark ? 'bg-[#1a3a5c]/5' : 'bg-[#e8f0fe]/30') : ''}`}>
                    <td className={`py-3 px-4 border-b ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'} ${isLast ? 'rounded-bl-xl' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{s.label.split(' ')[0]}</span>
                        <div>
                          <div className={`text-xs font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{s.label.split(' ').slice(1).join(' ')}</div>
                          <div className={`text-[10px] ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>{s.desc}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono text-xs border-b ${isDark ? 'border-[#3c4043] text-[#9aa0a6]' : 'border-[#e8eaed] text-[#5f6368]'}`}>{(s.txMonth * 12).toLocaleString()}</td>
                    <td className={`py-3 px-4 text-right font-mono text-xs font-semibold border-b ${isDark ? 'border-[#3c4043] text-[#81c995]' : 'border-[#e8eaed] text-[#188038]'}`}>{formatGas(yearly)}</td>
                    <td className={`py-3 px-4 text-right font-mono text-xs font-semibold border-b ${isDark ? 'border-[#3c4043] text-[#8ab4f8]' : 'border-[#e8eaed] text-[#1a73e8]'}`}>${formatMoney(yearlyEth)}</td>
                    <td className={`py-3 px-4 text-right font-mono text-xs font-semibold border-b ${isLast ? 'rounded-br-xl' : ''} ${isDark ? 'border-[#3c4043] text-[#fdd663]' : 'border-[#e8eaed] text-[#5f3c00]'}`}>Rp {formatMoney(rupiah)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className={`text-[10px] mt-2 italic text-right ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
          * Perhitungan: hemat per withdraw = 2.413 gas, gas price = 20 gwei, ETH = $2.500, USD/IDR = Rp 16.000
        </p>

        {/* Insight box */}
        <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#1a3a5c]/20 border-[#8ab4f8]/30' : 'bg-[#e8f0fe] border-[#a8c7fa]'}`}>
          <div className="flex items-start gap-2">
            <span className="text-lg flex-shrink-0">💡</span>
            <div className="space-y-1">
              <h4 className={`text-xs font-semibold ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>💡 <Tx path="case.insightTitle" /></h4>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#e8eaed]/70' : 'text-[#3c4043]/70'}`}>
                <Tx path="case.insight1" />
              </p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#e8eaed]/70' : 'text-[#3c4043]/70'}`}>
                <Tx path="case.insight2" />
              </p>
              <p className={`text-xs leading-relaxed ${isDark ? 'text-[#e8eaed]/70' : 'text-[#3c4043]/70'}`}>
                <Tx path="case.insight3" />
              </p>
              <p className={`text-xs italic ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
                * Estimasi berdasarkan data 30 iterasi Hardhat + validasi Sepolia Testnet.
                Data transaksi dari BPS, Bank Indonesia, asosiasi industri (2024).
                Biaya mainnet aktual bervariasi karena EIP-1559 dynamic base fee.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AnimatedSection>
  )
}

// ═══ FIX-02: GAS ANALYSIS SECTION ═══
function GasSection({ isDark }) {
  const [ref, inView] = useInView(0.1)
  const gasChartData = chartData
  const diff = mutexStats.mean - ceiStats.mean
  const eff = ((diff / mutexStats.mean) * 100).toFixed(1)

  return (
    <Section id="gas" isDark={isDark} className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6" ref={ref}>
        <AnimatedSection className="text-center max-w-3xl mx-auto mb-16">
          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-4 ${isDark ? 'border-[#81c995]/30 text-[#81c995] bg-[#81c995]/10' : 'border-[#188038]/20 text-[#188038] bg-[#e6f4ea]'}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            <Tx path="gas.badge" />
          </span>
          <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
            <Tx path="gas.title" /> <span className="gradient-text"><Tx path="gas.title2" /></span>
          </h2>
          <p className={`text-base sm:text-lg leading-relaxed ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
            <Tx path="gas.desc" />
          </p>
        </AnimatedSection>

        {/* A. Summary Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { icon: '🟢', label:  <Tx path="gas.stat1" /> , value: `${Math.round(ceiStats.mean).toLocaleString()}`, sub: 'gas/tx' },
            { icon: '🟡', label:  <Tx path="gas.stat2" /> , value: `${Math.round(mutexStats.mean).toLocaleString()}`, sub: 'gas/tx' },
            { icon: '📊', label:  <Tx path="gas.stat3" /> , value: `+${Math.round(diff).toLocaleString()}`, sub:  <Tx path="gas.stat3s" />  },
            { icon: '⚡', label:  <Tx path="gas.stat4" /> , value: `${eff}%`, sub:  <Tx path="gas.stat4s" />  },
          ].map((s, i) => (
            <div key={i} className={`rounded-xl border p-4 text-center transition-all duration-500 hover:-translate-y-1 hover:shadow-xl ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
              <div className="text-lg mb-1">{s.icon}</div>
              <div className={`text-lg sm:text-xl font-bold ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>{s.value}</div>
              <div className={`text-[10px] ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{s.label}</div>
              <div className={`text-[9px] ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* B. Bar Chart */}
        <AnimatedSection>
          <div className={`rounded-2xl border p-5 mb-8 ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
            <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>📊 Perbandingan Gas per Iterasi (CEI vs Mutex)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={gasChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#3c4043' : '#e8eaed'} />
                <XAxis dataKey="iteration" tick={{ fontSize: 10, fill: isDark ? '#9aa0a6' : '#5f6368' }} />
                <YAxis tick={{ fontSize: 10, fill: isDark ? '#9aa0a6' : '#5f6368' }} />
                <Tooltip contentStyle={{ backgroundColor: isDark ? '#292a2d' : '#fff', border: `1px solid ${isDark ? '#3c4043' : '#dadce0'}`, borderRadius: '8px', fontSize: '11px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="CEI" fill="#22c55e" radius={[3, 3, 0, 0]} name="CEI Pattern" />
                <Bar dataKey="Mutex" fill="#f59e0b" radius={[3, 3, 0, 0]} name="ReentrancyGuard" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </AnimatedSection>

        {/* C. Statistics Table + Opcode */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Stats table */}
          <AnimatedSection>
            <div className={`rounded-2xl border p-5 ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}]`}><Tx path="gas.statsTitle" /></h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className={isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="gas.statsStat" /></th>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>CEI</th>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#fdd663]' : 'text-[#f9ab00]'}`}>Mutex</th>
                  </tr></thead>
                  <tbody>
                    {[
                      { label: 'Mean', cei: ceiStats.mean.toFixed(1), mutex: mutexStats.mean.toFixed(1) },
                      { label: 'Std Dev', cei: ceiStats.std.toFixed(1), mutex: mutexStats.std.toFixed(1) },
                      { label: 'Min', cei: ceiStats.min, mutex: mutexStats.min },
                      { label: 'Max', cei: ceiStats.max, mutex: mutexStats.max },
                      { label: 'Median', cei: ceiStats.median.toFixed(1), mutex: mutexStats.median.toFixed(1) },
                    ].map((row, i) => (
                      <tr key={i} className={`border-t ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
                        <td className={`py-2 px-3 font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{row.label}</td>
                        <td className={`py-2 px-3 font-mono ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>{row.cei}</td>
                        <td className={`py-2 px-3 font-mono ${isDark ? 'text-[#fdd663]' : 'text-[#f9ab00]'}`}>{row.mutex}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </AnimatedSection>

          {/* Opcode comparison */}
          <AnimatedSection>
            <div className={`rounded-2xl border p-5 ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#e8eaed] bg-white'}`}>
              <h3 className={`text-sm font-semibold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="gas.opcodeTitle" /></h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className={isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Opcode</th>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>CEI</th>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#fdd663]' : 'text-[#f9ab00]'}`}>Mutex</th>
                    <th className={`text-left py-2.5 px-3 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="opcode.description" /></th>
                  </tr></thead>
                  <tbody>
                    {opcodeData.map((row, i) => (
                      <tr key={i} className={`border-t ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
                        <td className={`py-2 px-3 font-mono font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{row.opcode}</td>
                        <td className={`py-2 px-3 font-mono ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>{row.CEI}</td>
                        <td className={`py-2 px-3 font-mono ${isDark ? 'text-[#fdd663]' : 'text-[#f9ab00]'}`}>{row.Mutex}</td>
                        <td className={`py-2 px-3 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{row.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className={`text-[10px] mt-3 italic ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
                Mutex <Tx path="opcode.overheadNote" />
              </p>
            </div>
          </AnimatedSection>
        </div>

        {/* E. Statistical Test Results */}
        <AnimatedSection>
          <div className={`rounded-2xl border p-5 sm:p-6 ${isDark ? 'border-[#1a3a5c]/50 bg-[#1a3a5c]/10' : 'border-[#a8c7fa] bg-[#e8f0fe]'}`}>
            <h3 className={`text-sm font-semibold mb-4 flex items-center gap-2 ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>
              <Tx path="gas.testTitle" /> <Tx path="gas.statsStat" />
            </h3>
            <div className="space-y-3">
              {[
                { label: <Tx path="gas.testG1" />, cls: 'warning', items: [
                  { text: <Tx path="gas.testG1i1" />, status: 'info' },
                  { text: <Tx path="gas.testG1i2" />, status: 'info' },
                  { text: <Tx path="gas.testG1i3" />, status: 'info' },
                  { text: <>CEI <Tx path="gas.testG1i4" /> (29.950 {'<'} 32.363)</>, status: 'pass' },
                ]},
                { label: <Tx path="gas.opcodeCompTitle" />, items: [
                  { text: <Tx path="gas.testG2i1" />, status: 'pass' },
                  { text: <Tx path="gas.testG2i2" />, status: 'pass' },
                  { text: <Tx path="gas.testG2i3" />, status: 'info' },
                ]},
                { label: <Tx path="gas.mainResult" />, items: [
                  { text: <Tx path="gas.testG3i1" />, status: 'info' },
                  { text: <Tx path="gas.testG3i2" />, status: 'pass' },
                  { text: <Tx path="gas.testG3i3" />, status: 'pass' },
                  { text: 'Cohen\'s d = inf (effect size deterministik — sangat besar)', status: 'pass' },
                ]},
              ].map((group, i) => (
                <div key={i} className={`rounded-lg p-3 ${isDark ? 'bg-[#202124]' : 'bg-white'} ${group.cls === 'warning' ? (isDark ? 'border-l-2 border-[#fdd663]' : 'border-l-2 border-[#f9ab00]') : ''}`}>
                  <h4 className={`text-xs font-semibold mb-1.5 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{group.label}</h4>
                  {group.items.map((item, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className={item.status === 'pass' ? 'text-[#188038] dark:text-[#81c995]' : item.status === 'info' ? (isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]') : 'text-[#d93025] dark:text-[#f28b82]'}>
                        {item.status === 'pass' ? '✅' : item.status === 'info' ? 'ℹ️' : '❌'}
                      </span>
                      <span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}>{item.text}</span>
                    </div>
                  ))}
                </div>
              ))}
              {/* Kesimpulan */}
              <div className={`rounded-lg p-4 border ${isDark ? 'bg-[#1a3a2a]/30 border-[#2d6b45]/50' : 'bg-[#e6f4ea] border-[#81c995]'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎯</span>
                  <div>
                    <h4 className={`text-sm font-bold ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}><Tx path="gas.conclusion" /></h4>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-[#e8eaed]/70' : 'text-[#3c4043]/70'}`}>
                      <Tx path="gas.conclusionDesc" /> <strong className={isDark ? 'text-[#81c995]' : 'text-[#188038]'}>{Math.round(diff).toLocaleString()} gas/tx ({eff}%)</strong>.
                      Rata-rata penghematan gas: <strong className={isDark ? 'text-[#81c995]' : 'text-[#188038]'}>{Math.round(diff).toLocaleString()} gas/tx ({eff}%)</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AnimatedSection>

        {/* SEPOLIA ON-CHAIN VALIDATION */}
        <AnimatedSection>
          <div className={`rounded-2xl border p-5 sm:p-6 ${isDark ? 'border-[#8ab4f8]/40 bg-[#1a3a5c]/10' : 'border-[#1a73e8]/30 bg-[#e8f0fe]'}`}>
            <h3 className={`text-sm font-bold mb-4 flex items-center gap-2 ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}>
              <span>🌐</span> <Tx path="gas.onChainTitle" />
            </h3>
            <p className={`text-xs mb-4 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
              <Tx path="gas.onChainDesc" />
              <Tx path="case.insight2" /> memvalidasi bahwa serangan benar-benar terjadi di blockchain nyata,
              pengujian dijalankan ulang di <strong>Sepolia Testnet Ethereum</strong> dengan jumlah ETH sesuai proposal.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {/* Attack Result Card */}
              <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#4a1c1a]/20 border-[#8a3a35]/50' : 'bg-[#fce8e6] border-[#f5a8a3]'}`}>
                <h4 className={`text-xs font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}`}>
                  <span>🔴</span> <Tx path="gas.attackCard" />
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onHoneypot" /></span><span className="font-medium">2,3 ETH ✅ Proposal</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onGas" /></span><span className="font-mono font-bold">336.027 gas</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onLoops" /></span><span className="font-mono font-bold">24x</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onVault" /></span><span className="font-bold">2,4 → 0,0 ETH 💀</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onProfit" /></span><span className="font-bold">2,3 ETH 🚨</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onProof" /></span><a href="https://sepolia.etherscan.io/address/0xC717535bA12D65141bD30504e1B5b36a0079511C" target="_blank" rel="noopener noreferrer" className={`text-[10px] font-medium underline hover:opacity-80 ${isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}`}><Tx path="gas.onViewTx" /> ↗</a></div>
                </div>
              </div>

              {/* CEI Prevention Card */}
              <div className={`rounded-xl border p-4 ${isDark ? 'bg-[#1a3a2a]/20 border-[#2d6b45]/50' : 'bg-[#e6f4ea] border-[#81c995]'}`}>
                <h4 className={`text-xs font-semibold mb-3 flex items-center gap-2 ${isDark ? 'text-[#81c995]' : 'text-[#188038]'}`}>
                  <span>🟢</span> <Tx path="gas.ceiCard" />
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onTarget" /></span><span className="font-medium">SecureVault</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onResult" /></span><span className="font-bold text-[#188038] dark:text-[#81c995]">TX REVERTED ✅</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onSafe" /></span><span className="font-bold">1,5 ETH aman 🔒</span></div>
                  <div className="flex justify-between"><span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}><Tx path="gas.onReason" /></span><span className={isDark ? 'text-[#8ab4f8] text-[11px]' : 'text-[#1a73e8] text-[11px]'}>{`require(amount > 0)`} <Tx path="result.vulnerable" /></span></div>
                  <div className="mt-2 p-2 rounded text-[10px] leading-relaxed ${isDark ? 'bg-[#202124] text-[#9aa0a6]' : 'bg-white text-[#5f6368]'}">
                    CEI Pattern: balances = 0 <strong><Tx path="gas.onCEIDesc" /></strong> .call() —
                    saat fallback() memanggil ulang, saldo sudah 0 → REVERT
                  </div>
                </div>
              </div>
            </div>

            {/* Contract addresses */}
            <div className={`rounded-lg p-3 font-mono text-[10px] leading-relaxed ${isDark ? 'bg-[#202124] text-[#9aa0a6]' : 'bg-white text-[#5f6368]'}`}>
              <div className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8)'}>🔗 Sepolia Contract Links (Klik untuk lihat TX):</div>
              <div>• InsecureVault: <a href="https://sepolia.etherscan.io/address/0xAcb09a7fC19Fdbb27e3AC2cC23c5071456f28E1b" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color: isDark ? '#8ab4f8' : '#1a73e8'}}>0xAcb09a7fC19Fdbb27e3AC2cC23c5071456f28E1b ↗</a></div>
              <div>• SecureVault: <a href="https://sepolia.etherscan.io/address/0x711295a8465d1c8543D4b7db45Ac4A82Df9573c6" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color: isDark ? '#81c995' : '#188038'}}>0x711295a8465d1c8543D4b7db45Ac4A82Df9573c6 ↗</a></div>
              <div>• Attacker (Attack TX): <a href="https://sepolia.etherscan.io/address/0xC717535bA12D65141bD30504e1B5b36a0079511C" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{color: isDark ? '#f28b82' : '#c5221f'}}>0xC717535bA12D65141bD30504e1B5b36a0079511C ↗</a></div>
              <div className="mt-1 italic"><Tx path="gas.onNote" /></div>
            </div>

            <p className={`text-[10px] mt-3 italic ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
              Catatan: 30 iterasi Hardhat bersifat deterministik (EVM lokal).
              Testnet Sepolia memvalidasi bahwa serangan berhasil di blockchain nyata dengan jumlah ETH sesuai proposal (Buyer A: 1,5 ETH, Buyer B: 0,8 ETH, Attacker: 0,1 ETH).
            </p>
          </div>
        </AnimatedSection>
      </div>
    </Section>
  )
}

// ═══ ANALYZER CONTENT ═══
function AnalyzerContent(props) {
  const { isDark, t, activeTab, setActiveTab, compareTab, setCompareTab,
    solidityCode, setSolidityCode, analysisResult, isLoading, error,
    handleAnalyze, renderResult, loadingSteps, loadingStep,
    leftCode, setLeftCode, rightCode, setRightCode,
    leftResult, rightResult, isCompareLoading, handleCompare,
    c3left, setC3left, c3center, setC3center, c3right, setC3right,
    c3lResult, c3cResult, c3rResult, isC3Loading, handleCompare3, handleExportAll3 } = props

  return (
    <>
      <AnimatedSection className="text-center max-w-3xl mx-auto mb-12">
        <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-4 ${isDark ? 'border-[#8ab4f8]/30 text-[#8ab4f8] bg-[#8ab4f8]/10' : 'border-[#1a73e8]/20 text-[#1a73e8] bg-[#e8f0fe]'}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          AI-Assisted Security Tool
        </span>
        <h2 className={`text-3xl sm:text-4xl font-bold mb-4 ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>
          CEI Pattern <span className="gradient-text">Analyzer</span>
        </h2>
      </AnimatedSection>

      {/* Main tabs */}
      <div className={`flex gap-1 mb-6 border-b ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
        {[
          { id: 'single', label: 'Single Analysis', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
          { id: 'compare', label:  <Tx path="analyzer.compare" /> , icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-xs font-medium transition-colors ${
              activeTab === tab.id ? (isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]') : (isDark ? 'text-[#9aa0a6] hover:text-[#e8eaed]' : 'text-[#5f6368] hover:text-[#3c4043]')
            }`}>
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={tab.icon}/></svg>
              {tab.label}
            </span>
            {activeTab === tab.id && <span className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full ${isDark ? 'bg-[#8ab4f8]' : 'bg-[#1a73e8]'}`} />}
          </button>
        ))}
      </div>

      {activeTab === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="analyzer.input" /></span>
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: 'InsecureVault', code: INSECURE_VAULT, c: isDark ? 'border-[#8a3a35] text-[#f28b82] hover:bg-[#4a1c1a]/50' : 'border-[#f5a8a3] text-[#c5221f] hover:bg-[#fce8e6]' },
                  { label: 'SecureVault', code: SECURE_VAULT, c: isDark ? 'border-[#2d6b45] text-[#81c995] hover:bg-[#1a3a2a]/50' : 'border-[#81c995] text-[#137333] hover:bg-[#e6f4ea]' },
                  { label: 'MutexVault', code: MUTEX_VAULT, c: isDark ? 'border-[#6b5200] text-[#fdd663] hover:bg-[#3d2e00]/50' : 'border-[#fdd663] text-[#5f3c00] hover:bg-[#fef7e0]' },
                ].map(p => (
                  <button key={p.label} onClick={() => setSolidityCode(p.code)}
                    className={`px-3 py-1 text-[10px] font-medium rounded-full border transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${p.c}`}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
              <div className={`flex items-center gap-1.5 px-4 py-2 border-b ${isDark ? 'border-[#3c4043] bg-[#202124]' : 'border-[#e8eaed] bg-[#f8f9fa]'}`}>
                <span className="w-3 h-3 rounded-full bg-[#d93025]" /><span className="w-3 h-3 rounded-full bg-[#f9ab00]" /><span className="w-3 h-3 rounded-full bg-[#188038]" />
                <span className={`ml-2 text-[10px] font-mono ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>contract.sol</span>
              </div>
              <textarea value={solidityCode} onChange={e => setSolidityCode(e.target.value)} placeholder="// Paste your Solidity contract here..."
                className={`w-full h-[400px] p-4 font-mono text-sm leading-relaxed resize-none focus:outline-none custom-textarea ${isDark ? 'bg-[#202124] text-[#e8eaed] placeholder-[#5f6368]' : 'bg-white text-[#3c4043] placeholder-[#80868b]'}`} spellCheck={false} />
            </div>
            <GlowButton variant={isDark ? 'primaryDark' : 'primary'} onClick={handleAnalyze} disabled={isLoading || !solidityCode.trim()} className="w-full py-3">
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                  {loadingSteps[loadingStep]}
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
                  <Tx path="analyzer.analyze" />
                </span>
              )}
            </GlowButton>
          </div>
          <div>
            <span className={`text-xs font-medium uppercase tracking-wider mb-4 block ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="analyzer.result" /></span>
            <div className={`rounded-xl border p-5 min-h-[520px] ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#dadce0] bg-white'}`}>
              {isLoading && (
                <div className="flex flex-col items-center justify-center h-80 space-y-4">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1a73e8] animate-spin" />
                    <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-[#34a853] animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                  </div>
                  <div className={`text-center ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>
                    <p className="text-sm font-medium">{loadingSteps[loadingStep]}</p>
                    <div className="flex gap-1 justify-center mt-2">
                      {loadingSteps.map((_, i) => (
                        <div key={i} className={`w-2 h-2 rounded-full transition-all duration-300 ${i <= loadingStep ? (isDark ? 'bg-[#8ab4f8]' : 'bg-[#1a73e8]') : (isDark ? 'bg-[#3c4043]' : 'bg-[#e8eaed]')}`} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className={`rounded-lg p-4 border ${isDark ? 'bg-[#4a1c1a]/30 border-[#8a3a35]/50' : 'bg-[#fce8e6] border-[#f5a8a3]'}`}>
                  <div className="flex items-start gap-3">
                    <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}`} fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                    <div>
                      <h4 className={`text-sm font-medium ${isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'}`}><Tx path="analyzer.error" /></h4>
                      <p className={`text-xs mt-1 ${isDark ? 'text-[#e8eaed]/70' : 'text-[#5f6368]'}`}>{error}</p>
                    </div>
                  </div>
                </div>
              )}
              {!isLoading && !error && !analysisResult && (
                <div className={`flex flex-col items-center justify-center h-80 space-y-4 ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
                  <svg className="w-16 h-16 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
                  <p className="text-sm text-center max-w-xs"><Tx path="analyzer.placeholder" /><span className={isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'}>Analyze</span></p>
                </div>
              )}
              {!isLoading && analysisResult && renderResult(analysisResult)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'compare' && (
        <div className="space-y-6">
          {/* Compare sub-tabs: 2 kontrak vs 3 kontrak (FIX-01) */}
          <div className={`flex gap-1 border-b ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
            {[
              { id: 'two', label: 'Compare 2 Contracts' },
              { id: 'three', label: 'Compare All 3 Contracts' },
            ].map(t => (
              <button key={t.id} onClick={() => setCompareTab(t.id)}
                className={`relative px-4 py-2 text-[10px] font-medium transition-colors ${
                  compareTab === t.id ? (isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]') : (isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]')
                }`}>
                {t.label}
                {compareTab === t.id && <span className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${isDark ? 'bg-[#8ab4f8]' : 'bg-[#1a73e8]'}`} />}
              </button>
            ))}
          </div>

          {compareTab === 'two' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[
                  { label: 'Left Contract', val: leftCode, set: setLeftCode, presets: [
                    { l: 'Insecure', c: isDark ? 'border-[#8a3a35] text-[#f28b82]' : 'border-[#f5a8a3] text-[#c5221f]', code: INSECURE_VAULT },
                    { l: 'Secure', c: isDark ? 'border-[#2d6b45] text-[#81c995]' : 'border-[#81c995] text-[#137333]', code: SECURE_VAULT },
                  ]},
                  { label: 'Right Contract', val: rightCode, set: setRightCode, presets: [
                    { l: 'Secure', c: isDark ? 'border-[#2d6b45] text-[#81c995]' : 'border-[#81c995] text-[#137333]', code: SECURE_VAULT },
                    { l: 'Insecure', c: isDark ? 'border-[#8a3a35] text-[#f28b82]' : 'border-[#f5a8a3] text-[#c5221f]', code: INSECURE_VAULT },
                  ]},
                ].map(p => (
                  <EditorBox key={p.label} label={p.label} code={p.val} onChange={p.set} presets={p.presets} isDark={isDark} />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <GlowButton variant={isDark ? 'primaryDark' : 'primary'} onClick={handleCompare} disabled={isCompareLoading || !leftCode.trim() || !rightCode.trim()} className="px-6 py-3">
                  {isCompareLoading ? (
                    <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><Tx path="common.loading" /></span>
                  ) : (
                    <span className="flex items-center gap-2"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg><Tx path="analyzer.compare" /></span>
                  )}
                </GlowButton>
                {(leftResult || rightResult) && (
                  <button onClick={() => handleExport({ left: leftResult, right: rightResult }, 'two-way-compare')}
                    className={`px-4 py-3 rounded-xl text-xs font-medium border transition-all hover:-translate-y-0.5 ${isDark ? 'border-[#3c4043] hover:border-[#8ab4f8]/30' : 'border-[#dadce0] hover:border-[#1a73e8]/20'}`}>
                    <Tx path="analyzer.export" />
                  </button>
                )}
              </div>
              {(leftResult || rightResult) && <CompareTable2 leftResult={leftResult} rightResult={rightResult} isDark={isDark} />}
            </>
          )}

          {compareTab === 'three' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Left (Insecure)', val: c3left, set: setC3left, presets: [
                    { l: 'InsecureVault', c: isDark ? 'border-[#8a3a35] text-[#f28b82]' : 'border-[#f5a8a3] text-[#c5221f]', code: INSECURE_VAULT },
                  ]},
                  { label: 'Center (Secure)', val: c3center, set: setC3center, presets: [
                    { l: 'SecureVault', c: isDark ? 'border-[#2d6b45] text-[#81c995]' : 'border-[#81c995] text-[#137333]', code: SECURE_VAULT },
                  ]},
                  { label: 'Right (Mutex)', val: c3right, set: setC3right, presets: [
                    { l: 'MutexVault', c: isDark ? 'border-[#6b5200] text-[#fdd663]' : 'border-[#fdd663] text-[#5f3c00]', code: MUTEX_VAULT },
                  ]},
                ].map(p => (
                  <EditorBox key={p.label} label={p.label} code={p.val} onChange={p.set} presets={p.presets} isDark={isDark} />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <GlowButton variant={isDark ? 'primaryDark' : 'primary'} onClick={handleCompare3} disabled={isC3Loading || !c3left.trim() || !c3center.trim() || !c3right.trim()} className="px-6 py-3">
                  {isC3Loading ? (
                    <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg><Tx path="common.loading" /></span>
                  ) : (
                    <span className="flex items-center gap-2">⚖️ Compare All 3 Contracts</span>
                  )}
                </GlowButton>
                {(c3lResult || c3cResult || c3rResult) && (
                  <button onClick={handleExportAll3}
                    className={`px-4 py-3 rounded-xl text-xs font-medium border transition-all hover:-translate-y-0.5 ${isDark ? 'border-[#3c4043] hover:border-[#8ab4f8]/30' : 'border-[#dadce0] hover:border-[#1a73e8]/20'}`}>
                    Export All Results
                  </button>
                )}
              </div>
              {(c3lResult || c3cResult || c3rResult) && <CompareTable3 a={c3lResult} b={c3cResult} c={c3rResult} isDark={isDark} />}
            </>
          )}
        </div>
      )}
    </>
  )
}

function EditorBox({ label, code, onChange, presets, isDark }) {
  return (
    <div className={`rounded-xl border overflow-hidden ${isDark ? 'border-[#3c4043]' : 'border-[#dadce0]'}`}>
      <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-[#3c4043] bg-[#202124]' : 'border-[#e8eaed] bg-[#f8f9fa]'}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-[#5f6368]' : 'bg-[#dadce0]'}`} />
          <span className={`text-xs font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{label}</span>
        </div>
        <div className="flex gap-1.5">
          {presets.map(p => (
            <button key={p.l} onClick={() => onChange(p.code)}
              className={`px-2 py-0.5 text-[9px] font-medium rounded-full border transition-all hover:-translate-y-0.5 ${p.c}`}>{p.l}</button>
          ))}
        </div>
      </div>
      <textarea value={code} onChange={e => onChange(e.target.value)}
        className={`w-full h-[250px] p-3 font-mono text-xs leading-relaxed resize-none focus:outline-none custom-textarea ${isDark ? 'bg-[#202124] text-[#e8eaed]' : 'bg-white text-[#3c4043]'}`} spellCheck={false} />
    </div>
  )
}

function CompareTable2({ leftResult, rightResult, isDark }) {
  const rows = [
    { label: 'Status', l: leftResult?.is_vulnerable !== undefined ? (leftResult.is_vulnerable ? '🔴 VULNERABLE' : '🟢 SECURE') : '—',
      r: rightResult?.is_vulnerable !== undefined ? (rightResult.is_vulnerable ? '🔴 VULNERABLE' : '🟢 SECURE') : '—',
      lc: leftResult?.is_vulnerable ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : (isDark ? 'text-[#81c995]' : 'text-[#137333]'),
      rc: rightResult?.is_vulnerable ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : (isDark ? 'text-[#81c995]' : 'text-[#137333]') },
    { label: 'Security Score', l: leftResult ? `${leftResult.security_score}/100` : '—', r: rightResult ? `${rightResult.security_score}/100` : '—',
      lc: leftResult ? scoreColor(leftResult.security_score, isDark) : '', rc: rightResult ? scoreColor(rightResult.security_score, isDark) : '' },
    { label: 'CEI Compliant', l: leftResult ? (leftResult.is_cei_compliant ? 'Yes ✓' : 'No ✗') : '—', r: rightResult ? (rightResult.is_cei_compliant ? 'Yes ✓' : 'No ✗') : '—',
      lc: leftResult?.is_cei_compliant ? (isDark ? 'text-[#81c995]' : 'text-[#188038]') : (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]'),
      rc: rightResult?.is_cei_compliant ? (isDark ? 'text-[#81c995]' : 'text-[#188038]') : (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') },
    { label: 'Vulnerability', l: leftResult?.vulnerability_type || (leftResult && !leftResult.is_vulnerable ? 'None' : '—'),
      r: rightResult?.vulnerability_type || (rightResult && !rightResult.is_vulnerable ? 'None' : '—'),
      lc: leftResult?.is_vulnerable ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : (isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'),
      rc: rightResult?.is_vulnerable ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : (isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]') },
    { label: 'Function', l: leftResult?.function_name || '—', r: rightResult?.function_name || '—',
      lc: isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]', rc: isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]' },
  ]
  return (
    <div className={`rounded-xl border overflow-hidden animate-fadeInUp ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#dadce0] bg-white'}`}>
      <div className={`px-5 py-3 border-b ${isDark ? 'border-[#3c4043] bg-[#202124]' : 'border-[#e8eaed] bg-[#f8f9fa]'}`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>⚖️ Comparison Results</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className={isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}>
            <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'} w-32`}>Metric</th>
            <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'} border-l ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>Left Contract</th>
            <th className={`text-left py-3 px-4 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'} border-l ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>Right Contract</th>
          </tr></thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={`border-t ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
                <td className={`py-3 px-4 font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{row.label}</td>
                <td className={`py-3 px-4 border-l ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'} ${row.lc}`}>{row.l}</td>
                <td className={`py-3 px-4 border-l ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'} ${row.rc}`}>{row.r}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CompareTable3({ a, b, c, isDark }) {
  const contracts = [
    { label: 'InsecureVault', result: a },
    { label: 'SecureVault', result: b },
    { label: 'MutexVault', result: c },
  ]
  return (
    <div className={`rounded-xl border overflow-hidden animate-fadeInUp ${isDark ? 'border-[#3c4043] bg-[#292a2d]' : 'border-[#dadce0] bg-white'}`}>
      <div className={`px-5 py-3 border-b ${isDark ? 'border-[#3c4043] bg-[#202124]' : 'border-[#e8eaed] bg-[#f8f9fa]'}`}>
        <h3 className={`text-sm font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>⚖️ Three-Way Comparison</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className={isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}>
            <th className={`text-left py-3 px-3 font-medium ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>Metric</th>
            {contracts.map((c, i) => (
              <th key={i} className={`text-left py-3 px-3 font-medium border-l ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'} ${
                i === 0 ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : i === 1 ? (isDark ? 'text-[#81c995]' : 'text-[#188038]') : (isDark ? 'text-[#fdd663]' : 'text-[#f9ab00]')
              }`}>{c.label}</th>
            ))}
          </tr></thead>
          <tbody>
            {[
              { label: 'Status', key: 'status' },
              { label: 'Score', key: 'score' },
              { label: 'CEI Compliant', key: 'cei' },
              { label: 'Vulnerability', key: 'vuln' },
              { label: 'Function', key: 'func' },
            ].map((row, i) => (
              <tr key={i} className={`border-t ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
                <td className={`py-2.5 px-3 font-medium ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}>{row.label}</td>
                {contracts.map((cc, j) => {
                  const r = cc.result
                  let val = '—', cls = isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'
                  if (r) {
                    if (row.key === 'status') {
                      val = r.is_vulnerable ? '🔴 VULN' : '🟢 SECURE'
                      cls = r.is_vulnerable ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : (isDark ? 'text-[#81c995]' : 'text-[#137333]')
                    } else if (row.key === 'score') {
                      val = `${r.security_score}/100`
                      cls = scoreColor(r.security_score, isDark)
                    } else if (row.key === 'cei') {
                      val = r.is_cei_compliant ? 'Yes ✓' : 'No ✗'
                      cls = r.is_cei_compliant ? (isDark ? 'text-[#81c995]' : 'text-[#188038]') : (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]')
                    } else if (row.key === 'vuln') {
                      val = r.vulnerability_type || (r.is_vulnerable ? 'Reentrancy' : 'None')
                      cls = r.is_vulnerable ? (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]') : (isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]')
                    } else if (row.key === 'func') {
                      val = r.function_name || '—'
                      cls = isDark ? 'text-[#8ab4f8]' : 'text-[#1a73e8]'
                    }
                  }
                  return (
                    <td key={j} className={`py-2.5 px-3 border-l font-mono ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'} ${cls}`}>{val}</td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Detail cards */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-4 p-5 border-t ${isDark ? 'border-[#3c4043]' : 'border-[#e8eaed]'}`}>
        {contracts.map((cc, i) => (
          <div key={i} className={`rounded-lg p-4 ${isDark ? 'bg-[#202124]' : 'bg-[#f8f9fa]'}`}>
            <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}>{cc.label}</h4>
            {!cc.result ? (
              <div className={`text-sm ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>Waiting...</div>
            ) : (
              <div className="space-y-2 text-[10px]">
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}>Score</span>
                  <span className="font-bold" style={{ color: scoreColor(cc.result.security_score, isDark) }}>{cc.result.security_score}/100</span>
                </div>
                <div className={`w-full h-1.5 rounded-full ${isDark ? 'bg-[#3c4043]' : 'bg-[#e8eaed]'}`}>
                  <div className="h-full rounded-full score-bar-fill" style={{ width: `${cc.result.security_score}%`, backgroundColor: scoreColor(cc.result.security_score, isDark) }} />
                </div>
                <div className="flex items-center justify-between">
                  <span className={isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}>CEI</span>
                  <span className={cc.result.is_cei_compliant ? (isDark ? 'text-[#81c995]' : 'text-[#188038]') : (isDark ? 'text-[#f28b82]' : 'text-[#c5221f]')}>
                    {cc.result.is_cei_compliant ? 'Compliant' : 'Violation'}
                  </span>
                </div>
                {cc.result.recommendation && (
                  <div className={`mt-2 p-2 rounded ${isDark ? 'bg-[#1a3a5c]/20 text-[#8ab4f8]/80' : 'bg-[#e8f0fe] text-[#1a73e8]/80'}`}>
                    💡 {cc.result.recommendation}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══ FOOTER (FIX-08) ═══
function FooterSection({ isDark, navigate }) {
  const lang = useLang()
  const refs = [
    'Ghiyami Pour et al. (2025) — Systematic Literature Review of Smart Contract Reentrancy',
    'Azimi et al. (2025) — Systematic Review on Smart Contracts Security Design Patterns',
    'Feist et al. (2019) — Slither: A Static Analysis Framework for Smart Contracts',
    'He et al. (2023) — Formal Analysis of Reentrancy Vulnerabilities Based on CPN',
    'Chainalysis (2025) — Crypto Crime Report 2025',
  ]
  return (
    <footer className={`border-t ${isDark ? 'border-[#3c4043] bg-[#202124]' : 'border-[#e8eaed] bg-white'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <img src="/logo_cei.png" alt="CEI" className="h-7" />
              <span className={`text-xs font-semibold ${isDark ? 'text-[#e8eaed]' : 'text-[#3c4043]'}`}><Tx path="footer.bottom" /></span>
            </div>
            <p className={`text-[10px] leading-relaxed ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>
              <Tx path="footer.tagline" />
            </p>
          </div>
          <div>
            <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="footer.nav" /></h4>
            <div className="space-y-1.5">
              {['hero','problem','benefits','project','gas','analyzer'].map(id => {
                const navT = TR.nav[id === 'hero' ? 'home' : id === 'problem' ? 'problem' : id === 'benefits' ? 'benefits' : id === 'project' ? 'project' : id === 'gas' ? 'gas' : 'analyzer']
                return (
                <button key={id} onClick={() => navigate(id)}
                  className={`block text-[11px] transition-colors ${isDark ? 'text-[#9aa0a6] hover:text-[#8ab4f8]' : 'text-[#5f6368] hover:text-[#1a73e8]'}`}>
                  {navT?.[lang] || (id === 'hero' ? 'Home' : id.charAt(0).toUpperCase() + id.slice(1))}
                </button>
                )
              })}
            </div>
          </div>
          <div>
            <h4 className={`text-[10px] font-semibold uppercase tracking-wider mb-3 ${isDark ? 'text-[#9aa0a6]' : 'text-[#5f6368]'}`}><Tx path="footer.references" /></h4>
            <div className="space-y-1">
              {refs.map((r, i) => (
                <p key={i} className={`text-[9px] leading-relaxed ${isDark ? 'text-[#5f6368]' : 'text-[#80868b]'}`}>{r}</p>
              ))}
            </div>
          </div>
        </div>
        <div className={`border-t pt-4 text-center text-[10px] ${isDark ? 'border-[#3c4043] text-[#5f6368]' : 'border-[#e8eaed] text-[#80868b]'}`}>
          CEI Pattern Analyzer — Nurcahya Priantoro (G6401221049) · IPB University 2026
        </div>
      </div>
    </footer>
  )
}
