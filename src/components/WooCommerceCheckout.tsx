import React, { useState } from 'react';
import {
  ShoppingBag,
  CreditCard,
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Building2,
  ArrowRight,
  ShieldCheck,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';
import { faiiyaEngine, INITIAL_PRODUCTS } from '../services/faiiyaEngine';
import { User, StoreOrder } from '../types';

interface WooCommerceCheckoutProps {
  currentUser: User;
  onGoToWallet: () => void;
}

export const WooCommerceCheckout: React.FC<WooCommerceCheckoutProps> = ({
  currentUser,
  onGoToWallet,
}) => {
  const [cart, setCart] = useState<{ productId: number; quantity: number }[]>([
    { productId: 101, quantity: 1 },
    { productId: 104, quantity: 1 },
  ]);
  const [placedOrder, setPlacedOrder] = useState<StoreOrder | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const wallet = faiiyaEngine.getWallet(currentUser.id);
  const virtualAccounts = faiiyaEngine.getVirtualAccounts(currentUser.id);

  const cartItems = cart
    .map((item) => {
      const prod = INITIAL_PRODUCTS.find((p) => p.id === item.productId);
      return prod ? { ...prod, quantity: item.quantity } : null;
    })
    .filter(Boolean) as (typeof INITIAL_PRODUCTS[0] & { quantity: number })[];

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const shipping = subtotal > 0 ? 3500 : 0;
  const total = subtotal + shipping;

  const hasSufficientBalance = wallet.balance >= total;
  const shortfall = total - wallet.balance;

  const addToCart = (productId: number) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as { productId: number; quantity: number }[]
    );
  };

  const handleProcessPayment = () => {
    if (cartItems.length === 0) return;
    setIsProcessing(true);
    setErrorMessage(null);

    setTimeout(() => {
      try {
        const order = faiiyaEngine.processCheckout(
          currentUser.id,
          cartItems.map((item) => ({
            productId: item.id,
            productName: item.name,
            price: item.price,
            quantity: item.quantity,
          }))
        );

        setPlacedOrder(order);
        setCart([]);
      } catch (err: any) {
        setErrorMessage(err.message || 'Payment execution failed.');
      } finally {
        setIsProcessing(false);
      }
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                WooCommerce Simulation
              </span>
              <span className="text-xs text-slate-400">Gateway ID: faiiya_pay_wallet</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">
              Faiiya Pay Closed-Loop Checkout
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
              Simulates a WooCommerce store checkout powered by the Faiiya Pay Payment Gateway class (<code className="text-emerald-300 font-mono">WC_Gateway_Faiiya_Pay</code>).
            </p>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 shrink-0">
            <div className="text-[11px] text-slate-400 font-medium">Logged-in Customer</div>
            <div className="text-sm font-bold text-white">{currentUser.firstName} {currentUser.lastName}</div>
            <div className="text-xs font-mono text-emerald-400 mt-1">
              Balance: ₦{wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {placedOrder ? (
        /* Order Success View */
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-8 text-center max-w-2xl mx-auto shadow-2xl space-y-6">
          <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-8 ring-emerald-500/10">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-bold font-mono text-emerald-400 uppercase tracking-widest">
              Order Complete &bull; Status: Processing
            </span>
            <h2 className="text-2xl font-black text-white">Payment Received Successfully!</h2>
            <p className="text-sm text-slate-400">
              Thank you for your order! Your digital wallet was debited atomically.
            </p>
          </div>

          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 text-left text-xs font-mono space-y-2.5">
            <div className="flex justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Order Reference:</span>
              <span className="text-white font-bold">{placedOrder.orderNumber}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Payment Gateway:</span>
              <span className="text-emerald-400">Faiiya Pay Digital Wallet (faiiya_pay_wallet)</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Transaction UUID:</span>
              <span className="text-slate-300 select-all">{placedOrder.txnUuid}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800/80 pb-2">
              <span className="text-slate-400">Amount Paid:</span>
              <span className="text-white font-bold text-sm">₦{placedOrder.total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-400">Remaining Balance:</span>
              <span className="text-emerald-400 font-bold">
                ₦{wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPlacedOrder(null)}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition-colors"
            >
              Shop Again
            </button>
            <button
              onClick={onGoToWallet}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-colors"
            >
              View in Wallet Ledger
            </button>
          </div>
        </div>
      ) : (
        /* Store & Checkout Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Store Catalog (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
              Store Catalog (Nigerian Merchants)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {INITIAL_PRODUCTS.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-700 transition-all flex flex-col justify-between group"
                >
                  <div className="h-40 overflow-hidden relative">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-bold text-slate-300 border border-slate-700">
                      {prod.category}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                        {prod.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                        {prod.description}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-800">
                      <span className="font-mono font-bold text-sm text-emerald-400">
                        ₦{prod.price.toLocaleString()}
                      </span>
                      <button
                        onClick={() => addToCart(prod.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Checkout & Gateway Drawer (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Cart Summary */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg">
              <h2 className="text-base font-bold text-white mb-3">Cart Summary</h2>

              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Your shopping cart is empty. Add products from the catalog.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="divide-y divide-slate-800/80 max-h-56 overflow-y-auto pr-1">
                    {cartItems.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-200 truncate">{item.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            ₦{item.price.toLocaleString()} each
                          </div>
                        </div>

                        <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                          <button
                            onClick={() => updateQuantity(item.id, -1)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-5 text-center font-mono font-bold text-white">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(item.id, 1)}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="font-mono font-bold text-slate-200">
                          ₦{(item.price * item.quantity).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-3 border-t border-slate-800 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-400">
                      <span>Subtotal</span>
                      <span className="font-mono text-slate-200">₦{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Fast Nationwide Delivery</span>
                      <span className="font-mono text-slate-200">₦{shipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-white pt-2 border-t border-slate-800">
                      <span>Total Amount</span>
                      <span className="font-mono text-emerald-400">₦{total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* WooCommerce Payment Gateway Box: Faiiya Pay Wallet */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full border-4 border-emerald-500 bg-slate-900" />
                  <span className="font-bold text-sm text-white">
                    Faiiya Pay Digital Wallet
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Instant Closed-Loop
                </span>
              </div>

              {/* Gateway payment_fields() representation */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Your Wallet Balance:</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm">
                    ₦{wallet.balance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {!hasSufficientBalance && cartItems.length > 0 ? (
                  /* Insufficient Balance Notice with Virtual Bank Accounts */
                  <div className="bg-red-950/40 border border-red-800/60 p-3.5 rounded-lg space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Insufficient wallet balance. You need ₦{shortfall.toLocaleString()} more.</span>
                    </div>

                    <p className="text-[11px] text-slate-300">
                      Top up instantly by sending a bank transfer to your dedicated Monnify account:
                    </p>

                    <div className="space-y-1 font-mono text-[11px] bg-slate-950/80 p-2 rounded border border-slate-800">
                      {virtualAccounts.map((va) => (
                        <div key={va.id} className="flex justify-between text-slate-300">
                          <span className="text-slate-400">{va.bankName}:</span>
                          <span className="text-white font-bold">{va.accountNumber}</span>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={onGoToWallet}
                      className="w-full text-center text-xs font-bold text-emerald-400 hover:text-emerald-300 pt-1 underline underline-offset-2"
                    >
                      Open Wallet & Simulate Top-Up Transfer &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-lg text-xs text-emerald-300 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                    <span>
                      ✓ Sufficient balance available. ₦{total.toLocaleString()} will be debited atomically upon order confirmation.
                    </span>
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="text-xs text-rose-400 bg-rose-950/40 p-3 rounded-lg border border-rose-800/60">
                  {errorMessage}
                </div>
              )}

              <button
                disabled={!hasSufficientBalance || cartItems.length === 0 || isProcessing}
                onClick={handleProcessPayment}
                className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  hasSufficientBalance && cartItems.length > 0
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/25 cursor-pointer hover:scale-[1.01]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {isProcessing ? (
                  <span>Locking Row & Executing Payment...</span>
                ) : (
                  <>
                    <span>Place Order with Faiiya Wallet</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
