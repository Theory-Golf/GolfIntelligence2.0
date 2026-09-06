'use client';

import { Button } from '@/components/ui/button';
import { todayISO, uid } from '../defaults';
import { getMesocyclePhase, getMesocycleWeek } from '../logic';
import type { FocusElement, WeekConfig } from '../types';

type ElementType = 'iron' | 'driver';

export default function SetupView({
  weekConfig,
  setWeekConfig,
  onSave,
  savedAt,
}: {
  weekConfig: WeekConfig;
  setWeekConfig: (next: WeekConfig) => void;
  onSave: () => void;
  savedAt: number | null;
}) {
  const week = getMesocycleWeek(weekConfig);
  const phase = getMesocyclePhase(week);

  const addElement = (type: ElementType) => {
    const key = type === 'iron' ? 'ironElements' : 'driverElements';
    const next: WeekConfig = { ...weekConfig, [key]: [...weekConfig[key], { id: uid('el'), name: '', cue: '' }] };
    setWeekConfig(next);
  };

  const removeElement = (type: ElementType, id: string) => {
    const key = type === 'iron' ? 'ironElements' : 'driverElements';
    setWeekConfig({ ...weekConfig, [key]: weekConfig[key].filter((e) => e.id !== id) });
  };

  const updateElement = (type: ElementType, id: string, field: 'name' | 'cue', value: string) => {
    const key = type === 'iron' ? 'ironElements' : 'driverElements';
    setWeekConfig({
      ...weekConfig,
      [key]: weekConfig[key].map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    });
  };

  const setDate = (date: string) => {
    setWeekConfig({
      ...weekConfig,
      date,
      startDate: weekConfig.startDate || date,
    });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <p className="font-mono text-label uppercase tracking-[0.3em] text-muted-foreground">
          Step 01 · Technical Focus
        </p>
        <h3 className="font-display text-3xl font-extrabold uppercase tracking-tight text-foreground sm:text-4xl">
          Define what
          <br />
          <span className="text-primary">you’re working on</span>
        </h3>
        <p className="max-w-2xl text-sm text-muted-foreground">
          List the technical elements your coach has you working on this week. Each element pairs
          with an external focus cue you can hold while you practice. These drive every checkpoint
          in your session.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="border border-border bg-card p-4">
          <div className="mb-2 font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
            Week Of
          </div>
          <input
            type="date"
            value={weekConfig.date || todayISO()}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground focus:border-primary focus:outline-none"
          />
        </div>
        <div className="border border-border bg-card p-4">
          <div className="mb-2 font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
            Mesocycle
          </div>
          <div className="font-display text-2xl font-extrabold uppercase tracking-tight text-foreground">
            Wk {week} · {phase.phase}
          </div>
          <p className="mt-1 text-caption text-muted-foreground">{phase.desc}</p>
        </div>
      </div>

      <ElementList
        title="Iron Elements"
        type="iron"
        elements={weekConfig.ironElements}
        onAdd={() => addElement('iron')}
        onRemove={(id) => removeElement('iron', id)}
        onUpdate={(id, f, v) => updateElement('iron', id, f, v)}
      />

      <ElementList
        title="Driver Elements"
        type="driver"
        elements={weekConfig.driverElements}
        onAdd={() => addElement('driver')}
        onRemove={(id) => removeElement('driver', id)}
        onUpdate={(id, f, v) => updateElement('driver', id, f, v)}
      />

      <div className="flex items-center gap-3">
        <Button onClick={onSave}>Save Week Config</Button>
        {savedAt && (
          <span className="font-mono text-label uppercase tracking-[0.2em] text-under">
            Saved
          </span>
        )}
      </div>
    </div>
  );
}

function ElementList({
  title,
  type,
  elements,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  type: ElementType;
  elements: FocusElement[];
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, field: 'name' | 'cue', value: string) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
          {title}
        </h4>
        <Button variant="outline" size="sm" onClick={onAdd}>
          + Add Element
        </Button>
      </div>
      {elements.length === 0 ? (
        <div className="border border-dashed border-border bg-muted/40 p-6 text-center text-sm text-muted-foreground">
          No {type} elements yet. Add what your coach has you working on.
        </div>
      ) : (
        <div className="space-y-3">
          {elements.map((el, idx) => (
            <div key={el.id} className="border border-border bg-card p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
                  Element {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(el.id)}
                  className="font-mono text-label uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
                >
                  Remove
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
                    Technical Element
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Forward shaft lean at impact"
                    value={el.name}
                    onChange={(e) => onUpdate(el.id, 'name', e.target.value)}
                    className="mt-1 h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-mono text-label uppercase tracking-[0.2em] text-muted-foreground">
                    External Focus Cue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Trap the ball against the turf"
                    value={el.cue}
                    onChange={(e) => onUpdate(el.id, 'cue', e.target.value)}
                    className="mt-1 h-10 w-full border border-border bg-background px-3 font-body text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
