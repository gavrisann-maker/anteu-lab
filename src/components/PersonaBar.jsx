export default function PersonaBar({ state, actor, setActor }) {
  const people = Object.values(state.participants);
  return (
    <div className="persona">
      <div className="persona-current">
        <span className="avatar avatar-lg" aria-hidden="true">{state.participants[actor].name[0]}</span>
        <div>
          <span className="persona-label">Tu ești</span>
          <strong className="persona-name">{state.participants[actor].name}</strong>
        </div>
      </div>
      <div className="persona-pick">
        <span className="persona-help" id="persona-help">Alege pe altcineva ca să vezi simularea prin ochii lui:</span>
        <div className="avatars" role="radiogroup" aria-labelledby="persona-help">
          {people.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={p.id === actor}
              className={`person-pill ${p.id === actor ? 'on' : ''}`}
              onClick={() => setActor(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
