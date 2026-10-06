// Converts the prototype globals (window.QR_CATALOG, window.QR_PLANS) into versioned JSON seeds.
// Runs each reference script inside an isolated vm context and serializes the result.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const refDir = join(root, 'docs', 'reference');
const outDir = join(root, 'data');

// Bump whenever data/catalog.json changes; the web publishes /catalog.v{N}.json and the API reports N.
export const CATALOG_VERSION = 1;

function runInWindow(file: string): Record<string, unknown> {
  const window: Record<string, unknown> = {};
  const context = vm.createContext({ window });
  vm.runInContext(readFileSync(join(refDir, file), 'utf8'), context, { filename: file });
  return window;
}

interface RawCategory {
  id: string;
  group: string;
  name: string;
  icon: string[];
  types: string[];
  items: Array<{
    id: string;
    name: string;
    km: number | null;
    months: number | null;
    desc: string;
    insp: boolean;
    types: string[];
  }>;
}

const catalogWindow = runInWindow('catalog.js');
const rawCatalog = catalogWindow['QR_CATALOG'] as {
  categories: RawCategory[];
  total: number;
  icons: Record<string, string[]>;
};

const catalog = {
  version: CATALOG_VERSION,
  total: rawCatalog.total,
  categories: rawCatalog.categories.map(c => ({
    id: c.id,
    group: c.group,
    name: c.name,
    icon: c.icon,
    types: c.types,
    items: c.items.map(i => ({
      id: i.id,
      name: i.name,
      km: i.km || null,
      months: i.months || null,
      desc: i.desc,
      insp: i.insp,
      types: i.types,
    })),
  })),
  icons: rawCatalog.icons,
};

const plansWindow = runInWindow('planos.js');
const rawPlans = plansWindow['QR_PLANS'] as { list: Record<string, unknown> };
// JSON round-trip drops the find() helper; the lookup lives in packages/core and in the API.
const plans = { plans: Object.values(JSON.parse(JSON.stringify(rawPlans.list)) as unknown[]) };

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(join(outDir, 'planos.json'), JSON.stringify(plans, null, 2) + '\n');

const itemCount = catalog.categories.reduce((n, c) => n + c.items.length, 0);
console.log(`catalog.json: ${catalog.categories.length} categories, ${itemCount} items (total ${catalog.total})`);
console.log(`planos.json: ${plans.plans.length} manufacturer plan(s)`);
