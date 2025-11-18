import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format PostgreSQL interval to human-readable string
export function formatDuration(interval: string | null): string {
  if (!interval) return '-';
  
  try {
    // Parse PostgreSQL interval format (e.g., "02:30:45", "1 day 02:30:45", "2 days 12:30:45")
    const parts = interval.split(' ');
    let totalHours = 0;
    let days = 0;
    
    if (parts.length >= 3 && (parts[1] === 'day' || parts[1] === 'days')) {
      days = parseInt(parts[0]);
      const timePart = parts[2];
      const [hours, minutes, seconds] = timePart.split(':').map(Number);
      totalHours = hours + (minutes / 60) + (seconds / 3600);
    } else {
      // Just time format like "02:30:45"
      const [hours, minutes, seconds] = interval.split(':').map(Number);
      totalHours = hours + (minutes / 60) + (seconds / 3600);
    }
    
    if (days > 0) {
      const remainingHours = Math.floor(totalHours);
      if (remainingHours > 0) {
        return `${days} day${days > 1 ? 's' : ''} ${remainingHours} hour${remainingHours > 1 ? 's' : ''}`;
      } else {
        return `${days} day${days > 1 ? 's' : ''}`;
      }
    } else {
      return `${totalHours.toFixed(2)} hours`;
    }
  } catch (error) {
    console.error('Error formatting duration:', error);
    return interval; // Return original if parsing fails
  }
}
