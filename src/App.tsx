import React, { useState, useEffect } from 'react';
import POSMode from './components/POSMode';
import ManagerMode from './components/ManagerMode';
import ConfirmationModal from './components/ConfirmationModal';
import { getStoreSettings, saveStoreSettings, getCashiers, saveProducts, saveCashiers, saveOperationalCosts, saveCashierDiscrepancies, saveRestockRecord, getStaff, saveStaff } from './storage';
import { StoreSettings, Cashier, Staff, StaffRole } from './types';
import { Store, User, ShieldCheck, ArrowRight, Lock, Package, ShoppingCart, UserCircle } from 'lucide-react';
import { startAutoSync, syncDataToCloud } from './services/syncService';

type AppState = 'welcome' | 'setup' | 'admin-login' | 'kasir-login' | 'admin' | 'pos' | 'api-login';

export default function App() {
  const handleImportData = async (
  event: React.ChangeEvent<HTMLInputElement>
) => {
  const file = event.target.files?.[0];

  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    Object.keys(data).forEach((key) => {
      localStorage.setItem(key, data[key]);
    });

    alert("Data berhasil diimport");
    window.location.reload();
  } catch (error) {
    alert("File backup tidak valid");
  }
};
  const [appState, setAppState] = useState<AppState>('welcome');
  const [settings, setSettings] = useState<StoreSettings>(getStoreSettings());
  const [staff, setStaff] = useState<Staff[]>([]);
  
  // Login states
  const [adminPin, setAdminPin] = useState('');
  const [kasirUsername, setKasirUsername] = useState('');
  const [kasirPin, setKasirPin] = useState('');
  const [activeCashierName, setActiveCashierName] = useState('');

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info' | 'success';
    isAlert?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger',
    isAlert: false
  });

  // Setup states
  const [setupData, setSetupData] = useState<StoreSettings>({
    isSetupComplete: false,
    ownerName: '',
    name: '',
    address: '',
    phone: '',
    adminPassword: '',
    syncEnabled: false,
    apiType: 'supabase',
    apiUrl: '',
    apiKey: ''
  });

  useEffect(() => {
    const settings = getStoreSettings();
    setSettings(settings);
    setStaff(getStaff());
    
    if (settings.isSetupComplete) {
      const interval = startAutoSync(settings);
      return () => {
        if (interval) clearInterval(interval);
      };
    }
  }, [appState]);

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create first admin staff
    const firstAdmin: Staff = {
      id: Date.now().toString(),
      name: setupData.ownerName,
      pin: setupData.adminPassword || '',
      roles: ['admin', 'kasir', 'driver', 'pj']
    };
    
    const newSettings: StoreSettings = {
      ...setupData,
      isSetupComplete: true,
      staffList: [firstAdmin]
    };
    
    saveStoreSettings(newSettings);
    saveStaff([firstAdmin]);
    setSettings(newSettings);
    setStaff([firstAdmin]);
    setAppState('welcome');
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminPin === settings.adminPassword) {
      setAppState('admin');
      setAdminPin('');
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Login Gagal',
        message: 'Password Admin Salah!',
        variant: 'danger',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleResetApp = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Reset Aplikasi',
      message: 'PERINGATAN: Ini akan menghapus SEMUA data (Produk, Transaksi, Pengaturan). Apakah Anda yakin ingin mereset aplikasi karena lupa sandi?',
      variant: 'danger',
      onConfirm: () => {
        localStorage.clear();
        window.location.reload();
      }
    });
  };

  const handleKasirLogin = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedStaff = staff.find(s => s.name.toLowerCase() === kasirUsername.toLowerCase() && s.roles.includes('kasir'));

    if (!selectedStaff) {
      setConfirmModal({
        isOpen: true,
        title: 'Login Gagal',
        message: 'Nama kasir tidak ditemukan atau tidak memiliki akses kasir!',
        variant: 'danger',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    // Check if it's the admin password (Master Key) or staff PIN
    if (kasirPin.trim() === settings.adminPassword?.trim() || kasirPin === selectedStaff.pin) {
      setActiveCashierName(selectedStaff.name);
      setAppState('pos');
      setKasirPin('');
      setKasirUsername('');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Login Gagal',
      message: 'PIN Kasir Salah!',
      variant: 'danger',
      isAlert: true,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled rejection (promise: ', event.promise, ', reason: ', event.reason, ').');
    };
    const handleError = (event: ErrorEvent) => {
      console.error('Uncaught error: ', event.error);
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  const Footer = () => (
    <div className="mt-8 text-center">
      <div className="text-[10px] text-gray-400">
        v1.5 develop by aryadpta<br/>
        <a 
          href="https://wa.me/62895405373577" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:text-blue-500 underline"
        >
          info lebih lanjut hubungi tim pengembang
        </a>
      </div>
    </div>
  );

  if (appState === 'welcome') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Store size={40} />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {settings.isSetupComplete ? settings.name : 'KASIR PINTAR'}
          </h1>
          <p className="text-gray-500 mb-8">Pilih mode masuk aplikasi</p>

          <div className="space-y-4">
            {!settings.isSetupComplete ? (
              <>
                <button 
                  onClick={() => setAppState('setup')}
                  className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-between transition-colors shadow-lg shadow-blue-200"
                >
                  <div className="flex items-center gap-3"><ShieldCheck size={24} /> Daftar Toko Baru</div>
                  <ArrowRight size={20} />
                </button>

                {/* Import Data */}
<label className="w-full py-4 px-6 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold flex items-center justify-between transition-colors border border-amber-100 cursor-pointer">
  <div className="flex items-center gap-3">
    <Package size={24} />
    Import Data
  </div>

  <ArrowRight size={20} />

  <input
    type="file"
    accept=".json"
    className="hidden"
    onChange={handleImportData}
  />
</label>

                <button 
                  onClick={() => setAppState('api-login')}
                  className="w-full py-4 px-6 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold flex items-center justify-between transition-colors border border-emerald-100"
                >
                  
                  <div className="flex items-center gap-3"><Package size={24} /> Masuk via API</div>
                  <ArrowRight size={20} />
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setAppState('kasir-login')}
                  className="w-full py-4 px-6 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold flex items-center justify-between transition-colors shadow-lg shadow-green-200"
                >
                  <div className="flex items-center gap-3"><User size={24} /> Masuk Kasir</div>
                  <ArrowRight size={20} />
                </button>
                <button 
                  onClick={() => setAppState('admin-login')}
                  className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-between transition-colors shadow-lg shadow-blue-200"
                >
                  <div className="flex items-center gap-3"><ShieldCheck size={24} /> Masuk Admin</div>
                  <ArrowRight size={20} />
                </button>
              </>
            )}
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  if (appState === 'api-login') {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package size={40} />
          </div>
          <h2 className="text-2xl font-bold text-emerald-800 mb-2">Masuk via API</h2>
          <p className="text-sm text-gray-500 mb-6">Hubungkan dengan database cloud Anda</p>
          
          <form onSubmit={async (e) => {
            e.preventDefault();
            const settings = { ...setupData, isSetupComplete: true, syncEnabled: true };
            saveStoreSettings(settings);
            await syncDataToCloud(settings);
            setConfirmModal({
              isOpen: true,
              title: 'Berhasil',
              message: 'Data berhasil disinkronkan dari cloud!',
              variant: 'success',
              isAlert: true,
              onConfirm: () => window.location.reload()
            });
          }} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipe API</label>
              <select 
                value={setupData.apiType || 'supabase'} 
                onChange={e => setSetupData({...setupData, apiType: e.target.value as any})}
                className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="supabase">Supabase</option>
                <option value="google-sheets">Google Sheets (Apps Script)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
              <input type="url" required value={setupData.apiUrl || ''} onChange={e => setSetupData({...setupData, apiUrl: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500" placeholder="https://..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Token</label>
              <input type="password" required value={setupData.apiKey || ''} onChange={e => setSetupData({...setupData, apiKey: e.target.value})} className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-95">Hubungkan & Sinkronkan</button>
            <button type="button" onClick={() => setAppState('welcome')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl">Kembali</button>
          </form>
          <Footer />
        </div>
      </div>
    );
  }

  if (appState === 'setup') {
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg border-t-4 border-blue-600">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Pendaftaran Toko</h2>
          <form onSubmit={handleSetupSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik</label>
              <input type="text" required value={setupData.ownerName} onChange={e => setSetupData({...setupData, ownerName: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
              <input type="text" required value={setupData.name} onChange={e => setSetupData({...setupData, name: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Toko</label>
              <textarea required value={setupData.address} onChange={e => setSetupData({...setupData, address: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon</label>
              <input type="text" required value={setupData.phone} onChange={e => setSetupData({...setupData, phone: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Admin (Angka Saja)</label>
              <input 
                type="password" 
                inputMode="numeric"
                pattern="[0-9]*"
                required 
                value={setupData.adminPassword || ''} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setSetupData({...setupData, adminPassword: val});
                }} 
                className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-4">Daftar & Simpan</button>
            <button type="button" onClick={() => setAppState('welcome')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl">Kembali</button>
          </form>
        </div>
        <Footer />
      </div>
    );
  }

  if (appState === 'admin-login') {
    return (
      <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-blue-600">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full text-blue-600">
              <ShieldCheck size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-blue-800 mb-6">Login Admin</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password Admin</label>
              <input 
                type="password" 
                inputMode="numeric"
                pattern="[0-9]*"
                required
                value={adminPin} 
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setAdminPin(val);
                }} 
                className="w-full px-4 py-3 rounded-xl border text-center text-2xl tracking-widest focus:ring-2 focus:ring-blue-500" 
              />
            </div>
            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl">Masuk</button>
            <button type="button" onClick={() => setAppState('welcome')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl">Kembali</button>
            <button type="button" onClick={handleResetApp} className="w-full text-red-500 hover:text-red-700 text-sm font-medium py-2 mt-4 underline">Lupa Sandi? Reset Data Aplikasi</button>
          </form>
        </div>
        <Footer />
      </div>
    );
  }

  if (appState === 'kasir-login') {
    const cashiers = staff.filter(s => s.roles.includes('kasir'));
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-green-500">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 p-3 rounded-full text-green-600">
              <UserCircle size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-green-800 mb-6">Login Kasir</h2>
          {cashiers.length === 0 ? (
            <div className="text-center text-gray-500 mb-6">
              Belum ada akun kasir. Silakan minta Admin untuk membuat akun kasir terlebih dahulu.
              <button onClick={() => setAppState('welcome')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl mt-4">Kembali</button>
            </div>
          ) : (
            <form onSubmit={handleKasirLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username / Nama Kasir</label>
                <input 
                  type="text"
                  required 
                  list="kasir-list"
                  value={kasirUsername} 
                  onChange={e => setKasirUsername(e.target.value)} 
                  placeholder="Masukkan nama Anda"
                  className="w-full px-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 bg-white"
                />
                <datalist id="kasir-list">
                  {cashiers.map(c => <option key={c.id} value={c.name} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN / Token Kasir</label>
                <input 
                  type="password" 
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required 
                  value={kasirPin} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setKasirPin(val);
                  }} 
                  className="w-full px-4 py-3 rounded-xl border text-center text-2xl tracking-widest focus:ring-2 focus:ring-green-500" 
                />
              </div>
              <button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-xl">Masuk</button>
              <button type="button" onClick={() => setAppState('welcome')} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-xl">Kembali</button>
            </form>
          )}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <>
      {appState === 'pos' && <POSMode cashierName={activeCashierName} onLogout={() => setAppState('welcome')} />}
      {appState === 'admin' && <ManagerMode onLogout={() => setAppState('welcome')} />}
      
      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        isAlert={confirmModal.isAlert}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}
