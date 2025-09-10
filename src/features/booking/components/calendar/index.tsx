"use client";

import { useState } from "react";
import { CalendarGrid } from "./calendar-grid";
import { CalendarHeader } from "./calendar-header";
import { startOfMonth, addMonths, subMonths } from "date-fns";

interface CalendarProps {
	value?: Date | null;
	onChange?: (date: Date | null) => void;
	isDateUnavailable?: (date: Date) => boolean;
	minValue?: Date;
	maxValue?: Date;
	locale?: string;
}

export function Calendar({
	value,
	onChange,
	isDateUnavailable,
	minValue,
	maxValue,
	locale = "en-US",
}: CalendarProps) {
	const [currentDate, setCurrentDate] = useState(value || new Date());
	
	const visibleMonth = startOfMonth(currentDate);
	
	const goToPreviousMonth = () => {
		setCurrentDate(subMonths(currentDate, 1));
	};
	
	const goToNextMonth = () => {
		setCurrentDate(addMonths(currentDate, 1));
	};
	
	const handleDateSelect = (date: Date) => {
		if (onChange) {
			onChange(date);
		}
		setCurrentDate(date);
	};

	const calendarState = {
		visibleMonth,
		selectedDate: value,
		currentDate,
		isDateUnavailable,
		minValue,
		maxValue,
		locale,
		goToPreviousMonth,
		goToNextMonth,
		selectDate: handleDateSelect,
	};

	return (
		<div className="inline-block w-full">
			<CalendarHeader
				state={calendarState}
			/>
			<div className="gap-8 w-full">
				<CalendarGrid state={calendarState} />
			</div>
		</div>
	);
}