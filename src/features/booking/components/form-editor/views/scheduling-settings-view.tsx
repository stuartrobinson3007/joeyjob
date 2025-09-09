import React, { useState, useEffect, useRef } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/ui/select";
import BackButton from "@/features/booking/components/form-editor/back-button";
import type { FlowNode } from "@/components/FormFlowTree";
import useFormEditorData from "../hooks/useFormEditorData";
import { RadioGroup, RadioGroupItem } from "@/ui/radio-group";
import { Label } from "@/ui/label";
import { DatePicker } from "@/ui/date-picker";
import { Input } from "@/ui/input";

interface SchedulingSettingsViewProps {
    node: FlowNode;
    onNavigateBack: () => void;
    onUpdateNode?: (nodeId: string, updates: Partial<FlowNode>) => void;
}

// Added: Define types for date range options
type DateRangeOption = "rolling" | "fixed" | "indefinite";

/**
 * Scheduling settings view for configuring service duration, buffer time, etc.
 */
export function SchedulingSettingsView({
    node,
    onNavigateBack,
    onUpdateNode
}: SchedulingSettingsViewProps) {
    const { dispatch } = useFormEditorData();
    const [duration, setDuration] = useState(node?.duration?.toString() || "30");
    const [bufferTime, setBufferTime] = useState(node?.bufferTime?.toString() || "15");
    const [minimumNotice, setMinimumNotice] = useState(node?.minimumNotice?.toString() || "0");
    const [minimumNoticeUnit, setMinimumNoticeUnit] = useState(node?.minimumNoticeUnit || "days");
    const [bookingInterval, setBookingInterval] = useState(node?.bookingInterval?.toString() || "15");

    // Added: State for date range selection
    const [dateRangeOption, setDateRangeOption] = useState<DateRangeOption>(node?.dateRangeType || "rolling");
    const [rollingDays, setRollingDays] = useState<string>(node?.rollingDays?.toString() || "14");
    const [rollingUnit, setRollingUnit] = useState<"calendar-days" | "week-days">(node?.rollingUnit || "calendar-days");
    const [fixedStartDate, setFixedStartDate] = useState<Date | undefined>(node?.fixedStartDate ? new Date(node.fixedStartDate) : undefined);
    const [fixedEndDate, setFixedEndDate] = useState<Date | undefined>(node?.fixedEndDate ? new Date(node.fixedEndDate) : undefined);

    // Track if user has edited each field to prevent useEffect from overriding their changes
    const hasEditedRef = useRef({
        duration: false,
        bufferTime: false,
        minimumNotice: false,
        minimumNoticeUnit: false,
        bookingInterval: false,
        dateRangeOption: false,
        rollingDays: false,
        rollingUnit: false,
        fixedStartDate: false,
        fixedEndDate: false,
    });

    // Track if this is the first time mounting the component
    const isInitialMount = useRef(true);

    useEffect(() => {
        // On initial mount, always set the values from the node
        if (isInitialMount.current) {
            if (node) {
                setDuration(node.duration?.toString() || "30");
                setBufferTime(node.bufferTime?.toString() || "15");
                setMinimumNotice(node.minimumNotice?.toString() || "0");
                setMinimumNoticeUnit(node.minimumNoticeUnit || "days");
                setBookingInterval(node.bookingInterval?.toString() || "15");
                setDateRangeOption(node.dateRangeType || "rolling");
                setRollingDays(node.rollingDays?.toString() || "14");
                setRollingUnit(node.rollingUnit || "calendar-days");
                setFixedStartDate(node.fixedStartDate ? new Date(node.fixedStartDate) : undefined);
                setFixedEndDate(node.fixedEndDate ? new Date(node.fixedEndDate) : undefined);
            }
            isInitialMount.current = false;
            return;
        }

        // On subsequent updates, only update the fields that haven't been edited
        if (node) {
            if (!hasEditedRef.current.duration) {
                setDuration(node.duration?.toString() || "30");
            }
            if (!hasEditedRef.current.bufferTime) {
                setBufferTime(node.bufferTime?.toString() || "15");
            }
            if (!hasEditedRef.current.minimumNotice) {
                setMinimumNotice(node.minimumNotice?.toString() || "0");
            }
            if (!hasEditedRef.current.minimumNoticeUnit) {
                setMinimumNoticeUnit(node.minimumNoticeUnit || "days");
            }
            if (!hasEditedRef.current.bookingInterval) {
                setBookingInterval(node.bookingInterval?.toString() || "15");
            }
            if (!hasEditedRef.current.dateRangeOption) {
                setDateRangeOption(node.dateRangeType || "rolling");
            }
            if (!hasEditedRef.current.rollingDays) {
                setRollingDays(node.rollingDays?.toString() || "14");
            }
            if (!hasEditedRef.current.rollingUnit) {
                setRollingUnit(node.rollingUnit || "calendar-days");
            }
            if (!hasEditedRef.current.fixedStartDate) {
                setFixedStartDate(node.fixedStartDate ? new Date(node.fixedStartDate) : undefined);
            }
            if (!hasEditedRef.current.fixedEndDate) {
                setFixedEndDate(node.fixedEndDate ? new Date(node.fixedEndDate) : undefined);
            }
        }
    }, [node]);

    // Function to update node using the form data context
    const updateNodeField = (field: string, value: any) => {
        // Use the provided onUpdateNode callback if available (for backward compatibility)
        if (onUpdateNode && node) {
            onUpdateNode(node.id, { [field]: value });
        } else if (node) {
            // Otherwise dispatch directly to the context
            dispatch({
                type: 'UPDATE_NODE',
                payload: {
                    nodeId: node.id,
                    updates: { [field]: value }
                }
            });
        }
    };

    const handleDurationChange = (value: string) => {
        setDuration(value);
        hasEditedRef.current.duration = true;
        updateNodeField('duration', parseInt(value, 10));
    };

    const handleBufferTimeChange = (value: string) => {
        setBufferTime(value);
        hasEditedRef.current.bufferTime = true;
        updateNodeField('bufferTime', parseInt(value, 10));
    };

    const handleMinimumNoticeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setMinimumNotice(value);
        hasEditedRef.current.minimumNotice = true;
        updateNodeField('minimumNotice', parseInt(value, 10) || 0);
    };

    const handleMinimumNoticeUnitChange = (value: string) => {
        setMinimumNoticeUnit(value as "days" | "hours");
        hasEditedRef.current.minimumNoticeUnit = true;
        updateNodeField('minimumNoticeUnit', value);
    };

    const handleBookingIntervalChange = (value: string) => {
        setBookingInterval(value);
        hasEditedRef.current.bookingInterval = true;
        updateNodeField('bookingInterval', parseInt(value, 10));
    };

    // Added: Handlers for new date range fields
    const handleDateRangeOptionChange = (value: DateRangeOption) => {
        setDateRangeOption(value);
        hasEditedRef.current.dateRangeOption = true;
        updateNodeField('dateRangeType', value);
        // Reset other fields when option changes
        if (value === "rolling") {
            updateNodeField('fixedStartDate', null);
            updateNodeField('fixedEndDate', null);
        } else if (value === "fixed") {
            updateNodeField('rollingDays', null);
            updateNodeField('rollingUnit', null);
        } else if (value === "indefinite") {
            updateNodeField('fixedStartDate', null);
            updateNodeField('fixedEndDate', null);
            updateNodeField('rollingDays', null);
            updateNodeField('rollingUnit', null);
        }
    };

    const handleRollingDaysChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setRollingDays(value);
        hasEditedRef.current.rollingDays = true;
        updateNodeField('rollingDays', parseInt(value, 10) || 0);
    };

    const handleRollingUnitChange = (value: "calendar-days" | "week-days") => {
        setRollingUnit(value);
        hasEditedRef.current.rollingUnit = true;
        updateNodeField('rollingUnit', value);
    };

    const handleFixedStartDateChange = (date: Date | undefined) => {
        setFixedStartDate(date);
        hasEditedRef.current.fixedStartDate = true;
        updateNodeField('fixedStartDate', date ? date.toISOString() : null);
    };

    const handleFixedEndDateChange = (date: Date | undefined) => {
        setFixedEndDate(date);
        hasEditedRef.current.fixedEndDate = true;
        updateNodeField('fixedEndDate', date ? date.toISOString() : null);
    };

    if (!node) return null;

    return (
        <>
            <BackButton
                label={node.label}
                onClick={onNavigateBack}
                className="self-start"
            />
            <h2 className="text-2xl font-bold mb-6">Scheduling Settings</h2>

            <div className="space-y-6">
                <div className="flex items-center justify-between bg-muted/50 p-4 rounded-md space-x-4">
                    <div className="flex flex-col">
                        <h3 className="text-base font-medium">Duration</h3>
                        <p className="text-sm text-muted-foreground">
                            The expected amount of time this service takes to complete
                        </p>
                    </div>
                    <Select value={duration} onValueChange={handleDurationChange}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select duration" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="20">20 min</SelectItem>
                            <SelectItem value="25">25 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="90">90 min</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="bg-muted/50 p-4 rounded-md">
                    <h3 className="text-base font-medium">Date range</h3>
                    <p className="text-muted-foreground mb-3 text-sm">
                        Customers can schedule...
                    </p>

                    <RadioGroup value={dateRangeOption} onValueChange={handleDateRangeOptionChange} className="space-y-3">
                        <div className="flex items-start space-x-3">
                            <RadioGroupItem value="rolling" id="rolling" />
                            <div className="grid gap-1.5 leading-none">
                                <Label htmlFor="rolling" className="font-medium">
                                    Over a period of rolling days
                                </Label>
                                {dateRangeOption === "rolling" && (
                                    <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:items-center space-x-2 mt-2">
                                        <div className="flex items-center space-x-2">
                                            <Input
                                                type="number"
                                                value={rollingDays}
                                                onChange={handleRollingDaysChange}
                                                min="1"
                                                className="w-20"
                                            />
                                            <Select value={rollingUnit} onValueChange={handleRollingUnitChange}>
                                                <SelectTrigger className="w-40">
                                                    <SelectValue placeholder="Select unit" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="calendar-days">calendar days</SelectItem>
                                                    <SelectItem value="week-days">week days</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <span className="text-muted-foreground text-sm">into the future</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <RadioGroupItem value="fixed" id="fixed" />
                            <div className="grid gap-1.5 leading-none w-full">
                                <Label htmlFor="fixed" className="font-medium">
                                    Within a date range
                                </Label>
                                {dateRangeOption === "fixed" && (
                                    <div className="flex space-y-2 lg:space-y-0 lg:items-center lg:space-x-4 mt-2 flex-col lg:flex-row">
                                        <DatePicker date={fixedStartDate} setDate={handleFixedStartDateChange} placeholder="Start date" className="flex-1" />
                                        <span className="text-muted-foreground text-sm">to</span>
                                        <DatePicker date={fixedEndDate} setDate={handleFixedEndDateChange} placeholder="End date" className="flex-1" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <RadioGroupItem value="indefinite" id="indefinite" />
                            <Label htmlFor="indefinite" className="font-medium">
                                Indefinitely into the future
                            </Label>
                        </div>
                    </RadioGroup>
                </div>


                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md space-x-4">
                    <div>
                        <h4 className="font-medium">Buffer time</h4>
                        <p className="text-sm text-muted-foreground">
                            Add time before or after these bookings.
                        </p>
                    </div>
                    <Select value={bufferTime} onValueChange={handleBufferTimeChange}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select buffer time" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="0">None</SelectItem>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="45">45 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                        </SelectContent>
                    </Select>

                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md space-x-4">
                    <div>
                        <h4 className="font-medium">Minimum notice</h4>
                        <p className="text-sm text-muted-foreground">
                            Set the minimum amount of notice that is required to make a booking.
                        </p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Input
                            type="number"
                            value={minimumNotice}
                            onChange={handleMinimumNoticeChange}
                            min="0"
                            className="w-20"
                        />
                        <Select value={minimumNoticeUnit} onValueChange={handleMinimumNoticeUnitChange}>
                            <SelectTrigger className="w-24">
                                <SelectValue placeholder="Select unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="days">days</SelectItem>
                                <SelectItem value="hours">hours</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-md">
                    <div>
                        <h4 className="font-medium">Booking interval</h4>
                        <p className="text-sm text-muted-foreground">
                            How often you want appointments to be available for booking.
                        </p>
                    </div>
                    <Select value={bookingInterval} onValueChange={handleBookingIntervalChange}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="Select booking interval" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="15">15 min</SelectItem>
                            <SelectItem value="30">30 min</SelectItem>
                            <SelectItem value="60">60 min</SelectItem>
                            <SelectItem value="120">2 hours</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </>
    );
}

export default SchedulingSettingsView;