import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";
import { useState, useEffect } from "react";
import fallbackImage from "@assets/stock_images/radio_dj_broadcastin_492e4d9b.jpg";

interface OnAirProgram {
  programTitle: string;
  presenter: string;
  timeRange: string;
  description: string;
  imageUrl: string;
  status: string;
}

export function OnAirProgram() {
  const { data: program, isLoading } = useQuery<OnAirProgram>({
    queryKey: ["/api/on-air-program"],
    refetchInterval: 30000,
  });

  const [imgError, setImgError] = useState(false);

  // Reset error state when program imageUrl changes
  useEffect(() => {
    setImgError(false);
  }, [program?.imageUrl]);

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
          {/* Program Image - Always show with fallback */}
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            <img 
              src={imgError || !program.imageUrl ? fallbackImage : program.imageUrl}
              alt={program.programTitle}
              className="object-cover w-full h-full rounded-md"
              data-testid="img-on-air-program"
              onError={() => setImgError(true)}
            />
            <div className="absolute top-3 right-3">
              <Badge variant="destructive" className="bg-red-600 text-white" data-testid="badge-live-status">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse-slow mr-1" />
                {program.status}
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
