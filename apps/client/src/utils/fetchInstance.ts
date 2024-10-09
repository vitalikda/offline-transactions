import { env } from "../lib/env";

type FetchInstance = <T>(url: string, options: RequestInit) => Promise<T>;

export const fetchInstance: FetchInstance = async (
  url: string,
  options: RequestInit
) => {
  const res = await fetch(`${env.VITE_API_URL}${url}`, options);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  }
  return (await res.json()) ?? "";
};
