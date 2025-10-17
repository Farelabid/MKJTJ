import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import backgroundTeamImage from "@assets/back_team_1760659734255.png";

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

export default function CrewOnDuty() {
  const { data, isLoading } = useQuery<CrewOnDutyData>({
    queryKey: ["/api/crew-on-duty"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-4">
          <Skeleton className="h-48 w-32" />
          <Skeleton className="h-48 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full space-y-4 px-4">
      {/* CrewOnDuty Logo Header */}
      <div className="mb-2">
        <img
          src="/attached_assets/CREWONDUTY_1760588402336.png"
          alt="Crew On Duty"
          className="h-8 w-auto"
          data-testid="image-crew-logo"
        />
      </div>

      {/* Crew Photos Side by Side */}
      <div className="flex gap-6 items-end justify-center">
        {/* Producer */}
        <div 
          className="flex flex-col items-center space-y-2 rounded-lg p-4 relative overflow-hidden"
          style={{
            backgroundImage: `url(${backgroundTeamImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <img
              src={data.producer.photoUrl}
              alt={`Producer ${data.producer.name}`}
              className="h-48 w-auto object-contain drop-shadow-2xl"
              data-testid="image-producer"
            />
          </div>
          <div className="text-center relative z-10">
            <p className="text-xl font-bold text-[#C4F542] drop-shadow-lg" data-testid="text-producer-name">
              {data.producer.name}
            </p>
            <p className="text-xs text-muted-foreground font-semibold">PRODUSER</p>
          </div>
        </div>

        {/* Operator */}
        <div 
          className="flex flex-col items-center space-y-2 rounded-lg p-4 relative overflow-hidden"
          style={{
            backgroundImage: `url(${backgroundTeamImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm"></div>
          <div className="relative z-10">
            <img
              src={data.operator.photoUrl}
              alt={`Operator ${data.operator.name}`}
              className="h-48 w-auto object-contain drop-shadow-2xl"
              data-testid="image-operator"
            />
          </div>
          <div className="text-center relative z-10">
            <p className="text-xl font-bold text-[#C4F542] drop-shadow-lg" data-testid="text-operator-name">
              {data.operator.name}
            </p>
            <p className="text-xs text-muted-foreground font-semibold">OPERATOR</p>
          </div>
        </div>
      </div>
    </div>
  );
}
