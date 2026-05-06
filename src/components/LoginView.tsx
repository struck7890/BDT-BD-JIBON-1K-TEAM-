import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { getDeviceId, cn } from '../lib/utils';
import { Key as KeyIcon, Smartphone, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export default function LoginView({ onLogin }: { onLogin: () => void }) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key) return;

    setLoading(true);
    setError('');

    try {
      const deviceId = getDeviceId();
      const deviceDoc = await getDoc(doc(db, 'devices', deviceId));
      
      if (deviceDoc.exists() && deviceDoc.data().isBlocked) {
        setError('THIS DEVICE IS TEMPORARILY BLOCKED BY SYSTEM.');
        setLoading(false);
        return;
      }

      const keyDoc = await getDoc(doc(db, 'keys', key));
      
      if (!keyDoc.exists()) {
        setError('INVALID ACCESS KEY. PLEASE CONTACT ADMIN.');
      } else {
        const data = keyDoc.data();
        const now = new Date();
        const expires = data.expiresAt.toDate();

        if (now > expires) {
          setError('THIS ACCESS KEY HAS EXPIRED.');
        } else if (!data.isActive) {
          setError('THIS KEY HAS BEEN DISABLED.');
        } else {
          // Device limit check
          const usedDevices = data.usedDevices || [];
          const isReturningDevice = usedDevices.includes(deviceId);
          
          if (!isReturningDevice && usedDevices.length >= (data.maxDevices || 1)) {
            setError('MAX DEVICE LIMIT REACHED FOR THIS KEY.');
            setLoading(false);
            return;
          }

          // Valid key and within device limit!
          // Register device if not exists, or update lastSeen
          const deviceRef = doc(db, 'devices', deviceId);
          if (!deviceDoc.exists()) {
            await setDoc(deviceRef, {
              deviceId,
              isBlocked: false,
              lastSeenAt: Timestamp.now()
            });
          } else {
            await updateDoc(deviceRef, {
              lastSeenAt: Timestamp.now()
            });
          }
          
          // If new device, add to key's usedDevices
          if (!isReturningDevice) {
            await updateDoc(doc(db, 'keys', key), {
              usedDevices: [...usedDevices, deviceId]
            });
          }
          
          // Save key to local storage for persistent session
          localStorage.setItem('active_bdt_key', key);
          onLogin();
        }
      }
    } catch (err) {
      console.error(err);
      setError('CONNECTION ERROR. TRY AGAIN.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050c26] flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm space-y-8"
      >
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-cyan-900/30 border border-cyan-500/30 mb-4 shadow-[0_0_20px_rgba(34,211,238,0.1)]">
             <Smartphone className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-widest uppercase">BDT PRO <span className="text-cyan-400">V2.1</span></h1>
          <p className="text-gray-500 text-xs mt-1 uppercase tracking-widest font-bold">Encrypted Access Required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-widest ml-1">Access Key</label>
            <div className="relative">
              <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="text" 
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="ENTER PASSWORD..."
                className="w-full bg-[#0d1733] border border-cyan-900 rounded-xl px-10 py-4 text-white font-mono placeholder:text-gray-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 transition-all"
              />
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }} 
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 text-red-500 p-3 bg-red-500/5 rounded-lg border border-red-500/20"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-[10px] font-bold uppercase">{error}</span>
            </motion.div>
          )}

          <button 
            type="submit"
            disabled={loading}
            className={cn(
              "w-full py-4 rounded-xl font-black uppercase tracking-widest text-sm transition-all flex items-center justify-center gap-3",
              loading 
                ? "bg-gray-800 text-gray-500 cursor-not-allowed" 
                : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-xl shadow-cyan-900/20"
            )}
          >
            {loading ? 'Authenticating...' : (
              <>
                <ShieldCheck className="w-5 h-5" />
                Establish Link
              </>
            )}
          </button>
        </form>

        <div className="pt-8 text-center space-y-4">
           <p className="text-[8px] text-gray-800 uppercase tracking-widest">
             © 2026 BDT PRO SYSTEMS • V2.3.0_OMEGA
           </p>
        </div>
      </motion.div>
    </div>
  );
}
