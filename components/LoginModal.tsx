import React, { useState } from 'react';
import { Language } from '../types';
import { X, User, Phone, Mail, ArrowRight } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (identifier: string) => void;
  language: Language;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  language
}) => {
  const [identifier, setIdentifier] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const isAr = language === 'ar';

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    
    setIsLoading(true);
    // Simulate API call
    setTimeout(() => {
      onLogin(identifier);
      setIsLoading(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={onClose}></div>

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-slide-up sm:animate-none transform transition-all">
        <div className="bg-medical-primary p-6 text-white text-center relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/10 rounded-full p-1 transition-colors">
            <X size={20} />
          </button>
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <User size={32} />
          </div>
          <h2 className={`text-2xl font-bold ${isAr ? 'font-arabic' : ''}`}>
            {isAr ? 'تسجيل الدخول' : 'Pharmacist Login'}
          </h2>
          <p className="text-blue-100 text-sm mt-1">
            {isAr ? 'قم بالدخول للمتابعة وعرض السجل' : 'Sign in to access history and orders'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-8">
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-bold text-gray-700 mb-2 ${isAr ? 'text-right' : 'text-left'}`}>
                {isAr ? 'رقم الهاتف أو البريد الإلكتروني' : 'Phone Number or Email'}
              </label>
              <div className="relative">
                <div className={`absolute inset-y-0 ${isAr ? 'right-0 pr-3' : 'left-0 pl-3'} flex items-center pointer-events-none text-gray-400`}>
                  <Mail size={18} />
                </div>
                <input 
                  type="text" 
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className={`block w-full py-3 ${isAr ? 'pr-10 pl-3' : 'pl-10 pr-3'} bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-medical-primary/20 focus:border-medical-primary outline-none transition-all`}
                  placeholder={isAr ? "مثال: 0912345678" : "e.g. pharmacy@noreva.ly"}
                  autoFocus
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-medical-dark text-white font-bold py-3.5 rounded-xl hover:bg-medical-primary transition-all shadow-lg hover:shadow-glow active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isAr ? 'دخول آمن' : 'Secure Login'}</span>
                  {isAr ? <ArrowRight className="rotate-180" size={18} /> : <ArrowRight size={18} />}
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            {isAr ? 'بالنقر على دخول، أنت توافق على شروط الاستخدام' : 'By clicking Login, you agree to our Terms of Service.'}
          </p>
        </form>
      </div>
    </div>
  );
};