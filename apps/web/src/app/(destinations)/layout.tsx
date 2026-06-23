import { CelestialDestinationRoot } from '@/components/celestial/CelestialDestinationRoot';
import '../celestial-destinations.css';

export default function DestinationsLayout({ children }: { children: React.ReactNode }) {
  return <CelestialDestinationRoot>{children}</CelestialDestinationRoot>;
}
