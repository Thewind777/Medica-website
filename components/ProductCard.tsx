import React, { useState, useEffect } from 'react';
import { Product, Language } from '../types';
import { calculatePrice, formatCurrency, getTierLabel, getNextTier, getExpiryStatus } from '../utils';
import { Package, TrendingUp, CalendarClock, AlertTriangle, ImageOff } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  language: Language;
  quantity: number;
  onQuantityChange: (id: string, qty: number) => void;
  viewMode: 'grid' | 'list';
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  language,
  quantity,
  onQuantityChange,
  viewMode
}) => {
  const isAr = language === 'ar';
  const [inputValue, setInputValue] = useState<string>(quantity.toString());

  // Image Fallback Logic
  // Sanitation: Remove spaces, lowercase. e.g. "NOR 100" -> "nor100.webp"
  const sanitizedCode = product.norCode.toLowerCase().replace(/\s+/g, '');
  const localImage = `/assets/${sanitizedCode}.webp`;

  const [imgSrc, setImgSrc] = useState(localImage);
  const [imgErrorCount, setImgErrorCount] = useState(0);

  const handleImageError = () => {
    // 0: Local -> 1: Remote (product.imageUrl) -> 2: Placeholder
    if (imgErrorCount === 0 && product.imageUrl) {
      setImgSrc(product.imageUrl);
      setImgErrorCount(1);
    } else if (imgErrorCount <= 1) {
      setImgSrc('');
      setImgErrorCount(2);
    }
  };

  useEffect(() => {
    setInputValue(quantity.toString());
  }, [quantity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === '') {
      setInputValue('');
      onQuantityChange(product.id, 0);
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 9999) {
      setInputValue(val);
      onQuantityChange(product.id, num);
    }
  };

  const increment = () => {
    const newQty = (parseInt(inputValue) || 0) + 1;
    setInputValue(newQty.toString());
    onQuantityChange(product.id, newQty);
  };

  const decrement = () => {
    const current = parseInt(inputValue) || 0;
    if (current > 0) {
      const newQty = current - 1;
      setInputValue(newQty.toString());
      onQuantityChange(product.id, newQty);
    }
  };

  const { unitPrice, isDiscounted } = calculatePrice(product.price, parseInt(inputValue) || 0);
  const tierLabel = getTierLabel(parseInt(inputValue) || 0, language);
  const nextTier = getNextTier(parseInt(inputValue) || 0);
  const isOutOfStock = product.stockLevel === 'out';

  const expiryStatus = getExpiryStatus(product.expiryDate);
  const expiryColorClass =
    expiryStatus === 'critical' ? 'text-red-700 bg-red-50 border-red-100' :
      expiryStatus === 'warning' ? 'text-amber-700 bg-amber-50 border-amber-100' :
        'text-emerald-700 bg-emerald-50 border-emerald-100';

  const currentQty = parseInt(inputValue) || 0;
  const showNudge = nextTier && (nextTier.minQty - currentQty <= 50) && currentQty > 0;
  const missingQty = nextTier ? nextTier.minQty - currentQty : 0;

  // Render Image Helper
  const renderImage = () => {
    if (imgSrc && imgErrorCount < 2) {
      return (
        <img
          src={imgSrc}
          alt={product.nameEn}
          onError={handleImageError}
          className={`w-full h-full object-cover mix-blend-multiply opacity-90 group-hover:scale-105 transition-transform duration-500 ${isOutOfStock ? 'grayscale opacity-50' : ''}`}
        />
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-100 text-gray-400">
        <ImageOff size={24} />
        <span className="text-[10px] mt-1 font-mono">{product.norCode}</span>
      </div>
    );
  };

  if (viewMode === 'list') {
    return (
      <div className={`group bg-white rounded-xl border border-medical-border mb-3 overflow-hidden shadow-sm hover:shadow-soft transition-all duration-300 ${isOutOfStock ? 'opacity-80' : ''}`}>
        <div className="flex flex-col sm:flex-row p-4 gap-4 items-center">
          <div className="relative w-20 h-20 flex-shrink-0 bg-white rounded-lg overflow-hidden border border-gray-100">
            {renderImage()}
            {isOutOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100/10">
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-md -rotate-6">{isAr ? 'نفذت الكمية' : 'SOLD OUT'}</span>
              </div>
            )}
          </div>
          <div className="flex-1 text-start min-w-0 w-full">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[10px] font-bold tracking-wider text-medical-subtext bg-gray-100 px-1.5 py-0.5 rounded">{product.norCode}</span>
              <span className={`text-[11px] font-medium border px-2 py-0.5 rounded-md flex items-center gap-1 w-fit ${expiryColorClass}`}>
                <CalendarClock size={12} />
                {product.expiryDate}
              </span>
            </div>
            <h3 className={`font-bold text-gray-900 truncate ${isAr ? 'text-lg font-arabic' : 'text-sm sm:text-base'}`}>
              {isAr ? product.nameAr : product.nameEn}
            </h3>
            <p className={`mt-1 line-clamp-2 ${isAr ? 'text-sm font-arabic text-gray-600 font-medium' : 'text-xs text-medical-subtext'}`} dir={isAr ? 'rtl' : 'ltr'}>
              {isAr ? product.descriptionAr : product.descriptionEn}
            </p>
          </div>

          <div className="flex flex-col gap-2 w-full sm:w-auto items-end">
            <div className="flex items-baseline gap-2">
              {isDiscounted && <span className="text-xs text-gray-400 line-through">{formatCurrency(product.price, language)}</span>}
              <span className={`text-lg font-bold ${isDiscounted ? 'text-medical-primary' : 'text-gray-900'}`}>{formatCurrency(unitPrice, language)}</span>
            </div>
            {isOutOfStock ? (
              <div className="h-9 px-4 flex items-center bg-gray-100 text-gray-400 rounded-lg text-sm font-bold border border-gray-200">
                {isAr ? 'غير متوفر' : 'Unavailable'}
              </div>
            ) : (
              <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 p-0.5 h-9 w-full sm:w-auto">
                <button onClick={decrement} className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-medical-primary hover:bg-white rounded transition-colors">-</button>
                <input type="number" className="w-12 text-center bg-transparent font-bold text-gray-900 focus:outline-none text-sm" value={inputValue} onChange={handleInputChange} />
                <button onClick={increment} className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-medical-primary hover:bg-white rounded transition-colors">+</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div className={`group bg-white rounded-2xl border border-transparent shadow-sm hover:shadow-soft hover:border-medical-border/50 transition-all duration-300 flex flex-col overflow-hidden relative ${isOutOfStock ? '' : ''}`}>
      {isOutOfStock && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-red-500 text-white text-sm font-extrabold px-4 py-2 rounded-lg shadow-xl transform -rotate-6 border-2 border-white">
            {isAr ? 'نفذت الكمية' : 'SOLD OUT'}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="absolute top-3 start-3 z-10 flex flex-col gap-1.5">
        {product.isNew && !isOutOfStock && <span className="bg-medical-dark text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm tracking-wide">{isAr ? 'جديد' : 'NEW'}</span>}
        {product.isSor && !isOutOfStock && (
          <span className="bg-white/90 backdrop-blur-sm text-blue-600 border border-blue-100 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm flex items-center gap-1">
            <Package size={10} /> {isAr ? 'إرجاع' : 'SOR'}
          </span>
        )}
      </div>

      <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
        {renderImage()}
        <div className="absolute bottom-2 end-2 bg-white/80 backdrop-blur text-[10px] font-mono text-gray-600 px-1.5 rounded">
          {product.size}
        </div>
      </div>

      <div className="p-4 flex flex-col flex-1">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">{product.norCode}</span>
          <span className={`text-[11px] font-medium border px-2 py-0.5 rounded-md flex items-center gap-1 ${expiryColorClass}`}>
            <CalendarClock size={12} /> {product.expiryDate}
          </span>
        </div>

        <h3 className={`font-bold text-gray-900 leading-snug mb-1 h-12 line-clamp-2 ${isAr ? 'text-lg font-arabic' : 'text-sm'}`} title={isAr ? product.nameAr : product.nameEn}>
          {isAr ? product.nameAr : product.nameEn}
        </h3>

        <p className={`mb-4 line-clamp-3 h-[3.5em] leading-snug ${isAr ? 'text-sm font-arabic text-gray-600 font-medium' : 'text-xs text-medical-subtext'}`} dir={isAr ? 'rtl' : 'ltr'}>
          {isAr ? product.descriptionAr : product.descriptionEn}
        </p>

        <div className="mt-auto pt-4 border-t border-dashed border-gray-100">
          <div className="h-6 mb-2">
            {showNudge && !isOutOfStock ? (
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-medical-primary animate-pulse">
                <TrendingUp size={12} /> <span>{isAr ? `أضف ${missingQty} للمستوى التالي` : `Add ${missingQty} for next tier`}</span>
              </div>
            ) : tierLabel && !isOutOfStock ? (
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded font-bold">{tierLabel}</span>
            ) : <div className="h-4"></div>}
          </div>

          <div className="flex items-end justify-between gap-2">
            <div className="flex flex-col">
              {isDiscounted && <span className="text-xs text-gray-400 line-through mb-[-2px]">{formatCurrency(product.price, language)}</span>}
              <span className={`text-xl font-bold ${isDiscounted ? 'text-medical-primary' : 'text-gray-900'}`}>{formatCurrency(unitPrice, language)}</span>
            </div>
            {isOutOfStock ? (
              <button disabled className="h-10 px-3 bg-gray-100 text-gray-400 text-xs font-bold rounded-lg cursor-not-allowed">{isAr ? 'غير متوفر' : 'Unavailable'}</button>
            ) : (
              <div className={`flex items-center rounded-lg border h-10 transition-colors w-28 shadow-sm ${inputValue !== '0' && inputValue !== '' ? 'border-medical-primary bg-blue-50/30' : 'border-gray-200 bg-white'}`}>
                <button onClick={decrement} className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-medical-primary transition-colors hover:bg-gray-50 rounded-s-lg">-</button>
                <input type="number" className="w-full h-full text-center bg-transparent focus:outline-none font-bold text-gray-800 text-sm" placeholder="0" value={inputValue === '0' ? '' : inputValue} onChange={handleInputChange} />
                <button onClick={increment} className="w-8 h-full flex items-center justify-center text-gray-500 hover:text-medical-primary transition-colors hover:bg-gray-50 rounded-e-lg">+</button>
              </div>
            )}
          </div>
        </div>
        {showNudge && !isOutOfStock && (
          <div className="absolute bottom-0 left-0 h-1 bg-medical-primary/20 w-full">
            <div className="h-full bg-medical-primary transition-all duration-500" style={{ width: `${(currentQty / nextTier!.minQty) * 100}%` }}></div>
          </div>
        )}
      </div>
    </div>
  );
};