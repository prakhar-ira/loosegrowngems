import {useState, useCallback, useEffect} from 'react';
import {useFetcher} from '@remix-run/react';
import {useAside} from '~/components/Aside';

// Types
type ProductCreationResponse = {
  success: boolean;
  merchandiseId?: string;
  productHandle?: string;
  error?: string;
  errors?: Array<{field: string; message: string}>;
};

type ProductData = {
  title: string;
  description?: string;
  productType?: string;
  vendor?: string;
  tags?: string[];
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type?: string;
  }>;
  variants?: Array<{
    price: string;
    compareAtPrice?: string;
  }>;
  images?: string[];
};

type CartOperationState = {
  isCreatingProduct: boolean;
  isAddingToCart: boolean;
  createdMerchandiseId: string | null;
  error: string | null;
  successMessage: string | null;
};

type UseCartOperationsReturn = {
  // State
  state: CartOperationState;
  
  // Actions
  createProduct: (productData: ProductData) => Promise<void>;
  addToCart: (merchandiseId: string, quantity?: number) => Promise<void>;
  resetState: () => void;
  
  // Utilities
  isProcessing: boolean;
  
  // Cart form handlers
  handleCartSuccess: (cartData: any, productTitle: string) => void;
  handleCartError: (errors: any) => void;
};

// Utility functions
function validateProductData(productData: ProductData): {isValid: boolean; errors: string[]} {
  const errors: string[] = [];
  
  if (!productData) {
    errors.push('No product data provided');
  } else {
    if (!productData.title) {
      errors.push('Product title is required');
    }
    if (!productData.description) {
      errors.push('Product description is required');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

export function useCartOperations(): UseCartOperationsReturn {
  const {open} = useAside();
  const createProductFetcher = useFetcher<ProductCreationResponse>();
  
  // State
  const [state, setState] = useState<CartOperationState>({
    isCreatingProduct: false,
    isAddingToCart: false,
    createdMerchandiseId: null,
    error: null,
    successMessage: null,
  });

  // Derived state
  const isProcessing = state.isCreatingProduct || state.isAddingToCart || 
                      createProductFetcher.state === 'submitting';

  // Handle product creation response
  useEffect(() => {
    if (createProductFetcher.data) {
      const response = createProductFetcher.data;
      
      if (response.success && response.merchandiseId) {
        console.log('✅ Product created successfully:', {
          merchandiseId: response.merchandiseId,
          productHandle: response.productHandle
        });
        
        setState(prev => ({
          ...prev,
          createdMerchandiseId: response.merchandiseId || null,
          error: null,
          isCreatingProduct: false,
        }));
      } else {
        console.error('❌ Product creation failed:', response.error || response.errors);
        
        setState(prev => ({
          ...prev,
          error: response.error || 'Product creation failed',
          isCreatingProduct: false,
        }));
      }
    }
  }, [createProductFetcher.data]);

  // Create product in Shopify
  const createProduct = useCallback(async (productData: ProductData) => {
    // Validate product data
    const validation = validateProductData(productData);
    if (!validation.isValid) {
      setState(prev => ({
        ...prev,
        error: validation.errors.join(', '),
      }));
      return;
    }

    console.log('🔨 Creating product in Shopify...');
    
    setState(prev => ({
      ...prev,
      isCreatingProduct: true,
      error: null,
    }));

    const formData = new FormData();
    formData.append('productData', JSON.stringify(productData));

    createProductFetcher.submit(formData, {
      method: 'POST',
      action: '/create-product',
    });
  }, [createProductFetcher]);

  // Add item to cart
  const addToCart = useCallback(async (merchandiseId: string, quantity: number = 1) => {
    console.log('🛒 Adding to cart:', {merchandiseId, quantity});
    
    setState(prev => ({
      ...prev,
      isAddingToCart: true,
      error: null,
    }));

    // This would typically be handled by CartForm, but we're providing the interface
    // for potential future direct cart API calls
    try {
      // Simulate cart addition (in real implementation, this would call cart API)
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setState(prev => ({
        ...prev,
        isAddingToCart: false,
        successMessage: 'Item added to cart!',
      }));
      
      // Open cart drawer
      open('cart');
      
      // Reset after success
      setTimeout(() => {
        setState(prev => ({
          ...prev,
          createdMerchandiseId: null,
          successMessage: null,
        }));
      }, 3000);
      
    } catch (error) {
      console.error('❌ Cart addition failed:', error);
      setState(prev => ({
        ...prev,
        isAddingToCart: false,
        error: 'Failed to add item to cart. Please try again.',
      }));
    }
  }, [open]);

  // Reset state
  const resetState = useCallback(() => {
    setState({
      isCreatingProduct: false,
      isAddingToCart: false,
      createdMerchandiseId: null,
      error: null,
      successMessage: null,
    });
  }, []);

  // Handle cart success (called from CartForm)
  const handleCartSuccess = useCallback((cartData: any, productTitle: string) => {
    console.log('🛒 Item successfully added to cart:', {
      totalQuantity: cartData.cart?.totalQuantity,
      lines: cartData.cart?.lines?.length
    });
    
    setState(prev => ({
      ...prev,
      successMessage: `${productTitle} added to cart!`,
      createdMerchandiseId: null,
      error: null,
    }));
    
    // Open cart drawer
    open('cart');
    
    // Clear success message after 3 seconds
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        successMessage: null,
      }));
    }, 3000);
  }, [open]);

  // Handle cart error (called from CartForm)
  const handleCartError = useCallback((errors: any) => {
    console.error('❌ Cart addition failed:', errors);
    setState(prev => ({
      ...prev,
      error: 'Failed to add item to cart. Please try again.',
      createdMerchandiseId: null,
    }));
  }, []);

  return {
    state,
    createProduct,
    addToCart,
    resetState,
    isProcessing,
    // Expose handlers for CartForm
    handleCartSuccess,
    handleCartError,
  };
} 