import React, { useState } from 'react';
import { CartItem, Language } from '../types';
import { calculatePrice, formatCurrency } from '../utils';
import { FileText, Check, ArrowLeft, ArrowRight, ShieldCheck, MessageSquare, Trash2 } from 'lucide-react';

interface InvoiceViewProps {
  cart: CartItem[];
  language: Language;
  onBack: () => void;
  onSubmit: (note: string) => void;
  updateQuantity: (id: string, qty: number) => void;
  isLoggedIn: boolean;
  onLoginReq: () => void;
}

// Sub-component for individual row input to manage local focus/state
const CartRowInput: React.FC<{
  quantity: number;
  onChange: (val: number) => void;
}> = ({ quantity, onChange }) => {
  const [val, setVal] = useState(quantity.toString());

  // Sync internal state if prop changes externally (though in this app, prop changes come from this input mostly)
  React.useEffect(() => {
    setVal(quantity.toString());
  }, [quantity]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setVal(v);
    const n = parseInt(v, 10);
    if (!isNaN(n) && n >= 0) {
      onChange(n);
    }
  };

  const handleBlur = () => {
    if (val === '' || parseInt(val) === 0) {
      onChange(0); // Optional: confirm delete on 0?
    }
  };

  return (
    <div className="flex items-center border border-medical-border rounded-lg bg-white h-10 w-32 overflow-hidden shadow-sm hover:border-medical-primary transition-colors">
      <button onClick={() => onChange(Math.max(0, quantity - 1))} className="w-9 h-full flex items-center justify-center text-medical-subtext hover:bg-medical-background hover:text-medical-primary transition-colors">-</button>
      <input
        type="number"
        className="flex-1 w-full text-center font-bold text-medical-text focus:outline-none bg-transparent"
        value={val}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <button onClick={() => onChange(quantity + 1)} className="w-9 h-full flex items-center justify-center text-medical-subtext hover:bg-medical-background hover:text-medical-primary transition-colors">+</button>
    </div>
  );
};

export const InvoiceView: React.FC<InvoiceViewProps> = ({
  cart,
  language,
  onBack,
  onSubmit,
  updateQuantity,
  isLoggedIn,
  onLoginReq
}) => {
  const isAr = language === 'ar';
  const [note, setNote] = useState('');

  const subtotal = cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);
  const total = cart.reduce((acc, item) => {
    const { total } = calculatePrice(item.product.price, item.quantity);
    return acc + total;
  }, 0);
  const savings = subtotal - total;

  const handleConfirm = () => {
    if (!isLoggedIn) {
      onLoginReq();
    } else {
      onSubmit(note);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in pb-32">
      <button
        onClick={onBack}
        className="mb-6 flex items-center text-medical-subtext hover:text-medical-primary transition-colors gap-2"
      >
        {isAr ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        <span className="font-medium">{isAr ? 'العودة للكتالوج' : 'Back to Catalog'}</span>
      </button>

      <div className="bg-white rounded-xl shadow-lg border border-medical-border overflow-hidden">
        {/* Header */}
        <div className="bg-medical-primary p-6 text-white flex justify-between items-start">
          <div>
            <h2 className={`text-2xl font-bold mb-1 ${isAr ? 'font-arabic' : ''}`}>{isAr ? 'ملخص الطلبية' : 'Order Summary'}</h2>
            <p className="text-white/80 text-sm">#DRAFT-{Math.floor(Math.random() * 10000)}</p>
          </div>
          <FileText className="w-8 h-8 text-white/50" />
        </div>

        {/* List */}
        <div className="divide-y divide-gray-100">
          <div className="hidden sm:grid grid-cols-12 gap-4 p-4 bg-medical-background text-xs font-bold text-medical-subtext uppercase tracking-wider">
            <div className="col-span-6">{isAr ? 'المنتج' : 'Product'}</div>
            <div className="col-span-2 text-center">{isAr ? 'الكمية' : 'Qty'}</div>
            <div className="col-span-2 text-end">{isAr ? 'السعر' : 'Unit Price'}</div>
            <div className="col-span-2 text-end">{isAr ? 'الإجمالي' : 'Total'}</div>
          </div>

          {cart.map((item) => {
            const { unitPrice, total: itemTotal, isDiscounted } = calculatePrice(item.product.price, item.quantity);
            return (
              <div key={item.product.id} className="p-4 flex flex-col sm:grid sm:grid-cols-12 gap-4 items-center hover:bg-medical-background/50 transition-colors group">
                <div className="col-span-6 w-full flex items-center gap-4">
                  <div className="w-14 h-14 rounded-lg bg-white flex-shrink-0 overflow-hidden border border-medical-border p-1">
                    <img
                      src={`/assets/${item.product.norCode.toLowerCase().replace(/\s+/g, '')}.webp`}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (item.product.imageUrl && target.src !== item.product.imageUrl) {
                          target.src = item.product.imageUrl;
                        } else {
                          target.style.display = 'none';
                        }
                      }}
                      className="w-full h-full object-contain"
                      alt={item.product.nameEn}
                    />
                  </div>
                  <div>
                    <div className={`font-bold text-medical-text ${isAr ? 'font-arabic text-base' : 'text-sm'}`}>
                      {isAr ? item.product.nameAr : item.product.nameEn}
                    </div>
                    <div className="text-xs text-medical-subtext font-mono mt-0.5">{item.product.norCode}</div>
                    {item.product.isSor && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 font-medium">
                        <ShieldCheck className="w-3 h-3" /> {isAr ? 'ضمان إرجاع' : 'Sale or Return'}
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-2 flex justify-center w-full sm:w-auto">
                  <CartRowInput
                    quantity={item.quantity}
                    onChange={(newQty) => updateQuantity(item.product.id, newQty)}
                  />
                </div>

                <div className="col-span-2 text-end w-full sm:w-auto flex justify-between sm:block">
                  <span className="sm:hidden text-medical-subtext text-sm">{isAr ? 'السعر:' : 'Price:'}</span>
                  <div>
                    {isDiscounted && <div className="text-xs text-gray-400 line-through">{formatCurrency(item.product.price, language)}</div>}
                    <div className={`text-sm font-bold ${isDiscounted ? 'text-medical-accent' : 'text-medical-text'}`}>{formatCurrency(unitPrice, language)}</div>
                  </div>
                </div>

                <div className="col-span-2 text-end w-full sm:w-auto flex justify-between sm:block border-t border-dashed border-gray-200 sm:border-t-0 pt-2 sm:pt-0 mt-2 sm:mt-0">
                  <span className="sm:hidden font-bold">{isAr ? 'المجموع:' : 'Total:'}</span>
                  <div className="font-bold text-medical-primary text-base">{formatCurrency(itemTotal, language)}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Notes & Footer */}
        <div className="bg-medical-background p-6 border-t border-medical-border">

          {/* Notes Section */}
          <div className="mb-6 bg-white p-4 rounded-xl border border-medical-border focus-within:ring-1 focus-within:ring-medical-primary/50 transition-all shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-medical-text font-bold text-sm">
              <MessageSquare size={16} />
              <span>{isAr ? 'ملاحظات الطلبية' : 'Order Notes'}</span>
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={isAr ? "هل لديك تعليمات خاصة للتوصيل أو الطلب؟ اكتبها هنا..." : "Any special delivery instructions or requests? Write them here..."}
              className="w-full p-2 bg-transparent border-none focus:ring-0 text-sm resize-none h-20 placeholder-gray-400"
            />
          </div>

          <div className="flex flex-col gap-3 max-w-xs ms-auto">
            <div className="flex justify-between text-medical-subtext font-medium">
              <span>{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
              <span>{formatCurrency(subtotal, language)}</span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between text-medical-accent font-bold">
                <span>{isAr ? 'إجمالي الخصم (جملة)' : 'Bulk Savings'}</span>
                <span>- {formatCurrency(savings, language)}</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-extrabold text-medical-text pt-3 border-t border-medical-border">
              <span>{isAr ? 'الإجمالي النهائي' : 'Grand Total'}</span>
              <span>{formatCurrency(total, language)}</span>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-medical-border w-full sm:w-auto shadow-sm">
              <ShieldCheck className="w-5 h-5 text-medical-primary" />
              <div className="text-xs text-medical-subtext">
                <p className="font-bold text-medical-text">{isAr ? 'ضمان الصلاحية والجودة' : 'Quality & Expiry Guarantee'}</p>
                <p>{isAr ? 'جميع المنتجات صالحة لعام 2027 وما بعده' : 'All items expire 2027 or later.'}</p>
              </div>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <button
                onClick={handleConfirm}
                className="w-full flex items-center justify-center gap-2 px-8 py-3 bg-medical-primary hover:bg-medical-secondary text-white font-bold rounded-xl shadow-lg hover:shadow-glow transition-all active:scale-95"
              >
                <Check className="w-5 h-5" />
                {isAr ? 'تأكيد الطلبية' : 'Confirm Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};