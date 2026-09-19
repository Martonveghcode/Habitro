import "./PhysicsRevisionApp.css";

export function PhysicsRevisionApp({ active }: { active: boolean }) {
  return (
    <section
      aria-hidden={!active}
      className={`workspace physics-revision-workspace${active ? "" : " hidden-workspace"}`}
    >
      <iframe
        className="physics-revision-frame"
        src="/physics/index.html"
        title="F&Q Revision"
      />
    </section>
  );
}
