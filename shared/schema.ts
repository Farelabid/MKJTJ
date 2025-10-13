import { z } from "zod";

// Radio Statistics Schema
export const radioStatsSchema = z.object({
  streamName: z.string(),
  streamDescription: z.string(),
  contentType: z.string(),
  streamStarted: z.string(),
  bitrate: z.number(),
  listenersRaw: z.number(),
  listenersPeakRaw: z.number(),
  listenersCurrent: z.number(),
  listenersPeak: z.number(),
  genre: z.string(),
  streamUrl: z.string(),
  currentlyPlaying: z.string().optional(),
});

export type RadioStats = z.infer<typeof radioStatsSchema>;
