import { PRODUCT_NAME } from '@/lib/product-contract';
import { AtlasLogoMark } from './AtlasLogoMark';

type Props = {
  className?: string;
};

export function AtlasLogo({ className }: Props) {
  return (
    <span className={`atlas-logo${className ? ` ${className}` : ''}`}>
      <AtlasLogoMark className="atlas-logo__mark" />
      <span className="atlas-logo__wordmark">{PRODUCT_NAME}</span>
    </span>
  );
}
