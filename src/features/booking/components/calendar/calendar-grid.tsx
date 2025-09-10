import {
	startOfMonth,
	endOfMonth,
	startOfWeek,
	endOfWeek,
	eachDayOfInterval,
	format,
	getWeeksInMonth,
} from "date-fns";
import { CalendarCell } from "./calendar-cell";

interface CalendarState {
	visibleMonth: Date;
	selectedDate: Date | null | undefined;
	currentDate: Date;
	isDateUnavailable?: (date: Date) => boolean;
	minValue?: Date;
	maxValue?: Date;
	locale: string;
	goToPreviousMonth: () => void;
	goToNextMonth: () => void;
	selectDate: (date: Date) => void;
}

export function CalendarGrid({
	state,
}: {
	state: CalendarState;
}) {
	const startDate = state.visibleMonth;
	const endDate = endOfMonth(startDate);
	
	// Get all days in the month
	const monthStart = startOfMonth(startDate);
	const monthEnd = endOfMonth(startDate);
	const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
	const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
	
	const allDays = eachDayOfInterval({
		start: calendarStart,
		end: calendarEnd,
	});

	// Get weekday names
	const weekDays = [];
	for (let i = 0; i < 7; i++) {
		const date = new Date(2023, 0, 1 + i); // Start from a Sunday
		weekDays.push(format(date, "eee", { locale: undefined }));
	}

	// Get the number of weeks in the month so we can render the proper number of rows.
	const weeksInMonth = getWeeksInMonth(startDate);

	// Group days into weeks
	const weeks = [];
	for (let i = 0; i < weeksInMonth; i++) {
		weeks.push(allDays.slice(i * 7, (i + 1) * 7));
	}

	return (
		<table cellPadding="0" className="w-full table-fixed">
			<thead>
				<tr>
					{weekDays.map((day, index) => (
						<th key={index} className="uppercase text-xs text-muted-foreground pb-4 w-full">
							{day}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{weeks.map((week, weekIndex) => (
					<tr key={weekIndex}>
						{week.map((date, dayIndex) => {
							if (!date) {
								return <td key={dayIndex} />;
							}

							return (
								<CalendarCell
									key={dayIndex}
									state={state}
									date={date}
									currentMonth={startDate}
								/>
							);
						})}
					</tr>
				))}
			</tbody>
		</table>
	);
}