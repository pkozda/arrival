type Props = {
  label: string;
  disabled: boolean;
  onContinue: () => void;
};

export function ContinueAction({ label, disabled, onContinue }: Props) {
  return (
    <div className="arrival-welcome__continue">
      <button
        type="button"
        className="arrival-welcome__cta"
        disabled={disabled}
        onClick={onContinue}
      >
        {label}
      </button>
    </div>
  );
}
