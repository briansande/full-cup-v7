'use client';
import React from 'react';

export type StatusMessageType = 'error' | 'success' | 'warning' | 'info' | 'loading';

export interface StatusMessageAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
}

export interface StatusMessageProps {
  type: StatusMessageType;
  message: string;
  actions?: StatusMessageAction[];
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  showIcon?: boolean;
}

const StatusMessage: React.FC<StatusMessageProps> = ({
  type,
  message,
  actions = [],
  dismissible = false,
  onDismiss,
  className = '',
  showIcon = true
}) => {
  const getIcon = () => {
    if (!showIcon) return null;

    switch (type) {
      case 'error':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'success':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'loading':
        return (
          <div className="w-4 h-4 flex-shrink-0">
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
          </div>
        );
      default:
        return null;
    }
  };

  const getTypeStyles = () => {
    switch (type) {
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'loading':
        return 'bg-gray-50 border-gray-200 text-gray-700';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700';
    }
  };

  const getButtonVariant = (variant: StatusMessageAction['variant'] = 'primary') => {
    switch (variant) {
      case 'primary':
        return 'btn btn-sm bg-red-600 hover:bg-red-700 text-white border-red-600';
      case 'secondary':
        return 'btn btn-sm bg-blue-600 hover:bg-blue-700 text-white border-blue-600';
      case 'outline':
        return 'btn btn-sm btn-outline border-current text-current hover:bg-current hover:text-white';
      case 'ghost':
        return 'btn btn-sm btn-ghost text-current hover:bg-current hover:bg-opacity-10';
      default:
        return 'btn btn-sm';
    }
  };

  return (
    <div className={`inline-flex items-start gap-2 p-3 rounded-lg border text-sm ${getTypeStyles()} ${className}`}>
      {getIcon()}
      <div className="flex-1 min-w-0">
        <div className="flex-1">{message}</div>
        {actions.length > 0 && (
          <div className="flex gap-2 mt-2">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={getButtonVariant(action.variant)}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {dismissible && onDismiss && (
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-current hover:opacity-75 transition-opacity"
          aria-label="Dismiss message"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default StatusMessage;