import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Radio, Clock } from "lucide-react";
import coffeebreakImg from "@assets/coffeebreak_1760412189349.png";
import drivetimeImg from "@assets/drivetime_1760412189350.png";
import goodmorningjakartaImg from "@assets/goodmorningjakarta_1760412189350.png";
import goodmorningjktweekendImg from "@assets/goodmorningjktweekend_1762556344419.png";
import nightflowImg from "@assets/nightflow_1760412189350.png";
import odahoteImg from "@assets/odahote_1760412189350.png";
import officehourImg from "@assets/officehour_1760412189350.png";
import shiftmalamImg from "@assets/shiftmalam_1760412189350.png";
import fallbackImage from "@assets/stock_images/radio_dj_broadcastin_492e4d9b.jpg";

interface ComingUpNextProgram {
  programTitle: string;
  presenter: string;
  timeRange: string;
  description: string;
  imageUrl: string;
  status: string;
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
    'Good Morning JKT Weekend': goodmorningjktweekendImg,
    'Yesterday Hit': fallbackImage,
  };
  
  return imageMap[programTitle] || fallbackImage;
};

export function ComingUpNext() {
  const { data: program, isLoading } = useQuery<ComingUpNextProgram>({
    queryKey: ["/api/coming-up-next"],
    refetchInterval: 30000,
  });

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Coming Up Next</h3>
        <Clock className="h-5 w-5 text-muted-foreground" />
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
              data-testid="img-coming-up-next"
            />
            <div className="absolute top-1 left-1">
              <Badge variant="secondary" className="bg-teal-600 text-white" data-testid="badge-upcoming-status">
                <Clock className="h-3 w-3 mr-1.5" />
                <span className="font-semibold">{program.status}</span>
              </Badge>
            </div>
          </div>

          {/* Program Info */}
          <div className="space-y-2">
            <h4 className="text-xl font-bold" data-testid="text-next-program-title">
              {program.programTitle}
            </h4>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span data-testid="text-next-time-range">{program.timeRange}</span>
              {program.presenter && (
                <>
                  <span>•</span>
                  <span data-testid="text-next-presenter">{program.presenter}</span>
                </>
              )}
            </div>
            {program.description && (
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-next-program-description">
                {program.description}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <Radio className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Tidak ada informasi program berikutnya</p>
        </div>
      )}
    </Card>
  );
}
