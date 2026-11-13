import type { GameDoc } from "../../../shared/types";
import { PORTAL_LIFE } from "../model/stepPortals";
export function PortalPanel({
  doc,
  deploy,
  close,
}: {
  doc: GameDoc;
  deploy: () => void;
  close: () => void;
}) {
  const pair = doc.portals,
    draft = doc.portalDraft,
    ratio = pair ? Math.max(0, Math.min(1, pair.entry.life / PORTAL_LIFE)) : 0;
  return (
    <section className="panel portal-panel">
      <div className="section-caption">
        <span>相位传送门</span>
        <span className="mono muted">{pair ? "已连接" : "未部署"}</span>
      </div>
      {pair ? (
        <>
          <div className="portal-bars">
            <div className="bar">
              <i style={{ width: `${ratio * 100}%` }} />
            </div>
          </div>
          <div className="portal-readout">
            <span>
              入口 <b className="mono">A</b>
            </span>
            <span className="portal-link">⇄</span>
            <span>
              出口 <b className="mono">B</b>
            </span>
            <span className="mono portal-life">{pair.entry.life.toFixed(1)}s</span>
          </div>
        </>
      ) : (
        <p className="tiny">
          放置一对双向传送门，让角色、敌人、弹幕与吸附中的晶体按原速改道。
        </p>
      )}
      <div className="portal-actions">
        <button
          className={draft ? "portal-deploy active" : "portal-deploy"}
          onClick={deploy}
          disabled={doc.phase !== "playing"}
        >
          {draft ? "取消部署" : "部署传送门"}
          <kbd>Q</kbd>
        </button>
        <button
          className="portal-close"
          onClick={close}
          disabled={!pair || doc.phase !== "playing"}
        >
          关闭
        </button>
      </div>
      <p className="portal-message" role="status">
        {doc.portalMessage}
      </p>
      {draft && (
        <p className="tiny portal-stage">
          当前：{draft.stage === "entry" ? "1 / 2 选择入口" : "2 / 2 选择出口"}
          <br />
          点击战场放置；出口需远离边界与入口。
        </p>
      )}
    </section>
  );
}
