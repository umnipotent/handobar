import type { ReactNode } from "react";
import "./AlertBanner.css";


export interface AlertBannerProps {
  message: ReactNode;
  type: "danger" | "warning" | "info";
  onDismiss?: () => void;
  dismissLabel?: string;
}

export function AlertBanner({
  message,
  type,
  onDismiss,
  dismissLabel = "닫기",
}: AlertBannerProps) {
  return (
    <div className={`alert-banner ${type}`} role="status">
      <span>{message}</span>
      {onDismiss && (
        <button
          className="alert-banner-close"
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
        >
          ×
        </button>
      )}
    </div>
  );
}
