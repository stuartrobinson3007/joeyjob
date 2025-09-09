import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ChevronLeft, ArrowRight, Clock, MapPin } from 'lucide-react';
import { Button } from '@/ui/button';
import { useForm, UseFormReturn } from 'react-hook-form';
import { Form } from '@/ui/form';
import { cn } from '@/lib/utils';
import { FormFieldRenderer } from '@/features/booking/components/form-field-renderer';
import { FormFieldConfig as StandardFormFieldConfig } from '@/features/booking/lib/form-field-types';
// TODO: Replace with booking-scheduler component
// import BookingCalendar, { AvailabilityRule, BlockedTime } from '@/components/BookingCalendar';
import { parseISO, isSameDay } from 'date-fns';

// Unique identifier for items in the booking tree
type ItemId = string;

// Base interface for all items in the booking tree
interface BookingItem {
    id: ItemId;
    title: string;
    description: string;
    imageUrl?: string;
}

// Availability rule interface for scheduling
interface AvailabilityRule {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    timezone?: string;
}

// Blocked time interface
interface BlockedTime {
    date: string;
    startTime: string;
    endTime: string;
    timezone?: string;
}

// A service that can be booked
export interface Service extends BookingItem {
    type: 'service';
    duration: number;
    price?: string;
    availabilityRules: AvailabilityRule[];
    blockedTimes?: BlockedTime[];
    unavailableDates?: Date[];
    bufferTime?: number;
    interval?: number;
    additionalQuestions?: StandardFormFieldConfig[];
}

// A group that contains services or other groups
export interface ServiceGroup extends BookingItem {
    type: 'group';
    children: (Service | ServiceGroup)[];
}

// Form field configuration - using StandardFormFieldConfig for all form fields
export type FormFieldConfig = StandardFormFieldConfig;

// Props for the BookingFlow component
export interface BookingFlowProps {
    id?: string;
    startTitle?: string;
    startDescription?: string;
    services: (Service | ServiceGroup)[]; // Root level services/groups
    baseQuestions: FormFieldConfig[];
    primaryColor?: string;
    darkMode?: boolean;
    onBookingSubmit?: (bookingData: BookingSubmitData) => void;
    className?: string;
    getServiceById?: (id: string) => Service | null;
    // State management props
    bookingState: BookingState;
    onBookingStateChange: (newState: BookingState) => void;
    // Form methods from parent component
    formMethods?: UseFormReturn<any>;
    // Option change handler 
    onOptionValueChange?: (questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => void;
}

// Data that will be submitted when booking is completed
export interface BookingSubmitData {
    service: Service;
    date: string;
    time: string;
    formData: Record<string, any>;
    navigationPath: ItemId[];
}

// Type for booking flow stages
type BookingStage = 'selection' | 'date-time' | 'customer-info' | 'confirmation';

// Type for tracking user's progress and selections
export interface BookingState {
    stage: BookingStage;
    navigationPath: ItemId[]; // Path of IDs to current position in the tree
    selectedService: Service | null;
    selectedDate: Date | null;
    selectedTime: string | null;
    // formData removed as it will be handled by formMethods
}

// Maximum total file size (80MB in bytes)
const MAX_TOTAL_FILE_SIZE = 80 * 1024 * 1024;

/**
 * Calculate a contrasting color (black or white) based on the background color
 */
function contrastingColor(hex: string, factorAlpha = false): string {
    // Handle case where regex doesn't match
    const matches = hex
        .replace(/^#?(?:(?:(..)(..)(..)(..)?)|(?:(.)(.)(.)(.)?))$/, '$1$5$5$2$6$6$3$7$7$4$8$8')
        .match(/(..)/g);

    // Default to black if for some reason the regex doesn't match
    if (!matches) return '#000';

    let [r, g, b, a] = matches.map(rgb => parseInt('0x' + rgb));

    // Default alpha to 255 if not provided
    if (!a) a = 255;

    return ((~~(r * 299) + ~~(g * 587) + ~~(b * 114)) / 1000) >= 128 || (!!(~(128 / a) + 1) && factorAlpha)
        ? '#000'
        : '#FFF';
}

export default function BookingFlow({
    id = 'booking-flow',
    startTitle = 'Booking',
    startDescription = 'Select a service to get started',
    services,
    baseQuestions,
    primaryColor = '#3B82F6', // Default to blue
    darkMode = false,
    onBookingSubmit,
    className,
    getServiceById,
    bookingState,
    onBookingStateChange,
    formMethods,
    onOptionValueChange
}: BookingFlowProps) {
    const primaryForeground = contrastingColor(primaryColor);
    const [totalFileSize, setTotalFileSize] = useState<number>(0);
    const [showValidation, setShowValidation] = useState(false);
    const mainContainerRef = React.useRef<HTMLDivElement>(null); // Ref for the main container

    const customStyleVars = {
        '--custom-primary': primaryColor,
        '--custom-primary-foreground': primaryForeground,
        '--ring': primaryColor,
    } as React.CSSProperties;

    // Updated: No longer sends postMessage directly for state changes
    const handleBookingStateChange = useCallback((newState: BookingState) => {
        if (onBookingStateChange) {
            onBookingStateChange(newState);
        }
        // Removed: window.parent.postMessage for bookingStateChange
    }, [onBookingStateChange]);

    // Effect to observe content height and send to parent
    useEffect(() => {
        const PADDING_BUFFER = 2; // Small buffer to prevent scrollbars due to subpixel rendering
        let debounceTimer: NodeJS.Timeout;

        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                const newHeight = entries[0].target.scrollHeight;
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    if (window.parent !== window) {
                        window.parent.postMessage({
                            type: 'iframeResize',
                            payload: { height: newHeight + PADDING_BUFFER }
                        }, '*'); // Use specific origin in production
                    }
                }, 100); // Debounce to avoid rapid messages
            }
        });

        if (mainContainerRef.current) {
            observer.observe(mainContainerRef.current);
        }

        // Initial send of height
        if (mainContainerRef.current && window.parent !== window) {
            const initialHeight = mainContainerRef.current.scrollHeight;
            window.parent.postMessage({
                type: 'iframeResize',
                payload: { height: initialHeight + PADDING_BUFFER }
            }, '*');
        }

        return () => {
            observer.disconnect();
            clearTimeout(debounceTimer);
        };
    }, []); // Empty dependency array, runs once to set up observer

    // Use provided formMethods or create a local one as fallback
    const form = formMethods || useForm({
        mode: "onChange", // Change from onSubmit to onChange for real-time validation
        reValidateMode: "onChange",
        criteriaMode: "all", // Show all validation errors
        shouldFocusError: true, // Focus on first error field after validation
        defaultValues: baseQuestions.reduce((acc, field) => {
            // Handle nested fields for contact-info and address types
            if (field.type === 'contact-info') {
                acc[field.name] = {
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: ""
                };

                // Add company field if companyRequired is true in fieldConfig
                if ('fieldConfig' in field && field.fieldConfig.companyRequired) {
                    acc[field.name].company = "";
                }
            } else if (field.type === 'address') {
                acc[field.name] = {
                    street: "",
                    street2: "",
                    city: "",
                    state: "",
                    zip: ""
                };
            } else if (field.type === 'multiple-choice') {
                acc[field.name] = []; // Initialize as empty array for multiple selections
            } else {
                acc[field.name] = "";
            }
            return acc;
        }, {} as Record<string, any>),
        resolver: undefined, // Using individual field validations instead of a resolver
    });

    // Handle form submission with explicit validation
    const handleSubmitCustomerInfo = async (data: any) => {
        // Manually trigger validation on all fields
        const isValid = await form.trigger();

        // Check if there are any errors after explicit validation
        const hasErrors = Object.keys(form.formState.errors).length > 0;

        if (isValid && !hasErrors) {
            // If we have selected service and the getServiceById function is available, use the latest data
            const serviceId = bookingState.selectedService?.id;
            const latestService = getServiceById && serviceId ?
                getServiceById(serviceId) || bookingState.selectedService :
                bookingState.selectedService;

            // Update booking state to confirmation stage
            const newBookingState = {
                ...bookingState,
                stage: 'confirmation' as BookingStage,
                selectedService: latestService,
                customerInfo: data
            };

            handleBookingStateChange(newBookingState);

            // Call the onBookingSubmit callback if provided
            if (onBookingSubmit && latestService && bookingState.selectedDate && bookingState.selectedTime) {
                onBookingSubmit({
                    service: latestService,
                    date: bookingState.selectedDate.toISOString(),
                    time: bookingState.selectedTime,
                    formData: data,
                    navigationPath: bookingState.navigationPath
                });
                // Removed: window.parent.postMessage for bookingSubmit
            }

            setShowValidation(false);
        } else {
            setShowValidation(true);
        }
    };

    // Safety check for customer-info stage
    useEffect(() => {
        if (bookingState.stage === 'confirmation') {
            // Double-check for errors before showing confirmation
            const hasErrors = Object.keys(form.formState.errors).length > 0;
            if (hasErrors) {
                // Force back to customer-info stage
                handleBookingStateChange({
                    ...bookingState,
                    stage: 'customer-info'
                });
                setShowValidation(true);
            }
        }
    }, [bookingState.stage, form.formState.errors, handleBookingStateChange]);

    // Handle file size updates from all file upload components
    const handleFileUpdate = useCallback((fieldName: string, newFiles: File[], oldFiles: File[] = []) => {
        const oldSize = oldFiles.reduce((total, file) => total + file.size, 0);
        const newSize = newFiles.reduce((total, file) => total + file.size, 0);
        const sizeDifference = newSize - oldSize;

        // Calculate what the new total would be
        const potentialNewTotal = totalFileSize + sizeDifference;

        // Check if this would exceed the limit
        const wouldExceedLimit = potentialNewTotal > MAX_TOTAL_FILE_SIZE;

        // Only update the total if we're within limits
        if (!wouldExceedLimit) {
            setTotalFileSize(potentialNewTotal);
        }

        // Return whether the file would be within limits
        return !wouldExceedLimit;
    }, [totalFileSize]);

    // Get currently active questions for validation
    const getActiveQuestions = useCallback(() => {
        if (!bookingState.selectedService) return baseQuestions;

        // Get the latest service data 
        const serviceId = bookingState.selectedService.id;
        const latestService = getServiceById && serviceId ?
            getServiceById(serviceId) || bookingState.selectedService :
            bookingState.selectedService;

        // Combine base and service questions
        return [
            ...baseQuestions,
            ...(latestService.additionalQuestions || [])
        ];
    }, [baseQuestions, bookingState.selectedService, getServiceById]);

    // Add a function to reset form errors when form configuration changes
    const resetFormErrors = useCallback(() => {
        form.clearErrors();
        setShowValidation(false);
    }, [form]);

    // Implement the handler for option value changes with detailed logging
    const handleOptionValueChange = useCallback((questionId: string, eventType: 'option-change' | 'value-update', oldValue: string, newValue: string) => {
        // If the parent component provided an onOptionValueChange handler, pass the event through
        if (onOptionValueChange) {
            onOptionValueChange(questionId, eventType, oldValue, newValue);
        } else {
            // If no parent handler is provided, we need to handle it ourselves
            // Find the question config to get the field name
            const allQuestions = getActiveQuestions();
            const questionConfig = allQuestions.find(q => q.id === questionId);

            if (!questionConfig) {
                return;
            }

            const fieldName = questionConfig.name;

            if (eventType === 'option-change') {
                // Update the form value if it matches the old value
                const formValues = form.getValues();
                const currentValue = (formValues as any)[fieldName];

                if (currentValue === oldValue) {
                    form.setValue(fieldName as any, newValue, { shouldValidate: false });
                }
            }
        }
    }, [onOptionValueChange, getActiveQuestions, form]);

    // Update useEffect to watch for changes in the questions/fields
    useEffect(() => {
        // When baseQuestions change (added, removed, type changed, required changed),
        // reset all form errors to start fresh
        resetFormErrors();
    }, [baseQuestions, resetFormErrors]);


    // Helper function to find an item by ID in a list of items
    const findItemById = (items: (Service | ServiceGroup)[], id: ItemId): Service | ServiceGroup | null => {
        for (const item of items) {
            if (item.id === id) return item;
            if (item.type === 'group' && item.children) {
                const found = findItemById(item.children, id);
                if (found) return found;
            }
        }
        return null;
    };

    // Helper function to get current items based on navigation path
    const getCurrentItems = (): (Service | ServiceGroup)[] => {
        let currentItems = services;
        for (const pathId of bookingState.navigationPath) {
            const item = findItemById(currentItems, pathId);
            if (item && item.type === 'group') {
                currentItems = item.children;
            }
        }
        return currentItems;
    };

    // Get a full breadcrumb path of items
    const getBreadcrumbPath = (): (Service | ServiceGroup)[] => {
        const path: (Service | ServiceGroup)[] = [];
        let currentItems = services;

        for (const pathId of bookingState.navigationPath) {
            const item = findItemById(currentItems, pathId);
            if (item) {
                path.push(item);
                if (item.type === 'group') {
                    currentItems = item.children;
                }
            }
        }

        return path;
    };

    // Handle navigation into a group or service selection
    const handleSelectItem = (item: Service | ServiceGroup) => {
        if (item.type === 'service') {
            // If service is selected, move to date-time stage
            // Reset form fields that are specific to the service
            const serviceQuestions = item.additionalQuestions || [];
            if (serviceQuestions.length > 0) {
                // Keep base question values but reset service-specific questions
                const currentValues = form.getValues();
                const fieldNames = serviceQuestions.map(q => q.name);

                // Create reset data with only the service questions cleared
                const resetData = { ...currentValues };
                fieldNames.forEach(name => {
                    resetData[name] = "";
                });

                // Reset only the service-specific fields
                form.reset(resetData);
            }

            handleBookingStateChange({
                ...bookingState,
                stage: 'date-time',
                selectedService: item,
                navigationPath: [...bookingState.navigationPath, item.id]
            });
        } else {
            // If group is selected, navigate into that group
            handleBookingStateChange({
                ...bookingState,
                navigationPath: [...bookingState.navigationPath, item.id]
            });
        }
    };

    // Handle date and time selection
    const handleSelectDateTime = (date: Date, time: string) => {
        handleBookingStateChange({
            ...bookingState,
            stage: 'customer-info',
            selectedDate: date,
            selectedTime: time
        });
    };

    // Handle going back one level
    const handleBack = () => {
        if (bookingState.stage === 'selection' && bookingState.navigationPath.length > 0) {
            // If in selection stage, go back one level in the navigation path
            handleBookingStateChange({
                ...bookingState,
                navigationPath: bookingState.navigationPath.slice(0, -1)
            });
        } else if (bookingState.stage === 'date-time') {
            // If in date-time stage, go back to selection
            // But preserve the navigation path except for the last item (the service)
            handleBookingStateChange({
                ...bookingState,
                stage: 'selection',
                selectedService: null,
                // Remove the last item from navigation path (the service)
                navigationPath: bookingState.navigationPath.slice(0, -1)
            });
        } else if (bookingState.stage === 'customer-info') {
            // If in customer-info stage, go back to date-time
            handleBookingStateChange({
                ...bookingState,
                stage: 'date-time',
                selectedDate: null,
                selectedTime: null
            });
        } else if (bookingState.stage === 'confirmation') {
            // Reset to beginning if on confirmation screen
            resetBookingFlow();
        }
    };

    // Reset the entire booking flow
    const resetBookingFlow = () => {
        // Reset form back to default values
        const defaultValues = baseQuestions.reduce((acc, field) => {
            // Handle nested fields for contact-info and address types
            if (field.type === 'contact-info') {
                const contactInfo: Record<string, string> = {
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: ""
                };

                // Add company field if it's required in the config
                if ('fieldConfig' in field && field.fieldConfig.companyRequired) {
                    contactInfo.company = "";
                }

                acc[field.name] = contactInfo;
            } else if (field.type === 'address') {
                acc[field.name] = {
                    street: "",
                    street2: "",
                    city: "",
                    state: "",
                    zip: ""
                };
            } else if (field.type === 'multiple-choice') {
                acc[field.name] = []; // Initialize as empty array for multiple selections
            } else {
                acc[field.name] = "";
            }
            return acc;
        }, {} as Record<string, any>);

        // Reset with default values
        form.reset(defaultValues);

        handleBookingStateChange({
            stage: 'selection',
            navigationPath: [],
            selectedService: null,
            selectedDate: null,
            selectedTime: null,
        });
    };

    // Render selection stage (browsing groups and services)
    const renderSelectionStage = () => {
        const currentItems = getCurrentItems();
        const breadcrumbPath = getBreadcrumbPath();
        const lastItemInPath = breadcrumbPath[breadcrumbPath.length - 1];

        return (
            <>
                <div className="@xl:grid @3xl:grid-cols-2 gap-4 @xl:items-start">
                    <div className="@xl:sticky @xl:top-8">
                        <Button
                            variant="ghost"
                            className={`flex items-center mb-2 text-muted-foreground p-0! hover:bg-transparent! hover:text-foreground! justify-start`}
                            onClick={handleBack}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </Button>
                        <h1 className="text-3xl font-bold mb-2">
                            {lastItemInPath ? lastItemInPath.title : startTitle}
                        </h1>
                        <p className="mb-4 text-muted-foreground">
                            {lastItemInPath ? lastItemInPath.description : startDescription}
                        </p>
                    </div>

                    <div>
                        <div className="grid gap-4">
                            {currentItems.map((item) => (
                                <button
                                    key={item.id}
                                    className="flex items-center gap-4 text-left h-auto p-6 gap-0 bg-[var(--custom-primary)]/10 rounded-lg hover:bg-[var(--custom-primary)]/20 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-[var(--custom-primary)]/50 focus:outline-none"
                                    onClick={() => handleSelectItem(item)}
                                >
                                    <div className="flex flex-col gap-0 items-start flex-1">
                                        <span className="text-lg font-semibold opacity-80">{item.title}</span>
                                        <span className="text-sm opacity-50">{item.description}</span>
                                        {item.type === 'service' && item.price && (
                                            <span className="text-sm mt-2 font-medium">{item.price}</span>
                                        )}
                                    </div>
                                    <div className="p-4 rounded-full bg-background">
                                        <ArrowRight className="size-4" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    // Add a useEffect to watch the form state for debugging
    useEffect(() => {
        const subscription = form.watch(() => {
            // Subscription to form state changes
        });

        return () => subscription.unsubscribe();
    }, [form]);

    // Render date-time selection stage
    const renderDateTimeStage = () => {
        if (!bookingState.selectedService) return null;

        // Get the latest service data if the getServiceById function is available
        const serviceId = bookingState.selectedService.id;
        const latestService = getServiceById && serviceId ?
            getServiceById(serviceId) || bookingState.selectedService :
            bookingState.selectedService;

        return (
            <>
                {/* TODO: Replace with new BookingScheduler component */}
                <div className="text-center p-8">
                    <h2 className="text-2xl font-bold mb-4">Calendar Integration Coming Soon</h2>
                    <p className="text-muted-foreground mb-6">
                        The booking calendar for "{latestService.title}" will be integrated here.
                    </p>
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            <p>Duration: {latestService.duration} minutes</p>
                            <p>Buffer Time: {latestService.bufferTime || 15} minutes</p>
                            <p>Interval: {latestService.interval || 30} minutes</p>
                        </div>
                        <Button onClick={handleBack} variant="outline">
                            Back to Service Selection
                        </Button>
                    </div>
                </div>
                {/* 
                TODO: Replace the above placeholder with:
                <BookingScheduler
                    title="Select an available time"
                    serviceName={latestService.title}
                    timezone="America/New_York"
                    availabilityRules={latestService.availabilityRules || []}
                    blockedTimes={latestService.blockedTimes || []}
                    unavailableDates={latestService.unavailableDates || []}
                    duration={latestService.duration}
                    bufferTime={latestService.bufferTime || 15}
                    interval={latestService.interval || 30}
                    primaryColor={primaryColor}
                    darkMode={darkMode}
                    onSelectDateTime={handleSelectDateTime}
                    onBackClicked={handleBack}
                />
                */}
            </>
        );
    };

    // Render customer info stage
    const renderCustomerInfoStage = () => {
        if (!bookingState.selectedService || !bookingState.selectedDate || !bookingState.selectedTime) return null;

        // Get the latest service data if the getServiceById function is available
        const serviceId = bookingState.selectedService.id;
        const latestService = getServiceById && serviceId ?
            getServiceById(serviceId) || bookingState.selectedService :
            bookingState.selectedService;

        // Combine base questions with service-specific questions
        const allQuestions = getActiveQuestions();

        // Format date for display
        const formattedDate = bookingState.selectedDate.toLocaleDateString();

        // Get current form state for debugging
        const hasErrors = Object.keys(form.formState.errors).length > 0;

        // Add safety check - never show confirmation if there are errors
        const shouldShowConfirmation = bookingState.stage === 'confirmation' && !hasErrors;

        if (bookingState.stage === 'confirmation' && hasErrors) {
            // Safety measure: force back to customer-info stage if there are errors
            setTimeout(() => {
                if (bookingState.stage === 'confirmation' && Object.keys(form.formState.errors).length > 0) {
                    handleBookingStateChange({
                        ...bookingState,
                        stage: 'customer-info'
                    });
                    setShowValidation(true);
                }
            }, 100);
        }

        // Update the form submission handler to show validation errors
        const handleSubmitForm = form.handleSubmit(
            // Success handler
            (data) => {
                handleSubmitCustomerInfo(data);
            },
            // Error handler - runs when validation fails
            (errors) => {
                setShowValidation(true);
                return false;
            }
        );

        return (
            <>
                <div className="@3xl:grid @3xl:grid-cols-[1fr_500px] @3xl:gap-12">
                    <div className="@3xl:sticky @3xl:top-8">

                        <Button
                            variant="ghost"
                            className={`flex items-center mb-2 text-muted-foreground p-0! hover:bg-transparent! hover:text-foreground! justify-start`}
                            onClick={handleBack}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Back
                        </Button>

                        <p className="text-muted-foreground mb-2">
                            {formattedDate} at {bookingState.selectedTime}
                        </p>
                        <h1 className="text-2xl font-bold mb-4">{latestService.title}</h1>
                        <p className="text-muted-foreground">
                            Please provide your details to confirm your booking.
                        </p>
                    </div>

                    <div className="mt-8 @3xl:mt-0 @container/form">
                        {shouldShowConfirmation ? (
                            <div className="bg-[var(--custom-primary)]/10 rounded-lg p-8 text-center">
                                <div className="mb-6">
                                    <div className="mx-auto w-16 h-16 bg-[var(--custom-primary)]/20 rounded-full flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--custom-primary)]">
                                            <polyline points="20 6 9 17 4 12"></polyline>
                                        </svg>
                                    </div>
                                    <h2 className="text-xl font-bold mb-2">Booking Confirmed!</h2>
                                    <p className="text-foreground/50">
                                        Thank you for your booking. We'll be in touch shortly.
                                    </p>
                                </div>
                                <div className="space-y-4 text-left mb-6">
                                    <div>
                                        <h3 className="font-medium text-sm text-foreground/50">Service</h3>
                                        <p className="font-medium">{latestService.title}</p>
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-sm text-foreground/50">Date & Time</h3>
                                        <p className="font-medium">{formattedDate} at {bookingState.selectedTime}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={resetBookingFlow}
                                    className="w-full bg-[var(--custom-primary)] text-[var(--custom-primary-foreground)] rounded-md p-3 hover:bg-[var(--custom-primary)]/80 transition-colors font-medium text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--custom-primary)]/50"
                                >
                                    Book Another Appointment
                                </button>
                            </div>
                        ) : (
                            <Form {...form}>
                                <form
                                    onSubmit={(e) => {
                                        return handleSubmitForm(e);
                                    }}
                                    className="space-y-10"
                                >
                                    {allQuestions.map((field) => (
                                        <FormFieldRenderer
                                            key={`${field.id}-${field.type}`}
                                            field={field}
                                            control={form.control}
                                            onFileUpdate={handleFileUpdate}
                                            maxTotalFileSize={MAX_TOTAL_FILE_SIZE}
                                            currentTotalFileSize={totalFileSize}
                                            showValidation={showValidation}
                                            onOptionValueChange={handleOptionValueChange}
                                            darkMode={darkMode}
                                        />
                                    ))}
                                    <Button
                                        type="submit"
                                        size="lg"
                                        className="w-full h-12"
                                        style={{
                                            backgroundColor: 'var(--custom-primary)',
                                            color: 'var(--custom-primary-foreground)'
                                        }}
                                    >
                                        Complete Booking
                                    </Button>
                                </form>
                            </Form>
                        )}
                    </div>
                </div>
            </>
        );
    };

    // Main render function
    const renderCurrentStage = () => {
        switch (bookingState.stage) {
            case 'selection':
                return renderSelectionStage();
            case 'date-time':
                return renderDateTimeStage();
            case 'customer-info':
            case 'confirmation':
                return renderCustomerInfoStage();
            default:
                return <p>Unknown stage</p>;
        }
    };

    // Call resetFormErrors when the selected service changes, as this affects available questions
    useEffect(() => {
        if (bookingState.selectedService) {
            resetFormErrors();
        }
    }, [bookingState.selectedService, resetFormErrors]);

    // Call resetFormErrors when booking stage changes
    useEffect(() => {
        if (bookingState.stage === 'customer-info') {
            resetFormErrors();
        }
    }, [bookingState.stage, resetFormErrors]);

    return (
        <div
            id={id}
            ref={mainContainerRef} // Attach ref here
            className={cn("w-full flex bg-background text-foreground @container", darkMode ? "dark" : "", className)}
            style={customStyleVars}
        >
            <div className="w-full p-4 @lg:p-6 @2xl:p-8">
                {renderCurrentStage()}
            </div>
        </div>
    );
}