'use client';

import { Button } from '@/components/ui/button';
import type { Block } from '../types';

export default function SimpleBlock({
  block,
  onToggle,
}: {
  block: Block;
  onToggle: (blockId: string) => void;
}) {
  return (
    <Button variant="secondary" size="sm" disabled={block.completed} onClick={() => onToggle(block.id)}>
      {block.completed ? 'Done ✓' : 'Mark Complete'}
    </Button>
  );
}
