'use client';
import { useEffect } from "react";
import { cn } from '@/src/lib/utils';

export default function DebugCn() {
  useEffect(() => {
    console.log(cn('p-4', false && 'hidden', 'text-sm'));
  }, []);

  return null;
}