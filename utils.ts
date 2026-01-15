import { PRICING_TIERS, CATEGORIES } from './data';
import { Product, Category } from './types';

export const calculatePrice = (basePrice: number, quantity: number) => {
  let discountPercent = 0;
  
  // Find the highest applicable tier
  for (const tier of PRICING_TIERS) {
    if (quantity >= tier.minQty) {
      discountPercent = tier.discountPercent;
    }
  }

  const unitPrice = basePrice * (1 - discountPercent);
  const total = unitPrice * quantity;
  const savings = (basePrice * quantity) - total;

  return {
    unitPrice,
    total,
    savings,
    discountPercent,
    isDiscounted: discountPercent > 0
  };
};

export const getNextTier = (quantity: number) => {
  // Find the next tier that the user hasn't reached yet
  const nextTier = PRICING_TIERS.find(tier => tier.minQty > quantity);
  return nextTier || null;
};

export const formatCurrency = (amount: number, locale: 'en' | 'ar') => {
  if (locale === 'ar') {
    return `${amount.toLocaleString('ar-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} د.ل`;
  }
  return `${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} LYD`;
};

export const getTierLabel = (quantity: number, locale: 'en' | 'ar') => {
  if (quantity < 50) return null;
  if (quantity < 100) return locale === 'en' ? '5% Bulk Savings' : 'وفر 5% بالجملة';
  if (quantity < 200) return locale === 'en' ? '10% Super Bulk' : 'وفر 10% جملة الجملة';
  return locale === 'en' ? '15% Mega Partner' : 'وفر 15% شريك استراتيجي';
};

export const getRemainingMonths = (expiryDate: string): number => {
  const today = new Date();
  const expiry = new Date(expiryDate);
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 30);
};

export const getExpiryStatus = (expiryDate: string): 'critical' | 'warning' | 'good' => {
  const months = getRemainingMonths(expiryDate);
  if (months <= 6) return 'critical';
  if (months <= 12) return 'warning';
  return 'good';
};

// --- SEARCH UTILITIES ---

// Normalize text: lowercase, remove accents/diacritics (good for Arabic/English mix)
const normalize = (str: string) => {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
};

// Calculate Levenshtein Distance (Typo tolerance)
const levenshteinDistance = (a: string, b: string): number => {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
};

// Check if two words are similar (Similarity > 75%)
const isSimilar = (word1: string, word2: string): boolean => {
  if (word1.includes(word2) || word2.includes(word1)) return true;
  const longerLength = Math.max(word1.length, word2.length);
  if (longerLength < 3) return word1 === word2; // Strict for short words
  
  const distance = levenshteinDistance(word1, word2);
  const similarity = (longerLength - distance) / longerLength;
  return similarity >= 0.75; // 75% similarity threshold
};

export const performFuzzySearch = (products: Product[], query: string): Product[] => {
  if (!query) return products;

  const normalizedQuery = normalize(query);
  const queryTokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);

  // Score each product
  const scoredProducts = products.map(product => {
    let score = 0;
    
    // Build searchable text from all relevant fields
    const category = CATEGORIES.find(c => c.id === product.category);
    const categoryLabels = category ? `${category.labelEn} ${category.labelAr}` : '';
    
    // Create arrays of words for each field to match against
    const fields = {
      code: normalize(product.norCode),
      name: normalize(`${product.nameEn} ${product.nameAr}`),
      brand: normalize(product.brandLine),
      desc: normalize(`${product.descriptionEn} ${product.descriptionAr}`),
      cat: normalize(categoryLabels)
    };

    const allProductTokens = [
      ...fields.code.split(/\s+/),
      ...fields.name.split(/\s+/),
      ...fields.brand.split(/\s+/),
      ...fields.desc.split(/\s+/),
      ...fields.cat.split(/\s+/)
    ];

    // Check each query token against the product
    queryTokens.forEach(qToken => {
      // 1. Exact Match on Code (Highest Priority)
      if (fields.code.includes(qToken)) {
        score += 50;
        return;
      }

      // 2. Exact/Fuzzy match on other fields
      const hasMatch = allProductTokens.some(pToken => isSimilar(qToken, pToken));
      
      if (hasMatch) {
        score += 10;
      }
    });

    return { product, score };
  });

  // Filter out zero scores and sort by relevance
  return scoredProducts
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product);
};