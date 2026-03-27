export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-16 w-16',
  };

  return (
    <div className="animate-spin rounded-full border-b-2 border-primary-500" style={{ width: size === 'sm' ? '16px' : size === 'md' ? '32px' : '64px', height: size === 'sm' ? '16px' : size === 'md' ? '32px' : '64px' }}></div>
  );
}
