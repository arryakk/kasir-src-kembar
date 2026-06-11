export const calculateDiscountedPrice = (price: number, discount?: { percentage: number; validUntil: string }) => {
  if (!discount || discount.percentage <= 0) return price;
  
  const today = new Date().toISOString().split('T')[0];
  if (discount.validUntil && discount.validUntil < today) {
    return price; // Discount expired
  }
  
  return price - (price * (discount.percentage / 100));
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const terbilang = (angka: number): string => {
  const bilangan = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];

  if (angka === 0) return 'Nol';
  if (angka < 0) return 'Minus ' + terbilang(Math.abs(angka));

  const helper = (n: number): string => {
    if (n < 12) return bilangan[n];
    if (n < 20) return helper(n - 10) + ' Belas';
    if (n < 100) return helper(Math.floor(n / 10)) + ' Puluh ' + helper(n % 10);
    if (n < 200) return 'Seratus ' + helper(n - 100);
    if (n < 1000) return helper(Math.floor(n / 100)) + ' Ratus ' + helper(n % 100);
    if (n < 2000) return 'Seribu ' + helper(n - 1000);
    if (n < 1000000) return helper(Math.floor(n / 1000)) + ' Ribu ' + helper(n % 1000);
    if (n < 1000000000) return helper(Math.floor(n / 1000000)) + ' Juta ' + helper(n % 1000000);
    if (n < 1000000000000) return helper(Math.floor(n / 1000000000)) + ' Miliar ' + helper(n % 1000000000);
    return 'Angka terlalu besar';
  };

  return helper(Math.floor(angka)).replace(/\s+/g, ' ').trim();
};

export const formatPhoneForWA = (phone: string) => {
  if (!phone) return '';
  let formatted = phone.replace(/\D/g, '');
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.slice(1);
  }
  return formatted;
};

export const exportToCSV = (rows: any[][], filename: string) => {
  const csvContent = rows.map(e => e.join(",")).join("\n");
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const resizeImage = (base64Str: string, maxWidth = 400, maxHeight = 400): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(base64Str); // Fallback to original if error
  });
};
