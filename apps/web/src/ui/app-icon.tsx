import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react';

interface AppIconProps {
  icon: IconSvgElement;
  size?: number;
}

export function AppIcon({ icon, size = 20 }: AppIconProps): React.JSX.Element {
  return (
    <HugeiconsIcon aria-hidden="true" focusable="false" icon={icon} size={size} strokeWidth={1.8} />
  );
}
