import type { ArrivalWelcomeCopy } from '@/lib/arrival-welcome';

type Props = {
  copy: ArrivalWelcomeCopy;
};

/** Short arrival / brand statement — kept visually quiet. */
export function WelcomeMessage({ copy }: Props) {
  return (
    <h1 id="arrival-welcome-title" className="arrival-welcome__title">
      {copy.title}
    </h1>
  );
}
