import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';
import { AppIcon } from '../../ui/app-icon';

interface ListaPreciosSubheaderProps {
  title: string;
  onBack: () => void;
}

export function ListaPreciosSubheader({
  title,
  onBack,
}: ListaPreciosSubheaderProps): React.JSX.Element {
  return (
    <header className="lp-subheader">
      <button className="lp-subheader-back" type="button" onClick={onBack} aria-label="Volver">
        <AppIcon icon={ArrowLeft01Icon} size={22} />
      </button>
      <span className="lp-subheader-title">{title}</span>
      <span className="lp-subheader-spacer" aria-hidden="true" />
    </header>
  );
}
