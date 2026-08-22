import LagPuttTestShell from './LagPuttTestShell';

export const metadata = {
  title: 'Lag Putt Test — PlayerPath',
  description:
    'Adapted from the Swedish Golf Team protocol. 18 putts from 27–60 ft, scored by proximity. Compare your speed control to tour and amateur benchmarks.',
};

export default function LagPuttTestPage() {
  return <LagPuttTestShell />;
}
