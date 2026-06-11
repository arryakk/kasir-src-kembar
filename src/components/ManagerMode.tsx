import React, { useState, useEffect, useRef } from 'react';
import { Product, Driver, StoreSettings, Cashier, Transaction, OperationalCost, CashierDiscrepancy, RestockRecord, Staff, StaffRole } from '../types';
import { getProducts, saveProducts, getDrivers, getStoreSettings, saveStoreSettings, getCashiers, saveCashiers, getTransactions, updateTransactionStatus, cancelTransaction, getOperationalCosts, saveOperationalCosts, getCashierDiscrepancies, saveCashierDiscrepancies, clearAllData, getRestockRecords, saveRestockRecord, clearTransactions, processReturn, getStaff, saveStaff } from '../storage';
import { formatCurrency, exportToCSV, resizeImage } from '../utils';
import { Trash2, Save, X, LogOut, Package, Users, Settings as SettingsIcon, Image as ImageIcon, UserCircle, History, Download, CheckCircle, BarChart3, ChevronDown, ChevronUp, DollarSign, FileText, AlertCircle, RefreshCw, PlusCircle, AlertTriangle, Cloud, Search, Edit2, Plus, Minus, Filter, Calendar, ChevronLeft, ChevronRight, ShieldCheck, Menu } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { syncDataToCloud } from '../services/syncService';

interface ManagerModeProps {
  onLogout: () => void;
}

const StatusBadge = ({ status }: { status: string }) => {
  if (status === 'completed') return <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Lunas</span>;
  if (status === 'pending') return <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">Pending</span>;
  return <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-800">Batal</span>;
};

const TransactionDetail = ({ tx }: { tx: Transaction }) => {
  const promoProduk = tx.items.reduce((sum, item) => sum + ((item.price - item.finalPrice) * item.quantity), 0);
  const totalPromo = promoProduk + (tx.cartDiscount || 0);

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-3">
      <div className="flex justify-between items-center pb-2 border-b border-gray-50">
        <h4 className="font-bold text-gray-700">Detail Produk</h4>
        <span className="text-[10px] text-gray-400">ID: {tx.id}</span>
      </div>
      <ul className="space-y-2">
        {tx.items.map((item, idx) => {
          const returned = tx.returnedItems?.find(ri => ri.itemId === item.id);
          return (
            <li key={idx} className="flex justify-between text-sm">
              <div className="flex flex-col">
                <span className="font-medium text-gray-800">{item.quantity}x {item.name}</span>
                {returned && (
                  <span className="text-[10px] text-red-500 font-bold italic">Diretur: {returned.quantity} item</span>
                )}
              </div>
              <span className="font-bold text-gray-700">{formatCurrency(item.finalPrice * item.quantity)}</span>
            </li>
          );
        })}
      </ul>
      
      <div className="pt-3 border-t border-gray-50 space-y-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span>Subtotal:</span>
          <span>{formatCurrency(tx.subtotal)}</span>
        </div>
        {totalPromo > 0 && (
          <div className="flex justify-between text-xs text-orange-500">
            <span>Total Promo/Diskon:</span>
            <span>-{formatCurrency(totalPromo)}</span>
          </div>
        )}
        {tx.deliveryFee && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>Ongkos Kirim:</span>
            <span>{formatCurrency(tx.deliveryFee)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm font-bold text-blue-600 pt-1">
          <span>Total Akhir:</span>
          <span>{formatCurrency(tx.total)}</span>
        </div>
      </div>

      {(tx.customerName || tx.delivery) && (
        <div className="pt-3 border-t border-gray-50 text-xs text-gray-600 space-y-1">
          {tx.customerName && <div><strong>Pelanggan:</strong> {tx.customerName}</div>}
          {tx.delivery && (
            <>
              <div><strong>Driver:</strong> {tx.delivery.driverName}</div>
              <div><strong>Alamat:</strong> {tx.delivery.address}</div>
            </>
          )}
        </div>
      )}

      {tx.qrisProof && (
        <div className="pt-3 border-t border-gray-50">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Bukti Pembayaran QRIS</p>
          <div className="relative group cursor-pointer overflow-hidden rounded-xl border border-gray-100">
            <img 
              src={tx.qrisProof} 
              alt="Bukti QRIS" 
              className="w-full h-auto max-h-64 object-contain bg-gray-50 transition-transform duration-300 group-hover:scale-105"
              referrerPolicy="no-referrer"
              onClick={() => window.open(tx.qrisProof, '_blank')}
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-white text-xs font-bold bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">Klik untuk Perbesar</span>
            </div>
          </div>
        </div>
      )}

      {tx.returnedItems && tx.returnedItems.length > 0 && (
        <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
          <p className="text-[10px] font-bold text-red-800 mb-1">Informasi Retur:</p>
          <div className="flex justify-between text-[10px] text-red-600">
            <span>Total Refund (90%):</span>
            <span className="font-bold">{formatCurrency(tx.returnedItems.reduce((sum, ri) => sum + ri.refundAmount, 0))}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function ManagerMode({ onLogout }: ManagerModeProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'products' | 'staff' | 'history' | 'analytics' | 'financials' | 'operational' | 'discrepancies' | 'restock' | 'settings'>('products');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ 
    isSetupComplete: true, 
    ownerName: '', 
    name: '', 
    address: '', 
    phone: '', 
    initialInvestment: 0,
    showCostPrice: false,
    showSellingOptions: false,
    syncEnabled: false,
    apiType: 'supabase',
    apiUrl: '',
    apiKey: ''
  });
  const [operationalCosts, setOperationalCosts] = useState<OperationalCost[]>([]);
  const [discrepancies, setDiscrepancies] = useState<CashierDiscrepancy[]>([]);
  const [restockRecords, setRestockRecords] = useState<RestockRecord[]>([]);

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

  // Restock Form
  const [restockProductId, setRestockProductId] = useState('');
  const [restockTotalCost, setRestockTotalCost] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('');
  const [restockTotalWeight, setRestockTotalWeight] = useState('');
  const [restockNumItems, setRestockNumItems] = useState('');
  const [restockSellingPrice, setRestockSellingPrice] = useState('');
  const [restockNumSacks, setRestockNumSacks] = useState('');
  const [restockWeightPerSack, setRestockWeightPerSack] = useState('');
  const [restockPricePerSack, setRestockPricePerSack] = useState('');

  // Product Form
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCostPrice, setProdCostPrice] = useState('');
  const [prodTotalCost, setProdTotalCost] = useState('');
  const [prodTotalWeight, setProdTotalWeight] = useState('');
  const [prodNumItems, setProdNumItems] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodUnit, setProdUnit] = useState<'pcs' | 'box' | 'kg' | 'karung' | 'porsi' | 'jam' | 'hari'>('pcs');
  const [prodType, setProdType] = useState<'barang' | 'jasa' | 'makanan'>('barang');
  const [isRental, setIsRental] = useState(false);
  const [rentalPeriodUnit, setRentalPeriodUnit] = useState<'hour' | 'day'>('day');
  const [rentalRequirePhone, setRentalRequirePhone] = useState(false);
  const [sellInGram, setSellInGram] = useState(false);
  const [prodImage, setProdImage] = useState('');
  const [prodDiscountPercent, setProdDiscountPercent] = useState('');
  const [prodDiscountValidUntil, setProdDiscountValidUntil] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Operational Cost Form
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [costDate, setCostDate] = useState(new Date().toISOString().split('T')[0]);
  const [costDesc, setCostDesc] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costPICType, setCostPICType] = useState<'karyawan' | 'driver' | 'pemilik'>('karyawan');
  const [costPIC, setCostPIC] = useState('');
  const [manualPIC, setManualPIC] = useState('');
  const [costReceipt, setCostReceipt] = useState('');
  const receiptInputRef = useRef<HTMLInputElement>(null);

  // Discrepancy Form
  const [editingDiscrepancyId, setEditingDiscrepancyId] = useState<string | null>(null);
  const [discDate, setDiscDate] = useState(new Date().toISOString().split('T')[0]);
  const [discAmount, setDiscAmount] = useState('');
  const [discType, setDiscType] = useState<'plus' | 'minus'>('minus');
  const [discNotes, setDiscNotes] = useState('');

  // Staff Form
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPin, setStaffPin] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffRoles, setStaffRoles] = useState<StaffRole[]>(['kasir']);

  // History Search
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');

  // Return (Retur) Form
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTransaction, setReturnTransaction] = useState<Transaction | null>(null);
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, number>>({}); // itemId -> quantity to return

  // History & Analytics states
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [expandedTx, setExpandedTx] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    setProducts(getProducts());
    setStaff(getStaff());
    setTransactions(getTransactions().reverse()); // Newest first
    setSettings(getStoreSettings());
    setOperationalCosts(getOperationalCosts());
    setDiscrepancies(getCashierDiscrepancies());
    setRestockRecords(getRestockRecords().reverse());
  }, []);

  const handleExportFinancials = (month: string, data: any) => {
    const monthName = new Date(month + '-01').toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });
    const csvData = [
      ['Laporan Keuangan', monthName],
      [''],
      ['Kategori', 'Jumlah'],
      ['Total Penjualan', data.revenue],
      ['Total HPP (Modal)', data.cogs],
      ['Total Biaya Restok', data.restock],
      ['Laba Kotor', data.revenue - data.cogs],
      ['Selisih Kasir', data.discrepancies],
      ['Total Laba Kotor', data.revenue - data.cogs + data.discrepancies],
      ['Biaya Operasional', data.operational],
      ['Laba Bersih', data.revenue - data.cogs + data.discrepancies - data.operational],
      ['Margin (%)', (data.revenue > 0 ? ((data.revenue - data.cogs + data.discrepancies - data.operational) / data.revenue) * 100 : 0).toFixed(2)]
    ];
    exportToCSV(csvData, `Laporan_Keuangan_${month}.csv`);
  };

  // --- Product Handlers ---
  const resetProductForm = () => {
    setProdName('');
    setProdPrice('');
    setProdCostPrice('');
    setProdTotalCost('');
    setProdTotalWeight('');
    setProdNumItems('');
    setProdStock('');
    setProdUnit('pcs');
    setProdType('barang');
    setIsRental(false);
    setRentalPeriodUnit('day');
    setRentalRequirePhone(false);
    setSellInGram(false);
    setProdImage('');
    setProdDiscountPercent('');
    setProdDiscountValidUntil('');
    setEditingProductId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setProdImage(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName || !prodPrice || (prodType === 'barang' && !prodStock)) return;

    const newProduct: Product = {
      id: editingProductId || Date.now().toString(),
      name: prodName,
      price: parseFloat(prodPrice.replace(/\./g, '')),
      costPrice: prodCostPrice ? parseFloat(prodCostPrice.replace(/\./g, '')) : undefined,
      stock: prodType === 'barang' 
        ? ((prodUnit === 'kg' || prodUnit === 'porsi' || prodUnit === 'jam' || prodUnit === 'hari') ? parseFloat(prodStock.replace(/,/g, '.')) : parseFloat(prodStock.replace(/\./g, '')))
        : 0,
      unit: prodUnit,
      sellInGram: prodUnit === 'kg' ? sellInGram : false,
      type: prodType,
      isRental: prodType === 'jasa' ? isRental : false,
      rentalSettings: prodType === 'jasa' && isRental ? {
        periodUnit: rentalPeriodUnit,
        requirePhone: rentalRequirePhone
      } : undefined,
      image: prodImage || undefined,
    };

    if (prodDiscountPercent && parseFloat(prodDiscountPercent) > 0) {
      newProduct.discount = {
        percentage: parseFloat(prodDiscountPercent),
        validUntil: prodDiscountValidUntil || new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0],
      };
    }

    const updatedProducts = editingProductId
      ? products.map(p => p.id === editingProductId ? newProduct : p)
      : [...products, newProduct];

    setProducts(updatedProducts);
    saveProducts(updatedProducts);
    resetProductForm();
  };

  const handleDeleteProduct = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Produk',
      message: 'Apakah Anda yakin ingin menghapus produk ini?',
      variant: 'danger',
      onConfirm: () => {
        const updated = products.filter(p => p.id !== id);
        setProducts(updated);
        saveProducts(updated);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProdName(product.name);
    setProdPrice(product.price.toLocaleString('id-ID'));
    setProdCostPrice(product.costPrice ? product.costPrice.toLocaleString('id-ID') : '');
    setProdStock((product.unit === 'kg' || product.unit === 'porsi' || product.unit === 'jam' || product.unit === 'hari') ? product.stock.toString().replace('.', ',') : product.stock.toLocaleString('id-ID'));
    setProdUnit(product.unit || 'pcs');
    setProdType(product.type || 'barang');
    setIsRental(product.isRental || false);
    setRentalPeriodUnit(product.rentalSettings?.periodUnit || 'day');
    setRentalRequirePhone(product.rentalSettings?.requirePhone || false);
    setSellInGram(product.sellInGram || false);
    setProdImage(product.image || '');
    if (product.discount) {
      setProdDiscountPercent(product.discount.percentage.toString());
      setProdDiscountValidUntil(product.discount.validUntil);
    } else {
      setProdDiscountPercent('');
      setProdDiscountValidUntil('');
    }
  };

  // --- Operational Cost Handlers ---
  const resetCostForm = () => {
    setCostDate(new Date().toISOString().split('T')[0]);
    setCostDesc('');
    setCostAmount('');
    setCostPICType('karyawan');
    setCostPIC('');
    setManualPIC('');
    setCostReceipt('');
    setEditingCostId(null);
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setCostReceipt(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCost = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPIC = costPIC === 'Lainnya' ? manualPIC : costPIC;
    if (!costDate || !costDesc || !costAmount || !finalPIC) return;

    const newCost: OperationalCost = {
      id: editingCostId || `COST-${Date.now()}`,
      date: costDate,
      description: costDesc,
      amount: parseFloat(costAmount.replace(/\./g, '')),
      personInCharge: finalPIC,
      receiptImage: costReceipt || undefined,
    };

    const updated = editingCostId ? operationalCosts.map(c => c.id === editingCostId ? newCost : c) : [...operationalCosts, newCost];
    setOperationalCosts(updated);
    saveOperationalCosts(updated);
    resetCostForm();
  };

  const handleDeleteCost = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Pengeluaran',
      message: 'Apakah Anda yakin ingin menghapus pengeluaran ini?',
      variant: 'danger',
      onConfirm: () => {
        const updated = operationalCosts.filter(c => c.id !== id);
        setOperationalCosts(updated);
        saveOperationalCosts(updated);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // --- Discrepancy Handlers ---
  const resetDiscrepancyForm = () => {
    setDiscDate(new Date().toISOString().split('T')[0]);
    setDiscAmount('');
    setDiscType('minus');
    setDiscNotes('');
    setEditingDiscrepancyId(null);
  };

  const handleSaveDiscrepancy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!discDate || !discAmount || !discNotes) return;

    const amount = parseFloat(discAmount.replace(/\./g, ''));
    const finalAmount = discType === 'minus' ? -amount : amount;

    const newDisc: CashierDiscrepancy = {
      id: editingDiscrepancyId || `DISC-${Date.now()}`,
      date: discDate,
      amount: finalAmount,
      notes: discNotes,
    };

    const updated = editingDiscrepancyId ? discrepancies.map(d => d.id === editingDiscrepancyId ? newDisc : d) : [...discrepancies, newDisc];
    setDiscrepancies(updated);
    saveCashierDiscrepancies(updated);
    resetDiscrepancyForm();
  };

  const handleDeleteDiscrepancy = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Selisih',
      message: 'Apakah Anda yakin ingin menghapus catatan selisih ini?',
      variant: 'danger',
      onConfirm: () => {
        const updated = discrepancies.filter(d => d.id !== id);
        setDiscrepancies(updated);
        saveCashierDiscrepancies(updated);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // --- Staff Handlers ---
  const resetStaffForm = () => {
    setStaffName('');
    setStaffPin('');
    setStaffPhone('');
    setStaffRoles(['kasir']);
    setEditingStaffId(null);
  };

  const handleSaveStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffPin) return;

    const newStaff: Staff = {
      id: editingStaffId || `STF-${Date.now()}`,
      name: staffName,
      pin: staffPin,
      phone: staffPhone,
      roles: staffRoles
    };

    const updated = editingStaffId 
      ? staff.map(s => s.id === editingStaffId ? newStaff : s) 
      : [...staff, newStaff];
    
    setStaff(updated);
    saveStaff(updated);
    resetStaffForm();
  };

  const handleDeleteStaff = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Staff',
      message: 'Apakah Anda yakin ingin menghapus staff ini?',
      variant: 'danger',
      onConfirm: () => {
        const updated = staff.filter(s => s.id !== id);
        setStaff(updated);
        saveStaff(updated);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleEditStaff = (s: Staff) => {
    setEditingStaffId(s.id);
    setStaffName(s.name);
    setStaffPin(s.pin);
    setStaffPhone(s.phone || '');
    setStaffRoles(s.roles);
  };

  const toggleStaffRole = (role: StaffRole) => {
    if (staffRoles.includes(role)) {
      setStaffRoles(staffRoles.filter(r => r !== role));
    } else {
      setStaffRoles([...staffRoles, role]);
    }
  };

  // --- Restock Handlers ---
  const handleSaveRestock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProductId || !restockTotalCost || !restockSellingPrice) return;

    const totalCost = parseFloat(restockTotalCost.replace(/\./g, ''));
    const sellingPrice = parseFloat(restockSellingPrice.replace(/\./g, ''));
    
    // Determine quantity to add to stock based on inputs and product unit
    const product = products.find(p => p.id === restockProductId);
    if (!product) return;

    let quantity = 0;
    if (restockQuantity) {
      quantity = parseFloat(restockQuantity.replace(/\./g, '').replace(/,/g, '.'));
    } else if (restockTotalWeight) {
      quantity = parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.'));
    } else if (restockNumItems) {
      quantity = parseFloat(restockNumItems.replace(/\./g, ''));
    }

    if (quantity <= 0) return;

    const unitCost = totalCost / quantity;
    const profitPerItem = sellingPrice - unitCost;
    const profitPercentage = (profitPerItem / unitCost) * 100;

    const newRecord: RestockRecord = {
      id: `RESTOCK-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      productId: restockProductId,
      productName: product.name,
      quantity,
      totalWeight: restockTotalWeight ? parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.')) : undefined,
      numItems: restockNumItems ? parseFloat(restockNumItems.replace(/\./g, '')) : undefined,
      totalCost,
      unitCost,
      newSellingPrice: sellingPrice,
      profitPercentage
    };

    saveRestockRecord(newRecord);
    setRestockRecords([newRecord, ...restockRecords]);
    
    // Refresh products list as it was updated in storage
    setProducts(getProducts());
    
    // Reset form
    setRestockProductId('');
    setRestockTotalCost('');
    setRestockQuantity('');
    setRestockTotalWeight('');
    setRestockNumItems('');
    setRestockSellingPrice('');
    
    setConfirmModal({
      isOpen: true,
      title: 'Restok Berhasil',
      message: 'Restok berhasil disimpan dan stok produk diperbarui!',
      variant: 'success',
      isAlert: true,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleResetTransactions = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Hapus Semua Transaksi',
      message: 'Apakah Anda yakin ingin menghapus SEMUA data transaksi? Tindakan ini tidak dapat dibatalkan.',
      variant: 'danger',
      onConfirm: () => {
        clearTransactions();
        setTransactions([]);
        setConfirmModal({
          isOpen: true,
          title: 'Berhasil',
          message: 'Data transaksi telah dihapus.',
          variant: 'success',
          isAlert: true,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
      }
    });
  };

  // --- History Handlers ---
  const handleMarkPaid = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Tandai Lunas',
      message: 'Apakah Anda yakin ingin menandai transaksi COD ini sebagai Lunas?',
      variant: 'success',
      onConfirm: () => {
        updateTransactionStatus(id, 'completed');
        setTransactions(getTransactions().reverse());
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleOpenReturn = (tx: Transaction) => {
    setReturnTransaction(tx);
    const initialSelected: Record<string, number> = {};
    tx.items.forEach(item => {
      // Only items not already returned
      const alreadyReturned = tx.returnedItems?.find(ri => ri.itemId === item.id)?.quantity || 0;
      const available = item.quantity - alreadyReturned;
      if (available > 0) {
        initialSelected[item.id] = available;
      }
    });
    setSelectedReturnItems(initialSelected);
    setShowReturnModal(true);
  };

  const handleProcessReturn = () => {
    if (!returnTransaction) return;

    // Calculate refund amount (excluding delivery fee)
    let totalRefund = 0;
    Object.entries(selectedReturnItems).forEach(([itemId, qty]) => {
      if (qty <= 0) return;
      const item = returnTransaction.items.find(i => i.id === itemId);
      if (item) {
        totalRefund += (item.finalPrice * qty) * 0.9;
      }
    });

    const newTx = processReturn(returnTransaction.id, selectedReturnItems);
    
    // Refresh UI
    setTransactions(getTransactions().reverse());
    setProducts(getProducts());
    setShowReturnModal(false);
    
    setConfirmModal({
      isOpen: true,
      title: 'Retur Berhasil',
      message: newTx 
        ? `Berhasil memproses pengembalian barang. Nota lama telah dihapus dan nota baru (${newTx.id}) telah dibuat untuk sisa item. Total uang yang dikembalikan: ${formatCurrency(totalRefund)}`
        : `Berhasil memproses pengembalian barang. Seluruh item telah dikembalikan dan nota telah dihapus. Total uang yang dikembalikan: ${formatCurrency(totalRefund)}`,
      variant: 'success',
      isAlert: true,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleExportCSV = () => {
    const rows = [
      ["ID Transaksi", "Tanggal", "Kasir", "Pelanggan", "Metode", "Status", "Subtotal", "Diskon Manual", "Total Promo Produk", "Total Akhir"]
    ];

    transactions.forEach(tx => {
      const promoProduk = tx.items.reduce((sum, item) => sum + ((item.price - item.finalPrice) * item.quantity), 0);
      rows.push([
        tx.id,
        new Date(tx.date).toLocaleString('id-ID'),
        tx.cashierName,
        tx.customerName || '-',
        tx.paymentMethod.toUpperCase(),
        tx.status.toUpperCase(),
        tx.subtotal.toString(),
        tx.cartDiscount.toString(),
        promoProduk.toString(),
        tx.total.toString()
      ]);
    });

    exportToCSV(rows, `Laporan_Transaksi_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const toggleDate = (dateStr: string) => {
    setExpandedDates(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const toggleTx = (txId: string) => {
    setExpandedTx(prev => ({ ...prev, [txId]: !prev[txId] }));
  };

  const groupedTransactions = transactions
    .filter(tx => {
      if (!historySearchQuery) return true;
      const query = historySearchQuery.toLowerCase();
      return (
        tx.id.toLowerCase().includes(query) ||
        tx.cashierName.toLowerCase().includes(query) ||
        (tx.customerName && tx.customerName.toLowerCase().includes(query))
      );
    })
    .reduce((acc, tx) => {
      const dateStr = new Date(tx.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(tx);
      return acc;
    }, {} as Record<string, Transaction[]>);

  // --- Analytics Data ---
  const productSales = transactions.reduce((acc, tx) => {
    tx.items.forEach(item => {
      if (!acc[item.id]) {
        acc[item.id] = { name: item.name, quantity: 0, revenue: 0 };
      }
      acc[item.id].quantity += item.quantity;
      acc[item.id].revenue += (item.finalPrice * item.quantity);
    });
    return acc;
  }, {} as Record<string, { name: string, quantity: number, revenue: number }>);

  const topProducts = (Object.values(productSales) as { name: string, quantity: number, revenue: number }[])
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  const cashierPerformance = transactions.reduce((acc, tx) => {
    if (!acc[tx.cashierName]) {
      acc[tx.cashierName] = { name: tx.cashierName, txCount: 0, revenue: 0 };
    }
    acc[tx.cashierName].txCount += 1;
    acc[tx.cashierName].revenue += tx.total;
    return acc;
  }, {} as Record<string, { name: string, txCount: number, revenue: number }>);

  const cashierData = Object.values(cashierPerformance) as { name: string, txCount: number, revenue: number }[];

  const handleExportProductAnalytics = () => {
    const rows = [
      ["Nama Produk", "Total Terjual (Qty)", "Total Pendapatan (Rp)"]
    ];
    (Object.values(productSales) as { name: string, quantity: number, revenue: number }[])
      .sort((a, b) => b.quantity - a.quantity)
      .forEach(p => {
        rows.push([p.name, p.quantity.toString(), p.revenue.toString()]);
      });
    exportToCSV(rows, `Analisa_Produk_${new Date().toISOString().split('T')[0]}.csv`);
  };

  // --- Settings Handlers ---
  const handleBackupData = () => {
  const data = JSON.stringify(localStorage, null, 2);

  const blob = new Blob([data], {
    type: 'application/json'
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-kasir-${new Date().toISOString().split('T')[0]}.json`;
  a.click();

  URL.revokeObjectURL(url);
};

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

    alert('Data berhasil diimport');
    window.location.reload();
  } catch {
    alert('File backup tidak valid');
  }
};
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveStoreSettings(settings);
    setConfirmModal({
      isOpen: true,
      title: 'Berhasil',
      message: 'Pengaturan toko berhasil disimpan!',
      variant: 'success',
      isAlert: true,
      onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-8 text-center animate-in fade-in zoom-in duration-500">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 bg-blue-100 rounded-3xl rotate-6 animate-pulse"></div>
            <div className="absolute inset-0 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
              <ShieldCheck size={48} />
            </div>
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">KASIR PINTAR <span className="text-blue-600">PRO</span></h1>
            <p className="text-gray-500 font-medium">Menyiapkan Dashboard Manager...</p>
          </div>

          <div className="relative h-3 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50">
            <div className="absolute top-0 left-0 h-full bg-blue-600 rounded-full animate-[loading_3s_ease-in-out_forwards]"></div>
          </div>

          <div className="flex justify-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span className="flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Syncing</span>
            <span className="flex items-center gap-1"><ShieldCheck size={10} /> Secure</span>
            <span className="flex items-center gap-1"><Package size={10} /> Assets</span>
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes loading {
            0% { width: 0%; }
            20% { width: 30%; }
            50% { width: 60%; }
            80% { width: 90%; }
            100% { width: 100%; }
          }
        `}} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header - Desktop */}
      <div className="hidden lg:block bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
              title="Menu Navigasi"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-100">
                <ShieldCheck size={24} />
              </div>
              <div>
                <h1 className="text-xl font-black text-gray-900 tracking-tight">KASIR PINTAR <span className="text-blue-600">MANAGER</span></h1>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Dashboard Kendali Utama</p>
              </div>
            </div>

            <div className="h-10 w-px bg-gray-100"></div>

            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-bold border border-blue-100">
                {settings.ownerName?.charAt(0) || 'A'}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Selamat Datang,</p>
                <p className="text-sm font-bold text-gray-800">{settings.ownerName || 'Administrator'}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-4 hidden xl:block">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Waktu Sistem</p>
              <p className="text-sm font-bold text-gray-800">
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button 
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-bold transition-all duration-300 border border-red-100"
            >
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header - Mobile */}
      <header className="lg:hidden bg-white border-b border-gray-100 p-4 sticky top-0 z-40">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                <ShieldCheck size={20} />
              </div>
              <h1 className="font-bold text-gray-800">Admin Panel</h1>
            </div>
          </div>
          <button onClick={onLogout} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
            <LogOut size={20} />
          </button>
        </div>
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
          <div>
            <p className="text-[10px] text-blue-600 font-bold uppercase">Selamat Datang,</p>
            <p className="text-sm font-bold text-blue-800">{settings.ownerName || 'Admin'}</p>
          </div>
          <div className="text-[10px] text-blue-500 font-medium">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
          </div>
        </div>
      </header>

      {/* Navigation Sidebar / Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsMenuOpen(false)}
          ></div>
          <div className="relative w-72 max-w-[80%] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
              <div>
                <h2 className="font-black tracking-tight">KASIR PINTAR</h2>
                <p className="text-[10px] font-bold opacity-70 uppercase">Menu Navigasi</p>
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {[
                { id: 'products', icon: Package, label: 'Produk' },
                { id: 'restock', icon: PlusCircle, label: 'Restok' },
                { id: 'staff', icon: UserCircle, label: 'Staff' },
                { id: 'history', icon: History, label: 'Riwayat' },
                { id: 'analytics', icon: BarChart3, label: 'Analisa' },
                { id: 'financials', icon: DollarSign, label: 'Keuangan' },
                { id: 'operational', icon: FileText, label: 'Operasional' },
                { id: 'discrepancies', icon: AlertCircle, label: 'Selisih' },
                { id: 'settings', icon: SettingsIcon, label: 'Pengaturan' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' 
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <tab.icon size={20} /> 
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <button 
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-bold transition-all"
              >
                <LogOut size={20} />
                <span>Keluar Sistem</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-8">

        {/* Tab Content: Products */}
        {activeTab === 'products' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-blue-800">{editingProductId ? 'Edit Produk' : 'Tambah Produk'}</h2>
                  {editingProductId && <button onClick={resetProductForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>}
                </div>
                <form onSubmit={handleSaveProduct} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Produk *</label>
                    <input type="text" required value={prodName} onChange={e => setProdName(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tipe Produk *</label>
                      <div className="flex gap-2">
                        {(['barang', 'jasa', 'makanan'] as const)
                          .filter(type => {
                            if (type === 'barang') return settings.enableBarang;
                            if (type === 'jasa') return settings.enableJasa;
                            if (type === 'makanan') return settings.enableMakanan;
                            return true;
                          })
                          .map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setProdType(type);
                                if (type === 'makanan') setProdUnit('porsi');
                                else if (type === 'jasa') setProdUnit('pcs');
                                else setProdUnit('pcs');
                              }}
                              className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                prodType === type 
                                  ? 'bg-blue-600 text-white border-blue-600' 
                                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {type === 'barang' ? 'Barang' : type === 'jasa' ? 'Jasa' : 'Makanan'}
                            </button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {prodType === 'jasa' && (
                    <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-orange-800 uppercase tracking-wider">Jasa Peminjaman / Rental</label>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={isRental}
                            onChange={e => setIsRental(e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>
                      
                      {isRental && (
                        <div className="space-y-3 pt-2 border-t border-orange-200">
                          <div>
                            <label className="block text-[10px] font-bold text-orange-700 mb-1 uppercase">Satuan Waktu Rental</label>
                            <div className="flex gap-2">
                              {(['hour', 'day'] as const).map(unit => (
                                <button
                                  key={unit}
                                  type="button"
                                  onClick={() => {
                                    setRentalPeriodUnit(unit);
                                    setProdUnit(unit === 'hour' ? 'jam' : 'hari');
                                  }}
                                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border transition-all ${
                                    rentalPeriodUnit === unit 
                                      ? 'bg-orange-600 text-white border-orange-600' 
                                      : 'bg-white text-orange-600 border-orange-200 hover:bg-orange-50'
                                  }`}
                                >
                                  {unit === 'hour' ? 'Per Jam' : 'Per Hari'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={rentalRequirePhone}
                              onChange={e => setRentalRequirePhone(e.target.checked)}
                              className="w-4 h-4 text-orange-600 focus:ring-orange-500 rounded"
                            />
                            <span className="text-[10px] text-orange-800 font-bold uppercase">Wajib No. HP Peminjam</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {prodType === 'jasa' && isRental 
                          ? `Biaya Sewa per ${rentalPeriodUnit === 'hour' ? 'Jam' : 'Hari'} (Rp) *` 
                          : prodType === 'makanan'
                          ? 'Harga per Porsi (Rp) *'
                          : prodUnit === 'kg' 
                          ? 'Harga Jual / Kilo (Rp) *' 
                          : 'Harga Jual (Rp) *'}
                      </label>
                      <input 
                        type="text" 
                        inputMode="numeric"
                        required 
                        value={prodPrice} 
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setProdPrice(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                        }} 
                        className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 font-bold text-green-700" 
                      />
                    </div>
                  </div>

                  {settings.showSellingOptions && prodUnit === 'kg' && prodType === 'barang' && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                      <label className="block text-xs font-bold text-blue-800 uppercase tracking-wider">Opsi Penjualan</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="sellInGram" 
                            checked={!sellInGram} 
                            onChange={() => setSellInGram(false)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">Jual per Kilo</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="radio" 
                            name="sellInGram" 
                            checked={sellInGram} 
                            onChange={() => setSellInGram(true)}
                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700 font-medium">Jual per Gram</span>
                        </label>
                      </div>
                    </div>
                  )}

                  {settings.showCostPrice && prodType === 'barang' && (prodUnit === 'kg' || prodUnit === 'karung') && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Kalkulator Modal (Opsional)</h3>
                      {prodUnit === 'karung' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">Berapa Karung</label>
                              <input 
                                type="text" 
                                inputMode="numeric"
                                value={restockNumSacks} 
                                onChange={e => setRestockNumSacks(e.target.value.replace(/\D/g, ''))} 
                                className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                                placeholder="Karung"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">Kg per Karung</label>
                              <input 
                                type="text" 
                                inputMode="decimal"
                                value={restockWeightPerSack} 
                                onChange={e => setRestockWeightPerSack(e.target.value.replace(/[^\d.,]/g, ''))} 
                                className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                                placeholder="Kg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Harga per Karung</label>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              value={restockPricePerSack} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                setRestockPricePerSack(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                              }} 
                              className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                              placeholder="Rp"
                            />
                          </div>
                          {restockNumSacks && restockWeightPerSack && restockPricePerSack && (
                            <button 
                              type="button"
                              onClick={() => {
                                const sacks = parseFloat(restockNumSacks) || 0;
                                const weight = parseFloat(restockWeightPerSack.replace(/,/g, '.')) || 0;
                                const price = parseFloat(restockPricePerSack.replace(/\./g, '')) || 0;
                                const totalWeight = sacks * weight;
                                const totalCost = sacks * price;
                                const unitCost = Math.round(totalCost / totalWeight);
                                setProdCostPrice(unitCost.toLocaleString('id-ID'));
                                setProdStock(totalWeight.toString());
                              }}
                              className="w-full py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                            >
                              Gunakan Hasil Kalkulasi (Modal & Stok)
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">Total Biaya</label>
                              <input 
                                type="text" 
                                inputMode="numeric"
                                value={prodTotalCost} 
                                onChange={e => {
                                  const val = e.target.value.replace(/\D/g, '');
                                  setProdTotalCost(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                                }} 
                                className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                                placeholder="Rp"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-gray-500 mb-1">Total Berat (Kg)</label>
                              <input 
                                type="text" 
                                inputMode="decimal"
                                value={prodTotalWeight} 
                                onChange={e => {
                                  const val = e.target.value.replace(/[^\d.,]/g, '');
                                  setProdTotalWeight(val);
                                }} 
                                className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                                placeholder="Kg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-gray-500 mb-1">Banyak Barang (Pcs)</label>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              value={prodNumItems} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                setProdNumItems(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                              }} 
                              className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                              placeholder="Pcs"
                            />
                          </div>
                          {prodTotalCost && (prodTotalWeight || prodNumItems) && (
                            <button 
                              type="button"
                              onClick={() => {
                                const cost = parseFloat(prodTotalCost.replace(/\./g, '')) || 0;
                                const qty = parseFloat(prodTotalWeight.replace(/\./g, '').replace(/,/g, '.')) || 
                                            parseFloat(prodNumItems.replace(/\./g, '')) || 1;
                                const unitCost = Math.round(cost / qty);
                                setProdCostPrice(unitCost.toLocaleString('id-ID'));
                              }}
                              className="w-full py-1.5 bg-blue-50 text-blue-600 text-xs font-bold rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
                            >
                              Gunakan Hasil Kalkulasi Sebagai Modal
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                  {prodType === 'barang' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stok *</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          inputMode={prodUnit === 'kg' ? "decimal" : "numeric"}
                          required 
                          value={prodStock} 
                          onChange={e => {
                            if (prodUnit === 'kg') {
                              // Allow numbers and comma/dot for decimals
                              let val = e.target.value.replace(/[^\d.,]/g, '');
                              // Replace comma with dot for internal parsing if needed, but keep user input format
                              setProdStock(val);
                            } else {
                              const val = e.target.value.replace(/\D/g, '');
                              setProdStock(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                            }
                          }} 
                          className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                        />
                        <select 
                          value={prodUnit} 
                          onChange={e => {
                            setProdUnit(e.target.value as any);
                            // Reset formatting if switching away from kg/porsi/jam/hari
                            const isDecimalUnit = ['kg', 'porsi', 'jam', 'hari'].includes(e.target.value);
                            if (!isDecimalUnit && prodStock) {
                              const val = prodStock.replace(/\D/g, '');
                              setProdStock(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                            }
                          }}
                          className="px-2 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 bg-gray-50 text-sm"
                        >
                          <option value="pcs">Pcs</option>
                          <option value="box">Box</option>
                          <option value="kg">Kg</option>
                          <option value="karung">Karung</option>
                        </select>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gambar Produk</label>
                    <div className="flex items-center gap-4">
                      {prodImage ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                          <img src={prodImage} alt="Preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setProdImage('')} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"><X size={12} /></button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 border-2 border-dashed flex items-center justify-center text-gray-400"><ImageIcon size={24} /></div>
                      )}
                      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-green-600 mb-3">Diskon (Opsional)</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Diskon (%)</label>
                        <input type="number" min="0" max="100" value={prodDiscountPercent} onChange={e => setProdDiscountPercent(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Berlaku Sampai</label>
                        <input type="date" value={prodDiscountValidUntil} onChange={e => setProdDiscountValidUntil(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-green-500" />
                      </div>
                    </div>
                  </div>
                  <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6">
                    <Save size={20} /> {editingProductId ? 'Simpan Perubahan' : 'Simpan Produk'}
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Daftar Produk ({products.length})</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                        <th className="p-4 rounded-tl-xl font-medium">Produk</th>
                        <th className="p-4 font-medium">Harga Jual</th>
                        {settings.showCostPrice && <th className="p-4 font-medium">Harga Modal</th>}
                        <th className="p-4 font-medium">Stok</th>
                        <th className="p-4 font-medium">Diskon</th>
                        <th className="p-4 rounded-tr-xl font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {products.map((product) => (
                        <tr key={product.id} className="hover:bg-blue-50/50">
                          <td className="p-4 flex items-center gap-3">
                            {product.image ? <img src={product.image} className="w-10 h-10 rounded-lg object-cover border" /> : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><ImageIcon size={16} /></div>}
                            <span className="font-medium text-gray-800">{product.name}</span>
                          </td>
                          <td className={`p-4 font-medium ${product.costPrice && product.price < product.costPrice ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(product.price)}
                            <span className="text-xs text-gray-400 ml-1">/{product.unit || 'pcs'}</span>
                          </td>
                          {settings.showCostPrice && (
                            <td className="p-4 text-gray-600">
                              {product.costPrice ? formatCurrency(product.costPrice) : '-'}
                              <span className="text-xs text-gray-400 ml-1">/{product.unit || 'pcs'}</span>
                            </td>
                          )}
                          <td className="p-4 font-medium text-blue-600">
                            {product.type === 'jasa' ? '-' : product.stock}
                          </td>
                          <td className="p-4">
                            {product.discount ? <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">{product.discount.percentage}%</span> : '-'}
                          </td>
                          <td className="p-4 text-right">
                            <button onClick={() => handleEditProduct(product)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">Edit</button>
                            <button onClick={() => handleDeleteProduct(product.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: History & Reports */}
        {activeTab === 'history' && (
          <div className="bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-800">Riwayat Transaksi</h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Cari ID Struk / Kasir..." 
                    value={historySearchQuery}
                    onChange={e => setHistorySearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
                  />
                </div>
                <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors">
                  <Download size={18} /> Export CSV
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              {Object.keys(groupedTransactions).length === 0 ? (
                <div className="p-8 text-center text-gray-500 border rounded-xl">Belum ada transaksi yang sesuai pencarian.</div>
              ) : (
                (Object.entries(groupedTransactions) as [string, Transaction[]][]).map(([dateStr, dayTxs]) => (
                  <div key={dateStr} className="border rounded-xl overflow-hidden shadow-sm">
                    <button 
                      onClick={() => toggleDate(dateStr)}
                      className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-800">{dateStr}</span>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-full">{dayTxs.length} Transaksi</span>
                      </div>
                      {expandedDates[dateStr] ? <ChevronUp size={20} className="text-gray-500" /> : <ChevronDown size={20} className="text-gray-500" />}
                    </button>
                    
                    {expandedDates[dateStr] && (
                      <div className="p-2 lg:p-4 border-t bg-white">
                        {/* Desktop Table View */}
                        <div className="hidden lg:block overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="bg-gray-50 text-gray-600 uppercase tracking-wider">
                                <th className="p-3 font-medium">Waktu / ID</th>
                                <th className="p-3 font-medium">Kasir</th>
                                <th className="p-3 font-medium">Metode</th>
                                <th className="p-3 font-medium text-right">Total Akhir</th>
                                <th className="p-3 font-medium text-center">Status</th>
                                <th className="p-3 font-medium text-right">Aksi</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {dayTxs.map(tx => {
                                const isTxExpanded = expandedTx[tx.id];
                                return (
                                  <React.Fragment key={tx.id}>
                                    <tr className="hover:bg-blue-50 cursor-pointer" onClick={() => toggleTx(tx.id)}>
                                      <td className="p-3 text-gray-600">
                                        <div className="flex items-center gap-2">
                                          {isTxExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                          <span className="font-medium">{new Date(tx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div className="text-[10px] text-gray-400 ml-6">#{tx.id.slice(-6)}</div>
                                      </td>
                                      <td className="p-3 font-medium">{tx.cashierName}</td>
                                      <td className="p-3 uppercase font-bold text-gray-500 text-xs">
                                        <div className="flex items-center gap-1">
                                          {tx.paymentMethod}
                                          {tx.qrisProof && <ImageIcon size={12} className="text-blue-500" />}
                                        </div>
                                      </td>
                                      <td className="p-3 text-right font-bold text-blue-600">{formatCurrency(tx.total)}</td>
                                      <td className="p-3 text-center">
                                        <StatusBadge status={tx.status} />
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                          {tx.status === 'pending' && (
                                            <button onClick={(e) => { e.stopPropagation(); handleMarkPaid(tx.id); }} className="text-[10px] bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">Lunas</button>
                                          )}
                                          {tx.status !== 'cancelled' && (
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); handleOpenReturn(tx); }} 
                                              className="text-[10px] bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 flex items-center gap-1"
                                            >
                                              <RefreshCw size={10} /> Retur
                                            </button>
                                          )}
                                          {tx.status !== 'cancelled' && (
                                            <button 
                                              onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setConfirmModal({
                                                  isOpen: true,
                                                  title: 'Batalkan Transaksi',
                                                  message: 'Apakah Anda yakin ingin membatalkan transaksi ini? Stok akan dikembalikan.',
                                                  variant: 'danger',
                                                  onConfirm: () => {
                                                    cancelTransaction(tx.id);
                                                    setTransactions(getTransactions().reverse());
                                                    setProducts(getProducts());
                                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                  }
                                                });
                                              }} 
                                              className="text-[10px] bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                                            >
                                              Batal
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                    {isTxExpanded && (
                                      <tr className="bg-gray-50">
                                        <td colSpan={6} className="p-4">
                                          <TransactionDetail tx={tx} />
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Card View */}
                        <div className="lg:hidden space-y-3">
                          {dayTxs.map(tx => (
                            <div key={tx.id} className="bg-white border rounded-xl p-4 shadow-sm">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <div className="text-xs text-gray-400">#{tx.id.slice(-6)}</div>
                                  <div className="font-bold text-gray-800">{new Date(tx.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                                  <div className="text-xs text-gray-500 flex items-center gap-1">
                                    {tx.cashierName} • <span className="uppercase">{tx.paymentMethod}</span>
                                    {tx.qrisProof && <ImageIcon size={10} className="text-blue-500" />}
                                  </div>
                                </div>
                                <StatusBadge status={tx.status} />
                              </div>
                              
                              <div className="flex justify-between items-center py-2 border-y border-gray-50 mb-3">
                                <span className="text-sm text-gray-600">Total Akhir:</span>
                                <span className="font-bold text-blue-600">{formatCurrency(tx.total)}</span>
                              </div>

                              <div className="flex gap-2">
                                <button 
                                  onClick={() => toggleTx(tx.id)}
                                  className="flex-1 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg"
                                >
                                  {expandedTx[tx.id] ? 'Tutup Detail' : 'Lihat Detail'}
                                </button>
                                {tx.status !== 'cancelled' && (
                                  <button 
                                    onClick={() => handleOpenReturn(tx)}
                                    className="px-4 py-2 text-xs font-medium text-white bg-orange-500 rounded-lg"
                                  >
                                    Retur
                                  </button>
                                )}
                                {tx.status !== 'cancelled' && (
                                  <button 
                                    onClick={() => {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: 'Batalkan Transaksi',
                                        message: 'Apakah Anda yakin ingin membatalkan transaksi ini?',
                                        variant: 'danger',
                                        onConfirm: () => {
                                          cancelTransaction(tx.id);
                                          setTransactions(getTransactions().reverse());
                                          setProducts(getProducts());
                                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                        }
                                      });
                                    }}
                                    className="px-4 py-2 text-xs font-medium text-white bg-red-500 rounded-lg"
                                  >
                                    Batal
                                  </button>
                                )}
                              </div>

                              {expandedTx[tx.id] && (
                                <div className="mt-4 pt-4 border-t">
                                  <TransactionDetail tx={tx} />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Analytics */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* Analisa Produk Terlaris */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Analisa Produk Terlaris</h2>
                  <p className="text-sm text-gray-500">Produk yang paling cepat habis terjual</p>
                </div>
                <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
                  {['day', 'week', 'month', 'year'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setAnalyticsPeriod(period as any)}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                        analyticsPeriod === period 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {period === 'day' ? 'Hari Ini' : period === 'week' ? 'Minggu Ini' : period === 'month' ? 'Bulan Ini' : 'Tahun Ini'}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="h-80 w-full">
                {(() => {
                  const now = new Date();
                  const productSales: Record<string, number> = {};
                  
                  transactions.forEach(tx => {
                    if (tx.status === 'cancelled') return;
                    const txDate = new Date(tx.date);
                    
                    let isInPeriod = false;
                    if (analyticsPeriod === 'day') {
                      isInPeriod = txDate.toDateString() === now.toDateString();
                    } else if (analyticsPeriod === 'week') {
                      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      isInPeriod = txDate >= oneWeekAgo;
                    } else if (analyticsPeriod === 'month') {
                      isInPeriod = txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
                    } else if (analyticsPeriod === 'year') {
                      isInPeriod = txDate.getFullYear() === now.getFullYear();
                    }

                    if (isInPeriod) {
                      tx.items.forEach(item => {
                        productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
                      });
                    }
                  });

                  const topProducts = Object.entries(productSales)
                    .map(([name, quantity]) => ({ name, quantity }))
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 10);

                  return topProducts.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProducts} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                        <Tooltip 
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Bar dataKey="quantity" name="Jumlah Terjual" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">Belum ada data penjualan untuk periode ini</div>
                  );
                })()}
              </div>
            </div>

            {/* Analisa Kinerja Driver */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Analisa Kinerja Driver</h2>
                <p className="text-sm text-gray-500">Jumlah pengiriman dan total jasa yang dihasilkan driver</p>
              </div>
              
              <div className="h-80 w-full">
                {(() => {
                  const driverStats: Record<string, { deliveries: number, fees: number }> = {};
                  transactions.forEach(tx => {
                    if (tx.status === 'cancelled' || !tx.delivery || !tx.delivery.driverName) return;
                    const name = tx.delivery.driverName;
                    if (!driverStats[name]) driverStats[name] = { deliveries: 0, fees: 0 };
                    driverStats[name].deliveries += 1;
                    driverStats[name].fees += tx.deliveryFee || 0;
                  });
                  const driverData = Object.entries(driverStats).map(([name, stats]) => ({
                    name,
                    deliveries: stats.deliveries,
                    fees: stats.fees
                  })).sort((a, b) => b.deliveries - a.deliveries);

                  return driverData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={driverData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                        <YAxis yAxisId="left" orientation="left" stroke="#3b82f6" axisLine={false} tickLine={false} />
                        <YAxis yAxisId="right" orientation="right" stroke="#10b981" axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                        <Bar yAxisId="left" dataKey="deliveries" name="Jumlah Pengiriman" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="fees" name="Total Jasa (Rp)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">Belum ada data pengiriman driver</div>
                  );
                })()}
              </div>
            </div>

            {/* Analisa Balik Modal & Keuntungan Maksimal */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Analisa Keuntungan & Balik Modal</h2>
                <p className="text-sm text-gray-500">Estimasi waktu balik modal dan periode keuntungan maksimal</p>
              </div>

              {(() => {
                // Calculate daily profit
                const dailyProfit: Record<string, number> = {};
                transactions.forEach(tx => {
                  if (tx.status === 'cancelled') return;
                  const date = tx.date.split('T')[0];
                  let profit = 0;
                  tx.items.forEach(item => {
                    const cost = item.costPrice || products.find(p => p.id === item.id)?.costPrice || 0;
                    profit += (item.price - cost) * item.quantity;
                  });
                  dailyProfit[date] = (dailyProfit[date] || 0) + profit;
                });

                // Subtract operational costs from daily profit proportionally (simplified)
                operationalCosts.forEach(cost => {
                  const date = cost.date;
                  dailyProfit[date] = (dailyProfit[date] || 0) - cost.amount;
                });

                const profitValues = Object.values(dailyProfit);
                const avgDailyProfit = profitValues.length > 0 
                  ? profitValues.reduce((a, b) => a + b, 0) / profitValues.length 
                  : 0;

                const initialInvestment = settings.initialInvestment || 0;
                const daysToBEP = avgDailyProfit > 0 ? Math.ceil(initialInvestment / avgDailyProfit) : Infinity;

                // Optimal profit period (day of week)
                const dayOfWeekProfit: Record<number, { total: number, count: number }> = {};
                Object.entries(dailyProfit).forEach(([date, profit]) => {
                  const day = new Date(date).getDay();
                  if (!dayOfWeekProfit[day]) dayOfWeekProfit[day] = { total: 0, count: 0 };
                  dayOfWeekProfit[day].total += profit;
                  dayOfWeekProfit[day].count += 1;
                });

                const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                let bestDayIndex = -1;
                let maxAvgProfit = -Infinity;

                Object.entries(dayOfWeekProfit).forEach(([day, stats]) => {
                  const avg = stats.total / stats.count;
                  if (avg > maxAvgProfit) {
                    maxAvgProfit = avg;
                    bestDayIndex = parseInt(day);
                  }
                });

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                      <h3 className="text-lg font-bold text-blue-800 mb-4 flex items-center gap-2">
                        <RefreshCw size={20} /> Estimasi Balik Modal
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-blue-600">Modal Investasi:</div>
                          <div className="text-xl font-bold text-blue-900">{formatCurrency(initialInvestment)}</div>
                        </div>
                        <div>
                          <div className="text-sm text-blue-600">Rata-rata Keuntungan Harian:</div>
                          <div className="text-xl font-bold text-blue-900">{formatCurrency(avgDailyProfit)}</div>
                        </div>
                        <div className="pt-4 border-t border-blue-200">
                          <div className="text-sm text-blue-600 font-medium">Estimasi Waktu Balik Modal:</div>
                          <div className="text-3xl font-black text-blue-700">
                            {daysToBEP === Infinity ? 'N/A' : `${daysToBEP} Hari`}
                          </div>
                          <p className="text-xs text-blue-500 mt-2 italic">
                            * Berdasarkan rata-rata keuntungan harian saat ini.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100">
                      <h3 className="text-lg font-bold text-emerald-800 mb-4 flex items-center gap-2">
                        <BarChart3 size={20} /> Periode Keuntungan Maksimal
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <div className="text-sm text-emerald-600">Hari Paling Menguntungkan:</div>
                          <div className="text-2xl font-bold text-emerald-900">
                            {bestDayIndex !== -1 ? dayNames[bestDayIndex] : 'Belum ada data'}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-emerald-600">Rata-rata Keuntungan di Hari Tersebut:</div>
                          <div className="text-xl font-bold text-emerald-900">
                            {bestDayIndex !== -1 ? formatCurrency(maxAvgProfit) : 'Rp 0'}
                          </div>
                        </div>
                        <div className="pt-4 border-t border-emerald-200">
                          <div className="text-sm text-emerald-700 font-medium italic">Kutipan Analisa:</div>
                          <p className="text-sm text-emerald-800 mt-2 leading-relaxed">
                            {bestDayIndex !== -1 ? (
                              `Berdasarkan data penjualan harian, hari ${dayNames[bestDayIndex]} merupakan periode dengan performa keuntungan tertinggi. Disarankan untuk memaksimalkan stok dan promosi pada hari tersebut untuk mencapai keuntungan maksimal.`
                            ) : (
                              "Data transaksi belum mencukupi untuk menentukan periode keuntungan maksimal."
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Analisa Kinerja Karyawan (Kasir) */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-800">Analisa Kinerja Karyawan (Kasir)</h2>
                <p className="text-sm text-gray-500">Jumlah transaksi yang dilayani oleh setiap kasir</p>
              </div>
              
              <div className="h-80 w-full">
                {(() => {
                  const cashierStats: Record<string, { txCount: number, revenue: number }> = {};
                  transactions.forEach(tx => {
                    if (tx.status === 'cancelled') return;
                    const name = tx.cashierName;
                    if (!cashierStats[name]) cashierStats[name] = { txCount: 0, revenue: 0 };
                    cashierStats[name].txCount += 1;
                    cashierStats[name].revenue += tx.total;
                  });
                  const cashierData = Object.entries(cashierStats).map(([name, stats]) => ({
                    name,
                    txCount: stats.txCount,
                    revenue: stats.revenue
                  }));

                  return cashierData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={cashierData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="txCount"
                          nameKey="name"
                        >
                          {cashierData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]} />
                          ))}
                        </Pie>
                        <Tooltip 
                          formatter={(value: number, name: string, props: any) => [
                            `${value} Transaksi (${formatCurrency(props.payload.revenue)})`, 
                            'Kinerja'
                          ]}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400">Belum ada data kinerja kasir</div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Financials */}
        {activeTab === 'financials' && (
          <div className="space-y-8">
            {/* Current Inventory Value */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Nilai Persediaan Saat Ini</h2>
                  <p className="text-sm text-gray-500">Total nilai modal dari seluruh produk yang belum terjual</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-right">
                  <div className="text-sm text-blue-600 font-medium mb-1">Total Nilai Stok</div>
                  <div className="text-2xl font-bold text-blue-700">
                    {formatCurrency(products.reduce((acc, p) => acc + ((p.costPrice || 0) * p.stock), 0))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">Laporan Keuangan Bulanan</h2>
                  <p className="text-sm text-gray-500">Rekapitulasi pendapatan, HPP, operasional, dan laba</p>
                </div>
                <div className="flex items-center gap-2">
                  <select 
                    value={selectedMonth} 
                    onChange={e => setSelectedMonth(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
                      </option>
                    ))}
                  </select>
                  <select 
                    value={selectedYear} 
                    onChange={e => setSelectedYear(parseInt(e.target.value))}
                    className="px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {Array.from({ length: 5 }, (_, i) => {
                      const year = new Date().getFullYear() - 2 + i;
                      return <option key={year} value={year}>{year}</option>;
                    })}
                  </select>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* Group transactions, costs, discrepancies by month */}
                {(() => {
                  const monthlyData: Record<string, {
                    revenue: number;
                    cogs: number;
                    discrepancies: number;
                    operational: number;
                    restock: number;
                  }> = {};

                  const targetMonthStr = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}`;

                  transactions.forEach(tx => {
                    if (tx.status === 'cancelled') return;
                    const month = tx.date.substring(0, 7); // YYYY-MM
                    if (month !== targetMonthStr) return;
                    
                    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cogs: 0, discrepancies: 0, operational: 0, restock: 0 };
                    monthlyData[month].revenue += tx.total;
                    
                    // Calculate COGS
                    tx.items.forEach(item => {
                      const cost = item.costPrice || products.find(p => p.id === item.id)?.costPrice || 0;
                      monthlyData[month].cogs += (cost * item.quantity);
                    });
                  });

                  operationalCosts.forEach(cost => {
                    const month = cost.date.substring(0, 7);
                    if (month !== targetMonthStr) return;
                    
                    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cogs: 0, discrepancies: 0, operational: 0, restock: 0 };
                    monthlyData[month].operational += cost.amount;
                  });

                  discrepancies.forEach(disc => {
                    const month = disc.date.substring(0, 7);
                    if (month !== targetMonthStr) return;
                    
                    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cogs: 0, discrepancies: 0, operational: 0, restock: 0 };
                    monthlyData[month].discrepancies += disc.amount;
                  });

                  restockRecords.forEach(record => {
                    const month = record.date.substring(0, 7);
                    if (month !== targetMonthStr) return;

                    if (!monthlyData[month]) monthlyData[month] = { revenue: 0, cogs: 0, discrepancies: 0, operational: 0, restock: 0 };
                    monthlyData[month].restock += record.totalCost;
                  });

                  const sortedMonths = Object.keys(monthlyData).sort((a, b) => b.localeCompare(a));

                  if (sortedMonths.length === 0) {
                    return <div className="p-8 text-center text-gray-500 border rounded-xl">Belum ada data keuangan.</div>;
                  }

                  return sortedMonths.map(month => {
                    const data = monthlyData[month];
                    const grossProfit = data.revenue - data.cogs;
                    const netGrossProfit = grossProfit + data.discrepancies;
                    const netProfit = netGrossProfit - data.operational;
                    const profitPercentage = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;
                    
                    const monthName = new Date(month + '-01').toLocaleDateString('id-ID', { year: 'numeric', month: 'long' });

                    return (
                      <div key={month} className="border rounded-xl overflow-hidden">
                        <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
                          <h3 className="text-lg font-bold text-gray-800">{monthName}</h3>
                          <button 
                            onClick={() => handleExportFinancials(month, data)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
                          >
                            <Download size={14} /> Export Excel
                          </button>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-8">
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pendapatan & HPP</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Total Penjualan</span>
                                <span className="font-semibold text-gray-900">{formatCurrency(data.revenue)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Total HPP (Modal)</span>
                                <span className="font-medium text-red-500">-{formatCurrency(data.cogs)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-50">
                                <span className="font-bold text-gray-700">Laba Kotor</span>
                                <span className="font-bold text-blue-600">{formatCurrency(grossProfit)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Penyesuaian & Biaya</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Selisih Kasir</span>
                                <span className={`font-medium ${data.discrepancies >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {data.discrepancies >= 0 ? '+' : ''}{formatCurrency(data.discrepancies)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Biaya Operasional</span>
                                <span className="font-medium text-red-500">-{formatCurrency(data.operational)}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">Biaya Restok</span>
                                <span className="font-medium text-orange-500">-{formatCurrency(data.restock)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-900 text-white p-5 rounded-2xl flex flex-col justify-between shadow-lg shadow-gray-200">
                            <div>
                              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Laba Bersih Akhir</h4>
                              <div className="text-2xl font-black tracking-tight">{formatCurrency(netProfit)}</div>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-800 flex justify-between items-end">
                              <div>
                                <div className="text-[10px] text-gray-500 uppercase font-bold">Profit Margin</div>
                                <div className={`text-sm font-bold ${profitPercentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {profitPercentage.toFixed(2)}%
                                </div>
                              </div>
                              <div className="text-[10px] text-gray-500 bg-gray-800 px-2 py-1 rounded uppercase font-bold">
                                {netProfit >= 0 ? 'Surplus' : 'Defisit'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Operational Costs */}
        {activeTab === 'operational' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-blue-800">{editingCostId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}</h2>
                  {editingCostId && <button onClick={resetCostForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>}
                </div>
                <form onSubmit={handleSaveCost} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                    <input type="date" required value={costDate} onChange={e => setCostDate(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan Pengeluaran *</label>
                    <input type="text" required value={costDesc} onChange={e => setCostDesc(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Bayar Listrik" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp) *</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      required 
                      value={costAmount} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setCostAmount(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      }} 
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Jenis PJ *</label>
                      <select value={costPICType} onChange={e => setCostPICType(e.target.value as any)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="karyawan">Karyawan</option>
                        <option value="driver">Driver</option>
                        <option value="pemilik">Pemilik</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nama PJ *</label>
                      <select 
                        required 
                        value={costPIC} 
                        onChange={e => setCostPIC(e.target.value)} 
                        className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">-- Pilih PJ --</option>
                        {staff.filter(s => {
                          if (costPICType === 'driver') return s.roles.includes('driver');
                          if (costPICType === 'pemilik') return s.roles.includes('admin');
                          return s.roles.includes('kasir') || s.roles.includes('pj');
                        }).map(s => (
                          <option key={s.id} value={s.name}>{s.name}</option>
                        ))}
                        <option value="Lainnya">Lainnya (Manual)</option>
                      </select>
                      {costPIC === 'Lainnya' && (
                        <input 
                          type="text" 
                          required 
                          value={manualPIC}
                          className="mt-2 w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                          placeholder="Masukkan nama manual"
                          onChange={e => setManualPIC(e.target.value)}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bukti Nota (Opsional)</label>
                    <div className="flex items-center gap-4">
                      {costReceipt ? (
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden border">
                          <img src={costReceipt} alt="Preview" className="w-full h-full object-cover" />
                          <button type="button" onClick={() => setCostReceipt('')} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg"><X size={12} /></button>
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-gray-100 border-2 border-dashed flex items-center justify-center text-gray-400"><ImageIcon size={24} /></div>
                      )}
                      <input type="file" accept="image/*" ref={receiptInputRef} onChange={handleReceiptUpload} className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                    </div>
                  </div>
                  <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6">
                    <Save size={20} /> {editingCostId ? 'Simpan Perubahan' : 'Simpan Pengeluaran'}
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Daftar Pengeluaran Operasional</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                        <th className="p-4 rounded-tl-xl font-medium">Tanggal</th>
                        <th className="p-4 font-medium">Keterangan</th>
                        <th className="p-4 font-medium">Nominal</th>
                        <th className="p-4 font-medium">PJ</th>
                        <th className="p-4 font-medium">Nota</th>
                        <th className="p-4 rounded-tr-xl font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {operationalCosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((cost) => (
                        <tr key={cost.id} className="hover:bg-blue-50/50">
                          <td className="p-4 text-gray-600">{new Date(cost.date).toLocaleDateString('id-ID')}</td>
                          <td className="p-4 font-medium text-gray-800">{cost.description}</td>
                          <td className="p-4 font-medium text-red-600">{formatCurrency(cost.amount)}</td>
                          <td className="p-4 text-gray-600">{cost.personInCharge}</td>
                          <td className="p-4">
                            {cost.receiptImage ? (
                              <button onClick={() => window.open(cost.receiptImage, '_blank')} className="text-blue-600 hover:underline text-sm">Lihat</button>
                            ) : '-'}
                          </td>
                          <td className="p-4 text-right">
                            <button onClick={() => {
                              setEditingCostId(cost.id);
                              setCostDate(cost.date);
                              setCostDesc(cost.description);
                              setCostAmount(cost.amount.toLocaleString('id-ID'));
                              setCostPIC(cost.personInCharge);
                              setCostReceipt(cost.receiptImage || '');
                            }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">Edit</button>
                            <button onClick={() => handleDeleteCost(cost.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                      {operationalCosts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-gray-500">Belum ada data pengeluaran operasional.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Discrepancies */}
        {activeTab === 'discrepancies' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-blue-800">{editingDiscrepancyId ? 'Edit Selisih' : 'Catat Selisih Kasir'}</h2>
                  {editingDiscrepancyId && <button onClick={resetDiscrepancyForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>}
                </div>
                <form onSubmit={handleSaveDiscrepancy} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal *</label>
                    <input type="date" required value={discDate} onChange={e => setDiscDate(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Selisih *</label>
                    <select value={discType} onChange={e => setDiscType(e.target.value as 'plus' | 'minus')} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 bg-white">
                      <option value="plus">Plus (Uang Lebih)</option>
                      <option value="minus">Minus (Uang Kurang)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nominal (Rp) *</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      required 
                      value={discAmount} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setDiscAmount(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      }} 
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan / Nama Kasir *</label>
                    <input type="text" required value={discNotes} onChange={e => setDiscNotes(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Kasir Budi" />
                  </div>
                  <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6">
                    <Save size={20} /> {editingDiscrepancyId ? 'Simpan Perubahan' : 'Simpan Selisih'}
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Daftar Selisih Kasir</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                        <th className="p-4 rounded-tl-xl font-medium">Tanggal</th>
                        <th className="p-4 font-medium">Jenis</th>
                        <th className="p-4 font-medium">Nominal</th>
                        <th className="p-4 font-medium">Keterangan</th>
                        <th className="p-4 rounded-tr-xl font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {discrepancies.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((disc) => (
                        <tr key={disc.id} className="hover:bg-blue-50/50">
                          <td className="p-4 text-gray-600">{new Date(disc.date).toLocaleDateString('id-ID')}</td>
                          <td className="p-4">
                            {disc.amount >= 0 ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Plus</span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Minus</span>
                            )}
                          </td>
                          <td className={`p-4 font-medium ${disc.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(Math.abs(disc.amount))}
                          </td>
                          <td className="p-4 text-gray-800">{disc.notes}</td>
                          <td className="p-4 text-right">
                            <button onClick={() => {
                              setEditingDiscrepancyId(disc.id);
                              setDiscDate(disc.date);
                              setDiscType(disc.amount >= 0 ? 'plus' : 'minus');
                              setDiscAmount(Math.abs(disc.amount).toLocaleString('id-ID'));
                              setDiscNotes(disc.notes);
                            }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">Edit</button>
                            <button onClick={() => handleDeleteDiscrepancy(disc.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                      {discrepancies.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500">Belum ada data selisih kasir.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Restock */}
        {activeTab === 'restock' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
                <h2 className="text-xl font-bold text-blue-800 mb-6">Input Restok Produk</h2>
                <form onSubmit={handleSaveRestock} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Produk *</label>
                    <select 
                      required 
                      value={restockProductId} 
                      onChange={e => setRestockProductId(e.target.value)} 
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="">-- Pilih Produk --</option>
                      {products.filter(p => !p.isRental && p.type !== 'jasa').map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stok: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total Biaya Restok (Rp) *</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      required 
                      value={restockTotalCost} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setRestockTotalCost(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      }} 
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                      placeholder="Contoh: 5.000.000"
                    />
                  </div>                  {settings.showCostPrice && restockProductId && (products.find(p => p.id === restockProductId)?.unit === 'kg' || products.find(p => p.id === restockProductId)?.unit === 'karung') && (
                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-3">
                      <h3 className="text-xs font-bold text-blue-800 uppercase tracking-wider">Kalkulator Modal & Stok</h3>
                      {products.find(p => p.id === restockProductId)?.unit === 'karung' ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-medium text-blue-700 mb-1">Berapa Karung</label>
                              <input 
                                type="text" 
                                inputMode="numeric"
                                value={restockNumSacks} 
                                onChange={e => setRestockNumSacks(e.target.value.replace(/\D/g, ''))} 
                                className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                                placeholder="Karung"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-medium text-blue-700 mb-1">Kg per Karung</label>
                              <input 
                                type="text" 
                                inputMode="decimal"
                                value={restockWeightPerSack} 
                                onChange={e => setRestockWeightPerSack(e.target.value.replace(/[^\d.,]/g, ''))} 
                                className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                                placeholder="Kg"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[10px] font-medium text-blue-700 mb-1">Harga per Karung</label>
                            <input 
                              type="text" 
                              inputMode="numeric"
                              value={restockPricePerSack} 
                              onChange={e => {
                                const val = e.target.value.replace(/\D/g, '');
                                setRestockPricePerSack(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                              }} 
                              className="w-full px-3 py-1.5 text-sm rounded-lg border" 
                              placeholder="Rp"
                            />
                          </div>
                          {restockNumSacks && restockWeightPerSack && restockPricePerSack && (
                            <button 
                              type="button"
                              onClick={() => {
                                const sacks = parseFloat(restockNumSacks) || 0;
                                const weight = parseFloat(restockWeightPerSack.replace(/,/g, '.')) || 0;
                                const price = parseFloat(restockPricePerSack.replace(/\./g, '')) || 0;
                                const totalWeight = sacks * weight;
                                const totalCost = sacks * price;
                                setRestockTotalCost(totalCost.toLocaleString('id-ID'));
                                setRestockQuantity(totalWeight.toString());
                              }}
                              className="w-full py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Hitung & Gunakan
                            </button>
                          )}
                        </div>
                      ) : (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Total Berat (Kg)</label>
                          <input 
                            type="text" 
                            inputMode="decimal"
                            value={restockTotalWeight} 
                            onChange={e => {
                              const val = e.target.value.replace(/[^\d.,]/g, '');
                              setRestockTotalWeight(val);
                              setRestockQuantity(val);
                            }} 
                            className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                            placeholder="Contoh: 50,5"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Stok Ditambahkan *</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      required 
                      value={restockQuantity} 
                      onChange={e => {
                        const val = e.target.value.replace(/[^\d.,]/g, '');
                        setRestockQuantity(val);
                      }} 
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                      placeholder="Jumlah yang masuk ke stok"
                    />
                  </div>
                  
                  {restockTotalCost && (restockQuantity || restockTotalWeight || restockNumItems) && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <div className="text-sm text-blue-600 mb-1">Harga Modal Satuan (HPP):</div>
                      <div className="text-xl font-bold text-blue-800">
                        {(() => {
                          const cost = parseFloat(restockTotalCost.replace(/\./g, '')) || 0;
                          const qty = parseFloat(restockQuantity.replace(/\./g, '').replace(/,/g, '.')) || 
                                      parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.')) || 
                                      parseFloat(restockNumItems.replace(/\./g, '')) || 1;
                          return formatCurrency(cost / qty);
                        })()}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tetapkan Harga Jual Baru (Rp) *</label>
                    <input 
                      type="text" 
                      inputMode="numeric"
                      required 
                      value={restockSellingPrice} 
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setRestockSellingPrice(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      }} 
                      className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                      placeholder="Contoh: 15.000"
                    />
                  </div>

                  {restockTotalCost && (restockQuantity || restockTotalWeight || restockNumItems) && restockSellingPrice && (
                    <div className={`p-4 rounded-xl border ${
                      (() => {
                        const cost = parseFloat(restockTotalCost.replace(/\./g, '')) || 0;
                        const qty = parseFloat(restockQuantity.replace(/\./g, '').replace(/,/g, '.')) || 
                                    parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.')) || 
                                    parseFloat(restockNumItems.replace(/\./g, '')) || 1;
                        const unitCost = cost / qty;
                        const sellingPrice = parseFloat(restockSellingPrice.replace(/\./g, ''));
                        return sellingPrice >= unitCost ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100';
                      })()
                    }`}>
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${
                          (() => {
                            const cost = parseFloat(restockTotalCost.replace(/\./g, '')) || 0;
                            const qty = parseFloat(restockQuantity.replace(/\./g, '').replace(/,/g, '.')) || 
                                        parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.')) || 
                                        parseFloat(restockNumItems.replace(/\./g, '')) || 1;
                            const unitCost = cost / qty;
                            const sellingPrice = parseFloat(restockSellingPrice.replace(/\./g, ''));
                            return sellingPrice >= unitCost ? 'text-green-600' : 'text-red-600';
                          })()
                        }`}>Persentase Keuntungan:</span>
                        <span className={`font-bold ${
                          (() => {
                            const cost = parseFloat(restockTotalCost.replace(/\./g, '')) || 0;
                            const qty = parseFloat(restockQuantity.replace(/\./g, '').replace(/,/g, '.')) || 
                                        parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.')) || 
                                        parseFloat(restockNumItems.replace(/\./g, '')) || 1;
                            const unitCost = cost / qty;
                            const sellingPrice = parseFloat(restockSellingPrice.replace(/\./g, ''));
                            return sellingPrice >= unitCost ? 'text-green-700' : 'text-red-700';
                          })()
                        }`}>
                          {(() => {
                            const cost = parseFloat(restockTotalCost.replace(/\./g, '')) || 0;
                            const qty = parseFloat(restockQuantity.replace(/\./g, '').replace(/,/g, '.')) || 
                                        parseFloat(restockTotalWeight.replace(/\./g, '').replace(/,/g, '.')) || 
                                        parseFloat(restockNumItems.replace(/\./g, '')) || 1;
                            const unitCost = cost / qty;
                            const sellingPrice = parseFloat(restockSellingPrice.replace(/\./g, ''));
                            return (((sellingPrice - unitCost) / unitCost) * 100).toFixed(2);
                          })()}%
                        </span>
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6">
                    <Save size={20} /> Simpan & Update Stok
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Riwayat Restok</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                        <th className="p-4 rounded-tl-xl font-medium">Tanggal</th>
                        <th className="p-4 font-medium">Produk</th>
                        <th className="p-4 font-medium">Qty</th>
                        <th className="p-4 font-medium">Total Biaya</th>
                        <th className="p-4 font-medium">Modal/Item</th>
                        <th className="p-4 font-medium">Harga Jual</th>
                        <th className="p-4 rounded-tr-xl font-medium">Profit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {restockRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-blue-50/50">
                          <td className="p-4 text-gray-600 text-sm">{new Date(record.date).toLocaleDateString('id-ID')}</td>
                          <td className="p-4 font-medium text-gray-800">{record.productName}</td>
                          <td className="p-4 text-gray-600">{record.quantity}</td>
                          <td className="p-4 font-medium text-red-600">{formatCurrency(record.totalCost)}</td>
                          <td className="p-4 text-gray-600">{formatCurrency(record.unitCost)}</td>
                          <td className="p-4 font-medium text-blue-600">{formatCurrency(record.newSellingPrice)}</td>
                          <td className="p-4">
                            <span className={`${record.profitPercentage >= 0 ? 'text-green-600' : 'text-red-600'} font-bold`}>
                              {record.profitPercentage.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                      {restockRecords.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-gray-500">Belum ada riwayat restok.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Staff */}
        {activeTab === 'staff' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-8">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-blue-800">{editingStaffId ? 'Edit Staff' : 'Tambah Staff'}</h2>
                  {editingStaffId && <button onClick={resetStaffForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>}
                </div>
                <form onSubmit={handleSaveStaff} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nama Staff *</label>
                    <input type="text" required value={staffName} onChange={e => setStaffName(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" placeholder="Contoh: Budi" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">PIN Login (4-6 Digit) *</label>
                    <input type="password" required value={staffPin} onChange={e => setStaffPin(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" placeholder="PIN Rahasia" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon (Opsional)</label>
                    <input type="text" value={staffPhone} onChange={e => setStaffPhone(e.target.value)} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" placeholder="0812..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Peran / Role Staff *</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'admin', label: 'Administrator' },
                        { id: 'kasir', label: 'Kasir' },
                        { id: 'driver', label: 'Driver' },
                        { id: 'pj', label: 'PJ Operasional' },
                      ].map(role => (
                        <label key={role.id} className="flex items-center gap-2 p-2 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                          <input 
                            type="checkbox" 
                            checked={staffRoles.includes(role.id as any)} 
                            onChange={() => {
                              if (staffRoles.includes(role.id as any)) {
                                setStaffRoles(staffRoles.filter(r => r !== role.id));
                              } else {
                                setStaffRoles([...staffRoles, role.id as any]);
                              }
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-xs font-medium text-gray-700">{role.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button type="submit" className="w-full flex justify-center items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6">
                    <Save size={20} /> {editingStaffId ? 'Simpan Perubahan' : 'Tambah Staff'}
                  </button>
                </form>
              </div>
            </div>
            <div className="lg:col-span-2">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold text-gray-800 mb-6">Daftar Staff Toko</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                        <th className="p-4 rounded-tl-xl font-medium">Nama</th>
                        <th className="p-4 font-medium">Peran</th>
                        <th className="p-4 font-medium">Telepon</th>
                        <th className="p-4 rounded-tr-xl font-medium text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {staff.map((s) => (
                        <tr key={s.id} className="hover:bg-blue-50/50">
                          <td className="p-4">
                            <div className="font-bold text-gray-800">{s.name}</div>
                            <div className="text-[10px] text-gray-400 uppercase tracking-widest">ID: {s.id.slice(0, 8)}</div>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {s.roles.map(role => (
                                <span key={role} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-gray-600">{s.phone || '-'}</td>
                          <td className="p-4 text-right">
                            <button onClick={() => {
                              setEditingStaffId(s.id);
                              setStaffName(s.name);
                              setStaffPin(s.pin);
                              setStaffPhone(s.phone || '');
                              setStaffRoles(s.roles);
                            }} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg">Edit</button>
                            <button onClick={() => handleDeleteStaff(s.id)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg"><Trash2 size={18} /></button>
                          </td>
                        </tr>
                      ))}
                      {staff.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-500">Belum ada staff terdaftar.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: Settings */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-xl font-bold text-blue-800 mb-6">Pengaturan Toko</h2>
              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pemilik</label>
                  <input type="text" required value={settings.ownerName} onChange={e => setSettings({...settings, ownerName: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Toko</label>
                  <input type="text" required value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Toko</label>
                  <textarea required value={settings.address} onChange={e => setSettings({...settings, address: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" rows={3} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon Toko</label>
                  <input type="text" required value={settings.phone} onChange={e => setSettings({...settings, phone: e.target.value})} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input 
                      type="checkbox" 
                      id="showCostPrice"
                      checked={!!settings.showCostPrice} 
                      onChange={e => setSettings({...settings, showCostPrice: e.target.checked})}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="showCostPrice" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Kalkulator Modal
                    </label>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <input 
                      type="checkbox" 
                      id="showSellingOptions"
                      checked={!!settings.showSellingOptions} 
                      onChange={e => setSettings({...settings, showSellingOptions: e.target.checked})}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="showSellingOptions" className="text-sm font-medium text-gray-700 cursor-pointer">
                      Opsi Jual (Gram)
                    </label>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <Package size={18} className="text-blue-600" /> Kategori Produk Aktif
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <input 
                        type="checkbox" 
                        id="enableBarang"
                        checked={!!settings.enableBarang} 
                        onChange={e => setSettings({...settings, enableBarang: e.target.checked})}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableBarang" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Barang
                      </label>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <input 
                        type="checkbox" 
                        id="enableJasa"
                        checked={!!settings.enableJasa} 
                        onChange={e => setSettings({...settings, enableJasa: e.target.checked})}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableJasa" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Jasa/Rental
                      </label>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                      <input 
                        type="checkbox" 
                        id="enableMakanan"
                        checked={!!settings.enableMakanan} 
                        onChange={e => setSettings({...settings, enableMakanan: e.target.checked})}
                        className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="enableMakanan" className="text-sm font-medium text-gray-700 cursor-pointer">
                        Makanan
                      </label>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    type="button"
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Edit Biodata Toko',
                        message: 'Apakah Anda ingin menyimpan perubahan pada biodata toko?',
                        variant: 'info',
                        onConfirm: () => {
                          handleSaveSettings(new Event('submit') as any);
                        }
                      });
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-700 font-bold rounded-xl border border-blue-100 hover:bg-blue-100 transition-all"
                  >
                    <Edit2 size={18} /> Edit Biodata
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      const newPass = prompt('Masukkan Password Baru:');
                      if (newPass) {
                        setSettings({...settings, adminPassword: newPass});
                        alert('Password berhasil diubah (Klik Simpan untuk permanen)');
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-2.5 bg-orange-50 text-orange-700 font-bold rounded-xl border border-orange-100 hover:bg-orange-100 transition-all"
                  >
                    <ShieldCheck size={18} /> Ganti Password
                  </button>
                </div>

                <div className="space-y-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                    <DollarSign size={18} className="text-green-600" /> Manajemen Modal
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Modal Investasi Saat Ini</label>
                      <div className="text-xl font-black text-gray-900">{formatCurrency(settings.initialInvestment || 0)}</div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        const amount = prompt('Masukkan Jumlah Modal Tambahan (Rp):');
                        if (amount) {
                          const val = parseInt(amount.replace(/\D/g, ''), 10);
                          if (!isNaN(val)) {
                            setSettings({...settings, initialInvestment: (settings.initialInvestment || 0) + val});
                            alert('Modal berhasil ditambahkan!');
                          }
                        }
                      }}
                      className="px-4 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors text-sm"
                    >
                      {settings.initialInvestment ? 'Tambah Modal' : 'Input Modal Awal'}
                    </button>
                  </div>
                </div>
                <div className="pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ubah Password Admin</label>
                  <input type="password" placeholder="Kosongkan jika tidak ingin diubah" onChange={e => {
                    if (e.target.value) setSettings({...settings, adminPassword: e.target.value});
                  }} className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="pt-6 border-t border-gray-100 space-y-4">
                  <h3 className="text-lg font-bold text-blue-800 flex items-center gap-2">
                    <Cloud size={20} /> Sinkronisasi Cloud (API)
                  </h3>
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
                    <input 
                      type="checkbox" 
                      id="syncEnabled"
                      checked={!!settings.syncEnabled} 
                      onChange={e => setSettings({...settings, syncEnabled: e.target.checked})}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="syncEnabled" className="text-sm font-medium text-blue-800 cursor-pointer">
                      Aktifkan Sinkronisasi Otomatis (Setiap Jam)
                    </label>
                  </div>

                  {settings.syncEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipe API</label>
                        <select 
                          value={settings.apiType || 'supabase'} 
                          onChange={e => setSettings({...settings, apiType: e.target.value as any})}
                          className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="supabase">Supabase</option>
                          <option value="google-sheets">Google Sheets (Apps Script)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                        <input 
                          type="url" 
                          value={settings.apiUrl || ''} 
                          onChange={e => setSettings({...settings, apiUrl: e.target.value})}
                          placeholder="https://..."
                          className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">API Key / Token</label>
                        <input 
                          type="password" 
                          value={settings.apiKey || ''} 
                          onChange={e => setSettings({...settings, apiKey: e.target.value})}
                          placeholder="Masukkan API Key"
                          className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-blue-500" 
                        />
                      </div>
                      {settings.lastSync && (
                        <p className="text-xs text-gray-500 italic">
                          Terakhir sinkron: {new Date(settings.lastSync).toLocaleString('id-ID')}
                        </p>
                      )}
                      <button 
                        type="button"
                        onClick={async () => {
                          const success = await syncDataToCloud(settings);
                          if (success) {
                            alert('Sinkronisasi berhasil!');
                            setSettings({...settings, lastSync: new Date().toISOString()});
                          } else {
                            alert('Sinkronisasi gagal. Periksa URL dan API Key Anda.');
                          }
                        }}
                        className="w-full py-2 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200 transition-colors flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={16} /> Sinkron Sekarang
                      </button>
                    </div>
                  )}
                </div>

                {/* Backup & Restore Data */}
<div className="pt-6 border-t border-gray-100">
  <h3 className="text-lg font-bold text-blue-800 mb-4">
    Backup & Restore Data
  </h3>

  <div className="flex gap-3">
    <button
      type="button"
      onClick={handleBackupData}
      className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold"
    >
      Backup Data
    </button>

    <label className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold cursor-pointer">
      Import Data
      <input
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportData}
      />
    </label>
  </div>
  </div>
                <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6">
                  <Save size={20} className="inline mr-2" /> Simpan Pengaturan
                </button>
              </form>
            </div>

            <div className="bg-red-50 p-6 rounded-2xl shadow-sm border border-red-100 mt-8">
              <h2 className="text-xl font-bold text-red-800 mb-2">Zona Berbahaya</h2>
              <p className="text-sm text-red-600 mb-6">Tindakan di bawah ini tidak dapat dibatalkan. Harap berhati-hati.</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-red-800 uppercase mb-1">Ketik "confirm" untuk membuka fitur extra:</label>
                  <input 
                    type="text" 
                    placeholder='Ketik "confirm"'
                    className="w-full px-4 py-2 rounded-lg border border-red-200 focus:ring-2 focus:ring-red-500 text-sm"
                    onChange={(e) => setConfirmText(e.target.value)}
                  />
                </div>

                <button 
                  disabled={confirmText !== 'confirm'}
                  onClick={handleResetTransactions}
                  className={`w-full font-bold py-3 rounded-xl flex items-center justify-center transition-all ${
                    confirmText === 'confirm' ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw size={20} className="mr-2" /> Reset Data Transaksi
                </button>

                <button 
                  disabled={confirmText !== 'confirm'}
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Hapus Semua Data',
                      message: 'PERINGATAN: Apakah Anda yakin ingin menghapus SEMUA data aplikasi? Ini termasuk produk, transaksi, kasir, driver, dan laporan keuangan. Data tidak dapat dikembalikan!',
                      variant: 'danger',
                      onConfirm: () => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Konfirmasi Terakhir',
                          message: 'Apakah Anda BENAR-BENAR yakin? Tindakan ini akan mereset aplikasi sepenuhnya.',
                          variant: 'danger',
                          onConfirm: () => {
                            clearAllData();
                            window.location.reload();
                          }
                        });
                      }
                    });
                  }}
                  className={`w-full font-bold py-3 rounded-xl flex items-center justify-center transition-all ${
                    confirmText === 'confirm' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Trash2 size={20} className="mr-2" /> Hapus Semua Data Aplikasi
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return (Retur) Modal */}
        {showReturnModal && returnTransaction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-4 border-b flex justify-between items-center bg-orange-50">
                <div className="flex items-center gap-2 text-orange-800">
                  <RefreshCw size={20} />
                  <h3 className="font-bold">Proses Retur Barang</h3>
                </div>
                <button onClick={() => setShowReturnModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-4 overflow-y-auto flex-1 space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-500">ID Transaksi:</span>
                    <span className="font-mono font-bold">#{returnTransaction.id.slice(-8)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Transaksi:</span>
                    <span className="font-bold text-blue-600">{formatCurrency(returnTransaction.total)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-bold text-gray-700">Pilih Barang yang Dikembalikan:</label>
                    <button 
                      onClick={() => {
                        const allSelected: Record<string, number> = {};
                        returnTransaction.items.forEach(item => {
                          const alreadyReturned = returnTransaction.returnedItems?.find(ri => ri.itemId === item.id)?.quantity || 0;
                          const available = item.quantity - alreadyReturned;
                          if (available > 0) allSelected[item.id] = available;
                        });
                        setSelectedReturnItems(allSelected);
                      }}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      Pilih Semua
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    {returnTransaction.items.filter(item => item.type === 'barang' || !item.type).map(item => {
                      const alreadyReturned = returnTransaction.returnedItems?.find(ri => ri.itemId === item.id)?.quantity || 0;
                      const available = item.quantity - alreadyReturned;
                      
                      if (available <= 0) return null;

                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 border rounded-xl hover:bg-gray-50 transition-colors">
                          <input 
                            type="checkbox"
                            checked={!!selectedReturnItems[item.id]}
                            onChange={(e) => {
                              const newSelected = { ...selectedReturnItems };
                              if (e.target.checked) {
                                newSelected[item.id] = available;
                              } else {
                                delete newSelected[item.id];
                              }
                              setSelectedReturnItems(newSelected);
                            }}
                            className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold text-gray-800 truncate">{item.name}</div>
                            <div className="text-[10px] text-gray-500">Tersedia untuk retur: {available} {item.unit}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                const newSelected = { ...selectedReturnItems };
                                if (newSelected[item.id] > 1) newSelected[item.id] -= 1;
                                setSelectedReturnItems(newSelected);
                              }}
                              disabled={!selectedReturnItems[item.id] || selectedReturnItems[item.id] <= 1}
                              className="p-1 bg-gray-100 rounded disabled:opacity-30"
                            >
                              <Minus size={12} />
                            </button>
                            <span className="text-sm font-bold w-6 text-center">{selectedReturnItems[item.id] || 0}</span>
                            <button 
                              onClick={() => {
                                const newSelected = { ...selectedReturnItems };
                                if (newSelected[item.id] < available) newSelected[item.id] = (newSelected[item.id] || 0) + 1;
                                setSelectedReturnItems(newSelected);
                              }}
                              disabled={!selectedReturnItems[item.id] || selectedReturnItems[item.id] >= available}
                              className="p-1 bg-gray-100 rounded disabled:opacity-30"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {returnTransaction.items.some(item => item.type === 'makanan' || item.type === 'jasa') && (
                      <div className="p-3 bg-red-50 text-red-600 text-[10px] rounded-lg border border-red-100 italic">
                        * Item makanan dan jasa tidak dapat dikembalikan (Non-Refundable).
                      </div>
                    )}
                  </div>
                </div>

                {Object.keys(selectedReturnItems).length > 0 && (
                  <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Total Harga Barang:</span>
                      <span className="font-bold">
                        {formatCurrency(Object.entries(selectedReturnItems).reduce((sum, [id, qty]) => {
                          const item = returnTransaction.items.find(i => i.id === id);
                          return sum + (item ? item.finalPrice * qty : 0);
                        }, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Potongan Admin (10%):</span>
                      <span>
                        -{formatCurrency(Object.entries(selectedReturnItems).reduce((sum, [id, qty]) => {
                          const item = returnTransaction.items.find(i => i.id === id);
                          return sum + (item ? (item.finalPrice * qty) * 0.1 : 0);
                        }, 0))}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-orange-200 flex justify-between items-center">
                      <span className="text-sm font-bold text-orange-800">Uang Kembali (Refund):</span>
                      <span className="text-lg font-black text-orange-600">
                        {formatCurrency(Object.entries(selectedReturnItems).reduce((sum, [id, qty]) => {
                          const item = returnTransaction.items.find(i => i.id === id);
                          return sum + (item ? (item.finalPrice * qty) * 0.9 : 0);
                        }, 0))}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 border-t bg-gray-50 flex gap-3">
                <button 
                  onClick={() => setShowReturnModal(false)}
                  className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button 
                  onClick={handleProcessReturn}
                  disabled={Object.keys(selectedReturnItems).length === 0}
                  className="flex-[2] py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-orange-700 disabled:opacity-50 disabled:shadow-none transition-all"
                >
                  Proses Retur & Refund
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Custom Confirmation Modal */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          variant={confirmModal.variant}
          isAlert={confirmModal.isAlert}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        />
      </div>
    </div>
  );
}
