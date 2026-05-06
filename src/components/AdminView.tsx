import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, Timestamp, orderBy, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut, User } from 'firebase/auth';
import { KeyData, DeviceData, AdminSettings } from '../types';
import { generateRandomKey, cn } from '../lib/utils';
import { Trash2, Plus, RefreshCw, LogOut, Shield, ShieldOff, Users, Key as KeyIcon, Clock, Bell, Settings, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { format } from 'date-fns';

const ADMIN_EMAIL = 'struckjibon@gmail.com';

export default function AdminView() {
  const [user, setUser] = useState<User | null>(null);
  const [keys, setKeys] = useState<KeyData[]>([]);
  const [devices, setDevices] = useState<DeviceData[]>([]);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const [newKey, setNewKey] = useState('');
  const [duration, setDuration] = useState(24); // default 24 hours
  const [maxDevices, setMaxDevices] = useState(1);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (user && user.email === ADMIN_EMAIL) {
      // Ensure admin record exists for security rules
      setDoc(doc(db, 'admins', user.uid), {
        email: user.email,
        updatedAt: Timestamp.now()
      }, { merge: true });

      const qKeys = query(collection(db, 'keys'), orderBy('createdAt', 'desc'));
      const unsubKeys = onSnapshot(qKeys, (snap) => {
        setKeys(snap.docs.map(d => ({ ...d.data(), id: d.id } as KeyData)));
      });

      const qDevices = query(collection(db, 'devices'), orderBy('lastSeenAt', 'desc'));
      const unsubDevices = onSnapshot(qDevices, (snap) => {
        setDevices(snap.docs.map(d => (d.data() as DeviceData)));
      });

      const unsubSettings = onSnapshot(doc(db, 'config', 'settings'), (snap) => {
        if (snap.exists()) {
          const s = snap.data() as AdminSettings;
          setSettings(s);
          setNotice(s.globalNotice);
        } else {
          // Initialize default settings if doesn't exist
          const def: AdminSettings = {
            wingo30sEnabled: true,
            wingo1mEnabled: true,
            globalNotice: "Welcome to BDT JIBON POWER HACK!",
            totalWins: 0,
            totalLosses: 0,
            updatedAt: Timestamp.now()
          };
          setDoc(doc(db, 'config', 'settings'), def);
        }
      });

      return () => {
        unsubKeys();
        unsubDevices();
        unsubSettings();
      };
    }
  }, [user]);

  const handleUpdateSettings = async (updates: Partial<AdminSettings>) => {
    try {
      await updateDoc(doc(db, 'config', 'settings'), {
        ...updates,
        updatedAt: Timestamp.now()
      });
      console.log("Settings successfully updated", updates);
    } catch (err) {
      console.error("Settings update failed", err);
      // Fallback to setDoc if doc doesn't exist (e.g. initialization)
      try {
        await setDoc(doc(db, 'config', 'settings'), {
          ...updates,
          updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (err2) {
        console.error("Critical: Settings update failed twice", err2);
        alert("Action Failed: " + (err2 as Error).message);
      }
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => signOut(auth);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCreateKey = async () => {
    const keyToUse = newKey || generateRandomKey();
    const now = new Date();
    const expires = new Date(now.getTime() + duration * 60 * 60 * 1000);
    
    try {
      await setDoc(doc(db, 'keys', keyToUse), {
        key: keyToUse,
        durationHours: duration,
        createdAt: Timestamp.fromDate(now),
        expiresAt: Timestamp.fromDate(expires),
        isActive: true,
        maxDevices: maxDevices,
        usedDevices: []
      });
      setNewKey('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteKey = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'keys', id));
    } catch (err) {
      console.error(err);
    }
  };

  const toggleDeviceBlock = async (deviceId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'devices', deviceId), {
        isBlocked: !currentStatus
      });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-screen bg-[#050c26] text-cyan-400">Loading...</div>;

  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#050c26] p-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0d1733] p-8 rounded-2xl border border-cyan-500/30 text-center max-w-sm w-full"
        >
          <Shield className="w-16 h-16 text-cyan-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-gray-400 mb-6">Restricted access. Please sign in with authorized account.</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-cyan-900/20"
          >
            Sign in with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050c26] text-gray-200 p-4 pb-20 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#0d1733] p-4 rounded-xl border border-cyan-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-900/50 rounded-lg">
              <Shield className="text-cyan-400 w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-white uppercase tracking-wider text-sm">Dashboard Control</h2>
              <p className="text-xs text-cyan-500">Admin: {user.email}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-red-500/20 rounded-lg text-red-400 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-[#0d1733] p-4 rounded-xl border border-cyan-900 shadow-lg">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Total Keys</p>
            <p className="text-xl font-black text-cyan-400">{keys.length}</p>
          </div>
          <div className="bg-[#0d1733] p-4 rounded-xl border border-cyan-900 shadow-lg">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Devices</p>
            <p className="text-xl font-black text-white">{devices.length}</p>
          </div>
          <div className="bg-[#0d1733] p-4 rounded-xl border border-cyan-900 shadow-lg">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Global Wins</p>
            <p className="text-xl font-black text-green-500">{settings?.totalWins || 0}</p>
          </div>
          <div className="bg-[#0d1733] p-4 rounded-xl border border-cyan-900 shadow-lg">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Global Losses</p>
            <p className="text-xl font-black text-red-500">{settings?.totalLosses || 0}</p>
          </div>
          <div className="bg-[#0d1733] p-4 rounded-xl border border-cyan-900 shadow-lg flex flex-col justify-center">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Wingo 30s</p>
            <span className={cn("text-xs font-black", settings?.wingo30sEnabled ? "text-green-500" : "text-red-500")}>
              {settings?.wingo30sEnabled ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
          <div className="bg-[#0d1733] p-4 rounded-xl border border-cyan-900 shadow-lg flex flex-col justify-center">
            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">Wingo 1M</p>
            <span className={cn("text-xs font-black", settings?.wingo1mEnabled ? "text-green-500" : "text-red-500")}>
              {settings?.wingo1mEnabled ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Server & Global Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Server Controls */}
          <div className="bg-[#0d1733] p-6 rounded-xl border border-cyan-900 space-y-4">
            <h3 className="text-cyan-400 font-bold uppercase text-xs flex items-center gap-2">
              <Settings className="w-4 h-4" /> Server Controls
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">WinGo 30s Server</span>
                  <span className="text-[10px] text-gray-500">Toggle game visibility</span>
                </div>
                <button 
                  onClick={() => handleUpdateSettings({ wingo30sEnabled: !settings?.wingo30sEnabled })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings?.wingo30sEnabled ? "bg-cyan-600" : "bg-gray-700"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    settings?.wingo30sEnabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 bg-black/20 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-white">WinGo 1M Server</span>
                  <span className="text-[10px] text-gray-500">Enable/Disable 1 minute game</span>
                </div>
                <button 
                  onClick={() => handleUpdateSettings({ wingo1mEnabled: !settings?.wingo1mEnabled })}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    settings?.wingo1mEnabled ? "bg-cyan-600" : "bg-gray-700"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    settings?.wingo1mEnabled ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>
          </div>

          {/* Global Notice */}
          <div className="bg-[#0d1733] p-6 rounded-xl border border-cyan-900 space-y-4">
            <h3 className="text-cyan-400 font-bold uppercase text-xs flex items-center gap-2">
              <Bell className="w-4 h-4" /> Global Notice System
            </h3>
            <div className="space-y-3">
              <textarea 
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="Enter alert message for all users..."
                className="w-full h-24 bg-[#050c26] border border-cyan-900 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500 resize-none"
              />
              <button 
                onClick={() => handleUpdateSettings({ globalNotice: notice })}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg transition-all text-xs"
              >
                Update Notice
              </button>
            </div>
          </div>
        </div>

        {/* Create Key Section */}
        <div className="bg-[#0d1733] p-6 rounded-xl border border-cyan-900">
          <h3 className="text-cyan-400 font-bold uppercase text-xs mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Generate New Access Key
          </h3>
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase pl-1">Custom Password (Optional)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="Auto-generated if empty"
                    className="w-full bg-[#050c26] border border-cyan-900 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                  />
                  <button 
                    onClick={() => setNewKey(generateRandomKey())}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-cyan-500 hover:bg-cyan-500/10 rounded-md"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase pl-1">Duration (Hours)</label>
                <select 
                  value={duration} 
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-[#050c26] border border-cyan-900 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500 appearance-none"
                >
                  <option value={1}>1 Hour</option>
                  <option value={6}>6 Hours</option>
                  <option value={12}>12 Hours</option>
                  <option value={24}>24 Hours</option>
                  <option value={168}>7 Days</option>
                  <option value={720}>30 Days</option>
                  <option value={8760}>1 Year</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 uppercase pl-1">Max Devices</label>
                <input 
                  type="number" 
                  min="1"
                  max="100"
                  value={maxDevices}
                  onChange={(e) => setMaxDevices(Number(e.target.value))}
                  className="w-full bg-[#050c26] border border-cyan-900 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
            <button 
              onClick={handleCreateKey}
              className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition-all shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" /> Save and Deploy
            </button>
          </div>
        </div>

        {/* Keys List */}
        <div className="bg-[#0d1733] rounded-xl border border-cyan-900 overflow-hidden">
          <div className="p-4 bg-cyan-900/10 border-b border-cyan-900 flex justify-between items-center">
            <h3 className="text-cyan-400 font-bold uppercase text-xs">Active Access Keys</h3>
            <span className="text-[10px] text-gray-500">{keys.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-cyan-900/50 bg-[#0d1733]">
                  <th className="p-4 text-gray-400 font-medium">Key Code</th>
                  <th className="p-4 text-gray-400 font-medium">Created</th>
                  <th className="p-4 text-gray-400 font-medium">Expires</th>
                  <th className="p-4 text-gray-400 font-medium">Status</th>
                  <th className="p-4 text-gray-400 font-medium">Devices</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id} className="border-b border-cyan-900/30 hover:bg-cyan-900/5 transition-colors">
                    <td className="p-4 font-mono font-bold text-white">
                      <div className="flex items-center gap-2">
                        <span>{k.key}</span>
                        <button 
                          onClick={() => handleCopy(k.key)}
                          className={cn(
                            "p-1 rounded transition-all",
                            copiedKey === k.key ? "text-green-400 bg-green-500/10" : "text-cyan-500 hover:bg-cyan-500/10"
                          )}
                        >
                          {copiedKey === k.key ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-gray-400">{format(k.createdAt.toDate(), 'HH:mm dd/MM')}</td>
                    <td className="p-4 text-gray-400">{format(k.expiresAt.toDate(), 'HH:mm dd/MM')}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                        k.expiresAt.toDate() > new Date() ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {k.expiresAt.toDate() > new Date() ? 'Valid' : 'Expired'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-gray-300 font-bold">
                        {(k.usedDevices?.length || 0)} / {k.maxDevices}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDeleteKey(k.id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Devices List */}
        <div className="bg-[#0d1733] rounded-xl border border-cyan-900 overflow-hidden">
          <div className="p-4 bg-cyan-900/10 border-b border-cyan-900 flex justify-between items-center">
            <h3 className="text-cyan-400 font-bold uppercase text-xs">Device Management</h3>
            <span className="text-[10px] text-gray-500">{devices.length} items</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-cyan-900/50 bg-[#0d1733]">
                  <th className="p-4 text-gray-400 font-medium">Device ID</th>
                  <th className="p-4 text-gray-400 font-medium">Last Seen</th>
                  <th className="p-4 text-gray-400 font-medium">Access</th>
                  <th className="p-4 text-gray-400 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.deviceId} className="border-b border-cyan-900/30 hover:bg-cyan-900/5 transition-colors">
                    <td className="p-4 font-mono text-gray-300">{d.deviceId.slice(0, 12)}...</td>
                    <td className="p-4 text-gray-400">{format(d.lastSeenAt.toDate(), 'HH:mm dd/MM')}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                        !d.isBlocked ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                      )}>
                        {!d.isBlocked ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => toggleDeviceBlock(d.deviceId, d.isBlocked)}
                        className={cn(
                          "p-1.5 rounded transition-all",
                          d.isBlocked ? "text-green-400 hover:bg-green-500/20" : "text-orange-400 hover:bg-orange-500/20"
                        )}
                      >
                        {d.isBlocked ? <Shield className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
