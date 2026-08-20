import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PERIOD_LABEL } from '../lib/weight';
import { todayISO } from '../lib/date';
import type { WeightEntry, WeightPeriod } from '../types/database';

interface Props {
  entry: WeightEntry;
  fighterName?: string;
  canManage: boolean;
  onSaved: () => void;
}

// Shared by WeightPage's own-history table and FightersPage's team-wide
// weights table — both need the same self-or-coach edit/delete behavior.
export function WeightEntryRow({ entry, fighterName, canManage, onSaved }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.weight_kg.toString());
  const [date, setDate] = useState(entry.entry_date);
  const [period, setPeriod] = useState<WeightPeriod | null>(entry.period);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setValue(entry.weight_kg.toString());
    setDate(entry.entry_date);
    setPeriod(entry.period);
    setEditing(true);
  };

  const save = async () => {
    if (!value) return;
    setSaving(true);
    await supabase.from('weight_entries').update({ weight_kg: parseFloat(value), entry_date: date, period }).eq('id', entry.id);
    setSaving(false);
    setEditing(false);
    onSaved();
  };

  const remove = async () => {
    if (!confirm('Delete this weight entry? This cannot be undone.')) return;
    await supabase.from('weight_entries').delete().eq('id', entry.id);
    onSaved();
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
        {fighterName && <div style={{ fontSize: 13, flex: '1 1 100px' }}>{fighterName}</div>}
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} style={{ width: 130, fontSize: 12, padding: '4px 6px' }} />
        <select className="input" value={period ?? ''} onChange={(e) => setPeriod((e.target.value || null) as WeightPeriod | null)} style={{ width: 110, fontSize: 12, padding: '4px 6px' }}>
          <option value="">Unspecified</option>
          <option value="morning">Morning</option>
          <option value="evening">Evening</option>
        </select>
        <input className="input" type="number" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 70, fontSize: 12, padding: '4px 6px' }} />
        <button className="btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={save} disabled={saving || !value}>{saving ? '…' : 'Save'}</button>
        <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
      {fighterName && <div style={{ flex: '1 1 100px' }}>{fighterName}</div>}
      <div style={{ flex: '1 1 130px', color: 'var(--muted-2)' }}>
        {entry.entry_date}
        {entry.period && <span style={{ color: 'var(--muted-4)', fontSize: 11 }}> · {PERIOD_LABEL[entry.period]}</span>}
      </div>
      <div style={{ flex: '1 1 70px', fontWeight: 600 }}>{entry.weight_kg} kg</div>
      {canManage && (
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={startEdit} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>Edit</button>
          <button onClick={remove} className="btn-secondary" style={{ padding: '4px 8px', fontSize: 11 }}>Delete</button>
        </div>
      )}
    </div>
  );
}
