import React, { useRef, useEffect } from 'react';
import { eachDayOfInterval, differenceInCalendarDays, format, startOfDay, endOfDay } from 'date-fns';
import { ro } from 'date-fns/locale';
import { CalendarEvent } from '../types/calendar';
import notesStore from '../utils/notesStore';

interface TimelineCalendarProps {
  startDate: Date;
  endDate: Date;
  events: CalendarEvent[];
  units?: Array<{ key: string; label: string; color?: string }>;
  dayWidth?: number; // px
  leftLabelWidth?: number; // px
  scrollToDate?: Date | null;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
}

export const TimelineCalendar: React.FC<TimelineCalendarProps> = ({
  startDate,
  endDate,
  events,
  units,
  dayWidth = 160,
  leftLabelWidth = 200,
  scrollToDate = null,
  onEventClick,
}) => {
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const totalWidth = days.length * dayWidth;

  // Derive apartments: prefer provided units prop (as objects), otherwise derive from events
  // apartments is an array of { key, label, color? }
  const apartments = units && units.length > 0
    ? units.map((u: { key: string; label: string; color?: string }) => ({ key: u.key, label: u.label, color: u.color }))
    : Array.from(new Set(events.map((e: CalendarEvent) => e.apartment ?? 'Unit 1'))).map((a: string) => ({ key: a, label: a }));

  const getDayIndex = React.useCallback((d: Date) => differenceInCalendarDays(d, startDate), [startDate]);

  // Layout events into lanes for each apartment to avoid overlap
  const layoutEvents = React.useCallback((aptEvents: typeof events) => {
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
  }, []);

  const headerScrollRef = useRef<HTMLDivElement | null>(null);
  const rowScrollRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isSyncingRef = useRef(false);

  // Precompute layouts for each apartment and determine the max lane count so rows are uniform height
  const { aptLayouts, maxLanes } = React.useMemo(() => {
    const map: Record<string, { aptEvents: CalendarEvent[]; lanes: CalendarEvent[][]; laneIndexById: Record<string, number> }> = {};
    let max = 0;
    apartments.forEach(apt => {
      const key = apt.key || apt.label;
      const aptEvents = events.filter(e => {
        const ap = e.apartment ?? '';
        const label = apt.label || '';
        const k = apt.key || '';
        return ap === label || ap === k || ap.toLowerCase() === label.toLowerCase();
      });
      const layout = layoutEvents(aptEvents);
      map[key] = { aptEvents, lanes: layout.lanes, laneIndexById: layout.laneIndexById };
      if (layout.lanes.length > max) max = layout.lanes.length;
    });
    return { aptLayouts: map, maxLanes: Math.max(1, max) };
  }, [apartments, events, layoutEvents]);


  useEffect(() => {
    // when component mounts, sync header -> rows if header already has scroll
    const header = headerScrollRef.current;
    if (!header) return;
    const left = header.scrollLeft;
    Object.values(rowScrollRefs.current).forEach(r => {
      if (r && r.scrollLeft !== left) r.scrollLeft = left;
    });
  }, []);

  // When parent requests scrolling to a specific date, compute left offset and scroll header/rows
  useEffect(() => {
    if (!scrollToDate) return;
    if (!headerScrollRef.current) return;

    try {
      const d = startOfDay(scrollToDate);
      const idx = getDayIndex(d);
      const clamped = Math.max(0, Math.min(days.length - 1, idx));
      const left = clamped * dayWidth;
      headerScrollRef.current.scrollLeft = left;
      Object.values(rowScrollRefs.current).forEach(r => {
        if (r) r.scrollLeft = left;
      });
    } catch {
      // ignore
    }
  }, [scrollToDate, dayWidth, startDate, endDate, getDayIndex, days.length]);

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
            {days.map((d) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6; // Sunday=0, Saturday=6
              return (
                <div key={d.toISOString()} style={{ width: dayWidth }} className={`p-3 text-center text-gray-600 border-r ${isWeekend ? 'bg-purple-100' : ''}`}>
                  <div className="text-xl font-semibold text-gray-800">{format(d, 'EEEE', { locale: ro })}</div>
                  <div className="text-2xl font-bold">{format(d, 'dd', { locale: ro })}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* rows */}
      <div className="max-h-[60vh] overflow-auto">
        {apartments.map((apt: { key: string; label: string; color?: string }) => {
          const key = apt.key || apt.label;
          const layout = (aptLayouts && aptLayouts[key]) || { aptEvents: [] as CalendarEvent[], lanes: [], laneIndexById: {} };
          const laneHeight = 40; // px per stacked event
          const containerHeight = Math.max(1, maxLanes) * laneHeight + 12;

          return (
            <div key={key} className="flex items-start border-b bg-white">
              <div style={{ width: leftLabelWidth }} className="p-2 text-sm font-medium bg-gray-50 flex items-center">
                {/* show a colored swatch if units prop provided */}
                {apt.color && (
                  <span className="inline-block w-3 h-3 rounded-full mr-2" style={{ backgroundColor: apt.color }} />
                )}
                {apt.label}
              </div>
              <div className="overflow-x-auto w-full relative" ref={el => { rowScrollRefs.current[key] = el; }} onScroll={onRowScroll}>
                <div style={{ width: totalWidth, minHeight: containerHeight }} className="relative">
                  {/* vertical day separators (optional) */}
                  <div className="absolute inset-0">
                    <div style={{ display: 'flex', height: '100%' }}>
                      {days.map((d) => {
                        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                        return (
                          <div key={d.toISOString()} style={{ width: dayWidth }} className={`h-full border-r ${isWeekend ? 'bg-purple-50' : ''}`}></div>
                        );
                      })}
                    </div>
                  </div>

                  {/* events for this apartment (stacked if overlapping) */}
                  {layout.aptEvents.map(ev => {
                    const startIdx = Math.max(0, getDayIndex(ev.startDate));
                    const endIdx = Math.min(days.length - 1, getDayIndex(ev.endDate));
                    // Render from midday of start to midday of end => offset by 0.5 day
                    const left = (startIdx + 0.5) * dayWidth + 4; // small gutter
                    const right = (endIdx + 0.5) * dayWidth - 4; // small gutter
                    const rawWidth = right - left;
                    const minWidth = Math.max(12, dayWidth * 0.5 - 8);
                    const width = Math.max(minWidth, rawWidth);
                    const lane = layout.laneIndexById[ev.id] ?? 0;
                    // position events within uniform rows using lane index
                    const top = 8 + lane * laneHeight;

                    const noteEntry = notesStore.getNoteForEvent(ev);
                    const hasNote = !!noteEntry;

                    // prepare a short single-line preview of the note (first line, truncated)
                    const notePreview = hasNote && noteEntry && noteEntry.content
                      ? String(noteEntry.content).split('\n')[0].trim()
                      : '';
                    const previewShort = notePreview.length > 40 ? notePreview.slice(0, 37) + '…' : notePreview;

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => onEventClick?.(ev, e)}
                        className="absolute rounded-md shadow-sm text-sm text-white px-2 py-1 cursor-pointer flex items-center justify-between"
                        style={{ left, width, top, backgroundColor: ev.color || '#4F46E5' }}
                        title={`${ev.title} — ${format(ev.startDate, 'MMM d', { locale: ro })} to ${format(ev.endDate, 'MMM d', { locale: ro })}`}>
                        <div className="flex items-center mr-2 min-w-0">
                          {hasNote && <span title="Note" className="inline-block w-2 h-2 rounded-full bg-yellow-300 mr-2 shrink-0" />}
                          <div className="min-w-0">
                            <div className="truncate font-medium leading-tight">{ev.title}</div>
                            {hasNote && (
                              <div className="text-[10px] text-yellow-50 bg-yellow-700/40 px-1 rounded mt-0.5 truncate max-w-[10rem]">{previewShort}</div>
                            )}
                          </div>
                        </div>

                        <div className="text-xs opacity-90 whitespace-nowrap ml-2">
                          <span className="px-1">{format(ev.startDate, 'MMM d', { locale: ro })}</span>
                          <span className="px-1">—</span>
                          <span className="px-1">{format(ev.endDate, 'MMM d', { locale: ro })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TimelineCalendar;
