interface PageHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
}

export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="va-page-eyebrow mb-2">{eyebrow}</div>
      <h1 className="va-page-title">{title}</h1>
      {subtitle ? <p className="va-page-sub mt-2">{subtitle}</p> : null}
    </div>
  );
}
