export interface PublicMenuItem {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
  children?: PublicMenuItem[];
}
