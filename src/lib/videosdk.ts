import { supabase } from "./supabase";

const API_BASE = "https://api.videosdk.live/v2";

export async function getVideoSDKToken(): Promise<string> {
  const envToken = import.meta.env.VITE_VIDEOSDK_TOKEN as string | undefined;
  if (envToken) return envToken;

  // Fallback: Supabase Edge Function (production secret rotation)
  const { data, error } = await supabase.functions.invoke("videosdk-token");
  if (error || !data?.token) throw new Error("Failed to get VideoSDK token");
  return data.token as string;
}

export async function createMeeting(token: string): Promise<string> {
  const res = await fetch(`${API_BASE}/rooms`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`createMeeting failed: ${res.status}`);
  const data = await res.json();
  return data.roomId as string;
}
