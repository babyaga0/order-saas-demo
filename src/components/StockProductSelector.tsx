'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

type Variation = {
  variationId: number;
  shortCode: string;
  size: string;
  length: string;
  price: number;
  stock: number;
};

type Product = {
  productId: number;
  productName: string;
  shortCode: string;
  basePrice: number;
  totalStock: number;
  variations: Variation[];
};

export type OrderItem = {
  productId: number;
  variationId: number | null;
  productName: string;
  shortCode: string;
  size: string | null;
  length: string | null;
  price: number;
  quantity: number;
};

type Props = {
  storeId: string;
  onItemsChange: (items: OrderItem[]) => void;
};

function getFitType(name: string): string {
  const words = name.trim().toUpperCase().split(/\s+/);
  if (words.length >= 2 && words[1] === 'FIT') return `${words[0]} FIT`;
  return words[0];
}

export default function StockProductSelector({ storeId, onItemsChange }: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    api.get(`/stock/store/${storeId}/products`)
      .then(res => {
        if (res.data.success) setProducts(res.data.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId]);

  const filteredProducts = products.filter(p => {
    if (!search) return true;
    return p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.shortCode.toLowerCase().includes(search.toLowerCase());
  });

  const grouped = Object.entries(
    filteredProducts.reduce((acc, p) => {
      const fit = getFitType(p.productName);
      if (!acc[fit]) acc[fit] = [];
      acc[fit].push(p);
      return acc;
    }, {} as Record<string, Product[]>)
  );

  const addToCart = (item: OrderItem) => {
    setCartItems(prev => {
      const key = `${item.productId}-${item.variationId}`;
      const exists = prev.findIndex(i => `${i.productId}-${i.variationId}` === key);
      let next: OrderItem[];
      if (exists >= 0) {
        next = prev.map((i, idx) => idx === exists ? { ...i, quantity: i.quantity + item.quantity } : i);
      } else {
        next = [...prev, item];
      }
      onItemsChange(next);
      return next;
    });
    setSelectedProduct(null);
  };

  const handleProductClick = (product: Product) => {
    // Accessory (no variations) → add directly
    if (product.variations.length === 0) {
      addToCart({
        productId: product.productId,
        variationId: null,
        productName: product.productName,
        shortCode: product.shortCode,
        size: null,
        length: null,
        price: product.basePrice,
        quantity: 1,
      });
      return;
    }
    // Single variation → add directly
    const available = product.variations.filter(v => v.stock > 0);
    if (available.length === 1) {
      const v = available[0];
      addToCart({
        productId: product.productId,
        variationId: v.variationId,
        productName: product.productName,
        shortCode: v.shortCode,
        size: v.size || null,
        length: v.length || null,
        price: v.price,
        quantity: 1,
      });
      return;
    }
    // Multiple → open size picker
    setSelectedProduct(product);
  };

  const updateQty = (idx: number, delta: number) => {
    setCartItems(prev => {
      const next = prev.map((item, i) => {
        if (i !== idx) return item;
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      });
      onItemsChange(next);
      return next;
    });
  };

  const removeItem = (idx: number) => {
    setCartItems(prev => {
      const next = prev.filter((_, i) => i !== idx);
      onItemsChange(next);
      return next;
    });
  };

  const total = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher un produit..."
        className="input-field"
      />

      {/* Products grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Chargement des produits...</div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
          {grouped.map(([fit, prods]) => (
            <div key={fit}>
              <p className="text-xs font-bold text-gray-400 uppercase mb-2">{fit}</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {prods.map(product => {
                  const outOfStock = product.totalStock === 0;
                  return (
                    <button
                      key={product.productId}
                      type="button"
                      onClick={() => !outOfStock && handleProductClick(product)}
                      disabled={outOfStock}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        outOfStock
                          ? 'bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed'
                          : 'bg-white border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                      }`}
                    >
                      <p className="font-medium text-sm text-gray-900">{product.productName}</p>
                      <p className="text-xs text-gray-500">{product.shortCode}</p>
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
                        outOfStock
                          ? 'bg-gray-100 text-gray-400'
                          : product.totalStock <= 3
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {outOfStock ? '0 en stock' : `${product.totalStock} en stock`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {grouped.length === 0 && !loading && (
            <p className="text-center text-gray-500 py-4">Aucun produit trouvé</p>
          )}
        </div>
      )}

      {/* Cart */}
      {cartItems.length > 0 && (
        <div className="border border-orange-200 rounded-lg p-4 bg-orange-50 space-y-3">
          <p className="text-sm font-semibold text-gray-700">Panier ({cartItems.length} article{cartItems.length > 1 ? 's' : ''})</p>
          {cartItems.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-orange-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                <p className="text-xs text-gray-500">
                  {item.size ? `T${item.size}${item.length ? `/L${item.length}` : ''}` : item.shortCode}
                  {' · '}{item.price.toFixed(2)} DH
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <button type="button" onClick={() => updateQty(idx, -1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm hover:bg-gray-200">−</button>
                <span className="text-sm font-bold w-4 text-center">{item.quantity}</span>
                <button type="button" onClick={() => updateQty(idx, 1)} className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center text-sm hover:bg-gray-200">+</button>
                <button type="button" onClick={() => removeItem(idx)} className="ml-1 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
              </div>
            </div>
          ))}
          <div className="flex justify-between items-center pt-1 border-t border-orange-200">
            <span className="text-sm text-gray-600">Total estimé</span>
            <span className="font-bold text-orange-600">{total.toFixed(2)} DH</span>
          </div>
        </div>
      )}

      {/* Size picker modal */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-900">{selectedProduct.productName}</h3>
                <p className="text-sm text-gray-500">Choisir la taille</p>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {selectedProduct.variations.map(v => {
                const outOfStock = v.stock === 0;
                const label = v.size
                  ? (v.length ? `T${v.size}/L${v.length}` : `T${v.size}`)
                  : v.shortCode;
                return (
                  <button
                    key={v.variationId}
                    type="button"
                    disabled={outOfStock}
                    onClick={() => addToCart({
                      productId: selectedProduct.productId,
                      variationId: v.variationId,
                      productName: selectedProduct.productName,
                      shortCode: v.shortCode,
                      size: v.size || null,
                      length: v.length || null,
                      price: v.price,
                      quantity: 1,
                    })}
                    className={`p-3 rounded-lg border text-center ${
                      outOfStock
                        ? 'bg-gray-50 border-gray-200 opacity-40 cursor-not-allowed'
                        : 'bg-white border-gray-300 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
                    <p className="text-sm font-bold">{label}</p>
                    <p className={`text-xs mt-0.5 ${outOfStock ? 'text-gray-400' : 'text-green-600'}`}>
                      {outOfStock ? '0' : v.stock} en stock
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
