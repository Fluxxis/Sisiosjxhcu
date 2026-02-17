export function TopBar() {
  return (
    <div className="topRow">
      <button
        className="closeBtn"
        type="button"
        onClick={() => {
          try {
            // @ts-ignore
            window.Telegram?.WebApp?.close?.();
          } catch {}
        }}
      >
        Закрыть
      </button>
      <div className="titleBlock">
        <div className="title">Raise TON</div>
        <div className="subtitle">мини-приложение</div>
      </div>
      <button className="iconBtn" type="button">⋯</button>
    </div>
  );
}
