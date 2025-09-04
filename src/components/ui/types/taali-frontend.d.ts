declare module 'taali/frontend' {
  export function useDebouncedCallback<T extends any[]>(
    callback: (...args: T) => void,
    delay: number
  ): (...args: T) => void;

  export function updateColumnFilter<TData>(
    table: any,
    columnId: string,
    value: unknown,
    operator: string,
    variant: string
  ): void;

  export function removeColumnFilter<TData>(
    table: any,
    columnId: string
  ): void;

  export function useFilterState(
    table: any,
    columnId: string
  ): {
    filter: any;
    value: unknown;
    metadata: Record<string, unknown> | undefined;
    hasValue: boolean;
  };
}