import React, { useRef, useEffect } from 'react';
import { eachDayOfInterval, differenceInCalendarDays, format, startOfDay, endOfDay } from 'date-fns';
import { CalendarEvent } from '../types/calendar';

interface TimelineCalendarProps {
  startDate: Date;
  endDate: Date;
  events: CalendarEvent[];
  units?: Array<{ key: string; label: string; color?: string }>;
  dayWidth?: number; // px
  leftLabelWidth?: number; // px
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
}

export const TimelineCalendar: React.FC<TimelineCalendarProps> = ({
  startDate,
  endDate,
  events,
  units,
  dayWidth = 120,
  leftLabelWidth = 200,
  onEventClick,
}) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalWidth = days.length * dayWidth;

  // Derive apartments: prefer provided units prop, otherwise derive from events (fallback to 'Unit 1')
  const apartments = units && units.length > 0
    ? units.map((u: { key: string; label: string; color?: string }) => u.label)
    : Array.from(new Set(events.map((e: CalendarEvent) => e.apartment ?? 'Unit 1')));

  const getDayIndex = (d: Date) => differenceInCalendarDays(d, startDate);

  // Layout events into lanes for each apartment to avoid overlap
  const layoutEvents = (aptEvents: typeof events) => {
    // clone and sort by start
    const evs = [...aptEvents].sort((a, b) => +a.startDate - +b.startDate);
    const lanes: Array<Array<typeof evs[number]>> = [];
    const laneIndexById: Record<string, number> = {};

    evs.forEach(ev => {
  // normalize event interval to day bounds for overlap checks
  const evStart = startOfDay(ev.startDate);

      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const last = lane[lane.length - 1];
        const lastEnd = endOfDay(last.endDate);
        // non-overlap if lastEnd < evStart
        if (lastEnd < evStart) {
          lane.push(ev);
          laneIndexById[ev.id] = i;
          placed = true;
          break;
        }
      }

      if (!placed) {
        lanes.push([ev]);
        laneIndexById[ev.id] = lanes.length - 1;
      }
    });

    return { lanes, laneIndexById };
  };

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const rowScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isSyncingRef = useRef(false);


  useEffect(() => {
    // when component mounts, sync header -> rows if header already has scroll
    const header = headerScrollRef.current;
    if (!header) return;
    const left = header.scrollLeft;
    Object.values(rowScrollRefs.current).forEach(r => {
      if (r && r.scrollLeft !== left) r.scrollLeft = left;
    });
  }, []);

  const onHeaderScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const left = (e.target as HTMLDivElement).scrollLeft;
    Object.values(rowScrollRefs.current).forEach(r => {
      if (r) r.scrollLeft = left;
    });
    // small timeout to unset syncing flag
    setTimeout(() => { isSyncingRef.current = false; }, 10);
  };

  const onRowScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;
    const left = (e.target as HTMLDivElement).scrollLeft;
    if (headerScrollRef.current) headerScrollRef.current.scrollLeft = left;
    Object.values(rowScrollRefs.current).forEach(r => {
      if (r && r.scrollLeft !== left) r.scrollLeft = left;
    });
    setTimeout(() => { isSyncingRef.current = false; }, 10);
  };

  return (
    <div className="w-full border rounded-lg overflow-hidden">
      {/* header */}
        <div className="flex items-stretch bg-white border-b">
        <div style={{ width: leftLabelWidth }} className="p-3 text-sm font-medium">
          Apartments
        </div>
        <div className="overflow-x-auto w-full" ref={headerScrollRef} onScroll={onHeaderScroll}>
          <div style={{ width: totalWidth }} className="flex">
            {days.map((d) => (
              <div key={d.toISOString()} style={{ width: dayWidth }} className="p-2 text-center text-xs text-gray-600 border-r">
                <div>{format(d, 'dd')}</div>
                <div className="text-[10px] text-gray-400">{format(d, 'MMM')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* rows */}
      <div className="max-h-[60vh] overflow-auto">
        {apartments.map((apt: string, idx: number) => (
          <div key={apt} className="flex items-start border-b bg-white">
            <div style={{ width: leftLabelWidth }} className="p-2 text-sm font-medium bg-gray-50 flex items-center">
              {/* show a colored swatch if units prop provided */}
              {units && units[idx] && (
                <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: (units[idx] as { color?: string }).color }} />
              )}
              {apt}
            </div>
            <div className="overflow-x-auto w-full relative" ref={el => { rowScrollRefs.current[apt] = el; }} onScroll={onRowScroll}>
              <div style={{ width: totalWidth, minHeight: 72 }} className="relative">
                {/* vertical day separators (optional) */}
                <div className="absolute inset-0">
                  <div style={{ display: 'flex', height: '100%' }}>
                    {days.map((d) => (
                      <div key={d.toISOString()} style={{ width: dayWidth }} className="border-r h-full"></div>
                    ))}
                  </div>
                </div>

                {/* events for this apartment (stacked if overlapping) */}
                {(() => {
                  const aptEvents = events.filter(e => (e.apartment ?? 'Unit 1') === apt);
                  const { lanes, laneIndexById } = layoutEvents(aptEvents);
                  const laneHeight = 40; // px per stacked event
                  const containerHeight = Math.max(1, lanes.length) * laneHeight + 12;

                  // adjust container minHeight to fit lanes
                  return (
                    <div style={{ minHeight: containerHeight, position: 'relative' }}>
                      {aptEvents.map(ev => {
                        const startIdx = Math.max(0, getDayIndex(ev.startDate));
                        const endIdx = Math.min(days.length - 1, getDayIndex(ev.endDate));
                        const span = Math.max(1, endIdx - startIdx + 1);
                        const left = startIdx * dayWidth + 4; // small gutter
                        const width = span * dayWidth - 8; // small gutter
                        const lane = laneIndexById[ev.id] ?? 0;
                        const top = 8 + lane * laneHeight;

                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => onEventClick?.(ev, e)}
                            className="absolute rounded-md shadow-sm text-sm text-white px-2 py-1 cursor-pointer flex items-center justify-between"
                            style={{ left, width, top, backgroundColor: ev.color || '#4F46E5' }}
                            title={`${ev.title} — ${format(ev.startDate, 'MMM d')} to ${format(ev.endDate, 'MMM d')}`}>
                            <div className="truncate font-medium mr-2">{ev.title}</div>
                            <div className="text-xs opacity-90 whitespace-nowrap ml-2">
                              <span className="px-1">{format(ev.startDate, 'MMM d')}</span>
                              <span className="px-1">—</span>
                              <span className="px-1">{format(ev.endDate, 'MMM d')}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TimelineCalendar;
