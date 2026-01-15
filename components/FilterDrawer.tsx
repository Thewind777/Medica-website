import React from 'react';
import { FilterCriteria, Language } from '../types';
import { X, Filter, RefreshCw, Check } from 'lucide-react';

interface FilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterCriteria;
  setFilters: (f: FilterCriteria) => void;
  language: Language;
  brands: string[];
}

export const FilterDrawer: React.FC<FilterDrawerProps> = ({
  isOpen,
  onClose,
  filters,
  setFilters,
  language,
  brands
}) => {
  const isAr = language === 'ar';

  const resetFilters = () => {
    setFilters({
      showSorOnly: false,
      showNewOnly: false,
      hideOutOfStock: false,
      minPrice: '',
      maxPrice: '',
      minExpiryMonths: 0,
      selectedBrands: [],
    });
  };

  const toggleBrand = (brand: string) => {
    const current = filters.selectedBrands;
    const next = current.includes(brand)
      ? current.filter(b => b !== brand)
      : [...current, brand];
    setFilters({ ...filters, selectedBrands: next });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Drawer */}
      <div className={`relative w-full max-w-sm bg-white shadow-2xl flex flex-col h-full animate-slide-up sm:animate-none ${isAr ? 'sm:rounded-r-none sm:rounded-l-2xl' : 'sm:rounded-l-none sm:rounded-r-2xl'}`}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-2 text-medical-dark">
            <Filter className="w-5 h-5" />
            <h2 className={`text-xl font-bold ${isAr ? 'font-arabic' : ''}`}>{isAr ? 'تصفية المنتجات' : 'Filter Products'}</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-8 no-scrollbar">

          {/* Section: Status */}
          <div>
            <h3 className={`text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 ${isAr ? 'font-arabic' : ''}`}>{isAr ? 'الحالة' : 'Status & Offers'}</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${filters.showSorOnly ? 'bg-medical-primary border-medical-primary text-white' : 'border-gray-300 group-hover:border-medical-primary'}`}>
                  {filters.showSorOnly && <Check size={14} />}
                </div>
                <input type="checkbox" className="hidden" checked={filters.showSorOnly} onChange={(e) => setFilters({ ...filters, showSorOnly: e.target.checked })} />
                <span className="text-gray-700 font-medium">{isAr ? 'ضمان البيع أو الإرجاع (SOR)' : 'Sale or Return (SOR)'}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${filters.showNewOnly ? 'bg-medical-primary border-medical-primary text-white' : 'border-gray-300 group-hover:border-medical-primary'}`}>
                  {filters.showNewOnly && <Check size={14} />}
                </div>
                <input type="checkbox" className="hidden" checked={filters.showNewOnly} onChange={(e) => setFilters({ ...filters, showNewOnly: e.target.checked })} />
                <span className="text-gray-700 font-medium">{isAr ? 'وصل حديثاً (New)' : 'New Arrivals'}</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer group">
                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${filters.hideOutOfStock ? 'bg-medical-primary border-medical-primary text-white' : 'border-gray-300 group-hover:border-medical-primary'}`}>
                  {filters.hideOutOfStock && <Check size={14} />}
                </div>
                <input type="checkbox" className="hidden" checked={filters.hideOutOfStock} onChange={(e) => setFilters({ ...filters, hideOutOfStock: e.target.checked })} />
                <span className="text-gray-700 font-medium">{isAr ? 'إخفاء غير المتوفر' : 'Hide Out of Stock'}</span>
              </label>
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          {/* Section: Price */}
          <div>
            <h3 className={`text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 ${isAr ? 'font-arabic' : ''}`}>{isAr ? 'نطاق السعر' : 'Price Range (LYD)'}</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">{isAr ? 'من' : 'Min'}</label>
                <input
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary outline-none"
                  placeholder="0"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">{isAr ? 'إلى' : 'Max'}</label>
                <input
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary outline-none"
                  placeholder="1000"
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          {/* Section: Expiry */}
          <div>
            <h3 className={`text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2 ${isAr ? 'font-arabic' : ''}`}>
              {isAr ? 'مدة الصلاحية' : 'Minimum Shelf Life'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 0, labelEn: 'Any Date', labelAr: 'أي تاريخ' },
                { val: 6, labelEn: '6+ Months', labelAr: '6+ أشهر' },
                { val: 12, labelEn: '1+ Year', labelAr: '1+ سنة' },
                { val: 24, labelEn: '2+ Years', labelAr: '2+ سنوات' },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setFilters({ ...filters, minExpiryMonths: opt.val })}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${filters.minExpiryMonths === opt.val
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                >
                  {isAr ? opt.labelAr : opt.labelEn}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-gray-100"></div>

          {/* Section: Brands */}
          <div>
            <h3 className={`text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 ${isAr ? 'font-arabic' : ''}`}>{isAr ? 'العلامة التجارية' : 'Brand Lines'}</h3>
            <div className="flex flex-wrap gap-2">
              {brands.map(brand => {
                const isSelected = filters.selectedBrands.includes(brand);
                return (
                  <button
                    key={brand}
                    onClick={() => toggleBrand(brand)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${isSelected
                      ? 'bg-medical-dark text-white border-medical-dark'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                  >
                    {brand}
                  </button>
                )
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 bg-gray-50 flex gap-3">
          <button
            onClick={resetFilters}
            className="flex items-center justify-center w-12 h-12 rounded-xl border border-gray-300 text-gray-500 hover:bg-white transition-colors"
            title="Reset"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-medical-primary text-white font-bold rounded-xl shadow-lg hover:bg-medical-secondary transition-all active:scale-95"
          >
            {isAr ? 'عرض النتائج' : 'Apply Filters'}
          </button>
        </div>
      </div>
    </div>
  );
};