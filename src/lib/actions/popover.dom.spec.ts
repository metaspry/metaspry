// Runs in the default happy-dom environment: real focus, real composedPath, against a real document.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cycleTab, popover } from './popover';

function panelWith(html: string): HTMLElement {
  const panel = document.createElement('div');
  panel.innerHTML = html;
  document.body.appendChild(panel);
  return panel;
}

function trigger(): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = 'History';
  document.body.appendChild(b);
  return b;
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('popover action (DOM)', () => {
  it('focuses the first control on open and returns focus to the trigger on destroy', () => {
    const t = trigger();
    t.focus();
    const panel = panelWith('<button id="a">A</button><button id="b">B</button>');
    const action = popover(panel, { onClose: vi.fn(), trigger: t });
    expect(document.activeElement?.id).toBe('a');
    action.destroy();
    expect(document.activeElement).toBe(t);
  });

  it('honours initialFocus and falls back to the panel with tabindex=-1 when nothing is focusable', () => {
    const t = trigger();
    const panel = panelWith('<button id="close">x</button><input id="email" type="email" />');
    popover(panel, { onClose: vi.fn(), trigger: t, initialFocus: 'input[type="email"]' });
    expect(document.activeElement?.id).toBe('email');

    const empty = panelWith('<p>No history yet.</p>');
    popover(empty, { onClose: vi.fn(), trigger: t });
    expect(document.activeElement).toBe(empty);
    expect(empty.getAttribute('tabindex')).toBe('-1');
  });

  it('Escape on the document closes; a pointerdown outside closes; one inside or on the trigger does not', () => {
    const t = trigger();
    const panel = panelWith('<button id="a">A</button>');
    const onClose = vi.fn();
    popover(panel, { onClose, trigger: t });
    panel.querySelector('button')!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    t.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onClose).not.toHaveBeenCalled();
    document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('modal: Tab cycles inside the panel', () => {
    const t = trigger();
    const panel = panelWith('<button id="a">A</button><button id="b">B</button>');
    popover(panel, { onClose: vi.fn(), trigger: t, modal: true });
    (panel.querySelector('#b') as HTMLElement).focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe('a');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement?.id).toBe('b');
  });

  it('leaves focus alone on destroy when the user already moved it to another control', () => {
    const t = trigger();
    const other = trigger();
    const panel = panelWith('<button id="a">A</button>');
    const action = popover(panel, { onClose: vi.fn(), trigger: t });
    other.focus();
    action.destroy();
    expect(document.activeElement).toBe(other);
  });

  it('cycleTab skips disabled controls and tabindex=-1', () => {
    const root = panelWith('<button id="a">A</button><button disabled>D</button><div tabindex="-1">x</div><a id="z" href="#">Z</a>');
    (root.querySelector('#z') as HTMLElement).focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    expect(cycleTab(tab, root)).toBe(true);
    expect(document.activeElement?.id).toBe('a');
  });
});
