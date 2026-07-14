import type { ArrivalWelcomeCopy } from '@/lib/arrival-welcome';

type Props = {
  copy: ArrivalWelcomeCopy;
};

export function WelcomeMessage({ copy }: Props) {
  return (
    <>
      <h1 id="arrival-welcome-title" className="arrival-welcome__title">
        {copy.title}
      </h1>
      <div className="arrival-welcome__message">
        <p className="arrival-welcome__subtitle">{copy.subtitle}</p>
        <p className="arrival-welcome__trust">{copy.trust}</p>
      </div>
    </>
  );
}
