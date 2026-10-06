// Every packages/ui component with its variants and states, for side-by-side review with the prototype.
import { colors } from '@qr/tokens';
import {
  AdSlot,
  BackButton,
  BigNumberInput,
  Button,
  Card,
  Chip,
  DatePicker,
  EmptyState,
  FilterPill,
  GarageSwitcher,
  InfoTile,
  InlineLabelInput,
  Input,
  ManageButton,
  Notice,
  PlateInput,
  PlateTag,
  PlusIcon,
  ProgressBar,
  RadioCard,
  RouteBar,
  ScreenTitle,
  SectionTitle,
  Segmented,
  Select,
  Sheet,
  Skeleton,
  StatTile,
  StatusBadge,
  Tag,
  ToastViewport,
  ToneBadge,
  VehicleCard,
  toast,
} from '@qr/ui';
import { useState, type ReactNode } from 'react';

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-border py-6">
      <SectionTitle>{title}</SectionTitle>
      <div className="flex flex-wrap items-start gap-3">{children}</div>
    </section>
  );
}

export default function Gallery() {
  const [brand, setBrand] = useState('');
  const [date, setDate] = useState('');
  const [plate, setPlate] = useState('');
  const [seg, setSeg] = useState<'a' | 'b'>('a');
  const [radio, setRadio] = useState(0);
  const [sheet, setSheet] = useState(false);

  return (
    <div className="min-h-screen bg-white px-[22px] py-8 desktop:px-12">
      <ScreenTitle>Design system</ScreenTitle>
      <p className="text-muted">Componentes de packages/ui com os tokens de packages/tokens.</p>

      <Block title="Cores">
        {Object.entries(colors).map(([name]) => (
          <div key={name} className="flex w-[150px] items-center gap-2">
            <span className="h-8 w-8 rounded-8 border border-border" style={{ background: `var(--${name})` }} />
            <span className="text-[12.5px]">--{name}</span>
          </div>
        ))}
      </Block>

      <Block title="Botões">
        <Button>Primário</Button>
        <Button variant="outline">Está certo</Button>
        <Button variant="outline-neutral">Só guardar, sem cadastrar outro</Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="danger">Excluir</Button>
        <Button variant="danger-text">Sair</Button>
        <Button size="pill" icon={<PlusIcon />}>
          Registrar troca
        </Button>
        <Button size="sm">Criar conta</Button>
        <Button size="xl" loading>
          Consultando…
        </Button>
        <BackButton />
        <ManageButton />
        <div className="rounded-16 bg-band p-3">
          <Button variant="light" size="md">
            Claro
          </Button>
        </div>
      </Block>

      <Block title="Campos">
        <div className="w-[320px]">
          <Input placeholder="Buscar item" aria-label="Buscar item" />
        </div>
        <div className="w-[320px]">
          <Input variant="filled" placeholder="E-mail" aria-label="E-mail" />
        </div>
        <div className="w-[320px]">
          <BigNumberInput suffix="km" placeholder="48.000" aria-label="Km" />
        </div>
        <div className="w-[320px]">
          <InlineLabelInput label="Custo (R$)" placeholder="0,00" />
        </div>
        <div className="w-[320px]">
          <Select
            label="Marca"
            searchPlaceholder="Buscar marca"
            searchable
            options={['Chevrolet', 'Fiat', 'Honda', 'Hyundai', 'Toyota', 'Volkswagen', 'Yamaha']}
            value={brand}
            onChange={setBrand}
          />
        </div>
        <div className="w-[320px]">
          <DatePicker
            label="Data da troca"
            placeholder="Não lembro"
            clearLabel="Não lembro"
            max="today"
            value={date}
            onChange={setDate}
          />
        </div>
        <div className="w-[320px]">
          <PlateInput aria-label="Placa" value={plate} onChange={setPlate} />
        </div>
      </Block>

      <Block title="Status">
        <StatusBadge status="over">Vencido</StatusBadge>
        <StatusBadge status="warn">85%</StatusBadge>
        <StatusBadge status="ok">Em dia</StatusBadge>
        <StatusBadge status="none">Sem registro</StatusBadge>
        <ToneBadge tone="ok">Nada consta</ToneBadge>
        <ToneBadge tone="warn">2 em aberto</ToneBadge>
        <ToneBadge tone="over">Consta em 2023</ToneBadge>
        <Tag>Mais escolhido</Tag>
        <PlateTag plate="ABC1D23" />
        <PlateTag plate="ABC1D23" size="lg" />
        <div className="flex w-[320px] flex-col gap-2">
          <ProgressBar status="over" percent={100} />
          <ProgressBar status="warn" percent={85} />
          <ProgressBar status="ok" percent={40} height={6} />
        </div>
      </Block>

      <Block title="Tiles, chips e cards">
        <div className="flex w-[360px] gap-2">
          <StatTile tone="over" value={2} label="vencido" />
          <StatTile tone="warn" value={3} label="em atenção" />
          <StatTile tone="ok" value={12} label="em dia" />
        </div>
        <div className="grid w-[360px] grid-cols-2 gap-2">
          <InfoTile label="Trocas registradas" value={8} />
          <InfoTile label="Gasto informado" value="R$ 1.087,00" />
        </div>
        <FilterPill active>Todos</FilterPill>
        <FilterPill>Precisa de atenção</FilterPill>
        <Chip>+ Filtro de ar</Chip>
        <Card className="w-[320px]">Card</Card>
        <Notice className="w-[320px]">
          Temos o plano do fabricante para este modelo. Os intervalos seguem o manual.
        </Notice>
        <div className="w-[320px]">
          <Segmented
            options={[
              { value: 'a', label: 'Outro veículo' },
              { value: 'b', label: 'Meu Onix' },
            ]}
            value={seg}
            onChange={setSeg}
          />
        </div>
        <div className="flex w-[360px] flex-col gap-2">
          {['1 crédito', '5 créditos', '12 créditos'].map((n, i) => (
            <RadioCard key={n} selected={radio === i} onClick={() => setRadio(i)} aside={<strong>R$ 4,90</strong>}>
              {n}
            </RadioCard>
          ))}
        </div>
      </Block>

      <Block title="Veículo">
        <div className="w-full max-w-[480px] rounded-[0_0_0_40px] bg-band px-[22px] pt-5 pb-[84px]">
          <GarageSwitcher
            vehicles={[
              { id: 'a', name: 'Onix', type: 'car', active: true },
              { id: 'b', name: 'CG 160', type: 'moto', active: false },
            ]}
            onPick={() => {}}
            onAdd={() => {}}
          />
        </div>
        <div className="w-full px-[22px]">
          <VehicleCard
            model="Onix"
            brand="Chevrolet"
            year="2019"
            type="car"
            kmLabel="Km estimada"
            km="50.237"
            fipe={{ when: 'atualizada há 3 dias', value: 'R$ 62.400', delta: '▲ 1,2% em 30 dias', trend: 'up' }}
            showFipe
            onManage={() => {}}
            onUpdateKm={() => {}}
          />
        </div>
      </Block>

      <Block title="Feedback">
        <Button onClick={() => toast('Troca registrada')}>Toast de sucesso</Button>
        <Button variant="danger" onClick={() => toast('Informe o km de quando trocou', 'err')}>
          Toast de erro
        </Button>
        <Button variant="outline" onClick={() => setSheet(true)}>
          Abrir sheet
        </Button>
        <div className="w-[320px]">
          <RouteBar />
        </div>
        <Skeleton style={{ width: 200, height: 22 }} />
        <EmptyState>Nenhum item encontrado.</EmptyState>
        <div className="w-[360px]">
          <AdSlot slot="itens-lista" size="in-feed" mode="placeholder" onRemoveAds={() => {}} />
        </div>
      </Block>

      <Sheet open={sheet} label="Exemplo" onClose={() => setSheet(false)}>
        <h2 className="m-0 text-[22px] font-bold">Sheet</h2>
        <p className="text-muted">Bottom sheet no mobile, painel à direita a partir de 768px.</p>
        <Button block onClick={() => setSheet(false)}>
          Fechar
        </Button>
      </Sheet>
      <ToastViewport />
    </div>
  );
}
