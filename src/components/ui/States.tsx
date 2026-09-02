import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ message = 'No data found.', icon }: EmptyStateProps) {
  return (
    <div className="py-16 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
        {icon || <Inbox size={28} className="text-gray-300" />}
      </div>
      <p className="text-gray-400 text-sm">{message}</p>
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-3 text-sm text-gray-500">{message}</p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
}

export function ErrorState({ message = 'Something went wrong.' }: ErrorStateProps) {
  return (
    <div className="py-16 text-center">
      <p className="text-red-500 text-sm">{message}</p>
    </div>
  );
}
