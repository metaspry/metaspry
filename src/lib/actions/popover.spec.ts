// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOCUSABLE, cycleTab, focusables, popover, type PopoverOptions } from './popover';

/** Just enough of an element for the action: focus, containment, queries, attributes. No DOM needed. */
interface FakeEl {
  name: string;
  isConnected: boolean;
  attrs: Map<string, string>;
  children: FakeEl[];
  focus: () => void;
  contains: (n: unknown) => boolean;
  querySelector: (sel: string) => FakeEl | null;
  querySelectorAll: (sel: string) => FakeEl[];
  hasAttribute: (k: string) => boolean;
  setAttribute: (k: string, v: string) => void;
}

const doc = {
  body: null as unknown as FakeEl,
  activeElement: null as unknown as FakeEl,
  listeners: new Map<string, (event: Event) => void>(),
  addEventListener: (type: string, fn: (event: Event) => void) => doc.listeners.set(type, fn),
  removeEventListener: (type: string) => doc.listeners.delete(type),
};

function el(name: string, children: FakeEl[] = [], selector?: string): FakeEl {
  const self: FakeEl = {
    name,
    isConnected: true,
    attrs: selector ? new Map([['sel', selector]]) : new Map(),
    children,
    focus: () => {
      doc.activeElement = self;
    },
    contains: (n) => n === self || children.includes(n as FakeEl),
    querySelector: (sel) => children.find((c) => c.attrs.get('sel') === sel) ?? null,
    querySelectorAll: (sel) => (sel === FOCUSABLE ? children : []),
    hasAttribute: (k) => self.attrs.has(k),
    setAttribute: (k, v) => self.attrs.set(k, v),
  };
  return self;
}

const asEl = (e: FakeEl) => e as unknown as HTMLElement;
const fire = (type: string, event: object) => doc.listeners.get(type)?.(event as Event);
const key = (k: string, shiftKey = false) => ({ key: k, shiftKey, preventDefault: vi.fn() });
const press = (...path: FakeEl[]) => ({ composedPath: () => path });

beforeEach(() => {
  doc.body = el('body');
  doc.activeElement = doc.body;
  doc.listeners.clear();
  vi.stubGlobal('document', doc);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function mount(overrides: Partial<PopoverOptions> = {}, children: FakeEl[] = [el('first'), el('last')]) {
  const trigger = el('trigger');
  const panel = el('panel', children);
  const onClose = vi.fn();
  const action = popover(asEl(panel), { onClose, trigger: asEl(trigger), ...overrides });
  return { trigger, panel, onClose, action };
}

describe('popover action', () => {
  it('listens for keydown and pointerdown on the document and unwires them on destroy', () => {
    const { action } = mount();
    expect([...doc.listeners.keys()].sort()).toEqual(['keydown', 'pointerdown']);
    action.destroy();
    expect(doc.listeners.size).toBe(0);
  });

  it('moves focus in on open: the initialFocus match, else the first focusable, else the panel itself', () => {
    const email = el('email', [], 'input[type="email"]');
    const first = el('first');
    mount({ initialFocus: 'input[type="email"]' }, [first, email]);
    expect(doc.activeElement.name).toBe('email');

    mount({ initialFocus: 'input[type="email"]' }, [first]);
    expect(doc.activeElement.name).toBe('first');

    const { panel } = mount({}, []);
    expect(doc.activeElement).toBe(panel);
    expect(panel.attrs.get('tabindex')).toBe('-1');
  });

  it('Escape asks to close and prevents the default; other keys do nothing', () => {
    const { onClose } = mount();
    const other = key('Enter');
    fire('keydown', other);
    expect(onClose).not.toHaveBeenCalled();
    const esc = key('Escape');
    fire('keydown', esc);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(esc.preventDefault).toHaveBeenCalled();
  });

  it('a press outside closes; a press inside the panel or on the trigger does not', () => {
    const { panel, trigger, onClose } = mount();
    const inside = panel.children[0] as FakeEl;
    fire('pointerdown', press(inside, panel, doc.body));
    fire('pointerdown', press(trigger, doc.body));
    expect(onClose).not.toHaveBeenCalled();
    fire('pointerdown', press(el('elsewhere'), doc.body));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the trigger on destroy when focus was inside or fell to body, not when the user moved it', () => {
    const a = mount();
    expect(doc.activeElement.name).toBe('first');
    a.action.destroy();
    expect(doc.activeElement).toBe(a.trigger);

    const b = mount();
    doc.activeElement = doc.body;
    b.action.destroy();
    expect(doc.activeElement).toBe(b.trigger);

    const c = mount();
    const elsewhere = el('elsewhere');
    doc.activeElement = elsewhere;
    c.action.destroy();
    expect(doc.activeElement).toBe(elsewhere);

    const d = mount();
    d.trigger.isConnected = false;
    d.action.destroy();
    expect(doc.activeElement.name).toBe('first');
  });

  it('defaults the trigger to the element focused at mount', () => {
    const opener = el('opener');
    doc.activeElement = opener;
    const panel = el('panel', [el('first')]);
    const onClose = vi.fn();
    const action = popover(asEl(panel), { onClose });
    fire('pointerdown', press(opener, doc.body));
    expect(onClose).not.toHaveBeenCalled();
    action.destroy();
    expect(doc.activeElement).toBe(opener);
  });

  it('never adopts <body> as the trigger: opened with nothing focused, an outside press still closes', () => {
    doc.activeElement = doc.body;
    const panel = el('panel', [el('first')]);
    const onClose = vi.fn();
    const action = popover(asEl(panel), { onClose });
    fire('pointerdown', press(el('elsewhere'), doc.body));
    expect(onClose).toHaveBeenCalledTimes(1);
    const bodyFocus = vi.spyOn(doc.body, 'focus');
    action.destroy();
    expect(bodyFocus).not.toHaveBeenCalled();
  });

  it('update() swaps the trigger: the new one is not "outside" and gets focus back', () => {
    const { action, onClose } = mount();
    const next = el('next-trigger');
    action.update({ onClose, trigger: asEl(next) });
    fire('pointerdown', press(next, doc.body));
    expect(onClose).not.toHaveBeenCalled();
    action.destroy();
    expect(doc.activeElement).toBe(next);
  });

  it('modal: Tab wraps from the last control to the first and Shift+Tab from the first to the last', () => {
    const { panel } = mount({ modal: true });
    const [first, last] = panel.children as [FakeEl, FakeEl];
    doc.activeElement = last;
    const tab = key('Tab');
    fire('keydown', tab);
    expect(tab.preventDefault).toHaveBeenCalled();
    expect(doc.activeElement).toBe(first);
    const back = key('Tab', true);
    fire('keydown', back);
    expect(doc.activeElement).toBe(last);
    // Focus that escaped (e.g. to the overlay) is pulled back to the first control.
    doc.activeElement = doc.body;
    fire('keydown', key('Tab'));
    expect(doc.activeElement).toBe(first);
  });

  it('non-modal: Tab is left alone', () => {
    const { panel } = mount();
    const [, last] = panel.children as [FakeEl, FakeEl];
    doc.activeElement = last;
    const tab = key('Tab');
    fire('keydown', tab);
    expect(tab.preventDefault).not.toHaveBeenCalled();
    expect(doc.activeElement).toBe(last);
  });
});

describe('cycleTab / focusables', () => {
  it('cycleTab ignores other keys and a panel with nothing focusable', () => {
    const root = el('root', []);
    expect(cycleTab(key('Tab') as unknown as KeyboardEvent, asEl(root))).toBe(false);
    const full = el('root', [el('a')]);
    expect(cycleTab(key('Enter') as unknown as KeyboardEvent, asEl(full))).toBe(false);
  });

  it('cycleTab does nothing in the middle of the list', () => {
    const a = el('a');
    const b = el('b');
    const c = el('c');
    const root = el('root', [a, b, c]);
    doc.activeElement = b;
    const tab = key('Tab');
    expect(cycleTab(tab as unknown as KeyboardEvent, asEl(root))).toBe(false);
    expect(tab.preventDefault).not.toHaveBeenCalled();
  });

  it('focusables queries the shared selector', () => {
    const a = el('a');
    const root = el('root', [a]);
    expect(focusables(asEl(root))).toEqual([a]);
    expect(FOCUSABLE).toContain('button:not([disabled])');
  });
});
