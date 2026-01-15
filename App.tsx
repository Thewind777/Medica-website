
import React, { useState, useMemo, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { InvoiceView } from './components/InvoiceView';
import { Loading } from './components/Loading';
import { CATEGORIES } from './data';
import { api, AuthResponse } from './api';
import { Product, ViewState, Language, CartItem, FilterCriteria, CategoryId } from './types';
import { XCircle, CheckCircle, Package, AlertTriangle, ArrowRight, User } from 'lucide-react';
import { calculatePrice, performFuzzySearch } from './utils';

// --- MAIN APP ---
function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<Language>('ar');
  const [viewState, setViewState] = useState<ViewState>('catalog');
  const [searchTerm, setSearchTerm] = useState('');

  // Auth State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userIdentifier, setUserIdentifier] = useState('');
  const [pharmacyId, setPharmacyId] = useState('');
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [loginPhone, setLoginPhone] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
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
  const [showFilters, setShowFilters] = useState(false);
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
      setLoginError(language === 'ar' ? 'يرجى إدخال الاسم ورقم الهاتف أو البريد' : 'Please enter Name and Phone or Email');
      return;
    }
    setLoginLoading(true);
    setLoginError('');

    try {
      const res = await api.login({ name: loginName, phone: loginPhone, email: loginEmail });

      if (res.status === 'conflict') {
        setConflictData(res.possibleMatch ? { matchName: res.possibleMatch.name, matchRegion: res.possibleMatch.region } : { matchName: 'Existing Pharmacy', matchRegion: '' });
        setShowConflictModal(true);
        setLoginLoading(false); // Stop loading to show modal
        return;
      }

      // Success (New or Found)
      const user = res.customer || { id: 'new-' + Date.now(), name: loginName };
      const authData = { id: user.id || 'N/A', name: user.name };

      localStorage.setItem('noreva_auth', JSON.stringify(authData));
      setPharmacyId(authData.id);
      setUserIdentifier(authData.name);
      setIsLoggedIn(true);
      setLoginModalOpen(false);
    } catch (err: any) {
      setLoginError(err.message || 'Login Failed');
    } finally {
      if (!showConflictModal) setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('noreva_auth');
    setIsLoggedIn(false);
    setUserIdentifier('');
    setPharmacyId('');
    setViewState('catalog');
  };

  const handleConflictConfirm = () => {
    // User confirms "This IS me" -> Proceed login
    // In real flow, we might need to verify via SMS or just accept for this demo.
    // For demo: Accept and log them in as the matched user.
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

  // --- FILTERING ---
  const filteredProducts = useMemo(() => {
    let result = products;

    if (activeCategory !== 'all') {
      result = result.filter(p => p.category === activeCategory);
    }

    if (searchTerm) {
      result = performFuzzySearch(result, searchTerm);
    }

    // Apply advanced filters
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
      // Implement expiry filter logic if needed
    }

    if (filters.selectedBrands.length > 0) {
      result = result.filter(p => filters.selectedBrands.includes(p.brandLine));
    }

    return result;
  }, [products, activeCategory, searchTerm, filters]);


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
        onHistoryClick={() => { }}
        userIdentifier={userIdentifier}
      />

      {viewState === 'catalog' && (
        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {/* Category Tabs & View Toggle (Simplified for brevity, similar to original) */}
          <div className="flex justify-between items-center mb-6 overflow-x-auto pb-2 gap-2">
            <div className="flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
              <button onClick={() => setActiveCategory('all')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeCategory === 'all' ? 'bg-medical-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                {language === 'ar' ? 'الكل' : 'All'}
              </button>
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeCategory === cat.id ? 'bg-medical-primary text-white shadow' : 'text-gray-500 hover:bg-gray-50'}`}>
                  {language === 'ar' ? cat.labelAr : cat.labelEn}
                </button>
              ))}
            </div>
            {/* View Mode Toggle */}
            <div className="flex bg-white p-1 rounded-xl border border-gray-200">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-gray-100 text-medical-primary' : 'text-gray-400'}`}>Grid</button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-gray-100 text-medical-primary' : 'text-gray-400'}`}>List</button>
            </div>
          </div>

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
            <button onClick={() => { setViewState('catalog'); setSuccessData(null); }} className="w-full py-3 bg-medical-primary text-white rounded-xl font-bold hover:bg-medical-secondary transition-colors">
              {language === 'ar' ? 'عودة للتسوق' : 'Continue Shopping'}
            </button>
          </div>
        </div>
      )}

      {/* Login Modal */}
      {loginModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setLoginModalOpen(false)} className="absolute top-4 end-4 text-gray-400 hover:text-gray-600"><XCircle size={24} /></button>
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <User className="text-medical-primary" />
              {language === 'ar' ? 'تسجيل الدخول للصيدلية' : 'Pharmacy Login'}
            </h2>
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'اسم الصيدلية' : 'Pharmacy Name'}</label>
                <input type="text" required value={loginName} onChange={e => setLoginName(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" placeholder="Al-Amal Pharmacy" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'رقم الهاتف' : 'Phone'}</label>
                  <input type="tel" value={loginPhone} onChange={e => setLoginPhone(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" placeholder="09X..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{language === 'ar' ? 'البريد (اختياري)' : 'Email (Optional)'}</label>
                  <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-medical-primary/50 outline-none" />
                </div>
              </div>
              {loginError && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{loginError}</p>}
              <button type="submit" disabled={loginLoading} className="w-full py-3 bg-medical-primary text-white font-bold rounded-xl hover:bg-medical-secondary disabled:opacity-50">
                {loginLoading ? '...' : (language === 'ar' ? 'دخول' : 'Login')}
              </button>
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

    </div>
  );
}

export default App;