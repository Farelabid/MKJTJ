import { useQuery } from "@tanstack/react-query";
import { RadioStats } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { Radio, Users, Signal, ExternalLink, RefreshCw, Copy, Check, Settings, TrendingUp, TrendingDown, Minus, Sun, CloudSun, Cloud, CloudFog, CloudDrizzle, CloudRain, Snowflake, CloudRainWind, CloudSnow, CloudLightning, CloudHail, HelpCircle, Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Link } from "wouter";
import { getWeatherInfo, formatTemperature } from "@/lib/weatherUtils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/theme-toggle";
import { HistoricalChart } from "@/components/historical-chart";
import { ProgramListeners } from "@/components/program-listeners";
import { OnAirProgram } from "@/components/on-air-program";
import { ComingUpNext } from "@/components/coming-up-next";
import ThreeDayStats from "@/components/three-day-stats";
import CrewOnDuty from "@/components/crew-on-duty";
import WeeklyStats from "@/components/weekly-stats";
import { useToast } from "@/hooks/use-toast";
import { useCounterAnimation } from "@/hooks/use-counter-animation";
import tjRadioLogo from "@assets/logo_official_tj_1760323825293.png";
import sponsorHeaderImage from "@assets/back_header_1760419724787.png";

// Weather icon mapping
const weatherIcons = {
  "sun": Sun,
  "cloud-sun": CloudSun,
  "cloud": Cloud,
  "cloud-fog": CloudFog,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "snowflake": Snowflake,
  "cloud-rain-wind": CloudRainWind,
  "cloud-snow": CloudSnow,
  "cloud-lightning": CloudLightning,
  "cloud-hail": CloudHail,
  "help-circle": HelpCircle,
};

export default function Dashboard() {
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(20);
  const [copied, setCopied] = useState(false);
  const [currentDateTime, setCurrentDateTime] = useState(new Date());
  const [previousListeners, setPreviousListeners] = useState<number | null>(null);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');
  
  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const { toast } = useToast();

  const { data: stats, isLoading, error, refetch } = useQuery<RadioStats>({
    queryKey: ["/api/radio-stats"],
    refetchInterval: 20000, // Refresh every 20 seconds for real-time data
    staleTime: 0, // Always fetch fresh data
  });

  // Animated counter for smooth number transitions
  const animatedListeners = useCounterAnimation(stats?.listenersCurrent || 0, {
    duration: 800, // 0.8 second animation
  });

  // Fetch stream health status (refresh every 20 seconds, synced with stats)
  const { data: streamHealth, isLoading: isHealthLoading, error: healthError } = useQuery<{
    status: 'excellent' | 'good' | 'degraded' | 'offline' | 'initializing';
    lastResponseTime: number;
    avgResponseTime: number;
    successRate: number;
    lastCheckTime: string;
    isInitialized: boolean;
    totalRequests: number;
    successCount: number;
    failureCount: number;
  }>({
    queryKey: ["/api/stream-health"],
    refetchInterval: 20000, // Refresh every 20 seconds (synced with radio stats)
    staleTime: 0,
    retry: 2, // Retry failed requests twice
  });

  // Fetch Jakarta weather data (refresh every 5 minutes)
  const { data: weather, isLoading: isWeatherLoading, error: weatherError } = useQuery<{
    temperature: number;
    windSpeed: number;
    windDirection: number;
    weatherCode: number;
    time: string;
  }>({
    queryKey: ["/api/jakarta-weather"],
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 4 * 60 * 1000, // Data fresh for 4 minutes
    retry: 2, // Retry failed requests twice
  });

  // Debug: log stats when it changes
  useEffect(() => {
    if (stats) {
      console.log('[Dashboard] Stats updated:', {
        listenersRaw: stats.listenersRaw,
        listenersCurrent: stats.listenersCurrent,
        multiplier: stats.listenersCurrent / stats.listenersRaw
      });
    }
  }, [stats]);

  // Track listener trend - use ref to avoid updating before render
  const prevListenersRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (stats && stats.listenersCurrent !== undefined) {
      if (prevListenersRef.current !== null && prevListenersRef.current !== stats.listenersCurrent) {
        const diff = stats.listenersCurrent - prevListenersRef.current;
        const threshold = prevListenersRef.current * 0.05; // 5% change threshold
        
        if (diff > threshold) {
          setTrend('up');
        } else if (diff < -threshold) {
          setTrend('down');
        } else {
          setTrend('stable');
        }
        
        // Update state for display
        setPreviousListeners(prevListenersRef.current);
      }
      
      // Update ref for next comparison
      prevListenersRef.current = stats.listenersCurrent;
    }
  }, [stats?.listenersCurrent]);

  useEffect(() => {
    const timer = setInterval(() => {
      setAutoRefreshCountdown((prev) => {
        if (prev <= 1) {
          return 20;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleManualRefresh = () => {
    refetch();
    setAutoRefreshCountdown(20);
    toast({
      title: "Data Diperbarui",
      description: "Statistik radio telah diperbarui",
    });
  };

  const handleCopyUrl = async () => {
    if (stats?.streamUrl) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(stats.streamUrl);
          setCopied(true);
          toast({
            title: "URL Disalin",
            description: "URL stream telah disalin ke clipboard",
          });
          setTimeout(() => setCopied(false), 2000);
        } else {
          // Fallback for non-secure contexts
          const textArea = document.createElement("textarea");
          textArea.value = stats.streamUrl;
          textArea.style.position = "fixed";
          textArea.style.left = "-999999px";
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          setCopied(true);
          toast({
            title: "URL Disalin",
            description: "URL stream telah disalin ke clipboard",
          });
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (err) {
        toast({
          title: "Gagal Menyalin",
          description: "Tidak dapat menyalin URL. Silakan salin manual.",
          variant: "destructive",
        });
      }
    }
  };

  const getListenerRatio = () => {
    if (!stats || stats.listenersPeak === 0) return 0;
    const ratio = (stats.listenersCurrent / stats.listenersPeak) * 100;
    return Math.min(Math.max(ratio, 0), 100);
  };

  // Calculate needle angle based on current listeners (1K to 10K scale)
  const getNeedleAngle = () => {
    if (!stats) return -130; // Start position at 1K
    const listeners = stats.listenersCurrent;
    const minScale = 1000;  // 1K
    const maxScale = 10000; // 10K
    
    // Clamp listeners to scale range
    const clampedListeners = Math.min(Math.max(listeners, minScale), maxScale);
    
    // Calculate percentage within range (0-100%)
    const percentage = ((clampedListeners - minScale) / (maxScale - minScale)) * 100;
    
    // Convert to angle: -130° (1K) to +50° (10K) = 180° total arc
    return -130 + (percentage * 180 / 100);
  };

  const getRatioColor = () => {
    const ratio = getListenerRatio();
    if (ratio >= 80) return "hsl(var(--chart-3))";
    if (ratio >= 50) return "hsl(var(--chart-5))";
    return "hsl(var(--chart-1))";
  };

  const getTrendPercentage = () => {
    if (!stats || !previousListeners || previousListeners === 0) return 0;
    const diff = stats.listenersCurrent - previousListeners;
    return ((diff / previousListeners) * 100);
  };


  // Audio player controls
  const handlePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch((error) => {
          console.error('Error playing audio:', error);
          toast({
            title: "Gagal Memutar",
            description: "Tidak dapat memutar stream. Silakan coba lagi.",
            variant: "destructive",
          });
        });
      }
    }
  };

  const handleMuteToggle = () => {
    if (audioRef.current) {
      const newMutedState = !isMuted;
      audioRef.current.muted = newMutedState;
      setIsMuted(newMutedState);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
      
      // Synchronize muted state with volume
      if (newVolume === 0) {
        audioRef.current.muted = true;
        setIsMuted(true);
      } else {
        // Unmute when volume is above 0
        audioRef.current.muted = false;
        setIsMuted(false);
      }
    }
  };

  // Sync isPlaying state with audio element events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Auto-play on component mount
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      // Try to auto-play
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .catch((error) => {
            // Auto-play was prevented by browser
            console.log('Auto-play prevented:', error);
            // Show user-friendly notification
            toast({
              title: "Auto-play Diblokir",
              description: "Silakan klik tombol 'Dengarkan Live' untuk memutar radio.",
            });
          });
      }
    }
  }, []);

  const formatDateTime = () => {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const day = days[currentDateTime.getDay()];
    const time = currentDateTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const date = currentDateTime.getDate();
    const month = months[currentDateTime.getMonth()];
    const year = currentDateTime.getFullYear();
    
    return `${day}, ${time}, ${date} ${month} ${year}`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <div className="text-destructive mb-4">
            <Signal className="h-12 w-12 mx-auto mb-2" />
            <h2 className="text-xl font-semibold">Koneksi Terputus</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            Tidak dapat terhubung ke server streaming. Silakan coba lagi.
          </p>
          <Button onClick={handleManualRefresh} data-testid="button-retry">
            <RefreshCw className="h-4 w-4 mr-2" />
            Coba Lagi
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 relative">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 flex items-center justify-center">
                <img 
                  src={tjRadioLogo} 
                  alt="TJ Radio Jakarta Logo" 
                  className="h-12 w-12 object-contain"
                  data-testid="img-tj-radio-logo"
                />
              </div>
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-6 w-40 mb-1" />
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48 mt-1" />
                  </>
                ) : (
                  <>
                    <h1 className="text-xl font-bold" data-testid="text-radio-name">
                      {stats?.streamName}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                      {stats?.streamDescription}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1" data-testid="text-current-datetime">
                      {formatDateTime()}
                    </p>
                  </>
                )}
              </div>
            </div>
            
            {/* Sponsor Header Image */}
            <div className="hidden md:flex items-center justify-center flex-shrink-0 absolute left-1/2 -translate-x-1/2">
              <img 
                src={sponsorHeaderImage} 
                alt="Supported by" 
                className="h-[82px] w-auto object-contain"
                data-testid="img-sponsor-header"
              />
            </div>

            {/* Widgets Container: Stream Health + Jakarta Weather */}
            <div className="flex items-center gap-2">
              {/* Stream Health Widget */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border backdrop-blur-sm ${
                isHealthLoading || healthError || streamHealth?.status === 'initializing' ? 'bg-gradient-to-r from-gray-600/20 via-gray-500/20 to-gray-600/20 border-gray-500/30' :
                streamHealth?.status === 'excellent' ? 'bg-gradient-to-r from-green-600/20 via-emerald-600/20 to-green-600/20 border-green-500/30' :
                streamHealth?.status === 'good' ? 'bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 border-blue-500/30' :
                streamHealth?.status === 'degraded' ? 'bg-gradient-to-r from-yellow-600/20 via-amber-600/20 to-yellow-600/20 border-yellow-500/30' :
                'bg-gradient-to-r from-red-600/20 via-rose-600/20 to-red-600/20 border-red-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  {/* Health Status Icon */}
                  {isHealthLoading ? (
                    <Skeleton className="h-6 w-6 rounded-full" />
                  ) : (
                    <div className="relative flex-shrink-0">
                      {streamHealth?.status !== 'offline' && (
                        <div className={`absolute inset-0 rounded-full animate-pulse opacity-50 ${
                          streamHealth?.status === 'excellent' ? 'bg-green-500' :
                          streamHealth?.status === 'good' ? 'bg-blue-500' :
                          'bg-yellow-500'
                        }`} />
                      )}
                      <div className={`relative h-6 w-6 rounded-full flex items-center justify-center ${
                        streamHealth?.status === 'excellent' ? 'bg-gradient-to-br from-green-500 to-emerald-500' :
                        streamHealth?.status === 'good' ? 'bg-gradient-to-br from-blue-500 to-cyan-500' :
                        streamHealth?.status === 'degraded' ? 'bg-gradient-to-br from-yellow-500 to-amber-500' :
                        'bg-gradient-to-br from-red-500 to-rose-500'
                      }`}>
                        <Signal className={`h-4 w-4 text-white ${
                          streamHealth?.status === 'offline' ? 'animate-none' : 'animate-pulse'
                        }`} />
                      </div>
                    </div>
                  )}
                  
                  {/* Stream Health Text */}
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      healthError || !streamHealth ? 'text-gray-400' :
                      streamHealth?.status === 'excellent' ? 'text-green-400' :
                      streamHealth?.status === 'good' ? 'text-blue-400' :
                      streamHealth?.status === 'degraded' ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      Stream Status
                    </span>
                    {isHealthLoading ? (
                      <Skeleton className="h-3 w-24" />
                    ) : healthError ? (
                      <span className="text-xs text-muted-foreground" data-testid="text-stream-error">
                        Tidak tersedia
                      </span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground" data-testid="text-stream-status">
                          {streamHealth?.status === 'initializing' ? 'Memuat...' :
                           streamHealth?.status === 'excellent' ? 'Sempurna' :
                           streamHealth?.status === 'good' ? 'Baik' :
                           streamHealth?.status === 'degraded' ? 'Lambat' :
                           'Offline'}
                        </span>
                        {streamHealth && streamHealth.avgResponseTime > 0 && streamHealth.status !== 'offline' && streamHealth.status !== 'initializing' && (
                          <span className="text-[10px] text-muted-foreground" data-testid="text-response-time">
                            {streamHealth.avgResponseTime}ms
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Jakarta Weather Widget */}
              <div className="flex items-center gap-2 bg-gradient-to-r from-sky-600/20 via-blue-600/20 to-sky-600/20 px-3 py-2 rounded-lg border border-sky-500/30 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  {/* Weather Icon with Animation */}
                  {isWeatherLoading ? (
                    <Skeleton className="h-6 w-6 rounded-full" />
                  ) : weatherError ? (
                    <div className="relative h-6 w-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center flex-shrink-0">
                      <HelpCircle className="h-4 w-4 text-white" />
                    </div>
                  ) : weather ? (
                    (() => {
                      const weatherInfo = getWeatherInfo(weather.weatherCode);
                      const IconComponent = weatherIcons[weatherInfo.icon as keyof typeof weatherIcons];
                      return (
                        <div className="relative flex-shrink-0">
                          <div className="absolute inset-0 bg-sky-500 rounded-full animate-pulse opacity-50" />
                          <div className="relative h-6 w-6 rounded-full bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center">
                            <IconComponent className={`h-4 w-4 text-white`} />
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <Skeleton className="h-6 w-6 rounded-full" />
                  )}
                  
                  {/* Weather Info */}
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] font-bold text-sky-400 uppercase tracking-wider">
                      Cuaca Jakarta
                    </span>
                    {isWeatherLoading ? (
                      <Skeleton className="h-3 w-24" />
                    ) : weatherError ? (
                      <span className="text-xs text-muted-foreground" data-testid="text-weather-error">
                        Data tidak tersedia
                      </span>
                    ) : weather ? (
                      (() => {
                        const weatherInfo = getWeatherInfo(weather.weatherCode);
                        return (
                          <div className="flex items-center gap-1.5 overflow-hidden">
                            <span className="text-xs font-semibold text-foreground" data-testid="text-temperature">
                              {formatTemperature(weather.temperature)}
                            </span>
                            <span className="text-[10px] text-muted-foreground truncate" data-testid="text-weather-condition">
                              {weatherInfo.description}
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-xs text-muted-foreground">Loading...</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Hero Statistics - Redesigned 3 Column Layout */}
        <section className="bg-card/30 backdrop-blur-sm rounded-lg p-6 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {/* Left: Speedometer Gauge */}
            <div className="relative flex flex-col items-center justify-center p-4 bg-black/40 rounded-xl">
              {isLoading ? (
                <Skeleton className="h-80 w-80 rounded-full" />
              ) : (
                <div className="relative w-full max-w-sm aspect-square flex items-center justify-center">
                  {/* Speedometer Background Image */}
                  <img 
                    src="/attached_assets/SPEEDOBACK_1762085711848.png" 
                    alt="Speedometer Background"
                    className="w-full h-full object-contain"
                    data-testid="img-speedometer-background"
                  />
                  
                  {/* Center Text Content - Z-index 5, pointer-events-none for text passthrough */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none" style={{ zIndex: 5 }}>

                    {/* "OVER" Label */}
                    <p className="text-xs font-bold text-gray-400 tracking-wider mb-1 mt-4">
                      OVER
                    </p>
                    
                    {/* Mechanical Flip Counter - Vintage Odometer Style */}
                    <div className="flex items-center justify-center gap-0.5 mb-1" data-testid="text-listeners-current">
                      {(() => {
                        const value = animatedListeners;
                        const digits = Math.floor(value).toString().split('');
                        const paddedDigits = digits.length < 5 ? '0'.repeat(5 - digits.length).split('').concat(digits) : digits;
                        
                        return paddedDigits.map((digit, index) => (
                          <div
                            key={index}
                            className="relative"
                            style={{
                              width: '38px',
                              height: '52px',
                              background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)',
                              borderRadius: '4px',
                              boxShadow: `
                                inset 0 2px 4px rgba(0, 0, 0, 0.8),
                                inset 0 -1px 2px rgba(255, 255, 255, 0.1),
                                0 2px 4px rgba(0, 0, 0, 0.5),
                                0 0 8px rgba(255, 215, 0, 0.2)
                              `,
                              border: '1px solid #2a2a2a',
                              overflow: 'hidden',
                            }}
                          >
                            {/* Horizontal split line */}
                            <div
                              className="absolute left-0 right-0"
                              style={{
                                top: '50%',
                                height: '1px',
                                background: '#333',
                                boxShadow: '0 0 2px rgba(0, 0, 0, 0.8)',
                                zIndex: 2,
                              }}
                            />
                            
                            {/* Digit */}
                            <div
                              className="absolute inset-0 flex items-center justify-center font-mono font-black"
                              style={{
                                fontSize: '34px',
                                color: '#FFD700',
                                textShadow: `
                                  0 0 10px rgba(255, 215, 0, 0.9),
                                  0 0 20px rgba(255, 215, 0, 0.7),
                                  0 0 30px rgba(255, 215, 0, 0.5),
                                  0 2px 4px rgba(0, 0, 0, 0.8)
                                `,
                                letterSpacing: '-0.05em',
                                animation: 'neonGlowPulse 2.5s ease-in-out infinite',
                              }}
                            >
                              {digit}
                            </div>
                            
                            {/* Top reflection */}
                            <div
                              className="absolute top-0 left-0 right-0 pointer-events-none"
                              style={{
                                height: '40%',
                                background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.15) 0%, transparent 100%)',
                              }}
                            />
                          </div>
                        ));
                      })()}
                    </div>
                    
                    {/* Subtitle */}
                    <p className="text-[9px] font-medium text-gray-300 tracking-wide mb-1 px-2">
                      PEOPLE ARE LISTENING<br/>TO US RIGHT NOW
                    </p>
                    
                    {/* Formula Display */}
                    {stats && (
                      <div className="mb-2 px-2">
                        <div className="inline-flex items-center gap-1 bg-black/50 px-2 py-1 rounded border border-yellow-500/20">
                          <span className="text-[10px] font-mono text-gray-400">
                            {stats.listenersRaw} <span className="text-yellow-500/60">×</span> {Math.round(stats.listenersCurrent / stats.listenersRaw)} <span className="text-yellow-500/60">=</span>
                          </span>
                          <span className="text-[11px] font-bold text-yellow-500">
                            {stats.listenersCurrent.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Trend Indicator */}
                    {stats && previousListeners !== null && (
                      <p className="text-xs font-semibold text-[#FFA500] mb-2">
                        {getTrendPercentage() > 0 ? '+' : getTrendPercentage() < 0 ? '−' : ''}{Math.abs(getTrendPercentage()).toFixed(1)}% VS UPDATE TERAKHIR
                      </p>
                    )}
                    
                    {/* Peak - Cyan */}
                    {stats && (
                      <div className="space-y-0.5">
                        <p 
                          className="text-2xl font-bold font-mono text-[#00FFFF]"
                          style={{ textShadow: '0 0 20px rgba(0, 255, 255, 0.7)' }}
                        >
                          PEAK {stats.listenersPeak.toLocaleString()}
                        </p>
                        
                        {/* Percentage - Orange */}
                        <p 
                          className="text-sm font-bold text-[#FF6347]"
                          style={{ textShadow: '0 0 10px rgba(255, 99, 71, 0.6)' }}
                        >
                          {getListenerRatio().toFixed(0)}% DARI PEAK
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Needle SVG - Simple white semi-transparent, below text */}
                  <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                    {/* Needle Group - Rotates around center */}
                    {stats && (
                      <g
                        transform={`rotate(${getNeedleAngle()}, 100, 100)`}
                        style={{
                          transition: 'transform 0.8s cubic-bezier(0.4, 0.0, 0.2, 1)'
                        }}
                        data-testid="speedometer-needle"
                      >
                        {/* Simple white needle - thin and semi-transparent */}
                        <line
                          data-testid="needle-line"
                          x1="100"
                          y1="100"
                          x2="100"
                          y2="25"
                          stroke="#FFFFFF"
                          strokeWidth="2"
                          strokeLinecap="round"
                          opacity="0.4"
                        />
                      </g>
                    )}
                  </svg>
                </div>
              )}
            </div>

            {/* Center: Team Work Section */}
            <div className="flex items-center justify-center">
              <CrewOnDuty />
            </div>

            {/* Right: Weekly Stats with Bar Chart */}
            <div className="flex flex-col h-full">
              <WeeklyStats />
            </div>
          </div>
        </section>

        {/* Coming Up Next & On Air */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Coming Up Next */}
          <ComingUpNext />

          {/* On Air Program */}
          <OnAirProgram />
        </section>

        {/* Program Listeners */}
        <section>
          <ProgramListeners />
        </section>

        {/* Information Grid */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Station Details Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Detail Stasiun</h3>
              <Radio className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Nama Radio</p>
                  <p className="font-medium" data-testid="text-station-name">{stats?.streamName}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Deskripsi</p>
                  <p className="font-medium" data-testid="text-station-description">{stats?.streamDescription}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Genre</p>
                  <p className="font-medium" data-testid="text-genre">{stats?.genre}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Stream Information Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Informasi Stream</h3>
              <Signal className="h-5 w-5 text-muted-foreground" />
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Bitrate</p>
                  <p className="font-medium font-mono" data-testid="text-bitrate">{stats?.bitrate} kbps</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Format</p>
                  <p className="font-medium" data-testid="text-format">{stats?.contentType}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stream Dimulai</p>
                  <p className="font-medium text-sm" data-testid="text-stream-started">{stats?.streamStarted}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Currently Playing Card */}
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Sedang Diputar</h3>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-status-online animate-pulse-slow" />
              </div>
            </div>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Lagu / Program</p>
                  <p className="font-medium" data-testid="text-currently-playing">
                    {stats?.currentlyPlaying || "Tidak ada informasi"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">URL Stream</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="font-mono text-xs truncate flex-1 bg-muted px-3 py-2 rounded-md" data-testid="text-stream-url">
                      {stats?.streamUrl}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={handleCopyUrl}
                      data-testid="button-copy-url"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-status-online" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>

        {/* Historical Chart */}
        <section>
          <HistoricalChart />
        </section>

        {/* Actions */}
        <section className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={handleManualRefresh}
              variant="outline"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Manual
            </Button>
            {stats?.streamUrl && (
              <Button
                asChild
                data-testid="button-listen-live"
              >
                <a href={stats.streamUrl} target="_blank" rel="noopener noreferrer">
                  <Radio className="h-4 w-4 mr-2" />
                  Dengarkan Live
                  <ExternalLink className="h-4 w-4 ml-2" />
                </a>
              </Button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Terakhir diperbarui: {new Date().toLocaleTimeString('id-ID')}
          </p>
        </section>
      </main>

      {/* Footer with Radio Player */}
      <footer className="border-t mt-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Radio Player */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
              {/* Player Info */}
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary">
                  <Radio className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">TJ Radio Jakarta</h3>
                  <p className="text-xs text-muted-foreground">Streaming Langsung</p>
                </div>
              </div>

              {/* Player Controls */}
              <div className="flex items-center gap-3">
                {/* Volume Control */}
                <div className="hidden sm:flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleMuteToggle}
                    data-testid="button-mute-toggle"
                    aria-label={isMuted || volume === 0 ? "Unmute" : "Mute"}
                    className="h-8 w-8"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="h-4 w-4" />
                    ) : (
                      <Volume2 className="h-4 w-4" />
                    )}
                  </Button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-20 h-1 bg-primary/20 rounded-lg appearance-none cursor-pointer slider"
                    data-testid="volume-slider"
                    aria-label="Volume"
                  />
                </div>

                {/* Play/Pause Button */}
                <Button
                  onClick={handlePlayPause}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                  data-testid="button-radio-play-pause"
                  aria-label={isPlaying ? "Pause radio" : "Play radio"}
                  aria-pressed={isPlaying}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="h-4 w-4" />
                      <span>Jeda</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Dengarkan Live</span>
                    </>
                  )}
                </Button>

                {/* External Link */}
                <Button
                  asChild
                  variant="outline"
                  size="icon"
                  data-testid="button-open-website"
                  className="h-9 w-9"
                >
                  <a
                    href="https://www.tjradiojakarta.com"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>

              {/* Hidden Audio Element */}
              <audio
                ref={audioRef}
                src="https://stream-eu-nc.arenastreaming.com:5450/stream"
                preload="none"
                data-testid="audio-player"
              />
            </div>
          </div>

          {/* Copyright */}
          <p className="text-sm text-center text-muted-foreground">
            Hanya untuk keperluan Internal, tidak untuk disebarkan. Hak Cipta dilindungi Undang-Undang. | Media Kawal Jakarta
          </p>
        </div>
      </footer>
    </div>
  );
}
