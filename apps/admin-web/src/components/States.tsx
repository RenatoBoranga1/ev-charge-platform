export function LoadingState({ label = 'Carregando dados operacionais' }: { label?: string }) {
  return <div className="state-card" role="status"><span className="spinner" />{label}…</div>;
}

export function EmptyState({ message, title = 'Nenhum resultado' }: { message: string; title?: string }) {
  return <div className="state-card"><strong>{title}</strong><p>{message}</p></div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-card state-error" role="alert">
      <strong>Não foi possível carregar</strong>
      <p>{message}</p>
      {onRetry ? <button className="button" onClick={onRetry} type="button">Tentar novamente</button> : null}
    </div>
  );
}

export function PermissionDeniedState() {
  return (
    <div className="state-card state-error" role="alert">
      <strong>Acesso não autorizado</strong>
      <p>Seu papel não possui a permissão exigida para esta área.</p>
    </div>
  );
}
