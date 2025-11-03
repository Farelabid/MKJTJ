import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";
import coffeebreakImg from "@assets/coffeebreak_1760412189349.png";
import drivetimeImg from "@assets/drivetime_1760412189350.png";
import goodmorningjakartaImg from "@assets/goodmorningjakarta_1760412189350.png";
import nightflowImg from "@assets/nightflow_1760412189350.png";
import odahoteImg from "@assets/odahote_1760412189350.png";
import officehourImg from "@assets/officehour_1760412189350.png";
import shiftmalamImg from "@assets/shiftmalam_1760412189350.png";
import fallbackImage from "@assets/stock_images/radio_dj_broadcastin_492e4d9b.jpg";

interface OnAirProgram {
  programTitle: string;
  presenter: string;
  timeRange: string;
  description: string;
  imageUrl: string;
  status: string;
  totalListeners?: number; // TOTAL PENDENGAR (estimated unique listeners)
}

// Function to get program image based on program name and current date
const getProgramImage = (programTitle: string): string => {
  // Get current date in WIB timezone
  const now = new Date();
  const wibOffset = 7 * 60; // WIB = UTC+7
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  const dayOfWeek = wibTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // For Good Morning Jakarta: use odahote on Sat/Sun, goodmorningjakarta on Mon-Fri
  if (programTitle === 'Good Morning Jakarta') {
    return (dayOfWeek === 0 || dayOfWeek === 6) ? odahoteImg : goodmorningjakartaImg;
  }
  
  const imageMap: Record<string, string> = {
    'Night Flow': nightflowImg,
    'Office Hour': officehourImg,
    'Coffee Break': coffeebreakImg,
    'Drive Time': drivetimeImg,
    'Shift Malam': shiftmalamImg,
    'Yesterday Hit': fallbackImage, // Use fallback for Yesterday Hit
  };
  
  return imageMap[programTitle] || fallbackImage;
};

export function OnAirProgram() {
  const { data: program, isLoading } = useQuery<OnAirProgram>({
    queryKey: ["/api/on-air-program"],
    refetchInterval: 30000,
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Program Sedang On Air</h3>
        <Radio className="h-5 w-5 text-muted-foreground" />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-md" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : program ? (
        <div className="space-y-4">
          {/* Program Image - Always show with program-specific image */}
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            <img 
              src={getProgramImage(program.programTitle)}
              alt={program.programTitle}
              className="object-cover w-full h-full rounded-md"
              data-testid="img-on-air-program"
            />
            <div className="absolute top-1 left-1">
              <Badge variant="destructive" className="bg-red-600 text-white animate-pulse" data-testid="badge-live-status">
                <div className="absolute -inset-1 bg-red-600 rounded-full animate-ping opacity-75" />
                <div className="relative flex items-center">
                  <div className="h-2 w-2 rounded-full bg-white mr-1.5" />
                  <span className="font-semibold">{program.status}</span>
                </div>
              </Badge>
            </div>
          </div>

          {/* Program Info */}
          <div className="space-y-2">
            <h4 className="text-xl font-bold" data-testid="text-program-title">
              {program.programTitle}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span data-testid="text-time-range">{program.timeRange}</span>
              {program.presenter && (
                <>
                  <span>•</span>
                  <span data-testid="text-presenter">{program.presenter}</span>
                </>
              )}
            </div>
            
            {/* TOTAL PENDENGAR Box - 3D Effect */}
            <div 
              className="relative rounded-lg p-4 mt-3 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(234, 88, 12, 0.15) 0%, rgba(220, 38, 38, 0.15) 50%, rgba(153, 27, 27, 0.2) 100%)',
                boxShadow: `
                  0 2px 4px rgba(0, 0, 0, 0.3),
                  0 4px 8px rgba(234, 88, 12, 0.2),
                  0 8px 16px rgba(220, 38, 38, 0.15),
                  inset 0 1px 2px rgba(251, 146, 60, 0.3),
                  inset 0 -1px 2px rgba(0, 0, 0, 0.4)
                `,
                border: '1px solid rgba(251, 146, 60, 0.3)',
                borderTop: '1px solid rgba(251, 191, 36, 0.5)',
                borderBottom: '1px solid rgba(153, 27, 27, 0.6)',
              }}
            >
              {/* Shine effect overlay */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
                }}
              />
              
              <div className="relative flex items-center justify-between">
                <span 
                  className="text-xs font-bold text-orange-300 uppercase tracking-wider"
                  style={{ 
                    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8), 0 0 8px rgba(251, 146, 60, 0.4)' 
                  }}
                >
                  Total Pendengar
                </span>
                <span 
                  className="text-3xl font-black text-orange-400" 
                  data-testid="text-total-listeners"
                  style={{ 
                    textShadow: `
                      0 1px 2px rgba(0, 0, 0, 0.8),
                      0 2px 8px rgba(251, 146, 60, 0.6),
                      0 0 20px rgba(251, 146, 60, 0.4),
                      0 4px 16px rgba(234, 88, 12, 0.5)
                    `,
                    letterSpacing: '0.02em',
                  }}
                >
                  {program.totalListeners !== undefined ? program.totalListeners.toLocaleString() : '0'}
                </span>
              </div>
            </div>
            
            {program.description && (
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-program-description">
                {program.description}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Tidak ada informasi program saat ini</p>
        </div>
      )}
    </Card>
  );
}
