export function FilterBar({
  onSearch,
  onStatus,
  search,
  status,
  statusOptions = [],
}: {
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  search: string;
  status: string;
  statusOptions?: string[];
}) {
  return (
    <div className="filter-bar">
      <label>
        <span className="sr-only">Buscar</span>
        <input
          defaultValue={search}
          key={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearch(event.currentTarget.value.trim());
          }}
          placeholder="Buscar e pressione Enter"
          type="search"
        />
      </label>
      {statusOptions.length ? (
        <label>
          <span className="sr-only">Filtrar por status</span>
          <select onChange={(event) => onStatus(event.target.value)} value={status}>
            <option value="">Todos os status</option>
            {statusOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export function Pagination({
  canGoBack,
  nextCursor,
  onBack,
  onNext,
}: {
  canGoBack: boolean;
  nextCursor: string | null;
  onBack: () => void;
  onNext: (cursor: string) => void;
}) {
  return (
    <nav aria-label="Paginação" className="pagination">
      <button className="button button-quiet" disabled={!canGoBack} onClick={onBack} type="button">Primeira página</button>
      <button className="button button-quiet" disabled={!nextCursor} onClick={() => nextCursor && onNext(nextCursor)} type="button">Próxima página</button>
    </nav>
  );
}
