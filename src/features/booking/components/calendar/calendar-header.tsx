import { format } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "./calendar-button";

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

export function CalendarHeader({
	state,
}: {
	state: CalendarState;
}) {
	const monthName = format(state.visibleMonth, "MMMM");
	const year = format(state.visibleMonth, "yyyy");

	return (
		<div className="flex items-center pb-4 w-full">
			<h2 className="sr-only">
				Calendar for {monthName} {year}
			</h2>
			<h2
				aria-hidden
				className="flex-1 align-center font-bold text-md text-foreground"
			>
				{monthName} <span className="text-muted-foreground">{year}</span>
			</h2>
			<Button 
				onClick={state.goToPreviousMonth}
				aria-label="Go to previous month"
			>
				<ChevronLeftIcon className="size-4" />
			</Button>
			<Button 
				onClick={state.goToNextMonth}
				aria-label="Go to next month"
			>
				<ChevronRightIcon className="size-4" />
			</Button>
		</div>
	);
}