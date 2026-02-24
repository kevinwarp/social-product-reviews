"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";

interface ProductImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  className?: string;
}

export function ProductImage({ src, alt, width, height, className }: ProductImageProps) {
  const [error, setError] = useState(false);

  if (error) {
    return <Package className="h-12 w-12 text-muted-foreground" />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      unoptimized
      onError={() => setError(true)}
    />
  );
}
