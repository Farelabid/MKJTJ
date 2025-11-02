import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface OnAirProgram {
  programTitle: string;
  presenter: string;
  timeRange: string;
  description: string;
  imageUrl: string;
  status: string;
}

export default function CrewOnDuty() {
  const { data: programData, isLoading: programLoading } = useQuery<OnAirProgram>({
    queryKey: ["/api/on-air-program"],
    refetchInterval: 30000,
  });

  if (programLoading || !programData) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Skeleton className="h-12 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-40 w-24" />
          <Skeleton className="h-40 w-24" />
          <Skeleton className="h-40 w-24" />
          <Skeleton className="h-40 w-24" />
        </div>
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  // Get current day of week
  const getDayOfWeek = (): string => {
    const now = new Date();
    const wibOffset = 7 * 60;
    const localOffset = now.getTimezoneOffset();
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return days[wibTime.getDay()];
  };

  // Check if current time is in virtual crew shift (00:01-05:59 WIB)
  const isVirtualCrewTime = (): boolean => {
    const now = new Date();
    const wibOffset = 7 * 60;
    const localOffset = now.getTimezoneOffset();
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    const currentHour = wibTime.getHours();
    
    // Virtual crew active from 00:00-05:59 WIB (Night Flow program)
    return currentHour >= 0 && currentHour < 6;
  };

  // Producer schedule mapping using NEW professional photos
  const getProducerPhoto = (): { name: string; photoUrl: string } => {
    // Virtual crew shift (00:01-05:59 WIB)
    if (isVirtualCrewTime()) {
      return {
        name: "VIRTUAL",
        photoUrl: "/attached_assets/virtual_produser_1762106064761.png"
      };
    }

    const day = getDayOfWeek();
    const program = programData.programTitle;
    
    // Producer mapping based on CSV schedule
    const producerSchedule: Record<string, Record<string, string>> = {
      "Good Morning Jakarta": {
        monday: "AUDREY", tuesday: "ZAKIYA", wednesday: "ZAKIYA", thursday: "AUDREY",
        friday: "ZAKIYA", saturday: "ZAKIYA", sunday: "AUDREY"
      },
      "Good Morning JKT Weekend": {
        monday: "ZAKIYA", tuesday: "ZAKIYA", wednesday: "ZAKIYA", thursday: "ZAKIYA",
        friday: "ZAKIYA", saturday: "ZAKIYA", sunday: "AUDREY"
      },
      "Office Hour": {
        monday: "RISAN", tuesday: "INDIRA", wednesday: "INDIRA", thursday: "RISAN",
        friday: "RISAN", saturday: "INDIRA", sunday: "INDIRA"
      },
      "Coffee Break": {
        monday: "NAYLA", tuesday: "PATRICIA", wednesday: "NAYLA", thursday: "PATRICIA",
        friday: "PATRICIA", saturday: "PATRICIA", sunday: "PATRICIA"
      },
      "Afternoon Show": {
        monday: "PATRICIA", tuesday: "PATRICIA", wednesday: "PATRICIA", thursday: "PATRICIA",
        friday: "PATRICIA", saturday: "PATRICIA", sunday: "NAYLA"
      },
      "Drive Time": {
        monday: "LUVI", tuesday: "LUVI", wednesday: "LUVI", thursday: "LUVI",
        friday: "LUVI", saturday: "SAKINAH", sunday: "SAKINAH"
      },
      "Drive Time Weekend": {
        monday: "SAKINAH", tuesday: "SAKINAH", wednesday: "SAKINAH", thursday: "SAKINAH",
        friday: "SAKINAH", saturday: "SAKINAH", sunday: "SAKINAH"
      },
      "Shift Malam": {
        monday: "JHOSUA", tuesday: "JHOSUA", wednesday: "JHOSUA", thursday: "JHOSUA",
        friday: "JHOSUA", saturday: "JHOSUA", sunday: "JHOSUA"
      }
    };

    // NEW Professional producer photos (uploaded today)
    const producerPhotos: Record<string, string> = {
      "JHOSUA": "/attached_assets/produser_jhosua_1762098258506.png",
      "LUVI": "/attached_assets/produser_luvi_1762098258507.png",
      "NAYLA": "/attached_assets/produser_nayla_1762098258507.png",
      "PATRICIA": "/attached_assets/produser_patricia_1762098258507.png",
      "RISAN": "/attached_assets/produser_risan_1762098258507.png",
      "AUDREY": "/attached_assets/produser_audrey_1762125589588.png",
      "ZAKIYA": "/attached_assets/magang_zakiya_1762097040087.png",
      "INDIRA": "/attached_assets/magang_indira_1762097040087.png",
      "SAKINAH": "/attached_assets/magang_sakinanh_1762097040087.png",
    };

    const producerName = producerSchedule[program]?.[day] || "CREW";
    const photoUrl = producerPhotos[producerName] || "/attached_assets/sementara_1762090833934.png";

    return { name: producerName, photoUrl };
  };

  // Get operator photo based on shift schedule
  const getOperatorPhoto = (): { name: string; photoUrl: string } => {
    // Virtual crew shift (00:01-05:59 WIB)
    if (isVirtualCrewTime()) {
      return {
        name: "VIRTUAL",
        photoUrl: "/attached_assets/virtual_operator_1762106064761.png"
      };
    }

    const day = getDayOfWeek();
    
    // Get current time in WIB to determine shift
    const now = new Date();
    const wibOffset = 7 * 60;
    const localOffset = now.getTimezoneOffset();
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    const currentHour = wibTime.getHours();
    
    // Determine shift based on time
    let shift: 'shift1' | 'shift2' | 'shift3';
    if (currentHour >= 5 && currentHour < 12) {
      shift = 'shift1'; // 05:00-12:00
    } else if (currentHour >= 12 && currentHour < 19) {
      shift = 'shift2'; // 12:00-19:00
    } else {
      shift = 'shift3'; // 19:00-24:00 (and 00:00-05:00)
    }
    
    // Operator schedule from uploaded image (with specific intern names)
    const operatorSchedule: Record<string, Record<string, string>> = {
      shift1: {
        monday: "ADE", tuesday: "RULLY", wednesday: "RULLY", thursday: "RULLY",
        friday: "RULLY", saturday: "ADE", sunday: "ADE"
      },
      shift2: {
        monday: "JHOSUA", tuesday: "JHOSUA", wednesday: "ADE", thursday: "JHOSUA",
        friday: "ARYO", saturday: "RULLY", sunday: "JHOSUA"
      },
      shift3: {
        monday: "ARYO", tuesday: "ARYO", wednesday: "ARYO", thursday: "ADE",
        friday: "JHOSUA", saturday: "ARYO", sunday: "FARHAN"
      }
    };

    // Operator photos (updated with new professional photo for ADE)
    const operatorPhotos: Record<string, string> = {
      "ARYO": "/attached_assets/opr_aryo_1762105125710.png",
      "AUDREY": "/attached_assets/opr_audrey_1760589447426.png",
      "JHOSUA": "/attached_assets/opr_jhosua_1760589447426.png",
      "RULLY": "/attached_assets/opr_rully_1760589447426.png",
      "ADE": "/attached_assets/opr_ade_1762099159402.png",
      "FARHAN": "/attached_assets/magang_farhan_1762097040086.png",
      "NANDA": "/attached_assets/magang_nanda_1762097040087.png",
    };

    const operatorName = operatorSchedule[shift]?.[day] || "CREW";
    const photoUrl = operatorPhotos[operatorName] || "/attached_assets/sementara_1762090833934.png";

    return { name: operatorName, photoUrl };
  };

  // Get host photos from program presenter
  const getHostPhotos = (): Array<{ name: string; photoUrl: string }> => {
    // Virtual crew shift (00:01-05:59 WIB) - Always return 2 virtual hosts
    if (isVirtualCrewTime()) {
      return [
        {
          name: "VIRTUAL 1",
          photoUrl: "/attached_assets/virtual_host1_1762106064760.png"
        },
        {
          name: "VIRTUAL 2",
          photoUrl: "/attached_assets/virtual_host2_1762106064761.png"
        }
      ];
    }

    const presenterText = programData.presenter || "";
    const hostNames = presenterText.replace(/^dengan\s+/i, '').split(/\s*&\s*/).filter(h => h);

    const hostPhotoMapping: Record<string, string> = {
      "ABI": "/attached_assets/host_abisaan_1762096185716.png",
      "AKBAR": "/attached_assets/host_akbar_1762096185716.png",
      "DENNY": "/attached_assets/host_dennychandra_1762096202310.png",
      "DENNY CH": "/attached_assets/host_dennychandra_1762096202310.png",
      "DANY": "/attached_assets/host_mcdanny_1762096221521.png",
      "EKO": "/attached_assets/host_ekokuntadhi_1762096202311.png",
      "EKO KUNTADHI": "/attached_assets/host_ekokuntadhi_1762096202311.png",
      "HATMA": "/attached_assets/host_hatma_1762096202311.png",
      "INDY": "/attached_assets/host_indyrahmawati_1762096202311.png",
      "IRWAN": "/attached_assets/host_irwanardian_1762096221521.png",
      "LUVI": "/attached_assets/host_luvi_1762096221521.png",
      "MAZDJO": "/attached_assets/host_mazdjopray_1762096221521.png",
      "MAZJO": "/attached_assets/host_mazdjopray_1762096221521.png",
      "MOSIDIK": "/attached_assets/host_mosidik_1762096221522.png",
      "NAYLA": "/attached_assets/host_nayla_1762096257881.png",
      "ODAH": "/attached_assets/host_odah_1762096257881.png",
      "OTESYECH": "/attached_assets/host_otsyech_1762096257882.png",
      "OT": "/attached_assets/host_otsyech_1762096257882.png",
      "PUTRI": "/attached_assets/magang_putri_1762097040087.png",
      "RENO": "/attached_assets/host_reno_1762096257882.png",
      "RIO": "/attached_assets/host_rio_1762096257882.png",
      "RISAN": "/attached_assets/host_risan_1762096272039.png",
      "YASSER": "/attached_assets/host_yasser_1762096272039.png",
    };

    return hostNames.map(name => {
      const upperName = name.trim().toUpperCase();
      return {
        name: upperName,
        photoUrl: hostPhotoMapping[upperName] || "/attached_assets/sementara_1762090833934.png"
      };
    });
  };

  const operator = getOperatorPhoto();
  const producer = getProducerPhoto();
  const hosts = getHostPhotos();

  const getDateInfo = () => {
    const now = new Date();
    const wibOffset = 7 * 60;
    const localOffset = now.getTimezoneOffset();
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    
    const days = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
    const dayName = days[wibTime.getDay()];
    const day = String(wibTime.getDate()).padStart(2, '0');
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const month = months[wibTime.getMonth()];
    const year = wibTime.getFullYear();
    
    return {
      dayName,
      fullDate: `${day} ${month} ${year}`
    };
  };

  const dateInfo = getDateInfo();

  return (
    <div className="flex flex-col items-center justify-center w-full space-y-3">
      {/* Team Work Header */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 rounded-md shadow-lg w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-blue-900 font-black text-lg tracking-tight" data-testid="text-team-work-header">
            TJRADIO TODAY TEAM
          </h2>
          <div className="text-right" data-testid="text-team-work-date">
            <p className="text-yellow-300 font-bold text-[11px] leading-tight tracking-wide">
              {dateInfo.dayName}
            </p>
            <p className="text-yellow-300 font-bold text-xs leading-tight tracking-wide">
              {dateInfo.fullDate}
            </p>
          </div>
        </div>
      </div>

      {/* 4 Crew Photos in a Row: Operator + Producer + 2 Hosts */}
      <div className="flex gap-3 items-end justify-center">
        {/* Operator - Based on shift schedule (Light Blue) */}
        <div className="flex flex-col items-center space-y-1">
          <div className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-cyan-500/20 to-cyan-700/20 border-2 border-cyan-400">
            <img
              src={operator.photoUrl}
              alt={`Operator ${operator.name}`}
              className="w-full h-full object-cover"
              data-testid="image-operator"
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-cyan-400" data-testid="text-operator-role">OPERATOR</p>
            <p className="text-[10px] text-muted-foreground font-semibold" data-testid="text-operator-name">
              {operator.name}
            </p>
          </div>
        </div>

        {/* Producer - Using NEW professional photos (Orange) with 3D Tilt Effect */}
        <div className="flex flex-col items-center space-y-1">
          <div 
            className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-700/20 border-2 border-orange-500"
            style={{
              perspective: '1000px',
              transformStyle: 'preserve-3d'
            }}
          >
            <img
              src={producer.photoUrl}
              alt={`Producer ${producer.name}`}
              className="w-full h-full object-cover"
              style={{
                animation: 'tilt3d 6s ease-in-out infinite',
                transformStyle: 'preserve-3d'
              }}
              data-testid="image-producer"
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-orange-400" data-testid="text-producer-role">PRODUSER</p>
            <p className="text-[10px] text-muted-foreground font-semibold" data-testid="text-producer-name">
              {producer.name}
            </p>
          </div>
        </div>

        {/* Hosts - Dynamic based on program data (Bright Green with Neon Glow) */}
        {hosts.map((host, index) => (
          <div key={index} className="flex flex-col items-center space-y-1">
            <div className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-lime-500/20 to-lime-700/20 border-2 border-lime-400 shadow-[0_0_10px_rgba(132,204,22,0.6)] animate-pulse">
              <img
                src={host.photoUrl}
                alt={`Host ${host.name}`}
                className="w-full h-full object-cover"
                data-testid={`image-host${index + 1}`}
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-lime-400" data-testid={`text-host${index + 1}-role`}>HOST</p>
              <p className="text-[10px] text-muted-foreground font-semibold" data-testid={`text-host${index + 1}-name`}>
                {host.name}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ONAIR NOW Banner */}
      <div className="w-full bg-gradient-to-r from-red-600 via-red-700 to-red-600 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
              <div className="relative h-3 w-3 rounded-full bg-white" />
            </div>
            <h3 className="font-black text-2xl tracking-wider drop-shadow-lg" data-testid="text-live-now">
              <span className="text-white">ONAIR</span> <span className="text-yellow-300">NOW</span>
            </h3>
          </div>
          <div className="text-right">
            <p className="text-white/80 text-xs font-medium uppercase" data-testid="text-program-subtitle">
              {programData.programTitle.includes('Weekend') ? 'THIS WEEKEND' : 'DAILY'}
            </p>
          </div>
        </div>
      </div>

      {/* Program Info */}
      <div className="w-full bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg px-4 py-3 border border-gray-700">
        <div className="text-center">
          <h4 className="text-orange-400 font-black text-lg tracking-wide mb-1" data-testid="text-program-name">
            {programData.programTitle.toUpperCase()}
          </h4>
          <p className="text-white text-sm font-semibold" data-testid="text-program-time">
            {programData.timeRange}
          </p>
        </div>
      </div>
    </div>
  );
}
