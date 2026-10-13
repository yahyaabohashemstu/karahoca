// The admin's shared building blocks. Pages use these instead of inline
// styles so every screen has the same titles, buttons, cards, badges, tabs
// and fields. Guide: ./README.md.
export { Button, IconButton } from './Button';
export type { ButtonProps, ButtonVariant, ButtonSize, IconButtonProps } from './Button';
export { PageHeader, Card, Toolbar, SectionTitle, Loading, EmptyState } from './Layout';
export { Badge, BrandBadge, Alert, StatCard, StatGrid } from './Feedback';
export type { Tone } from './Feedback';
export { StatusBadge } from './StatusBadge';
export { STATUSES, isStatus } from './statusLook';
export type { Status } from './statusLook';
export { Tabs, LangTag, LangLabel } from './Tabs';
export type { TabItem } from './Tabs';
export { Field, Modal, NumberInput } from './Form';
export { AdminIcon } from '../components/AdminIcons';
export { ICON_NAMES } from '../components/iconPaths';
export type { IconName } from '../components/iconPaths';
