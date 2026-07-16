import "./StaleBanner.scss";

// Shown when the tab returned from a long idle but we chose not to auto-reload
// (admin page or a form in progress). Lets the user refresh on their terms.
export default function StaleBanner({ show }) {
  if (!show) return null;
  return (
    <div className="stale-banner" role="status">
      <span className="stale-banner__text">
        Эта страница устарела — обновите её, чтобы увидеть актуальные данные.
      </span>
      <button
        type="button"
        className="stale-banner__btn"
        onClick={() => window.location.reload()}
      >
        Обновить
      </button>
    </div>
  );
}
