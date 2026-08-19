import type { ReactNode } from "react";
import "./Modal.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** falseの場合、背景クリック・×ボタンでは閉じられない(必須の選択を強制するモーダル用) */
  dismissable?: boolean;
}

export function Modal({ title, onClose, children, dismissable = true }: ModalProps) {
  return (
    <div className="modal-overlay" onClick={dismissable ? onClose : undefined}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-box__header">
          <h2>{title}</h2>
          {dismissable && (
            <button className="modal-box__close" onClick={onClose} aria-label="閉じる">
              ×
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
