import React from 'react';
import { CartLineItem } from './CartLineItem'; // Assuming CartLineItem is in the same directory

// TODO: Implement Cart Drawer component based on Figma design and todo list

interface CartDrawerProps {
  // Define props needed (e.g., cart data, open/close state, action handlers)
  isOpen: boolean;
  onClose: () => void;
  cart: any; // Replace 'any' with a proper type for your cart data
}

export function CartDrawer({ isOpen, onClose, cart }: CartDrawerProps) {
  // Placeholder implementation
  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const summaryHeightClass = cart?.discountCodes?.length > 0
    ? 'with-discount'
    : '';

  if (!isOpen) {
    return null;
  }

  return (
    <div className={`overlay ${isOpen ? 'expanded' : ''}`} onClick={onClose}>
      <button
        className="close-outside"
        onClick={onClose}
        aria-label="Close cart"
      />
      <aside onClick={(e) => e.stopPropagation()}> {/* Prevent closing when clicking inside aside */}
        <header>
          <h3>YOUR CART</h3>
          <button className="close" onClick={onClose} aria-label="Close cart">
            &times; {/* Simple X for close button */}
          </button>
        </header>
        <main className={`cart-main ${summaryHeightClass}`}>
          {linesCount ? (
            cart.lines.nodes.map((line: any) => (
              <CartLineItem key={line.id} line={line} layout="aside" />
            ))
          ) : (
            <p>Your cart is empty.</p>
          )}
        </main>
        {/* Footer structure based on Figma node 87:6160 */}
        <footer className="cart-summary-aside">
          {/* Removed Note Button (Frame 1410104269 in Figma) */}
          {/* 
          <button className="cart-note-button">
            <span>📝</span> 
            <span>Add a note</span>
          </button>
          */}

          {/* Checkout Section (Frame 1410104271 in Figma) */}
          <div className="cart-checkout-section">
            {/* Notice Text (87:6167 in Figma) */}
            {/* TODO: Style text according to Figma style VAFFWF (Helvetica Neue 400 16px, #808080 color) */}
            <p className="cart-checkout-notice">Taxes and shipping calculated at checkout</p>
            
            {/* Checkout Button (87:6168 in Figma) */}
            {/* TODO: Style button according to Figma (black bg, white text), add Link/form for navigation */}
            <button className="cart-checkout-button">
              Proceed to checkout - ${cart?.cost?.totalAmount?.amount ? `${cart.cost.totalAmount.currencyCode} ${cart.cost.totalAmount.amount}` : '0.00'}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
} 