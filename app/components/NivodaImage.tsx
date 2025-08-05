import {useEffect, useState} from 'react';

interface NivodaImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
}

export function NivodaImage({
  src,
  alt,
  className,
  width,
  height,
}: NivodaImageProps) {
  const [imgSrc, setImgSrc] = useState<string | null>(src || null);
  const [loading, setLoading] = useState(!src);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setLoading(true);
    setError(false);

    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // Try to load the image
    const img = new Image();

    img.onload = () => {
      console.log('Nivoda image loaded successfully:', src);
      setImgSrc(src);
      setLoading(false);
    };

    img.onerror = () => {
      console.error('Failed to load Nivoda image:', src);
      setError(true);
      setLoading(false);

      // If it's an S3 URL with query parameters, try to use a proxy
      if (src.includes('nivoda-images.s3') && src.includes('?')) {
        console.log('Attempting to proxy S3 image URL');

        // Option: Use imgix or another image CDN here if you have one set up
        // setImgSrc(`https://your-imgix-proxy.imgix.net/${encodeURIComponent(src)}`);

        // For now, just keep the original URL - browser may still work with it
        setImgSrc(src);
      }
    };

    // Start loading
    img.src = src;

    // Cleanup
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  if (loading) {
    return (
      <div
        className={`animate-pulse bg-gray-200 flex items-center justify-center ${className}`}
      >
        <svg
          className="w-10 h-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    );
  }

  if (error || !imgSrc) {
    return (
      <div
        className={`bg-gray-100 flex flex-col items-center justify-center ${className}`}
      >
        <svg
          className="w-10 h-10 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-sm text-gray-500 mt-2">Image unavailable</p>
      </div>
    );
  }

  return (
    <img
      src={imgSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
    />
  );
}
