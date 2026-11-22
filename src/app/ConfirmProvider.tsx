import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from '../components/ui/Overlay';

interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface Pending {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (options) =>
      new Promise<boolean>((resolve) => {
        setPending({ options, resolve });
      }),
    []
  );

  const settle = useCallback(
    (value: boolean) => {
      setPending((current) => {
        current?.resolve(value);
        return null;
      });
    },
    []
  );

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(pending)}
        onClose={() => settle(false)}
        title={pending?.options.title}
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => settle(false)}>
              {pending?.options.cancelLabel || '取消'}
            </button>
            <button
              className={`btn ${pending?.options.danger ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => settle(true)}
            >
              {pending?.options.confirmLabel || '确认'}
            </button>
          </>
        }
      >
        <div className="confirm-message">
          {pending?.options.message || '确定要执行此操作吗？'}
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used inside ConfirmProvider');
  return context;
}
