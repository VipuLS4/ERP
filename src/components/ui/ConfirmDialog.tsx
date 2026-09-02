import { AlertTriangle } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div className="flex gap-4">
        {danger && (
          <div className={`flex-shrink-0 p-3 rounded-full ${danger ? 'bg-red-100' : 'bg-blue-100'}`}>
            <AlertTriangle size={24} className={danger ? 'text-red-600' : 'text-blue-600'} />
          </div>
        )}
        <p className="text-sm text-gray-600 pt-2">{message}</p>
      </div>
      <div className="flex gap-3 mt-6">
        <button
          onClick={onConfirm}
          className={`flex-1 py-2 rounded-lg font-medium text-white transition ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition"
        >
          {cancelLabel}
        </button>
      </div>
    </Modal>
  );
}
