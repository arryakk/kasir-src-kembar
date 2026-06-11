import { StoreSettings, Product, Transaction, Cashier, Driver, OperationalCost, RestockRecord, Staff } from '../types';
import { getProducts, getTransactions, getStaff, getDrivers, getOperationalCosts, getRestockRecords } from '../storage';

export const syncDataToCloud = async (settings: StoreSettings): Promise<boolean> => {
  if (!settings.syncEnabled || !settings.apiUrl || !settings.apiKey) return false;

  const data = {
    store: {
      name: settings.name,
      owner: settings.ownerName,
      address: settings.address,
      phone: settings.phone
    },
    products: getProducts(),
    transactions: getTransactions(),
    cashiers: getStaff(),
    drivers: getDrivers(),
    operationalCosts: getOperationalCosts(),
    restockRecords: getRestockRecords(),
    timestamp: new Date().toISOString()
  };

  try {
    if (settings.apiType === 'supabase') {
      // Example Supabase implementation
      const response = await fetch(`${settings.apiUrl}/rest/v1/sync_data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': settings.apiKey,
          'Authorization': `Bearer ${settings.apiKey}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Sync failed');
    } else if (settings.apiType === 'google-sheets') {
      // Example Google Apps Script implementation
      const response = await fetch(settings.apiUrl, {
        method: 'POST',
        mode: 'no-cors', // GAS often requires no-cors for simple POST
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...data, apiKey: settings.apiKey })
      });
    }
    
    // Update last sync time
    const updatedSettings = { ...settings, lastSync: new Date().toISOString() };
    localStorage.setItem('kasir_store_settings', JSON.stringify(updatedSettings));
    console.log('Sync successful at', updatedSettings.lastSync);
    return true;
  } catch (error) {
    console.error('Sync error:', error);
    return false;
  }
};

export const startAutoSync = (settings: StoreSettings) => {
  if (!settings.syncEnabled) return null;
  
  // Sync every 1 hour (3600000 ms)
  const interval = setInterval(() => {
    syncDataToCloud(settings);
  }, 3600000);
  
  return interval;
};
