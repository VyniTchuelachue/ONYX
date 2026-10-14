'use client';

import { createContext, useContext } from 'react';

export interface ShellActions {
  openEmergency(): void;
  openLocation(): void;
}

export const ShellActionsContext = createContext<ShellActions>({
  openEmergency: () => {},
  openLocation: () => {},
});

export const useShellActions = () => useContext(ShellActionsContext);
