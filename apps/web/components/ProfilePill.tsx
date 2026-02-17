export function ProfilePill({ username, photoUrl }:{ username:string; photoUrl?: string | null }) {
  return (
    <div className="profilePill">
      <div className="avatar">
        {photoUrl ? <img src={photoUrl} alt="" referrerPolicy="no-referrer" /> : null}
      </div>
      <div style={{fontWeight:900}}>{username}</div>
    </div>
  );
}
