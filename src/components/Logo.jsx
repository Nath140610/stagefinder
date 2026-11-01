export function Mark({ size = 28 }) {
  return <img className="logo-mark" src="/logo-mark.png" width={size} height={size} alt="" />
}
export default function Logo() {
  return <span className="logo"><Mark /><img className="brand-banner" src="/Bannier.png" alt="Stage Finder" /></span>
}
