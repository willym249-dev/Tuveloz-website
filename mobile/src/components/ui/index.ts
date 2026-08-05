/**
 * The design system's public surface.
 *
 * Import UI primitives from `@/components/ui`, never from their individual
 * files — the barrel is what lets a component be moved or split without
 * touching call sites.
 */
export { Avatar, type AvatarProps } from './avatar';
export { Badge, type BadgeProps } from './badge';
export { Button, type ButtonProps } from './button';
export { Card, CardHeader, type CardProps } from './card';
export { Divider } from './divider';
export { EmptyState, type EmptyStateProps } from './empty-state';
export { ListItem, type ListItemProps } from './list-item';
export { Screen, type ScreenProps } from './screen';
export { ErrorView, LoadingView } from './state-views';
export { Text, type TextProps } from './text';
export { TextField, type TextFieldProps } from './text-field';
