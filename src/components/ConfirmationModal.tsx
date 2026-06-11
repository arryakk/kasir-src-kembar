import React from 'react';
import { AlertTriangle, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  isAlert?: boolean;
}

export default function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  onConfirm,
  onCancel,
  variant = 'danger',
  isAlert = false
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: <AlertTriangle className="text-red-600" size={32} />,
      bg: 'bg-red-50',
      border: 'border-red-100',
      button: 'bg-red-600 hover:bg-red-700 shadow-red-200'
    },
    warning: {
      icon: <AlertTriangle className="text-yellow-600" size={32} />,
      bg: 'bg-yellow-50',
      border: 'border-yellow-100',
      button: 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-200'
    },
    info: {
      icon: <AlertTriangle className="text-blue-600" size={32} />,
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      button: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'
    },
    success: {
      icon: <Check className="text-green-600" size={32} />,
      bg: 'bg-green-50',
      border: 'border-green-100',
      button: 'bg-green-600 hover:bg-green-700 shadow-green-200'
    }
  };

  const style = variantStyles[variant];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          <div className={`p-6 ${style.bg} border-b ${style.border} flex flex-col items-center text-center`}>
            <div className="mb-4 p-3 bg-white rounded-2xl shadow-sm">
              {style.icon}
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
            <p className="text-gray-600 text-sm leading-relaxed">{message}</p>
          </div>
          
          <div className="p-4 flex gap-3">
            {!isAlert && (
              <button 
                onClick={onCancel}
                className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-all active:scale-95"
              >
                {cancelLabel}
              </button>
            )}
            <button 
              onClick={onConfirm}
              className={`flex-1 py-3 px-4 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg ${style.button}`}
            >
              {isAlert ? 'OK' : confirmLabel}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
