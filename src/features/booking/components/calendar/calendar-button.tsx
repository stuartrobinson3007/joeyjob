import { cn } from "@/taali/lib/utils";
import { useRef, useState } from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	children: React.ReactNode;
	isDisabled?: boolean;
}

export function Button({
	children,
	isDisabled,
	className,
	onFocus,
	onBlur,
	...props
}: ButtonProps) {
	const ref = useRef<HTMLButtonElement>(null);
	const [isFocusVisible, setIsFocusVisible] = useState(false);

	const handleFocus = (e: React.FocusEvent<HTMLButtonElement>) => {
		setIsFocusVisible(true);
		onFocus?.(e);
	};

	const handleBlur = (e: React.FocusEvent<HTMLButtonElement>) => {
		setIsFocusVisible(false);
		onBlur?.(e);
	};

	return (
		<button
			{...props}
			ref={ref}
			disabled={isDisabled}
			className={cn(
				"p-2 rounded-lg outline-none text-foreground focus:outline-primary",
				isDisabled ? "text-foreground/50" : "hover:bg-muted",
				isFocusVisible && "ring-2 ring-offset-2 ring-primary",
				className
			)}
			onFocus={handleFocus}
			onBlur={handleBlur}
		>
			{children}
		</button>
	);
}