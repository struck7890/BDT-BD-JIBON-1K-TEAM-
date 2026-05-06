import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { HistoryItem, PredictionResult, AdminSettings } from '../types';
import { cn, getDeviceId } from '../lib/utils';
import { Shield, TrendingUp, History, Clock, Target, Ghost, Zap, Activity, Bell, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const HISTORY_API_30S = '/api/history/30s';
const HISTORY_API_1M = '/api/history/1m';

type GameMode = '30S' | '1M';

export default function PredictorView({ onLogout }: { onLogout: () => void }) {
  const [mode, setMode] = useState<GameMode>('30S');
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  
  // State for 30S
  const [history30s, setHistory30s] = useState<HistoryItem[]>([]);
  const [predHistory30s, setPredHistory30s] = useState<PredictionResult[]>([]);
  const [nextPeriod30s, setNextPeriod30s] = useState<string>('Loading...');
  const [timeLeft30s, setTimeLeft30s] = useState<number>(30);
  const [currentPred30s, setCurrentPred30s] = useState<{ p: 'Big' | 'Small', reason: string, nums: number[] } | null>(null);
  const [stats30s, setStats30s] = useState({ win: 0, loss: 0, consecutiveLoss: 0 });

  // State for 1M
  const [history1m, setHistory1m] = useState<HistoryItem[]>([]);
  const [predHistory1m, setPredHistory1m] = useState<PredictionResult[]>([]);
  const [nextPeriod1m, setNextPeriod1m] = useState<string>('Loading...');
  const [timeLeft1m, setTimeLeft1m] = useState<number>(60);
  const [currentPred1m, setCurrentPred1m] = useState<{ p: 'Big' | 'Small', reason: string, nums: number[] } | null>(null);
  const [stats1m, setStats1m] = useState({ win: 0, loss: 0, consecutiveLoss: 0 });

  const [loading, setLoading] = useState(true);
  const lastRecordedRef = useRef<{ [key: string]: boolean }>({});

  const recordOutcome = async (period: string, isWin: boolean) => {
    if (lastRecordedRef.current[period]) return;
    lastRecordedRef.current[period] = true;

    try {
      await updateDoc(doc(db, 'config', 'settings'), {
        [isWin ? 'totalWins' : 'totalLosses']: increment(1),
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      // Regular user doesn't need to see this error
    }
  };

  // Sync Admin Settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as AdminSettings);
      }
    });
    return () => unsub();
  }, []);

  // Sync Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      // 30S Timer
      const seconds30 = now.getSeconds();
      setTimeLeft30s(30 - (seconds30 % 30));
      
      // 1M Timer (from user logic)
      const utcSeconds = now.getUTCSeconds();
      setTimeLeft1m(60 - utcSeconds);

      // Period calculation for 1M (from user logic)
      const utcYear = now.getUTCFullYear();
      const utcMonth = String(now.getUTCMonth() + 1).padStart(2, '0');
      const utcDay = String(now.getUTCDate()).padStart(2, '0');
      const utcHours = now.getUTCHours();
      const utcMinutes = now.getUTCMinutes();
      const dateStr = `${utcYear}${utcMonth}${utcDay}`;
      const totalMinutes = utcHours * 60 + utcMinutes;
      const periodId1m = dateStr + "1000" + (10001 + totalMinutes);
      setNextPeriod1m(periodId1m);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync device status
  useEffect(() => {
    const deviceId = getDeviceId();
    const unsub = onSnapshot(doc(db, 'devices', deviceId), (snap) => {
      if (snap.exists() && snap.data().isBlocked) {
        onLogout();
      }
    });
    return () => unsub();
  }, [onLogout]);

  const getBigSmall = (n: number): 'Big' | 'Small' => (n >= 5 ? 'Big' : 'Small');

  const getDecision = (hist: HistoryItem[], consecutiveLosses: number, gameMode: GameMode) => {
    if (hist.length < 10) return { p: 'Big' as 'Big' | 'Small', reason: "HIDAN_V5_STABLE_LINK...", nums: [5, 9] };
    
    const nums = hist.map(h => h.number);
    const sizes = hist.map(h => h.size);
    
    // 1. HIDAN_FLUX (Trend Volatility)
    let flux = 0;
    for (let i = 0; i < 10; i++) {
        if (sizes[i] !== sizes[i+1]) flux++;
    }

    // 2. VIBRATION_INTENSITY (Average Weight of last 7)
    const recentSum = nums.slice(0, 7).reduce((a, b) => a + b, 0);
    const avgWeight = recentSum / 7;

    // 3. DRAGON_DETECTOR (Streak tracking)
    let streakCount = 0;
    const currentStreakSize = sizes[0];
    for (const s of sizes) {
        if (s === currentStreakSize) streakCount++;
        else break;
    }

    // 4. PATTERN_RECOGNITION (Mirror & Sandwich)
    const isSandwich = sizes[0] === sizes[2] && sizes[0] !== sizes[1];
    const isMirror = nums[0] === (9 - nums[1]);

    let p: 'Big' | 'Small' = 'Big';
    let reason = "HIDAN_ULTRA_V5";

    // --- STRATEGY ENGINE V5 (RECOVERY & STABILITY) ---
    
    if (consecutiveLosses >= 4) {
        // ULTRA RECOVERY: Strict Dragon Rider (Stop fighting the trend)
        p = sizes[0];
        reason = `TITAN_SYNC_L${consecutiveLosses}`;
    } else if (consecutiveLosses >= 2) {
        // MID RECOVERY: Pattern Reversal check
        if (flux >= 4) {
            p = sizes[0]; // Choppy market, stick to last
            reason = "CHOP_STABILITY";
        } else {
            p = sizes[0] === 'Big' ? 'Small' : 'Big';
            reason = `DELTA_RECOVERY_L${consecutiveLosses}`;
        }
    } else if (streakCount >= 3) {
        // Dragon Handling (Started earlier at 3)
        if (streakCount >= 4) {
            p = currentStreakSize; // Follow the dragon
            reason = "DRAGON_VELOCITY";
        } else {
            p = currentStreakSize === 'Big' ? 'Small' : 'Big';
            reason = "STREAK_SHIELD_V5";
        }
    } else if (isSandwich) {
        p = sizes[1]; 
        reason = "SANDWICH_PRO_V5";
    } else if (flux >= 7) {
        // Extreme Volatility - Follow the Jump
        p = sizes[0] === 'Big' ? 'Small' : 'Big';
        reason = "VORTEX_HARMONIC";
    } else if (avgWeight > 5.8) {
        p = 'Small';
        reason = "GRAVITY_MAX";
    } else if (avgWeight < 3.2) {
        p = 'Big';
        reason = "ASCENSION_V5";
    } else if (isMirror) {
        p = nums[0] >= 5 ? 'Small' : 'Big';
        reason = "MIRROR_QUANTUM";
    } else {
        // Neural Weighted Selection
        const timeSeed = new Date().getMilliseconds();
        p = (timeSeed + nums[0] + flux) % 2 === 0 ? 'Big' : 'Small';
        reason = "NEURAL_CORE_V5";
    }

    // --- PRECISION NUMBER ENGINE V5 ---
    const seed = new Date().getMilliseconds();
    const bigSet = [5, 6, 8, 9];
    const smallSet = [0, 2, 3, 4];
    const targetSet = p === 'Big' ? bigSet : smallSet;
    
    const n1 = targetSet[seed % 4];
    let n2 = targetSet[(seed + 7) % 4];
    if (n1 === n2) n2 = targetSet[(seed + 3) % 4];

    return { p, reason, nums: [n1, n2] };
  };

  const digitImages = [
    "https://i.ibb.co/spSZ1m8f/0.png", "https://i.ibb.co/bgwPJd83/1.png",
    "https://i.ibb.co/HfJYQ3Sg/2.png", "https://i.ibb.co/pDCVyRS/3.png",
    "https://i.ibb.co/zhws3jTt/4.png", "https://i.ibb.co/rR4Y3Pt8/5.png",
    "https://i.ibb.co/jmq2Sb7/6.png", "https://i.ibb.co/HT1mWgqb/7.png",
    "https://i.ibb.co/8D6VF902/8.png", "https://i.ibb.co/4nxj5Fvf/9.png"
  ];

  const getConsecutiveLoss = (history: PredictionResult[]) => {
    let count = 0;
    const pastResults = history.filter(h => h.status !== 'Pending');
    for (const item of pastResults) {
      if (item.status === 'Loss') count++;
      else break;
    }
    return count;
  };

  const fetch30s = async () => {
    if (settings && !settings.wingo30sEnabled) return;
    try {
      const res = await fetch(`${HISTORY_API_30S}?t=${Date.now()}`);
      const json = await res.json();
      const results: HistoryItem[] = json.data.list.slice(0, 20).map((item: any) => ({
        period: item.issueNumber,
        number: parseInt(item.number),
        size: getBigSmall(parseInt(item.number))
      }));
      setHistory30s(results);
      const nextP = (BigInt(results[0].period) + 1n).toString();
      setNextPeriod30s(nextP);

      setPredHistory30s(prev => {
        const newPH = prev.map(item => {
          const m = results.find(r => r.period === item.period);
          if (m && item.status === 'Pending') {
            const isWin = item.pred === m.size;
            recordOutcome(item.period, isWin);
            return { ...item, actual: m.size, status: isWin ? 'Win' : 'Loss' };
          }
          return item;
        });

        if (!newPH.find(h => h.period === nextP)) {
          const d = getDecision(results, getConsecutiveLoss(newPH), '30S');
          setCurrentPred30s(d);
          newPH.unshift({ period: nextP, pred: d.p, actual: null, status: 'Pending' });
          if (newPH.length > 30) newPH.pop();
        }
        return [...newPH];
      });
    } catch (e) { console.error(e); }
  };

  const fetch1m = async () => {
    if (settings && !settings.wingo1mEnabled) return;
    try {
      const res = await fetch(`${HISTORY_API_1M}?t=${Date.now()}`);
      const json = await res.json();
      const results: HistoryItem[] = json.data.list.slice(0, 20).map((item: any) => ({
        period: item.issueNumber,
        number: parseInt(item.number),
        size: getBigSmall(parseInt(item.number))
      }));
      setHistory1m(results);

      setPredHistory1m(prev => {
        const newPH = prev.map(item => {
          const m = results.find(r => r.period === item.period);
          if (m && item.status === 'Pending') {
            const isWin = item.pred === m.size;
            recordOutcome(item.period, isWin);
            return { ...item, actual: m.size, status: isWin ? 'Win' : 'Loss' };
          }
          return item;
        });

        if (nextPeriod1m !== 'Loading...' && !newPH.find(h => h.period === nextPeriod1m)) {
          const d = getDecision(results, getConsecutiveLoss(newPH), '1M');
          setCurrentPred1m(d);
          newPH.unshift({ period: nextPeriod1m, pred: d.p, actual: null, status: 'Pending' });
          if (newPH.length > 30) newPH.pop();
        }
        return [...newPH];
      });
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetch30s(); fetch1m();
    const t = setInterval(() => { fetch30s(); fetch1m(); }, 3000);
    return () => clearInterval(t);
  }, [nextPeriod1m, settings?.wingo30sEnabled, settings?.wingo1mEnabled]);

  const activePredHistory = mode === '30S' ? predHistory30s : predHistory1m;
  const activeStats = activePredHistory.reduce((acc, item) => {
    if (item.status === 'Win') acc.win++;
    if (item.status === 'Loss') acc.loss++;
    return acc;
  }, { win: 0, loss: 0 });

  const activeNextPeriod = mode === '30S' ? nextPeriod30s : nextPeriod1m;
  const activeTimeLeft = mode === '30S' ? timeLeft30s : timeLeft1m;
  const activePrediction = mode === '30S' ? currentPred30s : currentPred1m;
  const activeHistory = mode === '30S' ? history30s : history1m;
  const isEnabled = mode === '30S' ? settings?.wingo30sEnabled : settings?.wingo1mEnabled;

  const totalFinished = activeStats.win + activeStats.loss;
  const totalSignals = activePredHistory.length;
  const wr = totalFinished > 0 ? ((activeStats.win / totalFinished) * 100).toFixed(0) : '0';

  useEffect(() => {
    if (settings) setLoading(false);
  }, [settings]);

  return (
    <div className="min-h-screen bg-[#050c26] text-gray-200 p-4 font-sans select-none pb-20">
      <div className="max-w-md mx-auto space-y-4">
        
        {/* Ad-Notice Header */}
        <AnimatePresence>
          {settings?.globalNotice && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="bg-yellow-500/10 border border-yellow-500/30 p-3 rounded-xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />
              <Bell className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-[10px] font-black text-yellow-500 uppercase tracking-widest">Notice from Admin</span>
                <p className="text-xs text-yellow-100/80 leading-relaxed font-bold">{settings.globalNotice}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Mode Switcher */}
        <div className="flex bg-[#0d1733] p-1.5 rounded-2xl border border-cyan-900 overflow-hidden">
          <button 
            onClick={() => setMode('30S')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              mode === '30S' ? "bg-cyan-600 text-white shadow-lg" : "text-gray-500 hover:text-cyan-400"
            )}
          >
            <Clock className="w-4 h-4" /> WINGO 30S
          </button>
          <button 
            onClick={() => setMode('1M')}
            className={cn(
              "flex-1 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
              mode === '1M' ? "bg-cyan-600 text-white shadow-lg" : "text-gray-500 hover:text-cyan-400"
            )}
          >
            <Target className="w-4 h-4" /> WINGO 1M
          </button>
        </div>

        {!isEnabled ? (
          <div className="bg-[#0d1733] p-10 rounded-2xl border-2 border-red-500/30 text-center space-y-4">
             <AlertTriangle className="w-16 h-16 text-red-500 mx-auto animate-pulse" />
             <h2 className="text-xl font-black text-white uppercase tracking-wider">Server Offline</h2>
             <p className="text-sm text-gray-400">This game server is currently closed by Admin. Please try another mode.</p>
          </div>
        ) : (
          <>
            {/* Target Header */}
            <div className="bg-[#09112a] p-4 rounded-xl border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.2)] overflow-hidden relative group">
              <div className="absolute top-0 right-0 p-2">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                  <span className="text-[8px] font-black text-red-500 uppercase tracking-tighter">Live Tracker</span>
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-500 animate-pulse" />
                  <span className="text-[10px] font-black text-cyan-500 uppercase tracking-[0.2em] drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">BDT JIBON POWER HACK</span>
                </div>
              </div>
              <div className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-orange-500 to-yellow-600 tracking-tighter drop-shadow-sm select-all">
                {activeNextPeriod}
              </div>
              {activeHistory.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="px-2 py-0.5 bg-green-500/10 rounded border border-green-500/20 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-green-500" />
                    <span className="text-[8px] text-green-400 font-bold uppercase tracking-widest">System Online</span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono">Trace: <span className="text-gray-300 font-black">{activeHistory[0].size}</span></span>
                </div>
              )}
            </div>

            {/* Prediction Display */}
            <motion.div 
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-[#0d1733] p-6 rounded-2xl border-2 border-cyan-500/50 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.05),transparent)] pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500/50 to-transparent animate-shimmer" />
              
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400 animate-bounce" />
                <span className="text-[11px] font-black text-cyan-400 uppercase tracking-[0.3em] drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]">NEXT SIGNAL ENGINE</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div 
                  key={activePrediction?.p + mode}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.1, opacity: 0 }}
                  className="flex items-center justify-between relative z-10"
                >
                  <div className={cn(
                    "text-6xl font-black italic tracking-tighter leading-none drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]",
                    activePrediction?.p === 'Big' ? "text-yellow-400" : "text-cyan-400"
                  )}>
                    {activePrediction?.p || 'BOOTING...'}
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-[8px] font-black text-red-500 uppercase tracking-tighter bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 animate-pulse">
                       HACK POWER ACTIVE
                    </div>
                    <div className="flex gap-2">
                      {activePrediction?.nums?.map((num: number, idx: number) => (
                        <motion.div 
                          key={idx}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          className="w-12 h-12 bg-black/80 rounded-xl border-2 border-cyan-500/30 flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(6,182,212,0.1)] transition-all hover:border-cyan-400"
                        >
                          <img src={digitImages[num]} alt={`${num}`} className="w-full h-full object-contain brightness-125" referrerPolicy="no-referrer" />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-6 relative z-10">
                <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-cyan-900/50 shadow-inner">
                   <motion.div 
                     animate={{ x: ['-100%', '100%'] }} 
                     transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                     className="h-full w-1/2 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_rgba(34,211,238,1)]"
                   />
                </div>
                <div className="flex justify-between items-center mt-3">
                  <span className="text-[10px] font-black text-cyan-400/90 uppercase tracking-widest flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-cyan-400" />
                    {activePrediction?.reason || 'Accessing Neural Link...'}
                  </span>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black text-red-500 drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]">{activeTimeLeft}s</span>
                     <span className="text-[8px] font-mono text-cyan-500/40 font-black">v27_OMEGA_RECOVERY</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stats Boxes */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#0d1733] p-3 rounded-xl border border-cyan-500/10 flex flex-col items-center">
                 <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">SIGNAL COUNT</span>
                 <div className="text-xl font-black text-cyan-400">{totalSignals}</div>
              </div>
              <div className="bg-[#0d1733] p-3 rounded-xl border border-cyan-500/10 flex flex-col items-center">
                 <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">WIN COUNT</span>
                 <div className="text-xl font-black text-green-500">{activeStats.win}</div>
              </div>
              <div className="bg-[#0d1733] p-3 rounded-xl border border-cyan-500/10 flex flex-col items-center">
                 <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">LOSS COUNT</span>
                 <div className="text-xl font-black text-red-500">{activeStats.loss}</div>
              </div>
            </div>

            {/* Win Rate & Shield */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d1733] p-3 rounded-xl border border-cyan-900/50 flex flex-col items-center justify-center">
                 <span className="text-[10px] text-gray-500 uppercase mb-1">Win Probability</span>
                 <div className="text-2xl font-black text-white">{wr}%</div>
                 <div className="text-[8px] text-gray-500 font-bold uppercase mt-1">Based on {totalFinished} signals</div>
              </div>
              <div className="bg-[#0d1733] p-3 rounded-xl border border-cyan-900/50 flex flex-col items-center justify-center">
                 <div className="flex items-center gap-2 text-green-400 font-bold text-[10px]">
                    <Shield className="w-3 h-3" /> SHIELD: ACTIVE
                 </div>
                 <div className="text-[8px] text-gray-500 mt-1 uppercase">Omega Protection</div>
              </div>
            </div>

            {/* History Table */}
            <div className="bg-[#0d1733] rounded-2xl border border-cyan-900/50 overflow-hidden shadow-xl">
              <div className="p-4 bg-cyan-900/10 border-b border-cyan-900/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-500" />
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Recent {mode} Trends</h3>
                </div>
              </div>
              <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-center text-[11px]">
                  <thead className="sticky top-0 bg-[#0d1733] shadow-sm z-10">
                    <tr className="text-gray-500 font-bold uppercase tracking-tighter">
                      <th className="py-4 px-2 border-b border-cyan-900/20">ID</th>
                      <th className="py-4 px-2 border-b border-cyan-900/20">Signal</th>
                      <th className="py-4 px-2 border-b border-cyan-900/20">Data</th>
                      <th className="py-4 px-2 border-b border-cyan-900/20">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePredHistory.map((item, idx) => (
                      <motion.tr 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={item.period} 
                        className="group hover:bg-cyan-400/5 transition-colors border-b border-cyan-900/10"
                      >
                        <td className="py-4 px-2 text-gray-400 font-mono font-bold italic">{item.period.slice(-4)}</td>
                        <td className={cn(
                          "py-4 px-2 font-black",
                          item.pred === 'Big' ? "text-yellow-500" : "text-green-500"
                        )}>
                          {item.pred}
                        </td>
                        <td className="py-4 px-2 font-bold text-gray-300">
                          {item.actual || '...'}
                        </td>
                        <td className="py-4 px-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            item.status === 'Win' && "bg-green-500/10 text-green-400",
                            item.status === 'Loss' && "bg-red-500/10 text-red-500",
                            item.status === 'Pending' && "bg-blue-500/10 text-blue-400 animate-pulse"
                          )}>
                            {item.status}
                          </span>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

