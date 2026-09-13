import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const TABBABLE_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

function getTabbableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR));
  return elements.filter((el) => !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1');
}

export function Modal({ open, onClose, title, description, children, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const tabbable = getTabbableElements(dialogRef.current);
      if (tabbable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = tabbable[0]!;
      const last = tabbable[tabbable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    if (open) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      document.addEventListener('keydown', handleEscape);
      document.addEventListener('keydown', handleTab);
      document.body.style.overflow = 'hidden';
      // Move focus to the close button on open
      const timer = setTimeout(() => {
        const tabbable = dialogRef.current ? getTabbableElements(dialogRef.current) : [];
        if (tabbable.length > 0) {
          tabbable[0]!.focus();
        } else {
          dialogRef.current?.focus();
        }
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener('keydown', handleEscape);
        document.removeEventListener('keydown', handleTab);
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [open, onClose]);

  useEffect(() => {
    return () => {
      // Restore focus when component unmounts while open
      previouslyFocusedRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (!open) {
      previouslyFocusedRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div ref={dialogRef} className="w-full max-w-lg rounded-lg bg-white shadow-lg" tabIndex={-1}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  );
}
