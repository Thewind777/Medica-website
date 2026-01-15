
import React from 'react';

export const Loading: React.FC = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <div className="w-12 h-12 border-4 border-medical-primary/30 border-t-medical-primary rounded-full animate-spin"></div>
        <p className="text-gray-400 font-medium animate-pulse">Loading Noreva Catalog...</p>
    </div>
);
