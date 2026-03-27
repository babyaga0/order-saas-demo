'use client';

import { useState } from 'react';
import Image from 'next/image';

type Variation = {
  variationId: number;
  shortCode: string;
  size: string;
  length: string;
  price: number;
  stock: number;
  imageUrl?: string;
};

type Product = {
  productId: number;
  productName: string;
  shortCode: string;
  imageUrl: string | null;
  basePrice: number;
  totalStock: number;
  variations: Variation[];
};

type ProductGridProps = {
  products: Product[];
  searchQuery: string;
  onSelectVariation: (product: Product, variation: Variation) => void;
  isLoading?: boolean;
};

export default function ProductGrid({
  products,
  searchQuery,
  onSelectVariation,
  isLoading = false
}: ProductGridProps) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Filter products by search query
  const filteredProducts = products.filter(product => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      product.productName.toLowerCase().includes(query) ||
      product.shortCode.toLowerCase().includes(query)
    );
  });

  // Group by fit/product type (first word(s) of name)
  const getFitType = (name: string): string => {
    const words = name.trim().toUpperCase().split(/\s+/);
    if (words.length >= 2 && words[1] === 'FIT') return `${words[0]} FIT`;
    return words[0];
  };

  const groupedProducts = Object.entries(
    filteredProducts.reduce((groups, product) => {
      const fit = getFitType(product.productName);
      if (!groups[fit]) groups[fit] = [];
      groups[fit].push(product);
      return groups;
    }, {} as Record<string, Product[]>)
  ).sort(([a], [b]) => a.localeCompare(b));

  const handleProductClick = (product: Product) => {
    if (product.variations.length === 0) {
      // Accessory: no variation, add directly using product data as synthetic variation
      const accessoryAsVariation: Variation = {
        variationId: 0,
        shortCode: product.shortCode,
        size: '',
        length: '',
        price: product.basePrice,
        stock: product.totalStock,
        imageUrl: product.imageUrl || undefined,
      };
      onSelectVariation(product, accessoryAsVariation);
    } else if (product.variations.length === 1) {
      // If only one variation, add directly (only if in stock)
      if (product.variations[0].stock > 0) {
        onSelectVariation(product, product.variations[0]);
      }
    } else {
      // Show size selector
      setSelectedProduct(product);
    }
  };

  const handleVariationSelect = (variation: Variation) => {
    if (selectedProduct && variation.stock > 0) {
      onSelectVariation(selectedProduct, variation);
      setSelectedProduct(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin h-10 w-10 border-4 border-orange-400 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (filteredProducts.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="text-5xl mb-3">📦</p>
          <p className="text-lg">Aucun produit trouve</p>
          {searchQuery && <p className="text-sm mt-1">Essayez une autre recherche</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Product Grid grouped by fit type */}
      <div className="flex-1 p-4 overflow-y-auto space-y-6">
        {groupedProducts.map(([fitType, groupItems]) => (
          <div key={fitType}>
            {/* Group header */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-bold uppercase tracking-widest text-orange-500">{fitType}</span>
              <div className="flex-1 h-px bg-gray-200"></div>
              <span className="text-xs text-gray-400">{groupItems.length} produit{groupItems.length > 1 ? 's' : ''}</span>
            </div>
            {/* Products */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {groupItems.map((product) => (
                <button
                  key={product.productId}
                  onClick={() => handleProductClick(product)}
                  className={`bg-white rounded-lg shadow-sm border-2 overflow-hidden text-left transition-all hover:shadow-md hover:border-orange-300 ${
                    product.totalStock === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Product Image */}
                  <div className="aspect-square bg-gray-100 relative">
                    {product.imageUrl ? (
                      <Image
                        src={product.imageUrl}
                        alt={product.productName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    {/* Stock badge */}
                    <div className={`absolute top-1 right-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      product.totalStock === 0
                        ? 'bg-red-100 text-red-700'
                        : product.totalStock < 5
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                    }`}>
                      {product.totalStock}
                    </div>
                  </div>
                  {/* Product Info */}
                  <div className="p-2">
                    <p className="font-medium text-sm line-clamp-2">{product.productName}</p>
                    <p className="text-xs text-gray-500 truncate">{product.shortCode}</p>
                    <p className="text-orange-600 font-bold text-sm mt-1">
                      {product.basePrice.toFixed(2)} DH
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Size Selector Modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b flex items-center gap-4">
              {selectedProduct.imageUrl && (
                <div className="w-16 h-16 relative rounded-lg overflow-hidden flex-shrink-0">
                  <Image
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.productName}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-lg truncate">{selectedProduct.productName}</h2>
                <p className="text-sm text-gray-500">{selectedProduct.shortCode}</p>
                <p className="text-orange-600 font-bold">{selectedProduct.basePrice.toFixed(2)} DH</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Size Grid */}
            <div className="p-4 overflow-y-auto flex-1">
              <p className="text-sm font-medium text-gray-700 mb-3">Choisir la taille:</p>
              <div className="grid grid-cols-4 gap-2">
                {selectedProduct.variations.map((variation) => (
                  <button
                    key={variation.variationId}
                    onClick={() => handleVariationSelect(variation)}
                    disabled={variation.stock === 0}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      variation.stock === 0
                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-200 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
                    <p className="font-bold text-lg">T{variation.size}</p>
                    {variation.length && (
                      <p className="text-xs text-gray-500">L{variation.length}</p>
                    )}
                    <p className={`text-xs mt-1 font-medium ${
                      variation.stock === 0
                        ? 'text-red-500'
                        : variation.stock < 3
                          ? 'text-yellow-600'
                          : 'text-green-600'
                    }`}>
                      {variation.stock === 0 ? 'Epuise' : `(${variation.stock})`}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t bg-gray-50">
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
