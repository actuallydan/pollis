import { useEffect, useState } from "react";

/**
 * Custom hook to track page views using countapi.xyz
 * Increments the view counter on component mount and retrieves the current count
 * 
 * @param namespace - The namespace for the counter (default: "monopollis-ui")
 * @param key - The key for the counter (default: "views")
 * @returns The current view count
 */
export function useViewCounter(
  namespace: string = "monopollis-ui",
  key: string = "views"
): number {
  const [viewCount, setViewCount] = useState<number>(0);

  useEffect(() => {
    // Increment the counter and get the updated count
    const incrementView = async () => {
      try {
        const response = await fetch(
          `https://api.countapi.xyz/hit/${namespace}/${key}`
        );
        if (response.ok) {
          const data = await response.json();
          setViewCount(data.value || 0);
        }
      } catch (error) {
        // Silently fail - don't break the app if the counter service is down
        console.warn("Failed to increment view counter:", error);
      }
    };

    incrementView();
  }, [namespace, key]);

  return viewCount;
}

