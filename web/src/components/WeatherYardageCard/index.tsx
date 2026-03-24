'use client';

import { useState, useEffect } from 'react';
import WizardProgress from './WizardProgress';
import StepRoundDetails from './StepRoundDetails';
import StepMyBag, { DEFAULT_CLUBS } from './StepMyBag';
import StepWedges, { WEDGE_DEFS } from './StepWedges';
import StepComplete from './StepComplete';
import YardageCardPrint from './YardageCardPrint';
import { fetchAllWeatherData, RoundWeatherData } from '@/utils/weatherApi';
import { LS_CLUBS, LS_WEDGES, LS_HOME_ZIP } from '@/lib/constants';
import './WeatherYardageCard.css';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

type ClubEntry = { id: string; dist: number };
type WedgeDistances = { half: number; three: number; full: number };
type WedgeMap = Record<string, WedgeDistances>;
type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

function defaultWedges(): WedgeMap {
  return Object.fromEntries(
    WEDGE_DEFS.map((w) => [w.id, { half: w.halfDef, three: w.threeDef, full: w.fullDef }])
  );
}

function loadFromLS<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function WeatherYardageCard() {
  const [step, setStep] = useState(1);

  // Step 1 fields
  const [courseZip, setCourseZip] = useState('');
  const [homeZip, setHomeZip] = useState('');
  const [roundDate, setRoundDate] = useState(todayStr());
  const [teeTime, setTeeTime] = useState('08:00');
  const [courseName, setCourseName] = useState('');
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>('idle');
  const [wx, setWx] = useState<RoundWeatherData | null>(null);

  // Step 2
  const [clubs, setClubs] = useState<ClubEntry[]>(DEFAULT_CLUBS);

  // Step 3
  const [wedges, setWedges] = useState<WedgeMap>(defaultWedges);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setHomeZip(localStorage.getItem(LS_HOME_ZIP) || '');
    setClubs(loadFromLS(LS_CLUBS, DEFAULT_CLUBS));
    setWedges(loadFromLS(LS_WEDGES, defaultWedges()));
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (homeZip) localStorage.setItem(LS_HOME_ZIP, homeZip);
  }, [homeZip]);

  useEffect(() => {
    localStorage.setItem(LS_CLUBS, JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    localStorage.setItem(LS_WEDGES, JSON.stringify(wedges));
  }, [wedges]);

  async function handleFetch(): Promise<void> {
    setFetchStatus('loading');
    try {
      const data = await fetchAllWeatherData(courseZip, homeZip, roundDate, teeTime);
      setWx(data);
      if (!courseName && data.courseName) setCourseName(data.courseName);
      setFetchStatus('success');
    } catch (err: unknown) {
      console.error('Weather fetch error:', err);
      setFetchStatus('error');
    }
  }

  function canAdvance(): boolean {
    if (step === 1) return fetchStatus === 'success';
    if (step === 2) return clubs.some((c) => c.id !== '' && c.dist > 0);
    return true;
  }

  function nextLabel(): string {
    if (step === 1) return 'Next: My Bag';
    if (step === 2) return 'Next: Wedge Distances';
    if (step === 3) return 'Generate Card';
    return '';
  }

  return (
    <div className="wyc-wizard">
      <WizardProgress step={step} />

      <div className="wyc-card">
        {step === 1 && (
          <StepRoundDetails
            courseZip={courseZip} setCourseZip={setCourseZip}
            homeZip={homeZip} setHomeZip={setHomeZip}
            roundDate={roundDate} setRoundDate={setRoundDate}
            teeTime={teeTime} setTeeTime={setTeeTime}
            courseName={courseName} setCourseName={setCourseName}
            onFetch={handleFetch}
            fetchStatus={fetchStatus}
            wx={wx}
          />
        )}
        {step === 2 && <StepMyBag clubs={clubs} setClubs={setClubs} />}
        {step === 3 && <StepWedges wedges={wedges} setWedges={setWedges} />}
        {step === 4 && <StepComplete />}
      </div>

      {/* Wizard navigation */}
      <div className="wyc-nav">
        {step > 1 && (
          <button className="wyc-btn-back" onClick={() => setStep((s) => s - 1)}>
            ← Back
          </button>
        )}
        {step < 4 && (
          <button
            className="wyc-btn-primary"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => s + 1)}
          >
            {nextLabel()}
          </button>
        )}
      </div>

      {/* Live print preview — always visible after weather fetch */}
      {wx && (
        <YardageCardPrint
          clubs={clubs}
          wedges={wedges}
          wx={wx}
          courseName={courseName}
          roundDate={roundDate}
          teeTime={teeTime}
        />
      )}
    </div>
  );
}
