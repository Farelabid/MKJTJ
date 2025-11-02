import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface CrewOnDutyData {
  operator: {
    name: string;
    photoUrl: string;
  };
  producer: {
    name: string;
    photoUrl: string;
  };
  currentProgram: string;
  currentDay: string;
  currentShift: string;
}

interface OnAirProgram {
  programTitle: string;
  presenter: string;
  timeRange: string;
  description: string;
  imageUrl: string;
  status: string;
}

export default function CrewOnDuty() {
  const { data: crewData, isLoading: crewLoading } = useQuery<CrewOnDutyData>({
    queryKey: ["/api/crew-on-duty"],
    refetchInterval: 30000,
  });

  const { data: programData, isLoading: programLoading } = useQuery<OnAirProgram>({
    queryKey: ["/api/on-air-program"],
    refetchInterval: 30000,
  });

  if (crewLoading || programLoading || !crewData || !programData) {
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

  const formatDate = () => {
    const now = new Date();
    const wibOffset = 7 * 60;
    const localOffset = now.getTimezoneOffset();
    const wibTime = new Date(now.getTime() + (wibOffset + localOffset) * 60 * 1000);
    
    const day = String(wibTime.getDate()).padStart(2, '0');
    const months = ['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
    const month = months[wibTime.getMonth()];
    const year = wibTime.getFullYear();
    
    return `${day} ${month} ${year}`;
  };

  const splitPresenters = (presenter: string) => {
    const cleanPresenter = presenter.replace(/^presenters?:\s*/i, '').trim();
    const parts = cleanPresenter.split(/\s*&\s*/);
    return parts.length >= 2 ? [parts[0].trim(), parts[1].trim()] : [parts[0].trim(), ''];
  };

  const [host1, host2] = splitPresenters(programData.presenter);

  return (
    <div className="flex flex-col items-center justify-center w-full space-y-3">
      {/* Team Work Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-2 rounded-md shadow-lg">
        <h2 className="text-white font-bold text-sm tracking-wide" data-testid="text-team-work-header">
          TEAM WORK {formatDate()}
        </h2>
      </div>

      {/* 4 Crew Photos in a Row */}
      <div className="flex gap-3 items-end justify-center">
        {/* Operator */}
        <div className="flex flex-col items-center space-y-1">
          <div className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-blue-500/20 to-blue-700/20 border-2 border-blue-500/30">
            <img
              src={crewData.operator.photoUrl}
              alt={`Operator ${crewData.operator.name}`}
              className="w-full h-full object-cover"
              data-testid="image-operator"
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-blue-400" data-testid="text-operator-role">OPERATOR</p>
            <p className="text-[10px] text-muted-foreground font-semibold" data-testid="text-operator-name">
              {crewData.operator.name}
            </p>
          </div>
        </div>

        {/* Producer */}
        <div className="flex flex-col items-center space-y-1">
          <div className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 border-2 border-yellow-500/30">
            <img
              src={crewData.producer.photoUrl}
              alt={`Producer ${crewData.producer.name}`}
              className="w-full h-full object-cover"
              data-testid="image-producer"
            />
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-yellow-400" data-testid="text-producer-role">PRODUSER</p>
            <p className="text-[10px] text-muted-foreground font-semibold" data-testid="text-producer-name">
              {crewData.producer.name}
            </p>
          </div>
        </div>

        {/* Host 1 */}
        {host1 && (
          <div className="flex flex-col items-center space-y-1">
            <div className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-700/20 border-2 border-orange-500/30 flex items-center justify-center">
              <p className="text-3xl font-bold text-orange-400">H1</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-orange-400" data-testid="text-host1-role">HOST</p>
              <p className="text-[10px] text-muted-foreground font-semibold" data-testid="text-host1-name">
                {host1}
              </p>
            </div>
          </div>
        )}

        {/* Host 2 */}
        {host2 && (
          <div className="flex flex-col items-center space-y-1">
            <div className="w-20 h-28 rounded-lg overflow-hidden bg-gradient-to-br from-orange-500/20 to-orange-700/20 border-2 border-orange-500/30 flex items-center justify-center">
              <p className="text-3xl font-bold text-orange-400">H2</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-orange-400" data-testid="text-host2-role">HOST</p>
              <p className="text-[10px] text-muted-foreground font-semibold" data-testid="text-host2-name">
                {host2}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* LIVE NOW Banner */}
      <div className="w-full bg-gradient-to-r from-red-600 via-red-700 to-red-600 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
              <div className="relative h-3 w-3 rounded-full bg-white" />
            </div>
            <h3 className="text-white font-black text-2xl tracking-wider drop-shadow-lg" data-testid="text-live-now">
              LIVE NOW
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
