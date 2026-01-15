import React from 'react';
import { Language, CartItem } from '../types';
import { Search, ShoppingBag, Globe, Menu, X, User, History, LogOut } from 'lucide-react';

interface NavbarProps {
  language: Language;
  setLanguage: (lang: Language) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  cartItemCount: number;
  onCartClick: () => void;
  isCartOpen: boolean;
  isLoggedIn: boolean;
  onLoginClick: () => void;
  onHistoryClick: () => void;
  userIdentifier: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  language,
  setLanguage,
  searchTerm,
  setSearchTerm,
  cartItemCount,
  onCartClick,
  isLoggedIn,
  onLoginClick,
  onHistoryClick,
  userIdentifier
}) => {
  const isAr = language === 'ar';

  const toggleLanguage = () => {
    setLanguage(language === 'en' ? 'ar' : 'en');
  };

  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-6">
          
          {/* Logo & Brand */}
          <div className="flex-shrink-0 flex items-center gap-3 cursor-pointer group" onClick={() => window.location.reload()}>
            <div className="w-10 h-10 bg-gradient-to-br from-medical-primary to-medical-dark rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-glow transition-all">
               <span className="text-white font-bold text-2xl font-sans tracking-tight">n</span>
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-bold text-gray-900 leading-none tracking-tight">noreva</h1>
              <p className="text-[10px] text-gray-400 uppercase tracking-[0.2em] mt-0.5">Distribution</p>
            </div>
          </div>

          {/* Search Bar - Center */}
          <div className="flex-1 max-w-xl relative hidden sm:block">
            <div className="relative group">
              <div className="absolute inset-y-0 start-0 ps-4 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400 group-focus-within:text-medical-primary transition-colors" />
              </div>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`block w-full py-3 ps-11 text-sm text-gray-900 border border-gray-200 rounded-2xl bg-gray-50 focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary focus:bg-white transition-all shadow-sm placeholder-gray-400 ${isAr ? 'text-right' : 'text-left'}`}
                placeholder={isAr ? "بحث السريع (الاسم أو الكود NOR)..." : "Quick Search (Name or NOR Code)..."}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
             {/* History Button */}
            <button 
              onClick={onHistoryClick}
              className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-gray-500 hover:bg-gray-50 hover:text-medical-primary transition-colors"
            >
               <History className="w-5 h-5" />
               <span className="text-xs font-bold hidden lg:inline">{isAr ? 'السجل' : 'History'}</span>
            </button>

             {/* Login/Profile Button */}
            <button 
              onClick={onLoginClick}
              className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl transition-colors ${isLoggedIn ? 'bg-blue-50 text-medical-primary' : 'text-gray-500 hover:bg-gray-50 hover:text-medical-primary'}`}
            >
               {isLoggedIn ? <User className="w-5 h-5" /> : <User className="w-5 h-5" />}
               <span className="text-xs font-bold hidden lg:inline">
                 {isLoggedIn ? (userIdentifier || (isAr ? 'حسابي' : 'Profile')) : (isAr ? 'دخول' : 'Login')}
               </span>
            </button>

            <div className="h-6 w-px bg-gray-200 mx-1 hidden md:block"></div>

            {/* Language Toggle */}
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-medical-primary transition-all text-xs font-bold uppercase tracking-wider"
            >
              <Globe className="w-4 h-4" />
              <span>{isAr ? 'En' : 'عربي'}</span>
            </button>

            {/* Cart Button */}
            <button 
              onClick={onCartClick}
              className="relative p-3 bg-medical-primary text-white rounded-xl shadow-lg hover:shadow-glow hover:bg-medical-secondary transition-all active:scale-95"
            >
              <ShoppingBag className="w-5 h-5" />
              {cartItemCount > 0 && (
                <span className="absolute -top-1.5 -end-1.5 bg-white text-medical-primary text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-gray-50 shadow-sm">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
        
        {/* Mobile Search (visible only on small screens) */}
        <div className="sm:hidden pb-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`block w-full py-2.5 px-4 text-sm text-gray-900 border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary ${isAr ? 'text-right' : 'text-left'}`}
            placeholder={isAr ? "بحث..." : "Search..."}
          />
        </div>
      </div>
    </nav>
  );
};