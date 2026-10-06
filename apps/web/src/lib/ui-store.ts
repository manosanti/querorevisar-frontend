// UI state that is not server data: open sheet, active vehicle, list filters, consent.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type Tab = 'painel' | 'itens' | 'historico' | 'conta';
export type ItensFilter = 'todos' | 'atencao' | 'ok' | 'none';
export type HistFilter = 'todos' | 'casa' | 'mec' | 'custo';

export type SheetState =
  | { type: 'register'; itemId?: string | null }
  | { type: 'km' }
  | { type: 'vehicle' }
  | { type: 'sold' }
  | { type: 'delete' }
  | { type: 'paywall'; reason: 'veiculo' | 'ads' }
  | { type: 'logout' }
  | { type: 'parts'; itemId: string }
  | { type: 'credits'; need?: number }
  | { type: 'delete-account' }
  | { type: 'install' };

interface UiState {
  activeVehicleId: string | null;
  lastTab: Tab;
  itensFilter: ItensFilter;
  itensQuery: string;
  openCats: Record<string, boolean>;
  histVehicle: 'active' | 'all';
  histFilter: HistFilter;
  histQuery: string;
  sheet: SheetState | null;
  consent: 'granted' | 'denied' | null;
  installGuideShown: boolean;
  setActiveVehicle: (id: string | null) => void;
  openSheet: (sheet: SheetState) => void;
  closeSheet: () => void;
  set: (patch: Partial<UiState>) => void;
}

export const useUi = create<UiState>()(
  persist(
    setState => ({
      activeVehicleId: null,
      lastTab: 'painel',
      itensFilter: 'todos',
      itensQuery: '',
      openCats: {},
      histVehicle: 'active',
      histFilter: 'todos',
      histQuery: '',
      sheet: null,
      consent: null,
      installGuideShown: false,
      setActiveVehicle: id => setState({ activeVehicleId: id, itensFilter: 'todos', itensQuery: '', openCats: {} }),
      openSheet: sheet => setState({ sheet }),
      closeSheet: () => setState({ sheet: null }),
      set: patch => setState(patch),
    }),
    {
      name: 'qr-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: s => ({
        activeVehicleId: s.activeVehicleId,
        lastTab: s.lastTab,
        histVehicle: s.histVehicle,
        consent: s.consent,
        installGuideShown: s.installGuideShown,
      }),
    },
  ),
);

export const closeSheet = () => useUi.getState().closeSheet();
export const openSheet = (s: SheetState) => useUi.getState().openSheet(s);
