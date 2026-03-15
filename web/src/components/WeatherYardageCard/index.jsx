'use client';

import { useState, useEffect } from 'react';
import WizardProgress from './WizardProgress';
import StepRoundDetails from './StepRoundDetails';
import StepMyBag, { DEFAULT_CLUBS } from './StepMyBag';
import StepWedges, { WEDGE_DEFS } from './StepWedges';
import StepComplete from './StepComplete';
import YardageCardPrint from './YardageCardPrint';
import { fetchAllWeatherData } from '@/utils/weatherApi';
import './WeatherYardageCard.css';

const LS_CLUBS  = 'yc4_clubs';
const LS_WEDGES = 'yc4_wedges';
const LS_HOME   = 'yc4_homezip';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function defaultWedges() {
  return Object.fromEntries(
    WEDGE_DEFS.map((w) => [w.id, { half: w.halfDef, three: w.threeDef, full: w.fullDef }])
  );
}

function loadFromLS(key, fallback) {
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
  const [fetchStatus, setFetchStatus] = useState('idle'); // idle | loading | success | error
  const [wx, setWx] = useState(null);

  // Step 2
  const [clubs, setClubs] = useState(DEFAULT_CLUBS);

  // Step 3
  const [wedges, setWedges] = useState(defaultWedges);

  // Hydrate from localStorage on mount
  useEffect(() => {
    setHomeZip(localStorage.getItem(LS_HOME) || '');
    setClubs(loadFromLS(LS_CLUBS, DEFAULT_CLUBS));
    setWedges(loadFromLS(LS_WEDGES, defaultWedges()));
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (homeZip) localStorage.setItem(LS_HOME, homeZip);
  }, [homeZip]);

  useEffect(() => {
    localStorage.setItem(LS_CLUBS, JSON.stringify(clubs));
  }, [clubs]);

  useEffect(() => {
    localStorage.setItem(LS_WEDGES, JSON.stringify(wedges));
  }, [wedges]);

  async function handleFetch() {
    setFetchStatus('loading');
    try {
      const data = await fetchAllWeatherData(courseZip, homeZip, roundDate, teeTime);
      setWx(data);
      if (!courseName && data.courseName) setCourseName(data.courseName);
      setFetchStatus('success');
    } catch (err) {
      console.error('Weather fetch error:', err);
      setFetchStatus('error');
    }
  }

  function canAdvance() {
    if (step === 1) return fetchStatus === 'success';
    if (step === 2) return clubs.some((c) => c.id !== '' && c.dist > 0);
    return true;
  }

  function nextLabel() {
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
