import type { SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  active?: boolean;
}

export function PurrlixPlayIcon({ active, className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M4.5 4.2C4.5 3.1 5.7 2.4 6.65 2.98L20.15 11.18C21.05 11.73 21.05 13.02 20.15 13.57L6.65 21.77C5.7 22.35 4.5 21.65 4.5 20.55V4.2Z"
        fill={active ? '#8B5CF6' : 'currentColor'}
        fillOpacity={active ? 0.22 : 0.14}
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M8.5 8.1L15.2 12.37L8.5 16.6V8.1Z"
        fill={active ? '#FBBF24' : 'currentColor'}
      />
    </svg>
  );
}

export function PurrlixModpacksIcon({ active, className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M12 2.5L20.5 7.2V16.8L12 21.5L3.5 16.8V7.2L12 2.5Z"
        fill={active ? '#8B5CF6' : 'currentColor'}
        fillOpacity={active ? 0.18 : 0.1}
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M3.8 7.4L12 12L20.2 7.4M12 12V21.2"
        stroke={active ? '#FBBF24' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.3" r="1.4" fill={active ? '#FBBF24' : 'currentColor'} />
    </svg>
  );
}

export function PurrlixSkinsIcon({ active, className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect
        x="6.5"
        y="3"
        width="11"
        height="10.5"
        rx="2"
        fill={active ? '#8B5CF6' : 'currentColor'}
        fillOpacity={active ? 0.2 : 0.12}
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.75"
      />
      <rect x="9" y="7" width="2.2" height="2" rx="0.4" fill={active ? '#FBBF24' : 'currentColor'} />
      <rect x="12.8" y="7" width="2.2" height="2" rx="0.4" fill={active ? '#FBBF24' : 'currentColor'} />
      <path
        d="M4.5 21V18.2C4.5 16.43 5.93 15 7.7 15H16.3C18.07 15 19.5 16.43 19.5 18.2V21"
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PurrlixFpsIcon({ active, className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <path
        d="M4.2 16.5C3.4 14.9 3 13.1 3.2 11.2C3.7 6.8 7.3 3.4 11.7 3.2C16.8 3 21 7.1 21 12.1C21 13.7 20.6 15.2 19.8 16.5"
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M7 16.5C6.6 15.6 6.4 14.6 6.4 13.5"
        stroke={active ? '#FBBF24' : 'currentColor'}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M12 13.2L16.4 8.6"
        stroke={active ? '#FBBF24' : 'currentColor'}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="13.5" r="2.2" fill={active ? '#8B5CF6' : 'currentColor'} />
      <path
        d="M7 19.5H17"
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PurrlixExeIcon({ active, className = 'w-5 h-5', ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} {...props}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="3.5"
        fill={active ? '#8B5CF6' : 'currentColor'}
        fillOpacity={active ? 0.2 : 0.1}
        stroke={active ? '#8B5CF6' : 'currentColor'}
        strokeWidth="1.75"
      />
      <path
        d="M8.5 8.5H11.5V11.5H8.5V8.5ZM12.5 8.5H15.5V11.5H12.5V8.5ZM8.5 12.5H11.5V15.5H8.5V12.5ZM12.5 12.5H15.5V15.5H12.5V12.5Z"
        fill={active ? '#FBBF24' : 'currentColor'}
      />
    </svg>
  );
}

interface ModBadgeIconProps {
  slug?: string;
  category?: string;
  projectType?: 'mod' | 'modpack' | 'shader';
  className?: string;
}

export function ModBadgeIcon({
  slug = '',
  category = '',
  projectType = 'mod',
  className = 'w-6 h-6',
}: ModBadgeIconProps) {
  const key = `${slug} ${category}`.toLowerCase();

  // Sodium / Nvidium — emerald/cyan crystalline atom
  if (key.includes('sodium') || key.includes('nvidium')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <polygon
          points="12,2.5 20,7.2 20,16.8 12,21.5 4,16.8 4,7.2"
          fill="#10B981"
          fillOpacity="0.2"
          stroke="#34D399"
          strokeWidth="1.7"
        />
        <circle cx="12" cy="12" r="3" fill="#34D399" />
        <path d="M12 5.5V9M12 15V18.5M6.5 9L9.5 10.7M14.5 13.3L17.5 15" stroke="#A7F3D0" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }

  // Lithium / ImmediatelyFast — amber lightning core
  if (key.includes('lithium') || key.includes('fast') || key.includes('boost')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" fill="#8B5CF6" fillOpacity="0.18" stroke="#A78BFA" strokeWidth="1.6" />
        <path d="M13 5.8L7.8 13H12L11 18.2L16.2 11H12L13 5.8Z" fill="#FBBF24" />
      </svg>
    );
  }

  // FerriteCore / Memory — indigo iron cube matrix
  if (key.includes('ferrite') || key.includes('memory')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" fill="#38BDF8" fillOpacity="0.3" stroke="#38BDF8" strokeWidth="1.5" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" fill="#38BDF8" fillOpacity="0.15" stroke="#38BDF8" strokeWidth="1.5" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" fill="#38BDF8" fillOpacity="0.15" stroke="#38BDF8" strokeWidth="1.5" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" fill="#38BDF8" fillOpacity="0.45" stroke="#7DD3FC" strokeWidth="1.5" />
      </svg>
    );
  }

  // Iris / Complementary / Shaders — golden-amber optical lens
  if (projectType === 'shader' || key.includes('iris') || key.includes('shader') || key.includes('complementary') || key.includes('bsl')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <circle cx="12" cy="12" r="8.5" fill="#F59E0B" fillOpacity="0.2" stroke="#FBBF24" strokeWidth="1.7" />
        <circle cx="12" cy="12" r="4.2" fill="#8B5CF6" fillOpacity="0.38" stroke="#FDE047" strokeWidth="1.5" />
        <circle cx="10.5" cy="10.5" r="1.2" fill="#FFFFFF" />
      </svg>
    );
  }

  // Distant Horizons — horizon vista peak
  if (key.includes('distant') || key.includes('horizon')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M3 16.5L9 9.5L13.5 14L16.5 11L21 16.5H3Z" fill="#38BDF8" fillOpacity="0.22" stroke="#38BDF8" strokeWidth="1.6" strokeLinejoin="round" />
        <circle cx="17" cy="6.5" r="2" fill="#FBBF24" />
      </svg>
    );
  }

  // EntityCulling — frustum cone prism
  if (key.includes('cull')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M4 12C6.5 7.8 9.3 6 12 6C14.7 6 17.5 7.8 20 12C17.5 16.2 14.7 18 12 18C9.3 18 6.5 16.2 4 12Z" fill="#06B6D4" fillOpacity="0.18" stroke="#22D3EE" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="2.6" fill="#22D3EE" />
      </svg>
    );
  }

  // Modpack — layered phoenix voxel emblem
  if (projectType === 'modpack' || key.includes('optimized') || key.includes('pack')) {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <path d="M12 2.8L20 7.3V16.7L12 21.2L4 16.7V7.3L12 2.8Z" fill="#8B5CF6" fillOpacity="0.22" stroke="#8B5CF6" strokeWidth="1.7" />
        <path d="M7.5 10.2L12 12.8L16.5 10.2M12 12.8V18" stroke="#FBBF24" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  // Default custom geometric mod core
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="4" fill="#8B5CF6" fillOpacity="0.14" stroke="#A78BFA" strokeWidth="1.6" />
      <path d="M9 12L11.2 14.2L15.5 9.8" stroke="#C4B5FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
