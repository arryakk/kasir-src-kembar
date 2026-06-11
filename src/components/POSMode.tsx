import React, { useState, useEffect, useRef } from 'react';
import { Product, CartItem, Transaction, StoreSettings, Driver, DeliveryInfo, RentalInfo } from '../types';
import { getProducts, saveTransaction, getStoreSettings, getDrivers, getTransactions, cancelTransaction, updateTransactionStatus, updateTransactionDriver, processReturn } from '../storage';
import { calculateDiscountedPrice, formatCurrency, terbilang, formatPhoneForWA, resizeImage } from '../utils';
import { Search, ShoppingCart, Trash2, Plus, Minus, Printer, Settings, Image as ImageIcon, CreditCard, Banknote, Truck, Store, Percent, LogOut, History, Upload, ChevronLeft, ChevronRight, ShoppingBag, Copy, MessageCircle, Bluetooth, CheckCircle, User, AlertTriangle, RotateCcw } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import { syncDataToCloud } from '../services/syncService';

const generateTextReceipt = (trx: Transaction, store: StoreSettings) => {
  let text = `${store.name}\n`;
  text += `${store.address}\n`;
  text += `Telp: ${store.phone}\n`;
  text += `--------------------------------\n`;
  text += `No: ${trx.id}\n`;
  text += `Tgl: ${new Date(trx.date).toLocaleString('id-ID')}\n`;
  text += `Kasir: ${trx.cashierName}\n`;
  if (trx.customerName) text += `Pelanggan: ${trx.customerName}\n`;
  text += `Metode: ${trx.paymentMethod.toUpperCase()}\n`;
  if (trx.status === 'pending') text += `STATUS: BELUM LUNAS (COD)\n`;
  if (trx.delivery) {
    text += `Driver: ${trx.delivery.driverName}\n`;
    if (trx.deliveryFee && trx.deliveryFee > 0) text += `Ongkir: ${formatCurrency(trx.deliveryFee)}\n`;
  }
  text += `--------------------------------\n`;
  trx.items.forEach(item => {
    text += `${item.name}\n`;
    text += `${item.quantity} x ${formatCurrency(item.finalPrice)} = ${formatCurrency(item.quantity * item.finalPrice)}\n`;
  });
  text += `--------------------------------\n`;
  text += `Subtotal: ${formatCurrency(trx.subtotal)}\n`;
  if (trx.cartDiscount > 0) text += `Diskon: -${formatCurrency(trx.cartDiscount)}\n`;
  if (trx.deliveryFee && trx.deliveryFee > 0) text += `Ongkir: ${formatCurrency(trx.deliveryFee)}\n`;
  text += `TOTAL: ${formatCurrency(trx.total)}\n`;
  text += `DIBAYAR: ${formatCurrency(trx.payment)}\n`;
  if (trx.paymentMethod === 'cash') text += `KEMBALI: ${formatCurrency(trx.change)}\n`;
  text += `--------------------------------\n`;
  text += `Terima Kasih\n`;
  return text;
};

interface POSModeProps {
  cashierName: string;
  onLogout: () => void;
}

export default function POSMode({ cashierName, onLogout }: POSModeProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [storeSettings, setStoreSettings] = useState<StoreSettings>({ isSetupComplete: true, ownerName: '', name: '', address: '', phone: '' });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Transaction Details
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'dine-in' | 'delivery'>('dine-in');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'cod'>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [cartDiscount, setCartDiscount] = useState('');
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [qrisProof, setQrisProof] = useState('');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [cashierTransactions, setCashierTransactions] = useState<Transaction[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const totalPages = Math.ceil(products.length / itemsPerPage);
  const currentProducts = products.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  // Delivery Details
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');

  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  
  // Return System States
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedReturnTrx, setSelectedReturnTrx] = useState<Transaction | null>(null);
  const [returnItems, setReturnItems] = useState<{[key: string]: number}>({});
  const [returnAll, setReturnAll] = useState(false);
  
  // Mobile UI State
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  
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
  
  // Weight Input Modal
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<Product | null>(null);
  const [weightInput, setWeightInput] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'gram'>('kg');

  // Rental Input Modal
  const [showRentalModal, setShowRentalModal] = useState(false);
  const [selectedRentalProduct, setSelectedRentalProduct] = useState<Product | null>(null);
  const [rentalBorrowerName, setRentalBorrowerName] = useState('');
  const [rentalBorrowerPhone, setRentalBorrowerPhone] = useState('');
  const [rentalStartDate, setRentalStartDate] = useState(new Date().toISOString().slice(0, 16));
  const [rentalEndDate, setRentalEndDate] = useState(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProducts(getProducts());
    setDrivers(getDrivers());
    setStoreSettings(getStoreSettings());
  }, []);

  useEffect(() => {
    if ((searchQuery || '').trim() === '') {
      setFilteredProducts([]);
    } else {
      const query = searchQuery.toLowerCase();
      const matches = products.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(query);
        const typeEnabled = (p.type === 'barang' && storeSettings.enableBarang) ||
                            (p.type === 'jasa' && storeSettings.enableJasa) ||
                            (p.type === 'makanan' && storeSettings.enableMakanan) ||
                            (!p.type && storeSettings.enableBarang); // Default to barang if no type
        const stockAvailable = p.type === 'barang' || !p.type ? p.stock > 0 : true;
        return nameMatch && typeEnabled && stockAvailable;
      });
      setFilteredProducts(matches);
    }
  }, [searchQuery, products]);

  // Handle Order Type Change
  useEffect(() => {
    if (orderType === 'delivery') {
      setPaymentMethod('cod');
    } else {
      setPaymentMethod('cash');
    }
  }, [orderType]);

  const addToCart = (product: Product) => {
    if ((product.type === 'barang' || !product.type) && product.stock <= 0) return;
    
    if (product.unit === 'kg') {
      setSelectedWeightProduct(product);
      setWeightInput('');
      // Default unit based on product setting
      setWeightUnit(product.sellInGram ? 'gram' : 'kg');
      setShowWeightModal(true);
      return;
    }

    if (product.isRental) {
      setSelectedRentalProduct(product);
      setRentalBorrowerName('');
      setRentalBorrowerPhone('');
      const now = new Date();
      setRentalStartDate(now.toISOString().slice(0, 16));
      const later = new Date(now.getTime() + (product.rentalSettings?.periodUnit === 'hour' ? 3600000 : 86400000));
      setRentalEndDate(later.toISOString().slice(0, 16));
      setShowRentalModal(true);
      return;
    }

    const finalPrice = calculateDiscountedPrice(product.price, product.discount);
    
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if ((product.type === 'barang' || !product.type) && existing.quantity >= product.stock) {
          setConfirmModal({
            isOpen: true,
            title: 'Stok Tidak Cukup',
            message: `Stok ${product.name} tidak cukup! (Sisa: ${product.stock})`,
            variant: 'warning',
            isAlert: true,
            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
          });
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, finalPrice }];
    });
    
    setSearchQuery('');
  };

  const handleWeightSubmit = () => {
    if (!selectedWeightProduct) return;
    const inputVal = parseFloat(weightInput.replace(',', '.'));
    if (isNaN(inputVal) || inputVal <= 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Input Tidak Valid',
        message: 'Masukkan berat yang valid',
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const quantityInKg = weightUnit === 'gram' ? inputVal / 1000 : inputVal;
    
    if (quantityInKg > selectedWeightProduct.stock) {
      setConfirmModal({
        isOpen: true,
        title: 'Stok Tidak Cukup',
        message: `Stok ${selectedWeightProduct.name} tidak cukup! (Sisa: ${selectedWeightProduct.stock} kg)`,
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const finalPrice = calculateDiscountedPrice(selectedWeightProduct.price, selectedWeightProduct.discount);

    setCart(prev => {
      const existing = prev.find(item => item.id === selectedWeightProduct.id);
      if (existing) {
        const newTotalQty = existing.quantity + quantityInKg;
        if (newTotalQty > selectedWeightProduct.stock) {
          setConfirmModal({
            isOpen: true,
            title: 'Stok Tidak Cukup',
            message: `Total stok ${selectedWeightProduct.name} tidak cukup! (Sisa: ${selectedWeightProduct.stock} kg)`,
            variant: 'warning',
            isAlert: true,
            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
          });
          return prev;
        }
        return prev.map(item => item.id === selectedWeightProduct.id ? { ...item, quantity: newTotalQty } : item);
      }
      return [...prev, { ...selectedWeightProduct, quantity: quantityInKg, finalPrice }];
    });

    setShowWeightModal(false);
    setSelectedWeightProduct(null);
    setSearchQuery('');
  };

  const handleRentalSubmit = () => {
    if (!selectedRentalProduct) return;
    if (!rentalBorrowerName) {
      setConfirmModal({
        isOpen: true,
        title: 'Input Tidak Lengkap',
        message: 'Nama peminjam wajib diisi!',
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    if (selectedRentalProduct.rentalSettings?.requirePhone && !rentalBorrowerPhone) {
      setConfirmModal({
        isOpen: true,
        title: 'Input Tidak Lengkap',
        message: 'Nomor HP peminjam wajib diisi!',
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const start = new Date(rentalStartDate);
    const end = new Date(rentalEndDate);
    if (end <= start) {
      setConfirmModal({
        isOpen: true,
        title: 'Waktu Tidak Valid',
        message: 'Waktu selesai harus setelah waktu mulai!',
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const diffMs = end.getTime() - start.getTime();
    let duration = 0;
    if (selectedRentalProduct.rentalSettings?.periodUnit === 'hour') {
      duration = Math.ceil(diffMs / 3600000);
    } else {
      duration = Math.ceil(diffMs / 86400000);
    }

    const finalPrice = calculateDiscountedPrice(selectedRentalProduct.price, selectedRentalProduct.discount);

    const rentalInfo: RentalInfo = {
      borrowerName: rentalBorrowerName,
      borrowerPhone: rentalBorrowerPhone || undefined,
      startDate: rentalStartDate,
      endDate: rentalEndDate,
      duration,
      periodUnit: selectedRentalProduct.rentalSettings?.periodUnit || 'day'
    };

    setCart(prev => [...prev, { ...selectedRentalProduct, quantity: duration, finalPrice, rentalInfo }]);
    setShowRentalModal(false);
    setSelectedRentalProduct(null);
    setSearchQuery('');
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const product = products.find(p => p.id === id);
        const maxStock = product ? product.stock : 0;
        
        // For kg, delta is usually 1 from the buttons, but let's make it 0.1 for kg
        const actualDelta = item.unit === 'kg' ? delta * 0.1 : delta;
        let newQuantity = item.quantity + actualDelta;
        
        // Fix floating point issues
        newQuantity = Math.round(newQuantity * 1000) / 1000;
        
        // Minimum quantity is 0.1 for kg, 1 for others
        const minQty = item.unit === 'kg' ? 0.1 : 1;
        newQuantity = Math.max(minQty, Math.min(newQuantity, maxStock));
        
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotalAmount = cart.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
  const discountValue = parseFloat(cartDiscount.replace(/\./g, '')) || 0;
  const deliveryFeeValue = orderType === 'delivery' ? (parseFloat(deliveryFee.replace(/\./g, '')) || 0) : 0;
  const totalAmount = Math.max(0, subtotalAmount - discountValue + deliveryFeeValue);
  
  const payment = paymentMethod === 'cash' ? (parseFloat(paymentAmount.replace(/\./g, '')) || 0) : totalAmount;
  const change = payment - totalAmount;

  const handlePreCheckout = () => {
    if (cart.length === 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Keranjang Kosong',
        message: 'Keranjang belanja Anda masih kosong!',
        variant: 'info',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    setShowCheckoutModal(true);
  };

  const handleQrisProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resized = await resizeImage(reader.result as string);
        setQrisProof(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const openHistory = () => {
    const allTrx = getTransactions();
    const myTrx = allTrx.filter(t => t.cashierName === cashierName).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setCashierTransactions(myTrx);
    setShowHistoryModal(true);
  };

  const handleOpenReturnModal = (trx: Transaction) => {
    setSelectedReturnTrx(trx);
    const initialReturns: {[key: string]: number} = {};
    trx.items.forEach(item => {
      initialReturns[item.id] = 0;
    });
    setReturnItems(initialReturns);
    setReturnAll(false);
    setIsReturnModalOpen(true);
  };

  const toggleReturnAll = () => {
    if (!selectedReturnTrx) return;
    const newReturnAll = !returnAll;
    setReturnAll(newReturnAll);
    const newReturns: {[key: string]: number} = {};
    selectedReturnTrx.items.forEach(item => {
      newReturns[item.id] = newReturnAll ? item.quantity : 0;
    });
    setReturnItems(newReturns);
  };

  const handleItemReturnQtyChange = (itemId: string, qty: number, max: number) => {
    setReturnItems(prev => ({
      ...prev,
      [itemId]: Math.max(0, Math.min(qty, max))
    }));
    setReturnAll(false);
  };

  const handleProcessReturn = () => {
    if (!selectedReturnTrx) return;

    const itemsToReturn = selectedReturnTrx.items.filter(item => returnItems[item.id] > 0);
    if (itemsToReturn.length === 0) return;

    // Calculate refund amount (excluding delivery fee)
    // Formula: (Price * Qty) - 10%
    let refundAmount = 0;
    itemsToReturn.forEach(item => {
      const qty = returnItems[item.id];
      const itemTotal = item.price * qty;
      refundAmount += itemTotal * 0.9; // 10% deduction
    });

    setConfirmModal({
      isOpen: true,
      title: 'Konfirmasi Pengembalian',
      message: `Total pengembalian dana: ${formatCurrency(refundAmount)}. Biaya antar tidak dapat di-refund. Nota lama akan dihapus dan nota baru akan dibuat untuk sisa item. Lanjutkan?`,
      variant: 'warning',
      onConfirm: () => {
        const newTx = processReturn(selectedReturnTrx.id, returnItems);
        setIsReturnModalOpen(false);
        setSelectedReturnTrx(null);
        setProducts(getProducts());
        
        if (newTx) {
          // Show the new receipt
          setLastTransaction(newTx);
          setShowReceipt(true);
        } else {
          // All items returned, just refresh history
          openHistory();
        }
        
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCheckout = () => {
    if (orderType === 'delivery') {
      if (!customerName || !deliveryAddress || !deliveryPhone || !selectedDriverId) {
        setConfirmModal({
          isOpen: true,
          title: 'Data Belum Lengkap',
          message: 'Lengkapi data pengantaran (Nama, Alamat, No HP, Driver)!',
          variant: 'warning',
          isAlert: true,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }
    
    if (paymentMethod === 'cash') {
      const paymentVal = parseFloat(paymentAmount.replace(/\./g, '')) || 0;
      if (paymentVal < totalAmount) {
        setConfirmModal({
          isOpen: true,
          title: 'Pembayaran Kurang',
          message: 'Jumlah pembayaran tunai kurang dari total belanja!',
          variant: 'warning',
          isAlert: true,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }
    
    if (paymentMethod === 'qris' && !storeSettings.syncEnabled) {
      setConfirmModal({
        isOpen: true,
        title: 'Metode Tidak Tersedia',
        message: 'Pembayaran QRIS hanya tersedia jika sinkronisasi data aktif!',
        variant: 'danger',
        isAlert: true,
        onConfirm: () => {
          setPaymentMethod('cash');
          setConfirmModal(prev => ({ ...prev, isOpen: false }));
        }
      });
      return;
    }

    if (paymentMethod === 'qris' && !qrisProof) {
      setConfirmModal({
        isOpen: true,
        title: 'Bukti Pembayaran',
        message: 'Harap unggah bukti pembayaran QRIS!',
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    
    const finalPayment = paymentMethod === 'cash' ? (parseFloat(paymentAmount.replace(/\./g, '')) || 0) : totalAmount;
    const finalChange = paymentMethod === 'cash' ? finalPayment - totalAmount : 0;
    
    let deliveryInfo: DeliveryInfo | undefined;
    let driver: Driver | undefined;
    
    if (orderType === 'delivery') {
      driver = drivers.find(d => d.id === selectedDriverId);
      deliveryInfo = {
        customerName,
        address: deliveryAddress,
        phone: deliveryPhone,
        driverId: selectedDriverId,
        driverName: driver?.name || 'Unknown',
        fee: deliveryFeeValue
      };
    }

    const transaction: Transaction = {
      id: `TRX-${Date.now()}`,
      date: new Date().toISOString(),
      cashierName,
      customerName: customerName || undefined,
      items: [...cart],
      subtotal: subtotalAmount,
      cartDiscount: discountValue,
      total: totalAmount,
      paymentMethod,
      payment: finalPayment,
      change: finalChange,
      qrisProof: paymentMethod === 'qris' ? qrisProof : undefined,
      delivery: deliveryInfo,
      deliveryFee: deliveryFeeValue,
      status: paymentMethod === 'cod' ? 'pending' : 'completed'
    };

    saveTransaction(transaction);
    setLastTransaction(transaction);
    setShowCheckoutModal(false);
    setShowReceipt(true);
    setIsMobileCartOpen(false);
    
    // Update local products stock
    setProducts(getProducts());

    // Sync to cloud if enabled
    if (storeSettings.syncEnabled) {
      syncDataToCloud(storeSettings);
    }

    // Send WA Message if COD Delivery
    if (orderType === 'delivery' && driver) {
      const waPhone = formatPhoneForWA(driver.phone);
      const itemsText = cart.map(i => `- ${i.quantity}x ${i.name}`).join('\n');
      const msg = `Halo ${driver.name}, ada pesanan baru!\n\n*No TRX:* ${transaction.id}\n*Tanggal:* ${new Date(transaction.date).toLocaleString('id-ID')}\n\n*Pelanggan:* ${customerName}\n*Alamat:* ${deliveryAddress}\n*No HP:* ${deliveryPhone}\n\n*Pesanan:*\n${itemsText}\n\n*Total Tagihan (COD):* ${formatCurrency(totalAmount)}\n\nMohon segera diproses. Terima kasih!`;
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
    
    // Reset
    setCart([]);
    setPaymentAmount('');
    setCartDiscount('');
    setSearchQuery('');
    setCustomerName('');
    setDeliveryAddress('');
    setDeliveryPhone('');
    setDeliveryFee('');
    setSelectedDriverId('');
    setQrisProof('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && filteredProducts.length > 0) {
      addToCart(filteredProducts[0]);
    }
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setLastTransaction(null);
  };

  const handleCopyReceipt = () => {
    if (!lastTransaction) return;
    const text = generateTextReceipt(lastTransaction, storeSettings);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        setConfirmModal({
          isOpen: true,
          title: 'Berhasil',
          message: 'Nota disalin ke clipboard!',
          variant: 'success',
          isAlert: true,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setConfirmModal({
          isOpen: true,
          title: 'Berhasil',
          message: 'Nota disalin ke clipboard!',
          variant: 'success',
          isAlert: true,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
      } catch (err) {
        setConfirmModal({
          isOpen: true,
          title: 'Gagal',
          message: 'Gagal menyalin nota ke clipboard',
          variant: 'danger',
          isAlert: true,
          onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
        });
      }
      textArea.remove();
    }
  };

  const handleShareWA = () => {
    if (!lastTransaction) return;
    const text = generateTextReceipt(lastTransaction, storeSettings);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handlePrintBluetooth = () => {
    if (!lastTransaction) return;
    const text = generateTextReceipt(lastTransaction, storeSettings);
    const intentUrl = `intent:${encodeURI(text)}#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;`;
    window.location.href = intentUrl;
  };

  const handlePrintNewTab = () => {
    if (!lastTransaction) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const html = document.getElementById('receipt-content')?.innerHTML || '';
      printWindow.document.write(`
        <html>
          <head>
            <title>Nota Transaksi</title>
            <style>
              body { font-family: monospace; font-size: 12px; color: #000; margin: 0; padding: 10px; }
              .text-center { text-align: center; }
              .font-bold { font-weight: bold; }
              .flex { display: flex; }
              .justify-between { justify-content: space-between; }
              .border-t { border-top: 1px dashed #000; }
              .border-b { border-bottom: 1px dashed #000; }
              .mb-2 { margin-bottom: 8px; }
              .mt-1 { margin-top: 4px; }
              .mt-6 { margin-top: 24px; }
              .py-2 { padding-top: 8px; padding-bottom: 8px; }
              .pb-2 { padding-bottom: 8px; }
              .pt-2 { padding-top: 8px; }
              /* Fallback for old Android browsers */
              .flex.justify-between { display: block; overflow: hidden; }
              .flex.justify-between > span:first-child { float: left; }
              .flex.justify-between > span:last-child { float: right; }
            </style>
          </head>
          <body>
            ${html}
            <script>
              window.onload = function() { window.print(); window.close(); }
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } else {
      setConfirmModal({
        isOpen: true,
        title: 'Pop-up Diblokir',
        message: 'Pop-up diblokir oleh browser. Izinkan pop-up untuk mencetak nota.',
        variant: 'warning',
        isAlert: true,
        onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row print-hide">
      {/* Left Panel: Search & Products */}
      <div className="flex-1 p-4 md:p-6 flex flex-col h-screen overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-blue-800 flex items-center gap-2">
              <ShoppingCart className="text-green-500" />
              {storeSettings.name || 'KASIR PINTAR'}
            </h1>
            <div className="flex flex-col">
              <p className="text-[10px] md:text-xs text-gray-500">{storeSettings.address}</p>
              <p className="text-[8px] text-gray-400">v1.5 develop by aryadpta</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openHistory} className="flex items-center justify-center w-10 h-10 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="Riwayat Transaksi">
              <ShoppingBag size={20} />
            </button>
            <button onClick={onLogout} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-medium transition-colors text-sm">
              <LogOut size={16} /> <span className="hidden md:inline">Keluar</span>
            </button>
          </div>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="text-gray-400" size={20} />
          </div>
          <input
            ref={searchInputRef}
            type="text"
            className="w-full pl-10 pr-4 py-4 rounded-xl border-2 border-blue-100 focus:border-blue-500 focus:ring-0 text-lg shadow-sm transition-colors"
            placeholder="Cari produk... (Tekan Enter jika 1 hasil)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            // Removed autoFocus to prevent tablet keyboard from popping up automatically
          />
          
          {searchQuery && filteredProducts.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 max-h-60 overflow-y-auto">
              {filteredProducts.map(product => {
                const finalPrice = calculateDiscountedPrice(product.price, product.discount);
                return (
                  <div key={product.id} onClick={() => addToCart(product)} className="p-4 hover:bg-blue-50 cursor-pointer border-b border-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      {product.image && <img src={product.image} alt="" className="w-10 h-10 rounded object-cover" />}
                      <div>
                        <div className="font-medium text-gray-800">{product.name}</div>
                        <div className="text-xs text-gray-500">Sisa Stok: {product.stock} {product.unit === 'kg' ? 'kg' : ''}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-blue-600">{formatCurrency(finalPrice)}<span className="text-xs text-gray-500 ml-1">/{product.unit || 'pcs'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 pb-20 md:pb-0 flex flex-col">
          {!searchQuery && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 flex-1">
                {currentProducts.map(product => {
                  const finalPrice = calculateDiscountedPrice(product.price, product.discount);
                  const isOutOfStock = product.stock <= 0;
                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`bg-white p-3 rounded-xl shadow-sm border transition-all text-left flex flex-col h-full ${isOutOfStock ? 'opacity-50 cursor-not-allowed border-gray-200' : 'hover:shadow-md border-gray-100 hover:border-blue-300'}`}
                    >
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="w-full h-20 object-cover rounded-lg mb-2" />
                      ) : (
                        <div className="w-full h-20 bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-gray-400"><ImageIcon size={24} /></div>
                      )}
                      <div className="font-medium text-gray-800 mb-1 flex-1 text-sm leading-tight">{product.name}</div>
                      <div className="text-[10px] text-gray-500 mb-1">Stok: {product.stock} {product.unit === 'kg' ? 'kg' : ''}</div>
                      <div className="mt-auto">
                        <div className={`font-bold text-base ${product.costPrice && product.price < product.costPrice ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(finalPrice)}
                          <span className="text-[10px] text-gray-500 ml-1 font-normal">/{product.unit || 'pcs'}</span>
                        </div>
                        {finalPrice < product.price && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-gray-400 line-through">{formatCurrency(product.price)}</span>
                            <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded font-bold">-{product.discount?.percentage}%</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              
              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-4 pt-4 border-t border-gray-200">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronLeft size={20} />
                  </button>
                  <span className="text-sm font-medium text-gray-600">
                    Halaman {currentPage} dari {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Cart Button (Mobile Only) */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => setIsMobileCartOpen(true)}
          className="relative bg-blue-600 text-white p-4 rounded-full shadow-2xl hover:bg-blue-700 transition-all active:scale-95"
        >
          <ShoppingCart size={24} />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white">
              {cart.reduce((sum, item) => sum + (item.unit === 'kg' ? 1 : item.quantity), 0)}
            </span>
          )}
        </button>
      </div>

      {/* Right Panel: Cart & Checkout */}
      <div className={`
        fixed inset-0 z-40 md:relative md:inset-auto
        w-full md:w-[350px] lg:w-[400px] xl:w-[450px] 
        bg-white shadow-xl flex flex-col h-screen border-l border-gray-200
        transition-transform duration-300 ease-in-out
        ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}>
        <div className="p-3 bg-blue-600 text-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMobileCartOpen(false)}
              className="md:hidden p-1 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <ChevronLeft size={20} />
            </button>
            <h2 className="text-base font-bold">Keranjang</h2>
          </div>
          <div className="text-xs font-medium bg-blue-700 px-2 py-1 rounded-full">Kasir: {cashierName}</div>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>Keranjang masih kosong</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <div className="font-medium text-gray-800">{item.name}</div>
                  <div className="text-blue-600 font-semibold">{formatCurrency(item.finalPrice)}<span className="text-xs text-gray-500 ml-1">/{item.unit || 'pcs'}</span></div>
                </div>
                <div className="flex flex-col items-end justify-between">
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                  <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 p-1">
                    <button onClick={() => updateQuantity(item.id, -1)} className="p-1 hover:bg-gray-100 rounded"><Minus size={14} /></button>
                    <span className="w-auto min-w-[1.5rem] text-center font-medium text-sm px-1">
                      {item.quantity} {item.unit === 'kg' ? 'kg' : ''}
                    </span>
                    <button onClick={() => updateQuantity(item.id, 1)} className="p-1 hover:bg-gray-100 rounded"><Plus size={14} /></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Area */}
        <div className="p-3 bg-gray-50 border-t border-gray-200">
          <div className="flex justify-between items-center mb-1 text-xs">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium text-gray-700">{formatCurrency(subtotalAmount)}</span>
          </div>
          
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="text-gray-500 flex items-center gap-1"><Percent size={12}/> Diskon Manual (Rp)</span>
            <input 
              type="number" 
              value={cartDiscount} 
              onChange={e => setCartDiscount(e.target.value)} 
              className="w-20 px-2 py-1 text-right border border-gray-300 rounded text-red-500 focus:ring-1 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          <div className="flex justify-between items-center mb-1 border-t border-gray-200 pt-2">
            <span className="text-gray-800 font-bold text-sm">Total Akhir</span>
            <span className="font-bold text-xl text-blue-700">{formatCurrency(totalAmount)}</span>
          </div>
          <div className="text-right text-[10px] text-blue-600 italic mb-3">
            {totalAmount > 0 ? `${terbilang(totalAmount)} Rupiah` : ''}
          </div>

          <button
            onClick={handlePreCheckout}
            disabled={cart.length === 0}
            className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-base transition-colors shadow-sm"
          >
            Proses Pembayaran
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Detail Pembayaran</h3>
            
            <div className="mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100 flex justify-between items-center">
              <label className="block text-sm font-medium text-blue-800">Total Tagihan</label>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(totalAmount)}</div>
            </div>

            {/* Order Type Toggle */}
            <div className="flex p-1 bg-gray-100 rounded-lg mb-4">
              <button 
                onClick={() => setOrderType('dine-in')} 
                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${orderType === 'dine-in' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Store size={16} /> Di Tempat
              </button>
              <button 
                onClick={() => setOrderType('delivery')} 
                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors ${orderType === 'delivery' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Truck size={16} /> Pesan Antar
              </button>
            </div>

            {/* Customer Info */}
            <div className="space-y-3 mb-4">
              <input 
                type="text" 
                placeholder="Nama Pembeli (Opsional untuk Di Tempat)" 
                value={customerName} 
                onChange={e => setCustomerName(e.target.value)} 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              
              {orderType === 'delivery' && (
                <div className="space-y-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <input 
                    type="text" 
                    placeholder="Alamat Pengiriman" 
                    value={deliveryAddress} 
                    onChange={e => setDeliveryAddress(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input 
                    type="text" 
                    placeholder="No. Telepon" 
                    value={deliveryPhone} 
                    onChange={e => setDeliveryPhone(e.target.value)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <div>
                    <label className="block text-[10px] font-bold text-blue-600 uppercase mb-1">Biaya Jasa Antar (Delivery Fee)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={deliveryFee}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setDeliveryFee(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-lg border border-blue-300 focus:border-blue-500 focus:ring-0 text-sm font-bold text-blue-700"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <select 
                    value={selectedDriverId} 
                    onChange={e => setSelectedDriverId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">-- Pilih Driver --</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.phone})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Payment Method */}
            <label className="block text-sm font-medium text-gray-700 mb-2">Metode Pembayaran</label>
            <div className="flex gap-2 mb-4">
              <button 
                onClick={() => { setPaymentMethod('cash'); setPaymentAmount(''); }}
                className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg font-medium border-2 transition-colors ${paymentMethod === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 bg-white text-gray-500'}`}
              >
                <Banknote size={18} /> Tunai
              </button>
              {storeSettings.syncEnabled && (
                <button 
                  onClick={() => { setPaymentMethod('qris'); setPaymentAmount(totalAmount.toLocaleString('id-ID')); }}
                  className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg font-medium border-2 transition-colors ${paymentMethod === 'qris' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-500'}`}
                >
                  <CreditCard size={18} /> QRIS
                </button>
              )}
              {orderType === 'delivery' && (
                <button 
                  onClick={() => { setPaymentMethod('cod'); setPaymentAmount(''); }}
                  className={`flex-1 py-2 flex items-center justify-center gap-2 rounded-lg font-medium border-2 transition-colors ${paymentMethod === 'cod' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 bg-white text-gray-500'}`}
                >
                  <Truck size={18} /> COD
                </button>
              )}
            </div>

            {/* Conditional Payment Inputs */}
            {paymentMethod === 'cash' && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Nominal Uang Diterima</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={paymentAmount}
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPaymentAmount(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                  }}
                  className="w-full px-4 py-3 rounded-xl border-2 border-gray-300 focus:border-green-500 focus:ring-0 text-xl font-bold text-gray-800"
                  placeholder="0"
                />
                <div className="text-xs text-gray-500 italic mt-1 min-h-[16px]">
                  {paymentAmount ? `${terbilang(parseFloat(paymentAmount.replace(/\./g, '')))} Rupiah` : ''}
                </div>
                
                {parseFloat(paymentAmount.replace(/\./g, '')) >= totalAmount && (
                  <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center">
                    <span className="text-green-800 text-sm font-medium">Kembalian:</span>
                    <span className="text-lg font-bold text-green-700">{formatCurrency(parseFloat(paymentAmount.replace(/\./g, '')) - totalAmount)}</span>
                  </div>
                )}
              </div>
            )}

            {paymentMethod === 'qris' && (
              <div className="mb-6 p-4 border-2 border-dashed border-blue-200 rounded-xl bg-blue-50 text-center">
                <div className="w-32 h-32 bg-white border border-gray-200 rounded-lg mx-auto mb-3 flex items-center justify-center overflow-hidden">
                  <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=DummyQRIS" alt="QRIS" className="w-full h-full object-cover" />
                </div>
                <p className="text-sm text-blue-800 mb-3">Minta pelanggan scan QR di atas, lalu unggah bukti transfer.</p>
                
                <label className="cursor-pointer bg-white border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors inline-flex items-center gap-2">
                  <Upload size={16} />
                  Unggah Bukti Pembayaran
                  <input type="file" accept="image/*" className="hidden" onChange={handleQrisProofUpload} />
                </label>
                
                {qrisProof && (
                  <div className="mt-3">
                    <p className="text-xs text-green-600 font-medium mb-1">Bukti terunggah:</p>
                    <img src={qrisProof} alt="Bukti QRIS" className="w-full max-h-32 object-contain rounded border border-gray-200" />
                  </div>
                )}
              </div>
            )}
            
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCheckoutModal(false)} className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors">Batal</button>
              <button 
                onClick={handleCheckout} 
                disabled={
                  (paymentMethod === 'cash' && (parseFloat(paymentAmount.replace(/\./g, '')) || 0) < totalAmount) ||
                  (paymentMethod === 'qris' && !qrisProof) ||
                  (orderType === 'delivery' && (!customerName || !deliveryAddress || !deliveryPhone || !selectedDriverId))
                }
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl font-bold transition-colors"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <ShoppingBag className="text-blue-600" />
                Riwayat Transaksi ({cashierName})
              </h3>
              <button onClick={() => setShowHistoryModal(false)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2">
              {cashierTransactions.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Belum ada transaksi.</div>
              ) : (
                <div className="space-y-3">
                  {cashierTransactions.map(trx => (
                    <div key={trx.id} className={`border rounded-xl p-4 hover:bg-gray-50 transition-colors ${trx.status === 'cancelled' ? 'bg-red-50 border-red-200 opacity-75' : 'border-gray-200'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-gray-800 flex items-center gap-2">
                            {trx.id}
                            {trx.status === 'cancelled' && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded uppercase">Batal</span>}
                          </div>
                          <div className="text-xs text-gray-500">{new Date(trx.date).toLocaleString('id-ID')}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-blue-600">{formatCurrency(trx.total)}</div>
                          <div className="text-xs font-medium uppercase px-2 py-0.5 rounded bg-gray-100 inline-block mt-1">
                            {trx.paymentMethod}
                          </div>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-600">
                          {trx.items.length} item(s) • {trx.delivery ? `Pesan Antar (${trx.delivery.driverName})` : 'Di Tempat'}
                        </div>
                        <div className="flex items-center gap-3">
                          {trx.status === 'pending' && (
                            <>
                              <button 
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Selesaikan Transaksi',
                                    message: `Apakah Anda yakin ingin menyelesaikan transaksi ${trx.id} (ACC)?`,
                                    variant: 'success',
                                    onConfirm: () => {
                                      updateTransactionStatus(trx.id, 'completed');
                                      openHistory();
                                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                    }
                                  });
                                }}
                                className="text-xs text-green-600 hover:text-green-700 font-bold flex items-center gap-1 bg-green-50 px-2 py-1 rounded"
                              >
                                <CheckCircle size={12} /> ACC
                              </button>
                              {trx.delivery && (
                                <select
                                  className="text-[10px] border rounded px-1 py-0.5 bg-white"
                                  onChange={(e) => {
                                    const driverId = e.target.value;
                                    const driver = drivers.find(d => d.id === driverId);
                                    if (driver) {
                                      setConfirmModal({
                                        isOpen: true,
                                        title: 'Ganti Driver',
                                        message: `Apakah Anda yakin ingin mengganti driver ke ${driver.name}?`,
                                        variant: 'info',
                                        onConfirm: () => {
                                          updateTransactionDriver(trx.id, driver);
                                          openHistory();
                                          setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                        }
                                      });
                                    }
                                  }}
                                  value={trx.delivery.driverId}
                                >
                                  {drivers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                  ))}
                                </select>
                              )}
                            </>
                          )}
                          {trx.status !== 'cancelled' && (
                            <>
                              {(() => {
                                const txDate = new Date(trx.date).getTime();
                                const now = new Date().getTime();
                                const isWithin24H = (now - txDate) < (24 * 60 * 60 * 1000);
                                
                                if (isWithin24H) {
                                  return (
                                    <button 
                                      onClick={() => handleOpenReturnModal(trx)}
                                      className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 bg-orange-50 px-2 py-1 rounded"
                                    >
                                      <RotateCcw size={12} /> Retur
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                              <button 
                                onClick={() => {
                                  setConfirmModal({
                                    isOpen: true,
                                    title: 'Batalkan Transaksi',
                                    message: `Apakah Anda yakin ingin membatalkan transaksi ${trx.id}? Stok produk akan dikembalikan.`,
                                    variant: 'danger',
                                    onConfirm: () => {
                                      cancelTransaction(trx.id);
                                      openHistory();
                                      setProducts(getProducts());
                                      setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                    }
                                  });
                                }}
                                className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
                              >
                                <Trash2 size={12} /> Batalkan
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print-hide">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
              <h3 className="font-bold">Transaksi Berhasil</h3>
              <button onClick={closeReceipt} className="text-white/80 hover:text-white">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-gray-50">
              <div id="receipt-content" className="bg-white p-4 border border-gray-200 shadow-sm text-sm font-mono text-black">
                <div className="text-center mb-4">
                  <h2 className="font-bold text-lg">{storeSettings.name}</h2>
                  <p className="text-xs">{storeSettings.address}</p>
                  <p className="text-xs">Telp: {storeSettings.phone}</p>
                </div>
                
                <div className="border-t border-b border-dashed border-gray-400 py-2 mb-2 text-xs">
                  <div className="flex justify-between"><span>No:</span> <span>{lastTransaction.id}</span></div>
                  <div className="flex justify-between"><span>Tgl:</span> <span>{new Date(lastTransaction.date).toLocaleString('id-ID')}</span></div>
                  <div className="flex justify-between"><span>Kasir:</span> <span>{lastTransaction.cashierName}</span></div>
                  {lastTransaction.customerName && <div className="flex justify-between"><span>Pelanggan:</span> <span>{lastTransaction.customerName}</span></div>}
                  <div className="flex justify-between"><span>Metode:</span> <span className="uppercase">{lastTransaction.paymentMethod}</span></div>
                  {lastTransaction.status === 'pending' && <div className="flex justify-between font-bold text-red-600 mt-1"><span>STATUS:</span> <span>BELUM LUNAS (COD)</span></div>}
                </div>

                {lastTransaction.delivery && (
                  <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-xs">
                    <div className="font-bold mb-1">PENGANTARAN:</div>
                    <div>{lastTransaction.delivery.customerName} ({lastTransaction.delivery.phone})</div>
                    <div>{lastTransaction.delivery.address}</div>
                    <div className="mt-1">Driver: {lastTransaction.delivery.driverName}</div>
                  </div>
                )}

                <div className="mb-2">
                  {lastTransaction.items.map(item => (
                    <div key={item.id} className="mb-1">
                      <div>{item.name}</div>
                      <div className="flex justify-between text-xs">
                        <span>{item.quantity} x {formatCurrency(item.finalPrice)}</span>
                        <span>{formatCurrency(item.quantity * item.finalPrice)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 text-xs">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(lastTransaction.subtotal)}</span>
                  </div>
                  {lastTransaction.cartDiscount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Diskon Manual</span>
                      <span>-{formatCurrency(lastTransaction.cartDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold mt-1 text-sm">
                    <span>TOTAL</span>
                    <span>{formatCurrency(lastTransaction.total)}</span>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span>{lastTransaction.paymentMethod === 'qris' ? 'QRIS' : (lastTransaction.paymentMethod === 'cod' ? 'COD' : 'TUNAI')}</span>
                    <span>{formatCurrency(lastTransaction.payment)}</span>
                  </div>
                  {lastTransaction.paymentMethod === 'cash' && (
                    <div className="flex justify-between mt-1">
                      <span>KEMBALI</span>
                      <span>{formatCurrency(lastTransaction.change)}</span>
                    </div>
                  )}
                </div>
                
                <div className="text-center mt-6 text-xs">
                  <p>Terima Kasih</p>
                  <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white border-t border-gray-100 flex flex-col gap-3">
              <div className="flex gap-2">
                <button onClick={handlePrintNewTab} className="flex-1 py-2 px-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-medium rounded-lg transition-colors flex flex-col items-center justify-center gap-1 text-[10px]" title="Buka di Tab Baru untuk Cetak">
                  <Printer size={18} /> Cetak (Tab Baru)
                </button>
                <button onClick={handlePrintBluetooth} className="flex-1 py-2 px-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium rounded-lg transition-colors flex flex-col items-center justify-center gap-1 text-[10px]" title="Cetak ke Printer Bluetooth (RawBT)">
                  <Bluetooth size={18} /> Print BT
                </button>
                <button onClick={handleShareWA} className="flex-1 py-2 px-1 bg-green-50 hover:bg-green-100 text-green-700 font-medium rounded-lg transition-colors flex flex-col items-center justify-center gap-1 text-[10px]" title="Kirim via WhatsApp">
                  <MessageCircle size={18} /> Kirim WA
                </button>
                <button onClick={handleCopyReceipt} className="flex-1 py-2 px-1 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-lg transition-colors flex flex-col items-center justify-center gap-1 text-[10px]" title="Salin Teks Nota">
                  <Copy size={18} /> Salin Teks
                </button>
              </div>
              <button onClick={closeReceipt} className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
                Selesai & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rental Input Modal */}
      {showRentalModal && selectedRentalProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-orange-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Input Data Peminjaman</h2>
              <button 
                onClick={() => {
                  setShowRentalModal(false);
                  setSelectedRentalProduct(null);
                }} 
                className="text-white/80 hover:text-white"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                <div className="text-xs text-orange-600 font-bold uppercase mb-1">Produk Jasa</div>
                <div className="font-bold text-gray-800">{selectedRentalProduct.name}</div>
                <div className="text-xs text-gray-500">Harga: {formatCurrency(selectedRentalProduct.price)} / {selectedRentalProduct.rentalSettings?.periodUnit === 'hour' ? 'Jam' : 'Hari'}</div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Peminjam *</label>
                  <input 
                    type="text" 
                    value={rentalBorrowerName}
                    onChange={e => setRentalBorrowerName(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Masukkan nama peminjam"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    No. HP {selectedRentalProduct.rentalSettings?.requirePhone && '*'}
                  </label>
                  <input 
                    type="text" 
                    value={rentalBorrowerPhone}
                    onChange={e => setRentalBorrowerPhone(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Masukkan nomor HP (WhatsApp)"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mulai</label>
                  <input 
                    type="datetime-local" 
                    value={rentalStartDate}
                    onChange={e => setRentalStartDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Selesai</label>
                  <input 
                    type="datetime-local" 
                    value={rentalEndDate}
                    onChange={e => setRentalEndDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>

              {(() => {
                const start = new Date(rentalStartDate);
                const end = new Date(rentalEndDate);
                if (end > start) {
                  const diffMs = end.getTime() - start.getTime();
                  let duration = 0;
                  if (selectedRentalProduct.rentalSettings?.periodUnit === 'hour') {
                    duration = Math.ceil(diffMs / 3600000);
                  } else {
                    duration = Math.ceil(diffMs / 86400000);
                  }
                  return (
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600">Durasi:</span>
                        <span className="font-bold text-gray-800">{duration} {selectedRentalProduct.rentalSettings?.periodUnit === 'hour' ? 'Jam' : 'Hari'}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className="text-gray-800">Estimasi Biaya:</span>
                        <span className="text-orange-600">{formatCurrency(duration * calculateDiscountedPrice(selectedRentalProduct.price, selectedRentalProduct.discount))}</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setShowRentalModal(false);
                    setSelectedRentalProduct(null);
                  }}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleRentalSubmit}
                  className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  Tambahkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showWeightModal && selectedWeightProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-4 bg-blue-600 text-white flex justify-between items-center">
              <h2 className="text-lg font-bold">Masukkan Berat Produk</h2>
              <button 
                onClick={() => {
                  setShowWeightModal(false);
                  setSelectedWeightProduct(null);
                  setWeightInput('');
                }} 
                className="text-white/80 hover:text-white"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <div className="text-xs text-blue-600 font-bold uppercase mb-1">Produk</div>
                <div className="font-bold text-gray-800">{selectedWeightProduct.name}</div>
                <div className="text-xs text-gray-500">Stok Tersedia: {selectedWeightProduct.stock} kg</div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Berat yang dibeli
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={weightInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^\d.,]/g, '');
                        setWeightInput(val);
                      }}
                      className="w-full pl-4 pr-12 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-lg font-semibold"
                      placeholder="0.00"
                      autoFocus
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none">
                      <span className="text-gray-500 font-medium">{weightUnit}</span>
                    </div>
                  </div>
                  
                  <div className="flex bg-gray-100 rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => setWeightUnit('kg')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        weightUnit === 'kg' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      KG
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeightUnit('gram')}
                      className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                        weightUnit === 'gram' 
                          ? 'bg-white text-blue-600 shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Gram
                    </button>
                  </div>
                </div>
                {weightInput && !isNaN(parseFloat(weightInput)) && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">Total Berat:</span>
                      <span className="font-medium text-gray-800">
                        {weightUnit === 'gram' 
                          ? `${(parseFloat(weightInput) / 1000).toFixed(3)} kg` 
                          : `${parseFloat(weightInput)} kg`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-800">Total Harga:</span>
                      <span className="text-blue-600">
                        {formatCurrency(
                          selectedWeightProduct.price * 
                          (weightUnit === 'gram' ? parseFloat(weightInput) / 1000 : parseFloat(weightInput))
                        )}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowWeightModal(false);
                    setSelectedWeightProduct(null);
                    setWeightInput('');
                  }}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleWeightSubmit}
                  disabled={!weightInput || isNaN(parseFloat(weightInput)) || parseFloat(weightInput) <= 0}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={20} />
                  Tambahkan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print-only Receipt */}
      {showReceipt && lastTransaction && (
        <div className="hidden print-show text-black font-mono text-sm w-[58mm] mx-auto">
          <div className="text-center mb-4">
            <h2 className="font-bold text-lg">{storeSettings.name}</h2>
            <p className="text-xs">{storeSettings.address}</p>
            <p className="text-xs">Telp: {storeSettings.phone}</p>
          </div>
          
          <div className="border-t border-b border-dashed border-black py-2 mb-2 text-xs">
            <div className="flex justify-between"><span>No:</span> <span>{lastTransaction.id}</span></div>
            <div className="flex justify-between"><span>Tgl:</span> <span>{new Date(lastTransaction.date).toLocaleString('id-ID')}</span></div>
            <div className="flex justify-between"><span>Kasir:</span> <span>{lastTransaction.cashierName}</span></div>
            {lastTransaction.customerName && <div className="flex justify-between"><span>Pelanggan:</span> <span>{lastTransaction.customerName}</span></div>}
            <div className="flex justify-between"><span>Metode:</span> <span className="uppercase">{lastTransaction.paymentMethod}</span></div>
            {lastTransaction.status === 'pending' && <div className="flex justify-between font-bold mt-1"><span>STATUS:</span> <span>BELUM LUNAS (COD)</span></div>}
          </div>

          {lastTransaction.delivery && (
            <div className="border-b border-dashed border-black pb-2 mb-2 text-xs">
              <div className="font-bold mb-1">PENGANTARAN:</div>
              <div>{lastTransaction.delivery.customerName} ({lastTransaction.delivery.phone})</div>
              <div>{lastTransaction.delivery.address}</div>
              <div className="mt-1">Driver: {lastTransaction.delivery.driverName}</div>
            </div>
          )}

          <div className="mb-2">
            {lastTransaction.items.map(item => (
              <div key={item.id} className="mb-1">
                <div>{item.name}</div>
                <div className="flex justify-between text-xs">
                  <span>{item.quantity} x {item.finalPrice.toLocaleString('id-ID')}</span>
                  <span>{(item.quantity * item.finalPrice).toLocaleString('id-ID')}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-dashed border-black pt-2 text-xs">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{lastTransaction.subtotal.toLocaleString('id-ID')}</span>
            </div>
            {lastTransaction.cartDiscount > 0 && (
              <div className="flex justify-between">
                <span>Diskon Manual</span>
                <span>-{lastTransaction.cartDiscount.toLocaleString('id-ID')}</span>
              </div>
            )}
            <div className="flex justify-between font-bold mt-1">
              <span>TOTAL</span>
              <span>{lastTransaction.total.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span>{lastTransaction.paymentMethod === 'qris' ? 'QRIS' : (lastTransaction.paymentMethod === 'cod' ? 'COD' : 'TUNAI')}</span>
              <span>{lastTransaction.payment.toLocaleString('id-ID')}</span>
            </div>
            {lastTransaction.paymentMethod === 'cash' && (
              <div className="flex justify-between mt-1">
                <span>KEMBALI</span>
                <span>{lastTransaction.change.toLocaleString('id-ID')}</span>
              </div>
            )}
          </div>
          
          <div className="text-center mt-6 text-xs">
            <p>Terima Kasih</p>
          </div>
        </div>
      )}
      {/* Return Modal */}
      {isReturnModalOpen && selectedReturnTrx && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-300">
            <div className="p-4 bg-orange-600 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <RotateCcw size={20} />
                <h2 className="text-lg font-bold text-white">Pengembalian Barang (Retur)</h2>
              </div>
              <button onClick={() => setIsReturnModalOpen(false)} className="text-white/80 hover:text-white">
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-3 bg-orange-50 rounded-xl border border-orange-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-orange-600 font-bold uppercase">ID Transaksi</span>
                  <span className="font-mono font-bold text-gray-800">{selectedReturnTrx.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-orange-600 font-bold uppercase">Pelanggan</span>
                  <span className="font-medium text-gray-800">{selectedReturnTrx.customerName || 'Umum'}</span>
                </div>
                {selectedReturnTrx.delivery && (
                  <div className="mt-2 pt-2 border-t border-orange-200 text-[10px] text-orange-700">
                    * Biaya antar ({formatCurrency(selectedReturnTrx.delivery.fee)}) tidak dapat dikembalikan.
                  </div>
                )}
              </div>

              <div className="mb-4 flex justify-between items-center">
                <h3 className="font-bold text-gray-800">Pilih Barang yang Dikembalikan</h3>
                <button 
                  onClick={toggleReturnAll}
                  className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                    returnAll ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {returnAll ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              </div>

              <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-2 mb-6">
                {selectedReturnTrx.items.filter(item => item.type === 'barang' || !item.type).map(item => (
                  <div key={item.id} className="p-3 border border-gray-100 rounded-xl bg-gray-50 flex items-center gap-3">
                    <input 
                      type="checkbox"
                      checked={returnItems[item.id] > 0}
                      onChange={() => handleItemReturnQtyChange(item.id, returnItems[item.id] > 0 ? 0 : item.quantity, item.quantity)}
                      className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                      <div className="text-xs text-gray-500">{formatCurrency(item.price)} x {item.quantity} {item.unit}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleItemReturnQtyChange(item.id, returnItems[item.id] - 1, item.quantity)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={returnItems[item.id]}
                        onChange={(e) => handleItemReturnQtyChange(item.id, parseInt(e.target.value) || 0, item.quantity)}
                        className="w-12 text-center font-bold text-gray-800 bg-transparent border-none focus:ring-0"
                      />
                      <button 
                        onClick={() => handleItemReturnQtyChange(item.id, returnItems[item.id] + 1, item.quantity)}
                        className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                {selectedReturnTrx.items.some(item => item.type === 'makanan' || item.type === 'jasa') && (
                  <div className="p-3 bg-red-50 text-red-600 text-[10px] rounded-lg border border-red-100 italic">
                    * Item makanan dan jasa tidak dapat dikembalikan (Non-Refundable).
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsReturnModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleProcessReturn}
                  disabled={Object.values(returnItems).every(qty => qty === 0)}
                  className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  Proses Retur
                </button>
              </div>
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
  );
}
