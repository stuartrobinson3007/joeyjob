import { cn } from "@/taali/lib/utils";
import {
	isSameMonth,
	isToday,
	isSameDay,
	format,
	isBefore,
	isAfter,
} from "date-fns";
import { useRef, useState } from "react";

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

export function CalendarCell({
	state,
	date,
	currentMonth,
}: {
	state: CalendarState;
	date: Date;
	currentMonth: Date;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [isFocusVisible, setIsFocusVisible] = useState(false);
	
	const isSelected = state.selectedDate ? isSameDay(state.selectedDate, date) : false;
	const isOutsideMonth = !isSameMonth(currentMonth, date);
	const isDateToday = isToday(date);
	const formattedDate = format(date, "d");
	
	// Check if date is disabled
	let isDisabled = false;
	if (state.minValue && isBefore(date, state.minValue)) {
		isDisabled = true;
	}
	if (state.maxValue && isAfter(date, state.maxValue)) {
		isDisabled = true;
	}
	
	// Check if date is unavailable
	const isUnavailable = state.isDateUnavailable ? state.isDateUnavailable(date) : false;

	const handleClick = () => {
		if (!isDisabled && !isUnavailable && !isOutsideMonth) {
			state.selectDate(date);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleClick();
		}
	};

	const handleFocus = () => {
		setIsFocusVisible(true);
	};

	const handleBlur = () => {
		setIsFocusVisible(false);
	};

	return (
		<td
			className={cn("py-0.5 relative px-0.5", isFocusVisible ? "z-10" : "z-0")}
		>
			<div
				ref={ref}
				hidden={isOutsideMonth}
				className="h-14 outline-none group rounded-md"
				tabIndex={isOutsideMonth || isDisabled || isUnavailable ? -1 : 0}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
				onFocus={handleFocus}
				onBlur={handleBlur}
				role="button"
				aria-label={`${format(date, "EEEE, MMMM d, yyyy")}`}
				aria-pressed={isSelected}
				aria-disabled={isDisabled || isUnavailable}
			>
				<div
					className={cn(
						"size-full rounded-md flex items-center justify-center",
						"text-foreground text-sm font-semibold",
						isDisabled
							? isDateToday
								? "cursor-defaut"
								: "text-foreground/50 cursor-defaut"
							: isUnavailable
								? "text-foreground/50 cursor-default"
								: "cursor-pointer bg-muted",
						// Focus ring, visible while the cell has keyboard focus.
						isFocusVisible &&
						"ring-2 group-focus:z-2 ring-primary ring-offset-2",
						// Darker selection background for the start and end.
						isSelected && "bg-primary text-primary-foreground",
						// Hover state for non-selected cells.
						!isSelected && !isDisabled && !isUnavailable && "hover:ring-2 hover:ring-primary",
					)}
				>
					{formattedDate}
					{isDateToday && (
						<div
							className={cn(
								"absolute bottom-4 left-1/2 transform -translate-x-1/2 translate-y-1/2 size-1.5 bg-primary rounded-full",
								isSelected && "bg-primary-foreground",
							)}
						/>
					)}
					{
						// show a diagonal strikethough line over the cell
						isUnavailable && !isDisabled && (
							<div className="absolute w-5 h-px bg-muted-foreground opacity-50" />
						)
					}
				</div>
			</div>
		</td>
	);
}