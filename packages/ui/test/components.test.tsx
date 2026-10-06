import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  AdSlot,
  BackButton,
  BigNumberInput,
  BottomTabs,
  Button,
  Chip,
  DatePicker,
  EmptyState,
  FilterPill,
  GarageSwitcher,
  InfoTile,
  InlineLabelInput,
  Input,
  ManageButton,
  PlateInput,
  PlateTag,
  ProgressBar,
  RadioCard,
  RouteBar,
  Segmented,
  Select,
  Sheet,
  SideNav,
  SidePanel,
  Skeleton,
  StatTile,
  StatusBadge,
  TAB_ICONS,
  ToastViewport,
  ToneBadge,
  VehicleCard,
  toast,
} from '../src/index.ts';

describe('Button', () => {
  it('renders variants with an accessible name and the water hover on outline', () => {
    render(
      <>
        <Button>Salvar</Button>
        <Button variant="outline">Está certo</Button>
        <Button loading>Consultando…</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Salvar' })).not.toHaveAttribute('data-water');
    expect(screen.getByRole('button', { name: 'Está certo' })).toHaveAttribute('data-water', '');
    expect(screen.getByRole('button', { name: 'Consultando…' })).toHaveAttribute('aria-busy', 'true');
  });

  it('round buttons expose labels', () => {
    render(
      <>
        <BackButton />
        <ManageButton />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerenciar veículo' })).toBeInTheDocument();
  });
});

describe('inputs', () => {
  it('Input, BigNumberInput and InlineLabelInput accept text', async () => {
    render(
      <>
        <Input aria-label="Buscar item" placeholder="Buscar item" />
        <BigNumberInput aria-label="Km" suffix="km" defaultValue="" />
        <InlineLabelInput label="Marca da peça" />
      </>,
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Buscar item' }), 'óleo');
    expect(screen.getByRole('textbox', { name: 'Buscar item' })).toHaveValue('óleo');
    expect(screen.getByRole('textbox', { name: 'Km' })).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('textbox', { name: 'Marca da peça' })).toBeInTheDocument();
  });

  it('PlateInput normalizes to 7 uppercase alphanumerics', async () => {
    function Wrapper() {
      const [v, setV] = useState('');
      return <PlateInput aria-label="Placa" value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    await userEvent.type(screen.getByRole('textbox', { name: 'Placa' }), 'abc-1d23x');
    expect(screen.getByRole('textbox', { name: 'Placa' })).toHaveValue('ABC1D23');
  });
});

describe('Select', () => {
  it('opens a listbox, filters and picks with the keyboard', async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Marca"
        searchPlaceholder="Buscar marca"
        searchable
        options={['Chevrolet', 'Fiat', 'Volkswagen']}
        value=""
        onChange={onChange}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Marca' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
    await userEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await userEvent.type(screen.getByPlaceholderText('Buscar marca'), 'volks{Enter}');
    expect(onChange).toHaveBeenCalledWith('Volkswagen', { value: 'Volkswagen', label: 'Volkswagen' });
  });

  it('shows the empty message', async () => {
    render(<Select label="Modelo" searchable options={['Onix']} value="" onChange={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Modelo' }));
    await userEvent.type(screen.getByLabelText('Buscar'), 'xyz');
    expect(screen.getByText('Nada encontrado para "xyz"')).toBeInTheDocument();
  });
});

describe('DatePicker', () => {
  it('opens a dialog and clears with the custom label', async () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        label="Data da troca"
        placeholder="Não lembro"
        clearLabel="Não lembro"
        max="today"
        value=""
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Data da troca/ }));
    expect(screen.getByRole('dialog', { name: 'Escolher data' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próximo' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Não lembro' }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});

describe('display', () => {
  it('badges, bars and tiles', () => {
    render(
      <>
        <StatusBadge status="over">Vencido</StatusBadge>
        <ToneBadge tone="ok">Nada consta</ToneBadge>
        <ProgressBar status="warn" percent={85} label="Óleo do motor" />
        <StatTile tone="over" value={2} label="vencido" />
        <InfoTile label="Trocas registradas" value={8} />
        <Skeleton />
        <EmptyState>Nenhum item encontrado.</EmptyState>
        <PlateTag plate="ABC1D23" />
        <RouteBar />
      </>,
    );
    expect(screen.getByText('Vencido')).toBeInTheDocument();
    expect(screen.getByText('Nada consta')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Óleo do motor' })).toHaveAttribute('aria-valuenow', '85');
    expect(screen.getByRole('button', { name: /2\s*vencido/ })).toBeInTheDocument();
    expect(screen.getByText('Trocas registradas')).toBeInTheDocument();
    expect(screen.getByText('ABC1D23')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Carregando' })).toBeInTheDocument();
  });

  it('pills, chips, segmented and radio cards expose state', async () => {
    const onPick = vi.fn();
    render(
      <>
        <FilterPill active>Todos</FilterPill>
        <Chip>+ Filtro de ar</Chip>
        <Segmented
          label="Tipo de consulta"
          options={[
            { value: 'other', label: 'Outro veículo' },
            { value: 'mine', label: 'Meu Onix' },
          ]}
          value="other"
          onChange={onPick}
        />
        <RadioCard selected={false} onClick={onPick}>
          Laudo cautelar completo
        </RadioCard>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Todos' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '+ Filtro de ar' })).toHaveAttribute('data-water');
    await userEvent.click(screen.getByRole('radio', { name: 'Meu Onix' }));
    expect(onPick).toHaveBeenCalledWith('mine');
    expect(screen.getByRole('radio', { name: 'Laudo cautelar completo' })).toHaveAttribute('aria-checked', 'false');
  });

  it('AdSlot placeholder offers removing ads and hides when off', async () => {
    const onRemove = vi.fn();
    const { rerender } = render(<AdSlot slot="itens-lista" size="in-feed" mode="placeholder" onRemoveAds={onRemove} />);
    expect(screen.getByText('Publicidade')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remover anúncios' }));
    expect(onRemove).toHaveBeenCalled();
    rerender(<AdSlot slot="itens-lista" size="in-feed" mode="off" onRemoveAds={onRemove} />);
    expect(screen.queryByText('Publicidade')).not.toBeInTheDocument();
  });
});

describe('overlays', () => {
  it('Sheet is a modal dialog that closes on Escape and on the scrim', async () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="Registrar troca" onClose={onClose}>
        <button type="button">Salvar</button>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Registrar troca' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('SidePanel renders nothing when closed', () => {
    const { rerender } = render(
      <SidePanel open={false} label="Detalhe" onClose={() => {}}>
        <p>conteúdo</p>
      </SidePanel>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <SidePanel open label="Detalhe" onClose={() => {}}>
        <p>conteúdo</p>
      </SidePanel>,
    );
    expect(screen.getByRole('dialog', { name: 'Detalhe' })).toBeInTheDocument();
  });

  it('toast shows status messages and errors as alerts', () => {
    vi.useFakeTimers();
    render(<ToastViewport />);
    act(() => toast('Troca registrada'));
    expect(screen.getByRole('status')).toHaveTextContent('Troca registrada');
    act(() => toast('Informe o km de quando trocou', 'err'));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o km de quando trocou');
    act(() => vi.advanceTimersByTime(3300));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});

describe('navigation and vehicle', () => {
  const items = [
    { key: 'painel', label: 'Painel', icon: TAB_ICONS.painel, active: true, href: '/', onSelect: vi.fn() },
    { key: 'itens', label: 'Itens', icon: TAB_ICONS.itens, active: false, href: '/itens', onSelect: vi.fn() },
  ];

  it('BottomTabs marks the current page and navigates without reload', async () => {
    render(<BottomTabs items={items} />);
    expect(screen.getByRole('link', { name: 'Painel' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(screen.getByRole('link', { name: 'Itens' }));
    expect(items[1]!.onSelect).toHaveBeenCalled();
  });

  it('SideNav renders the full sidebar and the rail', () => {
    const props = {
      items,
      onRegister: vi.fn(),
      onLookup: vi.fn(),
      lookupHref: '/consultas',
      logoSrc: '/brand/logo-horizontal.png',
      iconSrc: '/brand/icone.png',
      user: { letter: 'R', name: 'Rafael', sub: 'Plano Grátis · 0 créditos', onSelect: vi.fn() },
    };
    const { rerender } = render(<SideNav variant="full" {...props} />);
    expect(screen.getByRole('button', { name: 'Registrar troca' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Consultar placa' })).toBeInTheDocument();
    expect(screen.getByText('Plano Grátis · 0 créditos')).toBeInTheDocument();
    rerender(<SideNav variant="rail" {...props} />);
    expect(screen.getByRole('link', { name: 'Consultas' })).toBeInTheDocument();
  });

  it('GarageSwitcher and VehicleCard', async () => {
    const onPick = vi.fn();
    render(
      <>
        <GarageSwitcher
          vehicles={[
            { id: 'a', name: 'Onix', type: 'car', active: true },
            { id: 'b', name: 'CG 160', type: 'moto', active: false },
          ]}
          onPick={onPick}
          onAdd={() => {}}
        />
        <VehicleCard
          model="Onix"
          brand="Chevrolet"
          year="2019"
          type="car"
          kmLabel="Km estimada"
          km="50.200"
          fipe={{ when: 'atualizada há 3 dias', value: 'R$ 62.400', delta: '▲ 1,2% em 30 dias', trend: 'up' }}
          showFipe
          onManage={() => {}}
          onUpdateKm={() => {}}
        />
      </>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'CG 160' }));
    expect(onPick).toHaveBeenCalledWith('b');
    expect(screen.getByRole('button', { name: 'Adicionar veículo' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Chevrolet Onix' })).toHaveTextContent('50.200');
    expect(screen.getByText('Tabela FIPE · atualizada há 3 dias')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar km' })).toBeInTheDocument();
  });
});
