export type Language = 'en' | 'ar';

export interface Product {
  id: string;
  norCode: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string; // Used for extra details if needed, or mapped from generic
  descriptionAr: string;
  price: number;
  expiryDate: string;
  category: CategoryId;
  brandLine: string;
  imageUrl: string;
  size: string;
  isNew: boolean;
  isSor: boolean; // Sale or Return
  stockLevel: 'high' | 'low' | 'out';
}

export type CategoryId = 'face' | 'body' | 'sun' | 'hair';

export interface Category {
  id: CategoryId;
  labelEn: string;
  labelAr: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface PricingTier {
  minQty: number;
  discountPercent: number;
}

export type ViewState = 'catalog' | 'checkout' | 'success';

export interface FilterCriteria {
  showSorOnly: boolean;
  showNewOnly: boolean;
  hideOutOfStock: boolean;
  minPrice: string;
  maxPrice: string;
  minExpiryMonths: number; // 0 means any
  selectedBrands: string[];
}