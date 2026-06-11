import { Product, CartItem, Transaction, Driver, StoreSettings, Cashier, OperationalCost, CashierDiscrepancy, RestockRecord, Staff } from './types';

const PRODUCTS_KEY = 'kasir_products';
const TRANSACTIONS_KEY = 'kasir_transactions';
const DRIVERS_KEY = 'kasir_drivers';
const CASHIERS_KEY = 'kasir_cashiers';
const STORE_SETTINGS_KEY = 'kasir_store_settings';
const OPERATIONAL_COSTS_KEY = 'kasir_operational_costs';
const CASHIER_DISCREPANCIES_KEY = 'kasir_discrepancies';
const RESTOCK_RECORDS_KEY = 'kasir_restock_records';
const STAFF_KEY = 'kasir_staff';

export const getProducts = (): Product[] => {
  const data = localStorage.getItem(PRODUCTS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing products from localStorage:', e);
    }
  }
  
  // Default products for demonstration
  const defaultProducts: Product[] = [

  ];
  saveProducts(defaultProducts);
  return defaultProducts;
};

const safeLocalStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
      alert('Penyimpanan penuh! Silakan hapus beberapa data transaksi lama.');
    } else {
      console.error('Error saving to localStorage:', e);
    }
  }
};

export const saveProducts = (products: Product[]) => {
  safeLocalStorageSet(PRODUCTS_KEY, JSON.stringify(products));
};

export const getTransactions = (): Transaction[] => {
  const data = localStorage.getItem(TRANSACTIONS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing transactions from localStorage:', e);
    }
  }
  return [];
};

export const saveTransaction = (transaction: Transaction) => {
  const transactions = getTransactions();
  
  // Ensure items have costPrice snapshot
  const products = getProducts();
  const itemsWithCost = transaction.items.map(item => {
    const product = products.find(p => p.id === item.id);
    return {
      ...item,
      costPrice: item.costPrice || product?.costPrice || 0
    };
  });
  
  const finalTransaction = { ...transaction, items: itemsWithCost };
  transactions.push(finalTransaction);
  safeLocalStorageSet(TRANSACTIONS_KEY, JSON.stringify(transactions));

  // Deduct stock
  transaction.items.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) {
      const quantity = Number(item.quantity) || 0;
      const currentStock = Number(product.stock) || 0;
      product.stock = Math.max(0, currentStock - quantity);
    }
  });
  saveProducts(products);
};

export const updateTransactionStatus = (id: string, status: 'completed' | 'pending' | 'cancelled') => {
  const transactions = getTransactions();
  const updated = transactions.map(t => t.id === id ? { ...t, status } : t);
  safeLocalStorageSet(TRANSACTIONS_KEY, JSON.stringify(updated));
};

export const updateTransactionDriver = (id: string, driver: Driver) => {
  const transactions = getTransactions();
  const updated = transactions.map(t => {
    if (t.id === id && t.delivery) {
      return {
        ...t,
        delivery: {
          ...t.delivery,
          driverId: driver.id,
          driverName: driver.name
        }
      };
    }
    return t;
  });
  safeLocalStorageSet(TRANSACTIONS_KEY, JSON.stringify(updated));
};

export const cancelTransaction = (id: string) => {
  const transactions = getTransactions();
  const transaction = transactions.find(t => t.id === id);
  if (!transaction || transaction.status === 'cancelled') return;

  const updated = transactions.map(t => t.id === id ? { ...t, status: 'cancelled' } : t);
  safeLocalStorageSet(TRANSACTIONS_KEY, JSON.stringify(updated));

  // Restore stock
  const products = getProducts();
  transaction.items.forEach(item => {
    const product = products.find(p => p.id === item.id);
    if (product) {
      const quantity = Number(item.quantity) || 0;
      const currentStock = Number(product.stock) || 0;
      product.stock = currentStock + quantity;
    }
  });
  saveProducts(products);
};

export const getDrivers = (): Driver[] => {
  const staff = getStaff();
  return staff
    .filter(s => s.roles.includes('driver'))
    .map(s => ({
      id: s.id,
      name: s.name,
      phone: s.phone || ''
    }));
};

export const getCashiers = (): Cashier[] => {
  const data = localStorage.getItem(CASHIERS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing cashiers from localStorage:', e);
    }
  }
  return [];
};

export const saveCashiers = (cashiers: Cashier[]) => {
  safeLocalStorageSet(CASHIERS_KEY, JSON.stringify(cashiers));
};

export const getStoreSettings = (): StoreSettings => {
  const data = localStorage.getItem(STORE_SETTINGS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing store settings from localStorage:', e);
    }
  }
  return { 
    isSetupComplete: false, 
    ownerName: '', 
    name: '', 
    address: '', 
    phone: '',
    enableBarang: true,
    enableJasa: true,
    enableMakanan: true
  };
};

export const saveStoreSettings = (settings: StoreSettings) => {
  safeLocalStorageSet(STORE_SETTINGS_KEY, JSON.stringify(settings));
};

export const getOperationalCosts = (): OperationalCost[] => {
  const data = localStorage.getItem(OPERATIONAL_COSTS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing operational costs from localStorage:', e);
    }
  }
  return [];
};

export const saveOperationalCosts = (costs: OperationalCost[]) => {
  safeLocalStorageSet(OPERATIONAL_COSTS_KEY, JSON.stringify(costs));
};

export const getCashierDiscrepancies = (): CashierDiscrepancy[] => {
  const data = localStorage.getItem(CASHIER_DISCREPANCIES_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing cashier discrepancies from localStorage:', e);
    }
  }
  return [];
};

export const saveCashierDiscrepancies = (discrepancies: CashierDiscrepancy[]) => {
  safeLocalStorageSet(CASHIER_DISCREPANCIES_KEY, JSON.stringify(discrepancies));
};

export const getRestockRecords = (): RestockRecord[] => {
  const data = localStorage.getItem(RESTOCK_RECORDS_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing restock records from localStorage:', e);
    }
  }
  return [];
};

export const saveRestockRecord = (record: RestockRecord) => {
  const records = getRestockRecords();
  records.push(record);
  safeLocalStorageSet(RESTOCK_RECORDS_KEY, JSON.stringify(records));

  // Update product stock and price
  const products = getProducts();
  const productIndex = products.findIndex(p => p.id === record.productId);
  if (productIndex !== -1) {
    products[productIndex].stock += record.quantity;
    products[productIndex].costPrice = record.unitCost;
    products[productIndex].price = record.newSellingPrice;
    saveProducts(products);
  }
};

export const getStaff = (): Staff[] => {
  const data = localStorage.getItem(STAFF_KEY);
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Error parsing staff from localStorage:', e);
    }
  }
  return [];
};

export const saveStaff = (staff: Staff[]) => {
  safeLocalStorageSet(STAFF_KEY, JSON.stringify(staff));
};

export const clearTransactions = () => {
  localStorage.removeItem(TRANSACTIONS_KEY);
};

export const clearAllData = () => {
  localStorage.clear();
};

export const processReturn = (transactionId: string, returnItems: { [itemId: string]: number }) => {
  const products = getProducts();
  let transactions = getTransactions();
  const txIndex = transactions.findIndex(t => t.id === transactionId);
  
  if (txIndex === -1) return null;

  const oldTx = transactions[txIndex];
  const newItems: CartItem[] = [];
  let returnedSomething = false;

  // Process items and update stock
  oldTx.items.forEach(item => {
    const returnQty = returnItems[item.id] || 0;
    if (returnQty > 0) {
      returnedSomething = true;
      // Restore stock to inventory
      const pIdx = products.findIndex(p => p.id === item.id);
      if (pIdx !== -1) {
        products[pIdx].stock += returnQty;
      }
    }
    
    const remainingQty = item.quantity - returnQty;
    if (remainingQty > 0) {
      newItems.push({
        ...item,
        quantity: remainingQty
      });
    }
  });

  if (!returnedSomething) return null;

  // Delete the old transaction instead of cancelling it
  transactions.splice(txIndex, 1);

  let newTx: Transaction | null = null;

  // Create a new transaction if there are items remaining
  if (newItems.length > 0) {
    const subtotal = newItems.reduce((sum, item) => sum + (item.finalPrice * item.quantity), 0);
    // Adjust manual discount proportionally or cap it
    const cartDiscount = Math.min(oldTx.cartDiscount, subtotal);
    const deliveryFee = oldTx.deliveryFee || 0;
    const total = Math.max(0, subtotal - cartDiscount + deliveryFee);
    
    newTx = {
      ...oldTx,
      id: `TRX-R-${Date.now()}`, // New ID for the adjusted transaction
      date: new Date().toISOString(), // New date for the new receipt
      items: newItems,
      subtotal,
      cartDiscount,
      total,
      // Adjust payment and change for cash transactions
      payment: oldTx.paymentMethod === 'cash' ? Math.max(total, oldTx.payment) : total,
      change: oldTx.paymentMethod === 'cash' ? Math.max(0, (oldTx.paymentMethod === 'cash' ? oldTx.payment : total) - total) : 0,
    };
    
    transactions.push(newTx);
  }

  // Save changes
  saveProducts(products);
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
  
  return newTx;
};
