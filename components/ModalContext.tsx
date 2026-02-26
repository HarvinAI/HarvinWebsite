'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import EarlyAccessModal, { ModalType } from './EarlyAccessModal';

interface ModalContextType {
  openModal: (type?: ModalType) => void;
}

const ModalContext = createContext<ModalContextType>({ openModal: () => {} });

export function ModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen]   = useState(false);
  const [type, setType]   = useState<ModalType>('early-access');

  const openModal = (t: ModalType = 'early-access') => {
    setType(t);
    setOpen(true);
  };

  return (
    <ModalContext.Provider value={{ openModal }}>
      {children}
      <EarlyAccessModal open={open} type={type} onClose={() => setOpen(false)} />
    </ModalContext.Provider>
  );
}

export const useModal = () => useContext(ModalContext);
