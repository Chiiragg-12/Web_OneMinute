import logo from '../assets/logo(1).png';

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  return <img className={compact ? 'brand-logo brand-logo-compact' : 'brand-logo'} src={logo} alt="OneMinute Healthcare" />;
}
