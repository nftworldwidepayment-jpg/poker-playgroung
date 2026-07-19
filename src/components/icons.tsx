// Minimal line-icon set (Feather-style: 24x24 viewBox, stroke=currentColor, no fill)
// used across the app instead of emoji — same visual language everywhere,
// scales cleanly, and inherits text color instead of rendering as a colorful
// platform-specific pictograph.
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(props: IconProps) {
  const { size = 18, ...rest } = props;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconClipboard(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
    </svg>
  );
}

export function IconArmchair(props: IconProps & { active?: boolean }) {
  const { active, ...rest } = props;
  return (
    <svg {...base(rest)} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.18 : 0}>
      <path d="M7 11V6.5a2.5 2.5 0 0 1 5 0v.5M12 7v-.5a2.5 2.5 0 0 1 5 0V11" />
      <path d="M5 11.5A2.5 2.5 0 0 0 2.5 14v3A1.5 1.5 0 0 0 4 18.5h1" />
      <path d="M19 11.5a2.5 2.5 0 0 1 2.5 2.5v3a1.5 1.5 0 0 1-1.5 1.5h-1" />
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M6.5 20v1.5M17.5 20v1.5" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M7 4.5v15l13-7.5-13-7.5Z" />
    </svg>
  );
}

export function IconHelpCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.4a2.8 2.8 0 1 1 4 2.5c-.9.5-1.2 1-1.2 2.1" />
      <circle cx="12" cy="17.3" r="0.4" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBarChart(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function IconVolume2(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9v6h4l5 5V4L8 9H4Z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19.3 6a9 9 0 0 1 0 12" />
    </svg>
  );
}

export function IconVolumeX(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 9v6h4l5 5V4L8 9H4Z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </svg>
  );
}

// A filled 8-tooth gear (not a stroked outline like the rest of the set) — the
// earlier stroke-path attempt had a coordinate error that made the teeth blob
// together into a lumpy circle instead of reading as a gear. Built from a
// straight-edged tooth polygon plus an evenodd inner hole, verified by
// rendering it and visually confirming clean, separated teeth.
export function IconSettings(props: IconProps) {
  const { size = 18, ...rest } = props;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...rest}>
      <path
        fillRule="evenodd"
        d="M10.45 5.07 9.91 2.63h4.18l-.54 2.44 2.25.94 1.34-2.12 2.97 2.97-2.12 1.34.94 2.25 2.44-.54v4.18l-2.44-.54-.94 2.25 2.12 1.34-2.97 2.97-1.34-2.12-2.25.94.54 2.44H9.91l.54-2.44-2.25-.94-1.34 2.12-2.97-2.97 2.12-1.34-.94-2.25-2.44.54V9.91l2.44.54.94-2.25-2.12-1.34 2.97-2.97 1.34 2.12 2.25-.94ZM12 8.8a3.2 3.2 0 1 0 .01 0Z"
      />
    </svg>
  );
}

export function IconCrown(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M3 8.5 7 11l5-6 5 6 4-2.5-1.5 9.5h-15L3 8.5Z" />
    </svg>
  );
}

export function IconBot(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="9" width="16" height="10" rx="2" />
      <path d="M12 5.5v3.5M9 4.5h6" />
      <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none" />
      <path d="M2 13v3M22 13v3" />
    </svg>
  );
}

export function IconEye(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function IconDice(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M10.3 4 2.6 18a1.6 1.6 0 0 0 1.4 2.4h16a1.6 1.6 0 0 0 1.4-2.4L13.7 4a1.6 1.6 0 0 0-2.8 0Z" />
      <path d="M12 9.5v4M12 17h.01" />
    </svg>
  );
}

export function IconZap(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12 2 4 14h6l-1 8 9-13h-6l1-7Z" />
    </svg>
  );
}

export function IconGift(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="9" width="18" height="4" />
      <path d="M12 9v12M4 13v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
      <path d="M12 9c-2.5 0-3.5-1.6-3.5-3A2.5 2.5 0 0 1 11 3.5C12.5 3.5 12 7 12 9Z" />
      <path d="M12 9c2.5 0 3.5-1.6 3.5-3A2.5 2.5 0 0 0 13 3.5C11.5 3.5 12 7 12 9Z" />
    </svg>
  );
}

export function IconSmartphone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="6" y="2" width="12" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function IconLeaf(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M20 4c0 9-6 15-16 15C4 9 10 4 20 4Z" />
      <path d="M5 19c3-3 6-7 12-12" />
    </svg>
  );
}

export function IconSwords(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 19 15 8l3-5 2 2-5 3L4 19Z" />
      <path d="M20 19 9 8 6 3 4 5l5 3 11 11Z" />
    </svg>
  );
}

export function IconFlame(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor" stroke="none">
      <path d="M12.5 2c.6 2.7-1.8 4-2.6 6.3-.6 1.7-.1 3.2 1.1 3.9 1.6.9 3-.4 2.7-2 1.4 1 2.3 2.8 2.3 4.7 0 3.4-2.7 6.1-6 6.1S3.9 18.3 3.9 15c0-3.9 2.4-5.2 3.6-7.9.6-1.4.5-2.7 0-3.8 2 .1 3.7 1.2 5 3.1-.2-1.7 0-3 0-4.4Z" />
    </svg>
  );
}

export function IconThumbsUp(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3Z" />
      <path d="M7 10l4-7a2 2 0 0 1 2 2v4h5.5a2 2 0 0 1 2 2.4l-1.6 7A2 2 0 0 1 17 20H7" />
    </svg>
  );
}

export function IconAlertCircle(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v6M12 16.7h.01" />
    </svg>
  );
}

export function IconFrown(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      {/* control point above the endpoints so the mouth bulges up: a sad "⌢" */}
      <path d="M8.5 16 Q12 12.5 15.5 16" />
      <circle cx="9" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconSmile(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      {/* control point below the endpoints so the mouth bulges down: a happy "⌣" */}
      <path d="M8 13.5 Q12 17 16 13.5" />
      <circle cx="9" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconCards(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="2" y="6" width="13" height="17" rx="2" transform="rotate(-8 8.5 14.5)" />
      <rect x="9" y="4" width="13" height="17" rx="2" />
    </svg>
  );
}

export function IconArrowLeft(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 12H5M11 18l-6-6 6-6" />
    </svg>
  );
}
