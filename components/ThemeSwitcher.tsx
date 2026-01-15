import React, { useState, useEffect } from 'react';
import { Palette, X, Check } from 'lucide-react';

interface ColorPalette {
  name: string;
  colors: {
    '--color-primary': string;
    '--color-secondary': string;
    '--color-dark': string;
    '--color-accent': string;
    '--color-surface': string;
    '--color-background': string;
    '--color-text': string;
    '--color-subtext': string;
    '--color-border': string;
  };
}

const PALETTES: ColorPalette[] = [
  {
    name: 'Clinical Cyan (Default)',
    colors: {
      '--color-primary': '#0891b2',
      '--color-secondary': '#0e7490',
      '--color-dark': '#155e75',
      '--color-accent': '#10b981',
      '--color-surface': '#ffffff',
      '--color-background': '#f8fafc',
      '--color-text': '#0f172a',
      '--color-subtext': '#475569',
      '--color-border': '#e2e8f0',
    }
  },
  {
    name: 'Sage & Nature',
    colors: {
      '--color-primary': '#364538', // Dark Slate Grey
      '--color-secondary': '#515751', // Ebony
      '--color-dark': '#2A332C',
      '--color-accent': '#78866B', // Adjusted Sage
      '--color-surface': '#ffffff',
      '--color-background': '#F5F9E9', // Ivory
      '--color-text': '#2F332F',
      '--color-subtext': '#596869', // Dim Grey
      '--color-border': '#C5C5AA', // Dry Sage
    }
  },
  {
    name: 'Earthy Taupe',
    colors: {
      '--color-primary': '#886F68', // Taupe
      '--color-secondary': '#6D5450',
      '--color-dark': '#3D2C2E', // Deep Mocha
      '--color-accent': '#A88C85',
      '--color-surface': '#ffffff',
      '--color-background': '#F5EDF0', // Lavender Blush
      '--color-text': '#424C55', // Charcoal Blue
      '--color-subtext': '#886F68',
      '--color-border': '#D1CCD6', // Lavender
    }
  },
  {
    name: 'Midnight Violet',
    colors: {
      '--color-primary': '#5B3E5B', 
      '--color-secondary': '#291528', // Midnight Violet
      '--color-dark': '#1a0e1a',
      '--color-accent': '#9E829C', // Dusty Mauve
      '--color-surface': '#ffffff',
      '--color-background': '#F0EFF4', // Ghost White
      '--color-text': '#1a1a1a', // Black ish
      '--color-subtext': '#3A3E3B', // Charcoal Brown
      '--color-border': '#9E829C',
    }
  },
  {
    name: 'Executive Blue & Crimson',
    colors: {
      '--color-primary': '#244979', // Dusk Blue
      '--color-secondary': '#1B365D',
      '--color-dark': '#0F2040',
      '--color-accent': '#940014', // Deep Crimson
      '--color-surface': '#ffffff',
      '--color-background': '#F8FAFC',
      '--color-text': '#202020', // Carbon Black
      '--color-subtext': '#5D84B6', // Glaucous
      '--color-border': '#B8CBE3',
    }
  }
];

export const ThemeSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePaletteIndex, setActivePaletteIndex] = useState(0);

  const applyPalette = (index: number) => {
    setActivePaletteIndex(index);
    const palette = PALETTES[index];
    const root = document.documentElement;
    
    Object.entries(palette.colors).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    // Manually handle RGB conversion for shadow glow
    // This is a simple hex to rgb conversion for the primary glow effect
    const hex = palette.colors['--color-primary'].replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-2 min-w-[200px] mb-2 animate-slide-up origin-bottom-right">
          <div className="p-2 border-b border-gray-100 mb-2 flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Theme Colors</span>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {PALETTES.map((palette, idx) => (
              <button
                key={palette.name}
                onClick={() => applyPalette(idx)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${activePaletteIndex === idx ? 'bg-gray-100 text-gray-900 font-bold' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                <div 
                  className="w-4 h-4 rounded-full shadow-sm" 
                  style={{ backgroundColor: palette.colors['--color-primary'] }}
                />
                <span className="flex-1 text-start">{palette.name}</span>
                {activePaletteIndex === idx && <Check size={14} className="text-gray-900" />}
              </button>
            ))}
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="h-12 w-12 bg-white text-medical-text border border-gray-200 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center relative overflow-hidden group"
        title="Change Theme"
      >
        <div className="absolute inset-0 bg-medical-primary/10 group-hover:bg-medical-primary/20 transition-colors"></div>
        <Palette className="w-5 h-5 text-medical-primary relative z-10" />
      </button>
    </div>
  );
};