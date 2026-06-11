export interface Discount {
  percentage: number;
  validUntil: string; // YYYY-MM-DD
}

export interface Product {
  id: string;
  name: string;
  price: number;
  costPrice?: number; // Harga beli/modal
  stock: number;
  image?: string; // base64
  discount?: Discount;
  unit?: 'pcs' | 'box' | 'kg' | 'karung' | 'porsi' | 'jam' | 'hari';
  sellInGram?: boolean; // Option to sell in grams for kg products
  type: 'barang' | 'jasa' | 'makanan';
  isRental?: boolean; // Specific for jasa
  rentalSettings?: {
    periodUnit: 'hour' | 'day';
    requirePhone: boolean;
  };
}

export interface RentalInfo {
  borrowerName: string;
  borrowerPhone?: string;
  startDate: string;
  endDate: string;
  duration: number;
  periodUnit: 'hour' | 'day';
}

export interface CartItem extends Product {
  quantity: number;
  finalPrice: number; // Price after discount
  costPrice?: number; // Snapshot of costPrice at time of sale
  rentalInfo?: RentalInfo;
}

export type StaffRole = 'admin' | 'kasir' | 'driver' | 'pj';

export interface Staff {
  id: string;
  name: string;
  pin: string;
  roles: StaffRole[];
  phone?: string;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
}

export interface Cashier {
  id: string;
  name: string;
  pin: string;
}

export interface DeliveryInfo {
  customerName: string;
  address: string;
  phone: string;
  driverId: string;
  driverName: string;
  fee?: number;
}

export interface Transaction {
  id: string;
  date: string;
  cashierName: string;
  customerName?: string;
  items: CartItem[];
  returnedItems?: { itemId: string; quantity: number; refundAmount: number }[];
  subtotal: number;
  cartDiscount: number; // Manual discount applied at checkout
  total: number;
  paymentMethod: 'cash' | 'qris' | 'cod';
  payment: number;
  change: number;
  qrisProof?: string; // base64 image of the transfer proof
  delivery?: DeliveryInfo;
  deliveryFee?: number;
  status: 'completed' | 'pending' | 'cancelled'; // pending for COD until marked paid
}

export interface StoreSettings {
  isSetupComplete: boolean;
  ownerName: string;
  adminPassword?: string;
  staffList?: Staff[];
  name: string;
  address: string;
  phone: string;
  initialInvestment?: number;
  // UI Settings
  showCostPrice?: boolean;
  showSellingOptions?: boolean;
  enableBarang?: boolean;
  enableJasa?: boolean;
  enableMakanan?: boolean;
  // API Integration
  syncEnabled?: boolean;
  apiType?: 'supabase' | 'google-sheets';
  apiUrl?: string;
  apiKey?: string;
  lastSync?: string;
}

export interface OperationalCost {
  id: string;
  date: string;
  description: string;
  amount: number;
  personInCharge: string;
  picType?: 'karyawan' | 'driver' | 'pemilik';
  receiptImage?: string;
}

export interface CashierDiscrepancy {
  id: string;
  date: string;
  amount: number; // Positive for plus, negative for minus
  notes: string;
}

export interface RestockRecord {
  id: string;
  date: string;
  productId: string;
  productName: string;
  quantity: number;
  totalWeight?: number;
  numItems?: number;
  totalCost: number;
  unitCost: number;
  newSellingPrice: number;
  profitPercentage: number;
}
