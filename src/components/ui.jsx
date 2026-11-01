export const Button = ({ variant = 'primary', ...p }) => <button className={`btn ${variant}`} {...p} />
export const Field = ({ label, children }) => <label className="field"><span>{label}</span>{children}</label>
export const Check = () => (
  <svg className="check" viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l8 8 14-16" /></svg>
)
