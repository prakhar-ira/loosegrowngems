import React from 'react';

// Basic Star Icon SVG (replace with your preferred icon if needed)
const StarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 inline-block mr-1.5 align-text-bottom">
    <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
  </svg>
);


const marqueeItems = [
  { icon: <StarIcon />, text: 'Certified Diamonds (GIA & IGI)' },
  { icon: <StarIcon />, text: 'Ethically Sourced Gemstones' },
  { icon: <StarIcon />, text: 'Expert Craftsmanship' },
  { icon: <StarIcon />, text: 'Free Insured Shipping Worldwide' },
  { icon: <StarIcon />, text: 'Lifetime Warranty Included' },
  { icon: <StarIcon />, text: '30-Day Returns' },
  { icon: <StarIcon />, text: 'Bespoke Custom Designs' },
];

export function MarqueeBanner() {
  // Duplicate items for a seamless loop effect
  const doubledItems = [...marqueeItems, ...marqueeItems];

  return (
    <div className="marquee-container bg-black text-white text-xs sm:text-sm overflow-hidden whitespace-nowrap relative py-2 my-4">
      <div className="marquee-content animate-marquee flex">
        {doubledItems.map((item, index) => (
          <span key={index} className="marquee-item mx-4 sm:mx-6 lg:mx-8 flex-shrink-0">
            {item.icon}
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
} 