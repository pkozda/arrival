import type { SupportedLanguage } from '@/lib/product-contract';
import type { ArrivalWelcomeCopy } from '@/lib/arrival-welcome';

export type ArrivalWelcomeLayerProps = {
  suggestedLanguage: SupportedLanguage | null;
  selectedLanguage?: SupportedLanguage;
  supportedLanguages: readonly SupportedLanguage[];
  onSelectLanguage: (language: SupportedLanguage) => void | Promise<void>;
  onComplete: () => void;
};

export type ArrivalWelcomePresentationProps = {
  copy: ArrivalWelcomeCopy;
  suggestedLanguage: SupportedLanguage | null;
  selectedLanguage?: SupportedLanguage;
  supportedLanguages: readonly SupportedLanguage[];
  onSelectLanguage: (language: SupportedLanguage) => void | Promise<void>;
  onContinue: () => void;
  reducedMotion: boolean;
};
