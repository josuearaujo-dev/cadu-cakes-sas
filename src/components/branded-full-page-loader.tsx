type Props = {
  message?: string;
};

/** Tela cheia com logo do cliente (pulso) — navegação RSC ou gate de dados iniciais. */
export function BrandedFullPageLoader({ message = "Carregando…" }: Props) {
  return (
    <div className="branded-full-page-loader" role="status" aria-live="polite" aria-busy="true">
      <div className="branded-full-page-loader__content">
        {/* eslint-disable-next-line @next/next/no-img-element -- loader leve, sem otimização */}
        <img
          src="/cadu-cakes-logo.svg"
          alt="Cadu Cakes"
          width={120}
          height={120}
          className="branded-full-page-loader__logo"
        />
        <p className="branded-full-page-loader__text">{message}</p>
      </div>
    </div>
  );
}
