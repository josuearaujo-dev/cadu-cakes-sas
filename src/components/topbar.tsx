type Props = {
  title: string;
  subtitle: string;
};

export function Topbar({ title, subtitle }: Props) {
  return (
    <header className="topbar">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </header>
  );
}
