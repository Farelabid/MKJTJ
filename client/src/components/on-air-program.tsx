import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Radio } from "lucide-react";
import afternoonshowImg from "@assets/afternoonSHOW_1762558579002.png";
import coffeebreakImg from "@assets/coffeebreak_1760412189349.png";
import drivetimeImg from "@assets/drivetime_1760412189350.png";
import goodmorningjakartaImg from "@assets/goodmorningjakarta_1760412189350.png";
import goodmorningjktweekendImg from "@assets/goodmorningjktweekend_1762556344419.png";
import nightflowImg from "@assets/nightflow_1760412189350.png";
import odahoteImg from "@assets/odahote_1760412189350.png";
import officehourImg from "@assets/officehour_1760412189350.png";
import ruteakhirpekanImg from "@assets/RUTEakhirpekanABI_1762562261257.png";
import shiftmalamImg from "@assets/shiftmalam_1760412189350.png";
import songontheweekImg from "@assets/songontheweek_1762558103431.png";
import fallbackImage from "@assets/stock_images/radio_dj_broadcastin_492e4d9b.jpg";
import drivetimeweekendImg from "@assets/stock_images/bright_colorful_radi_aeda6156.jpg";
import malmingImg from "@assets/stock_images/vibrant_modern_radio_b18dfee5.jpg";
import weekendseruImg from "@assets/stock_images/weekend_fun_celebrat_a8745fc7.jpg";

// Host photos
import hostRisan from "@assets/host_risan_1762096272039.png";
import hostNayla from "@assets/host_nayla_1762096257881.png";
import hostAbisaan from "@assets/host_abisaan_1762096185716.png";
import hostAkbar from "@assets/host_akbar_1762096185716.png";
import hostDenny from "@assets/host_dennychandra_1762096202310.png";
import hostDany from "@assets/host_mcdanny_1762096221521.png";
import hostEko from "@assets/host_ekokuntadhi_1762096202311.png";
import hostHatma from "@assets/host_hatma_1762096202311.png";
import hostIndy from "@assets/host_indyrahmawati_1762096202311.png";
import hostIrwan from "@assets/host_irwanardian_1762096221521.png";
import hostLuvi from "@assets/host_luvi_1762096221521.png";
import hostMazdjo from "@assets/host_mazdjopray_1762096221521.png";
import hostMosidik from "@assets/host_mosidik_1762096221522.png";
import hostOdah from "@assets/host_odah_1762096257881.png";
import hostOtesyech from "@assets/host_otsyech_1762096257882.png";
import hostReno from "@assets/host_reno_1762096257882.png";
import hostRio from "@assets/host_rio_1762096257882.png";
import hostYasser from "@assets/host_yasser_1762096272039.png";
import hostPutri from "@assets/magang_putri_1762097040087.png";

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
  // Normalize title: trim whitespace and convert to lowercase
  const normalizedTitle = programTitle.trim().toLowerCase();
  
  // Get current date in WIB timezone
  const now = new Date();
  const wibOffset = 7 * 60; // WIB = UTC+7
  const localOffset = now.getTimezoneOffset();
  const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
  const dayOfWeek = wibTime.getDay(); // 0 = Sunday, 6 = Saturday
  
  // For Good Morning Jakarta: use odahote on Sat/Sun, goodmorningjakarta on Mon-Fri
  if (normalizedTitle === 'good morning jakarta') {
    return (dayOfWeek === 0 || dayOfWeek === 6) ? odahoteImg : goodmorningjakartaImg;
  }
  
  const imageMap: Record<string, string> = {
    'night flow': nightflowImg,
    'office hour': officehourImg,
    'coffee break': coffeebreakImg,
    'drive time': drivetimeImg,
    'shift malam': shiftmalamImg,
    'good morning jkt weekend': goodmorningjktweekendImg,
    'rute akhir pekan': ruteakhirpekanImg,
    'song on the week': songontheweekImg,
    'afternoon show': afternoonshowImg,
    'drive time weekend': drivetimeweekendImg,
    'malming (tapping)': malmingImg,
    'weekend seru': weekendseruImg,
    'yesterday hit': fallbackImage,
  };
  
  return imageMap[normalizedTitle] || fallbackImage;
};

// Check if program needs text overlay (AI-generated image or video background)
const needsTextOverlay = (programTitle: string): boolean => {
  const normalizedTitle = programTitle.trim().toLowerCase();
  const programsWithOverlay = [
    'drive time weekend',
    'malming (tapping)',
    'weekend seru',
    'yesterday hit',
    'afternoon show', // Video background program
    'good morning jakarta', // Video background program
  ];
  return programsWithOverlay.includes(normalizedTitle);
};

// Check if program uses video background
const usesVideoBackground = (programTitle: string): boolean => {
  const normalizedTitle = programTitle.trim().toLowerCase();
  return normalizedTitle === 'afternoon show' || normalizedTitle === 'good morning jakarta';
};

// Get video source for programs with video backgrounds
const getVideoSource = (programTitle: string): string => {
  const normalizedTitle = programTitle.trim().toLowerCase();
  if (normalizedTitle === 'afternoon show') {
    return '/attached_assets/afternoonShow_1762590789847.mp4';
  }
  if (normalizedTitle === 'good morning jakarta') {
    return '/attached_assets/gmjindyirwan_1763001208942.mp4';
  }
  return '';
};

// Get host photos from presenter string
const getHostPhotos = (presenterText: string): string[] => {
  const hostPhotoMapping: Record<string, string> = {
    "ABI": hostAbisaan,
    "AKBAR": hostAkbar,
    "DENNY": hostDenny,
    "DENNY CH": hostDenny,
    "DANY": hostDany,
    "EKO": hostEko,
    "EKO KUNTADHI": hostEko,
    "HATMA": hostHatma,
    "INDY": hostIndy,
    "IRWAN": hostIrwan,
    "LUVI": hostLuvi,
    "MAZDJO": hostMazdjo,
    "MAZJO": hostMazdjo,
    "MOSIDIK": hostMosidik,
    "NAYLA": hostNayla,
    "ODAH": hostOdah,
    "OTESYECH": hostOtesyech,
    "OT": hostOtesyech,
    "PUTRI": hostPutri,
    "RENO": hostReno,
    "RIO": hostRio,
    "RISAN": hostRisan,
    "YASSER": hostYasser,
  };

  const hostNames = presenterText
    .replace(/^(dengan|bersama dengan)\s+/i, '')
    .split(/\s*&\s*/)
    .filter(h => h);

  return hostNames
    .map(name => {
      const upperName = name.trim().toUpperCase();
      return hostPhotoMapping[upperName];
    })
    .filter(photo => photo !== undefined);
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
          {/* Program Image/Video - Always show with program-specific media */}
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-muted">
            {usesVideoBackground(program.programTitle) ? (
              /* Video Background for Afternoon Show & Good Morning Jakarta */
              <video 
                src={getVideoSource(program.programTitle)}
                autoPlay
                loop
                muted
                playsInline
                className="object-cover w-full h-full rounded-md"
                data-testid="video-on-air-program"
              />
            ) : (
              /* Image for all other programs */
              <img 
                src={getProgramImage(program.programTitle)}
                alt={program.programTitle}
                className="object-cover w-full h-full rounded-md"
                data-testid="img-on-air-program"
              />
            )}
            
            {/* Dark gradient overlay for programs with overlay */}
            {needsTextOverlay(program.programTitle) && (
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/30" />
            )}
            
            {/* Host photos and text overlay for AI-generated images */}
            {needsTextOverlay(program.programTitle) && program.presenter && program.presenter !== '-' && (() => {
              const hostPhotos = getHostPhotos(program.presenter);
              return (
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-end gap-3">
                    {/* Host Photos */}
                    {hostPhotos.length > 0 && (
                      <div className="flex gap-2">
                        {hostPhotos.map((photo, index) => (
                          <div 
                            key={index}
                            className="relative size-28 aspect-square overflow-hidden rounded-full border-[3px] border-white/90 shadow-2xl bg-muted"
                          >
                            <img 
                              src={photo} 
                              alt={`Host ${index + 1}`}
                              className="size-full object-cover"
                              data-testid={`img-host-${index}`}
                              style={{ objectPosition: '50% 25%' }}
                            />
                            {/* Glow effect */}
                            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Text Info */}
                    <div className="flex-1 text-white pb-1">
                      <h3 className="text-2xl font-bold mb-0.5 drop-shadow-lg" data-testid="text-overlay-title">
                        {program.programTitle}
                      </h3>
                      <p className="text-sm text-white/90 drop-shadow-md" data-testid="text-overlay-presenter">
                        {program.presenter}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
            
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
