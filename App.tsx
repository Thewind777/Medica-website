import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { InvoiceView } from './components/InvoiceView';
import { Loading } from './components/Loading';
import { FilterDrawer } from './components/FilterDrawer';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { CATEGORIES } from './data';
import { api } from './api';
import { Product, ViewState, Language, CartItem, FilterCriteria, CategoryId } from './types';
import { XCircle, CheckCircle, Package, AlertTriangle, ArrowRight, User, ShoppingBag, X, Filter, History as HistoryIcon, Download, Phone, SlidersHorizontal, LayoutGrid, List, Search } from 'lucide-react';
import { calculatePrice, performFuzzySearch, formatCurrency, getRemainingMonths } from './utils';
import { Home, LogOut } from 'lucide-react';

// --- MAIN APP ---
function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('ar');
  const [viewState, setViewState] = useState<ViewState | 'history'>('catalog');
  const [searchTerm, setSearchTerm] = useState('');

  const isAr = language === 'ar';

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userIdentifier, setUserIdentifier] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginRegion, setLoginRegion] = useState(''); // New State
  const [isRegisterMode, setIsRegisterMode] = useState(false); // New State
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Conflict Modal
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState<{ matchName: string; matchRegion: string } | null>(null);

  // Cart & Order
  const [cart, setCart] = useState<{ [id: string]: number }>({});
  const [orderLoading, setOrderLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ orderId: string } | null>(null);

  // Filter State
  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterCriteria>({
    showSorOnly: false,
    showNewOnly: false,
    hideOutOfStock: false,
    minPrice: '',
    maxPrice: '',
    minExpiryMonths: 0,
    selectedBrands: []
  });

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // --- INITIAL DATA FETCH ---
  useEffect(() => {
    async function loadData() {
      try {
        const data = await api.getProducts();
        setProducts(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadData();

    // Check Persistence
    const storedAuth = localStorage.getItem('noreva_auth');
    if (storedAuth) {
      try {
        const auth = JSON.parse(storedAuth);
        setIsLoggedIn(true);
        setPharmacyId(auth.id);
        setUserIdentifier(auth.name);
      } catch (e) {
        localStorage.removeItem('noreva_auth');
      }
    }
  }, []);

  // --- AUTH HANDLERS ---
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName || (!loginPhone && !loginEmail)) {
      setLoginError(language === 'ar' ? 'يرجى إدخال الاسم ورقم الهاتف' : 'Please enter Name and Phone');
      return;
    }

    // Register Validation
    if (isRegisterMode && !loginRegion) {
      setLoginError(language === 'ar' ? 'يرجى إدخال المنطقة' : 'Please enter Region');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    try {
      let res;
      if (isRegisterMode) {
        res = await api.register({ name: loginName, phone: loginPhone, email: loginEmail, region: loginRegion });
      } else {
        res = await api.login({ name: loginName, phone: loginPhone, email: loginEmail });
      }

      if (res.status === 'conflict') {
        const errorMsg = res.error || (isAr ? 'يوجد تعارض في البيانات' : 'Data Conflict');
        // If specific error, show it
        if (res.error) throw new Error(res.error);

        // Otherwise show modal (legacy path possible?)
        setConflictData(res.possibleMatch ? { matchName: res.possibleMatch.name, matchRegion: res.possibleMatch.region } : { matchName: 'Existing Pharmacy', matchRegion: '' });
        setShowConflictModal(true);
        setLoginLoading(false);
        return;
      }

      if (res.error) {
        // Map explicit backend errors
        if (res.error.toLowerCase().includes('registered')) setLoginError(language === 'ar' ? 'هذا الرقم غير مسجل، يرجى إنشاء حساب' : 'Phone not registered. Please Sign Up.');
        else if (res.error.toLowerCase().includes('conflict') || res.error.toLowerCase().includes('match')) setLoginError(language === 'ar' ? 'بيانات غير متطابقة' : 'Data mismatch (Phone/Email).');
        else setLoginError(res.error);
        throw new Error(res.error);
      }

      // Success (New or Found)
      const user = res.customer || { id: 'new-' + Date.now(), name: loginName };
      const authData = { id: user.id || 'N/A', name: user.name };

      localStorage.setItem('noreva_auth', JSON.stringify(authData));
      setPharmacyId(authData.id);
      setUserIdentifier(authData.name);
      setIsLoggedIn(true);
      setLoginModalOpen(false);
      setIsRegisterMode(false); // Reset mode

      // If was history, go there
      if (viewState === 'history') {
        // Stay there
      }
    } catch (err: any) {
      // Fallback error
      if (!loginError) setLoginError(err.message || (isAr ? 'فشل العملية' : 'Login Failed'));
    } finally {
      if (!showConflictModal) setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm(isAr ? 'هل تريد تسجيل الخروج؟' : 'Do you want to logout?')) {
      localStorage.removeItem('noreva_auth');
      setIsLoggedIn(false);
      setUserIdentifier('');
      setPharmacyId('');
      setViewState('catalog');
    }
  };

  const handleHistoryClick = () => {
    if (isLoggedIn) {
      setViewState('history');
    } else {
      setLoginError(isAr ? 'يرجى تسجيل الدخول لعرض السجل' : 'Please log in to view order history');
      setLoginModalOpen(true);
    }
  };

  const handleConflictConfirm = () => {
    const authData = { id: 'CONFIRMED-' + loginName, name: conflictData?.matchName || loginName };
    localStorage.setItem('noreva_auth', JSON.stringify(authData));
    setPharmacyId(authData.id);
    setUserIdentifier(authData.name);
    setIsLoggedIn(true);
    setShowConflictModal(false);
    setLoginModalOpen(false);
  };

  // --- CART HANDLERS ---
  const handleQuantityChange = (id: string, qty: number) => {
    setCart(prev => {
      const next = { ...prev };
      if (qty > 0) next[id] = qty;
      else delete next[id];
      return next;
    });
  };

  const cartList: CartItem[] = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const product = products.find(p => p.id === id);
      if (!product) return null;
      return { product, quantity: qty };
    }).filter((item): item is CartItem => item !== null);
  }, [cart, products]);

  const cartItemCount = cartList.length;

  const cartTotal = useMemo(() => {
    return cartList.reduce((acc, item) => {
      const { total } = calculatePrice(item.product.price, item.quantity);
      return acc + total;
    }, 0);
  }, [cartList]);

  const handleOrderSubmit = async (note: string) => {
    setOrderLoading(true);
    try {
      const orderData = {
        pharmacyId,
        customerNote: note,
        items: cartList.map(item => ({
          id: item.product.id,
          code: item.product.norCode,
          name: item.product.nameEn,
          qty: item.quantity,
          price: item.product.price
        }))
      };

      const result = await api.submitOrder(orderData);
      if (result.orderId) {
        setSuccessData({ orderId: result.orderId });
        setViewState('success');
        setCart({});
      } else {
        throw new Error('No Order ID returned');
      }
    } catch (e: any) {
      alert(language === 'ar' ? `فشل الطلب: ${e.message}` : `Order Failed: ${e.message}`);
    } finally {
      setOrderLoading(false);
    }
  };

  // --- UTILS ---
  const availableBrands = useMemo(() => {
    return Array.from(new Set(products.map(p => p.brandLine))).sort();
  }, [products]);

  const activeFilterCount = [
    filters.showSorOnly,
    filters.showNewOnly,
    filters.hideOutOfStock,
    filters.minPrice,
    filters.maxPrice,
    filters.minExpiryMonths > 0,
    filters.selectedBrands.length > 0
  ].filter(Boolean).length;

  // --- FILTERING ---
  const recommendedProducts = useMemo(() => {
    // Simple "Recommended" logic: New items or Best Sellers (mocked by Stock 'low')
    return products.filter(p => p.isNew || p.stockLevel === 'low').slice(0, 8);
  }, [products]);

  const { filteredProducts, isRecommendation } = useMemo(() => {
    let result = products;
    let isRec = false;

    if (activeCategory !== 'all') {
      result = result.filter(p => p.category === activeCategory);
    }

    if (searchTerm) {
      const searchResults = performFuzzySearch(result, searchTerm);
      if (searchResults.length === 0) {
        // If 0 matches, show recommended
        result = recommendedProducts;
        isRec = true;
      } else {
        result = searchResults;
      }
    }

    // Apply advanced filters ONLY if it's not a recommendation fallback
    if (!isRec) {
      if (filters.showSorOnly) result = result.filter(p => p.isSor);
      if (filters.showNewOnly) result = result.filter(p => p.isNew);
      if (filters.hideOutOfStock) result = result.filter(p => p.stockLevel !== 'out');

      if (filters.minPrice) {
        const min = parseFloat(filters.minPrice);
        if (!isNaN(min)) result = result.filter(p => p.price >= min);
      }
      if (filters.maxPrice) {
        const max = parseFloat(filters.maxPrice);
        if (!isNaN(max)) result = result.filter(p => p.price <= max);
      }

      if (filters.minExpiryMonths > 0) {
        result = result.filter(p => {
          const rem = getRemainingMonths(p.expiryDate);
          return rem >= filters.minExpiryMonths;
        });
      }

      if (filters.selectedBrands.length > 0) {
        result = result.filter(p => filters.selectedBrands.includes(p.brandLine));
      }
    }

    return { filteredProducts: result, isRecommendation: isRec };
  }, [products, activeCategory, searchTerm, filters, recommendedProducts]);


  if (loading) return <Loading />;

  // --- RENDER ---
  return (
    <div className={`min-h-screen bg-medical-background ${language === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      <Navbar
        language={language}
        setLanguage={setLanguage}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        cartItemCount={cartItemCount}
        onCartClick={() => setViewState('checkout')}
        isCartOpen={viewState === 'checkout'}
        isLoggedIn={isLoggedIn}
        onLoginClick={isLoggedIn ? handleLogout : () => setLoginModalOpen(true)}
        onHistoryClick={handleHistoryClick}
        userIdentifier={userIdentifier}
      />

      <FilterDrawer
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        language={language}
        brands={availableBrands}
      />

      <ThemeSwitcher />

      {viewState === 'catalog' && (
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 pb-28">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 mb-10">
            {/* Left Side: Filter & Categories */}
            <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
              <button
                onClick={() => setIsFilterOpen(true)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold border transition-all shadow-sm flex-shrink-0 ${activeFilterCount > 0 ? 'bg-medical-dark text-white border-medical-dark' : 'bg-white text-medical-subtext border-gray-200 hover:border-gray-300'}`}
              >
                <Filter className="w-4 h-4" />
                <span>{isAr ? 'تصفية' : 'Filters'}</span>
                {activeFilterCount > 0 && (
                  <span className="bg-white text-medical-dark w-5 h-5 rounded-full flex items-center justify-center text-xs">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              <div className="h-full w-px bg-gray-200 mx-2 hidden sm:block"></div>

              <div className="flex overflow-x-auto pb-2 sm:pb-0 gap-2 w-full no-scrollbar">
                <button onClick={() => setActiveCategory('all')} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm whitespace-nowrap ${activeCategory === 'all' ? 'bg-medical-primary text-white shadow-md ring-2 ring-medical-primary/20' : 'bg-white text-medical-subtext border border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}>
                  {isAr ? 'الكل' : 'All Products'}
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm whitespace-nowrap ${activeCategory === cat.id ? 'bg-medical-primary text-white shadow-md ring-2 ring-medical-primary/20' : 'bg-white text-medical-subtext border border-gray-200 hover:border-gray-300 hover:text-gray-700'}`}>
                    {isAr ? cat.labelAr : cat.labelEn}
                  </button>
                ))}
              </div>
            </div>

            {/* Right Side: View Toggle */}
            <div className="flex items-center justify-between w-full xl:w-auto gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-400 font-medium lg:hidden">
                <SlidersHorizontal size={16} />
                <span>{filteredProducts.length} Items</span>
              </div>
              <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1.5 shadow-sm ms-auto xl:ms-0">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-medical-background text-medical-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><LayoutGrid className="w-5 h-5" /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-medical-background text-medical-primary shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}><List className="w-5 h-5" /></button>
              </div>
            </div>
          </div>

          {/* Search Fallback Warning */}
          {isRecommendation && (
            <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                <Search size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-800">{isAr ? 'لم يتم العثور على نتائج مطابقة' : 'No exact matches found'}</p>
                <p className="text-xs text-gray-500">{isAr ? `إليك بعض الاقتراحات لـ "${searchTerm}"` : `Showing recommended items instead for "${searchTerm}"`}</p>
              </div>
            </div>
          )}

          <div className={viewMode === 'grid' ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" : "flex flex-col gap-3"}>
            {filteredProducts.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                language={language}
                quantity={cart[product.id] || 0}
                onQuantityChange={handleQuantityChange}
                viewMode={viewMode}
              />
            ))}
          </div>
          {filteredProducts.length === 0 && !isRecommendation && (
            <div className="col-span-full py-20 text-center text-gray-400 flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4"><XCircle className="w-8 h-8 opacity-40" /></div>
              <h3 className="text-lg font-bold text-gray-900">{isAr ? 'لا توجد منتجات' : 'No products found'}</h3>
              <p className="text-sm mt-2">{isAr ? 'حاول تغيير معايير التصفية' : 'Try adjusting your filters or search.'}</p>
              <button onClick={() => { setFilters({ showSorOnly: false, showNewOnly: false, hideOutOfStock: false, minPrice: '', maxPrice: '', minExpiryMonths: 0, selectedBrands: [] }); setSearchTerm(''); setActiveCategory('all'); }} className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200">
                {isAr ? 'إلغاء التصفية' : 'Clear Filters'}
              </button>
            </div>
          )}
        </main>
      )}

      {viewState === 'checkout' && (
        <InvoiceView
          cart={cartList}
          language={language}
          onBack={() => setViewState('catalog')}
          onSubmit={handleOrderSubmit}
          updateQuantity={handleQuantityChange}
          isLoggedIn={isLoggedIn}
          onLoginReq={() => setLoginModalOpen(true)}
        />
      )}

      {/* RESTORED: History View */}
      {viewState === 'history' && (
        <div className="max-w-4xl mx-auto p-8 animate-fade-in">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setViewState('catalog')} className="p-2 hover:bg-gray-100 rounded-full">
              {isAr ? <ArrowRight /> : <ArrowRight className="rotate-180" />}
            </button>
            <h2 className="text-2xl font-bold">{isAr ? 'سجل الطلبات' : 'Order History'}</h2>
          </div>

          {/* Empty State for Demo */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HistoryIcon className="text-gray-400" size={32} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{isAr ? 'لا توجد طلبات سابقة' : 'No Previous Orders'}</h3>
            <p className="text-gray-500 mt-2">{isAr ? 'ستظهر طلباتك هنا بمجرد إتمام أول عملية شراء.' : 'Your orders will appear here once you complete your first purchase.'}</p>
            <button
              onClick={() => setViewState('catalog')}
              className="mt-6 px-6 py-2 bg-medical-primary text-white font-bold rounded-lg hover:bg-medical-secondary"
            >
              {isAr ? 'تصفح المنتجات' : 'Browse Products'}
            </button>
          </div>
        </div>
      )}

      {/* Success View */}
      {viewState === 'success' && successData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center animate-scale-in">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{language === 'ar' ? 'تم استلام الطلب!' : 'Order Received!'}</h2>
            <p className="text-gray-500 mb-6 font-mono bg-gray-50 p-2 rounded border border-gray-100">
              ID: <span className="text-medical-primary font-bold">{successData.orderId}</span>
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { setViewState('catalog'); setSuccessData(null); }} className="w-full py-3 bg-medical-primary text-white rounded-xl font-bold hover:bg-medical-secondary transition-colors">
                {language === 'ar' ? 'عودة للتسوق' : 'Continue Shopping'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login / Register Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setLoginModalOpen(false)} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <User className="text-medical-primary" />
              {language === 'ar' ? (isRegisterMode ? 'تسجيل صيدلية جديدة' : 'تسجيل الدخول') : (isRegisterMode ? 'Register New Pharmacy' : 'Pharmacy Login')}
            </h2>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'اسم الصيدلية' : 'Pharmacy Name'}</label>
                <input type="text" required value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" placeholder="Al-Amal Pharmacy" />
              </div>

              {isRegisterMode && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'المدينة / المنطقة' : 'City / Region'}</label>
                  <input type="text" required value={loginRegion} onChange={e => setLoginRegion(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" placeholder="Tripoli..." />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                  <input type="tel" required value={loginPhone} onChange={e => setLoginPhone(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" placeholder="09X..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'البريد (اختياري)' : 'Email (Optional)'}</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" />
                </div>
              </div>

              {loginError && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{loginError}</p>}

              <button type="submit" disabled={loginLoading} className="w-full py-3 bg-medical-primary text-white font-bold rounded-xl hover:bg-medical-secondary disabled:opacity-50 transition-colors">
                {loginLoading ? '...' : (language === 'ar' ? (isRegisterMode ? 'إنشاء حساب' : 'دخول') : (isRegisterMode ? 'Create Account' : 'Login'))}
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => { setIsRegisterMode(!isRegisterMode); setLoginError(''); }}
                  className="text-sm text-medical-primary hover:underline font-medium"
                >
                  {language === 'ar'
                    ? (isRegisterMode ? 'لديك حساب بالفعل؟ تسجيل الدخول' : 'ليس لديك حساب؟ سجل الآن')
                    : (isRegisterMode ? 'Already have an account? Login' : 'No account? Register here')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Conflict Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center border-t-8 border-amber-500">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">{language === 'ar' ? 'هل هذه صيدليتك؟' : 'Is this your pharmacy?'}</h3>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 text-start">
              <p className="text-sm text-gray-500 mb-1">{language === 'ar' ? 'وجدنا تطابقاً مع:' : 'We found a match for:'}</p>
              <p className="font-bold text-lg text-gray-800">{conflictData?.matchName}</p>
              <p className="text-sm text-gray-600">{conflictData?.matchRegion}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConflictModal(false)} className="flex-1 py-2.5 border border-gray-300 rounded-lg font-bold text-gray-600 hover:bg-gray-50">
                {language === 'ar' ? 'لا، هاتف آخر' : 'No, Use different info'}
              </button>
              <button onClick={handleConflictConfirm} className="flex-1 py-2.5 bg-medical-primary text-white rounded-lg font-bold hover:bg-medical-secondary">
                {language === 'ar' ? 'نعم، أنا' : 'Yes, This is me'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESTORED: Floating Checkout Bar */}
      {viewState === 'catalog' && cartItemCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-40 animate-slide-up bg-gradient-to-t from-white via-white to-transparent pointer-events-none">
          <div className="pointer-events-auto max-w-4xl mx-auto bg-medical-primary text-white rounded-2xl shadow-2xl shadow-medical-primary/30 p-4 flex items-center justify-between cursor-pointer hover:bg-medical-secondary transition-colors group" onClick={() => setViewState('checkout')}>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center font-bold text-lg backdrop-blur-sm">
                {cartItemCount}
              </div>
              <div className="flex flex-col">
                <span className="text-xs text-blue-100 font-medium uppercase tracking-wider">{isAr ? 'الإجمالي' : 'Total'}</span>
                <span className="text-xl font-bold">{formatCurrency(cartTotal, language)}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-bold pe-2">
              <span>{isAr ? 'مراجعة الطلب' : 'Review Order'}</span>
              <div className="w-8 h-8 bg-white text-medical-primary rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                {isAr ? <ArrowRight className="w-5 h-5 rotate-180" /> : <ArrowRight className="w-5 h-5" />}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;