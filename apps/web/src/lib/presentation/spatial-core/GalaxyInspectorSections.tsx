import type { ReactNode } from 'react';

type SectionProps = {
  title: string;
  children: ReactNode;
};

export function GalaxyInspectorTitle({ children }: { children: ReactNode }) {
  return <h3 className="le-consequence-inspector__title">{children}</h3>;
}

export function GalaxyInspectorStatus({ children }: { children: ReactNode }) {
  return <p className="le-consequence-inspector__status">{children}</p>;
}

export function GalaxyInspectorRequires({ children }: { children: ReactNode }) {
  return <p className="le-consequence-inspector__requires">{children}</p>;
}

export function GalaxyInspectorSection({ title, children }: SectionProps) {
  return (
    <div className="le-consequence-inspector__section">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

export function GalaxyInspectorContext({ children }: { children: ReactNode }) {
  return <p className="le-consequence-inspector__why">{children}</p>;
}

type Item = {
  id: string;
  title: ReactNode;
  hint?: ReactNode;
};

export function GalaxyInspectorItems({ items }: { items: Item[] }) {
  return (
    <div className="le-consequence-inspector__items">
      {items.map((item) => (
        <div key={item.id} className="le-consequence-inspector__item">
          <p className="le-consequence-inspector__item-title">{item.title}</p>
          {item.hint && <span className="le-consequence-inspector__outcome">{item.hint}</span>}
        </div>
      ))}
    </div>
  );
}

export function GalaxyInspectorEmpty({ children }: { children: ReactNode }) {
  return <p className="text-caption">{children}</p>;
}
