interface PlatformLoadingIndicatorProps {
  label: string;
}

export function PlatformLoadingIndicator({
  label,
}: PlatformLoadingIndicatorProps): React.JSX.Element {
  return (
    <div className="platform-loading-indicator">
      <span>{label}</span>
      <span className="platform-loading-indicator-progress" aria-hidden="true" />
    </div>
  );
}
