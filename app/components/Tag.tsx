import React from 'react';

interface TagProps {
  label?: string;
  value: string | number;
  icon?: React.ReactNode;
  isCertification?: boolean;
}

export function Tag({ label, value, icon, isCertification = false }: TagProps) {
  if (isCertification) {
    return (
      <div className="flex w-full items-center justify-center bg-slate-100 rounded px-2 py-2 text-xs text-slate-600 mr-1 mb-1">
        {icon && <span className="mr-1">{icon}</span>}
        <span className="font-medium">{value}</span>
      </div>
    );
  } else {
    if (!label) {
        console.warn('Tag component missing required prop: label');
        return null;
    }
    return (
      <div className="inline-block bg-[#EEF2F5] rounded px-2 py-0.5 text-xs mr-1 mb-1">
        <span className="font-normal text-gray-600">{label}: </span>
        <span className="font-bold text-black">{value}</span>
      </div>
    );
  }
} 