import React from 'react';

type StyledInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  style?: React.CSSProperties;
};

export function StyledInput({ className = '', style = {}, ...props }: StyledInputProps) {
  // Removed padding classes (py-5, px-4)
  const baseClasses =
    'w-full rounded-md text-black placeholder:text-[#999999] placeholder:font-light placeholder:text-base focus:outline-none focus:ring-1 focus:ring-[#212121] focus:border-[#212121] disabled:opacity-75';

  // Define border and padding styles explicitly
  const explicitStyles: React.CSSProperties = {
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#D9D9D9',
    boxSizing: 'border-box',
    paddingTop: '1.25rem',    // Equivalent to py-5
    paddingBottom: '1.25rem', // Equivalent to py-5
    paddingLeft: '1rem',      // Equivalent to px-4
    paddingRight: '1rem',     // Equivalent to px-4
  };

  // Combine base classes with any additional classes passed via props
  const combinedClasses = `${baseClasses} ${className}`.trim();

  // Merge inline styles - passed styles take precedence over default explicit styles
  const combinedStyles = { ...explicitStyles, ...style };

  return <input className={combinedClasses} style={combinedStyles} {...props} />;
} 