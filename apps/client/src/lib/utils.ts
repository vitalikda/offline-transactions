import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => {
  return twMerge(clsx(inputs));
};

export const toKey = (a: string, b: string) => `${a}-${b}` as const;

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const retry = async <T>(
  fn: () => Promise<T>,
  retries: number,
  delay: number
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await wait(delay);
      return retry(fn, retries - 1, delay);
    }
    throw error;
  }
};

export const copyToClipboard = async (text: string) => {
  if (!navigator?.clipboard) {
    console.info("Clipboard not supported");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    return text;
  } catch (error) {
    console.info("Copy failed", error);
    console.info("Text value", text);
    return;
  }
};
