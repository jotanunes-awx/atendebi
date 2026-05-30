'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';

export function ThemeToggle() {
  const { theme, toggleTheme, isReady } = useTheme();
  const isDark = theme === 'dark';

  return (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={toggleTheme}
      disabled={!isReady}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
    >
      {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
      <span className="hidden sm:inline">{isDark ? 'Claro' : 'Escuro'}</span>
    </Button>
  );
}
