'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';

type ProductAttribute = {
  id: number;
  name: string;
  slug: string;
  option: string;
};

type ProductVariation = {
  id: number;
  productId: number;
  woocommerceId: number;
  sku: string | null;
  price: string | null;
  regularPrice: string | null;
  salePrice: string | null;
  onSale: boolean;
  stockStatus: string | null;
  stockQuantity: number | null;
  imageUrl: string | null;
  attributes: string | null;
};

type Product = {
  id: number;
  woocommerceId: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  sku: string | null;
  price: string | null;
  regularPrice: string | null;
  salePrice: string | null;
  onSale: boolean;
  stockStatus: string | null;
  stockQuantity: number | null;
  imageUrl: string | null;
  categories: string | null;
  tags: string | null;
  attributes: string | null;
  variations: ProductVariation[];
};

type SelectedProduct = {
  product: Product;
  variation: ProductVariation | null;
  quantity: number;
  customPrice?: string;
};

type ProductSelectorProps = {
  onProductsChange: (products: SelectedProduct[]) => void;
};

export default function ProductSelector({ onProductsChange }: ProductSelectorProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);

  useEffect(() => {
    loadProducts();

    // Auto-refresh products every 60 seconds
    const refreshInterval = setInterval(() => {
      loadProducts();
    }, 60000);

    // Refresh when window gains focus
    const handleFocus = () => {
      loadProducts();
    };
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      clearInterval(refreshInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/products?status=publish');
      if (response.data.success) {
        setProducts(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleProductSelect = (product: Product) => {
    // If product has variations, don't add yet - let user select variation
    if (product.type === 'variable' && product.variations.length > 0) {
      const newSelection: SelectedProduct = {
        product,
        variation: null,
        quantity: 1,
      };
      setSelectedProducts([...selectedProducts, newSelection]);
    } else {
      // Simple product, add directly
      const newSelection: SelectedProduct = {
        product,
        variation: null,
        quantity: 1,
      };
      setSelectedProducts([...selectedProducts, newSelection]);
      onProductsChange([...selectedProducts, newSelection]);
    }
    setSearchQuery('');
    setShowDropdown(false);
  };

  const handleVariationSelect = (index: number, variationId: number) => {
    const updated = [...selectedProducts];
    const variation = updated[index].product.variations.find((v) => v.id === variationId);
    if (variation) {
      updated[index].variation = variation;
      setSelectedProducts(updated);
      onProductsChange(updated);
    }
  };

  const handleQuantityChange = (index: number, quantity: number) => {
    const updated = [...selectedProducts];
    updated[index].quantity = Math.max(1, quantity);
    setSelectedProducts(updated);
    onProductsChange(updated);
  };

  const handlePriceChange = (index: number, price: string) => {
    const updated = [...selectedProducts];
    updated[index].customPrice = price;
    setSelectedProducts(updated);
    onProductsChange(updated);
  };

  const handleRemoveProduct = (index: number) => {
    const updated = selectedProducts.filter((_, i) => i !== index);
    setSelectedProducts(updated);
    onProductsChange(updated);
  };

  const getProductPrice = (item: SelectedProduct): string => {
    // Use custom price if set
    if (item.customPrice !== undefined && item.customPrice !== '') {
      return item.customPrice;
    }
    // Otherwise use variation or product price
    if (item.variation) {
      return item.variation.price || '0';
    }
    return item.product.price || '0';
  };

  const getTotalPrice = (): number => {
    return selectedProducts.reduce((total, item) => {
      const price = parseFloat(getProductPrice(item));
      return total + (price * item.quantity);
    }, 0);
  };

  const parseAttributes = (attributesJson: string | null): ProductAttribute[] => {
    if (!attributesJson) return [];
    try {
      return JSON.parse(attributesJson);
    } catch {
      return [];
    }
  };

  const getVariationLabel = (variation: ProductVariation): string => {
    const attributes = parseAttributes(variation.attributes);
    return attributes.map((attr) => `${attr.name}: ${attr.option}`).join(', ');
  };

  return (
    <div>
      {/* Product Search */}
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Rechercher un Produit <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => {
              setShowDropdown(true);
              loadProducts(); // Refresh products when user starts searching
            }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            className="input-field pr-10"
            placeholder="Rechercher par nom ou SKU..."
            autoComplete="off"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Dropdown */}
        {showDropdown && searchQuery && filteredProducts.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
            {filteredProducts.slice(0, 10).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => handleProductSelect(product)}
                className="w-full text-left px-4 py-3 hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-center space-x-3"
              >
                {product.imageUrl && (
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{product.name}</div>
                  <div className="text-sm text-gray-500">
                    {product.sku && <span>SKU: {product.sku} | </span>}
                    <span className="text-orange-600 font-semibold">{product.price} DH</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {showDropdown && searchQuery && filteredProducts.length === 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 text-center text-gray-500">
            Aucun produit trouvé
          </div>
        )}
      </div>

      {/* Selected Products List */}
      {selectedProducts.length > 0 && (
        <div className="space-y-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Produits Sélectionnés</h3>
          {selectedProducts.map((item, index) => (
            <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-start space-x-3">
                {item.product.imageUrl && (
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                )}
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">{item.product.name}</h4>

                  {/* Variation Selector for Variable Products */}
                  {item.product.type === 'variable' && item.product.variations.length > 0 && (
                    <div className="mt-2">
                      <select
                        value={item.variation?.id || ''}
                        onChange={(e) => handleVariationSelect(index, parseInt(e.target.value))}
                        className="input-field text-sm"
                        required
                      >
                        <option value="">Sélectionner une variation</option>
                        {item.product.variations.map((variation) => {
                          const attrs = parseAttributes(variation.attributes);
                          const isOutOfStock = variation.stockStatus !== 'instock' || variation.stockQuantity === 0;
                          const stockInfo = isOutOfStock ? '✗ Rupture de stock' : '✓ En stock';
                          const label = attrs.length > 0
                            ? attrs.map((attr) => `${attr.option}`).join(' / ')
                            : (variation.sku || `Variation #${variation.id}`);
                          return (
                            <option
                              key={variation.id}
                              value={variation.id}
                              disabled={isOutOfStock}
                              className={isOutOfStock ? 'text-gray-400 bg-gray-100' : ''}
                            >
                              {label} - {variation.price} DH {stockInfo}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* Quantity and Price */}
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Prix unitaire (DH)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.customPrice !== undefined ? item.customPrice : (item.variation ? item.variation.price : item.product.price) || ''}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Prix"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Total</label>
                      <div className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-orange-600">
                        {(parseFloat(getProductPrice(item)) * item.quantity).toFixed(2)} DH
                      </div>
                    </div>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  type="button"
                  onClick={() => handleRemoveProduct(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ))}

          {/* Total Price */}
          <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-gray-900">Total:</span>
              <span className="text-2xl font-bold text-orange-600">{getTotalPrice().toFixed(2)} DH</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
