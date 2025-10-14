import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio } from "lucide-react";
import { useState, useEffect } from "react";
import coffeebreakImg from "@assets/icon_coffeebrak_1760416515821.png";
import drivetimeImg from "@assets/icon_drivetime_1760416515821.png";
import goodmorningjakartaImg from "@assets/icon_goodmorningjakarta_1760416515821.png";
import nightflowImg from "@assets/icon_nightflow_1760416515822.png";
import odahoteImg from "@assets/icon_odahote_1760416515822.png";
import officehourImg from "@assets/icon_officehour_1760416515822.png";
import shiftmalamImg from "@assets/icon_shiftmalam_1760416515822.png";

interface ProgramListenersData {
  programName: string;
  displayName: string;
  timeRange: string;
  startTime: string;
  endTime: string;
  cumulativeListeners: number; // Estimated Unique Listeners (Total Pendengar)
  avgConcurrent: number; // Average Concurrent Listeners (Pendengar Saat Ini)
  progressPercent: number;
  isActive: boolean;
  color: string;
}

// Get program image based on program name and day of week
const getProgramImage = (programName: string, currentDate: Date): string => {
  const wibOffset = 7 * 60; // WIB = UTC+7
  const localOffset = currentDate.getTimezoneOffset();
  const wibTime = new Date(currentDate.getTime() + (wibOffset + localOffset) * 60 * 1000);
  const dayOfWeek = wibTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // For Good Morning Jakarta: use odahote on Sat/Sun, goodmorningjakarta on Mon-Fri
  if (programName === 'Good Morning Jakarta') {
    return (dayOfWeek === 0 || dayOfWeek === 6) ? odahoteImg : goodmorningjakartaImg;
  }
  
  const imageMap: Record<string, string> = {
    'Night Flow': nightflowImg,
    'Office Hour': officehourImg,
    'Coffee Break': coffeebreakImg,
    'Drive Time': drivetimeImg,
    'Shift Malam': shiftmalamImg,
  };
  
  return imageMap[programName] || '';
};

// Split program name into colored first word and white rest
const getProgramNameParts = (displayName: string) => {
  const words = displayName.split(' ');
  if (words.length === 1) {
    // Single word like "Drive Time" → split at capital letter
    const match = displayName.match(/^([a-z]+)([A-Z].*)$/);
    if (match) {
      return { first: match[1], rest: match[2] };
    }
    return { first: displayName.toLowerCase(), rest: '' };
  }
  
  // Map display names to styled versions
  const nameMap: Record<string, { first: string; rest: string }> = {
    'Night Flow': { first: 'night', rest: 'FLOW' },
    'Good Morning Jakarta': { first: 'good', rest: 'MORNING JAKARTA' },
    'Office Hour': { first: 'office', rest: 'HOUR' },
    'Coffee Break': { first: 'coffee', rest: 'BREAK' },
    'Drive Time': { first: 'drive', rest: 'TIME' },
    'Shift Malam': { first: 'shift', rest: 'MALAM' },
  };
  
  return nameMap[displayName] || { first: words[0].toLowerCase(), rest: words.slice(1).join(' ').toUpperCase() };
};

export function ProgramListeners() {
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatWIBTime = () => {
    const wibOffset = 7 * 60; // WIB = UTC+7
    const localOffset = currentDate.getTimezoneOffset();
    const wibTime = new Date(currentDate.getTime() + (wibOffset + localOffset) * 60 * 1000);
    
    const hours = String(wibTime.getHours()).padStart(2, '0');
    const minutes = String(wibTime.getMinutes()).padStart(2, '0');
    
    return `${hours}.${minutes} WIB`;
  };

  const formatDateString = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGS', 'SEP', 'OKT', 'NOV', 'DES'];
    
    const wibOffset = 7 * 60;
    const localOffset = currentDate.getTimezoneOffset();
    const wibTime = new Date(currentDate.getTime() + (wibOffset + localOffset) * 60 * 1000);
    
    const day = days[wibTime.getDay()];
    const date = wibTime.getDate();
    const month = months[wibTime.getMonth()];
    const year = wibTime.getFullYear();
    
    return `${day}, ${date} ${month}, ${year}`;
  };

  // Fetch program listeners data
  const { data: programs, isLoading } = useQuery<ProgramListenersData[]>({
    queryKey: ["/api/program-listeners"],
    refetchInterval: 30 * 1000, // 30 seconds
  });

  const wibTime = formatWIBTime();
  const dateStr = formatDateString();

  return (
    <Card className="p-8 space-y-6 bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 p-2 rounded">
            <Radio className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white tracking-wide">
              STATISTIK PENDENGAR PROGRAM
            </h2>
            <p className="text-yellow-400 font-semibold text-sm mt-1" data-testid="text-wib-time">
              {wibTime}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-yellow-400 font-semibold text-sm" data-testid="text-date">
            {dateStr}
          </p>
        </div>
      </div>

      {/* Programs List */}
      {isLoading ? (
        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-48 bg-slate-700" />
              <Skeleton className="h-12 w-full bg-slate-700" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {programs?.map((program) => {
            const { first, rest } = getProgramNameParts(program.displayName);
            
            return (
              <div key={program.programName} className="space-y-2">
                {/* Time Range & Program Name */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Program Logo */}
                    <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 bg-slate-800 flex items-center justify-center">
                      {getProgramImage(program.displayName, currentDate) ? (
                        <img 
                          src={getProgramImage(program.displayName, currentDate)} 
                          alt={program.displayName}
                          className="w-full h-full object-cover"
                          data-testid={`img-program-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`}
                        />
                      ) : (
                        <Radio className="w-10 h-10 text-slate-500" data-testid={`icon-program-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`} />
                      )}
                    </div>
                    
                    <div>
                      <p className="text-gray-400 text-sm font-medium mb-1">
                        {program.timeRange}
                      </p>
                      <div className="flex items-center gap-3">
                        <h3 
                          className="text-2xl font-bold tracking-tight"
                          data-testid={`text-program-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`}
                        >
                          <span className="text-yellow-400">{first}</span>
                          <span className="text-white"> {rest}</span>
                        </h3>
                        {program.isActive && (
                          <span 
                            className="relative flex h-7 px-3 items-center justify-center bg-red-500 text-white text-xs font-bold rounded-md animate-pulse"
                            data-testid="badge-live"
                          >
                            <span className="absolute inline-flex h-full w-full rounded-md bg-red-400 opacity-75 animate-ping"></span>
                            <span className="relative">LIVE</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Metrics */}
                  <div className="text-right">
                    <p className="text-gray-400 text-xs uppercase tracking-wide mb-1">
                      Total Pendengar
                    </p>
                    <p 
                      className="text-yellow-400 text-3xl font-bold font-mono"
                      data-testid={`text-program-listeners-${program.displayName.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {program.cumulativeListeners === 0 && program.progressPercent === 100 
                        ? '-' 
                        : program.cumulativeListeners.toLocaleString()
                      }
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-10 bg-gray-600 rounded-full overflow-hidden relative">
                  <div
                    className="h-full transition-all duration-500 flex items-center justify-center"
                    style={{
                      width: `${program.progressPercent}%`,
                      backgroundColor: program.color,
                    }}
                  >
                    {program.progressPercent > 0 && (
                      <span className="text-white text-sm font-bold">
                        {program.progressPercent.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
